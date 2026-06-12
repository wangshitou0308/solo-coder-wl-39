import { Entity, Column } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/base.entity';

@Entity('seals')
export class Seal extends TenantBaseEntity {
  @Column()
  name: string;

  @Column({ name: 'image_url' })
  imageUrl: string;

  @Column({ name: 'seal_type', default: 'company' })
  sealType: string;

  @Column({ nullable: true })
  description: string;

  @Column({ default: true })
  active: boolean;
}
