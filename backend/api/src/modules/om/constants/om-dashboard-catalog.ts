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

export type OmDashboardStatus = 'normal' | 'warning' | 'critical' | 'unknown';

export function statusFromHealth(avgHealth: number | null): OmDashboardStatus {
  if (avgHealth == null) return 'unknown';
  if (avgHealth >= 70) return 'normal';
  if (avgHealth >= 50) return 'warning';
  return 'critical';
}

export function statusLabel(status: OmDashboardStatus): string {
  if (status === 'normal') return 'Normal';
  if (status === 'warning') return 'Attention';
  if (status === 'critical') return 'Critical';
  return 'No Data';
}
