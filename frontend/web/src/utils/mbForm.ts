import type { SchemeType } from '../services/api';
import { DPR_UNITS } from './dprForm';

export { DPR_UNITS as MB_UNITS };

export type MbEntryRow = {
  key: string;
  description: string;
  unit: string;
  measuredQty: number;
  rate: number;
  boqItemId: string;
  chainageFrom: string;
  chainageTo: string;
  lengthM: string;
  widthM: string;
  depthM: string;
  latitude: string;
  longitude: string;
};

export type MbHeaderForm = {
  mbNumber: string;
  measurementDate: string;
  schemeType: SchemeType;
  siteLocation: string;
  workPackageId: string;
  dprId: string;
  remarks: string;
  qualityVerification: string;
  materialVerification: string;
};

let mbRowCounter = 0;

export function emptyMbEntryRow(): MbEntryRow {
  mbRowCounter += 1;
  return {
    key: `mb-row-${Date.now()}-${mbRowCounter}`,
    description: '',
    unit: 'cum',
    measuredQty: 1,
    rate: 0,
    boqItemId: '',
    chainageFrom: '',
    chainageTo: '',
    lengthM: '',
    widthM: '',
    depthM: '',
    latitude: '',
    longitude: '',
  };
}

export function defaultMbHeader(): MbHeaderForm {
  return {
    mbNumber: '',
    measurementDate: new Date().toISOString().slice(0, 10),
    schemeType: 'gravity',
    siteLocation: '',
    workPackageId: '',
    dprId: '',
    remarks: '',
    qualityVerification: '',
    materialVerification: '',
  };
}

function buildMbRemarks(header: MbHeaderForm): string | undefined {
  const parts = [
    header.remarks.trim(),
    header.qualityVerification.trim() ? `Quality verification: ${header.qualityVerification.trim()}` : '',
    header.materialVerification.trim() ? `Material verification: ${header.materialVerification.trim()}` : '',
  ].filter(Boolean);
  return parts.length ? parts.join('\n\n') : undefined;
}

export function calcMbQuantity(row: MbEntryRow): number {
  const l = Number(row.lengthM);
  const w = Number(row.widthM);
  const d = Number(row.depthM);
  if (l > 0 && w > 0 && d > 0) return Number((l * w * d).toFixed(3));
  if (l > 0 && w > 0) return Number((l * w).toFixed(3));
  return Number(row.measuredQty) || 0;
}

export function buildMbPayload(header: MbHeaderForm, entries: MbEntryRow[]) {
  return {
    mbNumber: header.mbNumber,
    measurementDate: header.measurementDate,
    schemeType: header.schemeType,
    siteLocation: header.siteLocation || undefined,
    workPackageId: header.workPackageId || undefined,
    dprId: header.dprId || undefined,
    remarks: buildMbRemarks(header),
    entries: entries
      .filter((row) => row.description.trim())
      .map((row) => ({
        description: row.description.trim(),
        unit: row.unit,
        measuredQty: calcMbQuantity(row),
        rate: Number(row.rate) || 0,
        boqItemId: row.boqItemId || undefined,
        chainageFrom: row.chainageFrom || undefined,
        chainageTo: row.chainageTo || undefined,
        lengthM: row.lengthM ? Number(row.lengthM) : undefined,
        widthM: row.widthM ? Number(row.widthM) : undefined,
        depthM: row.depthM ? Number(row.depthM) : undefined,
        latitude: row.latitude ? Number(row.latitude) : undefined,
        longitude: row.longitude ? Number(row.longitude) : undefined,
      })),
  };
}

export function mbEntrySummary(mb: Record<string, unknown>): {
  workItem: string;
  chainage: string;
  qty: string;
  coordinates: string;
} {
  const entries = (mb.entries as Array<Record<string, unknown>>) ?? [];
  const first = entries[0];
  const workItem = first ? String(first.description ?? '—') : '—';
  const chainage = first
    ? [first.chainageFrom, first.chainageTo].filter(Boolean).join(' → ') || '—'
    : '—';
  const qty = first ? `${first.measuredQty ?? 0} ${first.unit ?? ''}`.trim() : '—';
  const coordinates = first && first.latitude != null && first.longitude != null
    ? `${first.latitude}, ${first.longitude}`
    : '—';
  return { workItem, chainage, qty, coordinates };
}
