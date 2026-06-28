import {
  Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('om_contracts')
export class OmContract {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'project_id', type: 'uuid', nullable: true })
  projectId: string | null;

  @Column({ name: 'contract_code', type: 'varchar', length: 50 })
  contractCode: string;

  @Column({ name: 'contractor_name', type: 'varchar', length: 255 })
  contractorName: string;

  @Column({ name: 'contractor_contact', type: 'varchar', length: 100, nullable: true })
  contractorContact: string | null;

  @Column({ name: 'contract_type', type: 'varchar', length: 50, default: 'om_operations' })
  contractType: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: string | null;

  @Column({ type: 'varchar', length: 30, default: 'active' })
  status: string;

  @Column({ name: 'sla_targets', type: 'jsonb', default: {} })
  slaTargets: Record<string, number>;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
