import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AssetType } from '../assets/entities/asset-type.entity';
import { Asset } from '../assets/entities/asset.entity';
import { ConstructionAsset } from '../construction/entities/construction-asset.entity';
import { Project } from '../projects/entities/project.entity';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { OmDivisionScopeService } from './om-division-scope.service';
import { OmHandover } from './entities/om-handover.entity';
import {
  CONSTRUCTION_TO_OM_TYPE,
  OM_ASSET_CATALOG,
  OM_ASSET_TYPE_ABBREV,
} from './constants/om-asset-catalog';
import { RegisterOmAssetDto, ImportConstructionAssetsDto } from './dto/register-om-asset.dto';
import { UpdateOmAssetDto } from './dto/update-om-asset.dto';

@Injectable()
export class OmAssetService {
  constructor(
    @InjectRepository(Asset) private assetRepo: Repository<Asset>,
    @InjectRepository(AssetType) private typeRepo: Repository<AssetType>,
    @InjectRepository(ConstructionAsset) private constructionAssetRepo: Repository<ConstructionAsset>,
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    @InjectRepository(OmHandover) private handoverRepo: Repository<OmHandover>,
    private scope: OmDivisionScopeService,
  ) {}

  getCatalog() {
    return { categories: OM_ASSET_CATALOG };
  }

  async listSchemeAssets(
    user: JwtPayload,
    tenantId: string,
    filters: { projectId?: string; projectCode?: string; handoverId?: string; category?: string; typeCode?: string },
  ) {
    const resolvedProjectId = await this.scope.resolveProjectId(user, tenantId, filters.projectId, filters.projectCode);
    const qb = this.assetRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.assetType', 't')
      .where('a.tenant_id = :tenantId', { tenantId })
      .andWhere('a.deleted_at IS NULL')
      .andWhere('(a.project_id IS NOT NULL OR a.handover_id IS NOT NULL OR a.om_category IS NOT NULL)');

    await this.scope.scopeProjectQb(qb, user, tenantId, 'a', resolvedProjectId);
    if (filters.handoverId) qb.andWhere('a.handover_id = :handoverId', { handoverId: filters.handoverId });
    if (filters.category) qb.andWhere('a.om_category = :category', { category: filters.category });
    if (filters.typeCode) qb.andWhere('t.code = :typeCode', { typeCode: filters.typeCode });

    const assets = await qb.orderBy('a.asset_code', 'ASC').getMany();
    return Promise.all(assets.map((a) => this.toAssetRecord(tenantId, a)));
  }

  async getSchemeAsset(user: JwtPayload, tenantId: string, id: string) {
    const asset = await this.assetRepo.findOne({
      where: { id, tenantId },
      relations: ['assetType'],
    });
    if (!asset) throw new NotFoundException('Asset not found');
    await this.scope.assertProjectAccess(user, asset.projectId, tenantId);
    return this.toAssetRecord(tenantId, asset);
  }

