/** Stage 4 — Preventive maintenance catalogue (mirrors backend om-pm-catalog) */

export type OmPmFrequency = 'daily' | 'monthly' | 'quarterly' | 'annual';
export type OmPmCategory = 'pump' | 'reservoir' | 'pipeline';

export const OM_PM_FREQUENCY_LABELS: Record<OmPmFrequency, string> = {
  daily: 'Daily',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Annual',
};

export const OM_PM_CATEGORY_LABELS: Record<OmPmCategory, string> = {
  pump: 'Pump Maintenance',
  reservoir: 'Reservoir Maintenance',
  pipeline: 'Pipeline Maintenance',
};

export interface OmPmTaskDef {
  code: string;
  name: string;
  frequency: OmPmFrequency;
}

export interface OmPmCategoryDef {
  category: OmPmCategory;
  label: string;
  tasks: OmPmTaskDef[];
}

export const OM_PM_CATALOG: OmPmCategoryDef[] = [
  {
    category: 'pump',
    label: 'Pump Maintenance',
    tasks: [
      { code: 'pump_lubrication_check', name: 'Lubrication Check', frequency: 'daily' },
      { code: 'pump_temperature_check', name: 'Temperature Check', frequency: 'daily' },
      { code: 'pump_noise_check', name: 'Noise Check', frequency: 'daily' },
      { code: 'pump_bearing_inspection', name: 'Bearing Inspection', frequency: 'monthly' },
      { code: 'pump_alignment_check', name: 'Alignment Check', frequency: 'monthly' },
      { code: 'pump_overhauling', name: 'Overhauling', frequency: 'annual' },
    ],
  },
  {
    category: 'reservoir',
    label: 'Reservoir Maintenance',
    tasks: [
      { code: 'reservoir_visual_inspection', name: 'Visual Inspection', frequency: 'monthly' },
      { code: 'reservoir_cleaning_disinfection', name: 'Cleaning and Disinfection', frequency: 'quarterly' },
      { code: 'reservoir_structural_inspection', name: 'Structural Inspection', frequency: 'annual' },
    ],
  },
  {
    category: 'pipeline',
    label: 'Pipeline Maintenance',
    tasks: [
      { code: 'pipeline_leakage_survey', name: 'Leakage Survey', frequency: 'monthly' },
      { code: 'pipeline_valve_operation_testing', name: 'Valve Operation Testing', frequency: 'quarterly' },
      { code: 'pipeline_network_audit', name: 'Network Audit', frequency: 'annual' },
    ],
  },
];

export const OM_PM_CATEGORIES: OmPmCategory[] = ['pump', 'reservoir', 'pipeline'];

export function getPmCategoryDef(category: OmPmCategory): OmPmCategoryDef {
  return OM_PM_CATALOG.find((c) => c.category === category)!;
}

export function statusColor(status: string): 'default' | 'success' | 'warning' | 'error' {
  if (status === 'completed') return 'success';
  if (status === 'overdue') return 'error';
  if (status === 'scheduled') return 'warning';
  return 'default';
}
