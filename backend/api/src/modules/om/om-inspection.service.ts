import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../projects/entities/project.entity';
import { Asset } from '../assets/entities/asset.entity';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import {
  getInspectionTypeDef,
  OM_INSPECTION_TYPES,
} from './constants/om-inspection-catalog';
import { CreateOmInspectionDto } from './dto/create-om-inspection.dto';
import { OmInspection } from './entities/om-inspection.entity';
import { OmDivisionScopeService } from './om-division-scope.service';

@Injectable()
export class OmInspectionService {
  constructor(
    @InjectRepository(OmInspection) private inspectionRepo: Repository<OmInspection>,
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    @InjectRepository(Asset) private assetRepo: Repository<Asset>,
    private scope: OmDivisionScopeService,
  ) {}

  getCatalog() {
    return { types: OM_INSPECTION_TYPES };
  }

  async listInspections(
    user: JwtPayload,
    tenantId: string,
    filters: {
      projectId?: string;
      projectCode?: string;
      inspectionType?: string;
      from?: string;
      to?: string;
    },
  ) {
    const resolvedProjectId = await this.scope.resolveProjectId(user, tenantId, filters.projectId, filters.projectCode);
    const qb = this.inspectionRepo
      .createQueryBuilder('i')
      .where('i.tenant_id = :tenantId', { tenantId })
      .orderBy('i.inspection_date', 'DESC');

    await this.scope.scopeProjectQb(qb, user, tenantId, 'i', resolvedProjectId);
    if (filters.inspectionType) qb.andWhere('i.inspection_type = :inspectionType', { inspectionType: filters.inspectionType });
    if (filters.from) qb.andWhere('i.inspection_date >= :from', { from: filters.from });
    if (filters.to) qb.andWhere('i.inspection_date <= :to', { to: filters.to });

    const rows = await qb.getMany();
    return Promise.all(rows.map((r) => this.toRecord(tenantId, r)));
  }

  async getInspection(user: JwtPayload, tenantId: string, id: string) {
    const row = await this.inspectionRepo.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Inspection not found');
    await this.scope.assertProjectAccess(user, row.projectId, tenantId);
    return this.toRecord(tenantId, row);
  }

  async createInspection(user: JwtPayload, tenantId: string, userId: string, dto: CreateOmInspectionDto) {
    const typeDef = getInspectionTypeDef(dto.inspectionType);
    if (!typeDef) throw new BadRequestException('Invalid inspection type');

    const roleOk = typeDef.roles.some((r) => r.code === dto.performedByRole);
    if (!roleOk) {
      throw new BadRequestException(`Role "${dto.performedByRole}" is not valid for ${typeDef.label}`);
    }

    const resolvedProjectId = await this.scope.resolveProjectId(user, tenantId, dto.projectId, dto.projectCode);
    if (dto.assetId) {
      const asset = await this.assetRepo.findOne({ where: { id: dto.assetId, tenantId } });
      if (!asset) throw new BadRequestException('Asset not found');
    }

    this.validateChecklist(typeDef, dto.checklist);
    this.validateCoordinates(dto.latitude, dto.longitude);

    const inspection = this.inspectionRepo.create({
      tenantId,
      projectId: resolvedProjectId,
      assetId: dto.assetId ?? null,
      inspectionType: dto.inspectionType,
      performedByRole: dto.performedByRole,
      performedBy: userId,
      inspectionDate: dto.inspectionDate ? new Date(dto.inspectionDate) : new Date(),
      status: 'submitted',
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      checklist: dto.checklist,
      photos: dto.photos ?? [],
      notes: dto.notes ?? null,
    });

    const saved = await this.inspectionRepo.save(inspection);
    return this.toRecord(tenantId, saved);
  }

