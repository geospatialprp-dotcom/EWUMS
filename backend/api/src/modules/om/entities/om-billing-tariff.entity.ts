import {
  Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('om_billing_tariffs')
export class OmBillingTariff {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'project_id', type: 'uuid', nullable: true })
  projectId: string | null;

  @Column({ name: 'tariff_code', type: 'varchar', length: 50 })
  tariffCode: string;

  @Column({ name: 'tariff_name', type: 'varchar', length: 255 })
  tariffName: string;

  @Column({ name: 'consumer_category', type: 'varchar', length: 30, nullable: true })
  consumerCategory: string | null;

  @Column({ name: 'billing_cycle', type: 'varchar', length: 20, default: 'monthly' })
  billingCycle: string;

  @Column({ name: 'fixed_charge', type: 'decimal', precision: 10, scale: 2, default: 0 })
  fixedCharge: number;

  @Column({ name: 'service_charge', type: 'decimal', precision: 10, scale: 2, default: 0 })
  serviceCharge: number;

  @Column({ name: 'maintenance_charge', type: 'decimal', precision: 10, scale: 2, default: 0 })
  maintenanceCharge: number;

  @Column({ name: 'meter_rent', type: 'decimal', precision: 10, scale: 2, default: 0 })
  meterRent: number;

  @Column({ name: 'late_penalty_pct', type: 'decimal', precision: 5, scale: 2, default: 2 })
  latePenaltyPct: number;

  @Column({ name: 'reconnection_charge', type: 'decimal', precision: 10, scale: 2, default: 0 })
  reconnectionCharge: number;

  @Column({ name: 'new_connection_charge', type: 'decimal', precision: 10, scale: 2, default: 0 })
  newConnectionCharge: number;

  @Column({ name: 'tax_pct', type: 'decimal', precision: 5, scale: 2, default: 0 })
  taxPct: number;

  @Column({ type: 'jsonb', default: [] })
  slabs: Array<{ fromKl: number; toKl: number | null; ratePerKl: number }>;

  @Column({ name: 'effective_from', type: 'date' })
  effectiveFrom: string;

  @Column({ name: 'effective_to', type: 'date', nullable: true })
  effectiveTo: string | null;

  @Column({ type: 'varchar', length: 30, default: 'active' })
  status: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
