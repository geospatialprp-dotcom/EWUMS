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
  const normalized = String(unit ?? '').trim();
  if (WHOLE_JOB_UNIT.test(normalized) || /\bjob\b/i.test(normalized)) return true;
  if (mode === 'whole_job') return true;
  if (mode === 'discrete_qty') return false;
  return false;
}

/** Max Job qty selectable today for a whole-job BOQ line (scope balance). */
export function wholeJobScopeBalanceQty(
  hint: DprProgressSummary | null | undefined,
  boqRef: Record<string, unknown> | null | undefined,
  matchingWorkPackageCount = 1,
): number {
  if (hint) {
    const scopeCap = Number(hint.scopeSanctionedQty ?? hint.sanctionedQty ?? 0);
    const scopeDone = Number(hint.scopeContributionQty ?? 0);
    return Math.max(0, scopeCap - scopeDone);
  }
  const sanctioned = Number(boqRef?.revisedQty ?? boqRef?.contractQty ?? 0);
  const done = Number(boqRef?.dprQty ?? 0);
  const matchingWp = Math.max(1, matchingWorkPackageCount);
  const wholeJob = isWholeJobMeasurement(String(boqRef?.measurementMode ?? ''), String(boqRef?.unit ?? ''));
  const scopeSanctioned = wholeJob && matchingWp >= 2 && sanctioned >= matchingWp
    ? sanctioned / matchingWp
    : sanctioned;
  const scopeDone = wholeJob ? 0 : done;
  const scopeBal = Math.max(0, scopeSanctioned - scopeDone);
  if (wholeJob) return scopeBal;
  return Math.max(0, sanctioned - done);
}

/** Client-side planned vs actual when progress API is slow or unavailable. */
export function fallbackDprProgressSummaryFromBoq(
  boqRef: Record<string, unknown>,
  matchingWorkPackageCount = 1,
): DprProgressSummary {
  const unit = String(boqRef.unit ?? '');
  const mode = isWholeJobMeasurement(String(boqRef.measurementMode ?? ''), unit) ? 'whole_job' : 'discrete_qty';
  const sanctioned = Number(boqRef.revisedQty ?? boqRef.contractQty ?? 0);
  const cumulativeQty = Number(boqRef.dprQty ?? 0);
  const cumulativePct = sanctioned > 0 ? pctFromQty(cumulativeQty, sanctioned) : 0;
  const balanceQty = Math.max(0, sanctioned - cumulativeQty);
  const wpCount = Math.max(1, matchingWorkPackageCount);
  const scopeSanctioned = mode === 'whole_job' && wpCount >= 2 && sanctioned >= wpCount
    ? sanctioned / wpCount
    : sanctioned;
  const scopeContributionQty = mode === 'whole_job' ? 0 : cumulativeQty;
  const scopeBalanceQty = Math.max(0, scopeSanctioned - scopeContributionQty);

  return {
    cumulativePct,
    balancePct: Math.max(0, 100 - cumulativePct),
    cumulativeQty,
    balanceQty,
    sanctionedQty: sanctioned,
    scopeSanctionedQty: mode === 'whole_job' ? scopeSanctioned : undefined,
    scopeContributionQty: mode === 'whole_job' ? scopeContributionQty : undefined,
    scopeContributionPct: mode === 'whole_job' && scopeSanctioned > 0
      ? pctFromQty(scopeContributionQty, scopeSanctioned)
      : undefined,
    scopeBalanceQty: mode === 'whole_job' ? scopeBalanceQty : undefined,
    scopeBalancePct: mode === 'whole_job' && scopeSanctioned > 0
      ? Math.max(0, 100 - pctFromQty(scopeContributionQty, scopeSanctioned))
      : undefined,
    boqSourceLabel: 'L1 Contractor BOQ',
    itemCode: String(boqRef.itemCode ?? ''),
    yesterdaysProgress: 0,
    yesterdaysProgressLabel: 'qty',
    executionStatus: String(boqRef.dprExecutionStatus ?? 'not_started'),
    expectedCompletionDate: null,
    measurementMode: mode,
  };
}

export function resolveDprProgressHint(
  apiHint: DprProgressSummary | undefined,
  boqRef: Record<string, unknown> | null | undefined,
  matchingWorkPackageCount = 1,
): DprProgressSummary | null {
  if (apiHint) return apiHint;
  if (boqRef) return fallbackDprProgressSummaryFromBoq(boqRef, matchingWorkPackageCount);
  return null;
}

export function matchingWorkPackageCount(
  workPackages: Array<Record<string, unknown>>,
  component: string,
): number {
  const comp = component.trim();
  if (!comp) return 1;
  const count = workPackages.filter((w) => String(w.component ?? '') === comp).length;
  return count > 0 ? count : 1;
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
  /** Work done on prior approved DPRs (BOQ cumulative before this report). */
  previousQty: number;
  todayQty: number;
  /** previousQty + todayQty */
  cumQty: number;
  plannedQty: number | null;
  remainingQty: number | null;
  todayPct: number | null;
  cumPct: number | null;
};

