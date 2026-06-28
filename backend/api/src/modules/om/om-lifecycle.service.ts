import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asset } from '../assets/entities/asset.entity';
import { Project } from '../projects/entities/project.entity';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { OmDivisionScopeService } from './om-division-scope.service';
import {
  getDefaultDesignLifeYears,
  getLifecycleCategoryDef,
  getLifecycleCategoryForType,
  healthIndexToConditionGrade,
  OM_CONDITION_GRADES,
  OM_LIFECYCLE_CATEGORIES,
  OM_LIFECYCLE_WORKFLOW,
  OM_RENEWAL_PLAN_TYPES,
  recommendPlanType,
  type OmLifecycleCategory,
} from './constants/om-lifecycle-catalog';
import {
  AssessAssetLifecycleDto,
  CreateRenewalPlanDto,
  GenerateAnnualRenewalPlanDto,
  GenerateRenewalPlansDto,
  UpdateRenewalPlanDto,
} from './dto/create-om-lifecycle.dto';
import { OmAssetLifecycleAssessment } from './entities/om-asset-lifecycle-assessment.entity';
import { OmBreakdownTicket } from './entities/om-breakdown-ticket.entity';
import { OmPmSchedule } from './entities/om-pm-schedule.entity';
import { OmRenewalPlan } from './entities/om-renewal-plan.entity';

type AssetLifecycleRecord = {
  id: string;
  assetCode: string;
  name: string | null;
  typeCode: string | null;
  typeLabel: string | null;
  lifecycleCategory: OmLifecycleCategory | null;
  lifecycleCategoryLabel: string | null;
  projectId: string | null;
  projectCode: string | null;
  installationDate: string | null;
  ageYears: number | null;
  designLifeYears: number;
  healthIndex: number;
  conditionGrade: string;
  conditionGradeLabel: string;
  remainingUsefulLifeYears: number;
  recommendedAction: string | null;
  lifecycleStage: string;
};

@Injectable()
export class OmLifecycleService {
  constructor(
    @InjectRepository(Asset) private assetRepo: Repository<Asset>,
    @InjectRepository(OmAssetLifecycleAssessment) private assessmentRepo: Repository<OmAssetLifecycleAssessment>,
    @InjectRepository(OmRenewalPlan) private planRepo: Repository<OmRenewalPlan>,
    @InjectRepository(OmPmSchedule) private pmRepo: Repository<OmPmSchedule>,
    @InjectRepository(OmBreakdownTicket) private breakdownRepo: Repository<OmBreakdownTicket>,
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    private scope: OmDivisionScopeService,
  ) {}

  getCatalog() {
    return {
      categories: OM_LIFECYCLE_CATEGORIES,
      conditionGrades: OM_CONDITION_GRADES,
      planTypes: OM_RENEWAL_PLAN_TYPES,
      workflow: OM_LIFECYCLE_WORKFLOW,
    };
  }

  async listLifecycleAssets(
    user: JwtPayload,
    tenantId: string,
    filters: { projectId?: string; projectCode?: string; lifecycleCategory?: string },
  ) {
    const resolvedProjectId = await this.scope.resolveProjectId(user, tenantId, filters.projectId, filters.projectCode);
    const qb = this.assetRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.assetType', 't')
      .where('a.tenant_id = :tenantId', { tenantId })
      .andWhere('a.deleted_at IS NULL')
      .andWhere('(a.project_id IS NOT NULL OR a.handover_id IS NOT NULL OR a.om_category IS NOT NULL)');

    await this.scope.scopeProjectQb(qb, user, tenantId, 'a', resolvedProjectId);

    const assets = await qb.orderBy('a.assetCode', 'ASC').take(500).getMany();
    const records = await Promise.all(assets.map((a) => this.computeAssetLifecycle(tenantId, a)));

    if (filters.lifecycleCategory) {
      return records.filter((r) => r.lifecycleCategory === filters.lifecycleCategory);
    }
    return records.filter((r) => r.lifecycleCategory != null);
  }

  async getLifecycleAsset(user: JwtPayload, tenantId: string, assetId: string) {
    const asset = await this.assetRepo.findOne({
      where: { id: assetId, tenantId },
      relations: ['assetType'],
    });
    if (!asset) throw new NotFoundException('Asset not found');
    await this.scope.assertProjectAccess(user, asset.projectId, tenantId);
    return this.computeAssetLifecycle(tenantId, asset);
  }

