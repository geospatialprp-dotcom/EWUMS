import {
  Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('om_consumer_complaints')
export class OmConsumerComplaint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'project_id', type: 'uuid', nullable: true })
  projectId: string | null;

  @Column({ name: 'om_consumer_id', type: 'uuid', nullable: true })
  omConsumerId: string | null;

  @Column({ name: 'complaint_no', type: 'varchar', length: 50 })
  complaintNo: string;

  @Column({ name: 'consumer_id', type: 'varchar', length: 100, nullable: true })
  consumerRef: string | null;

  @Column({ name: 'fhtc_number', type: 'varchar', length: 100, nullable: true })
  fhtcNumber: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  mobile: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  village: string | null;

  @Column({ name: 'complaint_type', type: 'varchar', length: 50 })
  complaintType: string;

  @Column({ type: 'varchar', length: 30, default: 'web_portal' })
  channel: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 50, default: 'ticket_generated' })
  status: string;

  @Column({ type: 'varchar', length: 20, default: 'medium' })
  priority: string;

  @Column({ type: 'float', nullable: true })
  latitude: number | null;

  @Column({ type: 'float', nullable: true })
  longitude: number | null;

  @Column({ name: 'assigned_to', type: 'uuid', nullable: true })
  assignedTo: string | null;

  @Column({ name: 'resolution_notes', type: 'text', nullable: true })
  resolutionNotes: string | null;

  @Column({ name: 'consumer_feedback', type: 'text', nullable: true })
  consumerFeedback: string | null;

  @Column({ name: 'response_time_mins', type: 'int', nullable: true })
  responseTimeMins: number | null;

  @Column({ name: 'reported_by', type: 'uuid', nullable: true })
  reportedBy: string | null;

  @Column({ name: 'assigned_at', type: 'timestamptz', nullable: true })
  assignedAt: Date | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'feedback_at', type: 'timestamptz', nullable: true })
  feedbackAt: Date | null;

  @Column({ name: 'workflow_instance_id', type: 'uuid', nullable: true })
  workflowInstanceId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt: Date | null;
}
