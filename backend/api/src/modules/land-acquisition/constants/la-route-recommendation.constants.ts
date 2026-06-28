/** Preset weight profiles for alternative route generation */
export const LA_ROUTE_VARIANT_PROFILES = [
  {
    key: 'current',
    label: 'Current Route',
    description: 'Existing traced alignment or balanced least-cost baseline',
    weights: {
      follow_road: 1,
      avoid_private_land: 1,
      avoid_forest: 1,
      avoid_river: 1,
      avoid_railway: 1,
      minimize_land_cost: 1,
      minimize_environmental_impact: 1,
      shortest_route: 1,
      minimize_construction_cost: 1,
    },
  },
  {
    key: 'alt1',
    label: 'Alternative Route 1',
    description: 'Road shoulder / government corridor — minimize private land acquisition',
    weights: {
      follow_road: 2,
      avoid_private_land: 2,
      minimize_land_cost: 2,
      avoid_habitation: 1.5,
      avoid_forest: 1,
      avoid_river: 1.25,
      avoid_railway: 1.25,
      minimize_environmental_impact: 0.75,
      shortest_route: 0.6,
      minimize_construction_cost: 1,
    },
  },
  {
    key: 'alt2',
    label: 'Alternative Route 2',
    description: 'Low environmental impact — avoid forest, wetlands, and wildlife zones',
    weights: {
      follow_road: 0.75,
      avoid_private_land: 1,
      avoid_forest: 2,
      minimize_environmental_impact: 2,
      avoid_river: 1.5,
      avoid_railway: 1,
      minimize_land_cost: 0.75,
      shortest_route: 0.5,
      minimize_construction_cost: 0.75,
    },
  },
  {
    key: 'alt3',
    label: 'Alternative Route 3',
    description: 'Lowest construction & acquisition cost — HDD-friendly, shortest feasible path',
    weights: {
      follow_road: 1.25,
      avoid_private_land: 1.5,
      minimize_construction_cost: 2,
      minimize_land_cost: 1.75,
      avoid_river: 1.75,
      avoid_railway: 1.75,
      avoid_forest: 1,
      minimize_environmental_impact: 0.5,
      shortest_route: 1.5,
      avoid_buildings: 1.5,
    },
  },
] as const;

export type LaRouteVariantKey = typeof LA_ROUTE_VARIANT_PROFILES[number]['key'];

/** Cost estimation rates (INR) for comparison metrics */
export const LA_ROUTE_COST_RATES = {
  pipelinePerMeter: 8500,
  riverCrossing: 450000,
  railwayCrossing: 650000,
  hddCrossing: 380000,
  pipeJackingCrossing: 520000,
  landslideCell: 12000,
  buildingCell: 80000,
  privateLandSqm: 450,
  forestLandSqm: 1200,
  govtLandSqm: 80,
  solatiumPerOwner: 25000,
  litigationRiskPerOwner: 45000,
} as const;

/** Time estimation (days) */
export const LA_ROUTE_TIME_RATES = {
  baseDays: 30,
  perRiverCrossing: 45,
  perRailwayCrossing: 60,
  perForest1000Sqm: 15,
  perOwner: 7,
  perClearanceType: 20,
  hddBonusDays: -15,
} as const;

export const LA_AI_RECOMMENDATION_TYPES = [
  { code: 'shift_pipeline_5m', label: 'Shift pipeline by 5 m', category: 'alignment' },
  { code: 'shift_road_shoulder', label: 'Shift to road shoulder', category: 'alignment' },
  { code: 'use_hdd', label: 'Use HDD Crossing', category: 'construction' },
  { code: 'use_pipe_jacking', label: 'Use Pipe Jacking', category: 'construction' },
  { code: 'increase_depth', label: 'Increase burial depth', category: 'construction' },
  { code: 'reduce_acquisition', label: 'Reduce land acquisition footprint', category: 'acquisition' },
  { code: 'avoid_private_land', label: 'Avoid private land', category: 'acquisition' },
  { code: 'avoid_litigation_land', label: 'Avoid litigation-prone parcels', category: 'acquisition' },
  { code: 'use_govt_corridor', label: 'Use government corridor', category: 'alignment' },
  { code: 'alternate_alignment', label: 'Suggest alternate alignment', category: 'alignment' },
] as const;
