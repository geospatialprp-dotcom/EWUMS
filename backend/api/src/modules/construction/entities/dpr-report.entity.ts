import {
  Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn,
} from 'typeorm';
import { DprActivity } from './dpr-activity.entity';

@Entity('dpr_reports')
export class DprReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @Column({ name: 'dpr_number', type: 'varchar', length: 50 })
  dprNumber: string;

  @Column({ name: 'report_date', type: 'date' })
  reportDate: string;

  @Column({ name: 'scheme_type', type: 'varchar', length: 20 })
  schemeType: string;

  @Column({ name: 'work_location', type: 'varchar', length: 500, nullable: true })
  workSite: string | null;

  @Column({ name: 'work_package_id', type: 'uuid', nullable: true })
  workPackageId: string | null;

  @Column({ name: 'contractor_name', type: 'varchar', length: 255, nullable: true })
  contractorName: string | null;

  @Column({ name: 'supervisor_name', type: 'varchar', length: 255, nullable: true })
  supervisorName: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  weather: string | null;

  @Column({ name: 'manpower_count', type: 'int', default: 0 })
  manpowerCount: number;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  @Column({ type: 'varchar', length: 50, default: 'draft' })
  status: string;

  @Column({ name: 'workflow_instance_id', type: 'uuid', nullable: true })
  workflowInstanceId: string | null;

  @Column({ name: 'submitted_by', type: 'uuid', nullable: true })
  submittedBy: string | null;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @OneToMany(() => DprActivity, (a) => a.dpr)
  activities: DprActivity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt: Date;
}
