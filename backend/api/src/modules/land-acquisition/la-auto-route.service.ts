import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ProjectFeatureClass } from '../projects/entities/project-feature-class.entity';
import { LA_ALIGNMENT_FEATURE_CODES } from './constants/la-acquisition.constants';
import {
  LA_ROUTING_DEFAULTS,
  LA_ROUTING_PENALTIES,
  normalizeRoutingWeights,
} from './constants/la-routing.constants';
import { LA_ROUTE_VARIANT_PROFILES } from './constants/la-route-recommendation.constants';
import {
  estimateRouteMetrics,
  generateAiRecommendations,
  pickRecommendedRoute,
  type AiRecommendation,
  type RouteComparisonMetrics,
} from './utils/la-route-recommendation.util';

type UtmPoint = { x: number; y: number };
type GridCell = { idx: number; i: number; j: number; x: number; y: number };
type CostRow = {
  idx: number;
  cost: number;
  road: boolean;
  forest: boolean;
  river: boolean;
  railway: boolean;
  building: boolean;
  privateLand: boolean;
  govtLand: boolean;
  landslide: boolean;
  environmental: boolean;
};

export type AutoRouteInput = {
  tenantId: string;
  projectId: string;
  start: [number, number];
  end: [number, number];
  gridCellSizeM?: number;
  weights?: Partial<Record<string, number>>;
  /** GeoJSON LineStrings — inflate cost in buffer around prior routes to force divergence */
  avoidCorridors?: Array<{ type: 'LineString'; coordinates: [number, number][] }>;
  avoidCorridorBufferM?: number;
  avoidCorridorMultiplier?: number;
  /** Imported pipeline network — reduce cost near line segments to guide routing */
  networkCorridors?: Array<{ type: 'LineString'; coordinates: [number, number][] }>;
  networkCorridorBufferM?: number;
  networkCorridorMultiplier?: number;
};

export type AutoRouteResult = {
  geometry: { type: 'LineString'; coordinates: [number, number][] };
  lengthM: number;
  gridCellSizeM: number;
  cellCount: number;
  scores: {
    totalCost: number;
    roadAffinityPct: number;
    forestCells: number;
    riverCrossings: number;
    railwayCrossings: number;
    buildingCells: number;
    privateLandCells: number;
    govtLandCells: number;
    landslideCells: number;
    environmentalCells: number;
  };
  weights: Record<string, number>;
};

export type RouteAlternativeResult = {
  key: string;
  label: string;
  description: string;
  geometry: { type: 'LineString'; coordinates: [number, number][] };
  lengthM: number;
  scores: AutoRouteResult['scores'];
  metrics: RouteComparisonMetrics;
  recommendations: AiRecommendation[];
  isExisting: boolean;
};

export type RouteRecommendationResult = {
  routes: RouteAlternativeResult[];
  recommendedRouteKey: string;
  comparison: {
    metrics: Array<{ key: string; label: string }>;
    rows: Record<string, string | number>[];
  };
  snappedStart?: [number, number];
  snappedEnd?: [number, number];
};

@Injectable()
export class LaAutoRouteService {
  constructor(
    @InjectRepository(ProjectFeatureClass) private fcRepo: Repository<ProjectFeatureClass>,
    private dataSource: DataSource,
  ) {}

  async generateRoute(input: AutoRouteInput): Promise<AutoRouteResult> {
    const cellSize = input.gridCellSizeM ?? LA_ROUTING_DEFAULTS.gridCellSizeM;
    const weights = normalizeRoutingWeights(input.weights);

    const [startUtm, endUtm] = await this.toUtmPoints(input.start, input.end);
    const grid = this.buildGrid(startUtm, endUtm, cellSize);
    const costs = await this.computeCellCosts(input.tenantId, input.projectId, grid, weights);
    const costMap = new Map<number, CostRow>();
    for (const row of costs) costMap.set(row.idx, row);

    if (input.avoidCorridors?.length) {
      await this.applyCorridorInflation(
        input.tenantId,
        costMap,
        grid,
        input.avoidCorridors,
        input.avoidCorridorBufferM ?? 80,
        input.avoidCorridorMultiplier ?? 4,
      );
    }

    if (input.networkCorridors?.length) {
      await this.applyNetworkCorridorBonus(
        costMap,
        grid,
        input.networkCorridors,
        input.networkCorridorBufferM ?? 60,
        input.networkCorridorMultiplier ?? 0.45,
      );
    }

    const startCell = this.nearestCell(grid, startUtm);
    const endCell = this.nearestCell(grid, endUtm);
    const path = this.runAStar(grid, costMap, startCell, endCell, cellSize, weights);
    if (!path.length) {
      throw new BadRequestException(
        'Could not find a feasible route between start and end. Try adjusting points or importing road/constraint layers.',
      );
    }

    const wgsCoords = await this.pathToWgs84(path);
    const simplified = await this.simplifyLine(wgsCoords);
    const lengthM = await this.lineLengthM(simplified);
    const scores = this.scorePath(path, costMap, cellSize);

    return {
      geometry: { type: 'LineString', coordinates: simplified },
      lengthM,
      gridCellSizeM: cellSize,
      cellCount: grid.length,
      scores,
      weights,
    };
  }

