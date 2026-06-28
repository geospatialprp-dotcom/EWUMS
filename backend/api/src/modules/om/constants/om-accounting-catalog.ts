export type OmAccountingSourceType = 'billing' | 'collection' | 'adjustment';
export type OmAccountingPostingType = 'demand_ledger' | 'cash_bank_ledger' | 'journal_entry';
export type OmAccountType = 'asset' | 'liability' | 'income' | 'expense';

export const OM_ACCOUNTING_AUTO_POSTING = [
  { code: 'billing', label: 'Billing → Demand Ledger', description: 'Bill issued: DR Demand/Receivable, CR Water Revenue' },
  { code: 'collection', label: 'Collection → Cash/Bank Ledger', description: 'Payment received: DR Cash/Bank, CR Demand/Receivable' },
  { code: 'adjustment', label: 'Adjustment → Journal Entries', description: 'Waivers and manual adjustments posted as journal entries' },
] as const;

export const OM_ACCOUNTING_REPORT_TYPES = [
  { type: 'cash_book', label: 'Cash Book' },
  { type: 'bank_book', label: 'Bank Book' },
  { type: 'general_ledger', label: 'General Ledger' },
  { type: 'trial_balance', label: 'Trial Balance' },
  { type: 'income_statement', label: 'Income Statement' },
  { type: 'revenue_summary', label: 'Revenue Summary' },
] as const;

export const OM_ERP_SYNC_STATUSES = [
  { code: 'posted', label: 'Posted (Internal GL)' },
  { code: 'pending', label: 'Pending ERP Sync' },
  { code: 'synced', label: 'Synced to ERP' },
  { code: 'failed', label: 'ERP Sync Failed' },
] as const;

export const DEFAULT_ACCOUNT_CODES = {
  DEMAND_RECEIVABLE: '1100',
  CASH: '1110',
  BANK: '1120',
  WATER_REVENUE: '4100',
  ADJUSTMENT: '5100',
} as const;

export const CASH_PAYMENT_MODES = new Set(['cash', 'pos', 'csc']);
