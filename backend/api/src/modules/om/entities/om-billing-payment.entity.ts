import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('om_billing_payments')
export class OmBillingPayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'consumer_id', type: 'uuid' })
  consumerId: string;

  @Column({ name: 'bill_id', type: 'uuid', nullable: true })
  billId: string | null;

  @Column({ name: 'receipt_no', type: 'varchar', length: 50 })
  receiptNo: string;

  @Column({ name: 'payment_date', type: 'date' })
  paymentDate: string;

  @Column({ name: 'payment_mode', type: 'varchar', length: 30 })
  paymentMode: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ name: 'transaction_ref', type: 'varchar', length: 100, nullable: true })
  transactionRef: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'collected_by', type: 'uuid', nullable: true })
  collectedBy: string | null;

  @Column({ type: 'jsonb', default: {} })
  details: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
