import { Entity, Column } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/base.entity';
import { NotificationChannel, NotificationType } from '../../../common/enums';

@Entity('notifications')
export class Notification extends TenantBaseEntity {
  @Column({
    type: 'enum',
    enum: NotificationType,
  })
  type: NotificationType;

  @Column({
    type: 'enum',
    enum: NotificationChannel,
    default: NotificationChannel.EMAIL,
  })
  channel: NotificationChannel;

  @Column({ name: 'recipient_email', nullable: true })
  recipientEmail: string;

  @Column({ name: 'recipient_phone', nullable: true })
  recipientPhone: string;

  @Column()
  subject: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'contract_id', nullable: true })
  contractId: string;

  @Column({ default: false })
  sent: boolean;

  @Column({ name: 'sent_at', nullable: true })
  sentAt: Date;

  @Column({ type: 'text', nullable: true })
  error: string;
}
