import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('gis_map_access_logs')
export class GisMapAccessLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ name: 'user_role', type: 'varchar', length: 50, nullable: true })
  userRole: string | null;

  @Column({ name: 'division_id', type: 'uuid', nullable: true })
  divisionId: string | null;

  @Column({ name: 'division_name', type: 'varchar', length: 255, nullable: true })
  divisionName: string | null;

  @Column({ name: 'access_scope', type: 'varchar', length: 30, nullable: true })
  accessScope: string | null;

  @Column({ type: 'varchar', length: 80 })
  action: string;

  @Column({ name: 'layer_id', type: 'uuid', nullable: true })
  layerId: string | null;

  @Column({ name: 'layer_name', type: 'varchar', length: 255, nullable: true })
  layerName: string | null;

  @Column({ name: 'project_id', type: 'uuid', nullable: true })
  projectId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  details: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
