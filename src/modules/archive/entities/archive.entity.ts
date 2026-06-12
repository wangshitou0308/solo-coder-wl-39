import { Entity, Column, Index } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/base.entity';
import { ContractStatus } from '../../../common/enums';

@Entity('archives')
export class Archive extends TenantBaseEntity {
  @Column({ name: 'contract_id', unique: true })
  contractId: string;

  @Column({ name: 'contract_no' })
  contractNo: string;

  @Column()
  title: string;

  @Column({ name: 'initiator_id' })
  initiatorId: string;

  @Column({ name: 'initiator_name' })
  initiatorName: string;

  @Column({ type: 'jsonb' })
  signers: Record<string, any>[];

  @Column({ name: 'contract_status' })
  contractStatus: ContractStatus;

  @Column({ name: 'pdf_file_url', nullable: true })
  pdfFileUrl: string;

  @Column({ name: 'signed_pdf_url', nullable: true })
  signedPdfUrl: string;

  @Column({ name: 'certificate_url', nullable: true })
  certificateUrl: string;

  @Column({ name: 'digital_fingerprint' })
  digitalFingerprint: string;

  @Column({ type: 'jsonb' })
  evidenceChain: Record<string, any>[];

  @Column({ name: 'completed_at', nullable: true })
  completedAt: Date;

  @Column({ name: 'archived_at' })
  archivedAt: Date;

  @Column({ name: 'retention_days', default: 3650 })
  retentionDays: number;

  @Column({ name: 'expiry_date' })
  expiryDate: Date;

  @Column({ name: 'is_voided', default: false })
  isVoided: boolean;

  @Column({ name: 'void_reason', nullable: true })
  voidReason: string;

  @Column({ type: 'jsonb', nullable: true })
  tags: string[];

  @Column({ name: 'reminder_sent', default: false })
  reminderSent: boolean;
}
