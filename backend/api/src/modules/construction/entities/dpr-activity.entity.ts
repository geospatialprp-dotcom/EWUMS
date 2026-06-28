import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { DprReport } from './dpr-report.entity';

@Entity('dpr_activities')
export class DprActivity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'dpr_id', type: 'uuid' })
  dprId: string;

  @Column({ name: 'activity_code', type: 'varchar', length: 50, nullable: true })
  activityCode: string | null;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 30 })
  unit: string;

  @Column({ name: 'quantity_done', type: 'decimal', precision: 14, scale: 3, default: 0 })
  quantityDone: number;

  @Column({ name: 'boq_item_id', type: 'uuid', nullable: true })
  boqItemId: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  component: string | null;

  @Column({ name: 'chainage_from', type: 'varchar', length: 50, nullable: true })
  chainageFrom: string | null;

  @Column({ name: 'chainage_to', type: 'varchar', length: 50, nullable: true })
  chainageTo: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: number | null;

  @Column({ name: 'material_consumption', type: 'text', nullable: true })
  materialConsumption: string | null;

  @Column({ name: 'labour_count', type: 'int', default: 0 })
  labourCount: number;

  @Column({ name: 'equipment_details', type: 'text', nullable: true })
  equipmentDetails: string | null;

  @Column({ name: 'location_detail', type: 'varchar', length: 500, nullable: true })
  siteDetail: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @ManyToOne(() => DprReport, (dpr) => dpr.activities, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dpr_id' })
  dpr: DprReport;
}
