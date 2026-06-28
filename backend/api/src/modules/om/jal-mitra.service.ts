import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ConsumerPortalService } from './consumer-portal.service';
import { OmConsumer } from './entities/om-consumer.entity';
import { JalMitraMessage } from './entities/jal-mitra-message.entity';
import { JalMitraSession, JalMitraLanguage } from './entities/jal-mitra-session.entity';
import {
  JalMitraEscalateDto,
  JalMitraLanguageDto,
  JalMitraMessageDto,
  JalMitraOtpRequestDto,
  JalMitraOtpVerifyDto,
  JalMitraVerifyDto,
  StartJalMitraSessionDto,
} from './dto/jal-mitra.dto';
import { JalMitraIntent, INTENT_KB_CATEGORY, detectIntent, isGreetingOnly, mapComplaintType } from './jal-mitra/jal-mitra-intent.util';
import { detectLanguage, parseLanguageSwitch, resolveSessionLanguage } from './jal-mitra/jal-mitra-language.util';
import { QUICK_ACTIONS, JalMitraLang, t } from './jal-mitra/jal-mitra-i18n';
import { JalMitraKnowledgeService } from './jal-mitra/jal-mitra-knowledge.service';
import { JalMitraLlmService } from './jal-mitra/jal-mitra-llm.service';
import { ConsumerPortalOtpService } from './consumer-portal-otp.service';

const DEMO_TENANT = 'a0000000-0000-0000-0000-000000000001';

@Injectable()
export class JalMitraService {
  constructor(
    @InjectRepository(JalMitraSession) private sessionRepo: Repository<JalMitraSession>,
    @InjectRepository(JalMitraMessage) private messageRepo: Repository<JalMitraMessage>,
    @InjectRepository(OmConsumer) private consumerRepo: Repository<OmConsumer>,
    private portalService: ConsumerPortalService,
    private knowledgeService: JalMitraKnowledgeService,
    private llmService: JalMitraLlmService,
    private otpService: ConsumerPortalOtpService,
  ) {}

  getQuickActions(language: JalMitraLang = 'hi') {
    return QUICK_ACTIONS.map((a) => ({
      id: a.id,
      label: a.labels[language] ?? a.labels.hi,
    }));
  }

  async startSession(
    tenantId: string,
    dto: StartJalMitraSessionDto,
    consumerId?: string,
  ) {
    const tid = tenantId || DEMO_TENANT;
    let consumer: OmConsumer | null = null;
    if (consumerId) {
      consumer = await this.consumerRepo.findOne({ where: { id: consumerId, tenantId: tid } });
    }

    const language = (dto.language ?? 'garhwali') as JalMitraLanguage;
    const session = await this.sessionRepo.save(this.sessionRepo.create({
      tenantId: tid,
      omConsumerId: consumer?.id ?? null,
      channel: (dto.channel as JalMitraSession['channel']) ?? 'web_portal',
      language,
      status: 'active',
      mobile: consumer?.mobile ?? null,
      fhtcNumber: consumer?.fhtcNumber ?? null,
      consumerName: consumer?.consumerName ?? null,
      verifiedAt: consumer ? new Date() : null,
      verificationMethod: consumer ? 'portal_login' : null,
      context: {},
    }));

    const welcome = await this.appendAssistantMessage(session, 'greeting', t(language, 'welcome'));
    return {
      sessionId: session.id,
      language: session.language,
      verified: Boolean(session.verifiedAt),
      quickActions: this.getQuickActions(language),
      messages: [welcome],
    };
  }

  async listMessages(sessionId: string, tenantId: string) {
    await this.getSession(sessionId, tenantId);
    return this.messageRepo.find({
      where: { sessionId },
      order: { createdAt: 'ASC' },
      take: 200,
    });
  }

  async sendMessage(
    sessionId: string,
    tenantId: string,
    dto: JalMitraMessageDto,
    consumerId?: string,
  ) {
    const session = await this.getSession(sessionId, tenantId);
    if (consumerId && !session.omConsumerId) {
      session.omConsumerId = consumerId;
      session.verifiedAt = new Date();
      session.verificationMethod = 'portal_login';
      await this.sessionRepo.save(session);
    }

    const detectedLang = resolveSessionLanguage(
      dto.text,
      session.language as JalMitraLang,
      dto.language,
    );
    if (detectedLang !== session.language) {
      session.language = detectedLang;
      await this.sessionRepo.save(session);
    }

    const userMsg = await this.messageRepo.save(this.messageRepo.create({
      sessionId: session.id,
      role: 'user',
      content: dto.text.trim(),
      language: session.language,
      metadata: dto.quickActionId ? { quickActionId: dto.quickActionId } : {},
    }));

    const intent = detectIntent(dto.text, dto.quickActionId);
    const reply = await this.handleIntent(session, intent, dto.text, consumerId);
    return {
      session: {
        id: session.id,
        language: session.language,
        status: session.status,
        verified: Boolean(session.verifiedAt),
        escalationNo: session.escalationNo,
      },
      quickActions: this.getQuickActions(session.language as JalMitraLang),
      userMessage: userMsg,
      assistantMessage: reply,
    };
  }

