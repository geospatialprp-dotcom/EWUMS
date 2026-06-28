import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectMilestone } from '../projects/entities/project-milestone.entity';
import { Project } from '../projects/entities/project.entity';
import {
  COMPONENT_LABELS,
  PROJECT_COMPONENTS,
  type ProjectComponent,
} from './constants/construction.constants';
import { BoqItem } from './entities/boq-item.entity';
import { DprActivity } from './entities/dpr-activity.entity';
import { RaBill } from './entities/ra-bill.entity';
import { WorkPlanning } from './entities/work-planning.entity';
import { boqContractLineAmount } from './utils/boq-amount.util';
import { maxDprQtyByItemCode, resolveFinancialBoqSource } from './utils/boq-financial.util';

/** Map milestone names to BOQ components fed by contractor daily DPR. */
export function milestoneComponents(name: string): ProjectComponent[] | null {
  const n = name.toLowerCase();
  if (/pipeline|laying|main\s*line|pipe\s*line/.test(n)) {
    return ['gravity_main', 'pumping_main'];
  }
  if (/distribution|network/.test(n)) return ['distribution'];
  if (/reservoir|tank/.test(n)) return ['reservoir'];
  if (/fhtc|household|connection/.test(n)) return ['fhtc'];
  if (/source|intake/.test(n)) return ['source_development'];
  return null;
}

@Injectable()
export class ProjectProgressSyncService {
  constructor(
    @InjectRepository(Project) private readonly projectRepo: Repository<Project>,
    @InjectRepository(ProjectMilestone) private readonly milestoneRepo: Repository<ProjectMilestone>,
    @InjectRepository(BoqItem) private readonly boqRepo: Repository<BoqItem>,
    @InjectRepository(WorkPlanning) private readonly planningRepo: Repository<WorkPlanning>,
    @InjectRepository(RaBill) private readonly raBillRepo: Repository<RaBill>,
    @InjectRepository(DprActivity) private readonly dprActivityRepo: Repository<DprActivity>,
  ) {}

  /** Sync budget, spent, and DPR-linked milestones from construction data. */
  async syncFromConstruction(tenantId: string, projectId: string) {
    await this.syncBudgetFromApprovedBoq(tenantId, projectId);
    await this.syncSpentFromPayments(tenantId, projectId);
    await this.syncMilestonesFromDailyDpr(tenantId, projectId);
    await this.recomputePhysicalProgress(projectId);
  }

  /** Budget from L1 Contractor BOQ when uploaded; otherwise tender BOQ after planning approval. */
  async syncBudgetFromApprovedBoq(tenantId: string, projectId: string) {
    const financialSource = await resolveFinancialBoqSource(this.boqRepo, tenantId, projectId);
    if (financialSource === 'government') {
      const planning = await this.planningRepo.findOne({ where: { tenantId, projectId } });
      if (!planning || planning.status !== 'approved') return;
    }

    const items = await this.boqRepo.find({
      where: { tenantId, projectId, isActive: true, boqSource: financialSource },
    });
    if (!items.length) return;

    const budget = items.reduce((sum, item) => {
      const qty = Number(item.contractQty);
      const rate = Number(item.rate);
      const amount = Number(item.contractAmount);
      return sum + boqContractLineAmount(qty, rate, amount);
    }, 0);

    const rounded = Number(budget.toFixed(2));
    const project = await this.projectRepo.findOne({ where: { id: projectId, tenantId } });
    if (!project) return;

    project.budget = rounded;
    project.financialProgress = this.financialPct(rounded, Number(project.spent) || 0);
    await this.projectRepo.save(project);
  }

  /** Spent = department payments released to contractors (finance-released RA bills). */
  async syncSpentFromPayments(tenantId: string, projectId: string) {
    const bills = await this.raBillRepo.find({
      where: { tenantId, projectId, status: 'finance_released' },
    });
    const spent = bills.reduce((sum, bill) => sum + Number(bill.netPayable), 0);
    const rounded = Number(spent.toFixed(2));

    const project = await this.projectRepo.findOne({ where: { id: projectId, tenantId } });
    if (!project) return;

    project.spent = rounded;
    project.financialProgress = this.financialPct(Number(project.budget) || 0, rounded);
    await this.projectRepo.save(project);
  }

  /** Update milestones that map to pipeline/components from contractor daily DPR qty. */
  async syncMilestonesFromDailyDpr(tenantId: string, projectId: string) {
    const milestones = await this.milestoneRepo.find({ where: { projectId } });
    if (!milestones.length) return;

    const componentProgress = await this.getDprProgressByComponent(tenantId, projectId);

    for (const milestone of milestones) {
      const components = milestoneComponents(milestone.name);
      if (!components) continue;

      const pct = this.weightedComponentProgress(componentProgress, components);
      milestone.progress = pct ?? 0;
      if ((pct ?? 0) >= 100) {
        milestone.status = 'completed';
      } else if ((pct ?? 0) > 0) {
        milestone.status = 'in_progress';
      } else {
        milestone.status = 'pending';
      }
      await this.milestoneRepo.save(milestone);
    }
  }

