import {
  Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('om_breakdown_tickets')
export class OmBreakdownTicket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'project_id', type: 'uuid', nullable: true })
  projectId: string | null;

  @Column({ name: 'asset_id', type: 'uuid', nullable: true })
  assetId: string | null;

  @Column({ name: 'ticket_no', type: 'varchar', length: 50 })
  ticketNo: string;

  @Column({ type: 'varchar', length: 50 })
  category: string;

  @Column({ name: 'category_group', type: 'varchar', length: 50, nullable: true })
  categoryGroup: string | null;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 50, default: 'open' })
  status: string;

  @Column({ type: 'varchar', length: 20, default: 'medium' })
  priority: string;

  @Column({ type: 'float', nullable: true })
  latitude: number | null;

  @Column({ type: 'float', nullable: true })
  longitude: number | null;

  @Column({ name: 'assigned_to', type: 'uuid', nullable: true })
  assignedTo: string | null;

  @Column({ name: 'response_time_mins', type: 'int', nullable: true })
  responseTimeMins: number | null;

  @Column({ name: 'repair_details', type: 'text', nullable: true })
  repairDetails: string | null;

  @Column({ name: 'materials_used', type: 'jsonb', default: [] })
  materialsUsed: unknown[];

  @Column({ name: 'labour_used', type: 'jsonb', default: [] })
  labourUsed: unknown[];

  @Column({ name: 'before_photo_url', type: 'varchar', length: 500, nullable: true })
  beforePhotoUrl: string | null;

  @Column({ name: 'after_photo_url', type: 'varchar', length: 500, nullable: true })
  afterPhotoUrl: string | null;

  @Column({ name: 'before_photos', type: 'jsonb', default: [] })
  beforePhotos: Array<Record<string, unknown>>;

  @Column({ name: 'after_photos', type: 'jsonb', default: [] })
  afterPhotos: Array<Record<string, unknown>>;

  @Column({ name: 'assigned_at', type: 'timestamptz', nullable: true })
  assignedAt: Date | null;

  @Column({ name: 'inspected_at', type: 'timestamptz', nullable: true })
  inspectedAt: Date | null;

  @Column({ name: 'repaired_at', type: 'timestamptz', nullable: true })
  repairedAt: Date | null;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt: Date | null;

  @Column({ name: 'workflow_instance_id', type: 'uuid', nullable: true })
  workflowInstanceId: string | null;

  @Column({ name: 'reported_by', type: 'uuid', nullable: true })
  reportedBy: string | null;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
