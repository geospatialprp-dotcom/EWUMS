import {
  Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('dpr_pdf_reviews')
export class DprPdfReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'proposal_id', type: 'uuid' })
  proposalId: string;

  @Column({ name: 'document_id', type: 'uuid' })
  documentId: string;

  @Column({ type: 'varchar', length: 40, default: 'open' })
  status: string;

  @Column({ name: 'reviewer_scope', type: 'varchar', length: 30, default: 'division' })
  reviewerScope: string;

  @Column({ name: 'assigned_to', type: 'uuid', nullable: true })
  assignedTo: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('dpr_pdf_annotations')
export class DprPdfAnnotation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'review_id', type: 'uuid' })
  reviewId: string;

  @Column({ name: 'proposal_id', type: 'uuid' })
  proposalId: string;

  @Column({ name: 'document_id', type: 'uuid' })
  documentId: string;

  @Column({ name: 'page_number', type: 'int' })
  pageNumber: number;

  @Column({ name: 'annotation_type', type: 'varchar', length: 40 })
  annotationType: string;

  @Column({ type: 'jsonb', default: {} })
  geometry: Record<string, unknown>;

  @Column({ type: 'varchar', length: 20, default: '#d32f2f' })
  color: string;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('dpr_pdf_comments')
export class DprPdfComment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'review_id', type: 'uuid' })
  reviewId: string;

  @Column({ name: 'annotation_id', type: 'uuid', nullable: true })
  annotationId: string | null;

  @Column({ name: 'proposal_id', type: 'uuid' })
  proposalId: string;

  @Column({ name: 'page_number', type: 'int', nullable: true })
  pageNumber: number | null;

  @Column({ type: 'text' })
  body: string;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('dpr_pdf_versions')
export class DprPdfVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'review_id', type: 'uuid' })
  reviewId: string;

  @Column({ name: 'proposal_id', type: 'uuid' })
  proposalId: string;

  @Column({ name: 'document_id', type: 'uuid' })
  documentId: string;

  @Column({ name: 'version_no', type: 'int', default: 1 })
  versionNo: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  label: string | null;

  @Column({ name: 'snapshot_annotations', type: 'jsonb', nullable: true })
  snapshotAnnotations: Record<string, unknown>[] | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
