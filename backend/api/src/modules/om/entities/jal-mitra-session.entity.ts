import {
  Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { JalMitraMessage } from './jal-mitra-message.entity';

export type JalMitraLanguage = 'en' | 'hi' | 'garhwali' | 'kumaoni';
export type JalMitraChannel = 'web_portal' | 'mobile_app' | 'whatsapp' | 'voice' | 'call_centre';

@Entity('jal_mitra_sessions')
export class JalMitraSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'om_consumer_id', type: 'uuid', nullable: true })
  omConsumerId: string | null;

  @Column({ type: 'varchar', length: 30, default: 'web_portal' })
  channel: JalMitraChannel;

  @Column({ type: 'varchar', length: 10, default: 'hi' })
  language: JalMitraLanguage;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: string;

  @Column({ name: 'verification_method', type: 'varchar', length: 30, nullable: true })
  verificationMethod: string | null;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt: Date | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  mobile: string | null;

  @Column({ name: 'fhtc_number', type: 'varchar', length: 50, nullable: true })
  fhtcNumber: string | null;

  @Column({ name: 'consumer_name', type: 'varchar', length: 255, nullable: true })
  consumerName: string | null;

  @Column({ type: 'jsonb', default: {} })
  context: Record<string, unknown>;

  @Column({ name: 'escalated_to_role', type: 'varchar', length: 50, nullable: true })
  escalatedToRole: string | null;

  @Column({ name: 'escalation_no', type: 'varchar', length: 40, nullable: true })
  escalationNo: string | null;

  @Column({ name: 'satisfaction_score', type: 'smallint', nullable: true })
  satisfactionScore: number | null;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt: Date | null;

  @OneToMany(() => JalMitraMessage, (m) => m.session)
  messages: JalMitraMessage[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
