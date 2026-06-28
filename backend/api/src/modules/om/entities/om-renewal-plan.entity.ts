import {
  Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('om_renewal_plans')
export class OmRenewalPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'project_id', type: 'uuid', nullable: true })
  projectId: string | null;

  @Column({ name: 'asset_id', type: 'uuid', nullable: true })
  assetId: string | null;

  @Column({ name: 'lifecycle_category', type: 'varchar', length: 50 })
  lifecycleCategory: string;

  @Column({ name: 'plan_no', type: 'varchar', length: 50 })
  planNo: string;

  @Column({ name: 'plan_type', type: 'varchar', length: 30 })
  planType: string;

  @Column({ name: 'plan_year', type: 'smallint', nullable: true })
  planYear: number | null;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'health_index_at_plan', type: 'smallint', nullable: true })
  healthIndexAtPlan: number | null;

  @Column({ name: 'remaining_useful_life_years', type: 'decimal', precision: 6, scale: 2, nullable: true })
  remainingUsefulLifeYears: number | null;

  @Column({ name: 'estimated_cost', type: 'decimal', precision: 14, scale: 2, nullable: true })
  estimatedCost: number | null;

  @Column({ type: 'varchar', length: 20, default: 'medium' })
  priority: string;

  @Column({ type: 'varchar', length: 30, default: 'draft' })
  status: string;

  @Column({ name: 'target_date', type: 'date', nullable: true })
  targetDate: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
