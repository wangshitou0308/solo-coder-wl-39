import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('tenants')
export class Tenant extends BaseEntity {
  @Column({ unique: true })
  name: string;

  @Column({ unique: true })
  code: string;

  @Column({ nullable: true })
  logo: string;

  @Column({ name: 'default_sign_days', default: 30 })
  defaultSignDays: number;

  @Column({ name: 'callback_url', nullable: true })
  callbackUrl: string;

  @Column({ name: 'archive_retention_days', default: 3650 })
  archiveRetentionDays: number;

  @Column({ default: true })
  active: boolean;
}
