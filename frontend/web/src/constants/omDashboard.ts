/** Stage 13 — GIS O&M Dashboard panels */

export const OM_GIS_DASHBOARD_PANELS = [
  { key: 'assetHealth', label: 'Asset Health Status' },
  { key: 'activeBreakdowns', label: 'Active Breakdowns' },
  { key: 'waterSupply', label: 'Water Supply Status' },
  { key: 'reservoirLevels', label: 'Reservoir Levels' },
  { key: 'pumpStatus', label: 'Pump Status' },
  { key: 'waterQuality', label: 'Water Quality Status' },
  { key: 'energyConsumption', label: 'Energy Consumption' },
  { key: 'complaintStatus', label: 'Complaint Status' },
  { key: 'slaCompliance', label: 'SLA Compliance' },
  { key: 'assetRenewal', label: 'Asset Renewal Requirements' },
] as const;

export type DashboardStatus = 'normal' | 'warning' | 'critical' | 'unknown';

export function panelStatusColor(status: string): 'success' | 'warning' | 'error' | 'default' {
  if (status === 'normal') return 'success';
  if (status === 'warning') return 'warning';
  if (status === 'critical') return 'error';
  return 'default';
}

export function statusLabel(status: string): string {
  if (status === 'normal') return 'Normal';
  if (status === 'warning') return 'Attention';
  if (status === 'critical') return 'Critical';
  return 'No Data';
}

export function markerColor(severity: string): string {
  if (severity === 'critical') return '#ef4444';
  if (severity === 'warning') return '#f59e0b';
  return '#22c55e';
}