  async verifySession(sessionId: string, tenantId: string, dto: JalMitraVerifyDto) {
    const session = await this.getSession(sessionId, tenantId);
    const consumer = await this.consumerRepo.findOne({
      where: {
        tenantId,
        fhtcNumber: dto.fhtcNumber.trim(),
        mobile: dto.mobile.trim(),
      },
    });
    if (!consumer) {
      throw new BadRequestException('FHTC and mobile do not match our records.');
    }

    session.omConsumerId = consumer.id;
    session.fhtcNumber = consumer.fhtcNumber;
    session.mobile = consumer.mobile;
    session.consumerName = consumer.consumerName;
    session.verifiedAt = new Date();
    session.verificationMethod = 'fhtc_mobile';
    await this.sessionRepo.save(session);

    return this.appendAssistantMessage(session, 'verify', t(session.language as JalMitraLang, 'verified_ok'));
  }

  async requestSessionOtp(sessionId: string, tenantId: string, dto: JalMitraOtpRequestDto) {
    const session = await this.getSession(sessionId, tenantId);
    return this.otpService.requestOtp(
      session.tenantId,
      dto.fhtcNumber,
      dto.mobile,
      'jal_mitra_verify',
      session.id,
    );
  }

  async verifySessionOtp(sessionId: string, tenantId: string, dto: JalMitraOtpVerifyDto) {
    const session = await this.getSession(sessionId, tenantId);
    const { consumer } = await this.otpService.verifyOtp(
      session.tenantId,
      dto.fhtcNumber,
      dto.mobile,
      dto.otp,
      'jal_mitra_verify',
    );

    session.omConsumerId = consumer.id;
    session.fhtcNumber = consumer.fhtcNumber;
    session.mobile = consumer.mobile;
    session.consumerName = consumer.consumerName;
    session.verifiedAt = new Date();
    session.verificationMethod = 'otp';
    await this.sessionRepo.save(session);

    return this.appendAssistantMessage(session, 'verify', t(session.language as JalMitraLang, 'verified_ok'));
  }

  getAssistantConfig() {
    return {
      llmLive: this.llmService.isLive(),
      otpMode: this.otpService.getOtpMode(),
    };
  }

  async setLanguage(sessionId: string, tenantId: string, dto: JalMitraLanguageDto) {
    const session = await this.getSession(sessionId, tenantId);
    session.language = dto.language;
    await this.sessionRepo.save(session);
    const msg = await this.appendAssistantMessage(
      session,
      'language_switch',
      t(dto.language, 'language_switched'),
    );
    return { language: session.language, message: msg, quickActions: this.getQuickActions(dto.language) };
  }

  async escalate(sessionId: string, tenantId: string, dto: JalMitraEscalateDto) {
    const session = await this.getSession(sessionId, tenantId);
    const role = dto.targetRole ?? 'consumer_service';
    const ref = `ESC-${Date.now().toString(36).toUpperCase()}`;
    session.status = 'escalated';
    session.escalatedToRole = role;
    session.escalationNo = ref;
    session.context = {
      ...session.context,
      escalationReason: dto.reason ?? 'Consumer requested human assistance via Jal Mitra',
    };
    await this.sessionRepo.save(session);

    const roleLabel = role.replace(/_/g, ' ').toUpperCase();
    return this.appendAssistantMessage(session, 'escalate', t(session.language as JalMitraLang, 'escalated', {
      role: roleLabel,
      ref,
    }), { escalationNo: ref, role });
  }

