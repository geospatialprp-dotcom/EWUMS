import {
  Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('om_contract_kpi_entries')
export class OmContractKpiEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'contract_id', type: 'uuid' })
  contractId: string;

  @Column({ name: 'period_month', type: 'date' })
  periodMonth: string;

  @Column({ name: 'water_supply_hours_per_day', type: 'decimal', precision: 6, scale: 2, nullable: true })
  waterSupplyHoursPerDay: number | null;

  @Column({ name: 'pump_availability_pct', type: 'decimal', precision: 5, scale: 2, nullable: true })
  pumpAvailabilityPct: number | null;

  @Column({ name: 'nrw_pct', type: 'decimal', precision: 5, scale: 2, nullable: true })
  nrwPct: number | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'recorded_by', type: 'uuid', nullable: true })
  recordedBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
