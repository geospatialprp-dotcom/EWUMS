import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ContractorInvoice } from './contractor-invoice.entity';

@Entity('invoice_line_items')
export class InvoiceLineItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'invoice_id', type: 'uuid' })
  invoiceId: string;

  @Column({ name: 'boq_item_id', type: 'uuid', nullable: true })
  boqItemId: string | null;

  @Column({ name: 'mb_entry_id', type: 'uuid', nullable: true })
  mbEntryId: string | null;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 30 })
  unit: string;

  @Column({ type: 'decimal', precision: 14, scale: 3, default: 0 })
  quantity: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  rate: number;

  @Column({ name: 'previous_qty', type: 'decimal', precision: 14, scale: 3, default: 0 })
  previousQty: number;

  @Column({ name: 'current_qty', type: 'decimal', precision: 14, scale: 3, default: 0 })
  currentQty: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, insert: false, update: false })
  amount: number;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @ManyToOne(() => ContractorInvoice, (inv) => inv.lineItems, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: ContractorInvoice;
}