  async registerAsset(user: JwtPayload, tenantId: string, userId: string, dto: RegisterOmAssetDto) {
    const catalog = OM_ASSET_CATALOG.find((c) => c.typeCode === dto.typeCode);
    if (!catalog) throw new BadRequestException('Invalid asset type code');

    const assetType = await this.typeRepo.findOne({
      where: [{ tenantId, code: dto.typeCode }, { tenantId: IsNull(), code: dto.typeCode }],
    });
    if (!assetType) throw new BadRequestException(`Asset type "${dto.typeCode}" not configured`);

    const resolvedProjectId = await this.scope.resolveProjectId(user, tenantId, dto.projectId, dto.projectCode);
    if ((dto.projectId?.trim() || dto.projectCode?.trim()) && !resolvedProjectId) {
      throw new BadRequestException('Project not found for the selected scheme');
    }

    this.validateCoordinates(dto.latitude, dto.longitude);

    let projectCode = dto.projectCode?.trim() ?? null;
    if (!projectCode && resolvedProjectId) {
      const project = await this.projectRepo.findOne({ where: { id: resolvedProjectId, tenantId } });
      projectCode = project?.projectCode ?? null;
    }

    const assetCode = dto.assetCode?.trim()
      || await this.generateOmAssetCode(tenantId, resolvedProjectId, projectCode, dto.typeCode);

    const existing = await this.assetRepo.findOne({
      where: { tenantId, assetCode },
    });
    if (existing) throw new BadRequestException(`Asset code "${assetCode}" already exists`);

    let omAgency = dto.omAgency ?? null;
    if (dto.handoverId && !omAgency) {
      const handover = await this.handoverRepo.findOne({ where: { id: dto.handoverId, tenantId } });
      omAgency = handover?.omAgencyName ?? null;
    }

    const insert = await this.assetRepo
      .createQueryBuilder()
      .insert()
      .into(Asset)
      .values({
        tenantId,
        assetCode,
        assetTypeId: assetType.id,
        name: dto.name,
        status: dto.status ?? 'active',
        projectId: resolvedProjectId,
        handoverId: dto.handoverId ?? null,
        omCategory: catalog.group,
        omSubcategory: catalog.subcategory,
        installationDate: dto.installationDate ?? null,
        manufacturer: dto.manufacturer ?? null,
        capacity: dto.capacity ?? null,
        warrantyDetails: dto.warrantyDetails ?? null,
        designLifeYears: dto.designLifeYears ?? null,
        omAgency,
        lifecycleStage: 'operational',
        attributes: {
          ...(dto.attributes ?? {}),
          registeredBy: userId,
          registeredAt: new Date().toISOString(),
          ...(dto.latitude != null && dto.longitude != null
            ? { latitude: dto.latitude, longitude: dto.longitude }
            : {}),
        } as never,
      })
      .returning('*')
      .execute();

    const assetId = insert.raw[0].id as string;
    const qrCode = this.buildQrPayload(tenantId, assetId, assetCode);
    await this.assetRepo.update(assetId, { qrCode });

    if (dto.latitude != null && dto.longitude != null) {
      await this.setAssetGeometry(tenantId, assetId, dto.latitude, dto.longitude);
    }

    return this.getSchemeAsset(user, tenantId, assetId);
  }

  async updateSchemeAsset(user: JwtPayload, tenantId: string, userId: string, id: string, dto: UpdateOmAssetDto) {
    const asset = await this.assetRepo.findOne({
      where: { id, tenantId },
      relations: ['assetType'],
    });
    if (!asset) throw new NotFoundException('Asset not found');
    await this.scope.assertProjectAccess(user, asset.projectId, tenantId);
    if (!asset.projectId && !asset.handoverId && !asset.omCategory) {
      throw new BadRequestException('Asset is not an O&M scheme asset');
    }

    const patch: Partial<Asset> = {
      attributes: {
        ...(asset.attributes ?? {}),
        lastUpdatedBy: userId,
        lastUpdatedAt: new Date().toISOString(),
      } as never,
    };

    if (dto.assetCode !== undefined) {
      const assetCode = dto.assetCode.trim();
      if (!assetCode) throw new BadRequestException('Asset code cannot be empty');
      if (assetCode !== asset.assetCode) {
        const dup = await this.assetRepo.findOne({ where: { tenantId, assetCode } });
        if (dup) throw new BadRequestException(`Asset code "${assetCode}" already exists`);
        patch.assetCode = assetCode;
        patch.qrCode = this.buildQrPayload(tenantId, asset.id, assetCode);
      }
    }

    if (dto.typeCode !== undefined) {
      const catalog = OM_ASSET_CATALOG.find((c) => c.typeCode === dto.typeCode);
      if (!catalog) throw new BadRequestException('Invalid asset type code');
      const assetType = await this.typeRepo.findOne({
        where: [{ tenantId, code: dto.typeCode }, { tenantId: IsNull(), code: dto.typeCode }],
      });
      if (!assetType) throw new BadRequestException(`Asset type "${dto.typeCode}" not configured`);
      patch.assetTypeId = assetType.id;
      patch.omCategory = catalog.group;
      patch.omSubcategory = catalog.subcategory;
    }

    if (dto.name !== undefined) patch.name = dto.name.trim();
    if (dto.manufacturer !== undefined) patch.manufacturer = dto.manufacturer || null;
    if (dto.capacity !== undefined) patch.capacity = dto.capacity || null;
    if (dto.installationDate !== undefined) patch.installationDate = dto.installationDate || null;
    if (dto.warrantyDetails !== undefined) patch.warrantyDetails = dto.warrantyDetails || null;
    if (dto.designLifeYears !== undefined) patch.designLifeYears = dto.designLifeYears ?? null;
    if (dto.status !== undefined) patch.status = dto.status;

    await this.assetRepo.update({ id, tenantId }, patch as never);

    if (dto.clearGis) {
      await this.clearAssetGeometry(tenantId, id);
    } else if (dto.latitude !== undefined || dto.longitude !== undefined) {
      const { latitude: currentLat, longitude: currentLon } = await this.readAssetCoordinates(asset);
      const nextLat = dto.latitude !== undefined ? dto.latitude : currentLat;
      const nextLon = dto.longitude !== undefined ? dto.longitude : currentLon;
      this.validateCoordinates(nextLat ?? undefined, nextLon ?? undefined);
      if (nextLat != null && nextLon != null) {
        await this.setAssetGeometry(tenantId, id, nextLat, nextLon);
      }
    }

    return this.getSchemeAsset(user, tenantId, id);
  }

