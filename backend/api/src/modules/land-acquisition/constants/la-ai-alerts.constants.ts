export type LaAiAlertSeverity = 'critical' | 'warning' | 'info';

export type LaAiAlertType =
  | 'pipeline_entering_forest'
  | 'pipeline_entering_private_land'
  | 'pipeline_crossing_railway'
  | 'pipeline_crossing_river'
  | 'high_compensation_area'
  | 'litigation_parcel'
  | 'duplicate_acquisition'
  | 'missing_owner'
  | 'ownership_mismatch'
  | 'pending_noc'
  | 'expired_approval';

export type LaAiAlertDef = {
  code: LaAiAlertType;
  label: string;
  severity: LaAiAlertSeverity;
  notify: boolean;
};

/** AI alert catalog — all types the system monitors and notifies */
export const LA_AI_ALERT_TYPES: readonly LaAiAlertDef[] = [
  { code: 'pipeline_entering_forest', label: 'Pipeline Entering Forest', severity: 'critical', notify: true },
  { code: 'pipeline_entering_private_land', label: 'Pipeline Entering Private Land', severity: 'warning', notify: true },
  { code: 'pipeline_crossing_railway', label: 'Pipeline Crossing Railway', severity: 'critical', notify: true },
  { code: 'pipeline_crossing_river', label: 'Pipeline Crossing River', severity: 'warning', notify: true },
  { code: 'high_compensation_area', label: 'High Compensation Area', severity: 'warning', notify: true },
  { code: 'litigation_parcel', label: 'Litigation Parcel', severity: 'critical', notify: true },
  { code: 'duplicate_acquisition', label: 'Duplicate Acquisition', severity: 'warning', notify: true },
  { code: 'missing_owner', label: 'Missing Owner', severity: 'warning', notify: true },
  { code: 'ownership_mismatch', label: 'Ownership Mismatch', severity: 'warning', notify: true },
  { code: 'pending_noc', label: 'Pending NOC', severity: 'info', notify: true },
  { code: 'expired_approval', label: 'Expired Approval', severity: 'critical', notify: true },
] as const;

/** Parcel total acquisition cost above this triggers high-compensation alert (INR) */
export const LA_AI_HIGH_COMPENSATION_INR = 1_000_000;

/** Approved clearance validity before expiry alert (days) */
export const LA_AI_APPROVAL_VALIDITY_DAYS = 365;

const FOREST_OWNERSHIP = new Set([
  'forest_land', 'forest_department', 'civil_soyam', 'van_panchayat',
]);

const PRIVATE_OWNERSHIP = new Set([
  'private_land', 'private_institution', 'religious_trust',
]);

const GOVERNMENT_OWNERSHIP = new Set([
  'government_land', 'revenue_department', 'municipality', 'pwd',
  'national_highway', 'railway', 'irrigation_department', 'defense', 'other_department',
]);

export function getLaAiAlertDef(code: string): LaAiAlertDef | undefined {
  return LA_AI_ALERT_TYPES.find((a) => a.code === code);
}

export { FOREST_OWNERSHIP, PRIVATE_OWNERSHIP, GOVERNMENT_OWNERSHIP };
