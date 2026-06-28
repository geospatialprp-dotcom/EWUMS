/** Stage 12 — Asset Lifecycle & Renewal (mirrors backend) */

export const OM_LIFECYCLE_CATEGORIES = [
  { category: 'pumps' as const, label: 'Pumps' },
  { category: 'pipelines' as const, label: 'Pipelines' },
  { category: 'reservoirs' as const, label: 'Reservoirs' },
  { category: 'transformers' as const, label: 'Transformers' },
  { category: 'electrical_systems' as const, label: 'Electrical Systems' },
  { category: 'consumer_meters' as const, label: 'Consumer Meters' },
];

export const OM_CONDITION_GRADES = [
  { code: 'excellent', label: 'Excellent', minHealth: 80 },
  { code: 'good', label: 'Good', minHealth: 65 },
  { code: 'fair', label: 'Fair', minHealth: 50 },
  { code: 'poor', label: 'Poor', minHealth: 35 },
  { code: 'critical', label: 'Critical', minHealth: 0 },
];

export const OM_RENEWAL_PLAN_TYPES = [
  { code: 'rehabilitation', label: 'Rehabilitation Plan' },
  { code: 'replacement', label: 'Replacement Plan' },
  { code: 'annual_capital', label: 'Annual Capital Renewal Plan' },
];

export function healthColor(index: number): 'success' | 'warning' | 'error' | 'default' {
  if (index >= 80) return 'success';
  if (index >= 50) return 'warning';
  if (index >= 35) return 'error';
  return 'error';
}

export function conditionChipColor(grade: string): 'success' | 'warning' | 'error' | 'default' {
  if (grade === 'excellent' || grade === 'good') return 'success';
  if (grade === 'fair') return 'warning';
  if (grade === 'poor' || grade === 'critical') return 'error';
  return 'default';
}

export function planStatusColor(status: string): 'success' | 'warning' | 'info' | 'default' {
  if (status === 'completed') return 'success';
  if (status === 'approved' || status === 'in_progress') return 'info';
  if (status === 'draft') return 'warning';
  return 'default';
}
