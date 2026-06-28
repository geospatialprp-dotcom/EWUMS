import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asset } from '../assets/entities/asset.entity';
import { Project } from '../projects/entities/project.entity';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import {
  computePeriodDates,
  OM_PM_ASSET_TYPES,
  OM_PM_CATALOG,
  type OmPmCategory,
  type OmPmFrequency,
} from './constants/om-pm-catalog';
import { CompleteOmPmDto } from './dto/complete-om-pm.dto';
import { GenerateOmPmDto } from './dto/generate-om-pm.dto';
import { OmPmSchedule } from './entities/om-pm-schedule.entity';
import { OmDivisionScopeService } from './om-division-scope.service';

@Injectable()
export class OmPmService {
  constructor(
    @InjectRepository(OmPmSchedule) private pmRepo: Repository<OmPmSchedule>,
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    @InjectRepository(Asset) private assetRepo: Repository<Asset>,
    private scope: OmDivisionScopeService,
  ) {}

  getCatalog() {
    return { categories: OM_PM_CATALOG };
  }

  async listSchedules(
    user: JwtPayload,
    tenantId: string,
    filters: {
      projectId?: string;
      projectCode?: string;
      category?: string;
      frequency?: string;
      status?: string;
    },
  ) {
    const resolvedProjectId = await this.scope.resolveProjectId(user, tenantId, filters.projectId, filters.projectCode);
    const qb = this.pmRepo
      .createQueryBuilder('p')
      .where('p.tenant_id = :tenantId', { tenantId })
      .orderBy('p.due_date', 'ASC')
      .addOrderBy('p.category', 'ASC')
      .addOrderBy('p.task_name', 'ASC');

    await this.scope.scopeProjectQb(qb, user, tenantId, 'p', resolvedProjectId);
    if (filters.category) qb.andWhere('p.category = :category', { category: filters.category });
    if (filters.frequency) qb.andWhere('p.frequency = :frequency', { frequency: filters.frequency });
    if (filters.status) qb.andWhere('p.status = :status', { status: filters.status });

    const rows = await qb.getMany();
    return Promise.all(rows.map((r) => this.toRecord(tenantId, r)));
  }

  async generateSchedules(user: JwtPayload, tenantId: string, dto: GenerateOmPmDto) {
    const projectId = await this.scope.resolveProjectId(user, tenantId, dto.projectId, dto.projectCode);
    if (!projectId) {
      throw new BadRequestException('Project is required to generate preventive maintenance schedules');
    }

    const project = await this.projectRepo.findOne({ where: { id: projectId, tenantId } });
    if (!project) throw new BadRequestException('Project not found');

    const assets = await this.assetRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.assetType', 't')
      .where('a.tenant_id = :tenantId', { tenantId })
      .andWhere('a.project_id = :projectId', { projectId })
      .andWhere('a.deleted_at IS NULL')
      .getMany();

    const now = new Date();
    let created = 0;

    for (const catDef of OM_PM_CATALOG) {
      const typeCodes = OM_PM_ASSET_TYPES[catDef.category as OmPmCategory];
      const matchingAssets = assets.filter((a) => typeCodes.includes(a.assetType?.code ?? ''));

      for (const task of catDef.tasks) {
        const { periodKey, scheduledFor, dueDate } = computePeriodDates(task.frequency as OmPmFrequency, now);
        const targets = matchingAssets.length > 0 ? matchingAssets : [null];

        for (const asset of targets) {
          const exists = await this.pmRepo
            .createQueryBuilder('p')
            .where('p.tenant_id = :tenantId', { tenantId })
            .andWhere('p.project_id = :projectId', { projectId })
            .andWhere('p.task_code = :taskCode', { taskCode: task.code })
            .andWhere('p.period_key = :periodKey', { periodKey })
            .andWhere(
              asset
                ? 'p.asset_id = :assetId'
                : 'p.asset_id IS NULL',
              asset ? { assetId: asset.id } : {},
            )
            .getOne();

          if (exists) continue;

          const row = this.pmRepo.create({
            tenantId,
            projectId,
            assetId: asset?.id ?? null,
            category: catDef.category,
            taskCode: task.code,
            taskName: task.name,
            frequency: task.frequency,
            periodKey,
            scheduledFor: this.formatDate(scheduledFor),
            dueDate: this.formatDate(dueDate),
            status: 'scheduled',
          });

          await this.pmRepo.save(row);
          created += 1;
        }
      }
    }

    const schedules = await this.listSchedules(user, tenantId, { projectId });
    return { created, schedules };
  }

  async completeSchedule(user: JwtPayload, tenantId: string, userId: string, id: string, dto: CompleteOmPmDto) {
    const row = await this.pmRepo.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('PM schedule not found');
    await this.scope.assertProjectAccess(user, row.projectId, tenantId);
    if (row.status === 'completed') {
      throw new BadRequestException('This maintenance task is already completed');
    }

    row.status = 'completed';
    row.completedAt = new Date();
    row.completedBy = userId;
    row.notes = dto.notes?.trim() || row.notes;

    const saved = await this.pmRepo.save(row);
    return this.toRecord(tenantId, saved);
  }

  async countOverdue(user: JwtPayload, tenantId: string): Promise<number> {
    const today = this.formatDate(new Date());
    const qb = this.pmRepo
      .createQueryBuilder('p')
      .where('p.tenant_id = :tenantId', { tenantId })
      .andWhere('p.status = :status', { status: 'scheduled' })
      .andWhere('p.due_date < :today', { today });
    await this.scope.scopeProjectQb(qb, user, tenantId, 'p', null);
    return qb.getCount();
  }

  async getSummary(user: JwtPayload, tenantId: string, projectId?: string) {
    const resolvedProjectId = projectId
      ? await this.scope.resolveProjectId(user, tenantId, projectId)
      : null;
    const base = this.pmRepo
      .createQueryBuilder('p')
      .where('p.tenant_id = :tenantId', { tenantId });
    await this.scope.scopeProjectQb(base, user, tenantId, 'p', resolvedProjectId);

    const today = this.formatDate(new Date());
    const [scheduled, completed, overdue, total] = await Promise.all([
      base.clone().andWhere('p.status = :s', { s: 'scheduled' }).getCount(),
      base.clone().andWhere('p.status = :s', { s: 'completed' }).getCount(),
      base.clone()
        .andWhere('p.status = :s', { s: 'scheduled' })
        .andWhere('p.due_date < :today', { today })
        .getCount(),
      base.clone().getCount(),
    ]);

    return { scheduled, completed, overdue, total, pmOverdue: overdue };
  }

  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private effectiveStatus(row: OmPmSchedule): string {
    if (row.status === 'completed') return 'completed';
    const today = this.formatDate(new Date());
    if (row.dueDate < today) return 'overdue';
    return 'scheduled';
  }

  private async toRecord(tenantId: string, row: OmPmSchedule) {
    let projectName: string | null = null;
    let projectCode: string | null = null;
    const project = await this.projectRepo.findOne({ where: { id: row.projectId, tenantId } });
    projectName = project?.name ?? null;
    projectCode = project?.projectCode ?? null;

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
      category: row.category,
      taskCode: row.taskCode,
      taskName: row.taskName,
      frequency: row.frequency,
      periodKey: row.periodKey,
      scheduledFor: row.scheduledFor,
      dueDate: row.dueDate,
      status: this.effectiveStatus(row),
      completedAt: row.completedAt,
      completedBy: row.completedBy,
      notes: row.notes,
      createdAt: row.createdAt,
    };
  }
}
