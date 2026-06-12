import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import * as archiver from 'archiver';
import { v4 as uuidv4 } from 'uuid';
import { Contract } from '../contract/entities/contract.entity';
import { Signer } from '../signing/entities/signer.entity';
import { Archive } from '../archive/entities/archive.entity';
import { User } from '../user/entities/user.entity';
import {
  ContractStatus,
  SignerStatus,
  UserRole,
  SigningMode,
} from '../../common/enums';
import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { BatchRemindDto } from './dto/batch-remind.dto';
import { BatchExportDto } from './dto/batch-export.dto';
import { BatchDownloadDto } from './dto/batch-download.dto';
import { SigningService } from '../signing/signing.service';
import { NotificationService } from '../notification/notification.service';

export interface BatchRemindResult {
  success: number;
  failed: number;
  details: { id: string; name: string; status: string; reason?: string }[];
}

export interface BatchExportResult {
  filename: string;
  contentType: string;
  base64Content: string;
}

export interface BatchDownloadResult {
  filename: string;
  filePath: string;
  fileCount: number;
}

@Injectable()
export class BatchService {
  private readonly logger = new Logger(BatchService.name);
  private readonly exportDir = path.join(process.cwd(), 'exports');
  private readonly downloadDir = path.join(process.cwd(), 'downloads');

  constructor(
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
    @InjectRepository(Signer)
    private readonly signerRepository: Repository<Signer>,
    @InjectRepository(Archive)
    private readonly archiveRepository: Repository<Archive>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly signingService: SigningService,
    private readonly notificationService: NotificationService,
  ) {
    this.ensureDirectory(this.exportDir);
    this.ensureDirectory(this.downloadDir);
  }

