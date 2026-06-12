import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { SignerStatus, SignMethod } from '../../../common/enums';
import { Contract } from '../../contract/entities/contract.entity';

@Entity('signers')
export class Signer extends BaseEntity {
  @Column({ name: 'contract_id' })
  contractId: string;

  @Column({ name: 'user_id', nullable: true })
  userId: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ name: 'sign_order', default: 0 })
  signOrder: number;

  @Column({
    type: 'enum',
    enum: SignerStatus,
    default: SignerStatus.PENDING,
  })
  status: SignerStatus;

  @Column({
    type: 'enum',
    enum: SignMethod,
    nullable: true,
  })
  signMethod: SignMethod;

  @Column({ name: 'signature_url', nullable: true })
  signatureUrl: string;

  @Column({ name: 'seal_id', nullable: true })
  sealId: string;

  @Column({ name: 'signed_at', nullable: true })
  signedAt: Date;

  @Column({ name: 'reject_reason', nullable: true })
  rejectReason: string;

  @Column({ name: 'ip_address', nullable: true })
  ipAddress: string;

  @Column({ name: 'user_agent', nullable: true })
  userAgent: string;

  @Column({ name: 'digital_fingerprint', nullable: true })
  digitalFingerprint: string;

  @Column({ name: 'sign_token', nullable: true })
  signToken: string;

  @Column({ name: 'reminder_count', default: 0 })
  reminderCount: number;

  @Column({ name: 'last_reminder_at', nullable: true })
  lastReminderAt: Date;

  @ManyToOne(() => Contract, contract => contract.signers)
  @JoinColumn({ name: 'contract_id' })
  contract: Contract;
}
