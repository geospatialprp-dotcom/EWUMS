import {
  Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn,
} from 'typeorm';
import { JalMitraSession } from './jal-mitra-session.entity';

@Entity('jal_mitra_messages')
export class JalMitraMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'session_id', type: 'uuid' })
  sessionId: string;

  @ManyToOne(() => JalMitraSession, (s) => s.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session: JalMitraSession;

  @Column({ type: 'varchar', length: 20 })
  role: 'user' | 'assistant' | 'system' | 'agent';

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  language: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  intent: string | null;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
