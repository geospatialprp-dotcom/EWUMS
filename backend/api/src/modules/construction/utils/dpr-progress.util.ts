import { createHash } from 'crypto';

export type BoqMeasurementMode = 'discrete_qty' | 'whole_job';

const WHOLE_JOB_UNIT = /^(job|jobs|ls|l\.s\.|item|lump\s*sum)$/i;

export function detectMeasurementMode(unit: string): BoqMeasurementMode {
  const normalized = unit.trim().replace(/\s+/g, ' ');
  if (WHOLE_JOB_UNIT.test(normalized) || /\bjob\b/i.test(normalized)) {
    return 'whole_job';
  }
  return 'discrete_qty';
}

export function sanctionedBoqQty(contractQty: number, revisedQty: number): number {
  const revised = Number(revisedQty);
  if (revised > 0) return revised;
  return Number(contractQty) || 0;
}

function normalizeComponent(component: string | null | undefined): string {
  return component?.trim().toLowerCase() ?? '';
}

export function countMatchingWorkPackages(
  boqComponent: string | null | undefined,
  workPackages: { component: string }[],
): number {
  const comp = normalizeComponent(boqComponent);
  if (!comp) return 0;
  return workPackages.filter((wp) => normalizeComponent(wp.component) === comp).length;
}

/** Per work-package cap when BOQ qty is split across matching locations (e.g. 2 Job / 2 WPs → 1 Job each). */
export function scopeSanctionedQty(
  boqSanctioned: number,
  boqComponent: string | null | undefined,
  workPackages: { component: string }[],
): number {
  const count = countMatchingWorkPackages(boqComponent, workPackages);
  if (count >= 2 && boqSanctioned >= count) {
    return boqSanctioned / count;
  }
  return boqSanctioned;
}

export function buildExecutionScopeKey(parts: {
  projectId: string;
  boqItemId: string;
  workPackageId?: string | null;
  chainageFrom?: string | null;
  chainageTo?: string | null;
}): string {
  const wp = parts.workPackageId?.trim() || 'none';
  const from = parts.chainageFrom?.trim() || '0';
  const to = parts.chainageTo?.trim() || '0';
  const raw = `${parts.projectId}:${parts.boqItemId}:${wp}:${from}-${to}`;
  return createHash('sha256').update(raw).digest('hex').slice(0, 64);
}

export function progressIncrementQty(
  _mode: BoqMeasurementMode,
  _sanctionedQty: number,
  _progressPctToday: number | null | undefined,
  quantityDone: number,
): { deltaQty: number; deltaPct: number | null } {
  const deltaQty = Number(quantityDone ?? 0);
  const deltaPct = _sanctionedQty > 0 ? (deltaQty / _sanctionedQty) * 100 : null;
  return { deltaQty, deltaPct };
}

export function cumulativePctFromQty(cumulativeQty: number, sanctionedQty: number): number {
  if (sanctionedQty <= 0) return 0;
  return Math.min(100, Math.round((cumulativeQty / sanctionedQty) * 10000) / 100);
}

export function assertProgressWithinSanction(
  mode: BoqMeasurementMode,
  sanctionedQty: number,
  cumulativeBefore: number,
  incrementQty: number,
): void {
  const after = cumulativeBefore + incrementQty;
  const limit = mode === 'whole_job' ? sanctionedQty : sanctionedQty;
  if (after > limit + 0.0005) {
    const balance = Math.max(0, limit - cumulativeBefore);
    const fmt = (n: number) => String(Math.round(n * 1000) / 1000);
    const label = `${fmt(cumulativeBefore)} done, balance ${fmt(balance)}`;
    throw new Error(
      `Progress exceeds sanctioned BOQ quantity (${label})`,
    );
  }
}

export function executionStatusFromCumulative(
  cumulativeQty: number,
  sanctionedQty: number,
): 'not_started' | 'in_progress' | 'completed' {
  if (sanctionedQty <= 0) return 'not_started';
  if (cumulativeQty <= 0) return 'not_started';
  if (cumulativeQty >= sanctionedQty - 0.0005) return 'completed';
  return 'in_progress';
}

export function estimateExpectedCompletion(
  reportDate: string,
  cumulativePct: number,
  dailyPcts: number[],
): string | null {
  const remaining = 100 - cumulativePct;
  if (remaining <= 0) return reportDate;
  const recent = dailyPcts.filter((p) => p > 0);
  if (!recent.length) return null;
  const avg = recent.reduce((s, p) => s + p, 0) / recent.length;
  if (avg <= 0) return null;
  const days = Math.ceil(remaining / avg);
  const d = new Date(reportDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
