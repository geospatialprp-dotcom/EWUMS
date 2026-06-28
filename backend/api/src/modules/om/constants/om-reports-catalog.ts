export type OmReportType =
  | 'om_asset_register'
  | 'preventive_maintenance_register'
  | 'breakdown_register'
  | 'complaint_register'
  | 'water_quality_register'
  | 'energy_consumption_register'
  | 'scada_monitoring'
  | 'asset_health'
  | 'om_expenditure'
  | 'sla_performance'
  | 'annual_om_plan'
  | 'asset_renewal_plan'
  | 'gis_om'
  | 'nrw_analysis'
  | 'consumer_service'
  | 'audit';

export interface OmReportTypeDef {
  type: OmReportType;
  label: string;
  description: string;
  group: 'registers' | 'operations' | 'planning' | 'analysis';
}

export const OM_REPORT_TYPES: OmReportTypeDef[] = [
  { type: 'om_asset_register', label: 'O&M Asset Register', description: 'Complete scheme asset inventory with GIS and lifecycle metadata', group: 'registers' },
  { type: 'preventive_maintenance_register', label: 'Preventive Maintenance Register', description: 'PM schedules, due dates, and completion status', group: 'registers' },
  { type: 'breakdown_register', label: 'Breakdown Register', description: 'Corrective maintenance tickets and workflow history', group: 'registers' },
  { type: 'complaint_register', label: 'Complaint Register', description: 'Consumer complaints across all channels', group: 'registers' },
  { type: 'water_quality_register', label: 'Water Quality Register', description: 'Sample tests, compliance status, and alerts', group: 'registers' },
  { type: 'energy_consumption_register', label: 'Energy Consumption Register', description: 'Daily energy readings, cost, and efficiency metrics', group: 'registers' },
  { type: 'scada_monitoring', label: 'SCADA Monitoring Reports', description: 'Telemetry readings and active SCADA alerts', group: 'operations' },
  { type: 'asset_health', label: 'Asset Health Reports', description: 'Health index, condition grades, and remaining useful life', group: 'operations' },
  { type: 'om_expenditure', label: 'O&M Expenditure Reports', description: 'Energy costs and planned renewal expenditure', group: 'analysis' },
  { type: 'sla_performance', label: 'SLA Performance Reports', description: 'Contractor SLA compliance and performance reviews', group: 'analysis' },
  { type: 'annual_om_plan', label: 'Annual O&M Plan', description: 'Consolidated PM, contracts, and capital renewal programme', group: 'planning' },
  { type: 'asset_renewal_plan', label: 'Asset Renewal Plan', description: 'Rehabilitation and replacement plans by asset category', group: 'planning' },
  { type: 'gis_om', label: 'GIS-Based O&M Reports', description: 'Geo-tagged assets, breakdowns, complaints, and supply chain status', group: 'operations' },
  { type: 'nrw_analysis', label: 'NRW Analysis Reports', description: 'Non-revenue water KPI entries and trend analysis', group: 'analysis' },
  { type: 'consumer_service', label: 'Consumer Service Reports', description: 'Consumer registry and service request history', group: 'registers' },
  { type: 'audit', label: 'Audit Reports', description: 'Handover, inspection, and O&M compliance audit summary', group: 'analysis' },
];

export const VALID_REPORT_TYPES = OM_REPORT_TYPES.map((r) => r.type);

export function getReportTypeDef(type: string): OmReportTypeDef | undefined {
  return OM_REPORT_TYPES.find((r) => r.type === type);
}