  /** Contractor DPR progress broken down by BOQ component (L1 rates/qty baseline when available). */
  async getDprProgressByComponent(tenantId: string, projectId: string) {
    const financialSource = await resolveFinancialBoqSource(this.boqRepo, tenantId, projectId);
    const allItems = await this.boqRepo.find({ where: { tenantId, projectId, isActive: true } });
    const items = allItems.filter((i) => i.boqSource === financialSource);
    const dprQtyByCode = maxDprQtyByItemCode(allItems);

    // Fallback: sum activity qty by component when BOQ item link is missing
    const activityRows = await this.dprActivityRepo
      .createQueryBuilder('a')
      .innerJoin('dpr_reports', 'd', 'd.id = a.dpr_id')
      .where('d.tenant_id = :tenantId', { tenantId })
      .andWhere('d.project_id = :projectId', { projectId })
      .andWhere('d.status != :rejected', { rejected: 'rejected' })
      .select(['a.component AS component', 'SUM(a.quantity_done) AS qty'])
      .groupBy('a.component')
      .getRawMany();

    const activityByComponent = Object.fromEntries(
      activityRows
        .filter((r) => r.component)
        .map((r) => [r.component as string, Number(r.qty)]),
    );

    return PROJECT_COMPONENTS.map((component) => {
      const compItems = items.filter((i) => i.component === component);
      const contractQty = compItems.reduce(
        (s, i) => s + (Number(i.revisedQty) || Number(i.contractQty)),
        0,
      );
      const boqDprQty = compItems.reduce((s, i) => s + (dprQtyByCode[i.itemCode] ?? 0), 0);
      const activityQty = activityByComponent[component] ?? 0;
      const dprQty = Math.max(boqDprQty, activityQty);
      const pct = contractQty > 0
        ? Math.min(100, Math.round((dprQty / contractQty) * 10000) / 100)
        : 0;
      const unit = compItems[0]?.unit ?? '';
      return {
        component,
        label: COMPONENT_LABELS[component],
        contractQty,
        dprQty,
        pct,
        unit,
      };
    });
  }

  /** Detail for a DPR-linked milestone (shown in project milestone table). */
  buildMilestoneDprDetail(
    componentProgress: Array<{
      component: ProjectComponent;
      label: string;
      contractQty: number;
      dprQty: number;
      pct: number;
      unit: string;
    }>,
    components: ProjectComponent[],
  ) {
    const relevant = componentProgress.filter((c) => components.includes(c.component));
    const contractQty = relevant.reduce((s, c) => s + c.contractQty, 0);
    const dprQty = relevant.reduce((s, c) => s + c.dprQty, 0);
    const pct = this.weightedComponentProgress(componentProgress, components) ?? 0;
    const unit = relevant.find((c) => c.unit)?.unit ?? '';
    return {
      pct,
      dprQty: Number(dprQty.toFixed(3)),
      contractQty: Number(contractQty.toFixed(3)),
      unit,
      components: relevant.map((c) => c.label),
    };
  }

  private weightedComponentProgress(
    componentProgress: Array<{ component: ProjectComponent; contractQty: number; pct: number }>,
    components: ProjectComponent[],
  ): number | null {
    const relevant = componentProgress.filter((c) => components.includes(c.component));
    if (!relevant.length) return null;

    const totalQty = relevant.reduce((s, c) => s + c.contractQty, 0);
    if (totalQty <= 0) {
      const avg = relevant.reduce((s, c) => s + c.pct, 0) / relevant.length;
      return Number(avg.toFixed(2));
    }

    const weighted = relevant.reduce((s, c) => s + c.pct * c.contractQty, 0) / totalQty;
    return Number(Math.min(100, weighted).toFixed(2));
  }

  /** Update DPR-linked milestones and recompute project physical progress. */
  async syncMilestonesAndPhysical(tenantId: string, projectId: string) {
    await this.syncMilestonesFromDailyDpr(tenantId, projectId);
    await this.recomputePhysicalProgress(projectId);
  }

  async recomputePhysicalProgress(projectId: string) {
    const milestones = await this.milestoneRepo.find({ where: { projectId } });
    if (!milestones.length) return;

    const total = milestones.reduce((sum, m) => sum + Number(m.progress), 0);
    const average = Number((total / milestones.length).toFixed(2));
    await this.projectRepo.update(projectId, { physicalProgress: average });
  }

  private financialPct(budget: number, spent: number) {
    if (budget <= 0) return 0;
    return Number(Math.min(100, (spent / budget) * 100).toFixed(2));
  }
}
