import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('om_journal_lines')
export class OmJournalLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'entry_id', type: 'uuid' })
  entryId: string;

  @Column({ name: 'account_id', type: 'uuid' })
  accountId: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  debit: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  credit: number;

  @Column({ name: 'consumer_id', type: 'uuid', nullable: true })
  consumerId: string | null;

  @Column({ name: 'project_id', type: 'uuid', nullable: true })
  projectId: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  reference: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
