import {
  Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('om_water_quality_tests')
export class OmWaterQualityTest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'project_id', type: 'uuid', nullable: true })
  projectId: string | null;

  @Column({ name: 'asset_id', type: 'uuid', nullable: true })
  assetId: string | null;

  @Column({ name: 'sample_code', type: 'varchar', length: 50, nullable: true })
  sampleCode: string | null;

  @Column({ name: 'sample_point', type: 'varchar', length: 50 })
  samplePoint: string;

  @Column({ name: 'sample_date', type: 'timestamptz' })
  sampleDate: Date;

  @Column({ type: 'jsonb', default: {} })
  parameters: Record<string, unknown>;

  @Column({ name: 'is_compliant', type: 'boolean', nullable: true })
  isCompliant: boolean | null;

  @Column({ name: 'lab_name', type: 'varchar', length: 255, nullable: true })
  labName: string | null;

  @Column({ name: 'result_notes', type: 'text', nullable: true })
  resultNotes: string | null;

  @Column({ type: 'float', nullable: true })
  latitude: number | null;

  @Column({ type: 'float', nullable: true })
  longitude: number | null;

  @Column({ name: 'corrective_action', type: 'text', nullable: true })
  correctiveAction: string | null;

  @Column({ type: 'varchar', length: 50, default: 'sample_collection' })
  status: string;

  @Column({ name: 'non_compliance_details', type: 'jsonb', default: [] })
  nonComplianceDetails: Array<Record<string, unknown>>;

  @Column({ name: 'collected_at', type: 'timestamptz', nullable: true })
  collectedAt: Date | null;

  @Column({ name: 'lab_tested_at', type: 'timestamptz', nullable: true })
  labTestedAt: Date | null;

  @Column({ name: 'result_uploaded_at', type: 'timestamptz', nullable: true })
  resultUploadedAt: Date | null;

  @Column({ name: 'gis_mapped_at', type: 'timestamptz', nullable: true })
  gisMappedAt: Date | null;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt: Date | null;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt: Date | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
