import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('om_asset_lifecycle_assessments')
export class OmAssetLifecycleAssessment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'asset_id', type: 'uuid' })
  assetId: string;

  @Column({ name: 'project_id', type: 'uuid', nullable: true })
  projectId: string | null;

  @Column({ name: 'assessment_date', type: 'date' })
  assessmentDate: string;

  @Column({ name: 'condition_grade', type: 'varchar', length: 30 })
  conditionGrade: string;

  @Column({ name: 'health_index', type: 'smallint' })
  healthIndex: number;

  @Column({ name: 'remaining_useful_life_years', type: 'decimal', precision: 6, scale: 2, nullable: true })
  remainingUsefulLifeYears: number | null;

  @Column({ name: 'condition_notes', type: 'text', nullable: true })
  conditionNotes: string | null;

  @Column({ name: 'assessed_by', type: 'uuid', nullable: true })
  assessedBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
