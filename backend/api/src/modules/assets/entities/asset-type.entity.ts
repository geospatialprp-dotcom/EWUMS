import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('asset_types')
export class AssetType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId: string;

  @Column({ name: 'industry_module', length: 50, nullable: true })
  industryModule: string;

  @Column({ length: 100 })
  code: string;

  @Column({ length: 255 })
  name: string;

  @Column({ name: 'geometry_type', length: 20, default: 'Point' })
  geometryType: string;

  @Column({ length: 255, nullable: true })
  icon: string;

  @Column({ name: 'default_style', type: 'jsonb', default: {} })
  defaultStyle: Record<string, unknown>;
}
