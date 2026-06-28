import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { MeasurementBook } from './measurement-book.entity';

@Entity('mb_entries')
export class MbEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'mb_id', type: 'uuid' })
  mbId: string;

  @Column({ name: 'boq_item_id', type: 'uuid', nullable: true })
  boqItemId: string | null;

  @Column({ name: 'item_code', type: 'varchar', length: 50, nullable: true })
  itemCode: string | null;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 30 })
  unit: string;

  @Column({ name: 'measured_qty', type: 'decimal', precision: 14, scale: 3, default: 0 })
  measuredQty: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  rate: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, insert: false, update: false })
  amount: number;

  @Column({ name: 'length_m', type: 'decimal', precision: 14, scale: 3, nullable: true })
  lengthM: number | null;

  @Column({ name: 'width_m', type: 'decimal', precision: 14, scale: 3, nullable: true })
  widthM: number | null;

  @Column({ name: 'height_m', type: 'decimal', precision: 14, scale: 3, nullable: true })
  heightM: number | null;

  @Column({ type: 'decimal', precision: 14, scale: 3, nullable: true })
  nos: number | null;

  @Column({ name: 'chainage_from', type: 'varchar', length: 50, nullable: true })
  chainageFrom: string | null;

  @Column({ name: 'chainage_to', type: 'varchar', length: 50, nullable: true })
  chainageTo: string | null;

  @Column({ name: 'depth_m', type: 'decimal', precision: 14, scale: 3, nullable: true })
  depthM: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: number | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @ManyToOne(() => MeasurementBook, (mb) => mb.entries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'mb_id' })
  measurementBook: MeasurementBook;
}