  async countDue(user: JwtPayload, tenantId: string): Promise<number> {
    const accessibleIds = await this.scope.getAccessibleProjectIds(user, tenantId);
    let projects: number;
    if (accessibleIds === null) {
      projects = await this.projectRepo.count({ where: { tenantId } });
    } else if (!accessibleIds.length) {
      return 0;
    } else {
      projects = accessibleIds.length;
    }
    if (!projects) return 0;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const dailyQb = this.inspectionRepo
      .createQueryBuilder('i')
      .select('COUNT(DISTINCT i.project_id)', 'cnt')
      .where('i.tenant_id = :tenantId', { tenantId })
      .andWhere('i.inspection_type = :type', { type: 'daily' })
      .andWhere('i.inspection_date >= :start', { start: startOfDay.toISOString() });
    await this.scope.scopeProjectQb(dailyQb, user, tenantId, 'i', null);

    const dailyToday = await dailyQb.getRawOne<{ cnt: string }>();

    const covered = Number(dailyToday?.cnt ?? 0);
    return Math.max(0, projects - covered);
  }

  async getSummary(user: JwtPayload, tenantId: string, projectId?: string) {
    const resolvedProjectId = projectId
      ? await this.scope.resolveProjectId(user, tenantId, projectId)
      : null;
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const base = this.inspectionRepo
      .createQueryBuilder('i')
      .where('i.tenant_id = :tenantId', { tenantId });
    await this.scope.scopeProjectQb(base, user, tenantId, 'i', resolvedProjectId);

    const [dailyToday, weeklyThisWeek, monthlyThisMonth, total] = await Promise.all([
      base.clone()
        .andWhere('i.inspection_type = :t', { t: 'daily' })
        .andWhere('i.inspection_date >= :d', { d: startOfDay.toISOString() })
        .getCount(),
      base.clone()
        .andWhere('i.inspection_type = :t', { t: 'weekly' })
        .andWhere('i.inspection_date >= :d', { d: startOfWeek.toISOString() })
        .getCount(),
      base.clone()
        .andWhere('i.inspection_type = :t', { t: 'monthly' })
        .andWhere('i.inspection_date >= :d', { d: startOfMonth.toISOString() })
        .getCount(),
      base.clone().getCount(),
    ]);

    return { dailyToday, weeklyThisWeek, monthlyThisMonth, total, inspectionDue: await this.countDue(user, tenantId) };
  }

  private validateChecklist(
    typeDef: NonNullable<ReturnType<typeof getInspectionTypeDef>>,
    checklist: Record<string, unknown>,
  ) {
    for (const field of typeDef.fields) {
      if (!field.required) continue;
      const val = checklist[field.key];
      if (val === undefined || val === null || val === '') {
        throw new BadRequestException(`${field.label} is required`);
      }
    }
  }

  private validateCoordinates(latitude?: number, longitude?: number) {
    if (latitude == null && longitude == null) return;
    if (latitude == null || longitude == null) {
      throw new BadRequestException('Provide both latitude and longitude for geo-tagging');
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      throw new BadRequestException('Invalid latitude or longitude');
    }
  }

  private async toRecord(tenantId: string, row: OmInspection) {
    let projectName: string | null = null;
    let projectCode: string | null = null;
    if (row.projectId) {
      const project = await this.projectRepo.findOne({ where: { id: row.projectId, tenantId } });
      projectName = project?.name ?? null;
      projectCode = project?.projectCode ?? null;
    }
    let assetCode: string | null = null;
    if (row.assetId) {
      const asset = await this.assetRepo.findOne({ where: { id: row.assetId, tenantId } });
      assetCode = asset?.assetCode ?? null;
    }

    return {
      id: row.id,
      projectId: row.projectId,
      projectName,
      projectCode,
      assetId: row.assetId,
      assetCode,
      inspectionType: row.inspectionType,
      performedByRole: row.performedByRole,
      performedBy: row.performedBy,
      inspectionDate: row.inspectionDate,
      status: row.status,
      latitude: row.latitude,
      longitude: row.longitude,
      checklist: row.checklist,
      photos: row.photos,
      notes: row.notes,
      createdAt: row.createdAt,
    };
  }
}
