import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { WorkflowInstance } from './workflow-instance.entity';

@Entity('workflow_tasks')
export class WorkflowTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'instance_id', type: 'uuid' })
  instanceId: string;

  @Column({ name: 'step_order', type: 'int' })
  stepOrder: number;

  @Column({ name: 'step_name', length: 255, nullable: true })
  stepName: string;

  @Column({ name: 'assigned_role', length: 100 })
  assignedRole: string;

  @Column({ name: 'assignee_id', type: 'uuid', nullable: true })
  assigneeId: string;

  @Column({ length: 50, default: 'pending' })
  status: string;

  @Column({ type: 'text', nullable: true })
  comments: string;

  @Column({ name: 'acted_by', type: 'uuid', nullable: true })
  actedBy: string;

  @Column({ name: 'acted_at', type: 'timestamptz', nullable: true })
  actedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => WorkflowInstance, (i) => i.tasks)
  @JoinColumn({ name: 'instance_id' })
  instance: WorkflowInstance;
}
