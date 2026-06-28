import {
  Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('om_consumers')
export class OmConsumer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'project_id', type: 'uuid', nullable: true })
  projectId: string | null;

  @Column({ name: 'consumer_code', type: 'varchar', length: 50 })
  consumerCode: string;

  @Column({ name: 'fhtc_number', type: 'varchar', length: 100 })
  fhtcNumber: string;

  @Column({ name: 'consumer_name', type: 'varchar', length: 255, nullable: true })
  consumerName: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  mobile: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  village: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  ward: string | null;

  @Column({ name: 'consumer_category', type: 'varchar', length: 30, nullable: true })
  consumerCategory: string | null;

  @Column({ name: 'aadhaar_last4', type: 'varchar', length: 4, nullable: true })
  aadhaarLast4: string | null;

  @Column({ name: 'tariff_id', type: 'uuid', nullable: true })
  tariffId: string | null;

  @Column({ type: 'float', nullable: true })
  latitude: number | null;

  @Column({ type: 'float', nullable: true })
  longitude: number | null;

  @Column({ name: 'meter_number', type: 'varchar', length: 100, nullable: true })
  meterNumber: string | null;

  @Column({ name: 'meter_type', type: 'varchar', length: 50, nullable: true })
  meterType: string | null;

  @Column({ name: 'meter_install_date', type: 'date', nullable: true })
  meterInstallDate: string | null;

  @Column({ name: 'connection_status', type: 'varchar', length: 30, default: 'active' })
  connectionStatus: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
