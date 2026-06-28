import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

import { DivisionAccessService } from '../divisions/division-access.service';

import { ProjectFeatureClass } from '../projects/entities/project-feature-class.entity';

import { ProjectFeature } from '../projects/entities/project-feature.entity';

import { GisLayerGroup } from './entities/gis-layer-group.entity';

import { GisLayer } from './entities/gis-layer.entity';

import { GisSpatialOperation, GisSpatialQueryDto } from './dto/gis-spatial-query.dto';

import { GisMapAuditService } from './gis-map-audit.service';



type LayerFeatureRow = {

  id: string;

  attributes: Record<string, unknown>;

  geojson: { type: string; coordinates: unknown } | null;

  area_sqm: number;

  npoints: number;

};



function pointCoordKey(coordinates: unknown): string | null {

  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;

  const [lon, lat] = coordinates;

  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;

  return `${Number(lon).toFixed(5)},${Number(lat).toFixed(5)}`;

}



function distanceMeters(a: number[], b: number[]): number {

  const dLat = (a[1] - b[1]) * 111_320;

  const dLon = (a[0] - b[0]) * 111_320 * Math.cos((a[1] * Math.PI) / 180);

  return Math.hypot(dLon, dLat);

}



function explodePointRows(rows: LayerFeatureRow[]): LayerFeatureRow[] {

  const exploded: LayerFeatureRow[] = [];



  rows.forEach((row) => {

    const geometry = row.geojson;

    if (!geometry?.coordinates) return;



    if (geometry.type === 'MultiPoint' && Array.isArray(geometry.coordinates)) {

      (geometry.coordinates as number[][]).forEach((coordinates, index) => {

        exploded.push({

          ...row,

          id: `${row.id}-mp-${index}`,

          geojson: { type: 'Point', coordinates },

        });

      });

      return;

    }



    exploded.push(row);

  });



  return exploded;

}



function dedupeNearbyPointRows(rows: LayerFeatureRow[], thresholdMeters = 25): LayerFeatureRow[] {

  const kept: LayerFeatureRow[] = [];



  rows.forEach((row) => {

    if (row.geojson?.type !== 'Point' || !Array.isArray(row.geojson.coordinates)) {

      kept.push(row);

      return;

    }



    const coords = row.geojson.coordinates as number[];

    const roundedKey = pointCoordKey(coords);

    if (roundedKey && kept.some((existing) => pointCoordKey(existing.geojson?.coordinates) === roundedKey)) {

      return;

    }



    const isNearbyDuplicate = kept.some((existing) => {

      if (existing.geojson?.type !== 'Point' || !Array.isArray(existing.geojson.coordinates)) {

        return false;

      }

      return distanceMeters(coords, existing.geojson.coordinates as number[]) < thresholdMeters;

    });



    if (!isNearbyDuplicate) kept.push(row);

  });



  return kept;

}



function toLayerFeature(row: LayerFeatureRow, layer: GisLayer, featureClass: ProjectFeatureClass) {

  return {

    type: 'Feature' as const,

    id: row.id,

    geometry: row.geojson,

    properties: {

      layerId: layer.id,

      featureClassName: featureClass.name,

      geometryType: featureClass.geometryType,

      ...(row.attributes ?? {}),

    },

  };

}



@Injectable()

export class GisService {

  constructor(

    @InjectRepository(GisLayer) private layersRepo: Repository<GisLayer>,

    @InjectRepository(GisLayerGroup) private groupsRepo: Repository<GisLayerGroup>,

    @InjectRepository(ProjectFeature) private projectFeaturesRepo: Repository<ProjectFeature>,

    @InjectRepository(ProjectFeatureClass) private featureClassesRepo: Repository<ProjectFeatureClass>,

    private divisionAccess: DivisionAccessService,

    private mapAudit: GisMapAuditService,

  ) {}



  async getMapAccessContext(user: JwtPayload, focusDivisionId?: string) {

    const resolvedFocus = focusDivisionId?.trim()
      || user.activeDivisionId?.trim()
      || undefined;

    const context = await this.divisionAccess.getMapAccessContext(user, user.tenantId, resolvedFocus);

    await this.mapAudit.log(user, {

      action: 'map_login_access',

      details: {

        accessScope: context.accessScope,

        jurisdictionLabel: context.jurisdictionLabel,

        divisionCount: context.divisions.length,

      },

    });

    return context;

  }



