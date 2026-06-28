import {
  BadRequestException, Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryFailedError, Repository } from 'typeorm';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { WorkflowsService } from '../workflows/workflows.service';
import { WorkflowTask } from '../workflows/entities/workflow-task.entity';
import { normalizeBoqUnit, parseBoqExcelBuffer } from './utils/boq-excel.parser';
import {
  aggregateQtyByItemCode,
  buildBoqIdToItemCode,
  financialBoqByItemCode,
  financialBoqLabel,
  resolveFinancialBoqItem,
  resolveFinancialBoqSource,
} from './utils/boq-financial.util';
import {
  selectFhtcBoqRows, summarizeFhtcBoqRows,
} from './utils/boq-fhtc.util';
import {
  boqContractLineAmount, boqEffectiveRate, boqPendingMeasurementQty, boqQtyAmount,
  boqSavingsQty, boqVarianceType, gstFromInclusiveAmount, netPayableFromInclusiveGross,
  raBillDisplayRate, raBillLineAmount,
} from './utils/boq-amount.util';
import {
  constructionUploadDir,
  constructionUploadRelativeUrl,
  fileExists,
  guessMimeType,
  resolveConstructionFilePath,
  uniqueUploadFileName,
  writeUploadFile,
} from './utils/construction-files.util';
import {
  COMPONENT_LABELS,
  GIS_ASSET_LABELS,
  GIS_ASSET_TYPES,
  PROJECT_COMPONENTS,
  RA_STATUS_BY_STEP,
  WORKFLOW_STAGES,
} from './constants/construction.constants';
import {
  CreateConstructionAssetDto, CreateDprDto, CreateInvoiceDto, CreateMbDto,
  CreateRaBillDto, CreateWorkPackageDto, GenerateFinalBillDto, ImportBoqDto, UpdateCompletionVerificationDto,
  UpdateConstructionAssetDto, UpdateWorkPackageDto, UpdateWorkPlanningDto, UploadDocumentDto, WorkflowActionDto,
} from './dto/construction.dto';
import { BoqItem } from './entities/boq-item.entity';
import { ConstructionAsset } from './entities/construction-asset.entity';
import { ConstructionDocument } from './entities/construction-document.entity';
import { ContractorInvoice } from './entities/contractor-invoice.entity';
import { DprActivity } from './entities/dpr-activity.entity';
import { DprReport } from './entities/dpr-report.entity';
import { InvoiceLineItem } from './entities/invoice-line-item.entity';
import { MbEntry } from './entities/mb-entry.entity';
import { MeasurementBook } from './entities/measurement-book.entity';
import { ProjectCompletion } from './entities/project-completion.entity';
import { RaBill } from './entities/ra-bill.entity';
import { RaBillLine } from './entities/ra-bill-line.entity';
import { WorkPackage } from './entities/work-package.entity';
import { WorkPlanning } from './entities/work-planning.entity';
import { ProjectProgressSyncService } from './project-progress-sync.service';

const DPR_STATUS_BY_STEP: Record<number, string> = {
  1: 'je_review', 2: 'ae_review', 3: 'ee_approved',
};
const MB_STATUS_BY_STEP: Record<number, string> = {
  1: 'ae_checked',
  2: 'ee_checked',
};
const INVOICE_STATUS_BY_STEP: Record<number, string> = {
  1: 'accounts_verified', 2: 'ee_sanctioned',
};

@Injectable()
export class ConstructionService {
  constructor(
    @InjectRepository(BoqItem) private boqRepo: Repository<BoqItem>,
    @InjectRepository(DprReport) private dprRepo: Repository<DprReport>,
    @InjectRepository(DprActivity) private dprActivityRepo: Repository<DprActivity>,
    @InjectRepository(MeasurementBook) private mbRepo: Repository<MeasurementBook>,
    @InjectRepository(MbEntry) private mbEntryRepo: Repository<MbEntry>,
    @InjectRepository(ContractorInvoice) private invoiceRepo: Repository<ContractorInvoice>,
    @InjectRepository(InvoiceLineItem) private invoiceLineRepo: Repository<InvoiceLineItem>,
    @InjectRepository(ConstructionDocument) private docRepo: Repository<ConstructionDocument>,
    @InjectRepository(WorkflowTask) private taskRepo: Repository<WorkflowTask>,
    @InjectRepository(WorkPackage) private wpRepo: Repository<WorkPackage>,
    @InjectRepository(WorkPlanning) private planningRepo: Repository<WorkPlanning>,
    @InjectRepository(RaBill) private raBillRepo: Repository<RaBill>,
    @InjectRepository(RaBillLine) private raBillLineRepo: Repository<RaBillLine>,
    @InjectRepository(ConstructionAsset) private assetRepo: Repository<ConstructionAsset>,
    @InjectRepository(ProjectCompletion) private completionRepo: Repository<ProjectCompletion>,
    private workflowsService: WorkflowsService,
    private progressSync: ProjectProgressSyncService,
  ) {}

  private async refreshProjectProgress(
    tenantId: string,
    projectId: string,
    scope: 'all' | 'budget' | 'spent' | 'milestones' = 'all',
  ) {
    try {
      if (scope === 'all') {
        await this.progressSync.syncFromConstruction(tenantId, projectId);
      } else if (scope === 'budget') {
        await this.progressSync.syncBudgetFromApprovedBoq(tenantId, projectId);
      } else if (scope === 'spent') {
        await this.progressSync.syncSpentFromPayments(tenantId, projectId);
      } else {
        await this.progressSync.syncMilestonesAndPhysical(tenantId, projectId);
      }
    } catch {
      // Progress sync must not block construction workflows
    }
  }

  async getOverview(tenantId: string, projectId: string) {
    const dashboard = await this.getDashboard(tenantId, projectId);
    return {
      ...dashboard,
      workflowChain: WORKFLOW_STAGES,
      components: PROJECT_COMPONENTS.map((c) => ({ code: c, label: COMPONENT_LABELS[c] })),
      schemeTypes: ['gravity', 'pumping'],
    };
  }

  async getDashboard(tenantId: string, projectId: string) {
    const safeCount = async (fn: () => Promise<number>) => {
      try { return await fn(); } catch { return 0; }
    };

    const MB_DONE = ['draft', 'boq_finalized', 'rejected'];
    const RA_DONE = ['draft', 'finance_released', 'rejected'];
    const DPR_DONE = ['draft', 'ee_approved', 'rejected'];

    const [
      boqCount, dprCount, mbCount, invoiceCount, docCount, raCount, wpCount, assetCount,
      pendingDprs, pendingMbs, pendingRa,       pendingMbReviews, pendingBills,
      assets, allDprs, allMbs, allRaBills,
    ] = await Promise.all([
      safeCount(() => this.boqRepo.count({ where: { tenantId, projectId, isActive: true } })),
      safeCount(() => this.dprRepo.count({ where: { tenantId, projectId } })),
      safeCount(() => this.mbRepo.count({ where: { tenantId, projectId } })),
      safeCount(() => this.invoiceRepo.count({ where: { tenantId, projectId } })),
      safeCount(() => this.docRepo.count({ where: { tenantId, projectId } })),
      safeCount(() => this.raBillRepo.count({ where: { tenantId, projectId } })),
      safeCount(() => this.wpRepo.count({ where: { tenantId, projectId } })),
      safeCount(() => this.assetRepo.count({ where: { tenantId, projectId } })),
      safeCount(() => this.dprRepo.count({ where: { tenantId, projectId, status: 'je_review' } })),
      safeCount(() => this.mbRepo.count({ where: { tenantId, projectId, status: 'je_review' } })),
      safeCount(() => this.raBillRepo.count({
        where: { tenantId, projectId, status: In(['je_review', 'ae_checked', 'ee_checked', 'accounts_verification']) },
      })),
      safeCount(() => this.mbRepo.count({
        where: { tenantId, projectId, status: In(['je_review', 'ae_checked', 'ee_checked']) },
      })),
      safeCount(() => this.raBillRepo.count({
        where: { tenantId, projectId, status: In(['je_review', 'ae_checked', 'ee_checked', 'accounts_verification']) },
      })),
      this.assetRepo.find({ where: { tenantId, projectId } }).catch(() => [] as ConstructionAsset[]),
      this.listDprs(tenantId, projectId).catch(() => [] as DprReport[]),
      this.listMbs(tenantId, projectId).catch(() => [] as MeasurementBook[]),
      this.listRaBills(tenantId, projectId).catch(() => [] as RaBill[]),
    ]);

    let reconciliation: Awaited<ReturnType<ConstructionService['getBoqReconciliation']>> | null = null;
    try {
      reconciliation = await this.getBoqReconciliation(tenantId, projectId);
    } catch {
      reconciliation = null;
    }
    const totals = reconciliation?.totals ?? {
      contractQty: 0, contractValue: 0, executedQty: 0, executedValue: 0,
      mbQty: 0, mbValue: 0, pendingMeasurementQty: 0,
    };
    const totalContract = totals.contractValue;
    const totalExecuted = totals.executedValue;
    const physicalPct = totals.contractQty > 0
      ? Math.min(100, (totals.executedQty / totals.contractQty) * 100)
      : 0;
    const financialPct = totalContract > 0
      ? Math.min(100, (totalExecuted / totalContract) * 100)
      : 0;

    let completion = null;
    try {
      completion = await this.syncProjectCompletion(tenantId, projectId);
    } catch {
      completion = null;
    }
    const [recentDprs, recentMbs, componentProgress] = await Promise.all([
      this.dprRepo.find({ where: { tenantId, projectId }, order: { reportDate: 'DESC' }, take: 5 }),
      this.mbRepo.find({ where: { tenantId, projectId }, order: { measurementDate: 'DESC' }, take: 5 }),
      this.getComponentProgress(tenantId, projectId).catch(() => [] as Array<{
        component: string; label: string; contractQty: number; executedQty: number; pct: number;
      }>),
    ]);

    const compPct = (code: string) => componentProgress.find((c) => c.component === code)?.pct ?? 0;
    const gravityPct = compPct('gravity_main');
    const pumpingPct = compPct('pumping_main');
    const pipelineProgressPct = gravityPct || pumpingPct
      ? Math.round(((gravityPct + pumpingPct) / (gravityPct && pumpingPct ? 2 : 1)) * 10) / 10
      : 0;
    const reservoirProgressPct = compPct('reservoir');

    const pumpHouseAssets = assets.filter((a) => a.assetType === 'pump_house');
    const pumpHouseProgressPct = pumpHouseAssets.length > 0
      ? Math.round((pumpHouseAssets.filter((a) => ['installed', 'commissioned'].includes(a.status)).length
        / pumpHouseAssets.length) * 1000) / 10
      : pumpingPct;

    const fhtcSummary = summarizeFhtcBoqRows(selectFhtcBoqRows(reconciliation?.rows ?? []));

    const pendingApprovals = allDprs.filter((d) => !DPR_DONE.includes(d.status)).length
      + allMbs.filter((m) => !MB_DONE.includes(m.status)).length
      + allRaBills.filter((b) => !RA_DONE.includes(b.status)).length;

    const pendingMbMeasurements = Math.round(Number(totals.pendingMeasurementQty ?? 0) * 100) / 100;

    return {
      summary: {
        boqCount, dprCount, mbCount, invoiceCount, docCount,
        raCount, wpCount, assetCount,
        pendingApprovals,
        pendingDprs,
        pendingMbs,
        pendingRaBills: pendingRa,
        pendingMbReviews,
        pendingBills,
        pendingMbMeasurements,
      },
      progress: {
        physicalPct: Math.round(physicalPct * 10) / 10,
        financialPct: Math.round(financialPct * 10) / 10,
        financialBoqSource: reconciliation?.boqSource ?? 'government',
        financialBoqSourceLabel: reconciliation?.boqSourceLabel ?? financialBoqLabel('government'),
        fhtcPct: Number(completion?.fhtcCompletionPct ?? 0),
        gisMappingPct: Number(completion?.gisMappingPct ?? 0),
        mbCompletionPct: Number(completion?.mbCompletionPct ?? 0),
        pipelineProgressPct,
        reservoirProgressPct,
        pumpHouseProgressPct,
      },
      fhtc: {
        target: fhtcSummary.targetConnections,
        completed: fhtcSummary.completedConnections,
        pct: fhtcSummary.completionPct,
        source: fhtcSummary.source,
        rate: fhtcSummary.rate,
        contractValue: fhtcSummary.contractValue,
      },
      componentProgress,
      recentDprs,
      recentMbs,
      completion,
    };
  }

