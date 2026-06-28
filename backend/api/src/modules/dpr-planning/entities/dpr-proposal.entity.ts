import {
  Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('dpr_proposals')
export class DprProposal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'proposal_no', type: 'varchar', length: 50 })
  proposalNo: string;

  @Column({ type: 'varchar', length: 500 })
  title: string;

  @Column({ name: 'division_id', type: 'uuid', nullable: true })
  divisionId: string | null;

  @Column({ name: 'project_id', type: 'uuid', nullable: true })
  projectId: string | null;

  @Column({ name: 'initiated_by', type: 'uuid', nullable: true })
  initiatedBy: string | null;

  @Column({ name: 'current_stage', type: 'smallint', default: 1 })
  currentStage: number;

  @Column({ type: 'varchar', length: 80, default: 'proposal_draft' })
  status: string;

  @Column({ name: 'scheme_justification', type: 'text', nullable: true })
  schemeJustification: string | null;

  @Column({ name: 'preliminary_estimate', type: 'decimal', precision: 14, scale: 2, nullable: true })
  preliminaryEstimate: number | null;

  @Column({ name: 'funding_source', type: 'varchar', length: 255, nullable: true })
  fundingSource: string | null;

  @Column({ type: 'varchar', length: 30, default: 'medium' })
  priority: string;

  @Column({ name: 'gis_boundary', type: 'jsonb', nullable: true })
  gisBoundary: Record<string, unknown> | null;

  @Column({ type: 'float', nullable: true })
  latitude: number | null;

  @Column({ type: 'float', nullable: true })
  longitude: number | null;

  @Column({ name: 'hq_remarks', type: 'text', nullable: true })
  hqRemarks: string | null;

  @Column({ name: 'hq_verification', type: 'jsonb', nullable: true })
  hqVerification: Record<string, unknown> | null;

  @Column({ name: 'hq_reviewed_by', type: 'uuid', nullable: true })
  hqReviewedBy: string | null;

  @Column({ name: 'hq_reviewed_at', type: 'timestamptz', nullable: true })
  hqReviewedAt: Date | null;

  @Column({ name: 'dpr_prep_order_no', type: 'varchar', length: 100, nullable: true })
  dprPrepOrderNo: string | null;

  @Column({ name: 'dpr_prep_order_issued_at', type: 'timestamptz', nullable: true })
  dprPrepOrderIssuedAt: Date | null;

  @Column({ name: 'tac_round1_remarks', type: 'text', nullable: true })
  tacRound1Remarks: string | null;

  @Column({ name: 'tac_round2_remarks', type: 'text', nullable: true })
  tacRound2Remarks: string | null;

  @Column({ name: 'secretariat_ref', type: 'varchar', length: 100, nullable: true })
  secretariatRef: string | null;

  @Column({ name: 'secretariat_forwarded_at', type: 'timestamptz', nullable: true })
  secretariatForwardedAt: Date | null;

  @Column({ name: 'workflow_instance_id', type: 'uuid', nullable: true })
  workflowInstanceId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt: Date | null;
}
