import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Contract } from './contract.entity';

@Entity('contract_timelines')
export class ContractTimeline extends BaseEntity {
  @Column({ name: 'contract_id' })
  contractId: string;

  @Column()
  action: string;

  @Column({ name: 'operator_id', nullable: true })
  operatorId: string;

  @Column({ name: 'operator_name', nullable: true })
  operatorName: string;

  @Column({ type: 'text', nullable: true })
  remark: string;

  @Column({ name: 'ip_address', nullable: true })
  ipAddress: string;

  @Column({ name: 'user_agent', nullable: true })
  userAgent: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @ManyToOne(() => Contract, contract => contract.timelines)
  @JoinColumn({ name: 'contract_id' })
  contract: Contract;
}
