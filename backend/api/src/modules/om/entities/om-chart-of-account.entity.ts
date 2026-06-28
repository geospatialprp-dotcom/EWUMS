import {
  Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('om_chart_of_accounts')
export class OmChartOfAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'account_code', type: 'varchar', length: 20 })
  accountCode: string;

  @Column({ name: 'account_name', type: 'varchar', length: 255 })
  accountName: string;

  @Column({ name: 'account_type', type: 'varchar', length: 20 })
  accountType: string;

  @Column({ name: 'is_cash', type: 'boolean', default: false })
  isCash: boolean;

  @Column({ name: 'is_bank', type: 'boolean', default: false })
  isBank: boolean;

  @Column({ name: 'is_system', type: 'boolean', default: true })
  isSystem: boolean;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
