/** Stage 14 — O&M Reports & Outputs (mirrors backend) */

export const OM_REPORT_GROUPS = [
  { key: 'registers', label: 'Registers' },
  { key: 'operations', label: 'Operations' },
  { key: 'planning', label: 'Planning' },
  { key: 'analysis', label: 'Analysis' },
] as const;

export const OM_REPORT_TYPES = [
  { type: 'om_asset_register', label: 'O&M Asset Register', group: 'registers' as const },
  { type: 'preventive_maintenance_register', label: 'Preventive Maintenance Register', group: 'registers' as const },
  { type: 'breakdown_register', label: 'Breakdown Register', group: 'registers' as const },
  { type: 'complaint_register', label: 'Complaint Register', group: 'registers' as const },
  { type: 'water_quality_register', label: 'Water Quality Register', group: 'registers' as const },
  { type: 'energy_consumption_register', label: 'Energy Consumption Register', group: 'registers' as const },
  { type: 'consumer_service', label: 'Consumer Service Reports', group: 'registers' as const },
  { type: 'scada_monitoring', label: 'SCADA Monitoring Reports', group: 'operations' as const },
  { type: 'asset_health', label: 'Asset Health Reports', group: 'operations' as const },
  { type: 'gis_om', label: 'GIS-Based O&M Reports', group: 'operations' as const },
  { type: 'annual_om_plan', label: 'Annual O&M Plan', group: 'planning' as const },
  { type: 'asset_renewal_plan', label: 'Asset Renewal Plan', group: 'planning' as const },
  { type: 'om_expenditure', label: 'O&M Expenditure Reports', group: 'analysis' as const },
  { type: 'sla_performance', label: 'SLA Performance Reports', group: 'analysis' as const },
  { type: 'nrw_analysis', label: 'NRW Analysis Reports', group: 'analysis' as const },
  { type: 'audit', label: 'Audit Reports', group: 'analysis' as const },
];

export function flattenRow(row: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v == null) out[k] = '—';
    else if (typeof v === 'object') out[k] = JSON.stringify(v);
    else out[k] = String(v);
  }
  return out;
}
