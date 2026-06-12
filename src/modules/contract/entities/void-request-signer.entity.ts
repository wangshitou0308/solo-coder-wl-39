import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { VoidRequestStatus } from '../../../common/enums';
import { VoidRequest } from './void-request.entity';

@Entity('void_request_signers')
export class VoidRequestSigner extends BaseEntity {
  @Column({ name: 'void_request_id' })
  voidRequestId: string;

  @Column({ name: 'signer_id' })
  signerId: string;

  @Column({ name: 'signer_name' })
  signerName: string;

  @Column({
    type: 'enum',
    enum: VoidRequestStatus,
    default: VoidRequestStatus.PENDING,
  })
  status: VoidRequestStatus;

  @Column({ name: 'confirmed_at', nullable: true })
  confirmedAt: string;

  @Column({ type: 'text', nullable: true })
  remark: string;

  @ManyToOne(() => VoidRequest, voidRequest => voidRequest.signers)
  @JoinColumn({ name: 'void_request_id' })
  voidRequest: VoidRequest;
}
