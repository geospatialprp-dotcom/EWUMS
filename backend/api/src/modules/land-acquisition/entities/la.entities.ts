import {
  Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('la_cases')
export class LaCase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'project_id', type: 'uuid', nullable: true })
  projectId: string | null;

  @Column({ name: 'dpr_proposal_id', type: 'uuid', nullable: true })
  dprProposalId: string | null;

  @Column({ name: 'division_id', type: 'uuid', nullable: true })
  divisionId: string | null;

  @Column({ name: 'case_no', type: 'varchar', length: 50 })
  caseNo: string;

  @Column({ type: 'varchar', length: 500 })
  title: string;

  @Column({ name: 'scheme_type', type: 'varchar', length: 30, default: 'gravity' })
  schemeType: string;

  @Column({ name: 'infrastructure_summary', type: 'jsonb', default: {} })
  infrastructureSummary: Record<string, unknown>;

  @Column({ type: 'varchar', length: 50, default: 'pipeline_designed' })
  status: string;

  @Column({ name: 'total_parcels', type: 'int', default: 0 })
  totalParcels: number;

  @Column({ name: 'total_area_sqm', type: 'decimal', precision: 14, scale: 2, default: 0 })
  totalAreaSqm: number;

  @Column({ name: 'total_compensation_est', type: 'decimal', precision: 14, scale: 2, default: 0 })
  totalCompensationEst: number;

  @Column({ name: 'clearance_status', type: 'varchar', length: 30, default: 'pending' })
  clearanceStatus: string;

  @Column({ name: 'possession_status', type: 'varchar', length: 30, default: 'none' })
  possessionStatus: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('la_alignment_segments')