  private async getAllowedProjectIdSet(user: JwtPayload, tenantId: string): Promise<Set<string> | null> {

    const ids = await this.divisionAccess.getAccessibleProjectIds(user, tenantId);

    if (ids === null) return null;

    return new Set(ids);

  }



  private layerProjectId(layer: GisLayer): string | null {

    if (layer.sourceType !== 'project_feature_class') return null;

    const config = layer.sourceConfig as { projectId?: string };

    return config.projectId?.trim() ?? null;

  }



  private async assertLayerAccess(user: JwtPayload, layer: GisLayer, tenantId: string): Promise<void> {

    const projectId = this.layerProjectId(layer);

    if (!projectId) return;

    await this.divisionAccess.assertProjectAccess(user, projectId, tenantId);

  }



  private filterLayersByAccess(layers: GisLayer[], allowed: Set<string> | null): GisLayer[] {

    return layers.filter((layer) => {

      if (layer.sourceType !== 'project_feature_class') return true;

      const projectId = this.layerProjectId(layer);

      if (!projectId) return false;

      if (allowed === null) return true;

      return allowed.has(projectId);

    });

  }



  async getLayerCatalog(user: JwtPayload) {

    const tenantId = user.tenantId;

    const allowed = await this.getAllowedProjectIdSet(user, tenantId);



    const groups = await this.groupsRepo.find({

      where: { tenantId },

      order: { sortOrder: 'ASC' },

    });



    const layers = await this.layersRepo.find({

      where: { tenantId, isPublished: true },

      order: { sortOrder: 'ASC' },

    });



    const accessibleLayers = this.filterLayersByAccess(layers, allowed);



    await this.mapAudit.log(user, {

      action: 'layer_catalog_load',

      details: { layerCount: accessibleLayers.length },

    });



    return groups

      .map((group) => ({

        id: group.id,

        name: group.name,

        isExpanded: group.isExpanded,

        layers: accessibleLayers

          .filter((l) => l.layerGroupId === group.id)

          .filter((l) => group.name === 'Basemaps' || l.sourceType === 'project_feature_class')

          .map((l) => ({

            id: l.id,

            name: l.name,

            sourceType: l.sourceType,

            sourceConfig: l.sourceConfig,

            defaultStyle: l.defaultStyle,

            minZoom: l.minZoom,

            maxZoom: l.maxZoom,

          })),

      }))

      .filter((group) => group.name === 'Basemaps' || group.layers.length > 0);

  }



  async getAllLayers(user: JwtPayload) {

    const layers = await this.layersRepo.find({

      where: { tenantId: user.tenantId },

      order: { sortOrder: 'ASC' },

    });

    const allowed = await this.getAllowedProjectIdSet(user, user.tenantId);

    return this.filterLayersByAccess(layers, allowed);

  }



