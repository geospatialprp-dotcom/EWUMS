import {
  Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('om_inspections')
export class OmInspection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'project_id', type: 'uuid', nullable: true })
  projectId: string | null;

  @Column({ name: 'asset_id', type: 'uuid', nullable: true })
  assetId: string | null;

  @Column({ name: 'inspection_type', type: 'varchar', length: 20 })
  inspectionType: string;

  @Column({ name: 'performed_by_role', type: 'varchar', length: 50 })
  performedByRole: string;

  @Column({ name: 'performed_by', type: 'uuid', nullable: true })
  performedBy: string | null;

  @Column({ name: 'inspection_date', type: 'timestamptz' })
  inspectionDate: Date;

  @Column({ type: 'varchar', length: 50, default: 'submitted' })
  status: string;

  @Column({ type: 'float', nullable: true })
  latitude: number | null;

  @Column({ type: 'float', nullable: true })
  longitude: number | null;

  @Column({ type: 'jsonb', default: {} })
  checklist: Record<string, unknown>;

  @Column({ type: 'jsonb', default: [] })
  photos: Array<Record<string, unknown>>;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
