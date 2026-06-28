export interface BoqReconRow {
  id: string;
  itemCode: string;
  description: string;
  component: string;
  unit: string;
  contractQty: number;
  revisedQty: number;
  dprQty: number;
  executedQty: number;
  mbQty: number;
  remainingQty: number;
  pendingMeasurementQty: number;
  savingsQty: number;
  mbVariance: number;
  dprMbDeviation: number;
  varianceType: 'excess' | 'savings' | 'pending' | 'none';
  deviationType: 'mb_higher' | 'dpr_higher' | 'none';
  rate: number;
  contractAmount?: number;
  effectiveRate?: number;
  contractValue: number;
  revisedValue: number;
  executedValue: number;
  mbValue: number;
  remainingValue: number;
  pendingMeasurementValue?: number;
  savingsValue?: number;
}

export interface BoqReconTotals {
  contractQty: number;
  revisedQty: number;
  dprQty: number;
  executedQty: number;
  mbQty: number;
  remainingQty: number;
  contractValue: number;
  revisedValue: number;
  executedValue: number;
  mbValue: number;
  remainingValue: number;
  pendingMeasurementQty: number;
  pendingMeasurementValue: number;
  excessQty: number;
  savingsQty: number;
  savingsValue: number;
  deviationQty: number;
}

export interface BoqReconReports {
  quantityVarianceReport: Array<Record<string, unknown>>;
  excessQuantityReport: Array<Record<string, unknown>>;
  savingsReport: Array<Record<string, unknown>>;
  pendingMeasurementReport: Array<Record<string, unknown>>;
  deviationStatement: Array<Record<string, unknown>>;
}

export interface BoqReconciliationData {
  boqSource?: string;
  boqSourceLabel?: string;
  rows: BoqReconRow[];
  totals: BoqReconTotals;
  reports: BoqReconReports;
}

export type ReconReportTab = 'comparison' | 'variance' | 'excess' | 'savings' | 'pending' | 'deviation';

export function parseBoqReconciliation(data: Record<string, unknown> | null): BoqReconciliationData {
  const rows = (data?.rows ?? []) as BoqReconRow[];
  const totals = (data?.totals ?? {}) as BoqReconTotals;
  const reports = (data?.reports ?? {
    quantityVarianceReport: [],
    excessQuantityReport: [],
    savingsReport: [],
    pendingMeasurementReport: [],
    deviationStatement: [],
  }) as BoqReconReports;
  return {
    boqSource: String(data?.boqSource ?? 'government'),
    boqSourceLabel: String(data?.boqSourceLabel ?? 'Original / Tender BOQ'),
    rows,
    totals,
    reports,
  };
}

export function formatQty(n: number, decimals = 3): string {
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: decimals });
}

export function formatCurrency(n: number): string {
  return `₹${Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function exportReconCsv(filename: string, headers: string[], rows: string[][]) {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
