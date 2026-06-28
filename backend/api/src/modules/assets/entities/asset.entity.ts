import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AssetType } from './asset-type.entity';

@Entity('assets')
export class Asset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'asset_code', length: 100 })
  assetCode: string;

  @Column({ name: 'asset_type_id', type: 'uuid' })
  assetTypeId: string;

  @ManyToOne(() => AssetType)
  @JoinColumn({ name: 'asset_type_id' })
  assetType: AssetType;

  @Column({ name: 'project_id', type: 'uuid', nullable: true })
  projectId: string | null;

  @Column({ name: 'handover_id', type: 'uuid', nullable: true })
  handoverId: string | null;

  @Column({ name: 'om_category', type: 'varchar', length: 80, nullable: true })
  omCategory: string | null;

  @Column({ name: 'om_subcategory', type: 'varchar', length: 80, nullable: true })
  omSubcategory: string | null;

  @Column({ length: 500, nullable: true })
  name: string;

  @Column({ length: 50, default: 'active' })
  status: string;

  @Column({ name: 'health_score', type: 'smallint', default: 100 })
  healthScore: number;

  @Column({ type: 'geometry', spatialFeatureType: 'Geometry', srid: 4326, nullable: true })
  geometry: object;

  @Column({ type: 'jsonb', default: {} })
  attributes: Record<string, unknown>;

  @Column({ name: 'qr_code', type: 'varchar', length: 255, nullable: true })
  qrCode: string | null;

  @Column({ name: 'installation_date', type: 'date', nullable: true })
  installationDate: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  manufacturer: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  capacity: string | null;

  @Column({ name: 'warranty_details', type: 'text', nullable: true })
  warrantyDetails: string | null;

  @Column({ name: 'design_life_years', type: 'smallint', nullable: true })
  designLifeYears: number | null;

  @Column({ name: 'om_agency', type: 'varchar', length: 255, nullable: true })
  omAgency: string | null;

  @Column({ name: 'lifecycle_stage', length: 50, default: 'operational' })
  lifecycleStage: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;
}