  async generateRouteRecommendations(input: {
    tenantId: string;
    projectId: string;
    laCaseId: string;
    start: [number, number];
    end: [number, number];
    gridCellSizeM?: number;
    rowWidthM?: number;
    baseWeights?: Partial<Record<string, number>>;
    importedNetwork?: {
      type: 'FeatureCollection';
      features?: Array<{ geometry?: { type: string; coordinates: unknown } } | null>;
    };
    snapToImportedNetwork?: boolean;
    useImportedAsCorridor?: boolean;
  }): Promise<RouteRecommendationResult> {
    const cellSize = input.gridCellSizeM ?? LA_ROUTING_DEFAULTS.gridCellSizeM;
    const rowWidth = input.rowWidthM ?? 6;
    const existing = await this.getExistingAlignmentGeometry(input.tenantId, input.laCaseId);

    const networkLines = input.importedNetwork
      ? await this.extractLineStringsFromNetwork(input.importedNetwork)
      : [];
    const mergedImported = networkLines.length
      ? await this.mergeLineStrings(networkLines)
      : null;

    let start = input.start;
    let end = input.end;
    if (input.snapToImportedNetwork !== false && mergedImported?.coordinates?.length) {
      const snapped = await this.snapEndpointsToLine(start, end, mergedImported);
      start = snapped.start;
      end = snapped.end;
    }

    const networkCorridors = input.useImportedAsCorridor !== false && networkLines.length
      ? networkLines
      : undefined;

    const routes: RouteAlternativeResult[] = [];
    const avoidCorridors: Array<{ type: 'LineString'; coordinates: [number, number][] }> = [];

    if (mergedImported?.coordinates?.length) {
      const importedRoute = await this.buildRouteFromGeometry(
        input.tenantId,
        input.projectId,
        mergedImported,
        cellSize,
        input.baseWeights ?? {},
      );
      const affectedOwners = await this.estimateAffectedOwners(
        input.tenantId,
        input.projectId,
        importedRoute.geometry,
        rowWidth,
      );
      const clearanceTypes = this.estimateClearanceTypes(importedRoute.scores);
      const metrics = estimateRouteMetrics(importedRoute, affectedOwners, clearanceTypes);
      const recommendations = generateAiRecommendations(metrics, 'current');

      routes.push({
        key: 'imported',
        label: 'Imported Pipeline',
        description: 'Alignment from uploaded pipeline network (SHP / GeoJSON)',
        geometry: importedRoute.geometry,
        lengthM: importedRoute.lengthM,
        scores: importedRoute.scores,
        metrics,
        recommendations,
        isExisting: true,
      });
      avoidCorridors.push(importedRoute.geometry);
    }

    for (const profile of LA_ROUTE_VARIANT_PROFILES) {
      let route: AutoRouteResult;
      let isExisting = false;

      if (profile.key === 'current' && existing?.coordinates?.length) {
        route = await this.buildRouteFromGeometry(
          input.tenantId,
          input.projectId,
          existing,
          cellSize,
          profile.weights,
        );
        isExisting = true;
      } else {
        const weights = profile.key === 'current' && input.baseWeights
          ? { ...profile.weights, ...input.baseWeights }
          : profile.weights;

        route = await this.generateRoute({
          tenantId: input.tenantId,
          projectId: input.projectId,
          start,
          end,
          gridCellSizeM: cellSize,
          weights,
          avoidCorridors: avoidCorridors.length ? [...avoidCorridors] : undefined,
          avoidCorridorBufferM: 80,
          avoidCorridorMultiplier: profile.key === 'current' ? 1 : 4,
          networkCorridors,
          networkCorridorBufferM: 60,
          networkCorridorMultiplier: profile.key === 'current' ? 0.35 : 0.65,
        });
      }

      avoidCorridors.push(route.geometry);

      const affectedOwners = await this.estimateAffectedOwners(
        input.tenantId,
        input.projectId,
        route.geometry,
        rowWidth,
      );
      const clearanceTypes = this.estimateClearanceTypes(route.scores);
      const metrics = estimateRouteMetrics(route, affectedOwners, clearanceTypes);
      const recommendations = generateAiRecommendations(metrics, profile.key);

      routes.push({
        key: profile.key,
        label: profile.label,
        description: profile.description,
        geometry: route.geometry,
        lengthM: route.lengthM,
        scores: route.scores,
        metrics,
        recommendations,
        isExisting,
      });
    }

    const recommendedRouteKey = pickRecommendedRoute(
      routes.map((r) => ({ key: r.key, metrics: r.metrics })),
    );

    const comparison = this.buildComparisonTable(routes);

    return {
      routes,
      recommendedRouteKey,
      comparison,
      snappedStart: start,
      snappedEnd: end,
    };
  }

  async getExistingAlignmentGeometry(
    tenantId: string,
    laCaseId: string,
  ): Promise<{ type: 'LineString'; coordinates: [number, number][] } | null> {
    const rows = await this.dataSource.query(
      `SELECT ST_AsGeoJSON(ST_LineMerge(ST_Union(geometry)))::json AS geom
       FROM la_alignment_segments
       WHERE tenant_id = $1 AND la_case_id = $2 AND geometry IS NOT NULL`,
      [tenantId, laCaseId],
    ) as Array<{ geom: { type: string; coordinates: [number, number][] } | null }>;
    const geom = rows[0]?.geom;
    if (!geom || geom.type !== 'LineString' || !geom.coordinates?.length) return null;
    return { type: 'LineString', coordinates: geom.coordinates };
  }

