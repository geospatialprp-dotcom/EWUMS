import {
  Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn,
} from 'typeorm';
import { MbEntry } from './mb-entry.entity';

@Entity('measurement_books')
export class MeasurementBook {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @Column({ name: 'dpr_id', type: 'uuid', nullable: true })
  dprId: string | null;

  @Column({ name: 'work_package_id', type: 'uuid', nullable: true })
  workPackageId: string | null;

  @Column({ name: 'mb_number', type: 'varchar', length: 50 })
  mbNumber: string;

  @Column({ name: 'scheme_type', type: 'varchar', length: 20 })
  schemeType: string;

  @Column({ name: 'measurement_date', type: 'date' })
  measurementDate: string;

  @Column({ name: 'site_location', type: 'varchar', length: 500, nullable: true })
  siteAddress: string | null;

  @Column({ type: 'varchar', length: 50, default: 'draft' })
  status: string;

  @Column({ name: 'je_measured_by', type: 'uuid', nullable: true })
  jeMeasuredBy: string | null;

  @Column({ name: 'je_measured_at', type: 'timestamptz', nullable: true })
  jeMeasuredAt: Date | null;

  @Column({ name: 'ae_checked_by', type: 'uuid', nullable: true })
  aeCheckedBy: string | null;

  @Column({ name: 'ae_checked_at', type: 'timestamptz', nullable: true })
  aeCheckedAt: Date | null;

  @Column({ name: 'ee_checked_by', type: 'uuid', nullable: true })
  eeCheckedBy: string | null;

  @Column({ name: 'ee_checked_at', type: 'timestamptz', nullable: true })
  eeCheckedAt: Date | null;

  @Column({ name: 'accounts_finalized_by', type: 'uuid', nullable: true })
  accountsFinalizedBy: string | null;

  @Column({ name: 'accounts_finalized_at', type: 'timestamptz', nullable: true })
  accountsFinalizedAt: Date | null;

  @Column({ name: 'workflow_instance_id', type: 'uuid', nullable: true })
  workflowInstanceId: string | null;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  @OneToMany(() => MbEntry, (e) => e.measurementBook)
  entries: MbEntry[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt: Date;
}
