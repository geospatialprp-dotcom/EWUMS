import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('boq_items')
@Unique('boq_items_project_item_source_key', ['projectId', 'itemCode', 'boqSource'])
export class BoqItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @Column({ name: 'scheme_type', type: 'varchar', length: 20 })
  schemeType: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  component: string | null;

  @Column({ name: 'item_code', type: 'varchar', length: 50 })
  itemCode: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 30 })
  unit: string;

  @Column({ name: 'contract_qty', type: 'decimal', precision: 14, scale: 3, default: 0 })
  contractQty: number;

  @Column({ name: 'revised_qty', type: 'decimal', precision: 14, scale: 3, default: 0 })
  revisedQty: number;

  @Column({ name: 'dpr_qty', type: 'decimal', precision: 14, scale: 3, default: 0 })
  dprQty: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  rate: number;

  @Column({ name: 'contract_amount', type: 'decimal', precision: 16, scale: 2, default: 0 })
  contractAmount: number;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  /** government = original sanctioned BOQ; l1_contractor = contractor L1 BOQ */
  @Column({ name: 'boq_source', type: 'varchar', length: 20, default: 'government' })
  boqSource: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
