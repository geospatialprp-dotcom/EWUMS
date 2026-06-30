/** Routing criteria exposed to engineers — maps to cost penalties in la-auto-route.service */
export const LA_ROUTING_CRITERIA = [
  {
    code: 'follow_road',
    label: 'Follow road corridor whenever possible',
    description: 'Prefer PWD, NH, SH, and PMGSY alignments',
    defaultWeight: 1,
    layerCodes: ['pwd_road', 'national_highway', 'state_highway', 'pmgsy_roads'],
  },
  {
    code: 'avoid_private_land',
    label: 'Avoid private land',
    description: 'Penalize cadastral parcels and non-government tenure',
    defaultWeight: 1,
    layerCodes: ['khasra_boundary', 'land_ownership', 'khata_boundary'],
  },
  {
    code: 'avoid_habitation',
    label: 'Avoid dense habitation',
    description: 'Penalize buildings, schools, and hospitals',
    defaultWeight: 1,
    layerCodes: ['buildings', 'schools', 'hospitals'],
  },
  {
    code: 'avoid_forest',
    label: 'Avoid forest land',
    description: 'Penalize forest, reserved, protected forest, van panchayat, soyam',
    defaultWeight: 1,
    layerCodes: ['forest_land', 'reserved_forest', 'protected_forest', 'van_panchayat', 'civil_soyam_land', 'national_park'],
  },
  {
    code: 'avoid_landslide',
    label: 'Avoid landslide zones',
    defaultWeight: 1,
    layerCodes: ['landslide_zone'],
  },
  {
    code: 'avoid_river',
    label: 'Avoid river crossings',
    defaultWeight: 1,
    layerCodes: ['river', 'lake', 'wetlands'],
  },
  {
    code: 'avoid_railway',
    label: 'Avoid railway crossings',
    defaultWeight: 1,
    layerCodes: ['railways'],
  },
  {
    code: 'avoid_buildings',
    label: 'Avoid buildings',
    defaultWeight: 1,
    layerCodes: ['buildings'],
  },
  {
    code: 'avoid_monuments',
    label: 'Avoid protected monuments',
    defaultWeight: 1,
    layerCodes: ['archaeological_sites', 'temples'],
  },
  {
    code: 'avoid_steep_slope',
    label: 'Avoid steep slopes',
    defaultWeight: 1,
    layerCodes: ['slope'],
  },
  {
    code: 'minimize_excavation',
    label: 'Minimize excavation',
    description: 'Penalize steep terrain and landslide-prone areas',
    defaultWeight: 1,
    layerCodes: ['slope', 'landslide_zone', 'contour'],
  },
  {
    code: 'minimize_pumping_head',
    label: 'Minimize pumping head',
    description: 'Prefer lower elevation where DEM/slope data is available',
    defaultWeight: 1,
    layerCodes: ['dem', 'slope'],
  },
  {
    code: 'minimize_land_cost',
    label: 'Minimize land acquisition cost',
    defaultWeight: 1,
    layerCodes: ['khasra_boundary', 'land_ownership', 'revenue_land', 'nazul_land'],
  },
  {
    code: 'shortest_route',
    label: 'Shortest feasible route',
    defaultWeight: 1,
    layerCodes: [],
  },
  {
    code: 'minimize_construction_cost',
    label: 'Lowest construction cost',
    description: 'Balances length, crossings, and terrain difficulty',
    defaultWeight: 1,
    layerCodes: ['national_highway', 'state_highway', 'slope', 'river', 'railways'],
  },
  {
    code: 'minimize_environmental_impact',
    label: 'Lowest environmental impact',
    defaultWeight: 1,
    layerCodes: ['forest_land', 'wetlands', 'wildlife_sanctuary', 'eco_sensitive_zones', 'national_park'],
  },
] as const;

export type LaRoutingCriteriaCode = typeof LA_ROUTING_CRITERIA[number]['code'];

export const LA_ROUTING_DEFAULTS = {
  gridCellSizeM: 50,
  maxGridCells: 8000,
  /** Tighter cap when routing along an imported network (avoids OOM on wide bboxes). */
  maxGridCellsImportedNetwork: 4000,
  paddingM: 400,
  roadSnapDistanceM: 25,
  /** PostGIS / Node guard for heavy union + trace operations. */
  gisQueryTimeoutMs: 120_000,
  /** Imported SHP / GeoJSON limits — 17 segments is fine; cap prevents abuse. */
  maxImportedSegments: 128,
  maxVerticesPerLine: 8_000,
  /** ST_Union chunk size — avoids single-query OOM on multi-segment networks. */
  mergeChunkSize: 8,
} as const;

/** Base penalty multipliers (scaled by criteria weights 0–2) */
export const LA_ROUTING_PENALTIES = {
  forest: 420,
  landslide: 520,
  river: 280,
  railway: 320,
  building: 380,
  monument: 460,
  habitation: 220,
  privateLand: 260,
  steepSlope: 180,
  environmental: 400,
  landCost: 200,
  excavation: 150,
  roadBonus: 0.65,
} as const;

export function normalizeRoutingWeights(
  input?: Partial<Record<string, number>>,
): Record<string, number> {
  const weights: Record<string, number> = {};
  for (const c of LA_ROUTING_CRITERIA) {
    const raw = input?.[c.code];
    weights[c.code] = typeof raw === 'number' && raw >= 0 && raw <= 2 ? raw : c.defaultWeight;
  }
  return weights;
}
