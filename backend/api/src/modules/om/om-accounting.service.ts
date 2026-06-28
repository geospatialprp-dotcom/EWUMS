import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  CASH_PAYMENT_MODES,
  DEFAULT_ACCOUNT_CODES,
  OM_ACCOUNTING_AUTO_POSTING,
  OM_ACCOUNTING_REPORT_TYPES,
  OM_ERP_SYNC_STATUSES,
} from './constants/om-accounting-catalog';
import { CreateAccountingAdjustmentDto } from './dto/om-accounting.dto';
import { OmAccountingPosting } from './entities/om-accounting-posting.entity';
import { OmChartOfAccount } from './entities/om-chart-of-account.entity';
import { OmConsumerBill } from './entities/om-consumer-bill.entity';
import { OmBillingPayment } from './entities/om-billing-payment.entity';
import { OmJournalEntry } from './entities/om-journal-entry.entity';
import { OmJournalLine } from './entities/om-journal-line.entity';
import { OmConsumer } from './entities/om-consumer.entity';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { OmDivisionScopeService } from './om-division-scope.service';

type AccountMapById = Record<string, OmChartOfAccount>;
type AccountMapByCode = Record<string, OmChartOfAccount>;

@Injectable()
export class OmAccountingService {
  constructor(
    @InjectRepository(OmChartOfAccount) private coaRepo: Repository<OmChartOfAccount>,
    @InjectRepository(OmJournalEntry) private entryRepo: Repository<OmJournalEntry>,
    @InjectRepository(OmJournalLine) private lineRepo: Repository<OmJournalLine>,
    @InjectRepository(OmAccountingPosting) private postingRepo: Repository<OmAccountingPosting>,
    @InjectRepository(OmConsumerBill) private billRepo: Repository<OmConsumerBill>,
    @InjectRepository(OmBillingPayment) private paymentRepo: Repository<OmBillingPayment>,
    @InjectRepository(OmConsumer) private consumerRepo: Repository<OmConsumer>,
    private config: ConfigService,
    private scope: OmDivisionScopeService,
  ) {}

  getCatalog() {
    return {
      autoPosting: OM_ACCOUNTING_AUTO_POSTING,
      reportTypes: OM_ACCOUNTING_REPORT_TYPES,
      erpSyncStatuses: OM_ERP_SYNC_STATUSES,
      erpIntegration: {
        mode: this.config.get('ERP_ACCOUNTING_MODE', 'internal'),
        endpoint: this.config.get('ERP_ACCOUNTING_URL', null),
        enabled: Boolean(this.config.get('ERP_ACCOUNTING_URL')),
      },
    };
  }

  async getSummary(user: JwtPayload, tenantId: string) {
    const demandQb = this.postingRepo
      .createQueryBuilder('p')
      .select('COALESCE(SUM(p.amount), 0)', 'total')
      .innerJoin(OmJournalLine, 'l', 'l.entry_id = p.journal_entry_id AND l.tenant_id = p.tenant_id')
      .where('p.tenant_id = :tenantId', { tenantId })
      .andWhere('p.posting_type = :type', { type: 'demand_ledger' });
    await this.scope.scopeProjectQb(demandQb, user, tenantId, 'l', null);

    const collectionQb = this.postingRepo
      .createQueryBuilder('p')
      .select('COALESCE(SUM(p.amount), 0)', 'total')
      .innerJoin(OmJournalLine, 'l', 'l.entry_id = p.journal_entry_id AND l.tenant_id = p.tenant_id')
      .where('p.tenant_id = :tenantId', { tenantId })
      .andWhere('p.posting_type = :type', { type: 'cash_bank_ledger' });
    await this.scope.scopeProjectQb(collectionQb, user, tenantId, 'l', null);

    const entriesPromise = (async () => {
      const qb = this.lineRepo.createQueryBuilder('l')
        .select('COUNT(DISTINCT l.entry_id)', 'cnt')
        .where('l.tenant_id = :tenantId', { tenantId });
      await this.scope.scopeProjectQb(qb, user, tenantId, 'l', null);
      const raw = await qb.getRawOne<{ cnt: string }>();
      return Number(raw?.cnt ?? 0);
    })();

    const [accounts, entries, postings, demandTotal, collectionTotal] = await Promise.all([
      this.coaRepo.count({ where: { tenantId, status: 'active' } }),
      entriesPromise,
      this.postingRepo.count({ where: { tenantId } }),
      demandQb.getRawOne<{ total: string }>(),
      collectionQb.getRawOne<{ total: string }>(),
    ]);

    return {
      chartAccounts: accounts,
      journalEntries: entries,
      autoPostings: postings,
      demandPosted: Number(demandTotal?.total ?? 0),
      collectionPosted: Number(collectionTotal?.total ?? 0),
      erpMode: this.config.get('ERP_ACCOUNTING_MODE', 'internal'),
    };
  }

