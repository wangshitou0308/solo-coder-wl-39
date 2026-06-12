import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Signer } from './entities/signer.entity';
import { Contract } from '../contract/entities/contract.entity';
import { ContractTimeline } from '../contract/entities/contract-timeline.entity';
import {
  SignerStatus,
  SigningMode,
  ContractStatus,
  SignMethod,
} from '../../common/enums';
import { CryptoUtil } from '../../common/utils/crypto.util';
import { SignContractDto } from './dto/sign-contract.dto';
import { RejectContractDto } from './dto/reject-contract.dto';
import { NotificationService } from '../notification/notification.service';
import { PdfService } from '../pdf/pdf.service';

@Injectable()
export class SigningService {
  private readonly logger = new Logger(SigningService.name);

  constructor(
    @InjectRepository(Signer)
    private readonly signerRepository: Repository<Signer>,
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
    @InjectRepository(ContractTimeline)
    private readonly timelineRepository: Repository<ContractTimeline>,
    private readonly notificationService: NotificationService,
    private readonly pdfService: PdfService,
  ) {}

  async getSignersByContract(contractId: string, tenantId: string): Promise<Signer[]> {
    const contract = await this.contractRepository.findOne({
      where: { id: contractId, tenantId },
    });
    if (!contract) {
      throw new NotFoundException('合同不存在');
    }

    return this.signerRepository.find({
      where: { contractId },
      order: { signOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  async verifySignToken(
    token: string,
  ): Promise<{ signer: Signer; contract: Contract }> {
    const signer = await this.signerRepository.findOne({
      where: { signToken: token },
    });

    if (!signer) {
      throw new NotFoundException('无效的签署链接');
    }

    const contract = await this.contractRepository.findOne({
      where: { id: signer.contractId },
    });

    if (!contract) {
      throw new NotFoundException('合同不存在');
    }

    if (
      contract.status !== ContractStatus.SIGNING ||
      signer.status === SignerStatus.SIGNED ||
      signer.status === SignerStatus.REJECTED ||
      signer.status === SignerStatus.SKIPPED
    ) {
      throw new BadRequestException('该签署链接已失效');
    }

    return { signer, contract };
  }

  async activateNextSigners(contractId: string): Promise<Signer[]> {
    const contract = await this.contractRepository.findOne({
      where: { id: contractId },
      relations: ['signers'],
    });

    if (!contract) {
      throw new NotFoundException('合同不存在');
    }

    const pendingSigners = contract.signers.filter(
      (s) => s.status === SignerStatus.PENDING,
    );

    if (pendingSigners.length === 0) {
      return [];
    }

    const activatedSigners: Signer[] = [];

    if (contract.signingMode === SigningMode.SEQUENTIAL) {
      const minOrder = Math.min(...pendingSigners.map((s) => s.signOrder));
      const nextSigners = pendingSigners.filter(
        (s) => s.signOrder === minOrder,
      );

      for (const signer of nextSigners) {
        signer.status = SignerStatus.SIGNING;
        signer.signToken = CryptoUtil.generateToken();
        const saved = await this.signerRepository.save(signer);
        activatedSigners.push(saved);
        this.notificationService.sendSignRequest(saved, contract);
      }
    } else if (contract.signingMode === SigningMode.PARALLEL) {
      for (const signer of pendingSigners) {
        signer.status = SignerStatus.SIGNING;
        signer.signToken = CryptoUtil.generateToken();
        const saved = await this.signerRepository.save(signer);
        activatedSigners.push(saved);
        this.notificationService.sendSignRequest(saved, contract);
      }
    }

    this.logger.log(
      `激活签署人: contractId=${contractId}, count=${activatedSigners.length}, mode=${contract.signingMode}`,
    );

    return activatedSigners;
  }

  async signContract(
    signerId: string,
    dto: SignContractDto,
    ipAddress: string,
    userAgent: string,
  ): Promise<{ signer: Signer; contract: Contract; allSigned: boolean }> {
    const signer = await this.signerRepository.findOne({
      where: { id: signerId },
    });

    if (!signer) {
      throw new NotFoundException('签署人不存在');
    }

    if (signer.status !== SignerStatus.SIGNING) {
      throw new BadRequestException('当前签署人状态不允许签署');
    }

    if (dto.signMethod === SignMethod.HANDWRITE && !dto.signatureUrl) {
      throw new BadRequestException('手写签名方式需要提供签名URL');
    }

    if (dto.signMethod === SignMethod.SEAL && !dto.sealId) {
      throw new BadRequestException('印章签署方式需要提供印章ID');
    }

    const contract = await this.contractRepository.findOne({
      where: { id: signer.contractId },
    });

    if (!contract) {
      throw new NotFoundException('合同不存在');
    }

    if (contract.status !== ContractStatus.SIGNING) {
      throw new BadRequestException('合同当前状态不允许签署');
    }

    const signedAt = new Date();
    const fingerprintData = {
      contractId: contract.id,
      signerId: signer.id,
      signedAt: signedAt.toISOString(),
      ipAddress,
      userAgent,
    };
    const digitalFingerprint = CryptoUtil.generateHash(fingerprintData);

    signer.status = SignerStatus.SIGNED;
    signer.signMethod = dto.signMethod;
    signer.signatureUrl = dto.signatureUrl || signer.signatureUrl;
    signer.sealId = dto.sealId || signer.sealId;
    signer.signedAt = signedAt;
    signer.ipAddress = ipAddress;
    signer.userAgent = userAgent;
    signer.digitalFingerprint = digitalFingerprint;

    await this.signerRepository.save(signer);

    const timeline = this.timelineRepository.create({
      contractId: contract.id,
      action: '签署完成',
      operatorId: signer.userId,
      operatorName: signer.name,
      remark: `${signer.name} 完成了签署（${dto.signMethod === SignMethod.HANDWRITE ? '手写签名' : '印章签署'}）`,
      ipAddress,
      userAgent,
      metadata: {
        signerId: signer.id,
        signMethod: dto.signMethod,
        digitalFingerprint,
      },
    });
    await this.timelineRepository.save(timeline);

    const allSigners = await this.signerRepository.find({
      where: { contractId: contract.id },
    });
    const allSigned = allSigners.every(
      (s) => s.status === SignerStatus.SIGNED,
    );

    if (allSigned) {
      contract.status = ContractStatus.COMPLETED;
      contract.completedAt = new Date();
      contract.digitalFingerprint = CryptoUtil.generateHash({
        contractId: contract.id,
        completedAt: contract.completedAt.toISOString(),
        signers: allSigners.map((s) => ({
          signerId: s.id,
          status: s.status,
          signedAt: s.signedAt,
          digitalFingerprint: s.digitalFingerprint,
        })),
      });

      try {
        const signedPdfUrl = await this.pdfService.generateContractPdf(contract);
        contract.signedPdfUrl = signedPdfUrl;
      } catch (err) {
        this.logger.error(`生成已签署PDF失败: ${err.message}`);
      }

      await this.contractRepository.save(contract);

      const completedTimeline = this.timelineRepository.create({
        contractId: contract.id,
        action: '合同签署完成',
        operatorName: '系统',
        remark: '所有签署人已完成签署，合同生效',
        metadata: {
          completedAt: contract.completedAt,
          digitalFingerprint: contract.digitalFingerprint,
        },
      });
      await this.timelineRepository.save(completedTimeline);

      try {
        const timelines = await this.timelineRepository.find({
          where: { contractId: contract.id },
          order: { createdAt: 'ASC' },
        });
        await this.pdfService.generateSigningCertificate(
          contract,
          allSigners,
          timelines,
        );
      } catch (err) {
        this.logger.error(`生成签署证书失败: ${err.message}`);
      }

      this.notificationService.sendContractCompleted(contract, allSigners);

      this.logger.log(
        `合同签署完成: contractId=${contract.id}, contractNo=${contract.contractNo}`,
      );
    } else {
      await this.activateNextSigners(contract.id);
    }

    return { signer, contract, allSigned };
  }

  async rejectContract(
    signerId: string,
    dto: RejectContractDto,
    ipAddress: string,
    userAgent: string,
  ): Promise<{ signer: Signer; contract: Contract }> {
    const signer = await this.signerRepository.findOne({
      where: { id: signerId },
    });

    if (!signer) {
      throw new NotFoundException('签署人不存在');
    }

    if (
      signer.status !== SignerStatus.SIGNING &&
      signer.status !== SignerStatus.PENDING
    ) {
      throw new BadRequestException('当前签署人状态不允许拒绝');
    }

    const contract = await this.contractRepository.findOne({
      where: { id: signer.contractId },
    });

    if (!contract) {
      throw new NotFoundException('合同不存在');
    }

    if (
      contract.status !== ContractStatus.SIGNING &&
      contract.status !== ContractStatus.DRAFT
    ) {
      throw new BadRequestException('合同当前状态不允许拒绝');
    }

    const fingerprintData = {
      contractId: contract.id,
      signerId: signer.id,
      rejectedAt: new Date().toISOString(),
      reason: dto.reason,
      ipAddress,
      userAgent,
    };
    const digitalFingerprint = CryptoUtil.generateHash(fingerprintData);

    signer.status = SignerStatus.REJECTED;
    signer.rejectReason = dto.reason;
    signer.ipAddress = ipAddress;
    signer.userAgent = userAgent;
    signer.digitalFingerprint = digitalFingerprint;

    await this.signerRepository.save(signer);

    contract.status = ContractStatus.REJECTED;
    await this.contractRepository.save(contract);

    const timeline = this.timelineRepository.create({
      contractId: contract.id,
      action: '拒绝签署',
      operatorId: signer.userId,
      operatorName: signer.name,
      remark: `${signer.name} 拒绝签署，原因：${dto.reason}`,
      ipAddress,
      userAgent,
      metadata: {
        signerId: signer.id,
        rejectReason: dto.reason,
        digitalFingerprint,
      },
    });
    await this.timelineRepository.save(timeline);

    this.notificationService.sendContractRejected(contract, signer, dto.reason);

    this.logger.log(
      `合同被拒绝: contractId=${contract.id}, signerId=${signer.id}, reason=${dto.reason}`,
    );

    return { signer, contract };
  }

  async sendReminder(signerId: string, tenantId: string): Promise<Signer> {
    const signer = await this.signerRepository.findOne({
      where: { id: signerId },
    });

    if (!signer) {
      throw new NotFoundException('签署人不存在');
    }

    if (signer.status !== SignerStatus.SIGNING) {
      throw new BadRequestException('仅可提醒签署中的签署人');
    }

    const contract = await this.contractRepository.findOne({
      where: { id: signer.contractId, tenantId },
    });

    if (!contract) {
      throw new ForbiddenException('无权限操作该签署人');
    }

    signer.reminderCount = signer.reminderCount + 1;
    signer.lastReminderAt = new Date();
    await this.signerRepository.save(signer);

    this.notificationService.sendSignReminder(signer, contract);

    this.logger.log(
      `发送签署提醒: signerId=${signer.id}, contractId=${contract.id}, count=${signer.reminderCount}`,
    );

    return signer;
  }
}
