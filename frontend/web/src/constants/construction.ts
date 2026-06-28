export type GisAssetType =
  | 'source' | 'intake' | 'gravity_main' | 'pumping_main' | 'reservoir'
  | 'valve_chamber' | 'gate_valve' | 'air_valve' | 'scour_valve'
  | 'pump_house' | 'transformer' | 'distribution_main' | 'fhtc';

export const GIS_ASSET_TYPES: GisAssetType[] = [
  'source', 'intake', 'gravity_main', 'pumping_main', 'reservoir',
  'valve_chamber', 'gate_valve', 'air_valve', 'scour_valve',
  'pump_house', 'transformer', 'distribution_main', 'fhtc',
];

export const GIS_ASSET_LABELS: Record<GisAssetType, string> = {
  source: 'Source',
  intake: 'Intake Structure',
  gravity_main: 'Gravity Main',
  pumping_main: 'Pumping Main',
  reservoir: 'Reservoir',
  valve_chamber: 'Valve Chambers',
  gate_valve: 'Gate Valves',
  air_valve: 'Air Valves',
  scour_valve: 'Scour Valves',
  pump_house: 'Pump House',
  transformer: 'Transformer',
  distribution_main: 'Distribution Network',
  fhtc: 'FHTC Connections',
};

export const GIS_ASSET_STATUSES = ['planned', 'installed', 'commissioned'] as const;
export type GisAssetStatus = typeof GIS_ASSET_STATUSES[number];

export const GIS_ASSET_STATUS_LABELS: Record<GisAssetStatus, string> = {
  planned: 'Planned',
  installed: 'Installed',
  commissioned: 'Commissioned',
};

export type ProjectComponent =
  | 'source_development'
  | 'gravity_main'
  | 'pumping_main'
  | 'reservoir'
  | 'distribution'
  | 'fhtc';

export const COMPONENT_LABELS: Record<ProjectComponent, string> = {
  source_development: 'Source Development',
  gravity_main: 'Gravity Main Pipeline',
  pumping_main: 'Pumping Main Pipeline',
  reservoir: 'Reservoir Construction',
  distribution: 'Distribution Network',
  fhtc: 'FHTC Connections',
};

/** Main BOQ headings from uploaded Excel (Badhangarhi / standard template) */
export const BOQ_EXCEL_SECTION_LABELS: Partial<Record<ProjectComponent, string>> = {
  source_development: 'Source & Treatment Works',
  reservoir: 'Storage & Reservoir Works',
  gravity_main: 'Supply Main / Gravity Main',
  pumping_main: 'Supply Main / Gravity Main',
  distribution: 'Distribution System',
};

/** BOQ display order — matches Excel section sequence 1 → 4 */
export const BOQ_EXCEL_SECTION_ORDER: ProjectComponent[] = [
  'source_development',
  'reservoir',
  'gravity_main',
  'distribution',
];

/** Standard BOQ section order (matches Excel template) */
export const PROJECT_COMPONENT_ORDER: ProjectComponent[] = [
  'source_development',
  'gravity_main',
  'pumping_main',
  'reservoir',
  'distribution',
  'fhtc',
];

/** BOQ table columns — matches typical Excel BOQ sheet */
export const BOQ_TABLE_COLUMNS = [
  'SN',
  'Item Description',
  'QTY',
  'Unit',
  'Rate with GST',
  'Total Amount with Tax',
] as const;

export const WORKFLOW_STAGES = [
  { stage: 1, name: 'Work Planning', key: 'planning' },
  { stage: 2, name: 'Daily Construction (DPR)', key: 'dpr' },
  { stage: 3, name: 'Measurement Book', key: 'mb' },
  { stage: 4, name: 'Verification (JE→AE→EE)', key: 'mb' },
  { stage: 5, name: 'BOQ Reconciliation', key: 'reconciliation' },
  { stage: 6, name: 'RA Bills', key: 'ra-bills' },
  { stage: 7, name: 'Final Bill Preparation', key: 'final' },
  { stage: 8, name: 'GIS Assets', key: 'gis' },
  { stage: 9, name: 'Dashboard & Reporting', key: 'dashboard' },
  { stage: 10, name: 'System Outputs', key: 'reports' },
];