  async getLayerFeatures(user: JwtPayload, layerId: string) {

    const tenantId = user.tenantId;

    const layer = await this.layersRepo.findOne({ where: { id: layerId, tenantId } });

    if (!layer) throw new NotFoundException('Layer not found');



    if (layer.sourceType === 'project_feature_class') {

      const config = layer.sourceConfig as {

        projectId?: string;

        featureClassId?: string;

      };

      if (!config.projectId || !config.featureClassId) {

        return { features: [], jurisdiction: this.divisionAccess.buildLayerJurisdictionMeta(null, 0, 0) };

      }



      await this.assertLayerAccess(user, layer, tenantId);



      const featureClass = await this.featureClassesRepo.findOne({

        where: { id: config.featureClassId, tenantId, projectId: config.projectId },

      });

      if (!featureClass) {

        return { features: [], jurisdiction: this.divisionAccess.buildLayerJurisdictionMeta(null, 0, 0) };

      }



      const pointDedupeSql = featureClass.geometryType === 'Point'

        ? `AND NOT EXISTS (

             SELECT 1

             FROM project_features dup

             WHERE dup.tenant_id = pf.tenant_id

               AND dup.project_id = pf.project_id

               AND dup.feature_class_id = pf.feature_class_id

               AND dup.id <> pf.id

               AND dup.geometry IS NOT NULL

               AND ST_DWithin(pf.geometry::geography, dup.geometry::geography, 25)

               AND (

                 dup.created_at < pf.created_at

                 OR (dup.created_at = pf.created_at AND dup.id::text < pf.id::text)

               )

           )`

        : '';



      const baseWhere = `pf.tenant_id = $1

           AND pf.project_id = $2

           AND pf.feature_class_id = $3

           AND pf.geometry IS NOT NULL

           ${pointDedupeSql}

           AND NOT EXISTS (

             SELECT 1

             FROM project_features larger

             WHERE larger.tenant_id = pf.tenant_id

               AND larger.project_id = pf.project_id

               AND larger.feature_class_id = pf.feature_class_id

               AND larger.id <> pf.id

               AND ST_Area(larger.geometry::geography) > ST_Area(pf.geometry::geography) * 1.05

               AND ST_Covers(larger.geometry, pf.geometry)

           )`;



      const districtNames = await this.divisionAccess.resolveJurisdictionDistrictNames(user, tenantId);

      let jurisdictionSql = '';

      let queryParams: unknown[] = [tenantId, config.projectId, config.featureClassId];

      if (districtNames?.length) {

        const jurisdiction = await this.divisionAccess.buildJurisdictionSqlFilter(

          tenantId,

          districtNames,

          'pf.geometry',

          queryParams.length,

        );

        jurisdictionSql = jurisdiction.sqlAnd;

        queryParams = [...queryParams, ...jurisdiction.extraParams];

      }



      let totalBeforeClip: number | null = null;

      if (districtNames?.length) {

        const countRows = await this.projectFeaturesRepo.query(

          `SELECT COUNT(*)::int AS total FROM project_features pf WHERE ${baseWhere}`,

          [tenantId, config.projectId, config.featureClassId],

        ) as Array<{ total: number }>;

        totalBeforeClip = countRows[0]?.total ?? 0;

      }



      const rows = await this.projectFeaturesRepo.query(

        `SELECT pf.id,

                pf.attributes,

                ST_AsGeoJSON(ST_Force2D(pf.geometry))::json AS geojson,

                ST_Area(pf.geometry::geography) AS area_sqm,

                ST_NPoints(pf.geometry) AS npoints

         FROM project_features pf

         WHERE ${baseWhere}

           ${jurisdictionSql}

         ORDER BY ST_Area(pf.geometry::geography) DESC, pf.created_at DESC`,

        queryParams,

      ) as LayerFeatureRow[];



      const seen = new Set<string>();

      const filtered = rows

        .filter((row) => row.geojson?.type && row.geojson.coordinates != null)

        .filter((row) => {

          const key = JSON.stringify(row.geojson!.coordinates);

          if (seen.has(key)) return false;

          seen.add(key);

          return true;

        });



      let result;

      if (featureClass.geometryType === 'Polygon' && filtered.length >= 1) {

        const maxArea = Math.max(...filtered.map((row) => Number(row.area_sqm ?? 0)));

        const maxPoints = Math.max(...filtered.map((row) => Number(row.npoints ?? 0)));

        const dominant = filtered.filter((row) => {

          const area = Number(row.area_sqm ?? 0);

          const points = Number(row.npoints ?? 0);

          if (maxArea > 0 && area < maxArea * 0.2) return false;

          if (maxPoints >= 10 && points < 6) return false;

          return true;

        });

        const rowsToReturn = dominant.length ? dominant : [filtered[0]];

        result = rowsToReturn.map((row) => toLayerFeature(row, layer, featureClass));

      } else if (featureClass.geometryType === 'Point') {

        const pointRows = dedupeNearbyPointRows(explodePointRows(filtered));

        result = pointRows.map((row) => toLayerFeature(row, layer, featureClass));

      } else {

        result = filtered.map((row) => toLayerFeature(row, layer, featureClass));

      }



      await this.mapAudit.log(user, {

        action: 'layer_features_load',

        layerId: layer.id,

        layerName: layer.name,

        projectId: config.projectId,

        details: {

          featureCount: result.length,

          hiddenOutsideBoundary: totalBeforeClip != null

            ? Math.max(0, totalBeforeClip - result.length)

            : 0,

        },

      });



      const jurisdiction = this.divisionAccess.buildLayerJurisdictionMeta(
        districtNames,
        totalBeforeClip ?? result.length,
        result.length,
      );

      return {
        features: result,
        jurisdiction,
      };

    }



    return {
      features: [],
      jurisdiction: this.divisionAccess.buildLayerJurisdictionMeta(null, 0, 0),
    };

  }