  async importFromConstruction(
    user: JwtPayload,
    tenantId: string,
    userId: string,
    dto: ImportConstructionAssetsDto,
  ) {
    const projectId = await this.scope.resolveProjectId(user, tenantId, dto.projectId, dto.projectCode);
    if (!projectId) {
      throw new BadRequestException('Select a valid scheme (project id or code required)');
    }

    const constructionAssets = await this.constructionAssetRepo.find({
      where: { tenantId, projectId },
      order: { assetCode: 'ASC' },
    });
    if (!constructionAssets.length) {
      return { imported: 0, skipped: [], assets: [], message: 'No construction assets found for this project' };
    }

    let omAgency: string | null = null;
    if (dto.handoverId) {
      const handover = await this.handoverRepo.findOne({ where: { id: dto.handoverId, tenantId } });
      omAgency = handover?.omAgencyName ?? null;
    }

    const created: unknown[] = [];
    const skipped: string[] = [];

    for (const ca of constructionAssets) {
      const typeCode = this.mapConstructionType(ca);
      const catalog = OM_ASSET_CATALOG.find((c) => c.typeCode === typeCode);
      if (!catalog) {
        skipped.push(ca.assetCode);
        continue;
      }

      const assetCode = `OM-${ca.assetCode}`;
      const dup = await this.assetRepo.findOne({ where: { tenantId, assetCode } });
      if (dup) {
        skipped.push(ca.assetCode);
        continue;
      }

      const assetType = await this.typeRepo.findOne({
        where: [{ tenantId, code: typeCode }, { tenantId: IsNull(), code: typeCode }],
      });
      if (!assetType) continue;

      const insert = await this.assetRepo
        .createQueryBuilder()
        .insert()
        .into(Asset)
        .values({
          tenantId,
          assetCode,
          assetTypeId: assetType.id,
          name: ca.name ?? ca.assetCode,
          status: ca.status === 'commissioned' ? 'active' : ca.status,
          projectId,
          handoverId: dto.handoverId ?? null,
          omCategory: catalog.group,
          omSubcategory: catalog.subcategory,
          installationDate: ca.installationDate ?? null,
          omAgency,
          manufacturer: (ca.attributes?.manufacturer as string) ?? ca.contractorName ?? null,
          capacity: (ca.attributes?.capacity as string) ?? null,
          lifecycleStage: 'operational',
          attributes: {
            constructionAssetId: ca.id,
            chainage: ca.chainage,
            component: ca.component,
            importedAt: new Date().toISOString(),
            importedBy: userId,
            ...(ca.latitude != null && ca.longitude != null
              ? { latitude: ca.latitude, longitude: ca.longitude }
              : {}),
          } as never,
        })
        .returning('*')
        .execute();

      const assetId = insert.raw[0].id as string;
      await this.assetRepo.update(assetId, { qrCode: this.buildQrPayload(tenantId, assetId, assetCode) });
      if (ca.latitude != null && ca.longitude != null) {
        await this.setAssetGeometry(tenantId, assetId, ca.latitude, ca.longitude);
      }
      created.push(await this.getSchemeAsset(user, tenantId, assetId));
    }

    return { imported: created.length, skipped, assets: created };
  }

