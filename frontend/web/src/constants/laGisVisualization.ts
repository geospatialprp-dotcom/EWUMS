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
  { code: 'road_corridor', label: 'Pipeline Cover', color: '#3b82f6' },
  { code: 'forest', label: 'Forest', color: '#f97316' },
  { code: 'private_land', label: 'Private Land', color: '#ef4444' },
  { code: 'litigation', label: 'Litigation', color: '#a855f7' },
  { code: 'acquired', label: 'Acquired', color: '#9ca3af' },
  { code: 'rejected', label: 'Rejected', color: '#171717' },
];

export const LA_GIS_VIZ_COLORS: Record<LaGisVizCategory, string> = Object.fromEntries(
  LA_GIS_VIZ_LEGEND.map((e) => [e.code, e.color]),
) as Record<LaGisVizCategory, string>;

/** Point markers on the acquisition map (distinct from parcel fill colours). */
export const LA_MAP_MARKER_COLORS = {
  affectedParcel: '#f59e0b',
  clearancePending: '#e11d48',
  networkStart: '#16a34a',
  networkEnd: '#dc2626',
  networkNode: '#64748b',
} as const;

export const LA_MAP_MARKER_LABELS = {
  affectedParcel: 'Affected Parcel',
  clearancePending: 'Clearance Pending Approval',
  networkStart: 'Network Start',
  networkEnd: 'Network End',
  networkNode: 'Network Node',
} as const;

export function isClearancePendingApproval(status: string | null | undefined): boolean {
  const normalized = (status ?? 'required').toLowerCase().trim();
  return normalized !== 'approved';
}