  async estimateAffectedOwners(
    tenantId: string,
    projectId: string,
    geometry: { type: 'LineString'; coordinates: [number, number][] },
    rowWidthM: number,
  ): Promise<number> {
    const rows = await this.dataSource.query(
      `WITH corridor AS (
         SELECT ST_Buffer(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)::geography, $4)::geometry AS geom
       )
       SELECT COUNT(DISTINCT COALESCE(
         pf.attributes->>'owner_name',
         pf.attributes->>'OwnerName',
         pf.attributes->>'owner',
         pf.attributes->>'khata_no',
         pf.attributes->>'khasra_no',
         pf.id::text
       ))::int AS owners
       FROM project_features pf
       JOIN project_feature_classes fc ON fc.id = pf.feature_class_id
       CROSS JOIN corridor c
       WHERE pf.tenant_id = $2 AND pf.project_id = $3
         AND pf.geometry IS NOT NULL
         AND lower(fc.code) = ANY($5)
         AND ST_Intersects(
           ST_Transform(pf.geometry, 32644),
           ST_Transform(c.geom, 32644)
         )`,
      [
        JSON.stringify(geometry),
        tenantId,
        projectId,
        rowWidthM,
        ['khasra_boundary', 'land_ownership', 'khata_boundary', 'la_parcels', 'cadastral_parcels', 'revenue_parcels', 'land_parcels'],
      ],
    ) as Array<{ owners: number }>;
    return Number(rows[0]?.owners ?? 0);
  }

  private estimateClearanceTypes(scores: AutoRouteResult['scores']): number {
    let n = 0;
    if (scores.forestCells > 0) n += 1;
    if (scores.riverCrossings > 0) n += 1;
    if (scores.railwayCrossings > 0) n += 1;
    if (scores.environmentalCells > 0) n += 1;
    if (scores.privateLandCells > 5) n += 1;
    return n;
  }

  private buildComparisonTable(routes: RouteAlternativeResult[]) {
    const metricDefs: Array<{ key: keyof RouteComparisonMetrics; label: string; format: (v: number) => string }> = [
      { key: 'lengthM', label: 'Length (m)', format: (v) => v.toLocaleString('en-IN') },
      { key: 'affectedOwners', label: 'Affected owners', format: (v) => String(v) },
      { key: 'forestAreaSqm', label: 'Forest area (m²)', format: (v) => v.toLocaleString('en-IN') },
      { key: 'governmentLandSqm', label: 'Government land (m²)', format: (v) => v.toLocaleString('en-IN') },
      { key: 'privateLandSqm', label: 'Private land (m²)', format: (v) => v.toLocaleString('en-IN') },
      { key: 'constructionCostInr', label: 'Construction cost (₹)', format: (v) => v.toLocaleString('en-IN') },
      { key: 'acquisitionCostInr', label: 'Acquisition cost (₹)', format: (v) => v.toLocaleString('en-IN') },
      { key: 'totalCostInr', label: 'Total cost (₹)', format: (v) => v.toLocaleString('en-IN') },
      { key: 'timeRequiredDays', label: 'Time required (days)', format: (v) => String(v) },
      { key: 'environmentalImpact', label: 'Environmental impact (0–100)', format: (v) => String(v) },
    ];

    const rows = metricDefs.map((def) => {
      const row: Record<string, string | number> = { metric: def.label };
      for (const route of routes) {
        row[route.key] = def.format(Number(route.metrics[def.key] ?? 0));
      }
      return row;
    });

    return {
      metrics: metricDefs.map((d) => ({ key: d.key, label: d.label })),
      rows,
    };
  }

  async buildRouteFromExistingGeometry(
    tenantId: string,
    projectId: string,
    geometry: { type: 'LineString'; coordinates: [number, number][] },
    gridCellSizeM?: number,
    weights?: Partial<Record<string, number>>,
  ): Promise<AutoRouteResult> {
    return this.buildRouteFromGeometry(
      tenantId,
      projectId,
      geometry,
      gridCellSizeM ?? LA_ROUTING_DEFAULTS.gridCellSizeM,
      weights ?? {},
    );
  }

  private async buildRouteFromGeometry(
    tenantId: string,
    projectId: string,
    geometry: { type: 'LineString'; coordinates: [number, number][] },
    cellSize: number,
    weights: Partial<Record<string, number>>,
  ): Promise<AutoRouteResult> {
    const normalized = normalizeRoutingWeights(weights);
    const lengthM = await this.lineLengthM(geometry.coordinates);
    const bbox = await this.geometryBboxUtm(geometry);
    const grid = this.buildGrid(
      { x: bbox.minX, y: bbox.minY },
      { x: bbox.maxX, y: bbox.maxY },
      cellSize,
    );
    const costs = await this.computeCellCosts(tenantId, projectId, grid, normalized);
    const costMap = new Map<number, CostRow>();
    for (const row of costs) costMap.set(row.idx, row);

    const pathCells = await this.sampleLineToGridCells(geometry, grid);
    const scores = this.scorePath(pathCells, costMap, cellSize);

    return {
      geometry,
      lengthM,
      gridCellSizeM: cellSize,
      cellCount: grid.length,
      scores,
      weights: normalized,
    };
  }

