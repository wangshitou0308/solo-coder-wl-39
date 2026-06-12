import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as dayjs from 'dayjs';
import { Contract } from '../contract/entities/contract.entity';
import { Signer } from '../signing/entities/signer.entity';
import { Archive } from '../archive/entities/archive.entity';
import { Notification } from '../notification/entities/notification.entity';
import { ContractTimeline } from '../contract/entities/contract-timeline.entity';
import { User } from '../user/entities/user.entity';
import {
  ContractStatus,
  SignerStatus,
  UserRole,
} from '../../common/enums';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
    @InjectRepository(Signer)
    private readonly signerRepository: Repository<Signer>,
    @InjectRepository(Archive)
    private readonly archiveRepository: Repository<Archive>,
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(ContractTimeline)
    private readonly timelineRepository: Repository<ContractTimeline>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly notificationService: NotificationService,
  ) {}

  @Cron('0 * * * *')
  async handleExpiringContracts(): Promise<void> {
    try {
      this.logger.log('开始执行：即将到期合同签署提醒任务');

      const now = dayjs();
      const deadlineWithin24Hours = now.add(24, 'hour').toDate();

      const contracts = await this.contractRepository.find({
        where: {
          status: ContractStatus.SIGNING,
        },
        relations: ['signers'],
      });

      const expiringContracts = contracts.filter((contract) => {
        if (!contract.signDeadline) return false;
        const deadline = dayjs(contract.signDeadline);
        return deadline.isAfter(now) && deadline.isBefore(deadlineWithin24Hours);
      });

      this.logger.log(`找到 ${expiringContracts.length} 份即将到期的合同`);

      for (const contract of expiringContracts) {
        const unsignedSigners = contract.signers.filter(
          (signer) =>
            signer.status !== SignerStatus.SIGNED &&
            signer.status !== SignerStatus.REJECTED &&
            signer.status !== SignerStatus.SKIPPED,
        );

        for (const signer of unsignedSigners) {
          try {
            signer.reminderCount = (signer.reminderCount || 0) + 1;
            signer.lastReminderAt = new Date();
            await this.signerRepository.save(signer);

            await this.notificationService.sendSignReminder(signer, contract);

            this.logger.log(
              `发送签署提醒: contractId=${contract.id}, signerId=${signer.id}, signerName=${signer.name}`,
            );
          } catch (err) {
            this.logger.error(
              `发送签署提醒失败: contractId=${contract.id}, signerId=${signer.id}, error=${err.message}`,
            );
          }
        }
      }

      this.logger.log('即将到期合同签署提醒任务执行完成');
    } catch (err) {
      this.logger.error(`即将到期合同签署提醒任务执行失败: ${err.message}`, err.stack);
    }
  }

  @Cron('30 * * * *')
  async handleExpiredContracts(): Promise<void> {
    try {
      this.logger.log('开始执行：合同过期处理任务');

      const now = dayjs().toDate();

      const contracts = await this.contractRepository.find({
        where: {
          status: ContractStatus.SIGNING,
        },
        relations: ['signers'],
      });

      const expiredContracts = contracts.filter((contract) => {
        if (!contract.signDeadline) return false;
        return dayjs(contract.signDeadline).isBefore(now);
      });

      this.logger.log(`找到 ${expiredContracts.length} 份已过期的合同`);

      for (const contract of expiredContracts) {
        try {
          contract.status = ContractStatus.EXPIRED;
          await this.contractRepository.save(contract);

          const timeline = this.timelineRepository.create({
            contractId: contract.id,
            action: '合同已过期',
            operatorName: '系统',
            remark: `合同签署期限已过（${dayjs(contract.signDeadline).format('YYYY-MM-DD HH:mm')}），合同已自动标记为过期`,
          });
          await this.timelineRepository.save(timeline);

          await this.notificationService.sendContractExpired(
            contract,
            contract.signers,
          );

          this.logger.log(
            `处理过期合同: contractId=${contract.id}, contractNo=${contract.contractNo}`,
          );
        } catch (err) {
          this.logger.error(
            `处理过期合同失败: contractId=${contract.id}, error=${err.message}`,
          );
        }
      }

      this.logger.log('合同过期处理任务执行完成');
    } catch (err) {
      this.logger.error(`合同过期处理任务执行失败: ${err.message}`, err.stack);
    }
  }

  @Cron('0 2 * * *')
  async handleArchiveExpiryReminder(): Promise<void> {
    try {
      this.logger.log('开始执行：归档到期提醒任务');

      const now = dayjs();
      const expiryWithin30Days = now.add(30, 'day').toDate();

      const archives = await this.archiveRepository.find({
        where: {
          reminderSent: false,
        },
      });

      const expiringArchives = archives.filter((archive) => {
        const expiryDate = dayjs(archive.expiryDate);
        return expiryDate.isAfter(now) && expiryDate.isBefore(expiryWithin30Days);
      });

      this.logger.log(`找到 ${expiringArchives.length} 份即将到期的归档`);

      for (const archive of expiringArchives) {
        try {
          const tenantAdmins = await this.userRepository.find({
            where: {
              tenantId: archive.tenantId,
              role: UserRole.ADMIN,
              active: true,
            },
          });

          for (const admin of tenantAdmins) {
            try {
              await this.notificationService.sendArchiveReminder({
                ...archive,
                tenantId: archive.tenantId,
              } as Archive);

              this.logger.log(
                `发送归档到期提醒: archiveId=${archive.id}, tenantId=${archive.tenantId}, adminEmail=${admin.email}`,
              );
            } catch (err) {
              this.logger.error(
                `发送归档到期提醒失败: archiveId=${archive.id}, adminEmail=${admin.email}, error=${err.message}`,
              );
            }
          }

          archive.reminderSent = true;
          await this.archiveRepository.save(archive);
        } catch (err) {
          this.logger.error(
            `处理归档到期提醒失败: archiveId=${archive.id}, error=${err.message}`,
          );
        }
      }

      this.logger.log('归档到期提醒任务执行完成');
    } catch (err) {
      this.logger.error(`归档到期提醒任务执行失败: ${err.message}`, err.stack);
    }
  }

  @Cron('*/30 * * * *')
  async handleAutoArchiveCompletedContracts(): Promise<void> {
    try {
      this.logger.log('开始执行：已完成合同自动归档任务');

      const oneHourAgo = dayjs().subtract(1, 'hour').toDate();

      const contracts = await this.contractRepository.find({
        where: {
          status: In([ContractStatus.COMPLETED, ContractStatus.VOIDED]),
        },
        relations: ['signers'],
      });

      const contractIds = contracts.map((c) => c.id);

      const existingArchives = await this.archiveRepository.find({
        where: {
          contractId: In(contractIds),
        },
        select: ['contractId'],
      });

      const archivedContractIds = new Set(existingArchives.map((a) => a.contractId));

      const contractsToArchive = contracts.filter(
        (contract) =>
          !archivedContractIds.has(contract.id) &&
          dayjs(contract.createdAt).isBefore(oneHourAgo),
      );

      this.logger.log(`找到 ${contractsToArchive.length} 份需要自动归档的合同`);

      for (const contract of contractsToArchive) {
        try {
          await this.archiveContract(contract);

          this.logger.log(
            `自动归档合同: contractId=${contract.id}, contractNo=${contract.contractNo}, status=${contract.status}`,
          );
        } catch (err) {
          this.logger.error(
            `自动归档合同失败: contractId=${contract.id}, error=${err.message}`,
          );
        }
      }

      this.logger.log('已完成合同自动归档任务执行完成');
    } catch (err) {
      this.logger.error(`已完成合同自动归档任务执行失败: ${err.message}`, err.stack);
    }
  }

  private async archiveContract(contract: Contract): Promise<Archive> {
    const archivedAt = new Date();
    const retentionDays = 3650;
    const expiryDate = dayjs(archivedAt).add(retentionDays, 'day').toDate();

    const archive = this.archiveRepository.create({
      tenantId: contract.tenantId,
      contractId: contract.id,
      contractNo: contract.contractNo,
      title: contract.title,
      initiatorId: contract.initiatorId,
      initiatorName: contract.initiatorId,
      signers: contract.signers.map((s) => ({
        id: s.id,
        name: s.name,
        email: s.email,
        phone: s.phone,
        status: s.status,
        signOrder: s.signOrder,
        signedAt: s.signedAt,
      })),
      contractStatus: contract.status,
      pdfFileUrl: contract.pdfFileUrl,
      signedPdfUrl: contract.signedPdfUrl,
      certificateUrl: null,
      digitalFingerprint: contract.digitalFingerprint || '',
      evidenceChain: [],
      completedAt: contract.completedAt,
      archivedAt,
      retentionDays,
      expiryDate,
      isVoided: contract.status === ContractStatus.VOIDED,
      voidReason: contract.voidReason,
      tags: contract.tags as unknown as string[],
      reminderSent: false,
    });

    return this.archiveRepository.save(archive);
  }
}
