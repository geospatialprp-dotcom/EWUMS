import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('work_packages')
export class WorkPackage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @Column({ name: 'package_code', type: 'varchar', length: 50 })
  packageCode: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50 })
  component: string;

  @Column({ name: 'scheme_type', type: 'varchar', length: 20, nullable: true })
  schemeType: string | null;

  @Column({ name: 'contractor_name', type: 'varchar', length: 255, nullable: true })
  contractorName: string | null;

  @Column({ name: 'contractor_id', type: 'uuid', nullable: true })
  contractorId: string | null;

  @Column({ name: 'chainage_from', type: 'varchar', length: 50, nullable: true })
  chainageFrom: string | null;

  @Column({ name: 'chainage_to', type: 'varchar', length: 50, nullable: true })
  chainageTo: string | null;

  @Column({ type: 'varchar', length: 50, default: 'planned' })
  status: string;

  @Column({ name: 'gis_alignment_status', type: 'varchar', length: 50, default: 'pending' })
  gisAlignmentStatus: string;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt: Date;
}
