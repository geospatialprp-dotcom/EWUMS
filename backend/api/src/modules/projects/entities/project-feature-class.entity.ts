import {
  Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

export type GeometryType = 'Point' | 'LineString' | 'Polygon' | 'Any';

export interface AttributeField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'integer' | 'boolean' | 'date' | 'select' | 'image';
  required?: boolean;
  options?: string[];
  defaultValue?: string | number | boolean;
}

@Entity('project_feature_classes')
export class ProjectFeatureClass {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @Column({ length: 100 })
  code: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'geometry_type', length: 20 })
  geometryType: GeometryType;

  @Column({ name: 'attribute_schema', type: 'jsonb', default: [] })
  attributeSchema: AttributeField[];

  @Column({ name: 'default_style', type: 'jsonb', default: {} })
  defaultStyle: Record<string, unknown>;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
