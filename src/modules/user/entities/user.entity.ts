import { Entity, Column, Index } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/base.entity';
import { UserRole } from '../../../common/enums';

@Entity('users')
@Index(['tenantId', 'email'], { unique: true })
export class User extends TenantBaseEntity {
  @Column()
  name: string;

  @Column()
  email: string;

  @Column({ name: 'phone', nullable: true })
  phone: string;

  @Column()
  password: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.VIEWER,
  })
  role: UserRole;

  @Column({ name: 'signature_url', nullable: true })
  signatureUrl: string;

  @Column({ default: true })
  active: boolean;
}