export class LaAlignmentSegment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'la_case_id', type: 'uuid' })
  laCaseId: string;

  @Column({ name: 'project_id', type: 'uuid', nullable: true })
  projectId: string | null;

  @Column({ name: 'feature_id', type: 'uuid', nullable: true })
  featureId: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  component: string | null;

  @Column({ name: 'asset_type', type: 'varchar', length: 80, nullable: true })
  assetType: string | null;

  @Column({ name: 'chainage_from', type: 'varchar', length: 50, nullable: true })
  chainageFrom: string | null;

  @Column({ name: 'chainage_to', type: 'varchar', length: 50, nullable: true })
  chainageTo: string | null;

  @Column({ name: 'row_width_m', type: 'decimal', precision: 8, scale: 2, default: 6 })
  rowWidthM: number;

  @Column({ name: 'diameter_mm', type: 'int', nullable: true })
  diameterMm: number | null;

  @Column({ type: 'geometry', spatialFeatureType: 'Geometry', srid: 4326, nullable: true })
  geometry: object | null;

  @Column({ name: 'corridor_geometry', type: 'geometry', spatialFeatureType: 'Geometry', srid: 4326, nullable: true })
  corridorGeometry: object | null;

  @Column({ type: 'varchar', length: 30, default: 'traced' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity('la_parcels')
export class LaParcel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'la_case_id', type: 'uuid' })
  laCaseId: string;

  @Column({ name: 'source_feature_id', type: 'uuid', nullable: true })
  sourceFeatureId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  village: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  tehsil: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  district: string | null;

  @Column({ name: 'khasra_no', type: 'varchar', length: 100, nullable: true })
  khasraNo: string | null;

  @Column({ name: 'khata_no', type: 'varchar', length: 100, nullable: true })
  khataNo: string | null;

  @Column({ name: 'land_use', type: 'varchar', length: 80, nullable: true })
  landUse: string | null;

  @Column({ name: 'land_class', type: 'varchar', length: 80, nullable: true })
  landClass: string | null;

  @Column({ name: 'total_area_sqm', type: 'decimal', precision: 14, scale: 2, nullable: true })
  totalAreaSqm: number | null;

  @Column({ name: 'affected_area_sqm', type: 'decimal', precision: 14, scale: 2, nullable: true })
  affectedAreaSqm: number | null;

  @Column({ name: 'affected_length_m', type: 'decimal', precision: 14, scale: 2, nullable: true })
  affectedLengthM: number | null;

  @Column({ name: 'row_width_m', type: 'decimal', precision: 8, scale: 2, nullable: true })
  rowWidthM: number | null;

  @Column({ name: 'temporary_area_sqm', type: 'decimal', precision: 14, scale: 2, nullable: true })
  temporaryAreaSqm: number | null;

  @Column({ name: 'permanent_area_sqm', type: 'decimal', precision: 14, scale: 2, nullable: true })
  permanentAreaSqm: number | null;

  @Column({ name: 'ownership_type', type: 'varchar', length: 80, nullable: true })
  ownershipType: string | null;

  @Column({ name: 'ownership_classification', type: 'varchar', length: 80, nullable: true })
  ownershipClassification: string | null;

  @Column({ name: 'ownership_classification_source', type: 'varchar', length: 30, nullable: true })
  ownershipClassificationSource: string | null;

  @Column({ name: 'ownership_classification_details', type: 'jsonb', default: {} })
  ownershipClassificationDetails: Record<string, unknown>;

  @Column({ type: 'varchar', length: 255, nullable: true })
  department: string | null;

  @Column({ name: 'owner_name', type: 'varchar', length: 255, nullable: true })
  ownerName: string | null;

  @Column({ name: 'land_category', type: 'varchar', length: 80, nullable: true })
  landCategory: string | null;

  @Column({ name: 'current_status', type: 'varchar', length: 80, nullable: true })
  currentStatus: string | null;

  @Column({ name: 'mutation_status', type: 'varchar', length: 80, nullable: true })
  mutationStatus: string | null;

  @Column({ name: 'circle_rate_per_sqm', type: 'decimal', precision: 14, scale: 2, nullable: true })
  circleRatePerSqm: number | null;

  @Column({ name: 'acquisition_mode', type: 'varchar', length: 30, default: 'easement' })
  acquisitionMode: string;

  @Column({ type: 'geometry', spatialFeatureType: 'Geometry', srid: 4326, nullable: true })
  geometry: object | null;

  @Column({ name: 'intersection_geometry', type: 'geometry', spatialFeatureType: 'Geometry', srid: 4326, nullable: true })
  intersectionGeometry: object | null;

  @Column({ type: 'jsonb', default: {} })
  attributes: Record<string, unknown>;

  @Column({ type: 'varchar', length: 30, default: 'identified' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('la_parcel_owners')
export class LaParcelOwner {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'la_parcel_id', type: 'uuid' })
  laParcelId: string;

  @Column({ name: 'owner_name', type: 'varchar', length: 255 })
  ownerName: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  relation: string | null;

  @Column({ name: 'share_pct', type: 'decimal', precision: 5, scale: 2, default: 100 })
  sharePct: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  contact: string | null;

  @Column({ name: 'verification_status', type: 'varchar', length: 30, default: 'pending' })
  verificationStatus: string;

  @Column({ name: 'is_primary', type: 'boolean', default: true })
  isPrimary: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity('la_clearance_items')
export class LaClearanceItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'la_case_id', type: 'uuid' })
  laCaseId: string;

  @Column({ name: 'la_parcel_id', type: 'uuid', nullable: true })
  laParcelId: string | null;

  @Column({ name: 'clearance_type', type: 'varchar', length: 80 })
  clearanceType: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  authority: string | null;

  @Column({ type: 'varchar', length: 30, default: 'required' })
  status: string;

  @Column({ name: 'reference_no', type: 'varchar', length: 100, nullable: true })
  referenceNo: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'overlay_layer_code', type: 'varchar', length: 80, nullable: true })
  overlayLayerCode: string | null;

  @Column({ name: 'source_feature_id', type: 'uuid', nullable: true })
  sourceFeatureId: string | null;

  @Column({ name: 'source_feature_class_code', type: 'varchar', length: 100, nullable: true })
  sourceFeatureClassCode: string | null;

  @Column({ type: 'jsonb', default: {} })
  details: Record<string, unknown>;

  @Column({ name: 'applied_at', type: 'timestamptz', nullable: true })
  appliedAt: Date | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity('la_compensation_schedules')
