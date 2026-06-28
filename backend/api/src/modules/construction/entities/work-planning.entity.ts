import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('work_planning')
export class WorkPlanning {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @Column({ name: 'approved_dpr_url', type: 'text', nullable: true })
  approvedDprUrl: string | null;

  @Column({ name: 'admin_approval_ref', type: 'varchar', length: 100, nullable: true })
  adminApprovalRef: string | null;

  @Column({ name: 'technical_sanction_ref', type: 'varchar', length: 100, nullable: true })
  technicalSanctionRef: string | null;

  @Column({ name: 'boq_upload_url', type: 'text', nullable: true })
  boqUploadUrl: string | null;

  @Column({ name: 'l1_contractor_boq_upload_url', type: 'text', nullable: true })
  l1ContractorBoqUploadUrl: string | null;

  @Column({ name: 'contractor_po_upload_url', type: 'text', nullable: true })
  contractorPoUploadUrl: string | null;

  @Column({ name: 'drawing_upload_url', type: 'text', nullable: true })
  drawingUploadUrl: string | null;

  @Column({ name: 'gis_alignment_approved', default: false })
  gisAlignmentApproved: boolean;

  @Column({ type: 'varchar', length: 50, default: 'draft' })
  status: string;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy: string | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt: Date;
}