  async listChartOfAccounts(tenantId: string) {
    await this.ensureDefaultAccounts(tenantId);
    const rows = await this.coaRepo.find({
      where: { tenantId, status: 'active' },
      order: { accountCode: 'ASC' },
    });
    return rows.map((r) => ({
      id: r.id,
      accountCode: r.accountCode,
      accountName: r.accountName,
      accountType: r.accountType,
      isCash: r.isCash,
      isBank: r.isBank,
      isSystem: r.isSystem,
    }));
  }

  async listPostings(user: JwtPayload, tenantId: string, filters: { sourceType?: string; limit?: number }) {
    const scopedQb = this.postingRepo.createQueryBuilder('p')
      .select('DISTINCT p.id', 'id')
      .where('p.tenant_id = :tenantId', { tenantId });
    if (filters.sourceType) {
      scopedQb.andWhere('p.source_type = :sourceType', { sourceType: filters.sourceType });
    }
    scopedQb.leftJoin(
      OmJournalLine,
      'l',
      'l.entry_id = p.journal_entry_id AND l.tenant_id = p.tenant_id',
    );
    await this.scope.scopeProjectQb(scopedQb, user, tenantId, 'l', null);

    const idRows = await scopedQb.getRawMany<{ id: string }>();
    const postingIds = idRows.map((row) => row.id);
    if (!postingIds.length) return [];

    const rows = await this.postingRepo.find({
      where: { tenantId, id: In(postingIds) },
      order: { createdAt: 'DESC' },
      take: filters.limit ?? 100,
    });

    return Promise.all(rows.map(async (p) => {
      const entry = p.journalEntryId
        ? await this.entryRepo.findOne({ where: { id: p.journalEntryId, tenantId } })
        : null;
      return {
        id: p.id,
        sourceType: p.sourceType,
        sourceId: p.sourceId,
        sourceRef: p.sourceRef,
        postingType: p.postingType,
        amount: Number(p.amount),
        erpStatus: p.erpStatus,
        erpReference: p.erpReference,
        entryNo: entry?.entryNo ?? null,
        createdAt: p.createdAt,
        details: p.details,
      };
    }));
  }

  async listJournalEntries(user: JwtPayload, tenantId: string, filters: { from?: string; to?: string; limit?: number }) {
    const scopedEntryIds = await this.lineRepo.createQueryBuilder('l')
      .select('DISTINCT l.entry_id', 'entryId')
      .where('l.tenant_id = :tenantId', { tenantId });
    await this.scope.scopeProjectQb(scopedEntryIds, user, tenantId, 'l', null);
    const idRows = await scopedEntryIds.getRawMany<{ entryId: string }>();
    const entryIds = idRows.map((r) => r.entryId);
    if (!entryIds.length) return [];

    const qb = this.entryRepo.createQueryBuilder('e')
      .where('e.tenant_id = :tenantId', { tenantId })
      .andWhere('e.id IN (:...entryIds)', { entryIds })
      .orderBy('e.entry_date', 'DESC')
      .addOrderBy('e.created_at', 'DESC')
      .take(filters.limit ?? 100);
    if (filters.from) qb.andWhere('e.entry_date >= :from', { from: filters.from });
    if (filters.to) qb.andWhere('e.entry_date <= :to', { to: filters.to });
    const entries = await qb.getMany();
    const accounts = await this.getAccountsById(tenantId);

    return Promise.all(entries.map(async (e) => {
      const lines = await this.lineRepo.find({ where: { tenantId, entryId: e.id }, order: { createdAt: 'ASC' } });
      return {
        id: e.id,
        entryNo: e.entryNo,
        entryDate: e.entryDate,
        sourceType: e.sourceType,
        sourceRef: e.sourceRef,
        narration: e.narration,
        status: e.status,
        lines: lines.map((l) => ({
          accountCode: accounts[l.accountId]?.accountCode ?? '',
          accountName: accounts[l.accountId]?.accountName ?? '',
          debit: Number(l.debit),
          credit: Number(l.credit),
          reference: l.reference,
        })),
        totalDebit: lines.reduce((s, l) => s + Number(l.debit), 0),
        totalCredit: lines.reduce((s, l) => s + Number(l.credit), 0),
        createdAt: e.createdAt,
      };
    }));
  }