export class LaCompensationSchedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'la_case_id', type: 'uuid' })
  laCaseId: string;

  @Column({ name: 'la_parcel_id', type: 'uuid' })
  laParcelId: string;

  @Column({ name: 'owner_id', type: 'uuid', nullable: true })
  ownerId: string | null;

  @Column({ name: 'circle_rate_per_sqm', type: 'decimal', precision: 14, scale: 2, nullable: true })
  circleRatePerSqm: number | null;

  @Column({ name: 'market_rate_per_sqm', type: 'decimal', precision: 14, scale: 2, nullable: true })
  marketRatePerSqm: number | null;

  @Column({ name: 'affected_area_sqm', type: 'decimal', precision: 14, scale: 2, nullable: true })
  affectedAreaSqm: number | null;

  @Column({ name: 'land_compensation', type: 'decimal', precision: 14, scale: 2, default: 0 })
  landCompensation: number;

  @Column({ name: 'market_value', type: 'decimal', precision: 14, scale: 2, default: 0 })
  marketValue: number;

  @Column({ name: 'solatium_amount', type: 'decimal', precision: 14, scale: 2, default: 0 })
  solatiumAmount: number;

  @Column({ name: 'additional_compensation', type: 'decimal', precision: 14, scale: 2, default: 0 })
  additionalCompensation: number;

  @Column({ name: 'structure_value', type: 'decimal', precision: 14, scale: 2, default: 0 })
  structureValue: number;

  @Column({ name: 'tree_compensation', type: 'decimal', precision: 14, scale: 2, default: 0 })
  treeCompensation: number;

  @Column({ name: 'crop_compensation', type: 'decimal', precision: 14, scale: 2, default: 0 })
  cropCompensation: number;

  @Column({ name: 'trees_crops_value', type: 'decimal', precision: 14, scale: 2, default: 0 })
  treesCropsValue: number;

  @Column({ name: 'total_compensation', type: 'decimal', precision: 14, scale: 2, default: 0 })
  totalCompensation: number;

  @Column({ name: 'interest_amount', type: 'decimal', precision: 14, scale: 2, default: 0 })
  interestAmount: number;

  @Column({ name: 'rehabilitation_cost', type: 'decimal', precision: 14, scale: 2, default: 0 })
  rehabilitationCost: number;

  @Column({ name: 'total_acquisition_cost', type: 'decimal', precision: 14, scale: 2, default: 0 })
  totalAcquisitionCost: number;

  @Column({ name: 'rr_entitlements', type: 'jsonb', default: {} })
  rrEntitlements: Record<string, unknown>;

  @Column({ name: 'calculation_breakdown', type: 'jsonb', default: {} })
  calculationBreakdown: Record<string, unknown>;

  @Column({ name: 'total_award', type: 'decimal', precision: 14, scale: 2, default: 0 })
  totalAward: number;

  @Column({ name: 'paid_amount', type: 'decimal', precision: 14, scale: 2, default: 0 })
  paidAmount: number;

  @Column({ name: 'payment_status', type: 'varchar', length: 30, default: 'pending' })
  paymentStatus: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity('la_case_documents')
export class LaCaseDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'la_case_id', type: 'uuid' })
  laCaseId: string;

  @Column({ name: 'document_code', type: 'varchar', length: 80 })
  documentCode: string;

  @Column({ type: 'varchar', length: 500 })
  title: string;

  @Column({ type: 'varchar', length: 30, default: 'generated' })
  status: string;

  @Column({ name: 'content_html', type: 'text', default: '' })
  contentHtml: string;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, unknown>;

  @Column({ name: 'generated_at', type: 'timestamptz' })
  generatedAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('la_clearance_proposals')
export class LaClearanceProposal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'la_case_id', type: 'uuid' })
  laCaseId: string;

  @Column({ name: 'proposal_no', type: 'varchar', length: 80 })
  proposalNo: string;

  @Column({ type: 'varchar', length: 500 })
  title: string;

  @Column({ type: 'varchar', length: 30, default: 'draft' })
  status: string;

  @Column({ type: 'jsonb', default: {} })
  package: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('la_workflow_events')
export class LaWorkflowEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'la_case_id', type: 'uuid' })
  laCaseId: string;

  @Column({ type: 'varchar', length: 50 })
  stage: string;

  @Column({ type: 'varchar', length: 80 })
  action: string;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId: string | null;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  @Column({ type: 'jsonb', default: {} })
  payload: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
