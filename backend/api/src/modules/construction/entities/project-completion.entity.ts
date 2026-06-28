import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('project_completion')
export class ProjectCompletion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @Column({ name: 'mb_completion_pct', type: 'decimal', precision: 5, scale: 2, default: 0 })
  mbCompletionPct: number;

  @Column({ name: 'fhtc_completion_pct', type: 'decimal', precision: 5, scale: 2, default: 0 })
  fhtcCompletionPct: number;

  @Column({ name: 'gis_mapping_pct', type: 'decimal', precision: 5, scale: 2, default: 0 })
  gisMappingPct: number;

  @Column({ name: 'as_built_verified', default: false })
  asBuiltVerified: boolean;

  @Column({ name: 'reservoir_commissioned', default: false })
  reservoirCommissioned: boolean;

  @Column({ name: 'pumping_commissioned', default: false })
  pumpingCommissioned: boolean;

  @Column({ name: 'completion_certificate_url', type: 'text', nullable: true })
  completionCertificateUrl: string | null;

  @Column({ name: 'handover_certificate_url', type: 'text', nullable: true })
  handoverCertificateUrl: string | null;

  @Column({ name: 'final_bill_status', type: 'varchar', length: 50, default: 'pending' })
  finalBillStatus: string;

  @Column({ type: 'varchar', length: 50, default: 'in_progress' })
  status: string;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt: Date;
}