  private async getComponentProgress(tenantId: string, projectId: string) {
    const financialSource = await resolveFinancialBoqSource(this.boqRepo, tenantId, projectId);
    const allItems = await this.boqRepo.find({ where: { tenantId, projectId, isActive: true } });
    const items = allItems.filter((i) => i.boqSource === financialSource);
    const idToItemCode = buildBoqIdToItemCode(allItems);

    const mbEntries = await this.mbEntryRepo
      .createQueryBuilder('e')
      .innerJoin('measurement_books', 'mb', 'mb.id = e.mb_id')
      .where('mb.tenant_id = :tenantId', { tenantId })
      .andWhere('mb.project_id = :projectId', { projectId })
      .andWhere('mb.status = :status', { status: 'boq_finalized' })
      .select(['e.boq_item_id AS boq_item_id', 'SUM(e.measured_qty) AS qty'])
      .groupBy('e.boq_item_id')
      .getRawMany();

    const mbByCode = aggregateQtyByItemCode(mbEntries, idToItemCode);

    return PROJECT_COMPONENTS.map((component) => {
      const compItems = items.filter((i) => i.component === component);
      const contractQty = compItems.reduce((s, i) => s + Number(i.contractQty), 0);
      const executedQty = compItems.reduce((s, i) => s + (mbByCode[i.itemCode] ?? 0), 0);
      const pct = contractQty > 0 ? Math.round((executedQty / contractQty) * 1000) / 10 : 0;
      return { component, label: COMPONENT_LABELS[component], contractQty, executedQty, pct };
    });
  }

  async getBoqReconciliation(tenantId: string, projectId: string) {
    const financialSource = await resolveFinancialBoqSource(this.boqRepo, tenantId, projectId);
    const allItems = await this.boqRepo.find({
      where: { tenantId, projectId, isActive: true },
      order: { component: 'ASC', sortOrder: 'ASC' },
    });
    const items = allItems.filter((i) => i.boqSource === financialSource);
    const idToItemCode = buildBoqIdToItemCode(allItems);

    const dprQtys = await this.dprActivityRepo
      .createQueryBuilder('a')
      .innerJoin('dpr_reports', 'd', 'd.id = a.dpr_id')
      .where('d.tenant_id = :tenantId', { tenantId })
      .andWhere('d.project_id = :projectId', { projectId })
      .select(['a.boq_item_id AS boq_item_id', 'SUM(a.quantity_done) AS qty'])
      .groupBy('a.boq_item_id')
      .getRawMany();

    const mbQtys = await this.mbEntryRepo
      .createQueryBuilder('e')
      .innerJoin('measurement_books', 'mb', 'mb.id = e.mb_id')
      .where('mb.tenant_id = :tenantId', { tenantId })
      .andWhere('mb.project_id = :projectId', { projectId })
      .andWhere('mb.status = :status', { status: 'boq_finalized' })
      .select(['e.boq_item_id AS boq_item_id', 'SUM(e.measured_qty) AS qty'])
      .groupBy('e.boq_item_id')
      .getRawMany();

    const dprByBoq = aggregateQtyByItemCode(dprQtys, idToItemCode);
    const mbByBoq = aggregateQtyByItemCode(mbQtys, idToItemCode);

    const rows = items.map((item) => {
      const contractQty = Number(item.contractQty);
      const revisedQty = Number(item.revisedQty) || contractQty;
      const dprQty = dprByBoq[item.itemCode] ?? Number(item.dprQty);
      const executedQty = dprQty;
      const mbQty = mbByBoq[item.itemCode] ?? 0;
      const remainingQty = Math.max(0, revisedQty - mbQty);
      const mbVariance = mbQty - revisedQty;
      const dprMbDeviation = mbQty - dprQty;
      const pendingMeasurementQty = boqPendingMeasurementQty(mbQty, revisedQty);
      const savingsQty = boqSavingsQty(mbQty, mbVariance);
      const rate = Number(item.rate);
      const contractAmount = Number(item.contractAmount);
      const contractValue = boqContractLineAmount(contractQty, rate, contractAmount);
      const revisedValue = boqQtyAmount(contractQty, revisedQty, rate, contractAmount);
      const executedValue = boqQtyAmount(contractQty, executedQty, rate, contractAmount);
      const mbValue = boqQtyAmount(contractQty, mbQty, rate, contractAmount);
      const remainingValue = boqQtyAmount(contractQty, remainingQty, rate, contractAmount);
      const pendingMeasurementValue = boqQtyAmount(contractQty, pendingMeasurementQty, rate, contractAmount);
      const savingsValue = boqQtyAmount(contractQty, savingsQty, rate, contractAmount);
      const effectiveRate = boqEffectiveRate(contractQty, rate, contractAmount);
      return {
        id: item.id,
        itemCode: item.itemCode,
        description: item.description,
        component: item.component,
        schemeType: item.schemeType,
        unit: item.unit,
        contractQty,
        revisedQty,
        dprQty,
        executedQty,
        mbQty,
        remainingQty,
        pendingMeasurementQty,
        savingsQty,
        mbVariance,
        dprMbDeviation,
        variance: mbVariance,
        varianceType: boqVarianceType(mbQty, revisedQty, mbVariance),
        deviationType: dprMbDeviation > 0 ? 'mb_higher' : dprMbDeviation < 0 ? 'dpr_higher' : 'none',
        rate,
        contractAmount,
        effectiveRate,
        contractValue,
        revisedValue,
        executedValue,
        mbValue,
        remainingValue,
        pendingMeasurementValue,
        savingsValue,
      };
    });

    const totals = rows.reduce(
      (acc, r) => ({
        contractQty: acc.contractQty + r.contractQty,
        revisedQty: acc.revisedQty + r.revisedQty,
        dprQty: acc.dprQty + r.dprQty,
        executedQty: acc.executedQty + r.executedQty,
        mbQty: acc.mbQty + r.mbQty,
        remainingQty: acc.remainingQty + r.remainingQty,
        contractValue: acc.contractValue + r.contractValue,
        revisedValue: acc.revisedValue + r.revisedValue,
        executedValue: acc.executedValue + r.executedValue,
        mbValue: acc.mbValue + r.mbValue,
        remainingValue: acc.remainingValue + r.remainingValue,
        pendingMeasurementQty: acc.pendingMeasurementQty + r.pendingMeasurementQty,
        pendingMeasurementValue: acc.pendingMeasurementValue + r.pendingMeasurementValue,
        excessQty: acc.excessQty + (r.mbVariance > 0 ? r.mbVariance : 0),
        savingsQty: acc.savingsQty + r.savingsQty,
        savingsValue: acc.savingsValue + r.savingsValue,
        deviationQty: acc.deviationQty + Math.abs(r.dprMbDeviation),
      }),
      {
        contractQty: 0, revisedQty: 0, dprQty: 0, executedQty: 0, mbQty: 0, remainingQty: 0,
        contractValue: 0, revisedValue: 0, executedValue: 0, mbValue: 0, remainingValue: 0,
        pendingMeasurementQty: 0, pendingMeasurementValue: 0,
        excessQty: 0, savingsQty: 0, savingsValue: 0, deviationQty: 0,
      },
    );

    const quantityVarianceReport = rows.map((r) => ({
      itemCode: r.itemCode,
      description: r.description,
      component: r.component,
      unit: r.unit,
      contractQty: r.contractQty,
      revisedQty: r.revisedQty,
      dprQty: r.dprQty,
      executedQty: r.executedQty,
      mbQty: r.mbQty,
      remainingQty: r.remainingQty,
      mbVariance: r.mbVariance,
      dprMbDeviation: r.dprMbDeviation,
      varianceType: r.varianceType,
    }));

    const excessQuantityReport = rows
      .filter((r) => r.mbVariance > 0)
      .map((r) => ({
        itemCode: r.itemCode,
        description: r.description,
        component: r.component,
        unit: r.unit,
        revisedQty: r.revisedQty,
        mbQty: r.mbQty,
        excessQty: r.mbVariance,
        rate: r.effectiveRate,
        excessValue: boqQtyAmount(r.contractQty, r.mbVariance, r.rate, r.contractAmount),
      }));

    const savingsReport = rows
      .filter((r) => r.savingsQty > 0)
      .map((r) => ({
        itemCode: r.itemCode,
        description: r.description,
        component: r.component,
        unit: r.unit,
        revisedQty: r.revisedQty,
        mbQty: r.mbQty,
        savingsQty: r.savingsQty,
        rate: r.effectiveRate,
        savingsValue: r.savingsValue,
      }));

    const pendingMeasurementReport = rows
      .filter((r) => r.pendingMeasurementQty > 0)
      .map((r) => ({
        itemCode: r.itemCode,
        description: r.description,
        component: r.component,
        unit: r.unit,
        revisedQty: r.revisedQty,
        mbQty: r.mbQty,
        pendingMeasurementQty: r.pendingMeasurementQty,
        pendingMeasurementValue: r.pendingMeasurementValue,
        remarks: 'Awaiting verified MB entry',
      }));

    const deviationStatement = rows
      .filter((r) => r.dprMbDeviation !== 0)
      .map((r) => ({
        itemCode: r.itemCode,
        description: r.description,
        component: r.component,
        unit: r.unit,
        dprQty: r.dprQty,
        mbQty: r.mbQty,
        deviation: r.dprMbDeviation,
        deviationType: r.deviationType,
        remarks: r.deviationType === 'mb_higher'
          ? 'MB quantity exceeds DPR reported quantity'
          : 'DPR reported quantity exceeds MB measured quantity',
      }));

    return {
      boqSource: financialSource,
      boqSourceLabel: financialBoqLabel(financialSource),
      rows,
      totals,
      reports: {
        quantityVarianceReport,
        excessQuantityReport,
        savingsReport,
        pendingMeasurementReport,
        deviationStatement,
      },
    };
  }

  listWorkPackages(tenantId: string, projectId: string) {
    return this.wpRepo.find({ where: { tenantId, projectId }, order: { packageCode: 'ASC' } });
  }

  createWorkPackage(tenantId: string, projectId: string, dto: CreateWorkPackageDto) {
    return this.wpRepo.save(this.wpRepo.create({
      tenantId,
      projectId,
      packageCode: dto.packageCode,
      name: dto.name,
      component: dto.component,
      schemeType: dto.schemeType ?? null,
      contractorName: dto.contractorName ?? null,
      chainageFrom: dto.chainageFrom ?? null,
      chainageTo: dto.chainageTo ?? null,
      remarks: dto.remarks ?? null,
      status: 'planned',
    }));
  }