  async postBillIssued(tenantId: string, userId: string | null, bill: OmConsumerBill) {
    const existing = await this.postingRepo.findOne({
      where: { tenantId, sourceType: 'billing', sourceId: bill.id, postingType: 'demand_ledger' },
    });
    if (existing) return existing;

    const accounts = await this.getAccountsByCode(tenantId);
    const amount = Number(bill.totalAmount);
    if (amount <= 0) return null;

    const entry = await this.createBalancedEntry(tenantId, userId, {
      entryDate: (bill.issuedAt ?? bill.createdAt).toISOString().slice(0, 10),
      sourceType: 'billing',
      sourceId: bill.id,
      sourceRef: bill.billNo,
      narration: `Bill issued ${bill.billNo} — demand ledger posting`,
      lines: [
        { account: accounts[DEFAULT_ACCOUNT_CODES.DEMAND_RECEIVABLE], debit: amount, credit: 0, consumerId: bill.consumerId, reference: bill.billNo },
        { account: accounts[DEFAULT_ACCOUNT_CODES.WATER_REVENUE], debit: 0, credit: amount, consumerId: bill.consumerId, reference: bill.billNo },
      ],
    });

    return this.savePosting(tenantId, {
      sourceType: 'billing',
      sourceId: bill.id,
      sourceRef: bill.billNo,
      journalEntryId: entry.id,
      postingType: 'demand_ledger',
      amount,
      details: { billNo: bill.billNo, autoPosting: 'Billing → Demand Ledger' },
    });
  }

  async postPaymentReceived(tenantId: string, userId: string | null, payment: OmBillingPayment) {
    const existing = await this.postingRepo.findOne({
      where: { tenantId, sourceType: 'collection', sourceId: payment.id, postingType: 'cash_bank_ledger' },
    });
    if (existing) return existing;

    const accounts = await this.getAccountsByCode(tenantId);
    const amount = Number(payment.amount);
    if (amount <= 0) return null;

    const cashAccount = CASH_PAYMENT_MODES.has(payment.paymentMode)
      ? accounts[DEFAULT_ACCOUNT_CODES.CASH]
      : accounts[DEFAULT_ACCOUNT_CODES.BANK];

    const entry = await this.createBalancedEntry(tenantId, userId, {
      entryDate: payment.paymentDate,
      sourceType: 'collection',
      sourceId: payment.id,
      sourceRef: payment.receiptNo,
      narration: `Collection ${payment.receiptNo} via ${payment.paymentMode}`,
      lines: [
        { account: cashAccount, debit: amount, credit: 0, consumerId: payment.consumerId, reference: payment.receiptNo },
        { account: accounts[DEFAULT_ACCOUNT_CODES.DEMAND_RECEIVABLE], debit: 0, credit: amount, consumerId: payment.consumerId, reference: payment.receiptNo },
      ],
    });

    return this.savePosting(tenantId, {
      sourceType: 'collection',
      sourceId: payment.id,
      sourceRef: payment.receiptNo,
      journalEntryId: entry.id,
      postingType: 'cash_bank_ledger',
      amount,
      details: { receiptNo: payment.receiptNo, paymentMode: payment.paymentMode, autoPosting: 'Collection → Cash/Bank Ledger' },
    });
  }

