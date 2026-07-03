import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('dpr_boq_execution')
export class DprBoqExecution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @Column({ name: 'boq_item_id', type: 'uuid' })
  boqItemId: string;

  @Column({ name: 'work_package_id', type: 'uuid', nullable: true })
  workPackageId: string | null;

  @Column({ name: 'scope_key', type: 'varchar', length: 120 })
  scopeKey: string;

  @Column({ name: 'chainage_from', type: 'varchar', length: 50, nullable: true })
  chainageFrom: string | null;

  @Column({ name: 'chainage_to', type: 'varchar', length: 50, nullable: true })
  chainageTo: string | null;

  @Column({ name: 'measurement_mode', type: 'varchar', length: 20, default: 'discrete_qty' })
  measurementMode: string;

  @Column({ name: 'sanctioned_qty', type: 'decimal', precision: 14, scale: 3, default: 1 })
  sanctionedQty: number;

  @Column({ name: 'cumulative_qty', type: 'decimal', precision: 14, scale: 3, default: 0 })
  cumulativeQty: number;

  @Column({ name: 'cumulative_pct', type: 'decimal', precision: 5, scale: 2, default: 0 })
  cumulativePct: number;

  @Column({ type: 'varchar', length: 20, default: 'in_progress' })
  status: string;

  @Column({ name: 'started_on', type: 'date', nullable: true })
  startedOn: string | null;

  @Column({ name: 'completed_on', type: 'date', nullable: true })
  completedOn: string | null;

  @Column({ name: 'expected_completion_date', type: 'date', nullable: true })
  expectedCompletionDate: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt: Date;
}