  async assessAsset(user: JwtPayload, tenantId: string, userId: string, assetId: string, dto: AssessAssetLifecycleDto) {
    const asset = await this.assetRepo.findOne({
      where: { id: assetId, tenantId },
      relations: ['assetType'],
    });
    if (!asset) throw new NotFoundException('Asset not found');
    await this.scope.assertProjectAccess(user, asset.projectId, tenantId);

    const computed = await this.computeAssetLifecycle(tenantId, asset);
    const healthIndex = dto.healthIndex ?? computed.healthIndex;
    const conditionGrade = dto.conditionGrade ?? healthIndexToConditionGrade(healthIndex);

    const record = this.assessmentRepo.create({
      tenantId,
      assetId,
      projectId: asset.projectId,
      assessmentDate: dto.assessmentDate,
      conditionGrade,
      healthIndex,
      remainingUsefulLifeYears: computed.remainingUsefulLifeYears,
      conditionNotes: dto.conditionNotes?.trim() ?? null,
      assessedBy: userId,
    });

    await this.assessmentRepo.save(record);
    await this.assetRepo.update(assetId, { healthScore: healthIndex });

    return {
      assessment: record,
      asset: await this.computeAssetLifecycle(tenantId, asset),
    };
  }

  async listAssessments(user: JwtPayload, tenantId: string, assetId: string) {
    await this.ensureAsset(user, tenantId, assetId);
    const rows = await this.assessmentRepo.find({
      where: { tenantId, assetId },
      order: { assessmentDate: 'DESC' },
      take: 20,
    });
    return rows.map((r) => ({
      id: r.id,
      assessmentDate: r.assessmentDate,
      conditionGrade: r.conditionGrade,
      conditionGradeLabel: OM_CONDITION_GRADES.find((g) => g.code === r.conditionGrade)?.label ?? r.conditionGrade,
      healthIndex: r.healthIndex,
      remainingUsefulLifeYears: r.remainingUsefulLifeYears != null ? Number(r.remainingUsefulLifeYears) : null,
      conditionNotes: r.conditionNotes,
      createdAt: r.createdAt,
    }));
  }

  async listPlans(
    user: JwtPayload,
    tenantId: string,
    filters: { projectId?: string; projectCode?: string; planType?: string; planYear?: number; status?: string },
  ) {
    const resolvedProjectId = await this.scope.resolveProjectId(user, tenantId, filters.projectId, filters.projectCode);
    const qb = this.planRepo
      .createQueryBuilder('p')
      .where('p.tenant_id = :tenantId', { tenantId })
      .orderBy('p.createdAt', 'DESC')
      .take(200);

    await this.scope.scopeProjectQb(qb, user, tenantId, 'p', resolvedProjectId);
    if (filters.planType) qb.andWhere('p.plan_type = :planType', { planType: filters.planType });
    if (filters.planYear) qb.andWhere('p.plan_year = :planYear', { planYear: filters.planYear });
    if (filters.status) qb.andWhere('p.status = :status', { status: filters.status });

    const rows = await qb.getMany();
    return Promise.all(rows.map((r) => this.toPlanRecord(tenantId, r)));
  }