  async getAnalytics(tenantId: string) {
    const tid = tenantId || DEMO_TENANT;
    const rows = await this.sessionRepo.query(
      `SELECT language, COUNT(*)::int AS sessions
       FROM jal_mitra_sessions WHERE tenant_id = $1
       GROUP BY language`,
      [tid],
    );
    const intents = await this.messageRepo.query(
      `SELECT m.intent, COUNT(*)::int AS count
       FROM jal_mitra_messages m
       JOIN jal_mitra_sessions s ON s.id = m.session_id
       WHERE s.tenant_id = $1 AND m.role = 'assistant' AND m.intent IS NOT NULL
       GROUP BY m.intent ORDER BY count DESC LIMIT 15`,
      [tid],
    );
    const channels = await this.sessionRepo.query(
      `SELECT channel, COUNT(*)::int AS sessions
       FROM jal_mitra_sessions WHERE tenant_id = $1
       GROUP BY channel ORDER BY sessions DESC`,
      [tid],
    );
    const todayRow = await this.sessionRepo.query(
      `SELECT COUNT(*)::int AS sessions_today
       FROM jal_mitra_sessions
       WHERE tenant_id = $1 AND created_at >= CURRENT_DATE`,
      [tid],
    );
    const msgRow = await this.messageRepo.query(
      `SELECT COUNT(*)::int AS total_messages,
              COALESCE(AVG(cnt), 0)::float AS avg_messages_per_session
       FROM (
         SELECT session_id, COUNT(*)::int AS cnt
         FROM jal_mitra_messages m
         JOIN jal_mitra_sessions s ON s.id = m.session_id
         WHERE s.tenant_id = $1
         GROUP BY session_id
       ) t`,
      [tid],
    );
    const llmRow = await this.messageRepo.query(
      `SELECT COUNT(*)::int AS rag_replies
       FROM jal_mitra_messages m
       JOIN jal_mitra_sessions s ON s.id = m.session_id
       WHERE s.tenant_id = $1 AND m.role = 'assistant'
         AND (m.metadata->>'replySource') IN ('rag', 'openai')`,
      [tid],
    );
    const total = await this.sessionRepo.count({ where: { tenantId: tid } });
    const escalated = await this.sessionRepo.count({ where: { tenantId: tid, status: 'escalated' } });
    const sessionsToday = todayRow[0]?.sessions_today ?? 0;
    const totalMessages = msgRow[0]?.total_messages ?? 0;
    const avgMessagesPerSession = Number(msgRow[0]?.avg_messages_per_session ?? 0);
    const ragReplies = llmRow[0]?.rag_replies ?? 0;
    return {
      generatedAt: new Date().toISOString(),
      totalSessions: total,
      sessionsToday,
      escalatedSessions: escalated,
      escalationRate: total ? Math.round((escalated / total) * 1000) / 10 : 0,
      totalMessages,
      avgMessagesPerSession: Math.round(avgMessagesPerSession * 10) / 10,
      ragReplies,
      aiAccuracyEstimate: totalMessages
        ? Math.round(((totalMessages - escalated) / totalMessages) * 1000) / 10
        : null,
      languageBreakdown: rows,
      channelBreakdown: channels,
      topIntents: intents,
      llmEnabled: this.llmService.isLive(),
      channels: ['web_portal', 'mobile_app', 'whatsapp', 'voice'],
    };
  }