  async getAssetQrInfo(user: JwtPayload, tenantId: string, id: string) {
    const asset = await this.assetRepo.findOne({ where: { id, tenantId } });
    if (!asset) throw new NotFoundException('Asset not found');
    await this.scope.assertProjectAccess(user, asset.projectId, tenantId);
    return this.getQrPayload(tenantId, asset);
  }

  getQrPayload(tenantId: string, asset: Asset) {
    const params = new URLSearchParams({
      asset: asset.id,
      code: asset.assetCode,
    });
    return {
      assetId: asset.id,
      assetCode: asset.assetCode,
      qrCode: asset.qrCode ?? this.buildQrPayload(tenantId, asset.id, asset.assetCode),
      scanUrl: `/om?${params.toString()}`,
    };
  }

  private async setAssetGeometry(
    tenantId: string,
    assetId: string,
    latitude: number,
    longitude: number,
  ): Promise<void> {
    await this.assetRepo.query(
      `UPDATE assets
       SET geometry = ST_SetSRID(ST_MakePoint($1, $2), 4326),
           attributes = COALESCE(attributes, '{}'::jsonb)
             || jsonb_build_object('latitude', $2::float, 'longitude', $1::float)
       WHERE id = $3 AND tenant_id = $4`,
      [longitude, latitude, assetId, tenantId],
    );
  }

  private async clearAssetGeometry(tenantId: string, assetId: string): Promise<void> {
    await this.assetRepo.query(
      `UPDATE assets
       SET geometry = NULL,
           attributes = COALESCE(attributes, '{}'::jsonb) - 'latitude' - 'longitude' - 'lat' - 'lon'
       WHERE id = $1 AND tenant_id = $2`,
      [assetId, tenantId],
    );
  }

  private async readAssetCoordinates(asset: Asset): Promise<{ latitude: number | null; longitude: number | null }> {
    const geo = await this.assetRepo.query(
      `SELECT ST_Y(geometry) AS lat, ST_X(geometry) AS lon
       FROM assets WHERE id = $1 AND geometry IS NOT NULL`,
      [asset.id],
    ).catch(() => []);
    return this.resolveCoordinates(asset, geo[0]);
  }

