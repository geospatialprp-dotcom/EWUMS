import type { ProjectComponent } from '../constants/construction';
import type { SchemeType } from '../services/api';

export type DprActivityRow = {
  key: string;
  description: string;
  unit: string;
  quantityDone: number;
  progressMode: 'discrete_qty' | 'whole_job' | '';
  progressPctToday: number;
  workDoneToday: string;
  boqItemId: string;
  component: ProjectComponent | '';
  chainageFrom: string;
  chainageTo: string;
  latitude: string;
  longitude: string;
  locationDetail: string;
  materialConsumption: string;
  labourCount: number;
  equipmentDetails: string;
};

export type DprHeaderForm = {
  dprNumber: string;
  reportDate: string;
  schemeType: SchemeType;
  workLocation: string;
  weather: string;
  manpowerCount: number;
  contractorName: string;
  supervisorName: string;
  workPackageId: string;
  remarks: string;
};

export type DprProgressSummary = {
  cumulativePct: number;
  balancePct: number;
  cumulativeQty: number;
  balanceQty: number;
  sanctionedQty?: number;
  scopeSanctionedQty?: number;
  scopeBalancePct?: number;
  yesterdaysProgress: number;
  yesterdaysProgressLabel: 'pct' | 'qty';
  executionStatus: string;
  expectedCompletionDate: string | null;
  measurementMode: 'discrete_qty' | 'whole_job';
  scopeContributionQty?: number;
  scopeContributionPct?: number;
  chainageFrom?: string | null;
  chainageTo?: string | null;
};

const WHOLE_JOB_UNIT = /^(job|jobs|ls|l\.s\.|item|lump\s*sum)$/i;

export function isWholeJobMeasurement(mode?: string | null, unit?: string | null): boolean {
  if (mode === 'whole_job') return true;
  if (mode === 'discrete_qty') return false;
  const normalized = String(unit ?? '').trim();
  return WHOLE_JOB_UNIT.test(normalized) || /\bjob\b/i.test(normalized);
}

let dprRowCounter = 0;

export function emptyDprActivityRow(): DprActivityRow {
  dprRowCounter += 1;
  return {
    key: `dpr-row-${Date.now()}-${dprRowCounter}`,
    description: '',
    unit: '',
    quantityDone: 0,
    progressMode: '',
    progressPctToday: 0,
    workDoneToday: '',
    boqItemId: '',
    component: '',
    chainageFrom: '',
    chainageTo: '',
    latitude: '',
    longitude: '',
    locationDetail: '',
    materialConsumption: '',
    labourCount: 0,
    equipmentDetails: '',
  };
}

export function defaultDprHeader(): DprHeaderForm {
  return {
    dprNumber: '',
    reportDate: new Date().toISOString().slice(0, 10),
    schemeType: 'gravity',
    workLocation: '',
    weather: 'Clear',
    manpowerCount: 0,
    contractorName: '',
    supervisorName: '',
    workPackageId: '',
    remarks: '',
  };
}

export function formatProgressQty(value: number): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  const rounded = Math.round(n * 1000) / 1000;
  return String(rounded);
}

/** % of sanctioned BOQ qty — read-only after qty is selected. */
export function pctFromQty(qty: number, sanctionedQty: number): number {
  if (sanctionedQty <= 0) return 0;
  return Math.min(100, Math.round((qty / sanctionedQty) * 10000) / 100);
}

/** Qty choices for Job / whole-job items (e.g. 0, 0.1 … 1 Job up to location balance). */
export function wholeJobQtySelectOptions(maxQty: number): number[] {
  const cap = Math.round(Math.max(0, maxQty) * 1000) / 1000;
  if (cap <= 0) return [0];
  if (cap <= 1) {
    const opts = new Set<number>([0]);
    for (let i = 1; i <= 10; i += 1) {
      opts.add(Math.round((cap * i / 10) * 1000) / 1000);
    }
    return [...opts].sort((a, b) => a - b);
  }
  const opts = new Set<number>([0, cap]);
  const step = Math.max(0.1, Math.round((cap / 10) * 1000) / 1000);
  for (let q = step; q < cap; q += step) {
    opts.add(Math.round(q * 1000) / 1000);
  }
  return [...opts].sort((a, b) => a - b);
}

