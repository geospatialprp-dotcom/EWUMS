import {
  BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { DivisionAccessService } from '../divisions/division-access.service';
import { GisLayer } from '../gis/entities/gis-layer.entity';
import { CreateFeatureClassDto, UpdateFeatureClassDto } from './dto/feature-class.dto';
import { CreateProjectFeatureDto, ImportProjectFeaturesDto, UpdateProjectFeatureDto } from './dto/project-feature.dto';
import {
  AttributeField, GeometryType, ProjectFeatureClass,
} from './entities/project-feature-class.entity';
import { ProjectFeature } from './entities/project-feature.entity';
import { Project } from './entities/project.entity';
import {
  buildLaGisScaffoldTemplates,
  findExistingLaLayerAlias,
} from './la-gis-layer-scaffold';
import { LA_GIS_OVERLAY_LAYERS } from '../land-acquisition/constants/la-gis-layers.constants';

const WATER_SUPPLY_ASSET_GROUP_ID = 'e0000000-0000-0000-0000-000000000001';

const DEFAULT_STYLES: Record<GeometryType, Record<string, unknown>> = {
  Point: { fill: '#7B1FA2', radius: 8 },
  LineString: { stroke: '#7B1FA2', width: 4 },
  Polygon: { fill: 'rgba(229, 57, 53, 0.25)', stroke: '#E53935', width: 3 },
  Any: { fill: '#1565C0', stroke: '#1565C0', width: 3, radius: 8 },
};

@Injectable()
export class FeatureClassesService {
  constructor(
    @InjectRepository(Project) private projectsRepo: Repository<Project>,
    @InjectRepository(ProjectFeatureClass) private classesRepo: Repository<ProjectFeatureClass>,
    @InjectRepository(ProjectFeature) private featuresRepo: Repository<ProjectFeature>,
    @InjectRepository(GisLayer) private gisLayersRepo: Repository<GisLayer>,
    private divisionAccess: DivisionAccessService,
  ) {}

  async listClasses(tenantId: string, projectId: string) {
    await this.ensureProject(tenantId, projectId);
    const classes = await this.classesRepo.find({
      where: { tenantId, projectId },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
    const counts = await this.featuresRepo
      .createQueryBuilder('f')
      .select('f.feature_class_id', 'classId')
      .addSelect('COUNT(*)', 'count')
      .where('f.project_id = :projectId', { projectId })
      .andWhere('f.tenant_id = :tenantId', { tenantId })
      .groupBy('f.feature_class_id')
      .getRawMany<{ classId: string; count: string }>();

    const countMap = new Map(counts.map((row) => [row.classId, Number(row.count)]));
    return classes.map((featureClass) => ({
      ...featureClass,
      featureCount: countMap.get(featureClass.id) ?? 0,
    }));
  }

  async getClass(tenantId: string, projectId: string, classId: string) {
    return this.findClassOrFail(tenantId, projectId, classId);
  }

  async scaffoldLaGisLayers(tenantId: string, projectId: string) {
    await this.ensureProject(tenantId, projectId);
    const existing = await this.classesRepo.find({ where: { tenantId, projectId } });
    const existingCodes = new Set(existing.map((row) => row.code.toLowerCase()));

    const overlayByCode = new Map(
      LA_GIS_OVERLAY_LAYERS.map((layer) => [layer.featureClassCodes[0], layer]),
    );

    const items: Array<{
      code: string;
      name: string;
      status: 'created' | 'skipped';
      id?: string;
      reason?: string;
      matchedAlias?: string;
    }> = [];

    for (const template of buildLaGisScaffoldTemplates()) {
      if (existingCodes.has(template.code.toLowerCase())) {
        items.push({
          code: template.code,
          name: template.name,
          status: 'skipped',
          reason: 'already_exists',
        });
        continue;
      }

      const overlay = template.laLayerCode
        ? LA_GIS_OVERLAY_LAYERS.find((l) => l.code === template.laLayerCode)
        : overlayByCode.get(template.code);
      if (overlay) {
        const matchedAlias = findExistingLaLayerAlias(overlay, existingCodes);
        if (matchedAlias) {
          items.push({
            code: template.code,
            name: template.name,
            status: 'skipped',
            reason: 'alias_exists',
            matchedAlias,
          });
          continue;
        }
      }

      if (template.geometryType === 'Any') {
        await this.ensureMixedGeometrySupported();
      }

      const created = await this.createClass(tenantId, projectId, {
        code: template.code,
        name: template.name,
        description: template.description,
        geometryType: template.geometryType,
        attributeSchema: template.attributeSchema,
        sortOrder: template.sortOrder,
      });

      existingCodes.add(template.code.toLowerCase());
      items.push({
        code: template.code,
        name: template.name,
        status: 'created',
        id: created.id,
      });
    }

    return {
      totalTemplates: buildLaGisScaffoldTemplates().length,
      created: items.filter((i) => i.status === 'created').length,
      skipped: items.filter((i) => i.status === 'skipped').length,
      items,
    };
  }

  async createClass(tenantId: string, projectId: string, dto: CreateFeatureClassDto) {
    await this.ensureProject(tenantId, projectId);
    this.validateAttributeSchema(dto.attributeSchema);
    if (dto.geometryType === 'Any') {
      await this.ensureMixedGeometrySupported();
    }

    const featureClass = this.classesRepo.create({
      tenantId,
      projectId,
      code: dto.code,
      name: dto.name,
      description: dto.description ?? null,
      geometryType: dto.geometryType,
      attributeSchema: dto.attributeSchema,
      sortOrder: dto.sortOrder ?? 0,
    });

    let saved: ProjectFeatureClass;
    try {
      saved = await this.classesRepo.save(featureClass);
    } catch (error) {
      this.rethrowFeatureClassDbError(error, 'create feature class');
    }

    try {
      await this.syncGisLayer(tenantId, projectId, saved);
    } catch (error) {
      await this.classesRepo.remove(saved);
      this.rethrowFeatureClassDbError(error, 'publish GIS layer');
    }

    return saved;
  }

  async updateClass(
    tenantId: string,
    projectId: string,
    classId: string,
    dto: UpdateFeatureClassDto,
  ) {
    const featureClass = await this.findClassOrFail(tenantId, projectId, classId);
    if (dto.attributeSchema) this.validateAttributeSchema(dto.attributeSchema);

    // Only widening to 'Any' (mixed) is supported — it keeps existing features valid.
    const convertToMixed = dto.geometryType === 'Any' && featureClass.geometryType !== 'Any';

    Object.assign(featureClass, {
      name: dto.name ?? featureClass.name,
      description: dto.description ?? featureClass.description,
      attributeSchema: dto.attributeSchema ?? featureClass.attributeSchema,
      sortOrder: dto.sortOrder ?? featureClass.sortOrder,
      geometryType: convertToMixed ? 'Any' : featureClass.geometryType,
    });

    const saved = await this.classesRepo.save(featureClass);
    await this.syncGisLayerMeta(tenantId, saved);
    return saved;
  }

  async deleteClass(tenantId: string, projectId: string, classId: string) {
    const featureClass = await this.findClassOrFail(tenantId, projectId, classId);
    await this.removeGisLayer(tenantId, classId);
    await this.classesRepo.remove(featureClass);
    return { deleted: true };
  }

  async listFeatures(user: JwtPayload, tenantId: string, projectId: string, classId: string) {
    const featureClass = await this.findClassOrFail(tenantId, projectId, classId);
    const districtNames = await this.divisionAccess.resolveJurisdictionDistrictNames(user, tenantId);

    if (!districtNames?.length) {
      const features = await this.featuresRepo.find({
        where: { tenantId, projectId, featureClassId: classId },
        order: { createdAt: 'DESC' },
      });
      return Promise.all(features.map((feature) => this.toGeoJsonFeature(feature, featureClass)));
    }

    let jurisdictionSql = '';
    const params: unknown[] = [tenantId, projectId, classId];
    const jurisdiction = await this.divisionAccess.buildJurisdictionSqlFilter(
      tenantId,
      districtNames,
      'f.geometry',
      params.length,
    );
    jurisdictionSql = jurisdiction.sqlAnd;
    params.push(...jurisdiction.extraParams);

    const rows = await this.featuresRepo.query(
      `SELECT f.*
       FROM project_features f
       WHERE f.tenant_id = $1
         AND f.project_id = $2
         AND f.feature_class_id = $3
         AND f.geometry IS NOT NULL
         ${jurisdictionSql}
       ORDER BY f.created_at DESC`,
      params,
    ) as ProjectFeature[];

    return Promise.all(rows.map((feature) => this.toGeoJsonFeature(feature, featureClass)));
  }

  async createFeature(
    tenantId: string,
    projectId: string,
    classId: string,
    userId: string,
    dto: CreateProjectFeatureDto,
  ) {
    const featureClass = await this.findClassOrFail(tenantId, projectId, classId);
    if (dto.geometry) this.validateGeometry(dto.geometry, featureClass.geometryType);
    const attributes = this.validateAttributes(dto.attributes ?? {}, featureClass.attributeSchema);

    const saved = await this.featuresRepo
      .createQueryBuilder()
      .insert()
      .into(ProjectFeature)
      .values({
        tenantId,
        projectId,
        featureClassId: classId,
        attributes: attributes as never,
        createdBy: userId,
        geometry: dto.geometry
          ? () => `ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON('${JSON.stringify(dto.geometry)}'), 4326))`
          : undefined,
      })
      .returning('*')
      .execute();

    const feature = await this.featuresRepo.findOneBy({ id: saved.raw[0].id });
    if (!feature) throw new NotFoundException('Feature not created');
    return this.toGeoJsonFeature(feature, featureClass);
  }

  async importFeatures(
    user: JwtPayload,
    tenantId: string,
    projectId: string,
    classId: string,
    userId: string,
    dto: ImportProjectFeaturesDto,
  ) {
    const featureClass = await this.findClassOrFail(tenantId, projectId, classId);
    const districtNames = await this.divisionAccess.resolveJurisdictionDistrictNames(user, tenantId);
    const failed: { index: number; reason: string }[] = [];
    let imported = 0;

    for (let index = 0; index < dto.features.length; index += 1) {
      const item = dto.features[index];
      try {
        if (!item.geometry) throw new BadRequestException('Missing geometry');
        this.validateGeometry(item.geometry, featureClass.geometryType);
        if (districtNames?.length) {
          await this.divisionAccess.assertGeometryWithinJurisdiction(
            user,
            tenantId,
            item.geometry as { type: string; coordinates: unknown },
          );
        }
        const attributes = this.validateAttributes(item.attributes ?? {}, featureClass.attributeSchema);

        await this.featuresRepo.query(
          `INSERT INTO project_features
             (tenant_id, project_id, feature_class_id, geometry, attributes, created_by)
           VALUES ($1, $2, $3, ST_Force2D(ST_SetSRID(ST_MakeValid(ST_GeomFromGeoJSON($4)), 4326)), $5::jsonb, $6)`,
          [
            tenantId,
            projectId,
            classId,
            JSON.stringify(item.geometry),
            JSON.stringify(attributes),
            userId,
          ],
        );
        imported += 1;
      } catch (error) {
        const reason = error instanceof BadRequestException || error instanceof ForbiddenException
          ? String(error.message)
          : error instanceof Error
            ? error.message
            : 'Import failed';
        failed.push({ index, reason });
      }
    }

    if (imported === 0) {
      const outsideDistrict = failed.some((item) => /outside your authorized district boundary/i.test(item.reason));
      if (outsideDistrict) {
        throw new ForbiddenException(this.divisionAccess.outsideDistrictLayerMessage(districtNames));
      }
      throw new BadRequestException({
        message: 'No features were imported',
        imported,
        failed,
      });
    }

    return { imported, failed, total: dto.features.length };
  }

  async updateFeature(
    tenantId: string,
    projectId: string,
    featureId: string,
    dto: UpdateProjectFeatureDto,
  ) {
    const feature = await this.findFeatureOrFail(tenantId, projectId, featureId);
    const featureClass = await this.findClassOrFail(tenantId, projectId, feature.featureClassId);

    if (dto.geometry) this.validateGeometry(dto.geometry, featureClass.geometryType);
    const attributes = dto.attributes
      ? this.validateAttributes(dto.attributes, featureClass.attributeSchema)
      : feature.attributes;

    if (dto.geometry) {
      await this.featuresRepo.query(
        `UPDATE project_features
         SET geometry = ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)),
             attributes = $2::jsonb,
             updated_at = NOW()
         WHERE id = $3`,
        [JSON.stringify(dto.geometry), JSON.stringify(attributes), featureId],
      );
    } else if (dto.attributes) {
      await this.featuresRepo.update(featureId, { attributes: attributes as never });
    }

    const updated = await this.featuresRepo.findOneBy({ id: featureId });
    if (!updated) throw new NotFoundException('Feature not found');
    return this.toGeoJsonFeature(updated, featureClass);
  }

  async deleteFeature(tenantId: string, projectId: string, featureId: string) {
    const feature = await this.findFeatureOrFail(tenantId, projectId, featureId);
    await this.featuresRepo.remove(feature);
    return { deleted: true };
  }

  private async ensureProject(tenantId: string, projectId: string) {
    const project = await this.projectsRepo.findOne({ where: { id: projectId, tenantId } });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  private async findClassOrFail(tenantId: string, projectId: string, classId: string) {
    await this.ensureProject(tenantId, projectId);
    const featureClass = await this.classesRepo.findOne({
      where: { id: classId, tenantId, projectId },
    });
    if (!featureClass) throw new NotFoundException('Feature class not found');
    return featureClass;
  }

  private async findFeatureOrFail(tenantId: string, projectId: string, featureId: string) {
    const feature = await this.featuresRepo.findOne({
      where: { id: featureId, tenantId, projectId },
    });
    if (!feature) throw new NotFoundException('Feature not found');
    return feature;
  }

  private validateAttributeSchema(schema: AttributeField[]) {
    const names = new Set<string>();
    for (const field of schema) {
      if (names.has(field.name)) {
        throw new BadRequestException(`Duplicate attribute field name: ${field.name}`);
      }
      names.add(field.name);
      if (field.type === 'select' && (!field.options || field.options.length === 0)) {
        throw new BadRequestException(`Select field "${field.name}" requires options`);
      }
    }
  }

  private validateGeometry(geometry: object, expectedType: GeometryType) {
    const geo = geometry as { type?: string };
    // 'Any' (mixed) layers accept Point, LineString and Polygon (+ Multi variants).
    const allowed = expectedType === 'Any'
      ? new Set([
          'Point', 'MultiPoint',
          'LineString', 'MultiLineString',
          'Polygon', 'MultiPolygon',
        ])
      : new Set([expectedType, `Multi${expectedType}`]);
    if (!geo.type || !allowed.has(geo.type)) {
      const expected = expectedType === 'Any'
        ? 'a Point, Line or Polygon'
        : expectedType;
      throw new BadRequestException(`Geometry must be ${expected} for this feature class`);
    }
  }

  private validateAttributes(
    attributes: Record<string, unknown>,
    schema: AttributeField[],
  ): Record<string, unknown> {
    const result: Record<string, unknown> = { ...attributes };

    for (const field of schema) {
      const value = result[field.name];
      if (value === undefined || value === null || value === '') continue;

      switch (field.type) {
        case 'number':
          if (typeof value !== 'number') {
            throw new BadRequestException(`${field.label} must be a number`);
          }
          break;
        case 'integer':
          if (!Number.isInteger(Number(value))) {
            throw new BadRequestException(`${field.label} must be an integer`);
          }
          result[field.name] = Number(value);
          break;
        case 'boolean':
          if (typeof value !== 'boolean') {
            throw new BadRequestException(`${field.label} must be true or false`);
          }
          break;
        case 'select':
          if (!field.options?.includes(String(value))) {
            throw new BadRequestException(`${field.label} has an invalid option`);
          }
          break;
        case 'image': {
          const imageValue = String(value).trim();
          if (
            !imageValue.startsWith('http://')
            && !imageValue.startsWith('https://')
            && !imageValue.startsWith('data:image/')
          ) {
            throw new BadRequestException(`${field.label} must be a valid image URL or uploaded image`);
          }
          if (imageValue.startsWith('data:image/') && imageValue.length > 3_000_000) {
            throw new BadRequestException(`${field.label} is too large (max ~2 MB)`);
          }
          result[field.name] = imageValue;
          break;
        }
        default:
          result[field.name] = String(value);
      }
    }

    return result;
  }

  private async toGeoJsonFeature(feature: ProjectFeature, featureClass: ProjectFeatureClass) {
    const geoResult = await this.featuresRepo.query(
      `SELECT ST_AsGeoJSON(geometry)::json AS geojson FROM project_features WHERE id = $1`,
      [feature.id],
    );

    return {
      type: 'Feature',
      id: feature.id,
      geometry: geoResult[0]?.geojson ?? null,
      properties: {
        featureClassId: featureClass.id,
        featureClassCode: featureClass.code,
        featureClassName: featureClass.name,
        geometryType: featureClass.geometryType,
        attributes: feature.attributes,
        createdAt: feature.createdAt,
        updatedAt: feature.updatedAt,
      },
    };
  }

  private async syncGisLayer(tenantId: string, projectId: string, featureClass: ProjectFeatureClass) {
    const sortRows = await this.gisLayersRepo.query(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order
       FROM gis_layers WHERE layer_group_id = $1`,
      [WATER_SUPPLY_ASSET_GROUP_ID],
    );
    const sortOrder = Number(sortRows[0]?.next_order ?? 10);

    await this.gisLayersRepo.save(
      this.gisLayersRepo.create({
        tenantId,
        layerGroupId: WATER_SUPPLY_ASSET_GROUP_ID,
        name: featureClass.name,
        sourceType: 'project_feature_class',
        sourceConfig: {
          projectId,
          featureClassId: featureClass.id,
          code: featureClass.code,
          geometryType: featureClass.geometryType,
        },
        defaultStyle: featureClass.defaultStyle?.fill
          ? featureClass.defaultStyle
          : DEFAULT_STYLES[featureClass.geometryType],
        isPublished: true,
        sortOrder,
      }),
    );
  }

  private async syncGisLayerMeta(tenantId: string, featureClass: ProjectFeatureClass) {
    const layers = await this.gisLayersRepo.find({ where: { tenantId, sourceType: 'project_feature_class' } });
    const layer = layers.find(
      (l) => (l.sourceConfig as { featureClassId?: string })?.featureClassId === featureClass.id,
    );
    if (!layer) return;

    layer.name = featureClass.name;
    layer.sourceConfig = {
      ...(layer.sourceConfig as Record<string, unknown>),
      geometryType: featureClass.geometryType,
    };
    // Refresh the style only when the user did not set a custom fill.
    if (!featureClass.defaultStyle?.fill) {
      layer.defaultStyle = DEFAULT_STYLES[featureClass.geometryType];
    }
    await this.gisLayersRepo.save(layer);
  }

  private async removeGisLayer(tenantId: string, classId: string) {
    const layers = await this.gisLayersRepo.find({
      where: { tenantId, sourceType: 'project_feature_class' },
    });
    const layer = layers.find(
      (l) => (l.sourceConfig as { featureClassId?: string })?.featureClassId === classId,
    );
    if (layer) await this.gisLayersRepo.remove(layer);
  }

  private async ensureMixedGeometrySupported() {
    const rows = await this.classesRepo.query(
      `SELECT pg_get_constraintdef(oid) AS def
       FROM pg_constraint
       WHERE conrelid = 'project_feature_classes'::regclass
         AND conname = 'project_feature_classes_geometry_type_check'`,
    );
    const def = String(rows[0]?.def ?? '');
    if (def && !def.includes("'Any'")) {
      throw new BadRequestException(
        'Mixed geometry import requires database migration 020_feature_class_mixed_geometry.sql. '
        + 'Run: node scripts/apply-sql-migrations.js 020 (from backend/api).',
      );
    }
  }

  private rethrowFeatureClassDbError(error: unknown, action: string): never {
    if (error instanceof QueryFailedError) {
      const pgError = error as QueryFailedError & { code?: string; detail?: string };
      if (pgError.code === '23505') {
        throw new ConflictException('A layer with this code already exists on this project. Rename the layer or delete the existing one.');
      }
      if (pgError.code === '23514' && /geometry_type/i.test(pgError.message)) {
        throw new BadRequestException(
          'Mixed geometry import requires database migration 020_feature_class_mixed_geometry.sql. '
          + 'Run: node scripts/apply-sql-migrations.js 020 (from backend/api).',
        );
      }
      if (pgError.code === '23503') {
        throw new BadRequestException(`Could not ${action}: GIS layer group is missing on this database.`);
      }
    }
    throw error;
  }
}
