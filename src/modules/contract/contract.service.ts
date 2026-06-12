import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { Contract } from './entities/contract.entity';
import { ContractTimeline } from './entities/contract-timeline.entity';
import { VoidRequest } from './entities/void-request.entity';
import { VoidRequestSigner } from './entities/void-request-signer.entity';
import { Signer } from '../signing/entities/signer.entity';
import { Tenant } from '../tenant/entities/tenant.entity';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { QueryContractDto } from './dto/query-contract.dto';
import { CancelContractDto } from './dto/cancel-contract.dto';
import { VoidContractDto, ConfirmVoidDto } from './dto/void-contract.dto';
import {
  ContractStatus,
  SigningMode,
  SignerStatus,
  UserRole,
  VoidRequestStatus,
} from '../../common/enums';
import { CryptoUtil } from '../../common/utils/crypto.util';
import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { NotificationService } from '../notification/notification.service';
import { PdfService } from '../pdf/pdf.service';

export interface PaginatedContracts {
  data: Contract[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class ContractService {
  private readonly logger = new Logger(ContractService.name);

  constructor(
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
    @InjectRepository(ContractTimeline)
    private readonly timelineRepository: Repository<ContractTimeline>,
    @InjectRepository(VoidRequest)
    private readonly voidRequestRepository: Repository<VoidRequest>,
    @InjectRepository(VoidRequestSigner)
    private readonly voidRequestSignerRepository: Repository<VoidRequestSigner>,
    @InjectRepository(Signer)
    private readonly signerRepository: Repository<Signer>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    private readonly notificationService: NotificationService,
    private readonly pdfService: PdfService,
  ) {}

  private async addTimeline(
    contractId: string,
    action: string,
    operatorId?: string,
    operatorName?: string,
    remark?: string,
  ): Promise<ContractTimeline> {
    const timeline = this.timelineRepository.create({
      contractId,
      action,
      operatorId,
      operatorName,
      remark,
    });
    return this.timelineRepository.save(timeline);
  }

  private async getTenantDefaultSignDays(tenantId: string): Promise<number> {
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
    });
    return tenant?.defaultSignDays ?? 30;
  }

  private checkInitiatorOrAdmin(
    contract: Contract,
    user: CurrentUserPayload,
  ): boolean {
    return (
      user.role === UserRole.ADMIN || contract.initiatorId === user.userId
    );
  }

  async create(
    createContractDto: CreateContractDto,
    user: CurrentUserPayload,
  ): Promise<Contract> {
    const contractNo = CryptoUtil.generateContractNumber(user.tenantId);

    let signDeadline: Date | undefined;
    if (createContractDto.signDeadline) {
      signDeadline = new Date(createContractDto.signDeadline);
    } else {
      const defaultDays = await this.getTenantDefaultSignDays(user.tenantId);
      signDeadline = new Date();
      signDeadline.setDate(signDeadline.getDate() + defaultDays);
    }

    const signers: Signer[] = createContractDto.signers.map((s, index) =>
      this.signerRepository.create({
        name: s.name,
        email: s.email,
        phone: s.phone,
        signOrder: s.signOrder ?? index,
        userId: s.userId,
        status: SignerStatus.PENDING,
      }),
    );

    const contract = this.contractRepository.create({
      ...createContractDto,
      tenantId: user.tenantId,
      contractNo,
      initiatorId: user.userId,
      status: ContractStatus.DRAFT,
      signDeadline,
      signers,
      createdBy: user.userId,
      updatedBy: user.userId,
    });

    const savedContract = await this.contractRepository.save(contract);

    await this.addTimeline(
      savedContract.id,
      '创建合同',
      user.userId,
      user.email,
      `合同编号: ${contractNo}`,
    );

    this.logger.log(
      `创建合同成功: contractId=${savedContract.id}, contractNo=${contractNo}, initiator=${user.userId}`,
    );

    return this.findOne(savedContract.id, user);
  }

