import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('dpr_proposal_documents')
export class DprProposalDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'proposal_id', type: 'uuid' })
  proposalId: string;

  @Column({ name: 'document_type', type: 'varchar', length: 80 })
  documentType: string;

  @Column({ name: 'file_name', type: 'varchar', length: 500, nullable: true })
  fileName: string | null;

  @Column({ name: 'file_url', type: 'text', nullable: true })
  fileUrl: string | null;

  @Column({ name: 'version_no', type: 'int', default: 1 })
  versionNo: number;

  @Column({ name: 'uploaded_by', type: 'uuid', nullable: true })
  uploadedBy: string | null;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity('dpr_workflow_events')
export class DprWorkflowEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'proposal_id', type: 'uuid' })
  proposalId: string;

  @Column({ type: 'smallint' })
  stage: number;

  @Column({ type: 'varchar', length: 80 })
  action: string;

  @Column({ name: 'from_status', type: 'varchar', length: 80, nullable: true })
  fromStatus: string | null;

  @Column({ name: 'to_status', type: 'varchar', length: 80, nullable: true })
  toStatus: string | null;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId: string | null;

  @Column({ name: 'actor_role', type: 'varchar', length: 50, nullable: true })
  actorRole: string | null;

  @Column({ type: 'text', nullable: true })
  comments: string | null;

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity('dpr_sanctions')
export class DprSanction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'proposal_id', type: 'uuid' })
  proposalId: string;

  @Column({ name: 'administrative_approval_no', type: 'varchar', length: 100, nullable: true })
  administrativeApprovalNo: string | null;

  @Column({ name: 'expenditure_sanction_no', type: 'varchar', length: 100, nullable: true })
  expenditureSanctionNo: string | null;

  @Column({ name: 'sanctioned_amount', type: 'decimal', precision: 14, scale: 2, nullable: true })
  sanctionedAmount: number | null;

  @Column({ name: 'budget_head', type: 'varchar', length: 255, nullable: true })
  budgetHead: string | null;

  @Column({ name: 'sanction_date', type: 'date', nullable: true })
  sanctionDate: string | null;

  @Column({ name: 'funding_release_ref', type: 'varchar', length: 100, nullable: true })
  fundingReleaseRef: string | null;

  @Column({ name: 'document_url', type: 'text', nullable: true })
  documentUrl: string | null;

  @Column({ name: 'recorded_by', type: 'uuid', nullable: true })
  recordedBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity('dpr_tender_packages')
export class DprTenderPackage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'proposal_id', type: 'uuid' })
  proposalId: string;

  @Column({ name: 'package_no', type: 'varchar', length: 50 })
  packageNo: string;

  @Column({ type: 'varchar', length: 50, default: 'prep_initiated' })
  status: string;

  @Column({ name: 'boq_final_url', type: 'text', nullable: true })
  boqFinalUrl: string | null;

  @Column({ name: 'nit_ref', type: 'varchar', length: 100, nullable: true })
  nitRef: string | null;

  @Column({ name: 'bid_document_url', type: 'text', nullable: true })
  bidDocumentUrl: string | null;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @Column({ name: 'task_order_ref', type: 'varchar', length: 100, nullable: true })
  taskOrderRef: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('dpr_boq_validations')
export class DprBoqValidation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'proposal_id', type: 'uuid' })
  proposalId: string;

  @Column({ name: 'document_id', type: 'uuid', nullable: true })
  documentId: string | null;

  @Column({ name: 'file_name', type: 'varchar', length: 500, nullable: true })
  fileName: string | null;

  @Column({ type: 'varchar', length: 30, default: 'pending' })
  status: string;

  @Column({ name: 'total_items', type: 'int', default: 0 })
  totalItems: number;

  @Column({ name: 'passed_items', type: 'int', default: 0 })
  passedItems: number;

  @Column({ name: 'failed_items', type: 'int', default: 0 })
  failedItems: number;

  @Column({ name: 'warning_items', type: 'int', default: 0 })
  warningItems: number;

  @Column({ name: 'computed_grand_total', type: 'decimal', precision: 16, scale: 2, nullable: true })
  computedGrandTotal: number | null;

  @Column({ name: 'declared_grand_total', type: 'decimal', precision: 16, scale: 2, nullable: true })
  declaredGrandTotal: number | null;

  @Column({ name: 'grand_total_match', type: 'boolean', nullable: true })
  grandTotalMatch: boolean | null;

  @Column({ name: 'validation_report', type: 'jsonb', default: () => "'[]'" })
  validationReport: Record<string, unknown>[];

  @Column({ type: 'jsonb', nullable: true })
  summary: Record<string, unknown> | null;

  @Column({ name: 'validated_at', type: 'timestamptz', nullable: true })
  validatedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
