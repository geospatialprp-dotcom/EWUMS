export type LaGisVizCategory =
  | 'government_land'
  | 'gram_sabha'
  | 'road_corridor'
  | 'forest'
  | 'private_land'
  | 'litigation'
  | 'acquired'
  | 'rejected';

export const LA_GIS_VIZ_LEGEND: readonly {
  code: LaGisVizCategory;
  label: string;
  color: string;
}[] = [
  { code: 'government_land', label: 'Government Land', color: '#22c55e' },
  { code: 'gram_sabha', label: 'Gram Sabha', color: '#eab308' },
  { code: 'road_corridor', label: 'Road Corridor', color: '#3b82f6' },
  { code: 'forest', label: 'Forest', color: '#f97316' },
  { code: 'private_land', label: 'Private Land', color: '#ef4444' },
  { code: 'litigation', label: 'Litigation', color: '#a855f7' },
  { code: 'acquired', label: 'Acquired', color: '#9ca3af' },
  { code: 'rejected', label: 'Rejected', color: '#171717' },
] as const;

export const LA_GIS_VIZ_COLORS: Record<LaGisVizCategory, string> = Object.fromEntries(
  LA_GIS_VIZ_LEGEND.map((e) => [e.code, e.color]),
) as Record<LaGisVizCategory, string>;

const GOVERNMENT_OWNERSHIP = new Set([
  'government_land',
  'revenue_department',
  'municipality',
  'pwd',
  'national_highway',
  'railway',
  'irrigation_department',
  'defense',
  'other_department',
]);

const FOREST_OWNERSHIP = new Set([
  'forest_land',
  'forest_department',
  'civil_soyam',
  'van_panchayat',
]);

const ACQUIRED_PARCEL_STATUSES = new Set(['notified', 'awarded', 'paid', 'possession']);

export function resolveParcelVizCategory(input: {
  ownershipClassification?: string | null;
  status?: string | null;
  currentStatus?: string | null;
  mutationStatus?: string | null;
  attributes?: Record<string, unknown> | null;
}): LaGisVizCategory {
  const attrsText = JSON.stringify(input.attributes ?? {}).toLowerCase();
  const statusBlob = [
    input.currentStatus,
    input.mutationStatus,
    attrsText,
  ].filter(Boolean).join(' ').toLowerCase();

  if (/rejected|declined|not.?applicable/.test(statusBlob)) {
    return 'rejected';
  }
  if (/litigation|dispute|court|stay|contested/.test(statusBlob)) {
    return 'litigation';
  }
  if (input.status && ACQUIRED_PARCEL_STATUSES.has(input.status)) {
    return 'acquired';
  }

  const ownership = input.ownershipClassification ?? '';
  if (ownership === 'gram_sabha') return 'gram_sabha';
  if (FOREST_OWNERSHIP.has(ownership)) return 'forest';
  if (GOVERNMENT_OWNERSHIP.has(ownership)) return 'government_land';
  return 'private_land';
}

export function getParcelVizColor(input: Parameters<typeof resolveParcelVizCategory>[0]): string {
  const category = resolveParcelVizCategory(input);
  return LA_GIS_VIZ_COLORS[category];
}