  private resolveCoordinates(
    asset: Asset,
    geoRow?: { lat?: unknown; lon?: unknown },
  ): { latitude: number | null; longitude: number | null } {
    if (geoRow?.lat != null && geoRow?.lon != null) {
      const latitude = Number(geoRow.lat);
      const longitude = Number(geoRow.lon);
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        return { latitude, longitude };
      }
    }
    const attrs = asset.attributes ?? {};
    const attrLat = attrs.latitude ?? attrs.lat;
    const attrLon = attrs.longitude ?? attrs.lon;
    if (attrLat != null && attrLon != null) {
      const latitude = Number(attrLat);
      const longitude = Number(attrLon);
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        return { latitude, longitude };
      }
    }
    return { latitude: null, longitude: null };
  }

  private buildQrPayload(tenantId: string, assetId: string, assetCode: string) {
    return `S2T2R|OM|${tenantId}|${assetId}|${assetCode}`;
  }

  private validateCoordinates(latitude?: number, longitude?: number) {
    if (latitude == null && longitude == null) return;
    if (latitude == null || longitude == null) {
      throw new BadRequestException('Provide both latitude and longitude for GIS mapping');
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      throw new BadRequestException('Invalid latitude or longitude');
    }
    if (latitude > 6 && latitude < 38 && longitude > 0 && longitude < 45) {
      throw new BadRequestException(
        'Longitude looks invalid for India (expected ~68–97°E). Check that latitude and longitude are not swapped.',
      );
    }
  }

  private async generateOmAssetCode(
    tenantId: string,
    projectId: string | null,
    projectCode: string | null,
    typeCode: string,
  ): Promise<string> {
    const abbrev = OM_ASSET_TYPE_ABBREV[typeCode]
      ?? typeCode.replace(/_/g, '').slice(0, 3).toUpperCase();
    const scheme = projectCode?.trim() || 'GEN';
    const prefix = `OM-${scheme}-${abbrev}-`;

    const qb = this.assetRepo
      .createQueryBuilder('a')
      .where('a.tenant_id = :tenantId', { tenantId })
      .andWhere('a.asset_code LIKE :prefix', { prefix: `${prefix}%` });
    if (projectId) qb.andWhere('a.project_id = :projectId', { projectId });

    let seq = (await qb.getCount()) + 1;
    let code = `${prefix}${String(seq).padStart(3, '0')}`;
    while (await this.assetRepo.findOne({ where: { tenantId, assetCode: code } })) {
      seq += 1;
      code = `${prefix}${String(seq).padStart(3, '0')}`;
    }
    return code;
  }

  private async resolveProject(tenantId: string, idOrCode: string) {
    const key = idOrCode.trim();
    if (!key) return null;
    const byId = await this.projectRepo.findOne({ where: { id: key, tenantId } });
    if (byId) return byId;
    return this.projectRepo.findOne({ where: { projectCode: key, tenantId } });
  }

  private mapConstructionType(ca: ConstructionAsset): string {
    const key = (ca.component ?? ca.assetType ?? '').toLowerCase().replace(/\s+/g, '_');
    return CONSTRUCTION_TO_OM_TYPE[key] ?? CONSTRUCTION_TO_OM_TYPE[ca.assetType?.toLowerCase()] ?? 'pump';
  }

  private async toAssetRecord(tenantId: string, asset: Asset) {
    const geo = await this.assetRepo.query(
      `SELECT ST_Y(geometry) AS lat, ST_X(geometry) AS lon FROM assets WHERE id = $1 AND geometry IS NOT NULL`,
      [asset.id],
    ).catch(() => []);
    const { latitude, longitude } = this.resolveCoordinates(asset, geo[0]);
    let breakdownHistoryCount = 0;
    try {
      const breakdownCount = await this.assetRepo.query(
        `SELECT COUNT(*)::int AS cnt FROM om_breakdown_tickets WHERE tenant_id = $1 AND asset_id = $2`,
        [tenantId, asset.id],
      );
      breakdownHistoryCount = breakdownCount[0]?.cnt ?? 0;
    } catch {
      breakdownHistoryCount = 0;
    }

    return {
      id: asset.id,
      assetCode: asset.assetCode,
      name: asset.name,
      status: asset.status,
      healthScore: asset.healthScore,
      lifecycleStage: asset.lifecycleStage,
      qrCode: asset.qrCode,
      projectId: asset.projectId,
      handoverId: asset.handoverId,
      omCategory: asset.omCategory,
      omSubcategory: asset.omSubcategory,
      installationDate: asset.installationDate,
      manufacturer: asset.manufacturer,
      capacity: asset.capacity,
      warrantyDetails: asset.warrantyDetails,
      designLifeYears: asset.designLifeYears,
      omAgency: asset.omAgency,
      assetType: asset.assetType?.code,
      assetTypeName: asset.assetType?.name,
      latitude,
      longitude,
      attributes: asset.attributes,
      maintenanceHistoryCount: 0,
      breakdownHistoryCount,
      createdAt: asset.createdAt,
    };
  }
}
