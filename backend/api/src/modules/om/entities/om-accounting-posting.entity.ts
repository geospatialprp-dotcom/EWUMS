import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('om_accounting_postings')
export class OmAccountingPosting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'source_type', type: 'varchar', length: 30 })
  sourceType: string;

  @Column({ name: 'source_id', type: 'uuid' })
  sourceId: string;

  @Column({ name: 'source_ref', type: 'varchar', length: 100, nullable: true })
  sourceRef: string | null;

  @Column({ name: 'journal_entry_id', type: 'uuid', nullable: true })
  journalEntryId: string | null;

  @Column({ name: 'posting_type', type: 'varchar', length: 30 })
  postingType: string;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount: number;

  @Column({ name: 'erp_status', type: 'varchar', length: 20, default: 'posted' })
  erpStatus: string;

  @Column({ name: 'erp_reference', type: 'varchar', length: 100, nullable: true })
  erpReference: string | null;

  @Column({ type: 'jsonb', default: {} })
  details: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