  async postBillWaived(tenantId: string, userId: string | null, bill: OmConsumerBill) {
    const existing = await this.postingRepo.findOne({
      where: { tenantId, sourceType: 'adjustment', sourceId: bill.id, postingType: 'journal_entry' },
    });
    if (existing) return existing;

    const accounts = await this.getAccountsByCode(tenantId);
    const amount = Number(bill.balanceAmount ?? bill.totalAmount);
    if (amount <= 0) return null;

    const entry = await this.createBalancedEntry(tenantId, userId, {
      entryDate: new Date().toISOString().slice(0, 10),
      sourceType: 'adjustment',
      sourceId: bill.id,
      sourceRef: bill.billNo,
      narration: `Bill waived ${bill.billNo}`,
      lines: [
        { account: accounts[DEFAULT_ACCOUNT_CODES.ADJUSTMENT], debit: amount, credit: 0, consumerId: bill.consumerId, reference: bill.billNo },
        { account: accounts[DEFAULT_ACCOUNT_CODES.DEMAND_RECEIVABLE], debit: 0, credit: amount, consumerId: bill.consumerId, reference: bill.billNo },
      ],
    });

    return this.savePosting(tenantId, {
      sourceType: 'adjustment',
      sourceId: bill.id,
      sourceRef: bill.billNo,
      journalEntryId: entry.id,
      postingType: 'journal_entry',
      amount,
      details: { billNo: bill.billNo, adjustmentType: 'waiver', autoPosting: 'Adjustment → Journal Entry' },
    });
  }

  async createManualAdjustment(user: JwtPayload, tenantId: string, userId: string, dto: CreateAccountingAdjustmentDto) {
    const consumer = await this.consumerRepo.findOne({ where: { id: dto.consumerId, tenantId } });
    if (!consumer) throw new NotFoundException('Consumer not found');
    await this.scope.assertProjectAccess(user, consumer.projectId, tenantId);

    let bill: OmConsumerBill | null = null;
    if (dto.billId) {
      bill = await this.billRepo.findOne({ where: { id: dto.billId, tenantId, consumerId: dto.consumerId } });
      if (!bill) throw new NotFoundException('Bill not found for consumer');
    }

    const accounts = await this.getAccountsByCode(tenantId);
    const ref = bill?.billNo ?? `ADJ-${consumer.consumerCode}`;
    const entry = await this.createBalancedEntry(tenantId, userId, {
      entryDate: dto.entryDate,
      sourceType: 'adjustment',
      sourceId: bill?.id ?? consumer.id,
      sourceRef: ref,
      narration: dto.narration ?? `Manual ${dto.adjustmentType ?? 'adjustment'} for ${consumer.consumerCode}`,
      lines: [
        { account: accounts[DEFAULT_ACCOUNT_CODES.ADJUSTMENT], debit: dto.amount, credit: 0, consumerId: consumer.id, reference: ref },
        { account: accounts[DEFAULT_ACCOUNT_CODES.DEMAND_RECEIVABLE], debit: 0, credit: dto.amount, consumerId: consumer.id, reference: ref },
      ],
    });

    const posting = await this.savePosting(tenantId, {
      sourceType: 'adjustment',
      sourceId: entry.id,
      sourceRef: entry.entryNo,
      journalEntryId: entry.id,
      postingType: 'journal_entry',
      amount: dto.amount,
      details: { adjustmentType: dto.adjustmentType ?? 'correction', consumerCode: consumer.consumerCode },
    });

    return { entry: await this.getJournalEntry(tenantId, entry.id), posting };
  }

