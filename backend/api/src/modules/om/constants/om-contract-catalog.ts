export type OmContractStatus = 'active' | 'expired' | 'terminated' | 'under_review';

export type OmContractReviewRating = 'satisfactory' | 'needs_improvement' | 'unsatisfactory';

export interface OmSlaTargets {
  attendancePct?: number;
  breakdownResponseMins?: number;
  maintenanceCompliancePct?: number;
  waterQualityCompliancePct?: number;
  complaintResolutionMins?: number;
  waterSupplyHoursPerDay?: number;
  pumpAvailabilityPct?: number;
  nrwPctMax?: number;
  energyKwhPerKlMax?: number;
}

export const DEFAULT_SLA_TARGETS: Required<OmSlaTargets> = {
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
  { key: 'attendance', label: 'Attendance', unit: '%' },
  { key: 'slaCompliance', label: 'SLA Compliance', unit: '%' },
  { key: 'breakdownResponseTime', label: 'Breakdown Response Time', unit: 'mins' },
  { key: 'maintenanceCompliance', label: 'Maintenance Compliance', unit: '%' },
  { key: 'waterQualityCompliance', label: 'Water Quality Compliance', unit: '%' },
] as const;

export const OM_CONTRACT_KPIS = [
  { key: 'waterSupplyHours', label: 'Water Supply Hours', unit: 'hrs/day' },
  { key: 'pumpAvailability', label: 'Pump Availability', unit: '%' },
  { key: 'complaintResolutionTime', label: 'Complaint Resolution Time', unit: 'mins' },
  { key: 'waterQualityCompliance', label: 'Water Quality Compliance', unit: '%' },
  { key: 'nrw', label: 'Non-Revenue Water (NRW)', unit: '%', lowerIsBetter: true },
  { key: 'energyKwhPerKl', label: 'Energy Consumption per KL', unit: 'kWh/KL', lowerIsBetter: true },
] as const;

export const OM_CONTRACT_WORKFLOW = [
  { step: 'sla_monitoring', label: 'SLA Monitoring' },
  { step: 'response_time_kpi', label: 'Response Time KPI' },
  { step: 'nrw_energy_kpi', label: 'NRW & Energy KPI' },
  { step: 'performance_review', label: 'Performance Review' },
];

export const OM_CONTRACT_REVIEW_RATINGS: Array<{ code: OmContractReviewRating; label: string }> = [
  { code: 'satisfactory', label: 'Satisfactory' },
  { code: 'needs_improvement', label: 'Needs Improvement' },
  { code: 'unsatisfactory', label: 'Unsatisfactory' },
];

export function mergeSlaTargets(custom?: OmSlaTargets | null): Required<OmSlaTargets> {
  return { ...DEFAULT_SLA_TARGETS, ...(custom ?? {}) };
}