export const STATUS_COLORS: Record<string, 'default' | 'warning' | 'success' | 'error' | 'info'> = {
  draft: 'default',
  planned: 'default',
  installed: 'info',
  commissioned: 'success',
  in_progress: 'info',
  submitted: 'info',
  je_review: 'warning',
  ae_review: 'warning',
  ee_approved: 'success',
  je_measured: 'info',
  ae_checked: 'info',
  ee_checked: 'info',
  boq_finalized: 'success',
  je_verified: 'info',
  finance_released: 'success',
  accounts_verification: 'warning',
  accounts_verified: 'info',
  ee_sanctioned: 'success',
  rejected: 'error',
  approved: 'success',
};

/** Which role can approve at each in-review status */
export const STATUS_APPROVER: Record<string, string> = {
  je_review: 'je',
  ae_review: 'ae',
  ae_checked: 'ae',
  ee_checked: 'ee',
  accounts_verification: 'accounts',
  accounts_verified: 'ee',
  je_verified: 'je',
  ee_approved: 'ee',
};

export const WORKFLOW_DONE_STATUSES = [
  'draft', 'ee_approved', 'boq_finalized', 'ee_sanctioned', 'finance_released', 'rejected',
];

/** DPR approval sequence: Contractor → JE → AE → EE */
export const DPR_WORKFLOW_SEQUENCE = [
  { status: 'draft', step: 1, label: 'Draft' },
  { status: 'je_review', step: 2, label: 'JE Review' },
  { status: 'ae_review', step: 3, label: 'AE Review' },
  { status: 'ee_approved', step: 4, label: 'EE Approved' },
] as const;

export function dprWorkflowStepLabel(status: string): string {
  if (status === 'rejected') return 'Rejected';
  const match = DPR_WORKFLOW_SEQUENCE.find((s) => s.status === status);
  return match ? `Step ${match.step} · ${match.label}` : status.replace(/_/g, ' ');
}

/** Full construction pipeline through MB verification */
export const CONSTRUCTION_PIPELINE = [
  'Contractor',
  'Site Engineer',
  'JE',
  'AE',
  'EE',
] as const;

/** MB Stage 3–4 workflow */
export const MB_WORKFLOW_SEQUENCE = [
  { status: 'draft', step: 1, label: 'Draft (JE Entry)' },
  { status: 'ae_checked', step: 2, label: 'AE Verification' },
  { status: 'ee_checked', step: 3, label: 'EE Verification' },
  { status: 'boq_finalized', step: 4, label: 'Verified' },
] as const;

export function mbWorkflowStepLabel(status: string): string {
  if (status === 'rejected') return 'Rejected';
  if (status === 'draft') return 'Step 1 · Draft';
  if (status === 'je_review') return 'Step 2 · AE Verification';
  const match = MB_WORKFLOW_SEQUENCE.find((s) => s.status === status);
  if (match) return `Step ${match.step} · ${match.label}`;
  return status.replace(/_/g, ' ');
}

export function mbPendingVerifier(status: string): 'ae' | 'ee' | null {
  if (status === 'ae_checked' || status === 'je_review') return 'ae';
  if (status === 'ee_checked') return 'ee';
  return null;
}

/** RA Bill Stage 6 workflow — JE → AE → EE → Finance */
export const RA_WORKFLOW_SEQUENCE = [
  { status: 'draft', step: 1, label: 'Draft' },
  { status: 'je_review', step: 2, label: 'JE Verification' },
  { status: 'ae_checked', step: 3, label: 'AE Check' },
  { status: 'ee_checked', step: 4, label: 'EE Approval' },
  { status: 'accounts_verification', step: 5, label: 'Finance Release' },
  { status: 'finance_released', step: 6, label: 'Released' },
] as const;

export const RA_STATUS_APPROVER: Record<string, string> = {
  je_review: 'je',
  ae_checked: 'ae',
  ee_checked: 'ee',
  accounts_verification: 'accounts',
};

export const RA_DONE_STATUSES = ['draft', 'finance_released', 'rejected'];

export function raWorkflowStepLabel(status: string): string {
  if (status === 'rejected') return 'Rejected';
  const match = RA_WORKFLOW_SEQUENCE.find((s) => s.status === status);
  if (match) return `Step ${match.step} · ${match.label}`;
  return status.replace(/_/g, ' ');
}

export function raPendingApprover(status: string): string | null {
  return RA_STATUS_APPROVER[status] ?? null;
}
