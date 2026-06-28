/** Stage 3 — mirrors backend om-inspection-catalog */

export type OmInspectionType = 'daily' | 'weekly' | 'monthly';

export interface ChecklistFieldDef {
  key: string;
  label: string;
  type: 'number' | 'text' | 'select' | 'rating';
  unit?: string;
  options?: string[];
  required?: boolean;
}

export interface OmInspectionTypeDef {
  type: OmInspectionType;
  label: string;
  frequency: string;
  roles: Array<{ code: string; label: string }>;
  fields: ChecklistFieldDef[];
}

export const OM_INSPECTION_TYPES: OmInspectionTypeDef[] = [
  {
    type: 'daily',
    label: 'Daily Inspection',
    frequency: 'Every day',
    roles: [
      { code: 'pump_operator', label: 'Pump Operator' },
      { code: 'plant_operator', label: 'Plant Operator' },
      { code: 'field_operator', label: 'Field Operator' },
    ],
    fields: [
      { key: 'pumpRunningHours', label: 'Pump Running Hours', type: 'number', unit: 'hrs' },
      { key: 'pumpStatus', label: 'Pump Status', type: 'select', options: ['running', 'stopped', 'trip', 'maintenance'], required: true },
      { key: 'reservoirWaterLevel', label: 'Reservoir Water Level', type: 'number', unit: 'm', required: true },
      { key: 'flowMeterReading', label: 'Flow Meter Reading', type: 'number', unit: 'KL' },
      { key: 'pressureReading', label: 'Pressure Reading', type: 'number', unit: 'kg/cm²' },
      { key: 'chlorineLevel', label: 'Chlorine Level', type: 'number', unit: 'ppm', required: true },
      { key: 'powerConsumption', label: 'Power Consumption', type: 'number', unit: 'kWh' },
      { key: 'leakageObservations', label: 'Leakage Observations', type: 'text' },
    ],
  },
  {
    type: 'weekly',
    label: 'Weekly Inspection',
    frequency: 'Every week',
    roles: [{ code: 'junior_engineer', label: 'Junior Engineer' }],
    fields: [
      { key: 'pumpHouseCondition', label: 'Pump House Condition', type: 'rating', options: ['good', 'fair', 'poor'], required: true },
      { key: 'reservoirCondition', label: 'Reservoir Condition', type: 'rating', options: ['good', 'fair', 'poor'], required: true },
      { key: 'valveCondition', label: 'Valve Condition', type: 'rating', options: ['good', 'fair', 'poor'], required: true },
      { key: 'distributionNetworkCondition', label: 'Distribution Network Condition', type: 'rating', options: ['good', 'fair', 'poor'], required: true },
      { key: 'electricalSafety', label: 'Electrical Safety', type: 'rating', options: ['good', 'fair', 'poor'], required: true },
      { key: 'leakagePoints', label: 'Leakage Points', type: 'text' },
    ],
  },
  {
    type: 'monthly',
    label: 'Monthly Inspection',
    frequency: 'Every month',
    roles: [{ code: 'assistant_engineer', label: 'Assistant Engineer' }],
    fields: [
      { key: 'assetHealth', label: 'Asset Health', type: 'rating', options: ['excellent', 'good', 'fair', 'poor'], required: true },
      { key: 'waterSupplyPerformance', label: 'Water Supply Performance', type: 'rating', options: ['excellent', 'good', 'fair', 'poor'], required: true },
      { key: 'omCompliance', label: 'O&M Compliance', type: 'rating', options: ['excellent', 'good', 'fair', 'poor'], required: true },
      { key: 'serviceCoverage', label: 'Service Coverage', type: 'rating', options: ['excellent', 'good', 'fair', 'poor'], required: true },
      { key: 'energyEfficiency', label: 'Energy Efficiency', type: 'rating', options: ['excellent', 'good', 'fair', 'poor'], required: true },
    ],
  },
];

export const OM_INSPECTION_ROLE_LABELS: Record<string, string> = Object.fromEntries(
  OM_INSPECTION_TYPES.flatMap((t) => t.roles.map((r) => [r.code, r.label])),
);

export function getInspectionTypeDef(type: OmInspectionType): OmInspectionTypeDef {
  return OM_INSPECTION_TYPES.find((t) => t.type === type) ?? OM_INSPECTION_TYPES[0];
}
