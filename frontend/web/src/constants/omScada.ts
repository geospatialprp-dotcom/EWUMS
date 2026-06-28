/** Stage 8 — SCADA & IoT (mirrors backend om-scada-catalog) */

export const OM_SCADA_ALERT_TYPES = [
  { type: 'pump_trip', label: 'Pump Trip', severity: 'critical' },
  { type: 'high_reservoir_level', label: 'High Reservoir Level', severity: 'warning' },
  { type: 'low_reservoir_level', label: 'Low Reservoir Level', severity: 'critical' },
  { type: 'power_failure', label: 'Power Failure', severity: 'critical' },
  { type: 'leakage_detection', label: 'Leakage Detection', severity: 'warning' },
  { type: 'water_quality_failure', label: 'Water Quality Failure', severity: 'critical' },
] as const;

export const OM_SCADA_SITES = [
  {
    category: 'reservoir',
    label: 'Reservoirs',
    metrics: [{ key: 'water_level', label: 'Water Level', unit: '%' }],
  },
  {
    category: 'pump_house',
    label: 'Pump Houses',
    metrics: [
      { key: 'pump_status', label: 'Pump Status' },
      { key: 'flow', label: 'Flow', unit: 'LPS' },
      { key: 'pressure', label: 'Pressure', unit: 'bar' },
    ],
  },
  {
    category: 'electrical',
    label: 'Electrical Systems',
    metrics: [
      { key: 'transformer_status', label: 'Transformer Status' },
      { key: 'power_available', label: 'Power Availability' },
    ],
  },
  {
    category: 'chlorination',
    label: 'Chlorination Systems',
    metrics: [{ key: 'residual_chlorine', label: 'Residual Chlorine', unit: 'mg/L' }],
  },
] as const;

export function severityColor(severity: string): 'error' | 'warning' | 'info' | 'default' {
  if (severity === 'critical') return 'error';
  if (severity === 'warning') return 'warning';
  return 'info';
}

export function statusColor(status: string): 'error' | 'warning' | 'success' | 'default' {
  if (status === 'open') return 'error';
  if (status === 'acknowledged') return 'warning';
  if (status === 'resolved') return 'success';
  return 'default';
}