export function frozenProgressFromRow(
  qty: number,
  hint?: DprProgressSummary | null,
): { boqPctToday: number; locationPctToday: number | null; locationComplete: boolean } {
  const boqSanctioned = Number(hint?.sanctionedQty ?? 0);
  const scopeSanctioned = Number(hint?.scopeSanctionedQty ?? boqSanctioned);
  const scopeDone = Number(hint?.scopeContributionQty ?? 0);
  const scopeBalance = Math.max(0, scopeSanctioned - scopeDone);
  const boqPctToday = pctFromQty(qty, boqSanctioned);
  const split = scopeSanctioned > 0 && scopeSanctioned < boqSanctioned - 0.0005;
  const locationPctToday = split ? pctFromQty(qty, scopeSanctioned) : null;
  const locationComplete = scopeSanctioned > 0 && qty >= scopeBalance - 0.0005 && qty > 0;
  return { boqPctToday, locationPctToday, locationComplete };
}

/** Today + cumulative progress with qty and % (all BOQ items). */
export function formatDprActivityProgress(act: Record<string, unknown>): string {
  const unit = String(act.unit ?? '').trim();
  const todayQty = Number(act.quantityDone ?? 0);
  const cumQty = Number(act.cumulativeQty ?? todayQty);
  const todayPct = act.progressPctToday != null ? Number(act.progressPctToday) : null;
  const cumPct = act.cumulativeProgressPct != null ? Number(act.cumulativeProgressPct) : null;

  const qtyLabel = (q: number) => `${formatProgressQty(q)}${unit ? ` ${unit}` : ''}`;
  const pctLabel = (p: number | null) => (p != null && Number.isFinite(p) ? `${formatProgressQty(p)}%` : null);

  const todayPctStr = pctLabel(todayPct);
  const today = todayPctStr != null
    ? `Today ${qtyLabel(todayQty)} (${todayPctStr})`
    : `Today ${qtyLabel(todayQty)}`;

  const cumPctStr = pctLabel(cumPct);
  const cum = cumPctStr != null
    ? `Cum ${qtyLabel(cumQty)} (${cumPctStr})`
    : `Cum ${qtyLabel(cumQty)}`;

  return `${today} · ${cum}`;
}

export function buildDprPayload(header: DprHeaderForm, activities: DprActivityRow[]) {
  return {
    dprNumber: header.dprNumber,
    reportDate: header.reportDate,
    schemeType: header.schemeType,
    workLocation: header.workLocation || undefined,
    weather: header.weather || undefined,
    manpowerCount: Number(header.manpowerCount) || 0,
    contractorName: header.contractorName || undefined,
    supervisorName: header.supervisorName || undefined,
    workPackageId: header.workPackageId || undefined,
    remarks: header.remarks || undefined,
    activities: activities
      .filter((row) => row.description.trim())
      .map((row) => {
        const wholeJob = isWholeJobMeasurement(row.progressMode, row.unit);
        return {
          description: row.description.trim(),
          unit: row.unit,
          progressMode: wholeJob ? 'whole_job' as const : 'discrete_qty' as const,
          workDoneToday: row.workDoneToday.trim() || row.description.trim(),
          quantityDone: Number(row.quantityDone) || 0,
          progressPctToday: row.progressPctToday > 0 ? row.progressPctToday : undefined,
          boqItemId: row.boqItemId || undefined,
          component: row.component || undefined,
          chainageFrom: row.chainageFrom || undefined,
          chainageTo: row.chainageTo || undefined,
          latitude: row.latitude ? Number(row.latitude) : undefined,
          longitude: row.longitude ? Number(row.longitude) : undefined,
          locationDetail: row.locationDetail || undefined,
          materialConsumption: row.materialConsumption || undefined,
          labourCount: Number(row.labourCount) || 0,
          equipmentDetails: row.equipmentDetails || undefined,
        };
      }),
  };
}

export function dprActivitySummary(dpr: Record<string, unknown>): {
  workItem: string;
  qty: string;
  chainage: string;
  location: string;
  progress: string;
} {
  const activities = (dpr.activities as Array<Record<string, unknown>>) ?? [];
  const first = activities[0];
  const workItem = first
    ? String(first.description ?? '—')
    : '—';
  const progress = first ? formatDprActivityProgress(first) : '—';
  const chainage = first
    ? [first.chainageFrom, first.chainageTo].filter(Boolean).join(' → ') || '—'
    : '—';
  const location = String(dpr.workSite ?? first?.siteDetail ?? '—');
  return { workItem, qty: progress, chainage, location, progress };
}
