import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { DivisionAccessService } from '../divisions/division-access.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { SpatialQueryDto } from './dto/spatial-query.dto';
import { AssetType } from './entities/asset-type.entity';
import { Asset } from './entities/asset.entity';

@Injectable()
export class AssetsService {
  constructor(
    @InjectRepository(Asset) private assetsRepo: Repository<Asset>,
    @InjectRepository(AssetType) private typesRepo: Repository<AssetType>,
    private divisionAccess: DivisionAccessService,
  ) {}

  async findAll(
    tenantId: string,
    user: JwtPayload,
    filters: { status?: string; assetType?: string; bbox?: string },
  ) {
    const qb = this.assetsRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.assetType', 't')
      .where('a.tenant_id = :tenantId', { tenantId })
      .andWhere('a.deleted_at IS NULL');

    await this.divisionAccess.scopeQueryByAccessibleProjects(qb, user, tenantId, 'a', null);

    if (filters.status) {
      qb.andWhere('a.status = :status', { status: filters.status });
    }
    if (filters.assetType) {
      qb.andWhere('t.code = :assetType', { assetType: filters.assetType });
    }
    if (filters.bbox) {
      const [minX, minY, maxX, maxY] = filters.bbox.split(',').map(Number);
      qb.andWhere(
        `ST_Intersects(a.geometry, ST_MakeEnvelope(:minX, :minY, :maxX, :maxY, 4326))`,
        { minX, minY, maxX, maxY },
      );
    }

    const assets = await qb.orderBy('a.created_at', 'DESC').getMany();
    return Promise.all(assets.map((a) => this.toGeoJsonFeature(a)));
  }

  async findOne(tenantId: string, user: JwtPayload, id: string) {
    const asset = await this.assetsRepo.findOne({
      where: { id, tenantId },
      relations: ['assetType'],
    });
    if (!asset) throw new NotFoundException('Asset not found');
    if (asset.projectId) {
      await this.divisionAccess.assertProjectAccess(user, asset.projectId, tenantId);
    }
    return this.toGeoJsonFeature(asset);
  }

  async create(tenantId: string, user: JwtPayload, dto: CreateAssetDto) {
    const saved = await this.assetsRepo
      .createQueryBuilder()
      .insert()
      .into(Asset)
      .values({
        tenantId,
        assetCode: dto.assetCode,
        assetTypeId: dto.assetTypeId,
        name: dto.name,
        status: dto.status ?? 'active',
        attributes: (dto.attributes ?? {}) as never,
        geometry: dto.geometry
          ? () => `ST_SetSRID(ST_GeomFromGeoJSON('${JSON.stringify(dto.geometry)}'), 4326)`
          : undefined,
      })
      .returning('*')
      .execute();

    return this.findOne(tenantId, user, saved.raw[0].id);
  }

  async spatialQuery(tenantId: string, user: JwtPayload, dto: SpatialQueryDto) {
    const geoJson = JSON.stringify(dto.geometry);
    const projectIds = await this.divisionAccess.getAccessibleProjectIds(user, tenantId);
    const params: unknown[] = [tenantId, geoJson];
    let paramIdx = 3;

    let spatialClause: string;
    if (dto.operation === 'buffer') {
      spatialClause = `ST_DWithin(
        a.geometry::geography,
        ST_SetSRID(ST_GeomFromGeoJSON($2), 4326)::geography,
        $${paramIdx}
      )`;
      params.push(dto.distance ?? 1000);
      paramIdx++;
    } else if (dto.operation === 'intersect') {
      spatialClause = `ST_Intersects(a.geometry, ST_SetSRID(ST_GeomFromGeoJSON($2), 4326))`;
    } else {
      spatialClause = `ST_Within(a.geometry, ST_SetSRID(ST_GeomFromGeoJSON($2), 4326))`;
    }

    let query = `
      SELECT a.*, ST_AsGeoJSON(a.geometry)::json AS geojson,
             t.code AS type_code, t.name AS type_name
      FROM assets a
      JOIN asset_types t ON t.id = a.asset_type_id
      WHERE a.tenant_id = $1
        AND a.deleted_at IS NULL
        AND ${spatialClause}`;

    if (projectIds !== null) {
      if (!projectIds.length) {
        return { type: 'FeatureCollection', features: [] };
      }
      query += ` AND a.project_id = ANY($${paramIdx}::uuid[])`;
      params.push(projectIds);
      paramIdx++;
    }

    if (dto.status) {
      query += ` AND a.status = $${paramIdx}`;
      params.push(dto.status);
      paramIdx++;
    }
    if (dto.assetType) {
      query += ` AND t.code = $${paramIdx}`;
      params.push(dto.assetType);
    }

    const rows = await this.assetsRepo.query(query, params);
    return {
      type: 'FeatureCollection',
      features: rows.map((r: Record<string, unknown>) => ({
        type: 'Feature',
        id: r.id,
        geometry: r.geojson,
        properties: {
          assetCode: r.asset_code,
          name: r.name,
          status: r.status,
          healthScore: r.health_score,
          assetType: r.type_code,
          assetTypeName: r.type_name,
          attributes: r.attributes,
        },
      })),
    };
  }

  async getAssetTypes(tenantId: string) {
    return this.typesRepo.find({
      where: [{ tenantId }, { tenantId: IsNull() }],
      order: { name: 'ASC' },
    });
  }

  private async toGeoJsonFeature(asset: Asset) {
    const geoResult = await this.assetsRepo.query(
      `SELECT ST_AsGeoJSON(geometry)::json AS geojson FROM assets WHERE id = $1`,
      [asset.id],
    );

    return {
      type: 'Feature',
      id: asset.id,
      geometry: geoResult[0]?.geojson ?? null,
      properties: {
        assetCode: asset.assetCode,
        name: asset.name,
        status: asset.status,
        healthScore: asset.healthScore,
        lifecycleStage: asset.lifecycleStage,
        assetType: asset.assetType?.code,
        assetTypeName: asset.assetType?.name,
        attributes: asset.attributes,
        createdAt: asset.createdAt,
        updatedAt: asset.updatedAt,
      },
    };
  }
}
