import {
  LA_AI_RECOMMENDATION_TYPES,
  LA_ROUTE_COST_RATES,
  LA_ROUTE_TIME_RATES,
} from '../constants/la-route-recommendation.constants';
import type { AutoRouteResult } from '../la-auto-route.service';

export type RouteComparisonMetrics = {
  routingCostIndex: number;
  lengthM: number;
  affectedOwners: number;
  forestAreaSqm: number;
  governmentLandSqm: number;
  privateLandSqm: number;
  constructionCostInr: number;
  acquisitionCostInr: number;
  totalCostInr: number;
  timeRequiredDays: number;
  environmentalImpact: number;
  riverCrossings: number;
  railwayCrossings: number;
  roadAffinityPct: number;
  landslideCells: number;
  buildingCells: number;
};

export type AiRecommendation = {
  code: string;
  label: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
  rationale: string;
};

export function estimateRouteMetrics(
  route: AutoRouteResult,
  affectedOwners: number,
  clearanceTypes: number,
): RouteComparisonMetrics {
  const cellSize = route.gridCellSizeM;
  const cellArea = cellSize * cellSize;
  const s = route.scores;

  const forestAreaSqm = Math.round(s.forestCells * cellArea);
  const privateLandSqm = Math.round(s.privateLandCells * cellArea);
  const govtLandCells = s.govtLandCells ?? 0;
  const governmentLandSqm = Math.round(govtLandCells * cellArea);

  const constructionCostInr = Math.round(
    route.lengthM * LA_ROUTE_COST_RATES.pipelinePerMeter
    + s.riverCrossings * LA_ROUTE_COST_RATES.riverCrossing
    + s.railwayCrossings * LA_ROUTE_COST_RATES.railwayCrossing
    + s.landslideCells * LA_ROUTE_COST_RATES.landslideCell
    + s.buildingCells * LA_ROUTE_COST_RATES.buildingCell,
  );

  const acquisitionCostInr = Math.round(
    privateLandSqm * LA_ROUTE_COST_RATES.privateLandSqm
    + forestAreaSqm * LA_ROUTE_COST_RATES.forestLandSqm
    + governmentLandSqm * LA_ROUTE_COST_RATES.govtLandSqm
    + affectedOwners * LA_ROUTE_COST_RATES.solatiumPerOwner,
  );

  const timeRequiredDays = Math.round(
    LA_ROUTE_TIME_RATES.baseDays
    + s.riverCrossings * LA_ROUTE_TIME_RATES.perRiverCrossing
    + s.railwayCrossings * LA_ROUTE_TIME_RATES.perRailwayCrossing
    + (forestAreaSqm / 1000) * LA_ROUTE_TIME_RATES.perForest1000Sqm
    + affectedOwners * LA_ROUTE_TIME_RATES.perOwner
    + clearanceTypes * LA_ROUTE_TIME_RATES.perClearanceType,
  );

  const environmentalImpact = Math.min(100, Math.round(
    s.environmentalCells * 3
    + s.forestCells * 2
    + s.riverCrossings * 8
    + s.railwayCrossings * 5
    + (privateLandSqm / 500),
  ));

  return {
    routingCostIndex: s.totalCost,
    lengthM: Math.round(route.lengthM),
    affectedOwners,
    forestAreaSqm,
    governmentLandSqm,
    privateLandSqm,
    constructionCostInr,
    acquisitionCostInr,
    totalCostInr: constructionCostInr + acquisitionCostInr,
    timeRequiredDays,
    environmentalImpact,
    riverCrossings: s.riverCrossings,
    railwayCrossings: s.railwayCrossings,
    roadAffinityPct: s.roadAffinityPct,
    landslideCells: s.landslideCells,
    buildingCells: s.buildingCells,
  };
}

