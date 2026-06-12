import { Entity, Column } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/base.entity';
import { TemplateCategory } from '../../../common/enums';

@Entity('templates')
export class Template extends TenantBaseEntity {
  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: TemplateCategory,
    default: TemplateCategory.CUSTOM,
  })
  category: TemplateCategory;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'jsonb', nullable: true })
  variables: Record<string, any>;

  @Column({ nullable: true })
  description: string;

  @Column({ default: true })
  active: boolean;
}