  async updateWorkPackage(tenantId: string, projectId: string, id: string, dto: UpdateWorkPackageDto) {
    const wp = await this.wpRepo.findOne({ where: { id, tenantId, projectId } });
    if (!wp) throw new NotFoundException('Work package not found');
    if (dto.contractorName !== undefined) wp.contractorName = dto.contractorName || null;
    if (dto.contractorId !== undefined) wp.contractorId = dto.contractorId || null;
    if (dto.gisAlignmentStatus !== undefined) wp.gisAlignmentStatus = dto.gisAlignmentStatus;
    if (dto.status !== undefined) wp.status = dto.status;
    if (dto.remarks !== undefined) wp.remarks = dto.remarks ?? null;
    wp.updatedAt = new Date();
    return this.wpRepo.save(wp);
  }

  async getWorkPlanning(tenantId: string, projectId: string) {
    let planning = await this.planningRepo.findOne({ where: { tenantId, projectId } });
    if (!planning) {
      planning = await this.planningRepo.save(this.planningRepo.create({ tenantId, projectId, status: 'draft' }));
    }
    return planning;
  }

  async upsertWorkPlanning(tenantId: string, projectId: string, userId: string, dto: UpdateWorkPlanningDto) {
    let planning = await this.planningRepo.findOne({ where: { tenantId, projectId } });
    if (!planning) {
      planning = this.planningRepo.create({ tenantId, projectId });
    }
    Object.assign(planning, {
      approvedDprUrl: dto.approvedDprUrl ?? planning.approvedDprUrl,
      adminApprovalRef: dto.adminApprovalRef ?? planning.adminApprovalRef,
      technicalSanctionRef: dto.technicalSanctionRef ?? planning.technicalSanctionRef,
      boqUploadUrl: dto.boqUploadUrl ?? planning.boqUploadUrl,
      l1ContractorBoqUploadUrl: dto.l1ContractorBoqUploadUrl ?? planning.l1ContractorBoqUploadUrl,
      contractorPoUploadUrl: dto.contractorPoUploadUrl ?? planning.contractorPoUploadUrl,
      drawingUploadUrl: dto.drawingUploadUrl ?? planning.drawingUploadUrl,
      gisAlignmentApproved: dto.gisAlignmentApproved ?? planning.gisAlignmentApproved,
      status: dto.status ?? planning.status,
      approvedBy: dto.status === 'approved' ? userId : planning.approvedBy,
      approvedAt: dto.status === 'approved' ? new Date() : planning.approvedAt,
    });
    const saved = await this.planningRepo.save(planning);
    if (dto.status === 'approved') {
      await this.refreshProjectProgress(tenantId, projectId, 'budget');
    }
    return saved;
  }

  listBoq(
    tenantId: string,
    projectId: string,
    schemeType?: string,
    component?: string,
    boqSource = 'government',
  ) {
    const where: Record<string, unknown> = { tenantId, projectId, isActive: true, boqSource };
    if (schemeType) where.schemeType = schemeType;
    if (component) where.component = component;
    return this.boqRepo.find({ where, order: { component: 'ASC', sortOrder: 'ASC', itemCode: 'ASC' } });
  }

  async importBoq(tenantId: string, projectId: string, dto: ImportBoqDto) {
    const boqSource = dto.boqSource ?? 'government';
    if (!dto.items?.length) {
      throw new BadRequestException('No BOQ items to import');
    }

    const rows = dto.items.filter((r) => {
      if (!r.itemCode?.trim() || !r.description?.trim()) return false;
      const desc = r.description.trim();
      if (desc.length < 4 || !/[a-zA-Z]/.test(desc) || /^\d+(\.\d+)?$/.test(desc)) return false;
      return true;
    });
    if (!rows.length) {
      throw new BadRequestException('No valid BOQ rows — check Item Description and QTY columns');
    }

    const saved: BoqItem[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const itemCode = row.itemCode.trim();
      let item = await this.boqRepo.findOne({ where: { tenantId, projectId, itemCode, boqSource } });
      const qty = Number(row.contractQty) || 0;
      const rate = Number(row.rate) || 0;
      const contractAmount = Number(row.contractAmount) > 0
        ? Number(row.contractAmount)
        : Math.round(qty * rate * 100) / 100;

      if (item) {
        item.boqSource = boqSource;
        item.description = row.description.trim();
        item.unit = normalizeBoqUnit(row.unit.trim());
        item.schemeType = row.schemeType;
        item.component = row.component?.trim() || item.component;
        item.contractQty = qty;
        item.revisedQty = qty;
        item.rate = rate;
        item.contractAmount = contractAmount;
        item.sortOrder = i + 1;
        item.isActive = true;
      } else {
        item = this.boqRepo.create({
          tenantId,
          projectId,
          itemCode,
          boqSource,
          description: row.description.trim(),
          unit: normalizeBoqUnit(row.unit.trim()),
          schemeType: row.schemeType,
          component: row.component?.trim() || null,
          contractQty: qty,
          revisedQty: qty,
          dprQty: 0,
          rate,
          contractAmount,
          sortOrder: i + 1,
          isActive: true,
        });
      }
      try {
        saved.push(await this.boqRepo.save(item));
      } catch (err) {
        if (err instanceof QueryFailedError && (err as { code?: string }).code === '23505') {
          const label = boqSource === 'l1_contractor' ? 'L1 Contractor BOQ' : 'Government BOQ';
          throw new BadRequestException(
            `Cannot import ${label} item "${itemCode}" — duplicate item code on this project. Try re-uploading the Excel file.`,
          );
        }
        throw err;
      }
    }

    if (!saved.length) {
      throw new BadRequestException('Import failed — no rows were saved');
    }

    if (dto.replaceExisting !== false) {
      const savedCodes = saved.map((s) => s.itemCode);
      await this.boqRepo
        .createQueryBuilder()
        .update(BoqItem)
        .set({ isActive: false })
        .where('tenant_id = :tenantId', { tenantId })
        .andWhere('project_id = :projectId', { projectId })
        .andWhere('boq_source = :boqSource', { boqSource })
        .andWhere('item_code NOT IN (:...codes)', { codes: savedCodes })
        .execute();
    }

    if (dto.fileName) {
      let planning = await this.planningRepo.findOne({ where: { tenantId, projectId } });
      if (!planning) {
        planning = this.planningRepo.create({ tenantId, projectId, status: 'draft' });
      }
      if (boqSource === 'l1_contractor') {
        planning.l1ContractorBoqUploadUrl = `/uploads/planning/boq-l1/${dto.fileName}`;
      } else {
        planning.boqUploadUrl = `/uploads/planning/boq/${dto.fileName}`;
      }
      await this.planningRepo.save(planning);
    }

    await this.refreshProjectProgress(tenantId, projectId, 'all');
    return { imported: saved.length, fileName: dto.fileName ?? null, items: saved };
  }

