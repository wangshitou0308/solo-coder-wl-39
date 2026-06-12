import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as dayjs from 'dayjs';
import { Notification } from './entities/notification.entity';
import {
  NotificationChannel,
  NotificationType,
} from '../../common/enums';
import { Signer } from '../signing/entities/signer.entity';
import { Contract } from '../contract/entities/contract.entity';
import { Archive } from '../archive/entities/archive.entity';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  private async createAndSendNotification(
    tenantId: string,
    type: NotificationType,
    channel: NotificationChannel,
    recipientEmail: string,
    recipientPhone: string,
    subject: string,
    content: string,
    contractId?: string,
  ): Promise<Notification> {
    const notification = this.notificationRepository.create({
      tenantId,
      type,
      channel,
      recipientEmail,
      recipientPhone,
      subject,
      content,
      contractId,
      sent: true,
      sentAt: new Date(),
    });

    this.logNotification(notification);

    return this.notificationRepository.save(notification);
  }

  private logNotification(notification: Notification): void {
    const logInfo = {
      type: notification.type,
      channel: notification.channel,
      recipientEmail: notification.recipientEmail,
      recipientPhone: notification.recipientPhone,
      subject: notification.subject,
      sentAt: notification.sentAt,
    };

    if (
      notification.channel === NotificationChannel.EMAIL ||
      notification.channel === NotificationChannel.BOTH
    ) {
      this.logger.log(
        `[模拟发送邮件] To: ${notification.recipientEmail}, Subject: ${notification.subject}`,
      );
    }

    if (
      notification.channel === NotificationChannel.SMS ||
      notification.channel === NotificationChannel.BOTH
    ) {
      this.logger.log(
        `[模拟发送短信] To: ${notification.recipientPhone}, Content: ${notification.content.substring(0, 50)}...`,
      );
    }

    this.logger.debug(`通知记录已保存: ${JSON.stringify(logInfo)}`);
  }

  private determineChannel(signer: Signer): NotificationChannel {
    if (signer.email && signer.phone) {
      return NotificationChannel.BOTH;
    }
    if (signer.email) {
      return NotificationChannel.EMAIL;
    }
    return NotificationChannel.SMS;
  }

  private buildSignUrl(signer: Signer): string {
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    return `${baseUrl}/sign/${signer.contractId}?token=${signer.signToken}`;
  }

  async sendSignRequest(signer: Signer, contract: Contract): Promise<Notification> {
    const subject = `请签署合同: ${contract.title}`;
    const signUrl = this.buildSignUrl(signer);
    const deadline = contract.signDeadline
      ? dayjs(contract.signDeadline).format('YYYY-MM-DD HH:mm')
      : '尽快';
    const content = `尊敬的 ${signer.name}，\n\n您有一份合同需要签署：\n合同名称: ${contract.title}\n合同编号: ${contract.contractNo}\n签署截止时间: ${deadline}\n\n请点击以下链接完成签署:\n${signUrl}\n\n如有疑问，请联系合同发起人。`;

    this.logger.log(`发送签署请求通知: signer=${signer.name}, contract=${contract.title}`);

    return this.createAndSendNotification(
      contract.tenantId,
      NotificationType.SIGN_REQUEST,
      this.determineChannel(signer),
      signer.email,
      signer.phone,
      subject,
      content,
      contract.id,
    );
  }

  async sendSignReminder(signer: Signer, contract: Contract): Promise<Notification> {
    const subject = `签署提醒: ${contract.title}`;
    const signUrl = this.buildSignUrl(signer);
    const content = `尊敬的 ${signer.name}，\n\n提醒您，以下合同等待您签署：\n合同名称: ${contract.title}\n合同编号: ${contract.contractNo}\n\n请点击以下链接完成签署:\n${signUrl}\n\n请尽快完成签署，谢谢配合！`;

    this.logger.log(`发送签署提醒: signer=${signer.name}, contract=${contract.title}, 提醒次数=${signer.reminderCount + 1}`);

    return this.createAndSendNotification(
      contract.tenantId,
      NotificationType.SIGN_REMINDER,
      this.determineChannel(signer),
      signer.email,
      signer.phone,
      subject,
      content,
      contract.id,
    );
  }

  async sendContractCompleted(
    contract: Contract,
    signers: Signer[],
  ): Promise<Notification[]> {
    const subject = `合同签署完成: ${contract.title}`;
    const notifications: Notification[] = [];
    const completedAt = dayjs(contract.completedAt).format('YYYY-MM-DD HH:mm:ss');
    const signerNames = signers.map((s) => s.name).join('、');

    this.logger.log(`发送合同完成通知: contract=${contract.title}, 参与方数量=${signers.length}`);

    for (const signer of signers) {
      const content = `尊敬的 ${signer.name}，\n\n以下合同已完成所有签署：\n合同名称: ${contract.title}\n合同编号: ${contract.contractNo}\n完成时间: ${completedAt}\n签署方: ${signerNames}\n\n合同数字指纹: ${contract.digitalFingerprint || '暂无'}\n\n您可以在系统中查看已签署的合同文件。`;

      const notification = await this.createAndSendNotification(
        contract.tenantId,
        NotificationType.SIGN_COMPLETED,
        this.determineChannel(signer),
        signer.email,
        signer.phone,
        subject,
        content,
        contract.id,
      );
      notifications.push(notification);
    }

    return notifications;
  }

  async sendContractRejected(
    contract: Contract,
    rejectSigner: Signer,
    reason: string,
  ): Promise<Notification> {
    const subject = `合同被拒绝: ${contract.title}`;
    const content = `您好，\n\n很遗憾地通知您，以下合同被拒绝签署：\n合同名称: ${contract.title}\n合同编号: ${contract.contractNo}\n拒绝签署人: ${rejectSigner.name}\n拒绝原因: ${reason}\n拒绝时间: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}\n\n请登录系统查看详情并处理。`;

    this.logger.log(
      `发送合同被拒通知: contract=${contract.title}, rejectSigner=${rejectSigner.name}`,
    );

    return this.createAndSendNotification(
      contract.tenantId,
      NotificationType.CONTRACT_REJECTED,
      NotificationChannel.EMAIL,
      '',
      '',
      subject,
      content,
      contract.id,
    );
  }

  async sendContractCancelled(
    contract: Contract,
    signers: Signer[],
  ): Promise<Notification[]> {
    const subject = `合同已撤销: ${contract.title}`;
    const notifications: Notification[] = [];

    this.logger.log(`发送合同撤销通知: contract=${contract.title}`);

    for (const signer of signers) {
      const content = `尊敬的 ${signer.name}，\n\n以下合同已被撤销：\n合同名称: ${contract.title}\n合同编号: ${contract.contractNo}\n撤销时间: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}\n\n该合同不再具有法律效力，如有疑问请联系合同发起人。`;

      const notification = await this.createAndSendNotification(
        contract.tenantId,
        NotificationType.CONTRACT_CANCELLED,
        this.determineChannel(signer),
        signer.email,
        signer.phone,
        subject,
        content,
        contract.id,
      );
      notifications.push(notification);
    }

    return notifications;
  }

  async sendContractVoided(
    contract: Contract,
    signers: Signer[],
  ): Promise<Notification[]> {
    const subject = `合同已作废: ${contract.title}`;
    const notifications: Notification[] = [];

    this.logger.log(`发送合同作废通知: contract=${contract.title}, reason=${contract.voidReason}`);

    for (const signer of signers) {
      const content = `尊敬的 ${signer.name}，\n\n以下合同已被作废：\n合同名称: ${contract.title}\n合同编号: ${contract.contractNo}\n作废原因: ${contract.voidReason || '未说明'}\n作废时间: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}\n\n该合同不再具有法律效力。`;

      const notification = await this.createAndSendNotification(
        contract.tenantId,
        NotificationType.CONTRACT_VOIDED,
        this.determineChannel(signer),
        signer.email,
        signer.phone,
        subject,
        content,
        contract.id,
      );
      notifications.push(notification);
    }

    return notifications;
  }

  async sendContractExpired(
    contract: Contract,
    signers: Signer[],
  ): Promise<Notification[]> {
    const subject = `合同已过期: ${contract.title}`;
    const notifications: Notification[] = [];

    this.logger.log(`发送合同过期通知: contract=${contract.title}`);

    for (const signer of signers) {
      const content = `尊敬的 ${signer.name}，\n\n以下合同已超过签署期限：\n合同名称: ${contract.title}\n合同编号: ${contract.contractNo}\n签署截止时间: ${dayjs(contract.signDeadline).format('YYYY-MM-DD HH:mm')}\n\n该合同已标记为过期，如需继续签署请联系合同发起人重新发起。`;

      const notification = await this.createAndSendNotification(
        contract.tenantId,
        NotificationType.CONTRACT_EXPIRED,
        this.determineChannel(signer),
        signer.email,
        signer.phone,
        subject,
        content,
        contract.id,
      );
      notifications.push(notification);
    }

    return notifications;
  }

  async sendArchiveReminder(archive: Archive): Promise<Notification> {
    const subject = `归档即将到期提醒: ${archive.title}`;
    const daysRemaining = dayjs(archive.expiryDate).diff(dayjs(), 'day');
    const content = `您好，\n\n以下归档合同即将到期：\n合同名称: ${archive.title}\n合同编号: ${archive.contractNo}\n归档到期日: ${dayjs(archive.expiryDate).format('YYYY-MM-DD')}\n剩余天数: ${daysRemaining} 天\n\n请及时处理，如需延长归档期限请在系统中操作。`;

    this.logger.log(
      `发送归档到期提醒: archive=${archive.title}, daysRemaining=${daysRemaining}`,
    );

    return this.createAndSendNotification(
      archive.tenantId,
      NotificationType.ARCHIVE_REMINDER,
      NotificationChannel.EMAIL,
      '',
      '',
      subject,
      content,
      archive.contractId,
    );
  }

  async findByContractId(contractId: string): Promise<Notification[]> {
    return this.notificationRepository.find({
      where: { contractId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByTenantId(
    tenantId: string,
    page = 1,
    pageSize = 20,
  ): Promise<{ list: Notification[]; total: number }> {
    const [list, total] = await this.notificationRepository.findAndCount({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { list, total };
  }
}
