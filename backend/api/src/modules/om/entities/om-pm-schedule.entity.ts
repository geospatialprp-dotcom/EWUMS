import {
  Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('om_pm_schedules')
export class OmPmSchedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @Column({ name: 'asset_id', type: 'uuid', nullable: true })
  assetId: string | null;

  @Column({ type: 'varchar', length: 30 })
  category: string;

  @Column({ name: 'task_code', type: 'varchar', length: 80 })
  taskCode: string;

  @Column({ name: 'task_name', type: 'varchar', length: 200 })
  taskName: string;

  @Column({ type: 'varchar', length: 20 })
  frequency: string;

  @Column({ name: 'period_key', type: 'varchar', length: 20 })
  periodKey: string;

  @Column({ name: 'scheduled_for', type: 'date' })
  scheduledFor: string;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: string;

  @Column({ type: 'varchar', length: 30, default: 'scheduled' })
  status: string;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'completed_by', type: 'uuid', nullable: true })
  completedBy: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