export function parseDprActivityBilling(
  act: Record<string, unknown> | null | undefined,
  plannedQty?: number | null,
  boqCumulativeQty?: number | null,
): DprActivityBilling {
  if (!act) {
    return {
      unit: '—', previousQty: 0, todayQty: 0, cumQty: 0, plannedQty: null, remainingQty: null,
      todayPct: null, cumPct: null,
    };
  }
  const unit = String(act.unit ?? '').trim() || '—';
  const todayQty = Number(act.quantityDone ?? 0);
  const storedCum = act.cumulativeQty != null ? Number(act.cumulativeQty) : null;
  const boqApprovedCum = boqCumulativeQty != null
    ? Number(boqCumulativeQty)
    : (act.boqCumulativeQty != null ? Number(act.boqCumulativeQty) : null);

  let previousQty = 0;
  if (storedCum != null && Number.isFinite(storedCum)) {
    previousQty = Math.max(0, storedCum - todayQty);
  } else if (boqApprovedCum != null && Number.isFinite(boqApprovedCum)) {
    previousQty = Math.max(0, boqApprovedCum);
  }

  const cumQty = previousQty + todayQty;
  const planned = plannedQty != null && plannedQty > 0 ? plannedQty : null;
  const remainingQty = planned != null ? Math.max(0, planned - cumQty) : null;
  const cumPctStored = act.cumulativeProgressPct != null ? Number(act.cumulativeProgressPct) : null;
  const cumPct = planned != null && planned > 0
    ? pctFromQty(cumQty, planned)
    : cumPctStored;
  const todayPctStored = act.progressPctToday != null ? Number(act.progressPctToday) : null;
  const todayPct = planned != null && planned > 0 && todayQty > 0
    ? pctFromQty(todayQty, planned)
    : todayPctStored;
  return {
    unit, previousQty, todayQty, cumQty, plannedQty: planned, remainingQty, todayPct, cumPct,
  };
}

/** Today + cumulative progress with qty and % (all BOQ items). */
export function formatDprActivityProgress(
  act: Record<string, unknown>,
  plannedQty?: number | null,
  boqCumulativeQty?: number | null,
): string {
  const b = parseDprActivityBilling(act, plannedQty, boqCumulativeQty);
  const qtyLabel = (q: number) => `${formatProgressQty(q)} ${b.unit}`;
  const prev = b.previousQty > 0
    ? `Previous ${qtyLabel(b.previousQty)}`
    : 'Previous 0';
  const today = b.todayPct != null
    ? `Today ${qtyLabel(b.todayQty)} (${formatProgressQty(b.todayPct)}%)`
    : `Today ${qtyLabel(b.todayQty)}`;
  const cum = b.cumPct != null
    ? `Total ${qtyLabel(b.cumQty)} (${formatProgressQty(b.cumPct)}%)`
    : `Total ${qtyLabel(b.cumQty)}`;
  return `${prev} · ${today} · ${cum}`;
}

export function findL1BoqForComponent(
  l1Boq: Array<Record<string, unknown>>,
  component: string,
  schemeType?: string,
): Array<Record<string, unknown>> {
  let items = l1Boq;
  if (schemeType) {
    items = items.filter((b) => !b.schemeType || String(b.schemeType) === schemeType);
  }
  const comp = component.trim();
  if (comp) {
    items = items.filter((b) => !b.component || String(b.component) === comp);
  }
  return items;
}

export function dprActivityDescriptionFromBoq(
  row: Pick<DprActivityRow, 'description' | 'boqItemId'>,
  boqRef?: Record<string, unknown> | null,
): string {
  if (boqRef) return String(boqRef.description ?? '').trim();
  return String(row.description ?? '').trim();
}

export function activityRowFromBoqAndWp(
  boq: Record<string, unknown>,
  wp: Record<string, unknown>,
): DprActivityRow {
  const wholeJob = isWholeJobMeasurement(
    String(boq.measurementMode ?? ''),
    String(boq.unit ?? ''),
  );
  return {
    ...emptyDprActivityRow(),
    boqItemId: String(boq.id),
    description: String(boq.description ?? ''),
    unit: String(boq.unit ?? ''),
    component: (String(wp.component ?? '') as ProjectComponent),
    chainageFrom: String(wp.chainageFrom ?? ''),
    chainageTo: String(wp.chainageTo ?? ''),
    progressMode: wholeJob ? 'whole_job' : 'discrete_qty',
    workDoneToday: String(boq.description ?? ''),
    quantityDone: 0,
    progressPctToday: 0,
  };
}

/** Prefill with first matching L1 BOQ line (new DPR / WP change). */
export function prefillDprActivitiesFromWp(
  wp: Record<string, unknown>,
  l1Boq: Array<Record<string, unknown>>,
  schemeType: string,
): DprActivityRow[] {
  const matches = findL1BoqForComponent(l1Boq, String(wp.component ?? ''), schemeType);
  const items = matches.length
    ? matches
    : l1Boq.filter((b) => !b.schemeType || String(b.schemeType) === schemeType);
  if (!items.length) return [emptyDprActivityRow()];
  return [activityRowFromBoqAndWp(items[0], wp)];
}