  async findAll(
    query: QueryContractDto,
    user: CurrentUserPayload,
    page: number = 1,
    pageSize: number = 10,
  ): Promise<PaginatedContracts> {
    const queryBuilder = this.contractRepository
      .createQueryBuilder('contract')
      .leftJoinAndSelect('contract.signers', 'signer')
      .leftJoinAndSelect('contract.timelines', 'timeline');

    queryBuilder.where('contract.tenantId = :tenantId', {
      tenantId: user.tenantId,
    });

    if (query.title) {
      queryBuilder.andWhere('contract.title ILIKE :title', {
        title: `%${query.title}%`,
      });
    }

    if (query.initiatorId) {
      queryBuilder.andWhere('contract.initiatorId = :initiatorId', {
        initiatorId: query.initiatorId,
      });
    }

    if (query.status) {
      queryBuilder.andWhere('contract.status = :status', {
        status: query.status,
      });
    }

    if (query.signingMode) {
      queryBuilder.andWhere('contract.signingMode = :signingMode', {
        signingMode: query.signingMode,
      });
    }

    if (query.tag) {
      queryBuilder.andWhere('contract.tags @> :tag::jsonb', {
        tag: JSON.stringify([query.tag]),
      });
    }

    if (query.startDate && query.endDate) {
      queryBuilder.andWhere(
        'contract.createdAt BETWEEN :startDate AND :endDate',
        {
          startDate: new Date(query.startDate),
          endDate: new Date(query.endDate),
        },
      );
    } else if (query.startDate) {
      queryBuilder.andWhere('contract.createdAt >= :startDate', {
        startDate: new Date(query.startDate),
      });
    } else if (query.endDate) {
      queryBuilder.andWhere('contract.createdAt <= :endDate', {
        endDate: new Date(query.endDate),
      });
    }

    queryBuilder.orderBy('contract.createdAt', 'DESC');
    queryBuilder.skip((page - 1) * pageSize);
    queryBuilder.take(pageSize);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      pageSize,
    };
  }

  async findOne(id: string, user: CurrentUserPayload): Promise<Contract> {
    const contract = await this.contractRepository.findOne({
      where: { id, tenantId: user.tenantId },
      relations: ['signers', 'timelines'],
    });

    if (!contract) {
      throw new NotFoundException('合同不存在');
    }

    return contract;
  }

  async update(
    id: string,
    updateContractDto: UpdateContractDto,
    user: CurrentUserPayload,
  ): Promise<Contract> {
    const contract = await this.findOne(id, user);

    if (contract.status !== ContractStatus.DRAFT) {
      throw new BadRequestException('仅草稿状态的合同可更新');
    }

    if (!this.checkInitiatorOrAdmin(contract, user)) {
      throw new ForbiddenException('无权限修改该合同');
    }

    if (updateContractDto.signers) {
      await this.signerRepository.delete({ contractId: contract.id });

      const newSigners: Signer[] = updateContractDto.signers.map((s, index) =>
        this.signerRepository.create({
          contractId: contract.id,
          name: s.name,
          email: s.email,
          phone: s.phone,
          signOrder: s.signOrder ?? index,
          userId: s.userId,
          status: SignerStatus.PENDING,
        }),
      );
      contract.signers = await this.signerRepository.save(newSigners);
      delete updateContractDto.signers;
    }

    Object.assign(contract, updateContractDto);
    contract.updatedBy = user.userId;

    const savedContract = await this.contractRepository.save(contract);

    await this.addTimeline(
      savedContract.id,
      '更新合同',
      user.userId,
      user.email,
    );

    this.logger.log(
      `更新合同成功: contractId=${savedContract.id}, operator=${user.userId}`,
    );

    return this.findOne(savedContract.id, user);
  }

  async launch(id: string, user: CurrentUserPayload): Promise<Contract> {
    const contract = await this.findOne(id, user);

    if (contract.status !== ContractStatus.DRAFT) {
      throw new BadRequestException('仅草稿状态的合同可发起签署');
    }

    if (!this.checkInitiatorOrAdmin(contract, user)) {
      throw new ForbiddenException('无权限发起该合同');
    }

    if (!contract.signers || contract.signers.length === 0) {
      throw new BadRequestException('合同至少需要一个签署人');
    }

    if (!contract.pdfFileUrl && !contract.content) {
      throw new BadRequestException('合同缺少PDF文件或内容');
    }

    if (!contract.pdfFileUrl) {
      contract.pdfFileUrl = await this.pdfService.generateContractPdf(contract);
    }

    const fingerprintData = {
      contractNo: contract.contractNo,
      title: contract.title,
      content: contract.content,
      pdfFileUrl: contract.pdfFileUrl,
      createdAt: contract.createdAt,
      signers: contract.signers.map((s) => ({
        name: s.name,
        email: s.email,
        signOrder: s.signOrder,
      })),
    };
    contract.digitalFingerprint = CryptoUtil.generateHash(fingerprintData);

    contract.status = ContractStatus.SIGNING;
    contract.updatedBy = user.userId;

    if (contract.signingMode === SigningMode.SEQUENTIAL) {
      const sortedSigners = [...contract.signers].sort(
        (a, b) => a.signOrder - b.signOrder,
      );
      sortedSigners[0].status = SignerStatus.SIGNING;
      sortedSigners[0].signToken = CryptoUtil.generateToken();
      await this.signerRepository.save(sortedSigners[0]);

      await this.notificationService.sendSignRequest(
        { ...sortedSigners[0], contractId: contract.id } as Signer,
        contract,
      );
    } else {
      for (const signer of contract.signers) {
        signer.status = SignerStatus.SIGNING;
        signer.signToken = CryptoUtil.generateToken();
        await this.signerRepository.save(signer);

        await this.notificationService.sendSignRequest(
          { ...signer, contractId: contract.id } as Signer,
          contract,
        );
      }
    }

    const savedContract = await this.contractRepository.save(contract);

    await this.addTimeline(
      savedContract.id,
      '发起签署',
      user.userId,
      user.email,
      `签署模式: ${contract.signingMode}`,
    );

    this.logger.log(
      `发起合同签署成功: contractId=${savedContract.id}, operator=${user.userId}`,
    );

    return this.findOne(savedContract.id, user);
  }

  async cancel(
    id: string,
    cancelContractDto: CancelContractDto,
    user: CurrentUserPayload,
  ): Promise<Contract> {
    const contract = await this.findOne(id, user);

    if (contract.status !== ContractStatus.SIGNING) {
      throw new BadRequestException('仅签署中的合同可撤销');
    }

    if (!this.checkInitiatorOrAdmin(contract, user)) {
      throw new ForbiddenException('无权限撤销该合同');
    }

    contract.status = ContractStatus.CANCELLED;
    contract.updatedBy = user.userId;

    const signedSigners = contract.signers.filter(
      (s) => s.status === SignerStatus.SIGNED,
    );

    if (signedSigners.length > 0) {
      await this.notificationService.sendContractCancelled(
        contract,
        signedSigners,
      );
    }

    const savedContract = await this.contractRepository.save(contract);

    await this.addTimeline(
      savedContract.id,
      '撤销合同',
      user.userId,
      user.email,
      cancelContractDto.reason,
    );

    this.logger.log(
      `撤销合同成功: contractId=${savedContract.id}, operator=${user.userId}`,
    );

    return this.findOne(savedContract.id, user);
  }

  async voidContract(
    id: string,
    voidContractDto: VoidContractDto,
    user: CurrentUserPayload,
  ): Promise<VoidRequest> {
    const contract = await this.findOne(id, user);

    if (contract.status !== ContractStatus.COMPLETED) {
      throw new BadRequestException('仅已完成的合同可申请作废');
    }

    if (!this.checkInitiatorOrAdmin(contract, user)) {
      throw new ForbiddenException('无权限申请作废该合同');
    }

    const signedSigners = contract.signers.filter(
      (s) => s.status === SignerStatus.SIGNED,
    );

    const voidRequestSigners: VoidRequestSigner[] = signedSigners.map((s) =>
      this.voidRequestSignerRepository.create({
        signerId: s.id,
        signerName: s.name,
        status: VoidRequestStatus.PENDING,
      }),
    );

    const voidRequest = this.voidRequestRepository.create({
      tenantId: user.tenantId,
      contractId: contract.id,
      initiatorId: user.userId,
      reason: voidContractDto.reason,
      status: VoidRequestStatus.PENDING,
      signers: voidRequestSigners,
      createdBy: user.userId,
      updatedBy: user.userId,
    });

    const savedVoidRequest = await this.voidRequestRepository.save(voidRequest);

    contract.voidRequestId = savedVoidRequest.id;
    contract.updatedBy = user.userId;
    await this.contractRepository.save(contract);

    await this.addTimeline(
      contract.id,
      '发起作废申请',
      user.userId,
      user.email,
      `作废原因: ${voidContractDto.reason}`,
    );

    this.logger.log(
      `发起作废申请成功: contractId=${contract.id}, voidRequestId=${savedVoidRequest.id}, operator=${user.userId}`,
    );

    return savedVoidRequest;
  }

  async confirmVoid(
    voidRequestId: string,
    signerId: string,
    confirmVoidDto: ConfirmVoidDto,
    user: CurrentUserPayload,
  ): Promise<VoidRequest> {
    const voidRequest = await this.voidRequestRepository.findOne({
      where: { id: voidRequestId, tenantId: user.tenantId },
      relations: ['signers'],
    });

    if (!voidRequest) {
      throw new NotFoundException('作废申请不存在');
    }

    if (voidRequest.status !== VoidRequestStatus.PENDING) {
      throw new BadRequestException('该作废申请已处理完毕');
    }

    const voidRequestSigner = voidRequest.signers.find(
      (s) => s.signerId === signerId,
    );

    if (!voidRequestSigner) {
      throw new ForbiddenException('您不是该合同的签署人');
    }

    if (voidRequestSigner.status !== VoidRequestStatus.PENDING) {
      throw new BadRequestException('您已确认过该作废申请');
    }

    voidRequestSigner.status = VoidRequestStatus.CONFIRMED;
    voidRequestSigner.confirmedAt = new Date().toISOString();
    voidRequestSigner.remark = confirmVoidDto.remark;
    await this.voidRequestSignerRepository.save(voidRequestSigner);

    await this.addTimeline(
      voidRequest.contractId,
      '签署人确认作废',
      user.userId,
      voidRequestSigner.signerName,
      confirmVoidDto.remark,
    );

    this.logger.log(
      `签署人确认作废: voidRequestId=${voidRequestId}, signerId=${signerId}`,
    );

    const updatedVoidRequest = await this.voidRequestRepository.findOne({
      where: { id: voidRequestId },
      relations: ['signers'],
    });

    await this.checkVoidCompletion(updatedVoidRequest!);

    return updatedVoidRequest!;
  }

  async checkVoidCompletion(voidRequest: VoidRequest): Promise<void> {
    if (voidRequest.status !== VoidRequestStatus.PENDING) {
      return;
    }

    const allConfirmed = voidRequest.signers.every(
      (s) => s.status === VoidRequestStatus.CONFIRMED,
    );

    if (allConfirmed) {
      voidRequest.status = VoidRequestStatus.CONFIRMED;
      voidRequest.confirmedAt = new Date();
      await this.voidRequestRepository.save(voidRequest);

      const contract = await this.contractRepository.findOne({
        where: { id: voidRequest.contractId },
        relations: ['signers'],
      });

      if (contract) {
        contract.status = ContractStatus.VOIDED;
        contract.voidReason = voidRequest.reason;
        await this.contractRepository.save(contract);

        await this.notificationService.sendContractVoided(
          contract,
          contract.signers,
        );

        await this.addTimeline(
          contract.id,
          '合同已作废',
          voidRequest.initiatorId,
          undefined,
          `作废原因: ${voidRequest.reason}`,
        );

        this.logger.log(
          `合同作废完成: contractId=${contract.id}, voidRequestId=${voidRequest.id}`,
        );
      }
    }
  }

  async findVoidRequest(
    voidRequestId: string,
    user: CurrentUserPayload,
  ): Promise<VoidRequest> {
    const voidRequest = await this.voidRequestRepository.findOne({
      where: { id: voidRequestId, tenantId: user.tenantId },
      relations: ['signers'],
    });

    if (!voidRequest) {
      throw new NotFoundException('作废申请不存在');
    }

    return voidRequest;
  }
}
