import { Entity, Column, OneToMany, Index } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/base.entity';
import { ContractStatus, SigningMode, ContractTag } from '../../../common/enums';
import { Signer } from '../../signing/entities/signer.entity';
import { ContractTimeline } from './contract-timeline.entity';

@Entity('contracts')
export class Contract extends TenantBaseEntity {
  @Column({ name: 'contract_no', unique: true })
  contractNo: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'template_id', nullable: true })
  templateId: string;

  @Column({ name: 'pdf_file_url', nullable: true })
  pdfFileUrl: string;

  @Column({ name: 'signed_pdf_url', nullable: true })
  signedPdfUrl: string;

  @Column({ type: 'text', nullable: true })
  content: string;

  @Column({ type: 'jsonb', nullable: true })
  variables: Record<string, any>;

  @Column({
    type: 'enum',
    enum: SigningMode,
    default: SigningMode.SEQUENTIAL,
  })
  signingMode: SigningMode;

  @Column({
    type: 'enum',
    enum: ContractStatus,
    default: ContractStatus.DRAFT,
  })
  status: ContractStatus;

  @Column({ name: 'initiator_id' })
  initiatorId: string;

  @Column({ name: 'sign_deadline', nullable: true })
  signDeadline: Date;

  @Column({ type: 'jsonb', nullable: true })
  tags: ContractTag[];

  @Column({ name: 'digital_fingerprint', nullable: true })
  digitalFingerprint: string;

  @Column({ name: 'completed_at', nullable: true })
  completedAt: Date;

  @Column({ name: 'void_reason', nullable: true })
  voidReason: string;

  @Column({ name: 'void_request_id', nullable: true })
  voidRequestId: string;

  @OneToMany(() => Signer, signer => signer.contract, { cascade: true })
  signers: Signer[];

  @OneToMany(() => ContractTimeline, timeline => timeline.contract, { cascade: true })
  timelines: ContractTimeline[];
}
