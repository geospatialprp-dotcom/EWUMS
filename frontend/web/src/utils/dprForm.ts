import type { ProjectComponent } from '../constants/construction';
import type { SchemeType } from '../services/api';

export const DPR_UNITS = ['cum', 'Rmt', 'Nos', 'Qtl', 'km', 'rm', 'joint'] as const;

export type DprActivityRow = {
  key: string;
  description: string;
  unit: string;
  quantityDone: number;
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

let dprRowCounter = 0;

export function emptyDprActivityRow(): DprActivityRow {
  dprRowCounter += 1;
  return {
    key: `dpr-row-${Date.now()}-${dprRowCounter}`,
    description: '',
    unit: 'cum',
    quantityDone: 1,
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
      .map((row) => ({
        description: row.description.trim(),
        unit: row.unit,
        quantityDone: Number(row.quantityDone) || 0,
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
      })),
  };
}

export function dprActivitySummary(dpr: Record<string, unknown>): {
  workItem: string;
  qty: string;
  chainage: string;
  location: string;
} {
  const activities = (dpr.activities as Array<Record<string, unknown>>) ?? [];
  const first = activities[0];
  const workItem = first
    ? String(first.description ?? '—')
    : '—';
  const qty = first
    ? `${first.quantityDone ?? 0} ${first.unit ?? ''}`.trim()
    : '—';
  const chainage = first
    ? [first.chainageFrom, first.chainageTo].filter(Boolean).join(' → ') || '—'
    : '—';
  const location = String(dpr.workSite ?? first?.siteDetail ?? '—');
  return { workItem, qty, chainage, location };
}
