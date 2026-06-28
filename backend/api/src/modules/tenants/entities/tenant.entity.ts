import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 63, unique: true })
  slug: string;

  @Column({ length: 255 })
  name: string;

  @Column({ name: 'industry_pack', length: 50, nullable: true })
  industryPack: string;

  @Column({ length: 20, default: 'enterprise' })
  tier: string;

  @Column({ type: 'jsonb', default: {} })
  settings: Record<string, unknown>;

  @Column({ length: 20, default: 'active' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
