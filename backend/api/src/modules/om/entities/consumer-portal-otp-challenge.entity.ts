import {
  Column, CreateDateColumn, Entity, PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('consumer_portal_otp_challenges')
export class ConsumerPortalOtpChallenge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'fhtc_number', type: 'varchar', length: 50 })
  fhtcNumber: string;

  @Column({ type: 'varchar', length: 20 })
  mobile: string;

  @Column({ name: 'otp_hash', type: 'varchar', length: 128 })
  otpHash: string;

  @Column({ type: 'varchar', length: 30, default: 'portal_login' })
  purpose: string;

  @Column({ name: 'session_id', type: 'uuid', nullable: true })
  sessionId: string | null;

  @Column({ type: 'smallint', default: 0 })
  attempts: number;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