  private async geometryBboxUtm(geometry: { type: 'LineString'; coordinates: [number, number][] }) {
    const rows = await this.dataSource.query(
      `SELECT
         ST_XMin(g) AS min_x, ST_XMax(g) AS max_x,
         ST_YMin(g) AS min_y, ST_YMax(g) AS max_y
       FROM (
         SELECT ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326), 32644) AS g
       ) t`,
      [JSON.stringify(geometry)],
    ) as Array<{ min_x: number; max_x: number; min_y: number; max_y: number }>;
    const r = rows[0];
    return {
      minX: Number(r.min_x),
      maxX: Number(r.max_x),
      minY: Number(r.min_y),
      maxY: Number(r.max_y),
    };
  }

  private async sampleLineToGridCells(
    geometry: { type: 'LineString'; coordinates: [number, number][] },
    grid: GridCell[],
  ): Promise<GridCell[]> {
    const rows = await this.dataSource.query(
      `WITH line AS (
         SELECT ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326), 32644) AS geom
       ),
       pts AS (
         SELECT (ST_DumpPoints(line.geom)).geom AS pt FROM line
       )
       SELECT ST_X(pt) AS x, ST_Y(pt) AS y FROM pts`,
      [JSON.stringify(geometry)],
    ) as Array<{ x: number; y: number }>;

    return rows.map((r) => this.nearestCell(grid, { x: Number(r.x), y: Number(r.y) }));
  }

  private async applyCorridorInflation(
    tenantId: string,
    costMap: Map<number, CostRow>,
    grid: GridCell[],
    corridors: Array<{ type: 'LineString'; coordinates: [number, number][] }>,
    bufferM: number,
    multiplier: number,
  ) {
    if (multiplier <= 1) return;
    const payload = grid.map((c) => ({ idx: c.idx, x: c.x, y: c.y }));
    const corridorJson = JSON.stringify({
      type: 'MultiLineString',
      coordinates: corridors.map((c) => c.coordinates),
    });

    const rows = await this.dataSource.query(
      `WITH centroids AS (
         SELECT
           (elem->>'idx')::int AS idx,
           ST_Transform(
             ST_SetSRID(ST_MakePoint((elem->>'x')::float, (elem->>'y')::float), 32644),
             4326
           ) AS geom
         FROM jsonb_array_elements($1::jsonb) elem
       ),
       avoid_zone AS (
         SELECT ST_Buffer(ST_SetSRID(ST_GeomFromGeoJSON($2), 4326)::geography, $3)::geometry AS geom
       )
       SELECT c.idx
       FROM centroids c, avoid_zone z
       WHERE ST_Intersects(c.geom, z.geom)`,
      [JSON.stringify(payload), corridorJson, bufferM],
    ) as Array<{ idx: number }>;

    for (const row of rows) {
      const cell = costMap.get(row.idx);
      if (cell) cell.cost *= multiplier;
    }
  }

  private async applyNetworkCorridorBonus(
    costMap: Map<number, CostRow>,
    grid: GridCell[],
    corridors: Array<{ type: 'LineString'; coordinates: [number, number][] }>,
    bufferM: number,
    multiplier: number,
  ) {
    if (multiplier >= 1) return;
    const payload = grid.map((c) => ({ idx: c.idx, x: c.x, y: c.y }));
    const corridorJson = JSON.stringify({
      type: 'MultiLineString',
      coordinates: corridors.map((c) => c.coordinates),
    });

    const rows = await this.dataSource.query(
      `WITH centroids AS (
         SELECT
           (elem->>'idx')::int AS idx,
           ST_Transform(
             ST_SetSRID(ST_MakePoint((elem->>'x')::float, (elem->>'y')::float), 32644),
             4326
           ) AS geom
         FROM jsonb_array_elements($1::jsonb) elem
       ),
       network_zone AS (
         SELECT ST_Buffer(ST_SetSRID(ST_GeomFromGeoJSON($2), 4326)::geography, $3)::geometry AS geom
       )
       SELECT c.idx
       FROM centroids c, network_zone z
       WHERE ST_Intersects(c.geom, z.geom)`,
      [JSON.stringify(payload), corridorJson, bufferM],
    ) as Array<{ idx: number }>;

    for (const row of rows) {
      const cell = costMap.get(row.idx);
      if (cell) cell.cost = Math.max(0.05, cell.cost * multiplier);
    }
  }

  async extractLineStringsFromNetwork(network: {
    type: 'FeatureCollection';
    features?: Array<{ geometry?: { type: string; coordinates: unknown } } | null>;
  }): Promise<Array<{ type: 'LineString'; coordinates: [number, number][] }>> {
    const lines: Array<{ type: 'LineString'; coordinates: [number, number][] }> = [];

    for (const feature of network.features ?? []) {
      if (!feature) continue;
      const geometry = feature.geometry;
      if (!geometry) continue;

      if (geometry.type === 'LineString' && Array.isArray(geometry.coordinates)) {
        const coords = geometry.coordinates as [number, number][];
        if (coords.length >= 2) lines.push({ type: 'LineString', coordinates: coords });
        continue;
      }

      if (geometry.type === 'MultiLineString' && Array.isArray(geometry.coordinates)) {
        for (const part of geometry.coordinates as [number, number][][]) {
          if (part.length >= 2) lines.push({ type: 'LineString', coordinates: part });
        }
      }
    }

    if (!lines.length) return lines;

    const rows = await this.dataSource.query(
      `SELECT ST_AsGeoJSON((ST_Dump(geom)).geom)::json AS geom
       FROM (
         SELECT ST_LineMerge(ST_Union(ST_SetSRID(ST_GeomFromGeoJSON(elem::text), 4326))) AS geom
         FROM jsonb_array_elements($1::jsonb) elem
       ) merged
       WHERE geom IS NOT NULL`,
      [JSON.stringify(lines)],
    ) as Array<{ geom: { type: string; coordinates: [number, number][] } | null }>;

    const dumped = rows
      .map((row) => row.geom)
      .filter((geom): geom is { type: 'LineString'; coordinates: [number, number][] } => (
        !!geom && geom.type === 'LineString' && Array.isArray(geom.coordinates) && geom.coordinates.length >= 2
      ));

    return dumped.length ? dumped : lines;
  }