  async spatialQuery(user: JwtPayload, dto: GisSpatialQueryDto) {

    const tenantId = user.tenantId;

    const layer = await this.layersRepo.findOne({ where: { id: dto.layerId, tenantId } });

    if (!layer) throw new NotFoundException('Layer not found');

    if (layer.sourceType !== 'project_feature_class') {

      throw new BadRequestException('Spatial query is only supported on feature class layers.');

    }



    const config = layer.sourceConfig as { projectId?: string; featureClassId?: string };

    if (!config.projectId || !config.featureClassId) {

      throw new BadRequestException('Layer is missing project or feature class configuration.');

    }



    await this.assertLayerAccess(user, layer, tenantId);



    const featureClass = await this.featureClassesRepo.findOne({

      where: { id: config.featureClassId, tenantId, projectId: config.projectId },

    });

    if (!featureClass) throw new NotFoundException('Feature class not found');



    if (dto.operation === GisSpatialOperation.BUFFER && (dto.distance == null || dto.distance <= 0)) {

      throw new BadRequestException('Buffer distance in meters is required for buffer analysis.');

    }



    await this.divisionAccess.assertGeometryWithinJurisdiction(

      user,

      tenantId,

      dto.geometry as { type: string; coordinates: unknown },

    );



    const geoJson = JSON.stringify(dto.geometry);

    const queryGeom = `ST_SetSRID(ST_Force2D(ST_GeomFromGeoJSON($4)), 4326)`;

    const params: unknown[] = [tenantId, config.projectId, config.featureClassId, geoJson];



    let spatialClause: string;

    switch (dto.operation) {

      case GisSpatialOperation.BUFFER:

        spatialClause = `ST_DWithin(

          pf.geometry::geography,

          ${queryGeom}::geography,

          $5

        )`;

        params.push(dto.distance);

        break;

      case GisSpatialOperation.INTERSECT:

        spatialClause = `ST_Intersects(pf.geometry, ${queryGeom})`;

        break;

      case GisSpatialOperation.WITHIN:

        spatialClause = `ST_Within(pf.geometry, ${queryGeom})`;

        break;

      case GisSpatialOperation.CONTAINS:

        spatialClause = `ST_Contains(pf.geometry, ${queryGeom})`;

        break;

      default:

        throw new BadRequestException('Unsupported spatial operation.');

    }



    const districtNames = await this.divisionAccess.resolveJurisdictionDistrictNames(user, tenantId);

    let jurisdictionSql = '';

    if (districtNames?.length) {

      const jurisdiction = await this.divisionAccess.buildJurisdictionSqlFilter(

        tenantId,

        districtNames,

        'pf.geometry',

        params.length,

      );

      jurisdictionSql = jurisdiction.sqlAnd;

      params.push(...jurisdiction.extraParams);

    }



    const rows = await this.projectFeaturesRepo.query(

      `SELECT pf.id,

              pf.attributes,

              ST_AsGeoJSON(ST_Force2D(pf.geometry))::json AS geojson

       FROM project_features pf

       WHERE pf.tenant_id = $1

         AND pf.project_id = $2

         AND pf.feature_class_id = $3

         AND pf.geometry IS NOT NULL

         AND ${spatialClause}

         ${jurisdictionSql}

       ORDER BY pf.created_at DESC`,

      params,

    ) as LayerFeatureRow[];



    const features = rows

      .filter((row) => row.geojson?.type && row.geojson.coordinates != null)

      .map((row) => toLayerFeature(row, layer, featureClass));



    await this.mapAudit.log(user, {

      action: 'spatial_query',

      layerId: layer.id,

      layerName: layer.name,

      projectId: config.projectId,

      details: {

        operation: dto.operation,

        count: features.length,

        distance: dto.distance ?? null,

      },

    });



    return {

      type: 'FeatureCollection' as const,

      features,

      meta: {

        operation: dto.operation,

        layerId: layer.id,

        layerName: layer.name,

        featureClassName: featureClass.name,

        geometryType: featureClass.geometryType,

        count: features.length,

        distance: dto.distance ?? null,

      },

    };

  }



  async logMapAudit(user: JwtPayload, dto: {

    action: string;

    layerId?: string;

    layerName?: string;

    projectId?: string;

    details?: Record<string, unknown>;

  }) {

    if (dto.action === 'map_export' && !(await this.divisionAccess.canViewAllDivisions(user))) {

      const scope = await this.divisionAccess.getMapAccessContext(user, user.tenantId);

      if (!scope.divisions.length) {

        throw new ForbiddenException('Map export is not permitted outside your authorized jurisdiction.');

      }

    }

    await this.mapAudit.log(user, dto);

    return { logged: true };

  }

}