  private ensureDirectory(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private checkInitiatorOrAdmin(
    contract: Contract,
    user: CurrentUserPayload,
  ): boolean {
    return user.role === UserRole.ADMIN || contract.initiatorId === user.userId;
  }

  async batchSendReminders(
    dto: BatchRemindDto,
    user: CurrentUserPayload,
  ): Promise<BatchRemindResult> {
    if (!dto.contractIds && !dto.signerIds) {
      throw new BadRequestException('必须提供 contractIds 或 signerIds');
    }

    const targetSigners: Signer[] = [];
    const result: BatchRemindResult = {
      success: 0,
      failed: 0,
      details: [],
    };

    if (dto.contractIds && dto.contractIds.length > 0) {
      const contracts = await this.contractRepository.find({
        where: {
          id: In(dto.contractIds),
          tenantId: user.tenantId,
          status: ContractStatus.SIGNING,
        },
        relations: ['signers'],
      });

      for (const contract of contracts) {
        if (!this.checkInitiatorOrAdmin(contract, user)) {
          result.failed++;
          result.details.push({
            id: contract.id,
            name: contract.title,
            status: 'failed',
            reason: '无权限操作该合同',
          });
          continue;
        }

        const pendingSigners = contract.signers.filter(
          (s) =>
            s.status === SignerStatus.PENDING ||
            s.status === SignerStatus.SIGNING,
        );
        targetSigners.push(...pendingSigners);
      }
    }

    if (dto.signerIds && dto.signerIds.length > 0) {
      const signers = await this.signerRepository.find({
        where: { id: In(dto.signerIds) },
        relations: ['contract'],
      });

      for (const signer of signers) {
        if (!signer.contract) {
          result.failed++;
          result.details.push({
            id: signer.id,
            name: signer.name,
            status: 'failed',
            reason: '关联合同不存在',
          });
          continue;
        }

        if (signer.contract.tenantId !== user.tenantId) {
          result.failed++;
          result.details.push({
            id: signer.id,
            name: signer.name,
            status: 'failed',
            reason: '无权限操作该签署人',
          });
          continue;
        }

        if (!this.checkInitiatorOrAdmin(signer.contract, user)) {
          result.failed++;
          result.details.push({
            id: signer.id,
            name: signer.name,
            status: 'failed',
            reason: '无权限操作该合同',
          });
          continue;
        }

        if (
          signer.contract.status !== ContractStatus.SIGNING ||
          (signer.status !== SignerStatus.PENDING &&
            signer.status !== SignerStatus.SIGNING)
        ) {
          result.failed++;
          result.details.push({
            id: signer.id,
            name: signer.name,
            status: 'failed',
            reason: '合同或签署人状态不允许发送提醒',
          });
          continue;
        }

        if (!targetSigners.find((s) => s.id === signer.id)) {
          targetSigners.push(signer);
        }
      }
    }

    for (const signer of targetSigners) {
      try {
        signer.reminderCount = signer.reminderCount + 1;
        signer.lastReminderAt = new Date();
        await this.signerRepository.save(signer);

        const contract = await this.contractRepository.findOne({
          where: { id: signer.contractId, tenantId: user.tenantId },
        });
        if (contract) {
          this.notificationService.sendSignReminder(signer, contract);
        }

        result.success++;
        result.details.push({
          id: signer.id,
          name: signer.name,
          status: 'success',
        });
      } catch (err) {
        this.logger.error(`发送提醒失败 signerId=${signer.id}: ${err.message}`);
        result.failed++;
        result.details.push({
          id: signer.id,
          name: signer.name,
          status: 'failed',
          reason: err.message,
        });
      }
    }

    this.logger.log(
      `批量发送提醒完成: success=${result.success}, failed=${result.failed}, operator=${user.userId}`,
    );

    return result;
  }

  async batchExportCsv(
    dto: BatchExportDto,
    user: CurrentUserPayload,
  ): Promise<BatchExportResult> {
    const queryBuilder = this.contractRepository
      .createQueryBuilder('contract')
      .leftJoinAndSelect('contract.signers', 'signer');

    queryBuilder.where('contract.tenantId = :tenantId', {
      tenantId: user.tenantId,
    });

    if (dto.status) {
      queryBuilder.andWhere('contract.status = :status', { status: dto.status });
    }

    if (dto.initiatorId) {
      queryBuilder.andWhere('contract.initiatorId = :initiatorId', {
        initiatorId: dto.initiatorId,
      });
    }

    if (dto.startDate && dto.endDate) {
      queryBuilder.andWhere(
        'contract.createdAt BETWEEN :startDate AND :endDate',
        {
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
        },
      );
    } else if (dto.startDate) {
      queryBuilder.andWhere('contract.createdAt >= :startDate', {
        startDate: new Date(dto.startDate),
      });
    } else if (dto.endDate) {
      queryBuilder.andWhere('contract.createdAt <= :endDate', {
        endDate: new Date(dto.endDate),
      });
    }

    if (dto.tags && dto.tags.length > 0) {
      queryBuilder.andWhere('contract.tags @> :tags::jsonb', {
        tags: JSON.stringify(dto.tags),
      });
    }

    if (user.role !== UserRole.ADMIN && user.role !== UserRole.VIEWER) {
      queryBuilder.andWhere('contract.initiatorId = :userId', {
        userId: user.userId,
      });
    }

    queryBuilder.orderBy('contract.createdAt', 'DESC');
    const contracts = await queryBuilder.getMany();

    const initiatorIds = [...new Set(contracts.map((c) => c.initiatorId))];
    const users = await this.userRepository.find({
      where: { id: In(initiatorIds) },
    });
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    const headers = [
      '合同编号',
      '标题',
      '状态',
      '发起人',
      '签署模式',
      '签署人数',
      '已签署数',
      '创建时间',
      '截止日期',
      '完成时间',
    ];

    const statusMap: Record<ContractStatus, string> = {
      [ContractStatus.DRAFT]: '草稿',
      [ContractStatus.SIGNING]: '签署中',
      [ContractStatus.COMPLETED]: '已完成',
      [ContractStatus.REJECTED]: '已拒绝',
      [ContractStatus.CANCELLED]: '已撤销',
      [ContractStatus.VOIDED]: '已作废',
      [ContractStatus.EXPIRED]: '已过期',
    };

    const modeMap: Record<SigningMode, string> = {
      [SigningMode.SEQUENTIAL]: '顺序签署',
      [SigningMode.PARALLEL]: '并行签署',
    };

    const formatDate = (date: Date | null | undefined): string => {
      if (!date) return '';
      return new Date(date).toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    };

    const rows = contracts.map((contract) => {
      const signedCount = contract.signers
        ? contract.signers.filter((s) => s.status === SignerStatus.SIGNED).length
        : 0;
      return [
        contract.contractNo,
        `"${contract.title.replace(/"/g, '""')}"`,
        statusMap[contract.status] || contract.status,
        userMap.get(contract.initiatorId) || contract.initiatorId,
        modeMap[contract.signingMode] || contract.signingMode,
        contract.signers ? contract.signers.length : 0,
        signedCount,
        formatDate(contract.createdAt),
        formatDate(contract.signDeadline),
        formatDate(contract.completedAt),
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const filename = `contracts_export_${Date.now()}.csv`;
    const filePath = path.join(this.exportDir, filename);
    fs.writeFileSync(filePath, csvContent, 'utf-8');

    const base64Content = Buffer.from(csvContent, 'utf-8').toString('base64');

    this.logger.log(
      `导出合同CSV完成: count=${contracts.length}, filename=${filename}, operator=${user.userId}`,
    );

    return {
      filename,
      contentType: 'text/csv; charset=utf-8',
      base64Content,
    };
  }

  async batchDownloadContracts(
    dto: BatchDownloadDto,
    user: CurrentUserPayload,
  ): Promise<BatchDownloadResult> {
    if (!dto.archiveIds && !dto.contractIds) {
      throw new BadRequestException('必须提供 archiveIds 或 contractIds');
    }

    const archives: Archive[] = [];

    if (dto.archiveIds && dto.archiveIds.length > 0) {
      const found = await this.archiveRepository.find({
        where: {
          id: In(dto.archiveIds),
          tenantId: user.tenantId,
        },
      });
      archives.push(...found);
    }

    if (dto.contractIds && dto.contractIds.length > 0) {
      const contracts = await this.contractRepository.find({
        where: {
          id: In(dto.contractIds),
          tenantId: user.tenantId,
          status: In([ContractStatus.COMPLETED, ContractStatus.VOIDED]),
        },
      });

      for (const contract of contracts) {
        const existingArchive = archives.find(
          (a) => a.contractId === contract.id,
        );
        if (!existingArchive) {
          const archive = await this.archiveRepository.findOne({
            where: { contractId: contract.id, tenantId: user.tenantId },
          });
          if (archive) {
            archives.push(archive);
          } else {
            const mockArchive = new Archive();
            mockArchive.id = uuidv4();
            mockArchive.contractId = contract.id;
            mockArchive.contractNo = contract.contractNo;
            mockArchive.title = contract.title;
            mockArchive.initiatorId = contract.initiatorId;
            mockArchive.initiatorName = user.email;
            mockArchive.contractStatus = contract.status;
            mockArchive.pdfFileUrl = contract.pdfFileUrl || '';
            mockArchive.signedPdfUrl = contract.signedPdfUrl || '';
            mockArchive.certificateUrl = '';
            mockArchive.digitalFingerprint = contract.digitalFingerprint || '';
            mockArchive.evidenceChain = [];
            mockArchive.completedAt = contract.completedAt;
            mockArchive.archivedAt = new Date();
            mockArchive.retentionDays = 3650;
            mockArchive.expiryDate = new Date();
            mockArchive.isVoided = contract.status === ContractStatus.VOIDED;
            mockArchive.voidReason = contract.voidReason || '';
            mockArchive.tags = [];
            mockArchive.reminderSent = false;
            archives.push(mockArchive);
          }
        }
      }
    }

    const validArchives = archives.filter(
      (a) =>
        a.contractStatus === ContractStatus.COMPLETED ||
        a.contractStatus === ContractStatus.VOIDED,
    );

    if (validArchives.length === 0) {
      throw new BadRequestException('没有可下载的合同（仅支持已完成或已作废状态）');
    }

    for (const archive of validArchives) {
      if (
        user.role !== UserRole.ADMIN &&
        archive.initiatorId !== user.userId
      ) {
        throw new ForbiddenException(`无权限下载合同: ${archive.contractNo}`);
      }
    }

    const timestamp = Date.now();
    const tenantShort = user.tenantId.substring(0, 8);
    const zipFilename = `${tenantShort}_contracts_batch_${timestamp}.zip`;
    const zipFilePath = path.join(this.downloadDir, zipFilename);

    const manifestLines: string[] = [];
    manifestLines.push('批量下载合同清单');
    manifestLines.push(`生成时间: ${new Date().toLocaleString('zh-CN')}`);
    manifestLines.push(`操作人: ${user.email}`);
    manifestLines.push('='.repeat(50));
    manifestLines.push('');

    let fileCount = 0;

    const output = fs.createWriteStream(zipFilePath);
    const archiveZip = archiver('zip', { zlib: { level: 9 } });

    archiveZip.pipe(output);

    for (const item of validArchives) {
      const contractDir = `${item.contractNo}_${item.id.substring(0, 8)}`;
      manifestLines.push(`【${item.contractNo}】${item.title}`);
      manifestLines.push(`  状态: ${item.contractStatus}`);
      manifestLines.push(`  合同ID: ${item.contractId}`);
      manifestLines.push(`  发起人ID: ${item.initiatorId}`);

      if (item.pdfFileUrl) {
        const fileName = `${contractDir}/original_${item.contractNo}.pdf`;
        archiveZip.append(
          `[模拟PDF内容] 原合同: ${item.title}\n合同编号: ${item.contractNo}\n文件路径: ${item.pdfFileUrl}`,
          { name: fileName },
        );
        manifestLines.push(`  - 原PDF: original_${item.contractNo}.pdf`);
        fileCount++;
      }

      if (item.signedPdfUrl) {
        const fileName = `${contractDir}/signed_${item.contractNo}.pdf`;
        archiveZip.append(
          `[模拟PDF内容] 已签署合同: ${item.title}\n合同编号: ${item.contractNo}\n签署完成时间: ${item.completedAt ? new Date(item.completedAt).toLocaleString('zh-CN') : 'N/A'}\n文件路径: ${item.signedPdfUrl}`,
          { name: fileName },
        );
        manifestLines.push(`  - 已签署PDF: signed_${item.contractNo}.pdf`);
        fileCount++;
      }

      if (item.certificateUrl) {
        const fileName = `${contractDir}/certificate_${item.contractNo}.pdf`;
        archiveZip.append(
          `[模拟PDF内容] 签署证书: ${item.title}\n合同编号: ${item.contractNo}\n数字指纹: ${item.digitalFingerprint}\n文件路径: ${item.certificateUrl}`,
          { name: fileName },
        );
        manifestLines.push(`  - 签署证书PDF: certificate_${item.contractNo}.pdf`);
        fileCount++;
      }

      manifestLines.push('');
    }

    manifestLines.push('='.repeat(50));
    manifestLines.push(`总计: ${validArchives.length} 份合同，${fileCount} 个文件`);

    archiveZip.append(manifestLines.join('\n'), {
      name: 'download_manifest.txt',
    });
    fileCount++;

    await new Promise<void>((resolve, reject) => {
      output.on('close', () => resolve());
      archiveZip.on('error', (err) => reject(err));
      archiveZip.finalize();
    });

    this.logger.log(
      `批量下载合同完成: archives=${validArchives.length}, files=${fileCount}, filename=${zipFilename}, operator=${user.userId}`,
    );

    return {
      filename: zipFilename,
      filePath: zipFilePath,
      fileCount,
    };
  }

  getDownloadFilePath(filename: string, tenantId: string): string {
    const safeFilename = path.basename(filename);
    const tenantShort = tenantId.substring(0, 8);

    if (!safeFilename.startsWith(`${tenantShort}_`)) {
      throw new ForbiddenException('无权限下载该文件');
    }

    const filePath = path.join(this.downloadDir, safeFilename);
    if (!fs.existsSync(filePath)) {
      throw new BadRequestException('文件不存在或已过期');
    }
    return filePath;
  }
}
