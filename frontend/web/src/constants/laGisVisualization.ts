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
];

export const LA_GIS_VIZ_COLORS: Record<LaGisVizCategory, string> = Object.fromEntries(
  LA_GIS_VIZ_LEGEND.map((e) => [e.code, e.color]),
) as Record<LaGisVizCategory, string>;