export function generateAiRecommendations(
  metrics: RouteComparisonMetrics,
  variantKey: string,
): AiRecommendation[] {
  const recs: AiRecommendation[] = [];
  const def = (code: string) => LA_AI_RECOMMENDATION_TYPES.find((t) => t.code === code);

  if (metrics.privateLandSqm > 2000 && metrics.roadAffinityPct < 60) {
    const d = def('shift_road_shoulder');
    if (d) recs.push({
      code: d.code, label: d.label, category: d.category, priority: 'high',
      rationale: `${metrics.privateLandSqm.toLocaleString()} m² private land affected; shifting to road shoulder can reduce acquisition.`,
    });
  }

  if (metrics.roadAffinityPct >= 55) {
    const d = def('use_govt_corridor');
    if (d) recs.push({
      code: d.code, label: d.label, category: d.category, priority: 'medium',
      rationale: `Route follows road corridor (${metrics.roadAffinityPct}% affinity) — government ROW corridor is feasible.`,
    });
  }

  if (metrics.privateLandSqm > 1500) {
    const d = def('avoid_private_land');
    if (d) recs.push({
      code: d.code, label: d.label, category: d.category, priority: 'high',
      rationale: 'High private land exposure — reroute via government land or road shoulder.',
    });
  }

  if (metrics.affectedOwners > 8) {
    const d = def('avoid_litigation_land');
    if (d) recs.push({
      code: d.code, label: d.label, category: d.category, priority: 'high',
      rationale: `${metrics.affectedOwners} owners affected — litigation risk elevated; consider alternate alignment.`,
    });
  }

  if (metrics.riverCrossings > 0 || metrics.railwayCrossings > 0) {
    const d = def('use_hdd');
    if (d) recs.push({
      code: d.code, label: d.label, category: d.category, priority: 'high',
      rationale: `${metrics.riverCrossings} river and ${metrics.railwayCrossings} railway crossing(s) — HDD reduces surface disruption.`,
    });
  }

  if (metrics.railwayCrossings > 0 || metrics.buildingCells > 2) {
    const d = def('use_pipe_jacking');
    if (d) recs.push({
      code: d.code, label: d.label, category: d.category, priority: 'medium',
      rationale: 'Railway or built-up crossing detected — pipe jacking avoids open cut in sensitive zones.',
    });
  }

  if (metrics.landslideCells > 3) {
    const d = def('increase_depth');
    if (d) recs.push({
      code: d.code, label: d.label, category: d.category, priority: 'medium',
      rationale: 'Landslide-prone terrain — increase burial depth for stability.',
    });
  }

  if (metrics.privateLandSqm > 1000 && metrics.forestAreaSqm < 500) {
    const d = def('shift_pipeline_5m');
    if (d) recs.push({
      code: d.code, label: d.label, category: d.category, priority: 'low',
      rationale: 'Minor lateral shift (5 m) toward road/government boundary may avoid private parcels.',
    });
  }

  if (metrics.acquisitionCostInr > 500000) {
    const d = def('reduce_acquisition');
    if (d) recs.push({
      code: d.code, label: d.label, category: d.category, priority: 'high',
      rationale: `Estimated acquisition ₹${metrics.acquisitionCostInr.toLocaleString('en-IN')} — narrow ROW or easement mode recommended.`,
    });
  }

  if (variantKey === 'current' && metrics.environmentalImpact > 60) {
    const d = def('alternate_alignment');
    if (d) recs.push({
      code: d.code, label: d.label, category: d.category, priority: 'high',
      rationale: 'Current route has high environmental impact — review alternative alignments below.',
    });
  }

  return recs;
}

export function pickRecommendedRoute(
  routes: Array<{ key: string; metrics: RouteComparisonMetrics }>,
): string {
  if (!routes.length) return 'current';

  let bestKey = routes[0].key;
  let bestScore = Infinity;

  for (const r of routes) {
    const m = r.metrics;
    const score =
      m.totalCostInr * 0.35
      + m.timeRequiredDays * 15000
      + m.environmentalImpact * 8000
      + m.affectedOwners * 35000
      + m.privateLandSqm * 2;
    if (score < bestScore) {
      bestScore = score;
      bestKey = r.key;
    }
  }
  return bestKey;
}
