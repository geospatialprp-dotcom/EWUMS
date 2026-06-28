import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('om_meter_readings')
export class OmMeterReading {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'consumer_id', type: 'uuid' })
  consumerId: string;

  @Column({ name: 'reading_date', type: 'date' })
  readingDate: string;

  @Column({ name: 'reading_method', type: 'varchar', length: 30, default: 'manual' })
  readingMethod: string;

  @Column({ name: 'previous_reading', type: 'decimal', precision: 12, scale: 3, nullable: true })
  previousReading: number | null;

  @Column({ name: 'current_reading', type: 'decimal', precision: 12, scale: 3 })
  currentReading: number;

  @Column({ name: 'consumption_kl', type: 'decimal', precision: 12, scale: 3, nullable: true })
  consumptionKl: number | null;

  @Column({ type: 'float', nullable: true })
  latitude: number | null;

  @Column({ type: 'float', nullable: true })
  longitude: number | null;

  @Column({ name: 'meter_condition', type: 'varchar', length: 30, default: 'normal' })
  meterCondition: string;

  @Column({ name: 'photo_url', type: 'text', nullable: true })
  photoUrl: string | null;

  @Column({ name: 'validation_flags', type: 'jsonb', default: {} })
  validationFlags: Record<string, boolean>;

  @Column({ name: 'is_abnormal', type: 'boolean', default: false })
  isAbnormal: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'jsonb', default: {} })
  details: Record<string, unknown>;

  @Column({ name: 'recorded_by', type: 'uuid', nullable: true })
  recordedBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
