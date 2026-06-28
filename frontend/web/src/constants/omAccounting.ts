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

export const OM_ACCOUNTING_ADJUSTMENT_TYPES = [
  { code: 'write_off', label: 'Write-off' },
  { code: 'correction', label: 'Correction' },
  { code: 'waiver', label: 'Waiver' },
] as const;

export function accountingPostingLabel(type: string): string {
  const map: Record<string, string> = {
    demand_ledger: 'Demand Ledger',
    cash_bank_ledger: 'Cash/Bank Ledger',
    journal_entry: 'Journal Entry',
  };
  return map[type] ?? type;
}

export function erpStatusColor(status: string): 'success' | 'warning' | 'error' | 'default' {
  if (status === 'posted' || status === 'synced') return 'success';
  if (status === 'pending') return 'warning';
  if (status === 'failed') return 'error';
  return 'default';
}