export function buildDprPayload(
  header: DprHeaderForm,
  activities: DprActivityRow[],
  l1Boq: Array<Record<string, unknown>> = [],
  fallbackBoq: Array<Record<string, unknown>> = [],
) {
  const wpId = header.workPackageId?.trim();
  return {
    dprNumber: header.dprNumber.trim(),
    reportDate: header.reportDate,
    schemeType: header.schemeType,
    workLocation: header.workLocation?.trim() || undefined,
    weather: header.weather?.trim() || undefined,
    manpowerCount: Number(header.manpowerCount) || 0,
    contractorName: header.contractorName?.trim() || undefined,
    supervisorName: header.supervisorName?.trim() || undefined,
    workPackageId: wpId || undefined,
    remarks: header.remarks || undefined,
    activities: activities
      .filter((row) => row.boqItemId || row.description.trim())
      .slice(0, 1)
      .map((row) => {
        const wholeJob = isWholeJobMeasurement(row.progressMode, row.unit);
        const boqLine = row.boqItemId
          ? resolveL1BoqItem(row.boqItemId, '', l1Boq, fallbackBoq)
          : undefined;
        const description = boqLine
          ? String(boqLine.description ?? '').trim()
          : row.description.trim();
        const unit = row.unit?.trim() || (boqLine ? String(boqLine.unit ?? '') : '');
        return {
          description: description || 'Work item',
          activityCode: boqLine ? String(boqLine.itemCode ?? '') || undefined : undefined,
          unit: unit || 'nos',
          progressMode: wholeJob ? 'whole_job' as const : 'discrete_qty' as const,
          workDoneToday: row.workDoneToday.trim() || description,
          quantityDone: Number(row.quantityDone) || 0,
          progressPctToday: row.progressPctToday > 0 ? row.progressPctToday : undefined,
          boqItemId: boqLine ? String(boqLine.id) : (row.boqItemId || undefined),
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

export function resolveL1BoqItem(
  boqItemId: string | null | undefined,
  activityCode: string | null | undefined,
  l1Boq: Array<Record<string, unknown>>,
  fallbackBoq: Array<Record<string, unknown>> = [],
): Record<string, unknown> | undefined {
  const id = String(boqItemId ?? '').trim();
  if (id) {
    const directL1 = l1Boq.find((b) => String(b.id) === id);
    if (directL1) return directL1;
    const linked = fallbackBoq.find((b) => String(b.id) === id) ?? l1Boq.find((b) => String(b.id) === id);
    const code = String(linked?.itemCode ?? '').trim();
    if (code) {
      const twin = l1Boq.find((b) => String(b.itemCode) === code);
      if (twin) return twin;
    }
    if (linked) return linked;
  }
  const code = String(activityCode ?? '').trim();
  if (code) {
    return l1Boq.find((b) => String(b.itemCode) === code)
      ?? fallbackBoq.find((b) => String(b.itemCode) === code);
  }
  return undefined;
}

export function dprActivitySummaryForActivity(
  dpr: Record<string, unknown>,
  act: Record<string, unknown> | null | undefined,
  plannedQty?: number | null,
  boqCumulativeQty?: number | null,
): {
  workItem: string;
  billing: DprActivityBilling;
  chainage: string;
  location: string;
  progress: string;
} {
  if (!act) {
    const location = String(dpr.workSite ?? '—');
    return {
      workItem: location !== '—' ? `${location} (no BOQ line — edit DPR)` : '—',
      billing: parseDprActivityBilling(null, plannedQty),
      chainage: '—',
      location,
      progress: '—',
    };
  }
  const workItem = String(act.workDoneToday ?? act.description ?? '—').trim() || '—';
  const billing = parseDprActivityBilling(act, plannedQty, boqCumulativeQty);
  const progress = formatDprActivityProgress(act, plannedQty, boqCumulativeQty);
  const chainage = [act.chainageFrom, act.chainageTo].filter(Boolean).join(' → ') || '—';
  const location = String(act.siteDetail ?? dpr.workSite ?? '—');
  return { workItem, billing, chainage, location, progress };
}

export type DprTableRow = {
  dpr: Record<string, unknown>;
  act: Record<string, unknown> | null;
  actIndex: number;
  actCount: number;
};

/** Primary activity for list display — one BOQ line per daily report. */
export function primaryDprActivity(
  activities: Array<Record<string, unknown>>,
): Record<string, unknown> | null {
  if (!activities.length) return null;
  const sorted = activities
    .slice()
    .sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0));
  return sorted.find((a) => a.boqItemId || a.activityCode) ?? sorted[0];
}

/** One table row per DPR (primary activity only). */
export function flattenDprsForTable(dprs: Array<Record<string, unknown>>): DprTableRow[] {
  return dprs.map((dpr) => {
    const activities = (dpr.activities as Array<Record<string, unknown>>) ?? [];
    const act = primaryDprActivity(activities);
    return { dpr, act, actIndex: 0, actCount: 1 };
  });
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
  return dprActivitySummaryForActivity(dpr, first, plannedQty);
}
