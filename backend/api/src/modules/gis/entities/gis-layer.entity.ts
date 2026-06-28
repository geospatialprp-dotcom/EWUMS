import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('gis_layers')
export class GisLayer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'layer_group_id', type: 'uuid', nullable: true })
  layerGroupId: string;

  @Column({ length: 255 })
  name: string;

  @Column({ name: 'source_type', length: 50 })
  sourceType: string;

  @Column({ name: 'source_config', type: 'jsonb', default: {} })
  sourceConfig: Record<string, unknown>;

  @Column({ name: 'default_style', type: 'jsonb', default: {} })
  defaultStyle: Record<string, unknown>;

  @Column({ name: 'min_zoom', default: 0 })
  minZoom: number;

  @Column({ name: 'max_zoom', default: 22 })
  maxZoom: number;

  @Column({ name: 'is_public', default: false })
  isPublic: boolean;

  @Column({ name: 'is_published', default: false })
  isPublished: boolean;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
