import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('om_contract_reviews')
export class OmContractReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'contract_id', type: 'uuid' })
  contractId: string;

  @Column({ name: 'review_date', type: 'date' })
  reviewDate: string;

  @Column({ name: 'overall_rating', type: 'varchar', length: 30 })
  overallRating: string;

  @Column({ name: 'sla_compliance_pct', type: 'decimal', precision: 5, scale: 2, nullable: true })
  slaCompliancePct: number | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
