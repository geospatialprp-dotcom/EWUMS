import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { RaBill } from './ra-bill.entity';

@Entity('ra_bill_lines')
export class RaBillLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'ra_bill_id', type: 'uuid' })
  raBillId: string;

  @Column({ name: 'boq_item_id', type: 'uuid', nullable: true })
  boqItemId: string | null;

  @Column({ name: 'mb_entry_id', type: 'uuid', nullable: true })
  mbEntryId: string | null;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 30 })
  unit: string;

  @Column({ name: 'boq_rate', type: 'decimal', precision: 14, scale: 2, default: 0 })
  boqRate: number;

  @Column({ name: 'previous_qty', type: 'decimal', precision: 14, scale: 3, default: 0 })
  previousQty: number;

  @Column({ name: 'current_qty', type: 'decimal', precision: 14, scale: 3, default: 0 })
  currentQty: number;

  @Column({ name: 'total_qty', type: 'decimal', precision: 14, scale: 3, default: 0 })
  totalQty: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  amount: number;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @ManyToOne(() => RaBill, (bill) => bill.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ra_bill_id' })
  raBill: RaBill;
}
