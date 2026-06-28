export type OmPmFrequency = 'daily' | 'monthly' | 'quarterly' | 'annual';
export type OmPmCategory = 'pump' | 'reservoir' | 'pipeline';

export const OM_PM_FREQUENCIES: OmPmFrequency[] = ['daily', 'monthly', 'quarterly', 'annual'];

export const OM_PM_ASSET_TYPES: Record<OmPmCategory, string[]> = {
  pump: ['pump', 'motor'],
  reservoir: ['glsr', 'oht', 'cwr'],
  pipeline: [
    'gravity_main', 'rising_main', 'distribution_main', 'sub_main',
    'valve_chamber', 'air_valve', 'scour_valve',
  ],
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

export function getPmCategoryDef(category: string): OmPmCategoryDef | undefined {
  return OM_PM_CATALOG.find((c) => c.category === category);
}

export function getPmTaskDef(category: string, taskCode: string): OmPmTaskDef | undefined {
  const cat = getPmCategoryDef(category);
  return cat?.tasks.find((t) => t.code === taskCode);
}

export function computePeriodKey(frequency: OmPmFrequency, ref: Date = new Date()): string {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const d = ref.getDate();
  if (frequency === 'daily') {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  if (frequency === 'monthly') {
    return `${y}-${String(m + 1).padStart(2, '0')}`;
  }
  if (frequency === 'quarterly') {
    const q = Math.floor(m / 3) + 1;
    return `${y}-Q${q}`;
  }
  return String(y);
}

export function computePeriodDates(frequency: OmPmFrequency, ref: Date = new Date()): {
  periodKey: string;
  scheduledFor: Date;
  dueDate: Date;
} {
  const periodKey = computePeriodKey(frequency, ref);
  const y = ref.getFullYear();
  const m = ref.getMonth();

  if (frequency === 'daily') {
    const scheduledFor = new Date(y, m, ref.getDate());
    return { periodKey, scheduledFor, dueDate: new Date(scheduledFor) };
  }
  if (frequency === 'monthly') {
    const scheduledFor = new Date(y, m, 1);
    const dueDate = new Date(y, m + 1, 0);
    return { periodKey, scheduledFor, dueDate };
  }
  if (frequency === 'quarterly') {
    const qStartMonth = Math.floor(m / 3) * 3;
    const scheduledFor = new Date(y, qStartMonth, 1);
    const dueDate = new Date(y, qStartMonth + 3, 0);
    return { periodKey, scheduledFor, dueDate };
  }
  const scheduledFor = new Date(y, 0, 1);
  const dueDate = new Date(y, 11, 31);
  return { periodKey, scheduledFor, dueDate };
}
