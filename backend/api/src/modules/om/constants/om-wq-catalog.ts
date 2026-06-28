export type OmWqSamplePoint = 'source' | 'reservoir' | 'distribution_network' | 'fhtc';

export type OmWqStatus =
  | 'sample_collection'
  | 'laboratory_testing'
  | 'result_upload'
  | 'gis_mapping'
  | 'compliance_verification'
  | 'corrective_action'
  | 'closed';

export interface OmWqParameterDef {
  key: string;
  label: string;
  unit?: string;
  type: 'number' | 'select';
  options?: string[];
  min?: number;
  max?: number;
  compliantValues?: string[];
}

export interface OmWqParameterGroupDef {
  group: string;
  label: string;
  parameters: OmWqParameterDef[];
}

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

export const OM_WQ_PARAMETER_GROUPS: OmWqParameterGroupDef[] = [
  {
    group: 'physical',
    label: 'Physical',
    parameters: [
      { key: 'turbidity', label: 'Turbidity', unit: 'NTU', type: 'number', max: 1 },
      { key: 'colour', label: 'Colour', unit: 'Hazen', type: 'number', max: 5 },
      {
        key: 'odour',
        label: 'Odour',
        type: 'select',
        options: ['acceptable', 'unacceptable'],
        compliantValues: ['acceptable'],
      },
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

export const VALID_WQ_SAMPLE_POINTS = OM_WQ_SAMPLE_POINTS.map((p) => p.code);

export function getWqSamplePointLabel(code: string): string {
  return OM_WQ_SAMPLE_POINTS.find((p) => p.code === code)?.label ?? code.replace(/_/g, ' ');
}

export function normalizeWqStatus(status: string): OmWqStatus {
  if (status === 'pending') return 'sample_collection';
  if (OM_WQ_WORKFLOW.some((s) => s.status === status)) return status as OmWqStatus;
  return 'sample_collection';
}

export function getNextWqStatus(current: OmWqStatus, isCompliant: boolean | null): OmWqStatus | null {
  if (current === 'compliance_verification') {
    return isCompliant === false ? 'corrective_action' : 'closed';
  }
  const idx = OM_WQ_WORKFLOW.findIndex((s) => s.status === current);
  if (idx < 0 || idx >= OM_WQ_WORKFLOW.length - 1) return null;
  const next = OM_WQ_WORKFLOW[idx + 1].status;
  if (next === 'corrective_action') return isCompliant === false ? 'corrective_action' : 'closed';
  return next;
}

export function evaluateCompliance(parameters: Record<string, unknown>): {
  isCompliant: boolean;
  failures: Array<{ key: string; label: string; value: unknown; rule: string }>;
} {
  const failures: Array<{ key: string; label: string; value: unknown; rule: string }> = [];

  for (const group of OM_WQ_PARAMETER_GROUPS) {
    for (const param of group.parameters) {
      const raw = parameters[param.key];
      if (raw === undefined || raw === null || raw === '') continue;

      if (param.type === 'select') {
        const val = String(raw).toLowerCase();
        const ok = param.compliantValues?.map((v) => v.toLowerCase()).includes(val);
        if (!ok) {
          failures.push({
            key: param.key,
            label: param.label,
            value: raw,
            rule: `Must be ${param.compliantValues?.join(' or ')}`,
          });
        }
        continue;
      }

      const num = Number(raw);
      if (!Number.isFinite(num)) {
        failures.push({ key: param.key, label: param.label, value: raw, rule: 'Invalid number' });
        continue;
      }
      if (param.min != null && num < param.min) {
        failures.push({ key: param.key, label: param.label, value: num, rule: `Min ${param.min}` });
      }
      if (param.max != null && num > param.max) {
        failures.push({ key: param.key, label: param.label, value: num, rule: `Max ${param.max}` });
      }
    }
  }

  return { isCompliant: failures.length === 0, failures };
}
