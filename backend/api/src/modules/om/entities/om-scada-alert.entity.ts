import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('om_scada_alerts')
export class OmScadaAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'project_id', type: 'uuid', nullable: true })
  projectId: string | null;

  @Column({ name: 'asset_id', type: 'uuid', nullable: true })
  assetId: string | null;

  @Column({ name: 'alert_type', type: 'varchar', length: 50 })
  alertType: string;

  @Column({ type: 'varchar', length: 20, default: 'warning' })
  severity: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ name: 'metric_key', type: 'varchar', length: 50, nullable: true })
  metricKey: string | null;

  @Column({ name: 'metric_value', type: 'float', nullable: true })
  metricValue: number | null;

  @Column({ type: 'varchar', length: 30, default: 'open' })
  status: string;

  @Column({ name: 'acknowledged_at', type: 'timestamptz', nullable: true })
  acknowledgedAt: Date | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
