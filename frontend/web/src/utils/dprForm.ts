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
  boqSource?: string;
  boqSourceLabel?: string;
  itemCode?: string;
  yesterdaysProgress: number;
  yesterdaysProgressLabel: 'pct' | 'qty';
  executionStatus: string;
  expectedCompletionDate: string | null;
  measurementMode: 'discrete_qty' | 'whole_job';
  scopeContributionQty?: number;
  scopeContributionPct?: number;
  scopeBalanceQty?: number;
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
): {
  boqPctToday: number;
  jobPctToday: number | null;
  locationComplete: boolean;
  /** @deprecated use jobPctToday */
  locationPctToday: number | null;
} {
  const boqSanctioned = Number(hint?.sanctionedQty ?? 0);
  const scopeSanctioned = Number(hint?.scopeSanctionedQty ?? boqSanctioned);
  const scopeDone = Number(hint?.scopeContributionQty ?? 0);
  const scopeBalance = Math.max(0, scopeSanctioned - scopeDone);
  const split = scopeSanctioned > 0 && scopeSanctioned < boqSanctioned - 0.0005;
  const jobPctToday = split ? pctFromQty(qty, scopeSanctioned) : null;
  const boqPctToday = pctFromQty(qty, boqSanctioned);
  const locationComplete = scopeSanctioned > 0 && qty >= scopeBalance - 0.0005 && qty > 0;
  return { boqPctToday, jobPctToday, locationPctToday: jobPctToday, locationComplete };
}

export type PlannedActualRow = {
  label: string;
  planned: number;
  actual: number;
  remaining: number;
  pctDone: number;
  unit: string;
};

/** Planned vs actual rows for DPR form (scheme + per-job when split). */
export function buildPlannedActualRows(
  hint: DprProgressSummary,
  todayQty: number,
  unit: string,
): PlannedActualRow[] {
  const u = unit || '—';
  const schemePlanned = Number(hint.sanctionedQty ?? 0);
  const schemeActual = Number(hint.cumulativeQty ?? 0);
  const schemeRemaining = Number(hint.balanceQty ?? Math.max(0, schemePlanned - schemeActual));
  const rows: PlannedActualRow[] = [{
    label: hint.boqSourceLabel ? `Scheme (${hint.boqSourceLabel})` : 'Scheme (BOQ line)',
    planned: schemePlanned,
    actual: schemeActual,
    remaining: schemeRemaining,
    pctDone: Number(hint.cumulativePct ?? 0),
    unit: u,
  }];

  const jobPlanned = Number(hint.scopeSanctionedQty ?? 0);
  const jobActual = Number(hint.scopeContributionQty ?? 0);
  const jobRemaining = Number(hint.scopeBalanceQty ?? Math.max(0, jobPlanned - jobActual));
  const splitJob = jobPlanned > 0 && jobPlanned < schemePlanned - 0.0005;
  if (splitJob) {
    rows.push({
      label: 'This Job (work package)',
      planned: jobPlanned,
      actual: jobActual,
      remaining: jobRemaining,
      pctDone: Number(hint.scopeContributionPct ?? 0),
      unit: u,
    });
  }

  if (todayQty > 0) {
    rows.push({
      label: 'After today (scheme)',
      planned: schemePlanned,
      actual: schemeActual + todayQty,
      remaining: Math.max(0, schemeRemaining - todayQty),
      pctDone: schemePlanned > 0
        ? pctFromQty(schemeActual + todayQty, schemePlanned)
        : 0,
      unit: u,
    });
    if (splitJob) {
      rows.push({
        label: 'After today (this Job)',
        planned: jobPlanned,
        actual: jobActual + todayQty,
        remaining: Math.max(0, jobRemaining - todayQty),
        pctDone: pctFromQty(jobActual + todayQty, jobPlanned),
        unit: u,
      });
    }
  }

  return rows;
}

/** Billing-focused qty breakdown for list / MB / RA reference. */
export type DprActivityBilling = {
  unit: string;
  todayQty: number;
  cumQty: number;
  plannedQty: number | null;
  remainingQty: number | null;
  todayPct: number | null;
  cumPct: number | null;
};

export function parseDprActivityBilling(
  act: Record<string, unknown> | null | undefined,
  plannedQty?: number | null,
): DprActivityBilling {
  if (!act) {
    return {
      unit: '—', todayQty: 0, cumQty: 0, plannedQty: null, remainingQty: null,
      todayPct: null, cumPct: null,
    };
  }
  const unit = String(act.unit ?? '').trim() || '—';
  const todayQty = Number(act.quantityDone ?? 0);
  const cumQty = Number(act.cumulativeQty ?? todayQty);
  const planned = plannedQty != null && plannedQty > 0 ? plannedQty : null;
  const remainingQty = planned != null ? Math.max(0, planned - cumQty) : null;
  const todayPct = act.progressPctToday != null ? Number(act.progressPctToday) : null;
  const cumPct = act.cumulativeProgressPct != null ? Number(act.cumulativeProgressPct) : null;
  return {
    unit, todayQty, cumQty, plannedQty: planned, remainingQty, todayPct, cumPct,
  };
}

/** Today + cumulative progress with qty and % (all BOQ items). */
export function formatDprActivityProgress(act: Record<string, unknown>): string {
  const b = parseDprActivityBilling(act);
  const qtyLabel = (q: number) => `${formatProgressQty(q)} ${b.unit}`;
  const today = b.todayPct != null
    ? `Today ${qtyLabel(b.todayQty)} (${formatProgressQty(b.todayPct)}%)`
    : `Today ${qtyLabel(b.todayQty)}`;
  const cum = b.cumPct != null
    ? `Cum ${qtyLabel(b.cumQty)} (${formatProgressQty(b.cumPct)}%)`
    : `Cum ${qtyLabel(b.cumQty)}`;
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

export function dprActivitySummary(
  dpr: Record<string, unknown>,
  plannedQty?: number | null,
): {
  workItem: string;
  billing: DprActivityBilling;
  chainage: string;
  location: string;
  progress: string;
} {
  const activities = (dpr.activities as Array<Record<string, unknown>>) ?? [];
  const first = activities[0];
  const workItem = first
    ? String(first.description ?? '—')
    : '—';
  const billing = parseDprActivityBilling(first, plannedQty);
  const progress = first ? formatDprActivityProgress(first) : '—';
  const chainage = first
    ? [first.chainageFrom, first.chainageTo].filter(Boolean).join(' → ') || '—'
    : '—';
  const location = String(dpr.workSite ?? first?.siteDetail ?? '—');
  return { workItem, billing, chainage, location, progress };
}