  async createPlan(user: JwtPayload, tenantId: string, userId: string, dto: CreateRenewalPlanDto) {
    const resolvedProjectId = await this.scope.resolveProjectId(user, tenantId, dto.projectId, dto.projectCode);
    let assetRecord: AssetLifecycleRecord | null = null;

    if (dto.assetId) {
      const asset = await this.assetRepo.findOne({
        where: { id: dto.assetId, tenantId },
        relations: ['assetType'],
      });
      if (!asset) throw new BadRequestException('Asset not found');
      assetRecord = await this.computeAssetLifecycle(tenantId, asset);
    }

    const count = await this.planRepo.count({ where: { tenantId } });
    const planNo = `REN-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

    const record = this.planRepo.create({
      tenantId,
      createdBy: userId,
      planNo,
      projectId: resolvedProjectId ?? assetRecord?.projectId ?? null,
      assetId: dto.assetId ?? null,
      lifecycleCategory: dto.lifecycleCategory,
      planType: dto.planType,
      planYear: dto.planYear ?? null,
      title: dto.title.trim(),
      description: dto.description?.trim() ?? null,
      healthIndexAtPlan: assetRecord?.healthIndex ?? null,
      remainingUsefulLifeYears: assetRecord?.remainingUsefulLifeYears ?? null,
      estimatedCost: dto.estimatedCost ?? null,
      priority: dto.priority ?? 'medium',
      targetDate: dto.targetDate ?? null,
      status: 'draft',
    });

    const saved = await this.planRepo.save(record);
    return this.toPlanRecord(tenantId, saved);
  }

  async generatePlans(user: JwtPayload, tenantId: string, userId: string, dto: GenerateRenewalPlansDto) {
    const assets = await this.listLifecycleAssets(user, tenantId, {
      projectId: dto.projectId,
      projectCode: dto.projectCode,
      lifecycleCategory: dto.lifecycleCategory,
    });

    const created: Array<Awaited<ReturnType<typeof this.toPlanRecord>>> = [];

    for (const asset of assets) {
      const planType = recommendPlanType(asset.healthIndex, asset.remainingUsefulLifeYears);
      if (!planType || !asset.lifecycleCategory) continue;

      const existing = await this.planRepo.findOne({
        where: {
          tenantId,
          assetId: asset.id,
          planType,
          status: 'draft',
        },
      });
      if (existing) continue;

      const title = planType === 'replacement'
        ? `Replace ${asset.assetCode} — ${asset.name ?? asset.typeLabel}`
        : `Rehabilitate ${asset.assetCode} — ${asset.name ?? asset.typeLabel}`;

      const plan = await this.createPlan(user, tenantId, userId, {
        assetId: asset.id,
        lifecycleCategory: asset.lifecycleCategory,
        planType,
        title,
        description: `Auto-generated from health index ${asset.healthIndex} and ${asset.remainingUsefulLifeYears} years RUL.`,
        priority: asset.healthIndex < 35 ? 'critical' : asset.healthIndex < 50 ? 'high' : 'medium',
        projectId: asset.projectId ?? undefined,
      });
      created.push(plan);
    }

    return { generated: created.length, plans: created };
  }

  async generateAnnualPlan(user: JwtPayload, tenantId: string, userId: string, dto: GenerateAnnualRenewalPlanDto) {
    const resolvedProjectId = await this.scope.resolveProjectId(user, tenantId, dto.projectId, dto.projectCode);

    const existing = await this.planRepo.findOne({
      where: {
        tenantId,
        planType: 'annual_capital',
        planYear: dto.planYear,
        ...(resolvedProjectId ? { projectId: resolvedProjectId } : {}),
      },
    });
    if (existing) {
      return this.toPlanRecord(tenantId, existing);
    }

    const draftPlans = await this.listPlans(user, tenantId, {
      projectId: dto.projectId,
      projectCode: dto.projectCode,
      status: 'draft',
    });

    const componentPlans = draftPlans.filter(
      (p) => p.planType === 'rehabilitation' || p.planType === 'replacement',
    );

    const totalCost = componentPlans.reduce((s, p) => s + (p.estimatedCost ?? 0), 0);
    const count = await this.planRepo.count({ where: { tenantId } });
    const planNo = `REN-${dto.planYear}-${String(count + 1).padStart(5, '0')}`;

    const byCategory = componentPlans.reduce<Record<string, number>>((acc, p) => {
      acc[p.lifecycleCategory] = (acc[p.lifecycleCategory] ?? 0) + 1;
      return acc;
    }, {});

    const summaryLines = Object.entries(byCategory).map(
      ([cat, n]) => `${getLifecycleCategoryDef(cat as OmLifecycleCategory).label}: ${n} works`,
    );

    const record = this.planRepo.create({
      tenantId,
      createdBy: userId,
      planNo,
      projectId: resolvedProjectId,
      assetId: null,
      lifecycleCategory: 'pumps',
      planType: 'annual_capital',
      planYear: dto.planYear,
      title: `Annual Capital Renewal Plan ${dto.planYear}`,
      description: [
        `Consolidated renewal programme for ${dto.planYear}.`,
        `${componentPlans.length} component plan(s) included.`,
        ...summaryLines,
      ].join('\n'),
      estimatedCost: totalCost > 0 ? totalCost : null,
      priority: 'high',
      status: 'draft',
      targetDate: `${dto.planYear}-03-31`,
    });

    const saved = await this.planRepo.save(record);
    return this.toPlanRecord(tenantId, saved);
  }

  async updatePlan(user: JwtPayload, tenantId: string, id: string, dto: UpdateRenewalPlanDto) {
    const plan = await this.planRepo.findOne({ where: { id, tenantId } });
    if (!plan) throw new NotFoundException('Renewal plan not found');
    await this.scope.assertProjectAccess(user, plan.projectId, tenantId);

    if (dto.status) plan.status = dto.status;
    if (dto.title?.trim()) plan.title = dto.title.trim();
    if (dto.description !== undefined) plan.description = dto.description?.trim() ?? null;
    if (dto.estimatedCost != null) plan.estimatedCost = dto.estimatedCost;
    if (dto.priority) plan.priority = dto.priority;
    if (dto.targetDate !== undefined) plan.targetDate = dto.targetDate ?? null;

    const saved = await this.planRepo.save(plan);
    return this.toPlanRecord(tenantId, saved);
  }

  async getSummary(user: JwtPayload, tenantId: string, projectId?: string) {
    const resolvedProjectId = projectId
      ? await this.scope.resolveProjectId(user, tenantId, projectId)
      : undefined;
    const assets = await this.listLifecycleAssets(user, tenantId, { projectId: resolvedProjectId ?? projectId });
    const withHealth = assets.filter((a) => a.lifecycleCategory);

    const avgHealthIndex = withHealth.length > 0
      ? Math.round(withHealth.reduce((s, a) => s + a.healthIndex, 0) / withHealth.length)
      : null;

    const criticalAssets = withHealth.filter((a) => a.conditionGrade === 'critical' || a.conditionGrade === 'poor').length;
    const replacementDue = withHealth.filter((a) => a.remainingUsefulLifeYears <= 2).length;

    const planBase = this.planRepo.createQueryBuilder('p').where('p.tenant_id = :tenantId', { tenantId });
    await this.scope.scopeProjectQb(planBase, user, tenantId, 'p', resolvedProjectId ?? null);

    const [rehabPlans, replacementPlans, annualPlans, draftPlans] = await Promise.all([
      planBase.clone().andWhere('p.plan_type = :t', { t: 'rehabilitation' }).andWhere('p.status != :c', { c: 'cancelled' }).getCount(),
      planBase.clone().andWhere('p.plan_type = :t', { t: 'replacement' }).andWhere('p.status != :c', { c: 'cancelled' }).getCount(),
      planBase.clone().andWhere('p.plan_type = :t', { t: 'annual_capital' }).getCount(),
      planBase.clone().andWhere('p.status = :s', { s: 'draft' }).getCount(),
    ]);

    const byCategory = OM_LIFECYCLE_CATEGORIES.map((cat) => ({
      category: cat.category,
      label: cat.label,
      count: withHealth.filter((a) => a.lifecycleCategory === cat.category).length,
      avgHealth: (() => {
        const subset = withHealth.filter((a) => a.lifecycleCategory === cat.category);
        if (!subset.length) return null;
        return Math.round(subset.reduce((s, a) => s + a.healthIndex, 0) / subset.length);
      })(),
    }));

    return {
      trackedAssets: withHealth.length,
      avgHealthIndex,
      criticalAssets,
      replacementDue,
      rehabilitationPlans: rehabPlans,
      replacementPlans,
      annualPlans,
      draftPlans,
      byCategory,
    };
  }

  private async computeAssetLifecycle(tenantId: string, asset: Asset): Promise<AssetLifecycleRecord> {
    const typeCode = asset.assetType?.code ?? null;
    const lifecycleCategory = typeCode ? getLifecycleCategoryForType(typeCode) : null;
    const designLifeYears = asset.designLifeYears ?? (typeCode ? getDefaultDesignLifeYears(typeCode) : 20);
    const ageYears = this.computeAgeYears(asset.installationDate, asset.createdAt);

    const [pmOverdue, openBreakdowns] = await Promise.all([
      this.countPmOverdue(tenantId, asset.id),
      this.countOpenBreakdowns(tenantId, asset.id),
    ]);

    const ageRatio = designLifeYears > 0 ? Math.min(1, ageYears / designLifeYears) : 0;
    const agePenalty = ageRatio * 35;
    const pmPenalty = Math.min(15, pmOverdue * 5);
    const bdPenalty = Math.min(20, openBreakdowns * 10);

    let healthIndex = Math.round(
      Math.max(0, Math.min(100, (asset.healthScore ?? 100) - agePenalty - pmPenalty - bdPenalty)),
    );

    const latestAssessment = await this.assessmentRepo.findOne({
      where: { tenantId, assetId: asset.id },
      order: { assessmentDate: 'DESC' },
    });
    if (latestAssessment) {
      healthIndex = latestAssessment.healthIndex;
    }

    const remainingUsefulLifeYears = Math.round(
      Math.max(0, (designLifeYears - ageYears) * (healthIndex / 100)) * 10,
    ) / 10;

    const conditionGrade = healthIndexToConditionGrade(healthIndex);
    const planType = recommendPlanType(healthIndex, remainingUsefulLifeYears);

    let projectCode: string | null = null;
    if (asset.projectId) {
      const project = await this.projectRepo.findOne({ where: { id: asset.projectId, tenantId } });
      projectCode = project?.projectCode ?? null;
    }

    return {
      id: asset.id,
      assetCode: asset.assetCode,
      name: asset.name,
      typeCode,
      typeLabel: asset.assetType?.name ?? asset.omSubcategory,
      lifecycleCategory,
      lifecycleCategoryLabel: lifecycleCategory ? getLifecycleCategoryDef(lifecycleCategory).label : null,
      projectId: asset.projectId,
      projectCode,
      installationDate: asset.installationDate,
      ageYears: Math.round(ageYears * 10) / 10,
      designLifeYears,
      healthIndex,
      conditionGrade,
      conditionGradeLabel: OM_CONDITION_GRADES.find((g) => g.code === conditionGrade)?.label ?? conditionGrade,
      remainingUsefulLifeYears,
      recommendedAction: planType
        ? planType === 'replacement' ? 'Replacement recommended' : 'Rehabilitation recommended'
        : 'Monitor — no renewal action required',
      lifecycleStage: asset.lifecycleStage,
    };
  }

  private computeAgeYears(installationDate: string | null, createdAt: Date): number {
    const ref = installationDate ? new Date(installationDate) : createdAt;
    const now = new Date();
    return (now.getTime() - ref.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  }

  private async countPmOverdue(tenantId: string, assetId: string): Promise<number> {
    const today = this.formatDate(new Date());
    return this.pmRepo
      .createQueryBuilder('p')
      .where('p.tenant_id = :tenantId', { tenantId })
      .andWhere('p.asset_id = :assetId', { assetId })
      .andWhere('p.status = :s', { s: 'scheduled' })
      .andWhere('p.due_date < :today', { today })
      .getCount();
  }

  private async countOpenBreakdowns(tenantId: string, assetId: string): Promise<number> {
    return this.breakdownRepo
      .createQueryBuilder('b')
      .where('b.tenant_id = :tenantId', { tenantId })
      .andWhere('b.asset_id = :assetId', { assetId })
      .andWhere('b.status != :closed', { closed: 'closed' })
      .getCount();
  }

  private async ensureAsset(user: JwtPayload, tenantId: string, assetId: string) {
    const asset = await this.assetRepo.findOne({ where: { id: assetId, tenantId } });
    if (!asset) throw new NotFoundException('Asset not found');
    await this.scope.assertProjectAccess(user, asset.projectId, tenantId);
    return asset;
  }

  private async toPlanRecord(tenantId: string, row: OmRenewalPlan) {
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
      planNo: row.planNo,
      planType: row.planType,
      planTypeLabel: OM_RENEWAL_PLAN_TYPES.find((t) => t.code === row.planType)?.label ?? row.planType,
      planYear: row.planYear,
      lifecycleCategory: row.lifecycleCategory,
      lifecycleCategoryLabel: getLifecycleCategoryDef(row.lifecycleCategory as OmLifecycleCategory).label,
      title: row.title,
      description: row.description,
      assetId: row.assetId,
      assetCode,
      projectId: row.projectId,
      projectName,
      projectCode,
      healthIndexAtPlan: row.healthIndexAtPlan,
      remainingUsefulLifeYears: row.remainingUsefulLifeYears != null ? Number(row.remainingUsefulLifeYears) : null,
      estimatedCost: row.estimatedCost != null ? Number(row.estimatedCost) : null,
      priority: row.priority,
      status: row.status,
      targetDate: row.targetDate,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
