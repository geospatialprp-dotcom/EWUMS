export type OmScadaSiteCategory = 'reservoir' | 'pump_house' | 'electrical' | 'chlorination';

export type OmScadaAlertType =
  | 'pump_trip'
  | 'high_reservoir_level'
  | 'low_reservoir_level'
  | 'power_failure'
  | 'leakage_detection'
  | 'water_quality_failure';

export interface OmScadaMetricDef {
  key: string;
  label: string;
  unit?: string;
  type: 'number' | 'text' | 'boolean';
  options?: string[];
}

export interface OmScadaSiteDef {
  category: OmScadaSiteCategory;
  label: string;
  metrics: OmScadaMetricDef[];
}

export const OM_SCADA_ALERT_TYPES: Array<{ type: OmScadaAlertType; label: string; severity: string }> = [
  { type: 'pump_trip', label: 'Pump Trip', severity: 'critical' },
  { type: 'high_reservoir_level', label: 'High Reservoir Level', severity: 'warning' },
  { type: 'low_reservoir_level', label: 'Low Reservoir Level', severity: 'critical' },
  { type: 'power_failure', label: 'Power Failure', severity: 'critical' },
  { type: 'leakage_detection', label: 'Leakage Detection', severity: 'warning' },
  { type: 'water_quality_failure', label: 'Water Quality Failure', severity: 'critical' },
];

export const OM_SCADA_SITES: OmScadaSiteDef[] = [
  {
    category: 'reservoir',
    label: 'Reservoirs',
    metrics: [{ key: 'water_level', label: 'Water Level', unit: '%', type: 'number' }],
  },
  {
    category: 'pump_house',
    label: 'Pump Houses',
    metrics: [
      { key: 'pump_status', label: 'Pump Status', type: 'text', options: ['running', 'stopped', 'trip', 'maintenance'] },
      { key: 'flow', label: 'Flow', unit: 'LPS', type: 'number' },
      { key: 'pressure', label: 'Pressure', unit: 'bar', type: 'number' },
    ],
  },
  {
    category: 'electrical',
    label: 'Electrical Systems',
    metrics: [
      { key: 'transformer_status', label: 'Transformer Status', type: 'text', options: ['online', 'offline', 'fault'] },
      { key: 'power_available', label: 'Power Availability', type: 'boolean' },
    ],
  },
  {
    category: 'chlorination',
    label: 'Chlorination Systems',
    metrics: [{ key: 'residual_chlorine', label: 'Residual Chlorine', unit: 'mg/L', type: 'number' }],
  },
];

export const SCADA_THRESHOLDS = {
  water_level_high_pct: 90,
  water_level_low_pct: 15,
  residual_chlorine_min: 0.2,
  residual_chlorine_max: 4,
  pressure_leakage_drop_bar: 0.5,
  flow_min_when_running_lps: 1,
};

export function getScadaSiteDef(category: string): OmScadaSiteDef | undefined {
  return OM_SCADA_SITES.find((s) => s.category === category);
}

export function getScadaMetricDef(category: string, metricKey: string): OmScadaMetricDef | undefined {
  return getScadaSiteDef(category)?.metrics.find((m) => m.key === metricKey);
}

export function getAlertTypeLabel(type: string): string {
  return OM_SCADA_ALERT_TYPES.find((a) => a.type === type)?.label ?? type.replace(/_/g, ' ');
}
