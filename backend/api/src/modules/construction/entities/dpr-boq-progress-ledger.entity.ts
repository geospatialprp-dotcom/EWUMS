import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('dpr_boq_progress_ledger')
export class DprBoqProgressLedger {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @Column({ name: 'dpr_id', type: 'uuid' })
  dprId: string;

  @Column({ name: 'dpr_activity_id', type: 'uuid' })
  dprActivityId: string;

  @Column({ name: 'boq_item_id', type: 'uuid' })
  boqItemId: string;

  @Column({ name: 'scope_key', type: 'varchar', length: 120 })
  scopeKey: string;

  @Column({ name: 'delta_qty', type: 'decimal', precision: 14, scale: 3 })
  deltaQty: number;

  @Column({ name: 'delta_pct', type: 'decimal', precision: 5, scale: 2, nullable: true })
  deltaPct: number | null;

  @Column({ name: 'applied_at', type: 'timestamptz', default: () => 'NOW()' })
  appliedAt: Date;

  @Column({ name: 'reversed_at', type: 'timestamptz', nullable: true })
  reversedAt: Date | null;
}