  async mergeLineStrings(
    lines: Array<{ type: 'LineString'; coordinates: [number, number][] }>,
  ): Promise<{ type: 'LineString'; coordinates: [number, number][] } | null> {
    if (!lines.length) return null;
    const rows = await this.dataSource.query(
      `SELECT ST_AsGeoJSON(ST_LineMerge(ST_Union(geom)))::json AS geom
       FROM (
         SELECT ST_SetSRID(ST_GeomFromGeoJSON(elem::text), 4326) AS geom
         FROM jsonb_array_elements($1::jsonb) elem
       ) t`,
      [JSON.stringify(lines)],
    ) as Array<{ geom: { type: string; coordinates: [number, number][] } | null }>;
    const geom = rows[0]?.geom;
    if (!geom || geom.type !== 'LineString' || !geom.coordinates?.length) return lines[0] ?? null;
    return { type: 'LineString', coordinates: geom.coordinates };
  }

  async snapEndpointsToLine(
    start: [number, number],
    end: [number, number],
    line: { type: 'LineString'; coordinates: [number, number][] },
  ): Promise<{ start: [number, number]; end: [number, number] }> {
    const rows = await this.dataSource.query(
      `WITH line AS (
         SELECT ST_SetSRID(ST_GeomFromGeoJSON($1), 4326) AS geom
       )
       SELECT
         ST_X(ST_ClosestPoint(line.geom, ST_SetSRID(ST_MakePoint($2, $3), 4326))) AS start_lon,
         ST_Y(ST_ClosestPoint(line.geom, ST_SetSRID(ST_MakePoint($2, $3), 4326))) AS start_lat,
         ST_X(ST_ClosestPoint(line.geom, ST_SetSRID(ST_MakePoint($4, $5), 4326))) AS end_lon,
         ST_Y(ST_ClosestPoint(line.geom, ST_SetSRID(ST_MakePoint($4, $5), 4326))) AS end_lat
       FROM line`,
      [JSON.stringify(line), start[0], start[1], end[0], end[1]],
    ) as Array<{ start_lon: number; start_lat: number; end_lon: number; end_lat: number }>;
    const r = rows[0];
    if (!r) {
      return { start, end };
    }
    return {
      start: [Number(r.start_lon), Number(r.start_lat)],
      end: [Number(r.end_lon), Number(r.end_lat)],
    };
  }

  async ensureAlignmentFeatureClass(tenantId: string, projectId: string): Promise<ProjectFeatureClass> {
    const existing = await this.fcRepo
      .createQueryBuilder('fc')
      .where('fc.tenant_id = :tenantId', { tenantId })
      .andWhere('fc.project_id = :projectId', { projectId })
      .andWhere('fc.code IN (:...codes)', { codes: [...LA_ALIGNMENT_FEATURE_CODES] })
      .orderBy('fc.sort_order', 'ASC')
      .getOne();
    if (existing) return existing;

    const created = this.fcRepo.create({
      tenantId,
      projectId,
      code: 'la_alignment',
      name: 'LA Pipeline Alignment',
      description: 'Pipeline / transmission alignment for land acquisition',
      geometryType: 'LineString',
      attributeSchema: [
        { name: 'source', label: 'Source', type: 'text' },
        { name: 'chainage_from', label: 'Chainage From (m)', type: 'number' },
        { name: 'chainage_to', label: 'Chainage To (m)', type: 'number' },
      ],
      sortOrder: 5,
    });
    return this.fcRepo.save(created);
  }

  async saveRouteFeature(
    tenantId: string,
    projectId: string,
    featureClassId: string,
    userId: string,
    geometry: { type: 'LineString'; coordinates: [number, number][] },
    replaceAutoGenerated = true,
  ): Promise<string> {
    if (replaceAutoGenerated) {
      await this.dataSource.query(
        `DELETE FROM project_features pf
         USING project_feature_classes fc
         WHERE pf.feature_class_id = fc.id
           AND pf.tenant_id = $1 AND pf.project_id = $2 AND fc.id = $3
           AND COALESCE(pf.attributes->>'source', '') = 'auto_route'`,
        [tenantId, projectId, featureClassId],
      );
    }

    const inserted = await this.dataSource.query(
      `INSERT INTO project_features
         (tenant_id, project_id, feature_class_id, geometry, attributes, created_by)
       VALUES ($1, $2, $3, ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON($4), 4326)), $5::jsonb, $6)
       RETURNING id`,
      [
        tenantId,
        projectId,
        featureClassId,
        JSON.stringify(geometry),
        JSON.stringify({ source: 'auto_route', chainage_from: 0, chainage_to: null }),
        userId,
      ],
    ) as Array<{ id: string }>;

    return inserted[0]?.id;
  }

