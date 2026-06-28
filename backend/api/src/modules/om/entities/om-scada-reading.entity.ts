import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('om_scada_readings')
export class OmScadaReading {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'project_id', type: 'uuid', nullable: true })
  projectId: string | null;

  @Column({ name: 'asset_id', type: 'uuid', nullable: true })
  assetId: string | null;

  @Column({ name: 'site_category', type: 'varchar', length: 30 })
  siteCategory: string;

  @Column({ name: 'metric_key', type: 'varchar', length: 50 })
  metricKey: string;

  @Column({ name: 'value_numeric', type: 'float', nullable: true })
  valueNumeric: number | null;

  @Column({ name: 'value_text', type: 'varchar', length: 100, nullable: true })
  valueText: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  unit: string | null;

  @Column({ type: 'varchar', length: 30, default: 'scada' })
  source: string;

  @Column({ name: 'recorded_at', type: 'timestamptz' })
  recordedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
