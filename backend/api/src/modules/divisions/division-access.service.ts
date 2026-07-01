import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder, ObjectLiteral, In } from 'typeorm';
import { JwtPayload, AccessScope } from '../auth/interfaces/jwt-payload.interface';
import { User } from '../auth/entities/user.entity';
import { Project } from '../projects/entities/project.entity';
import { Division } from './entities/division.entity';
import {
  UTTARAKHAND_STATE_BBOX,
  UTTARAKHAND_STATE_MAP_VIEW,
} from '../gis/constants/gis-access.constants';
import {
  DIVISION_CODE_DISTRICT_FALLBACK,
  DISTRICT_NAME_TO_CODE,
  districtForDivisionCode,
  mapCenterForDivisionCode,
  UTTARAKHAND_DISTRICT_BBOXES,
  districtEnvelopeGeoJson,
} from '../gis/constants/district-boundaries.constants';

type DivisionContext = {
  divisionId: string | null;
  division: Division | null;
  circleId: string | null;
  circleCode: string | null;
  circleName: string | null;
};

const STATE_WIDE_ROLES = new Set([
  'ce', 'md', 'cgm', 'se', 'secretariat',
  'state_finance', 'state_gis_admin', 'state_it_admin',
]);

export const DIVISION_MILESTONE_ROLES = ['je', 'ae', 'ee', 'accounts'] as const;

function hasStateWideRole(roles: string[] | undefined): boolean {
  return (roles ?? []).some((r) => STATE_WIDE_ROLES.has(r));
}