  private async toUtmPoints(start: [number, number], end: [number, number]): Promise<[UtmPoint, UtmPoint]> {
    const rows = await this.dataSource.query(
      `SELECT
         ST_X(ST_Transform(ST_SetSRID(ST_MakePoint($1, $2), 4326), 32644)) AS sx,
         ST_Y(ST_Transform(ST_SetSRID(ST_MakePoint($1, $2), 4326), 32644)) AS sy,
         ST_X(ST_Transform(ST_SetSRID(ST_MakePoint($3, $4), 4326), 32644)) AS ex,
         ST_Y(ST_Transform(ST_SetSRID(ST_MakePoint($3, $4), 4326), 32644)) AS ey`,
      [start[0], start[1], end[0], end[1]],
    ) as Array<{ sx: number; sy: number; ex: number; ey: number }>;
    const r = rows[0];
    return [{ x: Number(r.sx), y: Number(r.sy) }, { x: Number(r.ex), y: Number(r.ey) }];
  }

  private buildGrid(start: UtmPoint, end: UtmPoint, cellSize: number): GridCell[] {
    const padding = LA_ROUTING_DEFAULTS.paddingM;
    const minX = Math.min(start.x, end.x) - padding;
    const maxX = Math.max(start.x, end.x) + padding;
    const minY = Math.min(start.y, end.y) - padding;
    const maxY = Math.max(start.y, end.y) + padding;

    let cols = Math.ceil((maxX - minX) / cellSize);
    let rows = Math.ceil((maxY - minY) / cellSize);
    while (cols * rows > LA_ROUTING_DEFAULTS.maxGridCells) {
      cellSize *= 1.25;
      cols = Math.ceil((maxX - minX) / cellSize);
      rows = Math.ceil((maxY - minY) / cellSize);
    }

    const cells: GridCell[] = [];
    let idx = 0;
    for (let j = 0; j < rows; j += 1) {
      for (let i = 0; i < cols; i += 1) {
        cells.push({
          idx,
          i,
          j,
          x: minX + (i + 0.5) * cellSize,
          y: minY + (j + 0.5) * cellSize,
        });
        idx += 1;
      }
    }
    return cells;
  }

