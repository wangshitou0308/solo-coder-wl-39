import { Entity, Column, OneToMany } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/base.entity';
import { VoidRequestStatus } from '../../../common/enums';
import { VoidRequestSigner } from './void-request-signer.entity';

@Entity('void_requests')
export class VoidRequest extends TenantBaseEntity {
  @Column({ name: 'contract_id' })
  contractId: string;

  @Column({ name: 'initiator_id' })
  initiatorId: string;

  @Column()
  reason: string;

  @Column({
    type: 'enum',
    enum: VoidRequestStatus,
    default: VoidRequestStatus.PENDING,
  })
  status: VoidRequestStatus;

  @Column({ name: 'confirmed_at', nullable: true })
  confirmedAt: Date;

  @OneToMany(() => VoidRequestSigner, signer => signer.voidRequest, { cascade: true })
  signers: VoidRequestSigner[];
}
