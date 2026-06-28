/** Stage 6 — Water quality monitoring (mirrors backend om-wq-catalog) */

export type OmWqSamplePoint = 'source' | 'reservoir' | 'distribution_network' | 'fhtc';

export type OmWqStatus =
  | 'sample_collection'
  | 'laboratory_testing'
  | 'result_upload'
  | 'gis_mapping'
  | 'compliance_verification'
  | 'corrective_action'
  | 'closed';

export const OM_WQ_STATUS_LABELS: Record<OmWqStatus, string> = {
  sample_collection: 'Sample Collection',
  laboratory_testing: 'Laboratory Testing',
  result_upload: 'Result Upload',
  gis_mapping: 'GIS Mapping',
  compliance_verification: 'Compliance Verification',
  corrective_action: 'Corrective Action',
  closed: 'Closed',
};

export const OM_WQ_SAMPLE_POINTS: Array<{ code: OmWqSamplePoint; label: string }> = [
  { code: 'source', label: 'Source' },
  { code: 'reservoir', label: 'Reservoir' },
  { code: 'distribution_network', label: 'Distribution Network' },
  { code: 'fhtc', label: 'FHTC Locations' },
];

export const OM_WQ_WORKFLOW: Array<{ status: OmWqStatus; label: string }> = [
  { status: 'sample_collection', label: 'Sample Collection' },
  { status: 'laboratory_testing', label: 'Laboratory Testing' },
  { status: 'result_upload', label: 'Result Upload' },
  { status: 'gis_mapping', label: 'GIS Mapping' },
  { status: 'compliance_verification', label: 'Compliance Verification' },
  { status: 'corrective_action', label: 'Corrective Action' },
  { status: 'closed', label: 'Closed' },
];

export interface OmWqParameterDef {
  key: string;
  label: string;
  unit?: string;
  type: 'number' | 'select';
  options?: string[];
  min?: number;
  max?: number;
}

export interface OmWqParameterGroupDef {
  group: string;
  label: string;
  parameters: OmWqParameterDef[];
}

export const OM_WQ_PARAMETER_GROUPS: OmWqParameterGroupDef[] = [
  {
    group: 'physical',
    label: 'Physical',
    parameters: [
      { key: 'turbidity', label: 'Turbidity', unit: 'NTU', type: 'number', max: 1 },
      { key: 'colour', label: 'Colour', unit: 'Hazen', type: 'number', max: 5 },
      { key: 'odour', label: 'Odour', type: 'select', options: ['acceptable', 'unacceptable'] },
    ],
  },
  {
    group: 'chemical',
    label: 'Chemical',
    parameters: [
      { key: 'ph', label: 'pH', type: 'number', min: 6.5, max: 8.5 },
      { key: 'iron', label: 'Iron', unit: 'mg/L', type: 'number', max: 0.3 },
      { key: 'fluoride', label: 'Fluoride', unit: 'mg/L', type: 'number', max: 1.5 },
      { key: 'nitrate', label: 'Nitrate', unit: 'mg/L', type: 'number', max: 45 },
    ],
  },
  {
    group: 'bacteriological',
    label: 'Bacteriological',
    parameters: [
      { key: 'total_coliform', label: 'Total Coliform', unit: 'MPN/100ml', type: 'number', max: 0 },
      { key: 'e_coli', label: 'E. Coli', unit: 'MPN/100ml', type: 'number', max: 0 },
    ],
  },
];

export function normalizeWqStatus(status: string): OmWqStatus {
  if (status === 'pending') return 'sample_collection';
  return status as OmWqStatus;
}

export function complianceChip(isCompliant: boolean | null | undefined): {
  label: string;
  color: 'default' | 'success' | 'error' | 'warning';
} {
  if (isCompliant === true) return { label: 'Compliant', color: 'success' };
  if (isCompliant === false) return { label: 'Non-Compliant', color: 'error' };
  return { label: 'Pending', color: 'warning' };
}