  async generateReport(
    user: JwtPayload,
    tenantId: string,
    reportType: string,
    filters: { from?: string; to?: string; projectId?: string },
  ) {
    const def = OM_ACCOUNTING_REPORT_TYPES.find((r) => r.type === reportType);
    if (!def) throw new BadRequestException('Unsupported accounting report type');

    const resolvedProjectId = filters.projectId
      ? await this.scope.resolveProjectId(user, tenantId, filters.projectId)
      : null;
    const scopedFilters = { ...filters, projectId: resolvedProjectId ?? undefined };

    const meta = {
      reportType,
      title: def.label,
      generatedAt: new Date().toISOString(),
      period: scopedFilters,
    };

    switch (reportType) {
      case 'cash_book':
        return { ...meta, ...(await this.buildLedgerBook(user, tenantId, 'cash', scopedFilters)) };
      case 'bank_book':
        return { ...meta, ...(await this.buildLedgerBook(user, tenantId, 'bank', scopedFilters)) };
      case 'general_ledger':
        return { ...meta, ...(await this.buildGeneralLedger(user, tenantId, scopedFilters)) };
      case 'trial_balance':
        return { ...meta, ...(await this.buildTrialBalance(user, tenantId, scopedFilters)) };
      case 'income_statement':
        return { ...meta, ...(await this.buildIncomeStatement(user, tenantId, scopedFilters)) };
      case 'revenue_summary':
        return { ...meta, ...(await this.buildRevenueSummary(user, tenantId, scopedFilters)) };
      default:
        throw new BadRequestException('Unsupported accounting report type');
    }
  }

  private async buildLedgerBook(user: JwtPayload, tenantId: string, book: 'cash' | 'bank', filters: { from?: string; to?: string; projectId?: string }) {
    const accounts = await this.coaRepo.find({
      where: book === 'cash' ? { tenantId, isCash: true } : { tenantId, isBank: true },
    });
    const accountIds = accounts.map((a) => a.id);
    if (!accountIds.length) return { rows: [], summary: { opening: 0, closing: 0 } };

    const rows = await this.fetchLineRows(user, tenantId, accountIds, filters);
    const net = rows.reduce((s, r) => s + r.debit - r.credit, 0);
    return {
      book,
      accounts: accounts.map((a) => ({ code: a.accountCode, name: a.accountName })),
      rows,
      summary: { transactions: rows.length, netMovement: Math.round(net * 100) / 100 },
    };
  }

  private async buildGeneralLedger(user: JwtPayload, tenantId: string, filters: { from?: string; to?: string; projectId?: string }) {
    await this.ensureDefaultAccounts(tenantId);
    const accounts = await this.coaRepo.find({ where: { tenantId, status: 'active' }, order: { accountCode: 'ASC' } });
    const rows = await Promise.all(accounts.map(async (account) => {
      const lines = await this.fetchLineRows(user, tenantId, [account.id], filters);
      const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
      const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
      return {
        accountCode: account.accountCode,
        accountName: account.accountName,
        accountType: account.accountType,
        totalDebit: Math.round(totalDebit * 100) / 100,
        totalCredit: Math.round(totalCredit * 100) / 100,
        balance: Math.round((totalDebit - totalCredit) * 100) / 100,
        transactions: lines,
      };
    }));
    return { rows };
  }

  private async buildTrialBalance(user: JwtPayload, tenantId: string, filters: { from?: string; to?: string; projectId?: string }) {
    const gl = await this.buildGeneralLedger(user, tenantId, filters);
    const rows = gl.rows.map((r) => ({
      accountCode: r.accountCode,
      accountName: r.accountName,
      accountType: r.accountType,
      debit: r.balance > 0 ? r.balance : 0,
      credit: r.balance < 0 ? Math.abs(r.balance) : 0,
    }));
    const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
    const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
    return {
      rows,
      summary: {
        totalDebit: Math.round(totalDebit * 100) / 100,
        totalCredit: Math.round(totalCredit * 100) / 100,
        balanced: Math.abs(totalDebit - totalCredit) < 0.01,
      },
    };
  }

  private async buildIncomeStatement(user: JwtPayload, tenantId: string, filters: { from?: string; to?: string; projectId?: string }) {
    const gl = await this.buildGeneralLedger(user, tenantId, filters);
    const income = gl.rows.filter((r) => r.accountType === 'income');
    const expense = gl.rows.filter((r) => r.accountType === 'expense');
    const totalIncome = income.reduce((s, r) => s + (r.totalCredit - r.totalDebit), 0);
    const totalExpense = expense.reduce((s, r) => s + (r.totalDebit - r.totalCredit), 0);
    return {
      income: income.map((r) => ({ accountCode: r.accountCode, accountName: r.accountName, amount: r.totalCredit - r.totalDebit })),
      expense: expense.map((r) => ({ accountCode: r.accountCode, accountName: r.accountName, amount: r.totalDebit - r.totalCredit })),
      summary: {
        totalIncome: Math.round(totalIncome * 100) / 100,
        totalExpense: Math.round(totalExpense * 100) / 100,
        netSurplus: Math.round((totalIncome - totalExpense) * 100) / 100,
      },
    };
  }

