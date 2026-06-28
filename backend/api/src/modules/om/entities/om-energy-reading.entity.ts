import {
  Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('om_energy_readings')
export class OmEnergyReading {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'project_id', type: 'uuid', nullable: true })
  projectId: string | null;

  @Column({ name: 'asset_id', type: 'uuid', nullable: true })
  assetId: string | null;

  @Column({ name: 'reading_code', type: 'varchar', length: 50, nullable: true })
  readingCode: string | null;

  @Column({ name: 'reading_date', type: 'date' })
  readingDate: string;

  @Column({ name: 'pump_running_hours', type: 'decimal', precision: 10, scale: 2, nullable: true })
  pumpRunningHours: number | null;

  @Column({ name: 'energy_kwh', type: 'decimal', precision: 12, scale: 3, nullable: true })
  energyKwh: number | null;

  @Column({ name: 'energy_cost', type: 'decimal', precision: 12, scale: 2, nullable: true })
  energyCost: number | null;

  @Column({ name: 'water_pumped_kl', type: 'decimal', precision: 12, scale: 3, nullable: true })
  waterPumpedKl: number | null;

  @Column({ name: 'power_factor', type: 'decimal', precision: 5, scale: 3, nullable: true })
  powerFactor: number | null;

  @Column({ name: 'pump_efficiency_pct', type: 'decimal', precision: 5, scale: 2, nullable: true })
  pumpEfficiencyPct: number | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