  private nearestCell(grid: GridCell[], point: UtmPoint): GridCell {
    let best = grid[0];
    let bestDist = Infinity;
    for (const cell of grid) {
      const d = (cell.x - point.x) ** 2 + (cell.y - point.y) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = cell;
      }
    }
    return best;
  }

  private async computeCellCosts(
    tenantId: string,
    projectId: string,
    grid: GridCell[],
    weights: Record<string, number>,
  ): Promise<CostRow[]> {
    const payload = grid.map((c) => ({ idx: c.idx, x: c.x, y: c.y }));
    const w = weights;

    const rows = await this.dataSource.query(
      `WITH centroids AS (
         SELECT
           (elem->>'idx')::int AS idx,
           ST_Transform(
             ST_SetSRID(ST_MakePoint((elem->>'x')::float, (elem->>'y')::float), 32644),
             4326
           ) AS geom
         FROM jsonb_array_elements($3::jsonb) elem
       ),
       extent AS (
         SELECT ST_Envelope(ST_Collect(geom)) AS bbox FROM centroids
       ),
       feats AS (
         SELECT pf.geometry, lower(fc.code) AS code
         FROM project_features pf
         JOIN project_feature_classes fc ON fc.id = pf.feature_class_id
         CROSS JOIN extent e
         WHERE pf.tenant_id = $1 AND pf.project_id = $2
           AND pf.geometry IS NOT NULL
           AND pf.geometry && e.bbox
       )
       SELECT
         c.idx,
         GREATEST(0.05, (
           1.0
           + CASE WHEN EXISTS (
               SELECT 1 FROM feats f
               WHERE f.code = ANY($4) AND ST_DWithin(f.geometry::geography, c.geom::geography, $5::float8)
             ) THEN -($6::float8 * $17::float8) ELSE 0 END
           + CASE WHEN EXISTS (
               SELECT 1 FROM feats f WHERE f.code = ANY($7) AND ST_Intersects(f.geometry, c.geom)
             ) THEN ($8::float8 * $18::float8) ELSE 0 END
           + CASE WHEN EXISTS (
               SELECT 1 FROM feats f WHERE f.code = ANY($9) AND ST_Intersects(f.geometry, c.geom)
             ) THEN ($10::float8 * $19::float8) ELSE 0 END
           + CASE WHEN EXISTS (
               SELECT 1 FROM feats f WHERE f.code = ANY($11) AND ST_Intersects(f.geometry, c.geom)
             ) THEN ($12::float8 * $20::float8) ELSE 0 END
           + CASE WHEN EXISTS (
               SELECT 1 FROM feats f WHERE f.code = ANY($13) AND ST_Intersects(f.geometry, c.geom)
             ) THEN ($14::float8 * $21::float8) ELSE 0 END
           + CASE WHEN EXISTS (
               SELECT 1 FROM feats f WHERE f.code = ANY($15) AND ST_Intersects(f.geometry, c.geom)
             ) THEN ($16::float8 * $22::float8) ELSE 0 END
           + CASE WHEN EXISTS (
               SELECT 1 FROM feats f WHERE f.code = ANY($23) AND ST_Intersects(f.geometry, c.geom)
             ) THEN ($24::float8 * $25::float8) ELSE 0 END
           + CASE WHEN EXISTS (
               SELECT 1 FROM feats f WHERE f.code = ANY($26) AND ST_Intersects(f.geometry, c.geom)
             ) THEN ($27::float8 * $28::float8) ELSE 0 END
           + CASE WHEN EXISTS (
               SELECT 1 FROM feats f WHERE f.code = ANY($29) AND ST_Intersects(f.geometry, c.geom)
             ) THEN ($30::float8 * $31::float8) ELSE 0 END
         ))::float AS cost,
         EXISTS (SELECT 1 FROM feats f WHERE f.code = ANY($4) AND ST_DWithin(f.geometry::geography, c.geom::geography, $5::float8)) AS road,
         EXISTS (SELECT 1 FROM feats f WHERE f.code = ANY($7) AND ST_Intersects(f.geometry, c.geom)) AS forest,
         EXISTS (SELECT 1 FROM feats f WHERE f.code = ANY($9) AND ST_Intersects(f.geometry, c.geom)) AS river,
         EXISTS (SELECT 1 FROM feats f WHERE f.code = ANY($11) AND ST_Intersects(f.geometry, c.geom)) AS railway,
         EXISTS (SELECT 1 FROM feats f WHERE f.code = ANY($13) AND ST_Intersects(f.geometry, c.geom)) AS building,
         EXISTS (SELECT 1 FROM feats f WHERE f.code = ANY($15) AND ST_Intersects(f.geometry, c.geom)) AS private_land,
         EXISTS (SELECT 1 FROM feats f WHERE f.code = ANY($32) AND ST_Intersects(f.geometry, c.geom)) AS govt_land,
         EXISTS (SELECT 1 FROM feats f WHERE f.code = ANY($26) AND ST_Intersects(f.geometry, c.geom)) AS landslide,
         EXISTS (SELECT 1 FROM feats f WHERE f.code = ANY($29) AND ST_Intersects(f.geometry, c.geom)) AS environmental
       FROM centroids c`,
      [
        tenantId,
        projectId,
        JSON.stringify(payload),
        ['pwd_road', 'national_highway', 'state_highway', 'pmgsy_roads', 'district_road', 'state_road', 'nh', 'sh', 'pmgsy'],
        LA_ROUTING_DEFAULTS.roadSnapDistanceM,
        LA_ROUTING_PENALTIES.roadBonus,
        ['forest_land', 'reserved_forest', 'protected_forest', 'van_panchayat', 'civil_soyam_land', 'national_park'],
        LA_ROUTING_PENALTIES.forest,
        ['river', 'rivers', 'stream', 'nadi', 'lake', 'wetlands', 'wetland'],
        LA_ROUTING_PENALTIES.river,
        ['railways', 'railway', 'rail_line'],
        LA_ROUTING_PENALTIES.railway,
        ['buildings', 'building', 'structure', 'schools', 'hospitals', 'school', 'hospital'],
        LA_ROUTING_PENALTIES.building,
        ['khasra_boundary', 'land_ownership', 'khata_boundary', 'la_parcels', 'cadastral_parcels', 'revenue_land', 'nazul_land'],
        LA_ROUTING_PENALTIES.privateLand + LA_ROUTING_PENALTIES.landCost,
        Number(w.follow_road ?? 1),
        Number(w.avoid_forest ?? 1),
        Number(Math.max(w.avoid_river ?? 1, (w.minimize_construction_cost ?? 1) * 0.85)),
        Number(Math.max(w.avoid_railway ?? 1, (w.minimize_construction_cost ?? 1) * 0.85)),
        Number(Math.max(w.avoid_buildings ?? 1, w.avoid_habitation ?? 1)),
        Number(Math.max(w.avoid_private_land ?? 1, w.minimize_land_cost ?? 1)),
        ['archaeological_sites', 'asi_monument', 'temples', 'temple'],
        LA_ROUTING_PENALTIES.monument,
        Number(w.avoid_monuments ?? 1),
        ['landslide_zone', 'landslide', 'hazard_zone', 'slope', 'slope_map'],
        LA_ROUTING_PENALTIES.landslide + LA_ROUTING_PENALTIES.steepSlope,
        Number(Math.max(w.avoid_landslide ?? 1, w.avoid_steep_slope ?? 1, w.minimize_excavation ?? 1)),
        ['wildlife_sanctuary', 'eco_sensitive_zones', 'wetlands', 'forest_land', 'national_park'],
        LA_ROUTING_PENALTIES.environmental,
        Number(w.minimize_environmental_impact ?? 1),
        ['government_land', 'govt_land', 'revenue_land', 'nazul_land', 'municipality_land'],
      ],
    ) as Array<CostRow & { private_land: boolean; govt_land: boolean }>;

    return rows.map((r) => ({
      idx: r.idx,
      cost: Number(r.cost),
      road: Boolean(r.road),
      forest: Boolean(r.forest),
      river: Boolean(r.river),
      railway: Boolean(r.railway),
      building: Boolean(r.building),
      privateLand: Boolean(r.private_land),
      govtLand: Boolean(r.govt_land),
      landslide: Boolean(r.landslide),
      environmental: Boolean(r.environmental),
    }));
  }

  private runAStar(
    grid: GridCell[],
    costMap: Map<number, CostRow>,
    start: GridCell,
    end: GridCell,
    cellSize: number,
    weights: Record<string, number>,
  ): GridCell[] {
    const shortestW = weights.shortest_route ?? 1;
    /** Higher shortest_route → penalties matter less, path tends toward direct distance */
    const penaltyExponent = 1 / Math.max(0.45, shortestW);
    const cols = Math.max(...grid.map((c) => c.i)) + 1;
    const byIdx = new Map(grid.map((c) => [c.idx, c]));
    const h = (c: GridCell) => Math.hypot(c.x - end.x, c.y - end.y);
    const open = new Set<number>([start.idx]);
    const cameFrom = new Map<number, number>();
    const gScore = new Map<number, number>([[start.idx, 0]]);
    const fScore = new Map<number, number>([[start.idx, h(start)]]);

    const neighbors = (c: GridCell): GridCell[] => {
      const result: GridCell[] = [];
      for (let di = -1; di <= 1; di += 1) {
        for (let dj = -1; dj <= 1; dj += 1) {
          if (di === 0 && dj === 0) continue;
          const ni = c.i + di;
          const nj = c.j + dj;
          const idx = grid.find((g) => g.i === ni && g.j === nj)?.idx;
          if (idx !== undefined) result.push(byIdx.get(idx)!);
        }
      }
      return result;
    };

    while (open.size) {
      let currentIdx = -1;
      let lowest = Infinity;
      for (const idx of open) {
        const f = fScore.get(idx) ?? Infinity;
        if (f < lowest) {
          lowest = f;
          currentIdx = idx;
        }
      }
      const current = byIdx.get(currentIdx)!;
      if (current.idx === end.idx) {
        const path: GridCell[] = [current];
        let cur = currentIdx;
        while (cameFrom.has(cur)) {
          cur = cameFrom.get(cur)!;
          path.unshift(byIdx.get(cur)!);
        }
        return path;
      }

      open.delete(currentIdx);
      const rawCost = costMap.get(currentIdx)?.cost ?? 1;
      const stepBase = rawCost ** penaltyExponent;

      for (const nb of neighbors(current)) {
        const move = cellSize * (nb.i !== current.i && nb.j !== current.j ? 1.414 : 1);
        const tentative = (gScore.get(currentIdx) ?? Infinity) + move * stepBase;
        if (tentative < (gScore.get(nb.idx) ?? Infinity)) {
          cameFrom.set(nb.idx, currentIdx);
          gScore.set(nb.idx, tentative);
          fScore.set(nb.idx, tentative + h(nb));
          open.add(nb.idx);
        }
      }
    }

    return [];
  }

  private async pathToWgs84(path: GridCell[]): Promise<[number, number][]> {
    const coords = path.map((c) => [c.x, c.y]);
    const rows = await this.dataSource.query(
      `SELECT json_agg(
         ARRAY[
           ST_X(ST_Transform(ST_SetSRID(ST_MakePoint(x, y), 32644), 4326)),
           ST_Y(ST_Transform(ST_SetSRID(ST_MakePoint(x, y), 32644), 4326))
         ] ORDER BY ord
       ) AS coords
       FROM unnest($1::float8[], $2::float8[]) WITH ORDINALITY AS t(x, y, ord)`,
      [coords.map((c) => c[0]), coords.map((c) => c[1])],
    ) as Array<{ coords: [number, number][] }>;
    return rows[0]?.coords ?? [];
  }

  private async simplifyLine(coords: [number, number][]): Promise<[number, number][]> {
    if (coords.length < 3) return coords;
    const rows = await this.dataSource.query(
      `SELECT ST_AsGeoJSON(
         ST_Simplify(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326), 0.00005)
       )::json->'coordinates' AS coords`,
      [JSON.stringify({ type: 'LineString', coordinates: coords })],
    ) as Array<{ coords: [number, number][] }>;
    return rows[0]?.coords ?? coords;
  }

  private async lineLengthM(coords: [number, number][]): Promise<number> {
    const rows = await this.dataSource.query(
      `SELECT ST_Length(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)::geography) AS len`,
      [JSON.stringify({ type: 'LineString', coordinates: coords })],
    ) as Array<{ len: string }>;
    return Number(rows[0]?.len ?? 0);
  }

  private scorePath(path: GridCell[], costMap: Map<number, CostRow>, cellSize: number) {
    let totalCost = 0;
    let roadCells = 0;
    let forestCells = 0;
    let riverCrossings = 0;
    let railwayCrossings = 0;
    let buildingCells = 0;
    let privateLandCells = 0;
    let govtLandCells = 0;
    let landslideCells = 0;
    let environmentalCells = 0;
    let prevRiver = false;
    let prevRail = false;

    for (const cell of path) {
      const row = costMap.get(cell.idx);
      if (!row) continue;
      totalCost += row.cost * cellSize;
      if (row.road) roadCells += 1;
      if (row.forest) forestCells += 1;
      if (row.building) buildingCells += 1;
      if (row.privateLand) privateLandCells += 1;
      if (row.govtLand) govtLandCells += 1;
      if (row.landslide) landslideCells += 1;
      if (row.environmental) environmentalCells += 1;
      if (row.river && !prevRiver) riverCrossings += 1;
      if (row.railway && !prevRail) railwayCrossings += 1;
      prevRiver = row.river;
      prevRail = row.railway;
    }

    return {
      totalCost: Math.round(totalCost),
      roadAffinityPct: path.length ? Math.round((roadCells / path.length) * 100) : 0,
      forestCells,
      riverCrossings,
      railwayCrossings,
      buildingCells,
      privateLandCells,
      govtLandCells,
      landslideCells,
      environmentalCells,
    };
  }
}
