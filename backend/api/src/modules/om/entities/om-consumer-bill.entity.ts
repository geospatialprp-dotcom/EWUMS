import {
  Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('om_consumer_bills')
export class OmConsumerBill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'project_id', type: 'uuid', nullable: true })
  projectId: string | null;

  @Column({ name: 'consumer_id', type: 'uuid' })
  consumerId: string;

  @Column({ name: 'tariff_id', type: 'uuid', nullable: true })
  tariffId: string | null;

  @Column({ name: 'meter_reading_id', type: 'uuid', nullable: true })
  meterReadingId: string | null;

  @Column({ name: 'bill_no', type: 'varchar', length: 50 })
  billNo: string;

  @Column({ name: 'billing_period_from', type: 'date' })
  billingPeriodFrom: string;

  @Column({ name: 'billing_period_to', type: 'date' })
  billingPeriodTo: string;

  @Column({ name: 'previous_reading', type: 'decimal', precision: 12, scale: 3, nullable: true })
  previousReading: number | null;

  @Column({ name: 'current_reading', type: 'decimal', precision: 12, scale: 3, nullable: true })
  currentReading: number | null;

  @Column({ name: 'consumption_kl', type: 'decimal', precision: 12, scale: 3, default: 0 })
  consumptionKl: number;

  @Column({ name: 'water_charge', type: 'decimal', precision: 12, scale: 2, default: 0 })
  waterCharge: number;

  @Column({ name: 'fixed_charge', type: 'decimal', precision: 10, scale: 2, default: 0 })
  fixedCharge: number;

  @Column({ name: 'service_charge', type: 'decimal', precision: 10, scale: 2, default: 0 })
  serviceCharge: number;

  @Column({ name: 'maintenance_charge', type: 'decimal', precision: 10, scale: 2, default: 0 })
  maintenanceCharge: number;

  @Column({ name: 'meter_rent', type: 'decimal', precision: 10, scale: 2, default: 0 })
  meterRent: number;

  @Column({ name: 'tax_amount', type: 'decimal', precision: 10, scale: 2, default: 0 })
  taxAmount: number;

  @Column({ name: 'penalty_amount', type: 'decimal', precision: 10, scale: 2, default: 0 })
  penaltyAmount: number;

  @Column({ name: 'arrears_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  arrearsAmount: number;

  @Column({ name: 'total_amount', type: 'decimal', precision: 12, scale: 2 })
  totalAmount: number;

  @Column({ name: 'amount_paid', type: 'decimal', precision: 12, scale: 2, default: 0 })
  amountPaid: number;

  @Column({ name: 'balance_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  balanceAmount: number;

  @Column({ type: 'varchar', length: 30, default: 'generated' })
  status: string;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: string | null;

  @Column({ name: 'issued_at', type: 'timestamptz', nullable: true })
  issuedAt: Date | null;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @Column({ type: 'jsonb', default: {} })
  details: Record<string, unknown>;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
