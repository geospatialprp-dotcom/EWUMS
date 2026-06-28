export type OmLifecycleCategory =
  | 'pumps'
  | 'pipelines'
  | 'reservoirs'
  | 'transformers'
  | 'electrical_systems'
  | 'consumer_meters';

export type OmConditionGrade = 'excellent' | 'good' | 'fair' | 'poor' | 'critical';

export type OmRenewalPlanType = 'rehabilitation' | 'replacement' | 'annual_capital';

export type OmRenewalPlanStatus = 'draft' | 'approved' | 'in_progress' | 'completed' | 'cancelled';

export interface OmLifecycleCategoryDef {
  category: OmLifecycleCategory;
  label: string;
  typeCodes: string[];
  defaultDesignLifeYears: number;
}

export const OM_LIFECYCLE_CATEGORIES: OmLifecycleCategoryDef[] = [
  { category: 'pumps', label: 'Pumps', typeCodes: ['pump', 'motor'], defaultDesignLifeYears: 15 },
  {
    category: 'pipelines',
    label: 'Pipelines',
    typeCodes: ['gravity_main', 'rising_main', 'distribution_main', 'sub_main'],
    defaultDesignLifeYears: 30,
  },
  { category: 'reservoirs', label: 'Reservoirs', typeCodes: ['glsr', 'oht', 'cwr'], defaultDesignLifeYears: 40 },
  { category: 'transformers', label: 'Transformers', typeCodes: ['transformer'], defaultDesignLifeYears: 25 },
  {
    category: 'electrical_systems',
    label: 'Electrical Systems',
    typeCodes: ['ht_line', 'lt_panel', 'dg_set', 'solar_system'],
    defaultDesignLifeYears: 20,
  },
  { category: 'consumer_meters', label: 'Consumer Meters', typeCodes: ['consumer_meter'], defaultDesignLifeYears: 10 },
];

export const OM_CONDITION_GRADES: Array<{ code: OmConditionGrade; label: string; minHealth: number }> = [
  { code: 'excellent', label: 'Excellent', minHealth: 80 },
  { code: 'good', label: 'Good', minHealth: 65 },
  { code: 'fair', label: 'Fair', minHealth: 50 },
  { code: 'poor', label: 'Poor', minHealth: 35 },
  { code: 'critical', label: 'Critical', minHealth: 0 },
];

export const OM_RENEWAL_PLAN_TYPES: Array<{ code: OmRenewalPlanType; label: string }> = [
  { code: 'rehabilitation', label: 'Rehabilitation Plan' },
  { code: 'replacement', label: 'Replacement Plan' },
  { code: 'annual_capital', label: 'Annual Capital Renewal Plan' },
];

export const OM_LIFECYCLE_WORKFLOW = [
  { step: 'health_index', label: 'Asset Health Index' },
  { step: 'remaining_life', label: 'Remaining Useful Life' },
  { step: 'rehabilitation', label: 'Rehabilitation Plans' },
  { step: 'replacement', label: 'Replacement Plans' },
  { step: 'annual_renewal', label: 'Annual Capital Renewal Plan' },
];

const TYPE_TO_CATEGORY = new Map<string, OmLifecycleCategory>();
for (const cat of OM_LIFECYCLE_CATEGORIES) {
  for (const code of cat.typeCodes) {
    TYPE_TO_CATEGORY.set(code, cat.category);
  }
}

export function getLifecycleCategoryForType(typeCode: string): OmLifecycleCategory | null {
  return TYPE_TO_CATEGORY.get(typeCode) ?? null;
}

export function getLifecycleCategoryDef(category: OmLifecycleCategory): OmLifecycleCategoryDef {
  return OM_LIFECYCLE_CATEGORIES.find((c) => c.category === category)!;
}

export function getDefaultDesignLifeYears(typeCode: string): number {
  const category = getLifecycleCategoryForType(typeCode);
  if (!category) return 20;
  return getLifecycleCategoryDef(category).defaultDesignLifeYears;
}

export function healthIndexToConditionGrade(healthIndex: number): OmConditionGrade {
  if (healthIndex >= 80) return 'excellent';
  if (healthIndex >= 65) return 'good';
  if (healthIndex >= 50) return 'fair';
  if (healthIndex >= 35) return 'poor';
  return 'critical';
}

export function recommendPlanType(healthIndex: number, remainingLifeYears: number): OmRenewalPlanType | null {
  if (healthIndex < 35 || remainingLifeYears <= 1) return 'replacement';
  if (healthIndex < 60 || remainingLifeYears <= 3) return 'rehabilitation';
  return null;
}

export const VALID_LIFECYCLE_CATEGORIES = OM_LIFECYCLE_CATEGORIES.map((c) => c.category);
export const VALID_CONDITION_GRADES = OM_CONDITION_GRADES.map((g) => g.code);
export const VALID_RENEWAL_PLAN_TYPES = OM_RENEWAL_PLAN_TYPES.map((t) => t.code);
export const VALID_RENEWAL_PLAN_STATUSES = ['draft', 'approved', 'in_progress', 'completed', 'cancelled'];