  private async buildRevenueSummary(user: JwtPayload, tenantId: string, filters: { from?: string; to?: string; projectId?: string }) {
    const [demandPostings, collectionPostings, incomeStatement] = await Promise.all([
      this.postingRepo.createQueryBuilder('p')
        .where('p.tenant_id = :tenantId', { tenantId })
        .andWhere('p.posting_type = :type', { type: 'demand_ledger' })
        .getMany(),
      this.postingRepo.createQueryBuilder('p')
        .where('p.tenant_id = :tenantId', { tenantId })
        .andWhere('p.posting_type = :type', { type: 'cash_bank_ledger' })
        .getMany(),
      this.buildIncomeStatement(user, tenantId, filters),
    ]);

    return {
      billingPosted: demandPostings.reduce((s, p) => s + Number(p.amount), 0),
      collectionPosted: collectionPostings.reduce((s, p) => s + Number(p.amount), 0),
      collectionCount: collectionPostings.length,
      incomeStatement: incomeStatement.summary,
      rows: [
        { label: 'Demand Ledger (Billing)', amount: demandPostings.reduce((s, p) => s + Number(p.amount), 0) },
        { label: 'Cash/Bank Ledger (Collection)', amount: collectionPostings.reduce((s, p) => s + Number(p.amount), 0) },
        { label: 'Recognized Revenue (Income)', amount: incomeStatement.summary.totalIncome },
      ],
    };
  }

  private async fetchLineRows(
    user: JwtPayload,
    tenantId: string,
    accountIds: string[],
    filters: { from?: string; to?: string; projectId?: string },
  ) {
    const resolvedProjectId = filters.projectId
      ? await this.scope.resolveProjectId(user, tenantId, filters.projectId)
      : null;
    const qb = this.lineRepo.createQueryBuilder('l')
      .innerJoin(OmJournalEntry, 'e', 'e.id = l.entry_id')
      .where('l.tenant_id = :tenantId', { tenantId })
      .andWhere('l.account_id IN (:...accountIds)', { accountIds })
      .orderBy('e.entry_date', 'ASC')
      .addOrderBy('l.created_at', 'ASC');
    await this.scope.scopeProjectQb(qb, user, tenantId, 'l', resolvedProjectId);
    if (filters.from) qb.andWhere('e.entry_date >= :from', { from: filters.from });
    if (filters.to) qb.andWhere('e.entry_date <= :to', { to: filters.to });

    const lines = await qb.getMany();
    const entries = await this.entryRepo.find({ where: { tenantId } });
    const entryMap = new Map(entries.map((e) => [e.id, e]));
    const accountMap = await this.getAccountsById(tenantId);

    return lines.map((l) => {
      const entry = entryMap.get(l.entryId);
      const account = accountMap[l.accountId];
      return {
        entryDate: entry?.entryDate ?? '',
        entryNo: entry?.entryNo ?? '',
        sourceRef: entry?.sourceRef ?? '',
        narration: entry?.narration ?? '',
        accountCode: account?.accountCode ?? '',
        accountName: account?.accountName ?? '',
        debit: Number(l.debit),
        credit: Number(l.credit),
        reference: l.reference,
      };
    });
  }

  private async getJournalEntry(tenantId: string, id: string) {
    const entry = await this.entryRepo.findOne({ where: { id, tenantId } });
    if (!entry) throw new NotFoundException('Journal entry not found');
    const lines = await this.lineRepo.find({ where: { tenantId, entryId: id }, order: { createdAt: 'ASC' } });
    const accounts = await this.getAccountsById(tenantId);
    return {
      id: entry.id,
      entryNo: entry.entryNo,
      entryDate: entry.entryDate,
      sourceType: entry.sourceType,
      sourceRef: entry.sourceRef,
      narration: entry.narration,
      status: entry.status,
      lines: lines.map((l) => ({
        accountCode: accounts[l.accountId]?.accountCode ?? '',
        accountName: accounts[l.accountId]?.accountName ?? '',
        debit: Number(l.debit),
        credit: Number(l.credit),
        reference: l.reference,
      })),
      totalDebit: lines.reduce((s, l) => s + Number(l.debit), 0),
      totalCredit: lines.reduce((s, l) => s + Number(l.credit), 0),
      createdAt: entry.createdAt,
    };
  }

