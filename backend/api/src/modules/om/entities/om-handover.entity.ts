import {
  Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('om_handover')
export class OmHandover {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'project_id', type: 'uuid', nullable: true })
  projectId: string | null;

  @Column({ name: 'scheme_name', type: 'varchar', length: 255 })
  schemeName: string;

  @Column({ name: 'completion_verified', type: 'boolean', default: false })
  completionVerified: boolean;

  @Column({ name: 'commissioning_verified', type: 'boolean', default: false })
  commissioningVerified: boolean;

  @Column({ name: 'as_built_verified', type: 'boolean', default: false })
  asBuiltVerified: boolean;

  @Column({ name: 'gis_mapping_verified', type: 'boolean', default: false })
  gisMappingVerified: boolean;

  @Column({ name: 'asset_register_verified', type: 'boolean', default: false })
  assetRegisterVerified: boolean;

  @Column({ name: 'fhtc_verified', type: 'boolean', default: false })
  fhtcVerified: boolean;

  @Column({ name: 'om_manual_verified', type: 'boolean', default: false })
  omManualVerified: boolean;

  @Column({ name: 'handover_certificate_url', type: 'varchar', length: 500, nullable: true })
  handoverCertificateUrl: string | null;

  @Column({ name: 'om_agency_type', type: 'varchar', length: 50, nullable: true })
  omAgencyType: string | null;

  @Column({ name: 'om_agency_name', type: 'varchar', length: 255, nullable: true })
  omAgencyName: string | null;

  @Column({ name: 'responsibility_matrix', type: 'jsonb', default: {} })
  responsibilityMatrix: Record<string, unknown>;

  @Column({ type: 'varchar', length: 50, default: 'draft' })
  status: string;

  @Column({ name: 'workflow_instance_id', type: 'uuid', nullable: true })
  workflowInstanceId: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