@Injectable()
export class DivisionAccessService {
  /**
   * UJS division rule:
   * - Each scheme (project) is tagged with one division_id.
   * - Every user assigned to that division (JE, AE, EE, Accounts, GIS, O&M, etc.)
   *   sees the full scheme lifecycle for that division only.
   * - Users in other divisions never see it. Super Admin / State HQ see all.
   */
  private schemaReady: boolean | null = null;
  private circleSchemaReady: boolean | null = null;

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    @InjectRepository(Division) private divisionRepo: Repository<Division>,
  ) {}

  async isDivisionSchemaReady(): Promise<boolean> {
    if (this.schemaReady !== null) return this.schemaReady;
    try {
      const rows = await this.divisionRepo.query(
        `SELECT
           to_regclass('public.divisions') AS divisions_table,
           EXISTS (
             SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'division_id'
           ) AS projects_division_col,
           (
             EXISTS (
               SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'division_id'
             )
             OR to_regclass('public.user_division_assignments') IS NOT NULL
           ) AS users_division_ready`,
      );
      const row = rows[0] ?? {};
      this.schemaReady = Boolean(row.divisions_table && row.projects_division_col && row.users_division_ready);
    } catch {
      this.schemaReady = false;
    }
    return this.schemaReady;
  }

  private async usesAssignmentTable(): Promise<boolean> {
    try {
      const rows = await this.divisionRepo.query(
        `SELECT to_regclass('public.user_division_assignments') AS t`,
      );
      return Boolean(rows[0]?.t);
    } catch {
      return false;
    }
  }

  async isCircleSchemaReady(): Promise<boolean> {
    if (this.circleSchemaReady !== null) return this.circleSchemaReady;
    if (!(await this.isDivisionSchemaReady())) {
      this.circleSchemaReady = false;
      return false;
    }
    try {
      const rows = await this.divisionRepo.query(
        `SELECT to_regclass('public.circles') AS circles_table`,
      );
      this.circleSchemaReady = Boolean(rows[0]?.circles_table);
    } catch {
      this.circleSchemaReady = false;
    }
    return this.circleSchemaReady;
  }

  resolveAccessScope(user: JwtPayload): AccessScope {
    if (user.accessScope) return user.accessScope;
    if (user.roles?.includes('super_admin')) return 'global';
    if (user.permissions?.includes('state:view_all') || hasStateWideRole(user.roles)) return 'state';
    if (user.canViewAllDivisions) return 'state';
    if (user.permissions?.includes('circle:view') && user.circleId) return 'circle';
    return 'division';
  }

  async canViewAllDivisions(user: JwtPayload): Promise<boolean> {
    if (!(await this.isDivisionSchemaReady())) return true;
    const scope = this.resolveAccessScope(user);
    if (scope === 'global' || scope === 'state') return true;
    if (user.roles?.includes('super_admin')) return true;
    if (user.permissions?.includes('state:view_all')) return true;
    if (user.canViewAllDivisions) return true;
    const ctx = await this.loadUserDivision(user.sub);
    return ctx?.division?.isHeadquarters ?? false;
  }

  /** null = all divisions in tenant; [] = none */
  async getAccessibleDivisionIds(user: JwtPayload, tenantId: string): Promise<string[] | null> {
    if (!(await this.isDivisionSchemaReady())) return null;
    if (await this.canViewAllDivisions(user)) {
      const active = user.activeDivisionId?.trim();
      if (active) {
        const division = await this.divisionRepo.findOne({
          where: { id: active, tenantId, status: 'active' },
        });
        if (division) return [active];
      }
      return null;
    }

    const scope = this.resolveAccessScope(user);
    const ctx = await this.loadUserDivision(user.sub);

    if (scope === 'circle' && (await this.isCircleSchemaReady())) {
      const circleId = user.circleId ?? ctx?.circleId;
      if (!circleId) return [];
      const rows = await this.divisionRepo.query(
        'SELECT id FROM divisions WHERE tenant_id = $1 AND circle_id = $2 AND status = $3',
        [tenantId, circleId, 'active'],
      ) as Array<{ id: string }>;
      return rows.map((r) => r.id);
    }

    const assigned = await this.loadUserDivisionIds(user.sub);
    if (assigned.length > 0) return assigned;
    if (ctx?.divisionId) return [ctx.divisionId];
    return [];
  }

  /** All division IDs explicitly assigned to the user (supports multi-division). */
  async loadUserDivisionIds(userId: string): Promise<string[]> {
    if (!(await this.isDivisionSchemaReady())) return [];
    try {
      const useAssignments = await this.usesAssignmentTable();
      if (useAssignments) {
        const rows = await this.userRepo.query(
          `SELECT DISTINCT uda.division_id AS division_id
           FROM user_division_assignments uda
           WHERE uda.user_id = $1 AND uda.division_id IS NOT NULL`,
          [userId],
        ) as Array<{ division_id: string }>;
        return rows.map((r) => String(r.division_id));
      }
      const ctx = await this.loadUserDivision(userId);
      return ctx.divisionId ? [ctx.divisionId] : [];
    } catch {
      return [];
    }
  }

  private bboxToMapView(bbox: readonly number[]) {
    const [minLon, minLat, maxLon, maxLat] = bbox;
    const center: [number, number] = [(minLon + maxLon) / 2, (minLat + maxLat) / 2];
    const span = Math.max(maxLon - minLon, maxLat - minLat);
    let zoom = UTTARAKHAND_STATE_MAP_VIEW.zoom;
    if (span < 0.05) zoom = 13;
    else if (span < 0.15) zoom = 11;
    else if (span < 0.4) zoom = 9.5;
    else if (span < 0.8) zoom = 8.5;
    return { center, zoom };
  }

  private districtForDivision(code: string, dbDistrict?: string | null): string | null {
    if (dbDistrict?.trim()) return dbDistrict.trim();
    return districtForDivisionCode(code);
  }

  /** Resolve unique district names for a set of division records (all UJS field divisions). */
  private districtNamesFromDivisions(divisionList: Division[]): string[] {
    const names = new Set<string>();
    divisionList.forEach((d) => {
      if (d.isHeadquarters) return;
      const district = this.districtForDivision(d.code, d.district);
      if (district) names.add(district);
    });
    return [...names];
  }

  private enrichDivisionsForMap(_tenantId: string, divisions: Division[]) {
    return divisions.map((d) => ({
      id: d.id,
      code: d.code,
      name: d.name,
      region: d.region,
      district: this.districtForDivision(d.code, d.district),
      isHeadquarters: d.isHeadquarters,
    }));
  }

  private formatDivisionShortName(name: string): string {
    return name.replace(/\s+Division\s*$/i, '').trim() || name;
  }

  async resolveDistrictNamesForDivisions(tenantId: string, divisionIds: string[]): Promise<string[]> {
    if (!divisionIds.length) return [];
    try {
      const rows = await this.divisionRepo.find({
        where: { id: In(divisionIds), tenantId, status: 'active' },
      });
      if (rows.length) return this.districtNamesFromDivisions(rows);
    } catch {
      // fall through to code query
    }
    try {
      const rows = await this.divisionRepo.query(
        `SELECT code, is_headquarters FROM divisions
         WHERE tenant_id = $1 AND id = ANY($2::uuid[]) AND status = 'active'`,
        [tenantId, divisionIds],
      ) as Array<{ code: string; is_headquarters: boolean }>;
      const names = new Set<string>();
      rows.forEach((row) => {
        if (row.is_headquarters) return;
        const district = this.districtForDivision(row.code, null);
        if (district) names.add(district);
      });
      return [...names];
    } catch {
      return [];
    }
  }

  private fallbackDistrictBbox(districtNames: string[]): number[] | null {
    const boxes = districtNames
      .map((name) => UTTARAKHAND_DISTRICT_BBOXES[name])
      .filter((bbox): bbox is [number, number, number, number] => Boolean(bbox));
    if (!boxes.length) return null;
    const minLon = Math.min(...boxes.map((b) => b[0]));
    const minLat = Math.min(...boxes.map((b) => b[1]));
    const maxLon = Math.max(...boxes.map((b) => b[2]));
    const maxLat = Math.max(...boxes.map((b) => b[3]));
    const pad = 0.01;
    return [minLon - pad, minLat - pad, maxLon + pad, maxLat + pad];
  }

  private fallbackDistrictGeoJson(districtNames: string[] | null) {
    const names = districtNames === null
      ? Object.keys(UTTARAKHAND_DISTRICT_BBOXES)
      : districtNames;
    const features = names.map((districtName) => {
      const code = DISTRICT_NAME_TO_CODE[districtName]
        ?? districtName.slice(0, 3).toUpperCase();
      const geometry = districtEnvelopeGeoJson(districtName, code);
      if (!geometry) return null;
      return {
        type: 'Feature',
        id: code,
        geometry,
        properties: { districtCode: code, districtName },
      };
    }).filter((feature): feature is NonNullable<typeof feature> => feature !== null);
    return { type: 'FeatureCollection' as const, features };
  }

  async computeDistrictBbox(tenantId: string, districtNames: string[]): Promise<number[] | null> {
    if (!districtNames.length) return null;
    try {
      const rows = await this.divisionRepo.query(
        `SELECT
           ST_XMin(ST_Extent(geometry))::float AS min_lon,
           ST_YMin(ST_Extent(geometry))::float AS min_lat,
           ST_XMax(ST_Extent(geometry))::float AS max_lon,
           ST_YMax(ST_Extent(geometry))::float AS max_lat
         FROM district_boundaries
         WHERE tenant_id = $1 AND district_name = ANY($2::text[]) AND geometry IS NOT NULL`,
        [tenantId, districtNames],
      ) as Array<{ min_lon: number; min_lat: number; max_lon: number; max_lat: number }>;
      const row = rows[0];
      if (row?.min_lon == null) return this.fallbackDistrictBbox(districtNames);
      const pad = 0.01;
      return [row.min_lon - pad, row.min_lat - pad, row.max_lon + pad, row.max_lat + pad];
    } catch {
      return this.fallbackDistrictBbox(districtNames);
    }
  }

  async getDistrictBoundaryGeoJson(
    tenantId: string,
    districtNames: string[] | null,
  ): Promise<{ type: 'FeatureCollection'; features: Array<Record<string, unknown>> }> {
    try {
      let rows: Array<{
        district_code: string;
        district_name: string;
        geojson: Record<string, unknown>;
      }>;
      if (districtNames === null) {
        rows = await this.divisionRepo.query(
          `SELECT district_code, district_name,
                  ST_AsGeoJSON(geometry)::json AS geojson
           FROM district_boundaries
           WHERE tenant_id = $1 AND geometry IS NOT NULL
           ORDER BY district_name`,
          [tenantId],
        );
      } else if (!districtNames.length) {
        return { type: 'FeatureCollection', features: [] };
      } else {
        rows = await this.divisionRepo.query(
          `SELECT district_code, district_name,
                  ST_AsGeoJSON(geometry)::json AS geojson
           FROM district_boundaries
           WHERE tenant_id = $1 AND district_name = ANY($2::text[]) AND geometry IS NOT NULL
           ORDER BY district_name`,
          [tenantId, districtNames],
        );
      }
      if (!rows.length) {
        return this.fallbackDistrictGeoJson(districtNames);
      }
      return {
        type: 'FeatureCollection',
        features: rows.map((row) => ({
          type: 'Feature',
          id: row.district_code,
          geometry: row.geojson,
          properties: {
            districtCode: row.district_code,
            districtName: row.district_name,
          },
        })),
      };
    } catch {
      return this.fallbackDistrictGeoJson(districtNames);
    }
  }

  /** District names for spatial jurisdiction filtering (null = full state, no clip). */
  async resolveJurisdictionDistrictNames(user: JwtPayload, tenantId: string): Promise<string[] | null> {
    if (await this.canViewAllDivisions(user)) return null;
    const divisions = await this.listDivisions(tenantId, user);
    const districtNames = this.districtNamesFromDivisions(divisions);
    return districtNames.length ? districtNames : null;
  }

  /**
   * SQL AND clause + params to keep features inside authorized admin boundaries.
   * Uses real district_boundaries polygons when available, else envelope fallback.
   */
  async buildJurisdictionSqlFilter(
    tenantId: string,
    districtNames: string[],
    geometryColumn: string,
    existingParamCount: number,
  ): Promise<{ sqlAnd: string; extraParams: unknown[] }> {
    if (!districtNames.length) {
      return { sqlAnd: '', extraParams: [] };
    }

    try {
      const rows = await this.divisionRepo.query(
        `SELECT COUNT(*)::int AS c
         FROM district_boundaries
         WHERE tenant_id = $1 AND district_name = ANY($2::text[]) AND geometry IS NOT NULL`,
        [tenantId, districtNames],
      ) as Array<{ c: number }>;
      if ((rows[0]?.c ?? 0) > 0) {
        const districtParam = existingParamCount + 1;
        return {
          sqlAnd: `AND ST_Intersects(${geometryColumn}, (
            SELECT ST_UnaryUnion(ST_Collect(geometry))
            FROM district_boundaries
            WHERE tenant_id = $1 AND district_name = ANY($${districtParam}::text[]) AND geometry IS NOT NULL
          ))`,
          extraParams: [districtNames],
        };
      }
    } catch {
      // fall through to envelope
    }

    const bbox = this.fallbackDistrictBbox(districtNames);
    if (!bbox) return { sqlAnd: '', extraParams: [] };
    const [minLon, minLat, maxLon, maxLat] = bbox;
    return {
      sqlAnd: `AND ST_Intersects(${geometryColumn}, ST_MakeEnvelope(${minLon}, ${minLat}, ${maxLon}, ${maxLat}, 4326))`,
      extraParams: [],
    };
  }

  /** Reject geometries drawn or queried outside the user's district boundary. */
  async assertGeometryWithinJurisdiction(
    user: JwtPayload,
    tenantId: string,
    geometry: { type: string; coordinates: unknown },
  ): Promise<void> {
    const districtNames = await this.resolveJurisdictionDistrictNames(user, tenantId);
    if (!districtNames?.length) return;

    const geoJson = JSON.stringify(geometry);
    try {
      const rows = await this.divisionRepo.query(
        `SELECT ST_Within(
           ST_SetSRID(ST_GeomFromGeoJSON($1), 4326),
           COALESCE(
             (
               SELECT ST_UnaryUnion(ST_Collect(geometry))
               FROM district_boundaries
               WHERE tenant_id = $2 AND district_name = ANY($3::text[]) AND geometry IS NOT NULL
             ),
             ST_MakeEnvelope($4, $5, $6, $7, 4326)
           )
         ) AS within_boundary`,
        (() => {
          const bbox = this.fallbackDistrictBbox(districtNames)!;
          return [geoJson, tenantId, districtNames, bbox[0], bbox[1], bbox[2], bbox[3]];
        })(),
      ) as Array<{ within_boundary: boolean }>;
      if (!rows[0]?.within_boundary) {
        throw new ForbiddenException(
          'This location is outside your authorized district boundary.',
        );
      }
    } catch (err) {
      if (err instanceof ForbiddenException) throw err;
      throw new ForbiddenException(
        'This location is outside your authorized district boundary.',
      );
    }
  }

  jurisdictionBoundaryMessage(districtNames: string[] | null): string | null {
    if (!districtNames?.length) return null;
    if (districtNames.length === 1) {
      return `GIS layers are restricted to ${districtNames[0]} district boundary. Features outside this area are hidden.`;
    }
    return `GIS layers are restricted to your authorized district boundaries (${districtNames.join(', ')}). Features outside these areas are hidden.`;
  }

  outsideDistrictLayerMessage(districtNames: string[] | null): string {
    if (!districtNames?.length) {
      return 'This layer is outside your authorized district boundary and cannot be opened.';
    }
    if (districtNames.length === 1) {
      return `This layer is outside your authorized district boundary (${districtNames[0]}). It cannot be opened in Map Explorer.`;
    }
    return `This layer is outside your authorized district boundaries (${districtNames.join(', ')}). It cannot be opened in Map Explorer.`;
  }

  buildLayerJurisdictionMeta(
    districtNames: string[] | null,
    totalCount: number,
    visibleCount: number,
  ) {
    const hiddenOutsideBoundary = districtNames?.length
      ? Math.max(0, totalCount - visibleCount)
      : 0;
    const blockedOutsideDistrict = Boolean(
      districtNames?.length && totalCount > 0 && visibleCount === 0,
    );
    let message: string | null = null;
    if (blockedOutsideDistrict) {
      message = this.outsideDistrictLayerMessage(districtNames);
    } else if (hiddenOutsideBoundary > 0) {
      message = `${hiddenOutsideBoundary} feature(s) hidden — outside your authorized district boundary.`;
    }
    return {
      restricted: Boolean(districtNames?.length),
      districtNames: districtNames ?? [],
      totalCount,
      visibleCount,
      hiddenOutsideBoundary,
      blockedOutsideDistrict,
      message,
    };
  }

  async computeDivisionFeaturesBbox(tenantId: string, divisionIds: string[]): Promise<number[] | null> {
    if (!divisionIds.length) return null;
    try {
      const rows = await this.projectRepo.query(
        `SELECT
           ST_XMin(ext)::float AS min_lon,
           ST_YMin(ext)::float AS min_lat,
           ST_XMax(ext)::float AS max_lon,
           ST_YMax(ext)::float AS max_lat
         FROM (
           SELECT ST_Extent(pf.geometry) AS ext
           FROM project_features pf
           INNER JOIN projects p ON p.id = pf.project_id
           WHERE p.tenant_id = $1
             AND p.division_id = ANY($2::uuid[])
             AND pf.geometry IS NOT NULL
         ) sub
         WHERE ext IS NOT NULL`,
        [tenantId, divisionIds],
      ) as Array<{ min_lon: number; min_lat: number; max_lon: number; max_lat: number }>;
      const row = rows[0];
      if (row?.min_lon == null) return null;
      const pad = 0.02;
      return [
        row.min_lon - pad,
        row.min_lat - pad,
        row.max_lon + pad,
        row.max_lat + pad,
      ];
    } catch {
      return null;
    }
  }

  /** Map Explorer jurisdiction context — extent, divisions, and scope for auto-zoom. */
  async getMapAccessContext(user: JwtPayload, tenantId: string, focusDivisionId?: string) {
    const accessScope = this.resolveAccessScope(user);
    const canViewAll = await this.canViewAllDivisions(user);
    const divisions = await this.listDivisions(tenantId, user);
    const divisionIds = divisions.map((d) => d.id);

    let extentDivisionIds = divisionIds;
    if (focusDivisionId && divisionIds.includes(focusDivisionId)) {
      extentDivisionIds = [focusDivisionId];
    }

    const scopedDivisions = divisions.filter((d) => extentDivisionIds.includes(d.id));
    const divisionFocused = Boolean(focusDivisionId && divisionIds.includes(focusDivisionId));
    const districtNames = (canViewAll && !divisionFocused)
      ? null
      : this.districtNamesFromDivisions(scopedDivisions);
    const activeDistrictName = districtNames?.length === 1 ? districtNames[0] : (districtNames?.[0] ?? null);

    let bbox: number[];
    if (divisionFocused && districtNames?.length) {
      bbox = (await this.computeDistrictBbox(tenantId, districtNames))
        ?? this.fallbackDistrictBbox(districtNames)
        ?? [...UTTARAKHAND_STATE_BBOX];
      const focusDivision = scopedDivisions[0];
      if (focusDivision?.code) {
        const codeCenter = mapCenterForDivisionCode(focusDivision.code);
        if (codeCenter && bbox.every((v) => Number.isFinite(v))) {
          const [w, s, e, n] = bbox;
          const centerLon = (w + e) / 2;
          const centerLat = (s + n) / 2;
          const spanLon = e - w;
          const spanLat = n - s;
          const distDeg = Math.hypot(centerLon - codeCenter[0], centerLat - codeCenter[1]);
          if (distDeg > Math.max(spanLon, spanLat) * 1.5) {
            bbox = this.fallbackDistrictBbox(districtNames) ?? bbox;
          }
        }
      }
    } else if (canViewAll || accessScope === 'global' || accessScope === 'state') {
      bbox = [...UTTARAKHAND_STATE_BBOX];
    } else if (districtNames?.length) {
      // Always use administrative district envelope — never project feature extent (may be mis-located).
      bbox = (await this.computeDistrictBbox(tenantId, districtNames))
        ?? this.fallbackDistrictBbox(districtNames)
        ?? [...UTTARAKHAND_STATE_BBOX];
    } else {
      bbox = [...UTTARAKHAND_STATE_BBOX];
    }

    const mapView = this.bboxToMapView(bbox);
    const accessibleProjectIds = await this.getAccessibleProjectIds(user, tenantId);
    const activeDivisionId = focusDivisionId && divisionIds.includes(focusDivisionId)
      ? focusDivisionId
      : (user.divisionId && divisionIds.includes(user.divisionId) ? user.divisionId : divisionIds[0] ?? null);

    const activeDivision = divisions.find((d) => d.id === activeDivisionId) ?? divisions[0] ?? null;

    let jurisdictionLabel: string;
    if (divisionFocused && activeDivision) {
      jurisdictionLabel = activeDistrictName
        ? `${activeDistrictName} District · ${this.formatDivisionShortName(activeDivision.name)}`
        : this.formatDivisionShortName(activeDivision.name);
    } else if (canViewAll) {
      jurisdictionLabel = 'Uttarakhand — Full State Access';
    } else if (activeDistrictName && activeDivision) {
      jurisdictionLabel = `${activeDistrictName} District · ${this.formatDivisionShortName(activeDivision.name)}`;
    } else if (focusDivisionId && divisions.length > 1) {
      const focused = divisions.find((d) => d.id === focusDivisionId);
      jurisdictionLabel = focused
        ? `${this.formatDivisionShortName(focused.name)}`
        : `${divisions.length} Authorized Divisions`;
    } else if (divisions.length === 1) {
      jurisdictionLabel = activeDistrictName
        ? `${activeDistrictName} District · ${this.formatDivisionShortName(divisions[0].name)}`
        : this.formatDivisionShortName(divisions[0].name);
    } else if (divisions.length > 1) {
      jurisdictionLabel = `${divisions.length} Authorized Divisions`;
    } else {
      jurisdictionLabel = 'No jurisdiction assigned';
    }

    const districtBoundaries = await this.getDistrictBoundaryGeoJson(tenantId, districtNames);
    const enrichedDivisions = this.enrichDivisionsForMap(tenantId, divisions);

    const resolvedDistrictNames = districtNames ?? [];
    const jurisdictionRestricted = resolvedDistrictNames.length > 0
      && (!canViewAll || divisionFocused);

    return {
      accessScope,
      canViewAllDivisions: canViewAll,
      jurisdictionLabel,
      jurisdictionRestricted,
      boundaryNotice: this.jurisdictionBoundaryMessage(districtNames),
      districtNames: resolvedDistrictNames,
      activeDistrictName,
      districtBoundaries,
      divisions: enrichedDivisions,
      activeDivisionId,
      mapView,
      bbox,
      allowedProjectCount: accessibleProjectIds === null ? null : accessibleProjectIds.length,
    };
  }

  async scopeQueryByAccessibleProjects(
    qb: SelectQueryBuilder<ObjectLiteral>,
    user: JwtPayload,
    tenantId: string,
    alias: string,
    resolvedProjectId: string | null | undefined,
    projectIdColumn = 'project_id',
  ): Promise<void> {
    if (!(await this.isDivisionSchemaReady())) {
      if (resolvedProjectId) {
        qb.andWhere(`${alias}.${projectIdColumn} = :scopedProjectId`, { scopedProjectId: resolvedProjectId });
      }
      return;
    }
    if (resolvedProjectId) {
      qb.andWhere(`${alias}.${projectIdColumn} = :scopedProjectId`, { scopedProjectId: resolvedProjectId });
      return;
    }
    const ids = await this.getAccessibleProjectIds(user, tenantId);
    if (ids === null) return;
    if (ids.length === 0) {
      qb.andWhere('1 = 0');
      return;
    }
    qb.andWhere(`${alias}.${projectIdColumn} IN (:...scopedProjectIds)`, { scopedProjectIds: ids });
  }

  async getAccessibleProjectIds(user: JwtPayload, tenantId: string): Promise<string[] | null> {
    if (!(await this.isDivisionSchemaReady())) return null;
    const divisionIds = await this.getAccessibleDivisionIds(user, tenantId);
    if (divisionIds === null) return null;
    if (divisionIds.length === 0) return [];
    const rows = await this.projectRepo.query(
      'SELECT id FROM projects WHERE tenant_id = $1 AND division_id = ANY($2::uuid[])',
      [tenantId, divisionIds],
    ) as Array<{ id: string }>;
    return rows.map((r) => r.id);
  }

  async assertDivisionInTenant(divisionId: string, tenantId: string): Promise<Division> {
    const division = await this.divisionRepo.findOne({
      where: { id: divisionId, tenantId, status: 'active' },
    });
    if (!division) throw new NotFoundException('Division not found');
    return division;
  }

  async listDivisions(tenantId: string, user: JwtPayload) {
    if (!(await this.isDivisionSchemaReady())) return [];
    const all = await this.divisionRepo.find({
      where: { tenantId, status: 'active' },
      order: { isHeadquarters: 'DESC', name: 'ASC' },
    });
    if (await this.canViewAllDivisions(user)) return all;
    const accessible = await this.getAccessibleDivisionIds(user, tenantId);
    if (accessible === null) return all;
    if (accessible.length === 0) return [];
    return all.filter((d) => accessible.includes(d.id));
  }

  async applyDivisionScope(
    qb: SelectQueryBuilder<ObjectLiteral>,
    user: JwtPayload,
    alias: string,
    tenantId?: string,
  ): Promise<void> {
    if (!(await this.isDivisionSchemaReady())) return;
    const tid = tenantId ?? user.tenantId;
    const divisionIds = await this.getAccessibleDivisionIds(user, tid);
    if (divisionIds === null) return;
    if (divisionIds.length === 0) {
      qb.andWhere('1 = 0');
      return;
    }
    qb.andWhere(`${alias}.division_id IN (:...accessibleDivisionIds)`, {
      accessibleDivisionIds: divisionIds,
    });
  }

  async applyProjectScope<T extends Project>(
    qb: SelectQueryBuilder<T>,
    user: JwtPayload,
    alias = 'project',
    tenantId?: string,
  ): Promise<void> {
    await this.applyDivisionScope(qb as SelectQueryBuilder<ObjectLiteral>, user, alias, tenantId);
  }

  async getProjectDivisionId(projectId: string): Promise<string | null> {
    if (!(await this.isDivisionSchemaReady())) return null;
    const rows = await this.projectRepo.query(
      'SELECT division_id FROM projects WHERE id = $1',
      [projectId],
    ) as Array<{ division_id: string | null }>;
    return rows[0]?.division_id ?? null;
  }

  async assignProjectDivision(projectId: string, divisionId: string | null): Promise<void> {
    if (!(await this.isDivisionSchemaReady()) || !divisionId) return;
    await this.projectRepo.query(
      'UPDATE projects SET division_id = $1 WHERE id = $2',
      [divisionId, projectId],
    );
  }

  async assertProjectAccess(user: JwtPayload, projectId: string, tenantId: string): Promise<Project> {
    const project = await this.projectRepo.findOne({ where: { id: projectId, tenantId } });
    if (!project) throw new NotFoundException('Project not found');
    if (!(await this.isDivisionSchemaReady())) return project;

    const projectDivisionId = await this.getProjectDivisionId(projectId);
    const accessible = await this.getAccessibleDivisionIds(user, tenantId);
    if (accessible === null) return project;
    if (!projectDivisionId || !accessible.includes(projectDivisionId)) {
      throw new ForbiddenException('This scheme belongs to another division. Access denied.');
    }
    return project;
  }

  /** First scheme in the user's division (or tenant) when none is specified on write. */
  async resolveDefaultProjectId(user: JwtPayload, tenantId: string): Promise<string | null> {
    const ids = await this.getAccessibleProjectIds(user, tenantId);
    if (ids === null) {
      const rows = await this.projectRepo.query(
        'SELECT id FROM projects WHERE tenant_id = $1 ORDER BY name ASC LIMIT 1',
        [tenantId],
      ) as Array<{ id: string }>;
      return rows[0]?.id ?? null;
    }
    return ids[0] ?? null;
  }

  async resolveAccessibleProjectId(
    user: JwtPayload,
    tenantId: string,
    projectId?: string,
    projectCode?: string,
  ): Promise<string | null> {
    let resolved: Project | null = null;
    if (projectId?.trim()) {
      resolved = await this.projectRepo.findOne({ where: { id: projectId.trim(), tenantId } })
        ?? await this.projectRepo.findOne({ where: { projectCode: projectId.trim(), tenantId } });
    } else if (projectCode?.trim()) {
      resolved = await this.projectRepo.findOne({ where: { tenantId, projectCode: projectCode.trim() } });
    }
    if (!resolved) return null;
    await this.assertProjectAccess(user, resolved.id, tenantId);
    return resolved.id;
  }

  async resolveDivisionIdForCreate(user: JwtPayload, requestedDivisionId?: string): Promise<string | null> {
    if (!(await this.isDivisionSchemaReady())) return null;
    const canPickDivision = await this.canViewAllDivisions(user);

    if (requestedDivisionId?.trim()) {
      if (!canPickDivision) {
        throw new ForbiddenException('Only administrators can assign a scheme to a division.');
      }
      const division = await this.divisionRepo.findOne({
        where: { id: requestedDivisionId.trim(), tenantId: user.tenantId, status: 'active' },
      });
      if (!division) throw new NotFoundException('Division not found');
      if (division.isHeadquarters) {
        throw new BadRequestException('Assign the scheme to a field division (not State HQ).');
      }
      return division.id;
    }

    const ctx = await this.loadUserDivision(user.sub);
    if (ctx?.divisionId && !ctx.division?.isHeadquarters) {
      return ctx.divisionId;
    }

    if (canPickDivision) {
      const active = user.activeDivisionId?.trim();
      if (active) {
        const division = await this.divisionRepo.findOne({
          where: { id: active, tenantId: user.tenantId, status: 'active' },
        });
        if (division && !division.isHeadquarters) return division.id;
      }
      throw new BadRequestException(
        'Select a UJS Division for this scheme. All staff in that division will then see it end-to-end.',
      );
    }

    if (!ctx?.divisionId) {
      throw new ForbiddenException('Your user account is not assigned to a division.');
    }
    return ctx.divisionId;
  }

  async accessContext(user: JwtPayload) {
    const schemaReady = await this.isDivisionSchemaReady();
    const circleReady = await this.isCircleSchemaReady();
    const accessScope = schemaReady ? this.resolveAccessScope(user) : 'division';
    return {
      divisionSchemaReady: schemaReady,
      circleSchemaReady: circleReady,
      divisionId: user.divisionId ?? null,
      divisionCode: user.divisionCode ?? null,
      divisionName: user.divisionName ?? null,
      circleId: user.circleId ?? null,
      circleCode: user.circleCode ?? null,
      circleName: user.circleName ?? null,
      accessScope,
      canViewAllDivisions: user.canViewAllDivisions ?? false,
      roles: user.roles,
      setupHint: schemaReady
        ? null
        : 'Run: cd backend/api && npm run setup:divisions',
    };
  }

  async enrichJwtDivision(userId: string): Promise<{
    divisionId: string | null;
    divisionCode: string | null;
    divisionName: string | null;
    circleId: string | null;
    circleCode: string | null;
    circleName: string | null;
    accessScope: AccessScope;
    canViewAllDivisions: boolean;
  }> {
    if (!(await this.isDivisionSchemaReady())) {
      return {
        divisionId: null,
        divisionCode: null,
        divisionName: null,
        circleId: null,
        circleCode: null,
        circleName: null,
        accessScope: 'division',
        canViewAllDivisions: false,
      };
    }
    const ctx = await this.loadUserDivision(userId);
    const isHq = ctx?.division?.isHeadquarters ?? false;
    return {
      divisionId: ctx?.divisionId ?? null,
      divisionCode: ctx?.division?.code ?? null,
      divisionName: ctx?.division?.name ?? null,
      circleId: ctx?.circleId ?? null,
      circleCode: ctx?.circleCode ?? null,
      circleName: ctx?.circleName ?? null,
      accessScope: 'division',
      canViewAllDivisions: isHq,
    };
  }

  async enrichJwtAccess(userId: string, roles: string[], permissions: string[]): Promise<{
    divisionId: string | null;
    divisionCode: string | null;
    divisionName: string | null;
    circleId: string | null;
    circleCode: string | null;
    circleName: string | null;
    accessScope: AccessScope;
    canViewAllDivisions: boolean;
  }> {
    const base = await this.enrichJwtDivision(userId);
    let accessScope: AccessScope = base.accessScope;
    if (roles.includes('super_admin')) accessScope = 'global';
    else if (permissions.includes('state:view_all') || hasStateWideRole(roles)) accessScope = 'state';
    else if (base.canViewAllDivisions) accessScope = 'state';
    else if (permissions.includes('circle:view') && base.circleId) accessScope = 'circle';
    const canViewAllDivisions = accessScope === 'global' || accessScope === 'state';
    return { ...base, accessScope, canViewAllDivisions };
  }

  private async loadUserDivision(userId: string): Promise<DivisionContext> {
    if (!(await this.isDivisionSchemaReady())) {
      return { divisionId: null, division: null, circleId: null, circleCode: null, circleName: null };
    }
    try {
      const useAssignments = await this.usesAssignmentTable();
      const circleReady = await this.isCircleSchemaReady();
      const circleJoin = circleReady ? 'LEFT JOIN circles c ON c.id = u.circle_id' : '';
      const circleSelect = circleReady
        ? ', u.circle_id AS user_circle_id, c.code AS circle_code, c.name AS circle_name'
        : '';

      let rows: Array<Record<string, unknown>>;
      if (useAssignments) {
        rows = await this.userRepo.query(
          `SELECT uda.division_id AS division_id,
                  d.id, d.tenant_id, d.code, d.name, d.region, d.is_headquarters, d.status
                  ${circleSelect}
           FROM user_division_assignments uda
           JOIN users u ON u.id = uda.user_id
           LEFT JOIN divisions d ON d.id = uda.division_id
           ${circleJoin}
           WHERE uda.user_id = $1`,
          [userId],
        ) as Array<Record<string, unknown>>;
      } else {
        rows = await this.userRepo.query(
          `SELECT u.division_id AS division_id,
                  d.id, d.tenant_id, d.code, d.name, d.region, d.is_headquarters, d.status
                  ${circleSelect}
           FROM users u
           LEFT JOIN divisions d ON d.id = u.division_id
           ${circleJoin}
           WHERE u.id = $1`,
          [userId],
        ) as Array<Record<string, unknown>>;
      }
      const row = rows[0];
      const circleId = row?.user_circle_id != null ? String(row.user_circle_id) : null;
      const circleCode = row?.circle_code != null ? String(row.circle_code) : null;
      const circleName = row?.circle_name != null ? String(row.circle_name) : null;
      if (!row?.division_id) {
        return { divisionId: null, division: null, circleId, circleCode, circleName };
      }
      const divisionId = String(row.division_id);
      if (!row.id) return { divisionId, division: null, circleId, circleCode, circleName };
      const division = this.divisionRepo.create({
        id: String(row.id),
        tenantId: String(row.tenant_id),
        code: String(row.code),
        name: String(row.name),
        region: row.region != null ? String(row.region) : null,
        isHeadquarters: Boolean(row.is_headquarters),
        status: String(row.status ?? 'active'),
      });
      return { divisionId, division, circleId, circleCode, circleName };
    } catch {
      return { divisionId: null, division: null, circleId: null, circleCode: null, circleName: null };
    }
  }

  /** Milestones are owned by field-division JE/AE/EE/Accounts — not Super Admin or statewide viewers. */
  assertDivisionMilestoneOperator(user: JwtPayload): void {
    if (user.roles?.includes('super_admin')) {
      throw new ForbiddenException(
        'Milestones are created by division staff (JE, AE, EE, Accounts). Super Admin only registers schemes.',
      );
    }
    if (user.canViewAllDivisions || hasStateWideRole(user.roles)) {
      throw new ForbiddenException(
        'Milestones are managed at the division level. Use your division JE, AE, EE, or Accounts login.',
      );
    }
    if (!user.divisionId) {
      throw new ForbiddenException('Your account must be assigned to a field division to manage milestones.');
    }
    const hasRole = DIVISION_MILESTONE_ROLES.some((code) => user.roles?.includes(code));
    if (!hasRole) {
      throw new ForbiddenException('Only division JE, AE, EE, or Accounts officers can manage milestones.');
    }
  }

  canManageMilestones(user: JwtPayload): boolean {
    try {
      this.assertDivisionMilestoneOperator(user);
      return true;
    } catch {
      return false;
    }
  }
}
