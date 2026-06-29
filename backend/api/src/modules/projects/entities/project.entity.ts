import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ProjectMilestone } from './project-milestone.entity';

export type OrthomosaicSourceType = 'xyz' | 'file';

export type OrthomosaicConfig = {
  sourceType?: OrthomosaicSourceType;
  tileUrl?: string;
  fileName?: string | null;
  fileUrl?: string | null;
  name?: string | null;
  attribution?: string | null;
  maxZoom?: number | null;
};

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'project_code', length: 100 })
  projectCode: string;

  @Column({ length: 500 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ length: 50, default: 'active' })
  status: string;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: string | null;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: string | null;

  @Column({ type: 'decimal', precision: 14, scale: 2, nullable: true })
  budget: number | null;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  spent: number;

  @Column({ name: 'physical_progress', type: 'decimal', precision: 5, scale: 2, default: 0 })
  physicalProgress: number;

  @Column({ name: 'financial_progress', type: 'decimal', precision: 5, scale: 2, default: 0 })
  financialProgress: number;

  @Column({ name: 'division_id', type: 'uuid', nullable: true })
  divisionId: string | null;

  @Column({ name: 'orthomosaic_config', type: 'jsonb', nullable: true })
  orthomosaicConfig: OrthomosaicConfig | null;

  @OneToMany(() => ProjectMilestone, (m) => m.project)
  milestones: ProjectMilestone[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
