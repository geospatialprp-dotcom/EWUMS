import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('permissions')
@Unique(['resource', 'action'])
export class Permission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  resource: string;

  @Column({ length: 50 })
  action: string;

  @Column({ length: 255, nullable: true })
  description: string;
}
