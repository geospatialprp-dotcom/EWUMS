import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('district_boundaries')
export class DistrictBoundary {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'district_code', type: 'varchar', length: 20 })
  districtCode: string;

  @Column({ name: 'district_name', type: 'varchar', length: 100 })
  districtName: string;

  @Column({ name: 'min_lon', type: 'double precision' })
  minLon: number;

  @Column({ name: 'min_lat', type: 'double precision' })
  minLat: number;

  @Column({ name: 'max_lon', type: 'double precision' })
  maxLon: number;

  @Column({ name: 'max_lat', type: 'double precision' })
  maxLat: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
