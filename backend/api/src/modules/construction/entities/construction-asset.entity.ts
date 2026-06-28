import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('construction_assets')
export class ConstructionAsset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @Column({ name: 'asset_code', type: 'varchar', length: 50 })
  assetCode: string;

  @Column({ name: 'asset_type', type: 'varchar', length: 50 })
  assetType: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  component: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  chainage: string | null;

  @Column({ name: 'installation_date', type: 'date', nullable: true })
  installationDate: string | null;

  @Column({ name: 'contractor_name', type: 'varchar', length: 255, nullable: true })
  contractorName: string | null;

  @Column({ type: 'varchar', length: 50, default: 'planned' })
  status: string;

  @Column({ name: 'mb_reference', type: 'varchar', length: 50, nullable: true })
  mbReference: string | null;

  @Column({ name: 'photo_url', type: 'text', nullable: true })
  photoUrl: string | null;

  @Column({ type: 'jsonb', default: {} })
  attributes: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt: Date;
}
