import {
  Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn,
} from 'typeorm';
import { InvoiceLineItem } from './invoice-line-item.entity';

@Entity('contractor_invoices')
export class ContractorInvoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @Column({ name: 'invoice_number', type: 'varchar', length: 50 })
  invoiceNumber: string;

  @Column({ name: 'billing_period_from', type: 'date', nullable: true })
  billingPeriodFrom: string | null;

  @Column({ name: 'billing_period_to', type: 'date', nullable: true })
  billingPeriodTo: string | null;

  @Column({ name: 'scheme_type', type: 'varchar', length: 20, nullable: true })
  schemeType: string | null;

  @Column({ name: 'bill_type', type: 'varchar', length: 20, default: 'ra' })
  billType: string;

  @Column({ type: 'varchar', length: 50, default: 'draft' })
  status: string;

  @Column({ name: 'gross_amount', type: 'decimal', precision: 14, scale: 2, default: 0 })
  grossAmount: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  deductions: number;

  @Column({ name: 'gst_amount', type: 'decimal', precision: 14, scale: 2, default: 0 })
  gstAmount: number;

  @Column({ name: 'previous_amount', type: 'decimal', precision: 14, scale: 2, default: 0 })
  previousAmount: number;

  @Column({ name: 'net_amount', type: 'decimal', precision: 14, scale: 2, default: 0 })
  netAmount: number;

  @Column({ name: 'ra_bill_id', type: 'uuid', nullable: true })
  raBillId: string | null;

  @Column({ name: 'workflow_instance_id', type: 'uuid', nullable: true })
  workflowInstanceId: string | null;

  @Column({ name: 'submitted_by', type: 'uuid', nullable: true })
  submittedBy: string | null;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @Column({ name: 'department_ref', type: 'varchar', length: 100, nullable: true })
  departmentReference: string | null;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  @OneToMany(() => InvoiceLineItem, (item) => item.invoice)
  lineItems: InvoiceLineItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt: Date;
}