  private async handleIntent(
    session: JalMitraSession,
    intent: JalMitraIntent,
    text: string,
    consumerId?: string,
  ) {
    const lang = session.language as JalMitraLang;
    const cid = consumerId ?? session.omConsumerId ?? undefined;

    if (intent === 'language_switch') {
      const next = parseLanguageSwitch(text);
      if (next) {
        session.language = next;
        await this.sessionRepo.save(session);
        return this.appendAssistantMessage(session, intent, t(next, 'language_switched'));
      }
      return this.appendAssistantMessage(session, intent, t(lang, 'language_choose'));
    }

    if (intent === 'escalate') {
      return this.escalate(session.id, session.tenantId, { reason: text });
    }

    if (intent === 'verify') {
      const otpHint = this.otpService.getOtpMode() !== 'off'
        ? t(lang, 'verify_otp_hint')
        : '';
      return this.appendAssistantMessage(session, intent, t(lang, 'verify_prompt') + otpHint);
    }

    if (intent === 'bill_status') {
      if (!cid) {
        return this.appendAssistantMessage(session, intent, t(lang, 'auth_required'));
      }
      const bills = await this.portalService.listMyBills(session.tenantId, cid);
      const list = Array.isArray(bills) ? bills : (bills as { items?: unknown[] })?.items ?? bills;
      const arr = Array.isArray(list) ? list : [];
      if (!arr.length) {
        return this.appendAssistantMessage(session, intent, t(lang, 'no_bills'));
      }
      const latest = arr[0] as Record<string, unknown>;
      return this.appendAssistantMessage(session, intent, t(lang, 'bill_summary', {
        billNo: String(latest.billNumber ?? latest.billNo ?? latest.id ?? '—'),
        amount: String(latest.totalAmount ?? latest.amount ?? '0'),
        status: String(latest.status ?? 'pending'),
        dueDate: String(latest.dueDate ?? '—'),
      }), { billId: latest.id });
    }

    if (intent === 'complaint_status') {
      if (!cid) {
        return this.appendAssistantMessage(session, intent, t(lang, 'auth_required'));
      }
      const complaints = await this.portalService.listMyComplaints(session.tenantId, cid);
      if (!complaints?.length) {
        return this.appendAssistantMessage(session, intent, t(lang, 'no_complaints'));
      }
      const c = complaints[0] as Record<string, unknown>;
      return this.appendAssistantMessage(session, intent, t(lang, 'complaint_status', {
        complaintNo: String(c.complaintNo ?? c.id),
        status: String(c.status ?? 'open'),
        type: String(c.complaintType ?? 'general'),
      }));
    }

    if (intent === 'complaint_register') {
      if (!cid) {
        return this.appendAssistantMessage(session, intent, t(lang, 'auth_required'));
      }
      const type = mapComplaintType(text);
      const result = await this.portalService.registerComplaint(session.tenantId, cid, {
        complaintType: type,
        description: text.trim(),
        priority: 'medium',
      });
      const complaintNo = (result as Record<string, unknown>).complaintNo ?? (result as Record<string, unknown>).id;
      return this.appendAssistantMessage(session, intent, t(lang, 'complaint_registered', {
        complaintNo: String(complaintNo),
      }), { complaintId: (result as Record<string, unknown>).id, complaintNo });
    }

    if (intent === 'supply_timing') {
      return this.appendAssistantMessage(session, intent, t(lang, 'supply_timing'));
    }

    if (intent === 'tariff') {
      return this.appendAssistantMessage(session, intent, t(lang, 'tariff_info'));
    }

    if (intent === 'connection_info') {
      return this.appendAssistantMessage(
        session,
        intent,
        t(lang, 'quick_actions_hint') + ' ' + t(lang, 'contact_division'),
      );
    }

    if (intent === 'contact') {
      return this.appendAssistantMessage(session, intent, t(lang, 'contact_division'));
    }

    if (intent === 'greeting' && isGreetingOnly(text)) {
      return this.appendAssistantMessage(session, intent, t(lang, 'welcome'));
    }

    const augmented = await this.tryAugmentedReply(session, text, intent, cid);
    if (augmented) return augmented;

    if (intent === 'greeting') {
      return this.appendAssistantMessage(session, intent, t(lang, 'welcome'));
    }

    return this.appendAssistantMessage(session, 'unknown', t(lang, 'fallback'));
  }

  private async tryAugmentedReply(
    session: JalMitraSession,
    text: string,
    intent: JalMitraIntent,
    consumerId?: string,
  ) {
    const lang = session.language as JalMitraLang;
    const category = INTENT_KB_CATEGORY[intent];
    const snippets = await this.knowledgeService.searchArticles(
      session.tenantId,
      text,
      lang,
      3,
      { category, minScore: 5 },
    );
    if (!snippets.length && !this.llmService.isLive()) return null;

    const recent = await this.messageRepo.find({
      where: { sessionId: session.id },
      order: { createdAt: 'DESC' },
      take: 8,
    });

    const llm = await this.llmService.generateReply({
      userText: text,
      language: lang,
      kbSnippets: snippets,
      recentMessages: recent.reverse().map((m) => ({ role: m.role, content: m.content })),
      consumerName: session.consumerName,
      intent,
    });

    if (!llm?.content) return null;

    return this.appendAssistantMessage(session, intent === 'unknown' ? 'rag_answer' : intent, llm.content, {
      replySource: llm.source,
      kbArticleIds: llm.kbArticleIds,
      consumerLinked: Boolean(consumerId ?? session.omConsumerId),
    });
  }

  private async appendAssistantMessage(
    session: JalMitraSession,
    intent: string,
    content: string,
    metadata: Record<string, unknown> = {},
  ) {
    return this.messageRepo.save(this.messageRepo.create({
      sessionId: session.id,
      role: 'assistant',
      content,
      language: session.language,
      intent,
      metadata,
    }));
  }

  private async getSession(sessionId: string, tenantId: string) {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId, tenantId: tenantId || DEMO_TENANT },
    });
    if (!session) throw new NotFoundException('Chat session not found');
    return session;
  }
}