  private async createBalancedEntry(
    tenantId: string,
    userId: string | null,
    input: {
      entryDate: string;
      sourceType: string;
      sourceId: string;
      sourceRef: string;
      narration: string;
      lines: Array<{ account: OmChartOfAccount; debit: number; credit: number; consumerId?: string; reference?: string }>;
    },
  ) {
    const totalDebit = input.lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = input.lines.reduce((s, l) => s + l.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new BadRequestException('Journal entry is not balanced');
    }

    const count = await this.entryRepo.count({ where: { tenantId } });
    const entryNo = `JE-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;
    const entry = await this.entryRepo.save(this.entryRepo.create({
      tenantId,
      entryNo,
      entryDate: input.entryDate,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      sourceRef: input.sourceRef,
      narration: input.narration,
      status: 'posted',
      createdBy: userId,
    }));

    for (const line of input.lines) {
      await this.lineRepo.save(this.lineRepo.create({
        tenantId,
        entryId: entry.id,
        accountId: line.account.id,
        debit: line.debit,
        credit: line.credit,
        consumerId: line.consumerId ?? null,
        reference: line.reference ?? null,
      }));
    }

    return entry;
  }

  private async savePosting(tenantId: string, input: {
    sourceType: string;
    sourceId: string;
    sourceRef: string;
    journalEntryId: string;
    postingType: string;
    amount: number;
    details: Record<string, unknown>;
  }) {
    const erpUrl = this.config.get('ERP_ACCOUNTING_URL');
    const posting = await this.postingRepo.save(this.postingRepo.create({
      tenantId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      sourceRef: input.sourceRef,
      journalEntryId: input.journalEntryId,
      postingType: input.postingType,
      amount: input.amount,
      erpStatus: erpUrl ? 'pending' : 'posted',
      erpReference: erpUrl ? null : 'INTERNAL-GL',
      details: input.details,
    }));
    return posting;
  }

  private async getAccountsByCode(tenantId: string): Promise<AccountMapByCode> {
    await this.ensureDefaultAccounts(tenantId);
    const rows = await this.coaRepo.find({ where: { tenantId, status: 'active' } });
    const byCode: AccountMapByCode = {};
    for (const row of rows) byCode[row.accountCode] = row;
    return byCode;
  }

  private async getAccountsById(tenantId: string): Promise<AccountMapById> {
    await this.ensureDefaultAccounts(tenantId);
    const rows = await this.coaRepo.find({ where: { tenantId, status: 'active' } });
    const byId: AccountMapById = {};
    for (const row of rows) byId[row.id] = row;
    return byId;
  }

  private async ensureDefaultAccounts(tenantId: string) {
    const count = await this.coaRepo.count({ where: { tenantId } });
    if (count > 0) return;

    const defaults = [
      { accountCode: DEFAULT_ACCOUNT_CODES.DEMAND_RECEIVABLE, accountName: 'Demand / Receivable Ledger', accountType: 'asset', isCash: false, isBank: false },
      { accountCode: DEFAULT_ACCOUNT_CODES.CASH, accountName: 'Cash Ledger', accountType: 'asset', isCash: true, isBank: false },
      { accountCode: DEFAULT_ACCOUNT_CODES.BANK, accountName: 'Bank Ledger', accountType: 'asset', isCash: false, isBank: true },
      { accountCode: DEFAULT_ACCOUNT_CODES.WATER_REVENUE, accountName: 'Water Supply Revenue', accountType: 'income', isCash: false, isBank: false },
      { accountCode: DEFAULT_ACCOUNT_CODES.ADJUSTMENT, accountName: 'Billing Adjustments / Write-off', accountType: 'expense', isCash: false, isBank: false },
    ];

    for (const d of defaults) {
      await this.coaRepo.save(this.coaRepo.create({ tenantId, ...d, isSystem: true, status: 'active' }));
    }
  }
}
