import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { RaBillLine } from './ra-bill-line.entity';

@Entity('ra_bills')
export class RaBill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @Column({ name: 'ra_number', type: 'varchar', length: 50 })
  raNumber: string;

  @Column({ name: 'ra_sequence', type: 'int', default: 1 })
  raSequence: number;

  @Column({ name: 'billing_period_from', type: 'date', nullable: true })
  billingPeriodFrom: string | null;

  @Column({ name: 'billing_period_to', type: 'date', nullable: true })
  billingPeriodTo: string | null;

  @Column({ name: 'scheme_type', type: 'varchar', length: 20, nullable: true })
  schemeType: string | null;

  @Column({ type: 'varchar', length: 50, default: 'draft' })
  status: string;

  @Column({ name: 'gross_amount', type: 'decimal', precision: 14, scale: 2, default: 0 })
  grossAmount: number;

  @Column({ name: 'previous_amount', type: 'decimal', precision: 14, scale: 2, default: 0 })
  previousAmount: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  recoveries: number;

  @Column({ name: 'gst_amount', type: 'decimal', precision: 14, scale: 2, default: 0 })
  gstAmount: number;

  @Column({ name: 'net_payable', type: 'decimal', precision: 14, scale: 2, default: 0 })
  netPayable: number;

  @Column({ name: 'workflow_instance_id', type: 'uuid', nullable: true })
  workflowInstanceId: string | null;

  @Column({ name: 'submitted_by', type: 'uuid', nullable: true })
  submittedBy: string | null;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  @OneToMany(() => RaBillLine, (line) => line.raBill)
  lines: RaBillLine[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt: Date;
}
