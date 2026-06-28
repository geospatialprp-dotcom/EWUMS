/** Stage 11 — O&M Contract Management (mirrors backend) */

export const DEFAULT_SLA_TARGETS = {
  attendancePct: 90,
  breakdownResponseMins: 120,
  maintenanceCompliancePct: 95,
  waterQualityCompliancePct: 98,
  complaintResolutionMins: 480,
  waterSupplyHoursPerDay: 20,
  pumpAvailabilityPct: 95,
  nrwPctMax: 25,
  energyKwhPerKlMax: 1.0,
};

export const OM_CONTRACT_MONITORING_AREAS = [
  { key: 'attendance', label: 'Attendance' },
  { key: 'slaCompliance', label: 'SLA Compliance' },
  { key: 'breakdownResponseTime', label: 'Breakdown Response Time' },
  { key: 'maintenanceCompliance', label: 'Maintenance Compliance' },
  { key: 'waterQualityCompliance', label: 'Water Quality Compliance' },
];

export const OM_CONTRACT_KPIS = [
  { key: 'waterSupplyHours', label: 'Water Supply Hours' },
  { key: 'pumpAvailability', label: 'Pump Availability' },
  { key: 'complaintResolutionTime', label: 'Complaint Resolution Time' },
  { key: 'waterQualityCompliance', label: 'Water Quality Compliance' },
  { key: 'nrw', label: 'Non-Revenue Water (NRW)' },
  { key: 'energyKwhPerKl', label: 'Energy Consumption per KL' },
];

export const OM_CONTRACT_REVIEW_RATINGS = [
  { code: 'satisfactory', label: 'Satisfactory' },
  { code: 'needs_improvement', label: 'Needs Improvement' },
  { code: 'unsatisfactory', label: 'Unsatisfactory' },
];

export type MetricResult = {
  value: number | null;
  target: number;
  compliant: boolean | null;
  unit: string;
  lowerIsBetter?: boolean;
};

export function complianceColor(compliant: boolean | null): 'success' | 'warning' | 'error' | 'default' {
  if (compliant === true) return 'success';
  if (compliant === false) return 'error';
  return 'default';
}

export function formatMetricValue(value: number | null, unit: string): string {
  if (value == null) return '—';
  return `${value}${unit === '%' ? '%' : ` ${unit}`}`;
}