  async importBoqExcelFile(
    tenantId: string,
    projectId: string,
    file: { buffer: Buffer; originalname?: string },
    boqSource: 'government' | 'l1_contractor' = 'government',
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Excel file is empty');
    }
    const items = parseBoqExcelBuffer(file.buffer);
    if (!items.length) {
      throw new BadRequestException(
        'No BOQ rows found in Excel. Expected columns: SN, Item Description, QTY, Unit, Rate with GST, Total Amount with Tax',
      );
    }
    return this.importBoq(tenantId, projectId, {
      fileName: file.originalname,
      replaceExisting: true,
      boqSource,
      items,
    });
  }

  async listDprs(tenantId: string, projectId: string) {
    return this.dprRepo.find({
      where: { tenantId, projectId },
      relations: ['activities'],
      order: { reportDate: 'DESC' },
    });
  }

  async getDpr(tenantId: string, projectId: string, id: string) {
    const dpr = await this.dprRepo.findOne({
      where: { id, tenantId, projectId },
      relations: ['activities'],
    });
    if (!dpr) throw new NotFoundException('DPR not found');
    const documents = await this.docRepo.find({
      where: { tenantId, resourceType: 'dpr', resourceId: id },
      order: { uploadedAt: 'DESC' },
    });
    return { ...dpr, documents };
  }

  async createDpr(tenantId: string, projectId: string, userId: string, dto: CreateDprDto) {
    const dpr = this.dprRepo.create({
      tenantId,
      projectId,
      dprNumber: dto.dprNumber,
      reportDate: dto.reportDate,
      schemeType: dto.schemeType,
      workSite: dto.workLocation ?? null,
      workPackageId: dto.workPackageId ?? null,
      contractorName: dto.contractorName ?? null,
      supervisorName: dto.supervisorName ?? null,
      weather: dto.weather ?? null,
      manpowerCount: dto.manpowerCount ?? 0,
      remarks: dto.remarks ?? null,
      status: 'draft',
      submittedBy: userId,
    });
    const saved = await this.dprRepo.save(dpr);
    await this.saveDprActivities(saved.id, dto.activities);
    await this.updateBoqDprQtys(tenantId, projectId, dto.activities);
    await this.refreshProjectProgress(tenantId, projectId, 'milestones');
    return this.getDpr(tenantId, projectId, saved.id);
  }

  async updateDpr(
    tenantId: string,
    projectId: string,
    userId: string,
    id: string,
    dto: CreateDprDto,
  ) {
    const dpr = await this.dprRepo.findOne({
      where: { id, tenantId, projectId },
      relations: ['activities'],
    });
    if (!dpr) throw new NotFoundException('DPR not found');
    if (dpr.status !== 'draft' && dpr.status !== 'rejected') {
      throw new BadRequestException('Only draft or rejected DPRs can be edited');
    }

    await this.reverseBoqDprQtys(tenantId, projectId, dpr.activities ?? []);

    Object.assign(dpr, {
      dprNumber: dto.dprNumber,
      reportDate: dto.reportDate,
      schemeType: dto.schemeType,
      workSite: dto.workLocation ?? null,
      workPackageId: dto.workPackageId ?? null,
      contractorName: dto.contractorName ?? null,
      supervisorName: dto.supervisorName ?? null,
      weather: dto.weather ?? null,
      manpowerCount: dto.manpowerCount ?? 0,
      remarks: dto.remarks ?? null,
      submittedBy: userId,
    });
    await this.dprRepo.save(dpr);
    await this.saveDprActivities(dpr.id, dto.activities);
    await this.updateBoqDprQtys(tenantId, projectId, dto.activities);
    await this.refreshProjectProgress(tenantId, projectId, 'milestones');
    return this.getDpr(tenantId, projectId, dpr.id);
  }

  private async mirrorDprQtyToFinancialBoq(
    tenantId: string,
    projectId: string,
    item: BoqItem,
    delta: number,
  ) {
    if (!delta || item.boqSource === 'l1_contractor') return;
    const mirror = await this.boqRepo.findOne({
      where: {
        tenantId, projectId, itemCode: item.itemCode, boqSource: 'l1_contractor', isActive: true,
      },
    });
    if (mirror) {
      mirror.dprQty = Math.max(0, Number(mirror.dprQty) + delta);
      await this.boqRepo.save(mirror);
    }
  }

  private async reverseBoqDprQtys(
    tenantId: string,
    projectId: string,
    activities: Array<{ boqItemId?: string | null; quantityDone?: number | string }>,
  ) {
    for (const act of activities) {
      if (!act.boqItemId) continue;
      const item = await this.boqRepo.findOne({ where: { id: act.boqItemId, tenantId, projectId } });
      if (item) {
        const delta = -Number(act.quantityDone ?? 0);
        item.dprQty = Math.max(0, Number(item.dprQty) + delta);
        await this.boqRepo.save(item);
        await this.mirrorDprQtyToFinancialBoq(tenantId, projectId, item, delta);
      }
    }
  }

  private async updateBoqDprQtys(tenantId: string, projectId: string, activities: CreateDprDto['activities']) {
    for (const act of activities) {
      if (!act.boqItemId) continue;
      const item = await this.boqRepo.findOne({ where: { id: act.boqItemId, tenantId, projectId } });
      if (item) {
        const delta = act.quantityDone;
        item.dprQty = Number(item.dprQty) + delta;
        await this.boqRepo.save(item);
        await this.mirrorDprQtyToFinancialBoq(tenantId, projectId, item, delta);
      }
    }
  }

  async submitDpr(tenantId: string, projectId: string, user: JwtPayload, id: string) {
    const dpr = await this.dprRepo.findOne({ where: { id, tenantId, projectId } });
    if (!dpr) throw new NotFoundException('DPR not found');
    if (dpr.status !== 'draft' && dpr.status !== 'rejected') {
      throw new BadRequestException('DPR already submitted');
    }
    const wf = await this.workflowsService.submit(tenantId, user, {
      definitionCode: 'dpr_submit',
      resourceId: id,
      title: `DPR ${dpr.dprNumber} — ${dpr.schemeType} (${dpr.reportDate})`,
      payload: { projectId, dprNumber: dpr.dprNumber, schemeType: dpr.schemeType },
    });
    dpr.status = 'je_review';
    dpr.workflowInstanceId = wf.id;
    dpr.submittedBy = user.sub;
    dpr.submittedAt = new Date();
    await this.dprRepo.save(dpr);
    return this.getDpr(tenantId, projectId, id);
  }

  async listMbs(tenantId: string, projectId: string) {
    return this.mbRepo.find({
      where: { tenantId, projectId },
      relations: ['entries'],
      order: { measurementDate: 'DESC' },
    });
  }

  async getMb(tenantId: string, projectId: string, id: string) {
    const mb = await this.mbRepo.findOne({
      where: { id, tenantId, projectId },
      relations: ['entries'],
    });
    if (!mb) throw new NotFoundException('Measurement book not found');
    const documents = await this.docRepo.find({
      where: { tenantId, resourceType: 'measurement_book', resourceId: id },
      order: { uploadedAt: 'DESC' },
    });
    return { ...mb, documents };
  }

  async createMb(tenantId: string, projectId: string, userId: string, dto: CreateMbDto) {
    const mb = this.mbRepo.create({
      tenantId,
      projectId,
      dprId: dto.dprId ?? null,
      workPackageId: dto.workPackageId ?? null,
      mbNumber: dto.mbNumber,
      schemeType: dto.schemeType,
      measurementDate: dto.measurementDate,
      siteAddress: dto.siteLocation ?? null,
      remarks: dto.remarks ?? null,
      status: 'draft',
    });
    const saved = await this.mbRepo.save(mb);
    const entries = await this.applyL1RatesToMbEntries(tenantId, projectId, dto.entries);
    await this.saveMbEntries(saved.id, entries);
    return this.getMb(tenantId, projectId, saved.id);
  }

  async updateMb(
    tenantId: string,
    projectId: string,
    userId: string,
    id: string,
    dto: CreateMbDto,
  ) {
    const mb = await this.mbRepo.findOne({ where: { id, tenantId, projectId } });
    if (!mb) throw new NotFoundException('Measurement book not found');
    if (mb.status !== 'draft' && mb.status !== 'rejected') {
      throw new BadRequestException('Only draft or rejected MBs can be edited');
    }
    Object.assign(mb, {
      mbNumber: dto.mbNumber,
      schemeType: dto.schemeType,
      measurementDate: dto.measurementDate,
      siteAddress: dto.siteLocation ?? null,
      workPackageId: dto.workPackageId ?? null,
      dprId: dto.dprId ?? null,
      remarks: dto.remarks ?? null,
    });
    await this.mbRepo.save(mb);
    const entries = await this.applyL1RatesToMbEntries(tenantId, projectId, dto.entries);
    await this.saveMbEntries(mb.id, entries);
    return this.getMb(tenantId, projectId, mb.id);
  }

  async submitMb(tenantId: string, projectId: string, user: JwtPayload, id: string) {
    const mb = await this.mbRepo.findOne({ where: { id, tenantId, projectId }, relations: ['entries'] });
    if (!mb) throw new NotFoundException('Measurement book not found');
    if (!mb.entries?.length) throw new BadRequestException('Add measurement entries before submit');
    if (mb.status !== 'draft' && mb.status !== 'rejected') {
      throw new BadRequestException('MB already submitted');
    }
    const wf = await this.workflowsService.submit(tenantId, user, {
      definitionCode: 'mb_submit',
      resourceId: id,
      title: `MB ${mb.mbNumber} — ${mb.schemeType} (${mb.measurementDate})`,
      payload: { projectId, mbNumber: mb.mbNumber, schemeType: mb.schemeType },
    });
    mb.status = 'ae_checked';
    mb.workflowInstanceId = wf.id;
    mb.jeMeasuredBy = user.sub;
    mb.jeMeasuredAt = new Date();
    await this.mbRepo.save(mb);
    return this.getMb(tenantId, projectId, id);
  }

  async listInvoices(tenantId: string, projectId: string) {
    return this.invoiceRepo.find({
      where: { tenantId, projectId },
      relations: ['lineItems'],
      order: { createdAt: 'DESC' },
    });
  }

  async getInvoice(tenantId: string, projectId: string, id: string) {
    const invoice = await this.invoiceRepo.findOne({
      where: { id, tenantId, projectId },
      relations: ['lineItems'],
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    const documents = await this.docRepo.find({
      where: { tenantId, resourceType: 'invoice', resourceId: id },
      order: { uploadedAt: 'DESC' },
    });
    return { ...invoice, documents };
  }

  async createInvoice(tenantId: string, projectId: string, userId: string, dto: CreateInvoiceDto) {
    const gross = dto.lineItems.reduce((sum, item) => sum + item.quantity * item.rate, 0);
    const deductions = dto.deductions ?? 0;
    const gst = dto.gstAmount ?? 0;
    const previous = dto.previousAmount ?? 0;
    const invoice = this.invoiceRepo.create({
      tenantId,
      projectId,
      invoiceNumber: dto.invoiceNumber,
      billingPeriodFrom: dto.billingPeriodFrom ?? null,
      billingPeriodTo: dto.billingPeriodTo ?? null,
      schemeType: dto.schemeType ?? null,
      billType: dto.billType ?? 'ra',
      status: 'draft',
      grossAmount: gross,
      deductions,
      gstAmount: gst,
      previousAmount: previous,
      netAmount: gross - deductions + gst - previous,
      departmentReference: dto.departmentRef ?? null,
      remarks: dto.remarks ?? null,
      submittedBy: userId,
    });
    const saved = await this.invoiceRepo.save(invoice);
    await this.saveInvoiceLines(saved.id, dto.lineItems);
    return this.getInvoice(tenantId, projectId, saved.id);
  }

  async buildInvoiceFromMb(
    tenantId: string, projectId: string, userId: string, mbId: string, invoiceNumber: string,
  ) {
    const mb = await this.mbRepo.findOne({
      where: { id: mbId, tenantId, projectId, status: 'boq_finalized' },
      relations: ['entries'],
    });
    if (!mb) throw new BadRequestException('MB must be BOQ-finalized by Accounts before invoicing');

    const prevInvoices = await this.invoiceRepo.find({ where: { tenantId, projectId, billType: 'ra' } });
    const previousAmount = prevInvoices.reduce((s, inv) => s + Number(inv.netAmount), 0);

    const mbEntries = await this.applyL1RatesToMbEntries(
      tenantId,
      projectId,
      mb.entries.map((entry) => ({
        boqItemId: entry.boqItemId ?? undefined,
        description: entry.description,
        unit: entry.unit,
        measuredQty: Number(entry.measuredQty),
        rate: Number(entry.rate),
        chainageFrom: entry.chainageFrom ?? undefined,
        chainageTo: entry.chainageTo ?? undefined,
        lengthM: entry.lengthM != null ? Number(entry.lengthM) : undefined,
        widthM: entry.widthM != null ? Number(entry.widthM) : undefined,
        depthM: entry.depthM != null ? Number(entry.depthM) : undefined,
        latitude: entry.latitude ?? undefined,
        longitude: entry.longitude ?? undefined,
      })),
    );

    const lineItems = mb.entries.map((entry, idx) => {
      const priced = mbEntries[idx] ?? entry;
      return {
        boqItemId: priced.boqItemId ?? entry.boqItemId ?? undefined,
        mbEntryId: entry.id,
        description: priced.description ?? entry.description,
        unit: priced.unit ?? entry.unit,
        quantity: Number(entry.measuredQty),
        rate: Number(priced.rate ?? entry.rate),
        currentQty: Number(entry.measuredQty),
      };
    });

    return this.createInvoice(tenantId, projectId, userId, {
      invoiceNumber,
      billType: 'ra',
      schemeType: mb.schemeType as 'gravity' | 'pumping',
      billingPeriodFrom: mb.measurementDate,
      billingPeriodTo: mb.measurementDate,
      previousAmount,
      lineItems,
      remarks: `Generated from MB ${mb.mbNumber}`,
    });
  }

  async submitInvoice(tenantId: string, projectId: string, user: JwtPayload, id: string) {
    const invoice = await this.invoiceRepo.findOne({ where: { id, tenantId, projectId } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status !== 'draft' && invoice.status !== 'rejected') {
      throw new BadRequestException('Invoice already submitted');
    }
    const wf = await this.workflowsService.submit(tenantId, user, {
      definitionCode: 'invoice_submit',
      resourceId: id,
      title: `Invoice ${invoice.invoiceNumber} — ₹${invoice.netAmount}`,
      payload: { projectId, invoiceNumber: invoice.invoiceNumber, netAmount: invoice.netAmount },
    });
    invoice.status = 'accounts_verification';
    invoice.workflowInstanceId = wf.id;
    invoice.submittedBy = user.sub;
    invoice.submittedAt = new Date();
    await this.invoiceRepo.save(invoice);
    return this.getInvoice(tenantId, projectId, id);
  }

  async listRaBills(tenantId: string, projectId: string) {
    const bills = await this.raBillRepo.find({
      where: { tenantId, projectId },
      relations: ['lines'],
      order: { raSequence: 'DESC' },
    });
    return Promise.all(bills.map((b) => this.recalculateRaBillTotals(tenantId, projectId, b)));
  }

  async getRaBill(tenantId: string, projectId: string, id: string) {
    const bill = await this.raBillRepo.findOne({
      where: { id, tenantId, projectId },
      relations: ['lines'],
    });
    if (!bill) throw new NotFoundException('RA Bill not found');
    return this.recalculateRaBillTotals(tenantId, projectId, bill);
  }

  async deleteRaBill(tenantId: string, projectId: string, id: string) {
    const bill = await this.raBillRepo.findOne({ where: { id, tenantId, projectId } });
    if (!bill) throw new NotFoundException('RA Bill not found');
    if (!['draft', 'rejected'].includes(bill.status)) {
      throw new BadRequestException('Only draft or rejected RA Bills can be deleted');
    }
    await this.raBillLineRepo.delete({ raBillId: id });
    await this.raBillRepo.delete({ id, tenantId, projectId });
    return { deleted: true };
  }

  /** Recompute RA totals from BOQ line amounts (proportional to Total Amount with Tax). */
  private async recalculateRaBillTotals(
    tenantId: string,
    projectId: string,
    bill: RaBill,
  ): Promise<RaBill> {
    const lines = bill.lines?.length
      ? bill.lines
      : await this.raBillLineRepo.find({ where: { raBillId: bill.id } });
    if (!lines.length) return bill;

    const boqItems = await this.boqRepo.find({ where: { tenantId, projectId, isActive: true } });
    const boqById = Object.fromEntries(boqItems.map((b) => [b.id, b]));
    const financialSource = await resolveFinancialBoqSource(this.boqRepo, tenantId, projectId);

    let gross = 0;
    for (const line of lines) {
      const linked = line.boqItemId ? boqById[line.boqItemId] : null;
      const boq = linked?.boqSource === 'l1_contractor'
        ? linked
        : resolveFinancialBoqItem(linked, financialSource, boqItems);
      const contractQty = Number(boq?.contractQty ?? 0);
      const contractAmount = Number(boq?.contractAmount ?? 0);
      const rate = Number(boq?.rate ?? line.boqRate);
      const displayRate = boq
        ? raBillDisplayRate(contractQty, rate, contractAmount)
        : Number(line.boqRate);
      const lineAmount = boq
        ? raBillLineAmount(contractQty, Number(line.currentQty), rate, contractAmount)
        : Math.round(Number(line.currentQty) * displayRate * 100) / 100;

      gross += lineAmount;
      const targetBoqId = boq?.id ?? line.boqItemId;
      const needsLineSave = (targetBoqId && line.boqItemId !== targetBoqId)
        || Math.abs(Number(line.boqRate) - displayRate) > 0.001
        || Math.abs(Number(line.amount) - lineAmount) > 0.001;
      if (needsLineSave) {
        if (targetBoqId) line.boqItemId = targetBoqId;
        line.boqRate = displayRate;
        line.amount = lineAmount;
        await this.raBillLineRepo.save(line);
      }
    }

    gross = Math.round(gross * 100) / 100;
    const gst = gstFromInclusiveAmount(gross);
    const netPayable = netPayableFromInclusiveGross(gross, Number(bill.recoveries));
    const needsSave = Math.abs(Number(bill.grossAmount) - gross) > 0.001
      || Math.abs(Number(bill.gstAmount) - gst) > 0.001
      || Math.abs(Number(bill.netPayable) - netPayable) > 0.001;
    if (needsSave) {
      bill.grossAmount = gross;
      bill.gstAmount = gst;
      bill.netPayable = netPayable;
      await this.raBillRepo.save(bill);
    }
    bill.lines = lines;
    return bill;
  }

  async generateRaBill(tenantId: string, projectId: string, userId: string, dto: CreateRaBillDto) {
    const existingDraft = await this.raBillRepo.findOne({
      where: { tenantId, projectId, status: 'draft' },
    });
    if (existingDraft) {
      throw new BadRequestException(`Draft RA Bill ${existingDraft.raNumber} already exists — submit or delete it first`);
    }

    const allMbs = await this.mbRepo.find({
      where: { tenantId, projectId, status: 'boq_finalized' },
      relations: ['entries'],
    });
    const periodFrom = dto.billingPeriodFrom ? new Date(dto.billingPeriodFrom) : null;
    const periodTo = dto.billingPeriodTo ? new Date(dto.billingPeriodTo) : null;
    const finalizedMbs = allMbs.filter((mb) => {
      if (!periodFrom && !periodTo) return true;
      const d = mb.measurementDate ? new Date(mb.measurementDate) : null;
      if (!d) return false;
      if (periodFrom && d < periodFrom) return false;
      if (periodTo && d > periodTo) return false;
      return true;
    });
    if (!finalizedMbs.length) {
      throw new BadRequestException('No BOQ-finalized MBs in the selected billing period');
    }

    const boqItems = await this.boqRepo.find({ where: { tenantId, projectId, isActive: true } });
    const boqById = Object.fromEntries(boqItems.map((b) => [b.id, b]));
    const financialSource = await resolveFinancialBoqSource(this.boqRepo, tenantId, projectId);

    const prevBills = await this.raBillRepo.find({
      where: { tenantId, projectId, status: In(['finance_released', 'accounts_verification', 'ee_checked', 'ae_checked', 'je_review']) },
    });
    const previousAmount = prevBills
      .filter((b) => b.status === 'finance_released')
      .reduce((s, b) => s + Number(b.netPayable), 0);
    const raSequence = (await this.raBillRepo.count({ where: { tenantId, projectId } })) + 1;

    const prevQtyByBoq: Record<string, number> = {};
    for (const bill of prevBills) {
      const billLines = await this.raBillLineRepo.find({ where: { raBillId: bill.id } });
      for (const line of billLines) {
        if (!line.boqItemId) continue;
        const linked = boqById[line.boqItemId];
        const financial = linked?.boqSource === 'l1_contractor'
          ? linked
          : resolveFinancialBoqItem(linked, financialSource, boqItems);
        const key = financial?.id ?? line.boqItemId;
        prevQtyByBoq[key] = (prevQtyByBoq[key] ?? 0) + Number(line.currentQty);
      }
    }

    const lineMap = new Map<string, {
      boqItemId: string; description: string; unit: string;
      contractQty: number; contractAmount: number; rate: number;
      executedQty: number; mbEntryId?: string;
    }>();
    const unmappedL1: string[] = [];
    for (const mb of finalizedMbs) {
      for (const entry of mb.entries ?? []) {
        if (!entry.boqItemId) continue;
        const linked = boqById[entry.boqItemId];
        const boq = linked?.boqSource === 'l1_contractor'
          ? linked
          : resolveFinancialBoqItem(linked, financialSource, boqItems);
        if (!boq) {
          if (financialSource === 'l1_contractor') {
            unmappedL1.push(String(linked?.itemCode ?? entry.description));
          }
          continue;
        }
        const contractQty = Number(boq.contractQty);
        const contractAmount = Number(boq.contractAmount);
        const rate = Number(boq.rate);
        const key = boq.id;
        const existing = lineMap.get(key);
        const qty = Number(entry.measuredQty);
        if (existing) {
          existing.executedQty += qty;
        } else {
          lineMap.set(key, {
            boqItemId: key,
            description: boq.description ?? entry.description,
            unit: boq.unit ?? entry.unit,
            contractQty,
            contractAmount,
            rate,
            executedQty: qty,
            mbEntryId: entry.id,
          });
        }
      }
    }

    if (unmappedL1.length) {
      throw new BadRequestException(
        `Cannot bill — no matching L1 Contractor BOQ rate for: ${[...new Set(unmappedL1)].join(', ')}. Upload L1 BOQ with matching item codes.`,
      );
    }

    const lines = [...lineMap.values()].map((item) => {
      const prevQty = prevQtyByBoq[item.boqItemId] ?? 0;
      const currentQty = Math.max(0, item.executedQty - prevQty);
      const lineAmount = raBillLineAmount(item.contractQty, currentQty, item.rate, item.contractAmount);
      return {
        ...item,
        rate: raBillDisplayRate(item.contractQty, item.rate, item.contractAmount),
        lineAmount,
        previousQty: prevQty,
        currentQty,
        totalQty: item.executedQty,
      };
    }).filter((l) => l.currentQty > 0);

    if (!lines.length) {
      throw new BadRequestException('No new billable quantities — all verified MB qty already billed in prior RA Bills');
    }

    const gross = Math.round(lines.reduce((s, l) => s + l.lineAmount, 0) * 100) / 100;
    const recoveries = dto.recoveries ?? 0;
    const gst = dto.gstAmount ?? gstFromInclusiveAmount(gross);
    const netPayable = netPayableFromInclusiveGross(gross, recoveries);

    const bill = await this.raBillRepo.save(this.raBillRepo.create({
      tenantId,
      projectId,
      raNumber: dto.raNumber,
      raSequence,
      billingPeriodFrom: dto.billingPeriodFrom ?? null,
      billingPeriodTo: dto.billingPeriodTo ?? null,
      schemeType: dto.schemeType ?? null,
      status: 'draft',
      grossAmount: gross,
      previousAmount,
      recoveries,
      gstAmount: gst,
      netPayable,
      remarks: dto.remarks ?? null,
      submittedBy: userId,
    }));

    await this.raBillLineRepo.save(
      lines.map((line, index) => this.raBillLineRepo.create({
        raBillId: bill.id,
        boqItemId: line.boqItemId,
        mbEntryId: line.mbEntryId ?? null,
        description: line.description,
        unit: line.unit,
        boqRate: line.rate,
        previousQty: line.previousQty,
        currentQty: line.currentQty,
        totalQty: line.totalQty,
        amount: line.lineAmount,
        sortOrder: index,
      })),
    );

    return this.getRaBill(tenantId, projectId, bill.id);
  }

  async submitRaBill(tenantId: string, projectId: string, user: JwtPayload, id: string) {
    const bill = await this.raBillRepo.findOne({ where: { id, tenantId, projectId } });
    if (!bill) throw new NotFoundException('RA Bill not found');
    if (bill.status !== 'draft' && bill.status !== 'rejected') {
      throw new BadRequestException('RA Bill already submitted');
    }
    const wf = await this.workflowsService.submit(tenantId, user, {
      definitionCode: 'ra_bill_submit',
      resourceId: id,
      title: `RA Bill ${bill.raNumber} — ₹${bill.netPayable}`,
      payload: { projectId, raNumber: bill.raNumber, netPayable: bill.netPayable },
    });
    bill.status = 'je_review';
    bill.workflowInstanceId = wf.id;
    bill.submittedBy = user.sub;
    bill.submittedAt = new Date();
    await this.raBillRepo.save(bill);
    return this.getRaBill(tenantId, projectId, id);
  }

  listConstructionAssets(tenantId: string, projectId: string, assetType?: string) {
    const where: Record<string, unknown> = { tenantId, projectId };
    if (assetType) where.assetType = assetType;
    return this.assetRepo.find({ where, order: { assetCode: 'ASC' } });
  }

  createConstructionAsset(tenantId: string, projectId: string, dto: CreateConstructionAssetDto) {
    return this.assetRepo.save(this.assetRepo.create({
      tenantId,
      projectId,
      assetCode: dto.assetCode,
      assetType: dto.assetType,
      component: dto.component ?? null,
      name: dto.name ?? null,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      chainage: dto.chainage ?? null,
      installationDate: dto.installationDate ?? null,
      contractorName: dto.contractorName ?? null,
      mbReference: dto.mbReference ?? null,
      photoUrl: dto.photoUrl ?? null,
      status: dto.status ?? 'installed',
    })).then((asset) => this.syncProjectCompletion(tenantId, projectId).then(() => asset));
  }

  async updateConstructionAsset(
    tenantId: string,
    projectId: string,
    assetId: string,
    dto: UpdateConstructionAssetDto,
  ) {
    const asset = await this.assetRepo.findOne({ where: { id: assetId, tenantId, projectId } });
    if (!asset) throw new NotFoundException('GIS asset not found');
    if (dto.assetCode !== undefined) asset.assetCode = dto.assetCode;
    if (dto.assetType !== undefined) asset.assetType = dto.assetType;
    if (dto.component !== undefined) asset.component = dto.component || null;
    if (dto.name !== undefined) asset.name = dto.name || null;
    if (dto.latitude !== undefined) asset.latitude = dto.latitude ?? null;
    if (dto.longitude !== undefined) asset.longitude = dto.longitude ?? null;
    if (dto.chainage !== undefined) asset.chainage = dto.chainage || null;
    if (dto.installationDate !== undefined) asset.installationDate = dto.installationDate || null;
    if (dto.contractorName !== undefined) asset.contractorName = dto.contractorName || null;
    if (dto.mbReference !== undefined) asset.mbReference = dto.mbReference || null;
    if (dto.photoUrl !== undefined) asset.photoUrl = dto.photoUrl || null;
    if (dto.status !== undefined) asset.status = dto.status;
    asset.updatedAt = new Date();
    const saved = await this.assetRepo.save(asset);
    await this.syncProjectCompletion(tenantId, projectId);
    return saved;
  }

  async deleteConstructionAsset(tenantId: string, projectId: string, assetId: string) {
    const asset = await this.assetRepo.findOne({ where: { id: assetId, tenantId, projectId } });
    if (!asset) throw new NotFoundException('GIS asset not found');
    await this.docRepo.delete({ tenantId, projectId, resourceType: 'construction_asset', resourceId: assetId });
    await this.assetRepo.delete({ id: assetId, tenantId, projectId });
    await this.syncProjectCompletion(tenantId, projectId);
    return { deleted: true };
  }

  async getProjectCompletion(tenantId: string, projectId: string) {
    return this.syncProjectCompletion(tenantId, projectId);
  }

  async getFinalBillPreparation(tenantId: string, projectId: string) {
    const completion = await this.syncProjectCompletion(tenantId, projectId);
    const [reconciliation, mbs, assets, planning, raBills, finalInvoices] = await Promise.all([
      this.getBoqReconciliation(tenantId, projectId),
      this.listMbs(tenantId, projectId),
      this.listConstructionAssets(tenantId, projectId),
      this.getWorkPlanning(tenantId, projectId),
      this.listRaBills(tenantId, projectId),
      this.invoiceRepo.find({ where: { tenantId, projectId, billType: 'final' }, order: { createdAt: 'DESC' } }),
    ]);

    const hasDrawing = Boolean(planning?.drawingUploadUrl?.trim());
    const mappedAssets = assets.filter((a) => a.latitude != null && a.longitude != null).length;
    const gisPct = assets.length > 0
      ? Math.round((mappedAssets / assets.length) * 1000) / 10
      : Number(completion.gisMappingPct);

    const verification = [
      {
        key: 'mb_complete',
        label: '100% MB Entries Verified',
        auto: true,
        pct: Number(completion.mbCompletionPct),
        passed: Number(completion.mbCompletionPct) >= 100,
        detail: `${Number(completion.mbCompletionPct)}% of BOQ quantity verified in MB`,
      },
      {
        key: 'as_built',
        label: 'As-Built Drawings Verified',
        auto: false,
        passed: completion.asBuiltVerified,
        detail: completion.asBuiltVerified
          ? 'EE verified as-built drawings'
          : hasDrawing
            ? 'Drawing uploaded — awaiting EE verification'
            : 'Upload drawing in Work Planning, then EE verifies',
      },
      {
        key: 'gis_mapping',
        label: 'GIS Mapping Complete',
        auto: true,
        pct: gisPct,
        passed: gisPct >= 100 && assets.length > 0,
        detail: `${mappedAssets}/${assets.length} assets geo-tagged`,
      },
      {
        key: 'fhtc_complete',
        label: 'FHTC Completion Verified',
        auto: true,
        pct: Number(completion.fhtcCompletionPct),
        passed: Number(completion.fhtcCompletionPct) >= 100,
        detail: `${Number(completion.fhtcCompletionPct)}% FHTC connections measured`,
      },
      {
        key: 'reservoir_commissioned',
        label: 'Reservoir System Commissioned',
        auto: false,
        passed: completion.reservoirCommissioned,
        detail: completion.reservoirCommissioned ? 'Commissioned' : 'Pending EE verification',
      },
      {
        key: 'pumping_commissioned',
        label: 'Pumping System Commissioned',
        auto: false,
        passed: completion.pumpingCommissioned,
        detail: completion.pumpingCommissioned ? 'Commissioned' : 'Pending EE verification',
      },
    ];

    const allVerified = verification.every((v) => v.passed);
    const finalizedMbs = mbs.filter((m) => m.status === 'boq_finalized');
    const raReleasedTotal = raBills
      .filter((b) => b.status === 'finance_released')
      .reduce((s, b) => s + Number(b.netPayable), 0);

    const finalMbRegister = finalizedMbs.map((mb) => ({
      mbNumber: mb.mbNumber,
      measurementDate: mb.measurementDate,
      schemeType: mb.schemeType,
      status: mb.status,
      entryCount: mb.entries?.length ?? 0,
      entries: (mb.entries ?? []).map((e) => ({
        description: e.description,
        unit: e.unit,
        measuredQty: Number(e.measuredQty),
        rate: Number(e.rate),
        amount: Number(e.measuredQty) * Number(e.rate),
      })),
    }));

    const finalQuantityStatement = reconciliation.rows.map((r) => ({
      itemCode: r.itemCode,
      description: r.description,
      unit: r.unit,
      contractQty: r.contractQty,
      revisedQty: r.revisedQty,
      executedQty: r.executedQty,
      mbQty: r.mbQty,
      remainingQty: r.remainingQty,
      contractValue: r.contractValue,
      mbValue: r.mbValue,
    }));

    const outputs = completion.finalBillStatus === 'generated' ? {
      finalMbRegister,
      finalQuantityStatement,
      totals: reconciliation.totals,
      raReleasedTotal,
      finalBill: finalInvoices[0] ? {
        invoiceNumber: finalInvoices[0].invoiceNumber,
        grossAmount: Number(finalInvoices[0].grossAmount),
        gstAmount: Number(finalInvoices[0].gstAmount),
        netAmount: Number(finalInvoices[0].netAmount),
        status: finalInvoices[0].status,
      } : null,
      completionCertificate: this.buildCompletionCertificate(projectId, completion),
      handoverCertificate: this.buildHandoverCertificate(projectId, completion),
    } : null;

    return { completion, verification, allVerified, outputs };
  }

  async verifyProjectCompletion(
    tenantId: string, projectId: string, dto: UpdateCompletionVerificationDto,
  ) {
    const completion = await this.syncProjectCompletion(tenantId, projectId);
    if (dto.asBuiltVerified !== undefined) completion.asBuiltVerified = dto.asBuiltVerified;
    if (dto.reservoirCommissioned !== undefined) completion.reservoirCommissioned = dto.reservoirCommissioned;
    if (dto.pumpingCommissioned !== undefined) completion.pumpingCommissioned = dto.pumpingCommissioned;
    completion.updatedAt = new Date();
    return this.completionRepo.save(completion);
  }

  async generateFinalBillPackage(
    tenantId: string, projectId: string, userId: string, dto: GenerateFinalBillDto,
  ) {
    const prep = await this.getFinalBillPreparation(tenantId, projectId);
    if (!prep.allVerified) {
      throw new BadRequestException('All completion verifications must pass before generating final bill');
    }
    if (prep.completion.finalBillStatus === 'generated') {
      throw new BadRequestException('Final bill already generated for this project');
    }

    const reconciliation = await this.getBoqReconciliation(tenantId, projectId);
    const prevBills = await this.raBillRepo.find({
      where: { tenantId, projectId, status: In(['finance_released', 'accounts_verification', 'ee_checked', 'ae_checked', 'je_review']) },
    });
    const prevQtyByBoq: Record<string, number> = {};
    for (const bill of prevBills) {
      const lines = await this.raBillLineRepo.find({ where: { raBillId: bill.id } });
      for (const line of lines) {
        if (line.boqItemId) {
          prevQtyByBoq[line.boqItemId] = (prevQtyByBoq[line.boqItemId] ?? 0) + Number(line.currentQty);
        }
      }
    }

    const lineItems = reconciliation.rows
      .map((r) => {
        const boq = { contractQty: r.contractQty, rate: r.rate, contractAmount: r.contractAmount };
        const executedQty = r.mbQty;
        const prevQty = prevQtyByBoq[r.id] ?? 0;
        const currentQty = Math.max(0, executedQty - prevQty);
        const effectiveRate = boqEffectiveRate(r.contractQty, r.rate, r.contractAmount);
        return {
          boqItemId: r.id,
          description: r.description,
          unit: r.unit,
          quantity: currentQty,
          rate: effectiveRate,
          currentQty,
          previousQty: prevQty,
        };
      })
      .filter((l) => l.currentQty > 0);

    const gross = Math.round(
      lineItems.reduce((s, l) => s + l.currentQty * l.rate, 0) * 100,
    ) / 100;
    const recoveries = dto.recoveries ?? 0;
    const gst = gstFromInclusiveAmount(gross);
    const previousAmount = prevBills
      .filter((b) => b.status === 'finance_released')
      .reduce((s, b) => s + Number(b.netPayable), 0);
    const netAmount = netPayableFromInclusiveGross(gross, recoveries);

    const invoice = await this.createInvoice(tenantId, projectId, userId, {
      invoiceNumber: dto.invoiceNumber,
      billType: 'final',
      previousAmount,
      gstAmount: gst,
      deductions: recoveries,
      lineItems: lineItems.map((l) => ({
        description: l.description,
        unit: l.unit,
        quantity: l.quantity,
        rate: l.rate,
        boqItemId: l.boqItemId,
        currentQty: l.currentQty,
        previousQty: l.previousQty,
      })),
      remarks: dto.remarks ?? 'Final Bill — project completion',
    });

    const completion = prep.completion;
    completion.finalBillStatus = 'generated';
    completion.status = 'completed';
    completion.completedAt = new Date();
    completion.completionCertificateUrl = `cert:completion:${Date.now()}`;
    completion.handoverCertificateUrl = `cert:handover:${Date.now()}`;
    completion.updatedAt = new Date();
    await this.completionRepo.save(completion);

    return {
      ...(await this.getFinalBillPreparation(tenantId, projectId)),
      finalBillInvoice: invoice,
    };
  }

  private async syncProjectCompletion(tenantId: string, projectId: string) {
    let completion = await this.completionRepo.findOne({ where: { tenantId, projectId } });
    if (!completion) {
      completion = await this.completionRepo.save(
        this.completionRepo.create({ tenantId, projectId, status: 'in_progress' }),
      );
    }

    const [reconciliation, assets] = await Promise.all([
      this.getBoqReconciliation(tenantId, projectId),
      this.listConstructionAssets(tenantId, projectId),
    ]);

    const totalRevised = reconciliation.totals.revisedQty;
    const totalMb = reconciliation.totals.mbQty;
    const mbPct = totalRevised > 0
      ? Math.min(100, Math.round((totalMb / totalRevised) * 10000) / 100)
      : 0;

    const fhtcSummary = summarizeFhtcBoqRows(selectFhtcBoqRows(reconciliation.rows));
    const fhtcPct = fhtcSummary.completionPct;

    const mappedAssets = assets.filter((a) => a.latitude != null && a.longitude != null).length;
    const gisPct = assets.length > 0
      ? Math.round((mappedAssets / assets.length) * 1000) / 10
      : 0;

    completion.mbCompletionPct = mbPct;
    completion.fhtcCompletionPct = fhtcPct;
    completion.gisMappingPct = gisPct;
    completion.updatedAt = new Date();
    return this.completionRepo.save(completion);
  }

  private buildCompletionCertificate(projectId: string, completion: ProjectCompletion) {
    const date = (completion.completedAt ?? new Date()).toISOString().slice(0, 10);
    return {
      title: 'Completion Certificate',
      reference: `COMP-${projectId.slice(0, 8).toUpperCase()}-${date}`,
      date,
      text: `This is to certify that all contract works for Project ${projectId} have been completed as per approved BOQ and verified Measurement Books. MB completion: ${completion.mbCompletionPct}%. FHTC completion: ${completion.fhtcCompletionPct}%. GIS mapping: ${completion.gisMappingPct}%.`,
    };
  }

  private buildHandoverCertificate(projectId: string, completion: ProjectCompletion) {
    const date = (completion.completedAt ?? new Date()).toISOString().slice(0, 10);
    return {
      title: 'Handover Certificate',
      reference: `HO-${projectId.slice(0, 8).toUpperCase()}-${date}`,
      date,
      text: `The completed water supply scheme for Project ${projectId} is hereby handed over to the department. Reservoir commissioned: ${completion.reservoirCommissioned ? 'Yes' : 'No'}. Pumping system commissioned: ${completion.pumpingCommissioned ? 'Yes' : 'No'}. As-built verified: ${completion.asBuiltVerified ? 'Yes' : 'No'}.`,
    };
  }

  async getReports(tenantId: string, projectId: string) {
    const [reconciliation, dprs, mbs, raBills, assets, completion, workPackages] = await Promise.all([
      this.getBoqReconciliation(tenantId, projectId),
      this.listDprs(tenantId, projectId),
      this.listMbs(tenantId, projectId),
      this.listRaBills(tenantId, projectId),
      this.listConstructionAssets(tenantId, projectId),
      this.getProjectCompletion(tenantId, projectId),
      this.wpRepo.find({ where: { tenantId, projectId } }),
    ]);

    const componentProgress = await this.getComponentProgress(tenantId, projectId).catch(() => []);
    const releasedRa = raBills.filter((b) => b.status === 'finance_released');
    const releasedValue = releasedRa.reduce((s, b) => s + Number(b.netPayable), 0);
    const fhtcSummary = summarizeFhtcBoqRows(selectFhtcBoqRows(reconciliation.rows));

    return {
      boqAbstract: reconciliation.rows,
      quantityReconciliation: reconciliation.totals,
      quantityVarianceReport: reconciliation.reports.quantityVarianceReport,
      excessQuantityReport: reconciliation.reports.excessQuantityReport,
      savingsReport: reconciliation.reports.savingsReport,
      pendingMeasurementReport: reconciliation.reports.pendingMeasurementReport,
      deviationStatement: reconciliation.reports.deviationStatement,
      dailyProgressReport: this.buildPeriodProgressReport(dprs, 'daily'),
      weeklyProgressReport: this.buildPeriodProgressReport(dprs, 'weekly'),
      monthlyProgressReport: this.buildPeriodProgressReport(dprs, 'monthly'),
      mbRegister: mbs.map((mb) => {
        const wp = workPackages.find((w) => w.id === mb.workPackageId);
        return {
          mbNumber: mb.mbNumber,
          date: mb.measurementDate,
          scheme: mb.schemeType,
          contractor: wp?.contractorName ?? null,
          status: mb.status,
          entryCount: mb.entries?.length ?? 0,
          totalQty: (mb.entries ?? []).reduce((s, e) => s + Number(e.measuredQty), 0),
        };
      }),
      contractorPerformanceReport: this.buildContractorPerformanceReport(dprs, mbs, raBills, workPackages),
      financialProgressReport: {
        boqSource: reconciliation.boqSource,
        boqSourceLabel: reconciliation.boqSourceLabel,
        contractValue: reconciliation.totals.contractValue,
        revisedValue: reconciliation.totals.revisedValue,
        executedValue: reconciliation.totals.executedValue,
        mbValue: reconciliation.totals.mbValue,
        releasedValue,
        pendingPayment: Math.max(0, reconciliation.totals.mbValue - releasedValue),
        physicalPct: reconciliation.totals.contractQty > 0
          ? Math.round((reconciliation.totals.executedQty / reconciliation.totals.contractQty) * 1000) / 10
          : 0,
        financialPct: reconciliation.totals.contractValue > 0
          ? Math.round((reconciliation.totals.executedValue / reconciliation.totals.contractValue) * 1000) / 10
          : 0,
        byComponent: componentProgress,
      },
      gisAssetReport: this.buildGisAssetReport(assets),
      fhtcCompletionReport: {
        source: fhtcSummary.source,
        completionPct: fhtcSummary.completionPct,
        targetConnections: fhtcSummary.targetConnections,
        completedConnections: fhtcSummary.completedConnections,
        dprConnections: fhtcSummary.dprConnections,
        unit: fhtcSummary.unit,
        rate: fhtcSummary.rate,
        contractValue: fhtcSummary.contractValue,
        mbValue: fhtcSummary.mbValue,
        rows: fhtcSummary.rows,
      },
      raBills: raBills.map((b) => ({
        raNumber: b.raNumber,
        gross: b.grossAmount,
        netPayable: b.netPayable,
        status: b.status,
      })),
      gisAssetRegister: assets,
      fhtcReport: {
        source: fhtcSummary.source,
        completionPct: fhtcSummary.completionPct,
        targetConnections: fhtcSummary.targetConnections,
        completedConnections: fhtcSummary.completedConnections,
        contractValue: fhtcSummary.contractValue,
        rate: fhtcSummary.rate,
      },
      dailyProgressCount: dprs.length,
      pendingApprovals: {
        dprs: dprs.filter((d) => !['draft', 'ee_approved', 'rejected'].includes(d.status)).length,
        mbs: mbs.filter((m) => !['draft', 'boq_finalized', 'rejected'].includes(m.status)).length,
        raBills: raBills.filter((b) => !['draft', 'finance_released', 'rejected'].includes(b.status)).length,
      },
    };
  }

  private buildPeriodProgressReport(
    dprs: Array<{ reportDate: string; status: string; contractorName: string | null; manpowerCount: number; activities?: Array<{ quantityDone: number }> }>,
    period: 'daily' | 'weekly' | 'monthly',
  ) {
    const approved = dprs.filter((d) => d.status === 'ee_approved');
    const buckets = new Map<string, {
      period: string;
      dprCount: number;
      totalQty: number;
      manpower: number;
      contractors: Set<string>;
    }>();

    for (const dpr of approved) {
      const key = this.periodKey(dpr.reportDate, period);
      if (!buckets.has(key)) {
        buckets.set(key, { period: key, dprCount: 0, totalQty: 0, manpower: 0, contractors: new Set() });
      }
      const bucket = buckets.get(key)!;
      bucket.dprCount += 1;
      bucket.manpower += Number(dpr.manpowerCount ?? 0);
      if (dpr.contractorName?.trim()) bucket.contractors.add(dpr.contractorName.trim());
      bucket.totalQty += (dpr.activities ?? []).reduce((s, a) => s + Number(a.quantityDone ?? 0), 0);
    }

    return [...buckets.values()]
      .map((b) => ({
        period: b.period,
        dprCount: b.dprCount,
        totalQty: Math.round(b.totalQty * 1000) / 1000,
        manpower: b.manpower,
        contractorCount: b.contractors.size,
        contractors: [...b.contractors],
      }))
      .sort((a, b) => b.period.localeCompare(a.period));
  }

  private periodKey(dateStr: string, period: 'daily' | 'weekly' | 'monthly'): string {
    const d = new Date(dateStr);
    if (period === 'daily') return dateStr.slice(0, 10);
    if (period === 'monthly') return dateStr.slice(0, 7);
    const day = d.getUTCDay();
    const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d);
    monday.setUTCDate(diff);
    return `W${monday.toISOString().slice(0, 10)}`;
  }

  private buildContractorPerformanceReport(
    dprs: Array<{ contractorName: string | null; status: string; activities?: Array<{ quantityDone: number }> }>,
    mbs: Array<{ workPackageId: string | null; status: string; entries?: Array<{ measuredQty: number }> }>,
    raBills: Array<{ status: string; netPayable: number }>,
    workPackages: Array<{ id: string; contractorName: string | null; name: string }>,
  ) {
    const wpContractor = (wpId: string | null) => {
      if (!wpId) return null;
      return workPackages.find((w) => w.id === wpId)?.contractorName ?? null;
    };
    const contractors = new Set<string>();
    const addName = (name: string | null | undefined) => {
      if (name?.trim()) contractors.add(name.trim());
    };
    dprs.forEach((d) => addName(d.contractorName));
    mbs.forEach((m) => addName(wpContractor(m.workPackageId)));
    workPackages.forEach((w) => addName(w.contractorName));

    return [...contractors].map((contractor) => {
      const contractorDprs = dprs.filter((d) => d.contractorName === contractor);
      const contractorMbs = mbs.filter((m) => wpContractor(m.workPackageId) === contractor);
      const dprQty = contractorDprs
        .filter((d) => d.status === 'ee_approved')
        .reduce((s, d) => s + (d.activities ?? []).reduce((a, act) => a + Number(act.quantityDone ?? 0), 0), 0);
      const mbQty = contractorMbs
        .filter((m) => m.status === 'boq_finalized')
        .reduce((s, m) => s + (m.entries ?? []).reduce((a, e) => a + Number(e.measuredQty ?? 0), 0), 0);
      const released = raBills
        .filter((b) => b.status === 'finance_released')
        .reduce((s, b) => s + Number(b.netPayable), 0);
      const pendingRa = raBills.filter((b) => !['draft', 'finance_released', 'rejected'].includes(b.status)).length;
      return {
        contractor,
        dprCount: contractorDprs.length,
        mbCount: contractorMbs.length,
        dprQty: Math.round(dprQty * 1000) / 1000,
        mbQty: Math.round(mbQty * 1000) / 1000,
        raReleased: contractorDprs.length > 0 ? Math.round(released * 100) / 100 : 0,
        pendingRaBills: pendingRa,
        workPackages: workPackages.filter((w) => w.contractorName === contractor).map((w) => w.name),
      };
    }).sort((a, b) => b.dprQty - a.dprQty);
  }

  private buildGisAssetReport(assets: ConstructionAsset[]) {
    const mapped = assets.filter((a) => a.latitude != null && a.longitude != null).length;
    return {
      totalAssets: assets.length,
      mappedAssets: mapped,
      mappingPct: assets.length > 0 ? Math.round((mapped / assets.length) * 1000) / 10 : 0,
      byLayer: GIS_ASSET_TYPES.map((type) => {
        const layerAssets = assets.filter((a) => a.assetType === type);
        const layerMapped = layerAssets.filter((a) => a.latitude != null && a.longitude != null).length;
        return {
          type,
          label: GIS_ASSET_LABELS[type],
          count: layerAssets.length,
          mapped: layerMapped,
        };
      }).filter((l) => l.count > 0),
      assets: assets.map((a) => ({
        assetCode: a.assetCode,
        assetType: a.assetType,
        label: GIS_ASSET_LABELS[a.assetType as keyof typeof GIS_ASSET_LABELS] ?? a.assetType,
        latitude: a.latitude,
        longitude: a.longitude,
        status: a.status,
        mbReference: a.mbReference,
        mapped: a.latitude != null && a.longitude != null,
      })),
    };
  }

  listDocuments(tenantId: string, projectId: string, resourceType?: string, resourceId?: string) {
    const where: Record<string, unknown> = { tenantId, projectId };
    if (resourceType) where.resourceType = resourceType;
    if (resourceId) where.resourceId = resourceId;
    return this.docRepo.find({ where, order: { uploadedAt: 'DESC' } });
  }

  uploadDocument(tenantId: string, projectId: string, userId: string, dto: UploadDocumentDto) {
    return this.docRepo.save(this.docRepo.create({
      tenantId,
      projectId,
      resourceType: dto.resourceType,
      resourceId: dto.resourceId,
      docType: dto.docType,
      fileName: dto.fileName,
      fileUrl: dto.fileUrl,
      uploadedBy: userId,
    }));
  }

  async uploadDocumentFile(
    tenantId: string,
    projectId: string,
    userId: string,
    resourceType: UploadDocumentDto['resourceType'],
    resourceId: string,
    docType: string,
    file: { buffer: Buffer; originalname?: string; mimetype?: string },
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('File is empty');
    }
    const fileName = uniqueUploadFileName(file.originalname ?? 'photo.jpg');
    const dir = constructionUploadDir(resourceType, resourceId);
    writeUploadFile(dir, fileName, file.buffer);
    const fileUrl = constructionUploadRelativeUrl(resourceType, resourceId, fileName);
    return this.docRepo.save(this.docRepo.create({
      tenantId,
      projectId,
      resourceType,
      resourceId,
      docType,
      fileName: file.originalname ?? fileName,
      fileUrl,
      uploadedBy: userId,
    }));
  }

  async getDocumentRecord(tenantId: string, projectId: string, docId: string) {
    const doc = await this.docRepo.findOne({ where: { id: docId, tenantId, projectId } });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async resolveDocumentFile(tenantId: string, projectId: string, docId: string) {
    const doc = await this.getDocumentRecord(tenantId, projectId, docId);
    const absolutePath = resolveConstructionFilePath(doc.fileUrl);
    if (!fileExists(absolutePath)) {
      throw new NotFoundException('File not found on server — re-upload the photo from the DPR form');
    }
    return {
      doc,
      absolutePath,
      mimeType: guessMimeType(doc.fileName),
    };
  }

  async actOnResourceWorkflow(
    tenantId: string,
    user: JwtPayload,
    resourceType: 'dpr' | 'measurement_book' | 'invoice' | 'ra_bill',
    resourceId: string,
    dto: WorkflowActionDto,
  ) {
    let workflowInstanceId: string | null = null;
    if (resourceType === 'dpr') {
      const dpr = await this.dprRepo.findOne({ where: { id: resourceId, tenantId } });
      if (!dpr) throw new NotFoundException('DPR not found');
      workflowInstanceId = dpr.workflowInstanceId;
    } else if (resourceType === 'measurement_book') {
      const mb = await this.mbRepo.findOne({ where: { id: resourceId, tenantId } });
      if (!mb) throw new NotFoundException('MB not found');
      workflowInstanceId = mb.workflowInstanceId;
    } else if (resourceType === 'ra_bill') {
      const bill = await this.raBillRepo.findOne({ where: { id: resourceId, tenantId } });
      if (!bill) throw new NotFoundException('RA Bill not found');
      workflowInstanceId = bill.workflowInstanceId;
    } else {
      const inv = await this.invoiceRepo.findOne({ where: { id: resourceId, tenantId } });
      if (!inv) throw new NotFoundException('Invoice not found');
      workflowInstanceId = inv.workflowInstanceId;
    }

    if (!workflowInstanceId) throw new BadRequestException('No workflow linked');

    const task = await this.taskRepo.findOne({
      where: { instanceId: workflowInstanceId, status: 'pending' },
      relations: ['instance'],
    });
    if (!task) throw new BadRequestException('No pending approval task');

    const result = await this.workflowsService.actOnTask(tenantId, user, task.id, dto);
    await this.syncResourceStatus(
      tenantId,
      resourceType,
      resourceId,
      { status: result.instanceStatus, currentStep: result.currentStep },
      dto.action,
      user.sub,
      user.roles ?? [],
    );
    return result;
  }

  private async syncResourceStatus(
    tenantId: string,
    resourceType: string,
    resourceId: string,
    instance: { status: string; currentStep: number },
    action: string,
    userId: string,
    roles: string[],
  ) {
    const now = new Date();
    if (action === 'reject') {
      const status = 'rejected';
      if (resourceType === 'dpr') await this.dprRepo.update(resourceId, { status });
      else if (resourceType === 'measurement_book') await this.mbRepo.update(resourceId, { status });
      else if (resourceType === 'ra_bill') await this.raBillRepo.update(resourceId, { status });
      else await this.invoiceRepo.update(resourceId, { status });
      if (resourceType === 'dpr') {
        const projectId = await this.resolveResourceProjectId(tenantId, resourceType, resourceId);
        if (projectId) await this.refreshProjectProgress(tenantId, projectId, 'milestones');
      }
      return;
    }

    if (instance.status === 'approved') {
      if (resourceType === 'dpr') {
        await this.dprRepo.update(resourceId, { status: 'ee_approved' });
      } else if (resourceType === 'measurement_book') {
        await this.mbRepo.update(resourceId, {
          status: 'boq_finalized',
          eeCheckedBy: userId,
          eeCheckedAt: now,
        });
      } else if (resourceType === 'ra_bill') {
        await this.raBillRepo.update(resourceId, { status: 'finance_released' });
      } else {
        await this.invoiceRepo.update(resourceId, { status: 'ee_sanctioned' });
      }
    } else {
      // currentStep points to the active approval step after actOnTask advances the workflow
      const step = instance.currentStep;
      if (resourceType === 'dpr') {
        await this.dprRepo.update(resourceId, { status: DPR_STATUS_BY_STEP[step] ?? 'in_review' });
      } else if (resourceType === 'measurement_book') {
        const patch: Record<string, unknown> = { status: MB_STATUS_BY_STEP[step] ?? 'in_review' };
        if (step === 2) {
          patch.aeCheckedBy = userId;
          patch.aeCheckedAt = now;
        }
        await this.mbRepo.update(resourceId, patch);
      } else if (resourceType === 'ra_bill') {
        await this.raBillRepo.update(resourceId, { status: RA_STATUS_BY_STEP[step] ?? 'in_review' });
      } else {
        await this.invoiceRepo.update(resourceId, { status: INVOICE_STATUS_BY_STEP[step] ?? 'in_review' });
      }
    }

    const projectId = await this.resolveResourceProjectId(tenantId, resourceType, resourceId);
    if (!projectId) return;
    if (resourceType === 'dpr') {
      await this.refreshProjectProgress(tenantId, projectId, 'milestones');
    } else if (resourceType === 'ra_bill') {
      const bill = await this.raBillRepo.findOne({ where: { id: resourceId, tenantId } });
      if (bill?.status === 'finance_released') {
        await this.refreshProjectProgress(tenantId, projectId, 'spent');
      }
    }
  }

  private async resolveResourceProjectId(
    tenantId: string,
    resourceType: string,
    resourceId: string,
  ): Promise<string | null> {
    if (resourceType === 'dpr') {
      const row = await this.dprRepo.findOne({ where: { id: resourceId, tenantId } });
      return row?.projectId ?? null;
    }
    if (resourceType === 'measurement_book') {
      const row = await this.mbRepo.findOne({ where: { id: resourceId, tenantId } });
      return row?.projectId ?? null;
    }
    if (resourceType === 'ra_bill') {
      const row = await this.raBillRepo.findOne({ where: { id: resourceId, tenantId } });
      return row?.projectId ?? null;
    }
    const row = await this.invoiceRepo.findOne({ where: { id: resourceId, tenantId } });
    return row?.projectId ?? null;
  }

  private async saveDprActivities(dprId: string, activities: CreateDprDto['activities']) {
    await this.dprActivityRepo.delete({ dprId });
    if (!activities.length) return;
    await this.dprActivityRepo.save(
      activities.map((item, index) => this.dprActivityRepo.create({
        dprId,
        activityCode: item.activityCode ?? null,
        description: item.description,
        unit: item.unit,
        quantityDone: item.quantityDone,
        boqItemId: item.boqItemId ?? null,
        component: item.component ?? null,
        chainageFrom: item.chainageFrom ?? null,
        chainageTo: item.chainageTo ?? null,
        latitude: item.latitude ?? null,
        longitude: item.longitude ?? null,
        materialConsumption: item.materialConsumption ?? null,
        labourCount: item.labourCount ?? 0,
        equipmentDetails: item.equipmentDetails ?? null,
        siteDetail: item.locationDetail ?? null,
        sortOrder: index,
      })),
    );
  }

  private async applyL1RatesToMbEntries(
    tenantId: string,
    projectId: string,
    entries: CreateMbDto['entries'],
  ): Promise<CreateMbDto['entries']> {
    const financialSource = await resolveFinancialBoqSource(this.boqRepo, tenantId, projectId);
    if (financialSource !== 'l1_contractor' || !entries?.length) return entries;

    const allItems = await this.boqRepo.find({ where: { tenantId, projectId, isActive: true } });
    const byId = Object.fromEntries(allItems.map((b) => [b.id, b]));

    return entries.map((entry) => {
      const linked = entry.boqItemId ? byId[entry.boqItemId] : null;
      const l1 = linked?.boqSource === 'l1_contractor'
        ? linked
        : resolveFinancialBoqItem(linked, financialSource, allItems);
      if (!l1) return entry;
      const contractQty = Number(l1.contractQty);
      const contractAmount = Number(l1.contractAmount);
      const rate = Number(l1.rate);
      return {
        ...entry,
        boqItemId: l1.id,
        itemCode: l1.itemCode,
        rate: raBillDisplayRate(contractQty, rate, contractAmount),
        unit: l1.unit ?? entry.unit,
        description: entry.description || l1.description,
      };
    });
  }

  private async saveMbEntries(mbId: string, entries: CreateMbDto['entries']) {
    await this.mbEntryRepo.delete({ mbId });
    if (!entries.length) return;
    await this.mbEntryRepo.save(
      entries.map((item, index) => this.mbEntryRepo.create({
        mbId,
        boqItemId: item.boqItemId ?? null,
        itemCode: item.itemCode ?? null,
        description: item.description,
        unit: item.unit,
        measuredQty: item.measuredQty,
        rate: item.rate,
        lengthM: item.lengthM ?? null,
        widthM: item.widthM ?? null,
        heightM: item.heightM ?? null,
        depthM: item.depthM ?? null,
        nos: item.nos ?? null,
        chainageFrom: item.chainageFrom ?? null,
        chainageTo: item.chainageTo ?? null,
        latitude: item.latitude ?? null,
        longitude: item.longitude ?? null,
        sortOrder: index,
      })),
    );
  }

  private async saveInvoiceLines(invoiceId: string, lines: CreateInvoiceDto['lineItems']) {
    await this.invoiceLineRepo.delete({ invoiceId });
    if (!lines.length) return;
    await this.invoiceLineRepo.save(
      lines.map((item, index) => this.invoiceLineRepo.create({
        invoiceId,
        boqItemId: item.boqItemId ?? null,
        mbEntryId: item.mbEntryId ?? null,
        description: item.description,
        unit: item.unit,
        quantity: item.quantity,
        rate: item.rate,
        previousQty: item.previousQty ?? 0,
        currentQty: item.currentQty ?? item.quantity,
        sortOrder: index,
      })),
    );
  }
}
