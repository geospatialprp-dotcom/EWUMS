import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../projects/entities/project.entity';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { OmDivisionScopeService } from './om-division-scope.service';
import { getReportTypeDef, OM_REPORT_TYPES, type OmReportType } from './constants/om-reports-catalog';
import { OmConsumerServiceRequest } from './entities/om-consumer-service-request.entity';
import { OmContractKpiEntry } from './entities/om-contract-kpi-entry.entity';
import { OmHandover } from './entities/om-handover.entity';
import { OmAssetService } from './om-asset.service';
import { OmBreakdownService } from './om-breakdown.service';
import { OmComplaintService } from './om-complaint.service';
import { OmConsumerService } from './om-consumer.service';
import { OmContractService } from './om-contract.service';
import { OmDashboardService } from './om-dashboard.service';
import { OmEnergyService } from './om-energy.service';
import { OmInspectionService } from './om-inspection.service';
import { OmLifecycleService } from './om-lifecycle.service';
import { OmPmService } from './om-pm.service';
import { OmScadaService } from './om-scada.service';
import { OmWqService } from './om-wq.service';

type ReportFilters = {
  projectId?: string;
  projectCode?: string;
  from?: string;
  to?: string;
  planYear?: number;
};

@Injectable()
export class OmReportsService {
  constructor(
    private assetService: OmAssetService,
    private pmService: OmPmService,
    private breakdownService: OmBreakdownService,
    private complaintService: OmComplaintService,
    private wqService: OmWqService,
    private energyService: OmEnergyService,
    private scadaService: OmScadaService,
    private consumerService: OmConsumerService,
    private contractService: OmContractService,
    private lifecycleService: OmLifecycleService,
    private dashboardService: OmDashboardService,
    private inspectionService: OmInspectionService,
    @InjectRepository(OmConsumerServiceRequest) private serviceRequestRepo: Repository<OmConsumerServiceRequest>,
    @InjectRepository(OmContractKpiEntry) private kpiEntryRepo: Repository<OmContractKpiEntry>,
    @InjectRepository(OmHandover) private handoverRepo: Repository<OmHandover>,
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    private scope: OmDivisionScopeService,
  ) {}

  getCatalog() {
    return { reportTypes: OM_REPORT_TYPES };
  }

  async generateReport(user: JwtPayload, tenantId: string, type: string, filters: ReportFilters) {
    const def = getReportTypeDef(type);
    if (!def) throw new BadRequestException('Invalid report type');

    const meta = await this.buildMeta(user, tenantId, type as OmReportType, def.label, filters);
    const f = {
      projectId: filters.projectId,
      projectCode: filters.projectCode,
      from: meta.period.from,
      to: meta.period.to,
    };

    switch (type as OmReportType) {
      case 'om_asset_register':
        return this.wrap(meta, await this.assetService.listSchemeAssets(user, tenantId, f), {
          totalAssets: 0,
        }, (rows) => ({ totalAssets: rows.length }));

      case 'preventive_maintenance_register':
        return this.wrap(meta, await this.pmService.listSchedules(user, tenantId, f), {}, (rows) => ({
          total: rows.length,
          completed: rows.filter((r) => r.status === 'completed').length,
          overdue: rows.filter((r) => r.status === 'overdue').length,
        }));

      case 'breakdown_register':
        return this.wrap(meta, await this.breakdownService.listTickets(user, tenantId, f), {}, (rows) => ({
          total: rows.length,
          open: rows.filter((r) => r.status !== 'closed').length,
          closed: rows.filter((r) => r.status === 'closed').length,
        }));

      case 'complaint_register':
        return this.wrap(meta, await this.complaintService.listComplaints(user, tenantId, f), {}, (rows) => ({
          total: rows.length,
          open: rows.filter((r) => r.status !== 'closed').length,
          closed: rows.filter((r) => r.status === 'closed').length,
        }));

      case 'water_quality_register':
        return this.wrap(meta, await this.wqService.listTests(user, tenantId, f), {}, (rows) => ({
          total: rows.length,
          compliant: rows.filter((r) => r.isCompliant === true).length,
          nonCompliant: rows.filter((r) => r.isCompliant === false).length,
        }));

      case 'energy_consumption_register': {
        const [rows, summary] = await Promise.all([
          this.energyService.listReadings(user, tenantId, f),
          this.energyService.getSummary(user, tenantId, meta.projectId ?? undefined, f.from, f.to),
        ]);
        return { ...meta, rows, summary: { rowCount: rows.length, ...summary } };
      }

      case 'scada_monitoring': {
        const [readings, alerts, dashboard] = await Promise.all([
          this.scadaService.listReadings(user, tenantId, { ...f, limit: 200 }),
          this.scadaService.listAlerts(user, tenantId, f),
          this.scadaService.getLiveDashboard(user, tenantId, filters.projectId, filters.projectCode),
        ]);
        return {
          ...meta,
          rows: readings,
          alerts,
          summary: {
            readingCount: readings.length,
            openAlerts: alerts.filter((a: { status: string }) => a.status === 'open').length,
            scadaSites: dashboard.categories?.length ?? 0,
          },
        };
      }

      case 'asset_health': {
        const assets = await this.lifecycleService.listLifecycleAssets(user, tenantId, f);
        return this.wrap(meta, assets, {}, (rows) => ({
          trackedAssets: rows.length,
          avgHealthIndex: rows.length
            ? Math.round(rows.reduce((s, r) => s + r.healthIndex, 0) / rows.length)
            : null,
          critical: rows.filter((r) => r.conditionGrade === 'critical' || r.conditionGrade === 'poor').length,
          replacementDue: rows.filter((r) => r.remainingUsefulLifeYears <= 2).length,
        }));
      }

      case 'om_expenditure': {
        const [energySummary, plans] = await Promise.all([
          this.energyService.getSummary(user, tenantId, meta.projectId ?? undefined, f.from, f.to),
          this.lifecycleService.listPlans(user, tenantId, { ...f, status: undefined }),
        ]);
        const renewalCost = plans.reduce((s, p) => s + (p.estimatedCost ?? 0), 0);
        return {
          ...meta,
          rows: plans,
          summary: {
            energyCostInr: energySummary.energyCost ?? 0,
            energyKwh: energySummary.energyKwh ?? 0,
            plannedRenewalCostInr: renewalCost,
            totalExpenditureInr: (energySummary.energyCost ?? 0) + renewalCost,
            renewalPlanCount: plans.length,
          },
        };
      }

      case 'sla_performance': {
        const [contracts, summary] = await Promise.all([
          this.contractService.listContracts(user, tenantId, f),
          this.contractService.getSummary(user, tenantId, meta.projectId ?? undefined),
        ]);
        const rows = await Promise.all(
          contracts.slice(0, 20).map(async (c) => {
            const perf = await this.contractService.getPerformance(user, tenantId, c.id);
            return {
              contractCode: c.contractCode,
              contractorName: c.contractorName,
              status: c.status,
              overallSlaCompliancePct: perf.overallSlaCompliancePct,
              metricsMet: perf.metricsMet,
              metricsTotal: perf.metricsTotal,
            };
          }),
        );
        return { ...meta, rows, summary };
      }

      case 'annual_om_plan': {
        const year = filters.planYear ?? new Date().getFullYear();
        const [pmRows, renewalPlans, contracts] = await Promise.all([
          this.pmService.listSchedules(user, tenantId, f),
          this.lifecycleService.listPlans(user, tenantId, { ...f, planType: 'annual_capital', planYear: year }),
          this.contractService.listContracts(user, tenantId, { ...f, status: 'active' }),
        ]);
        return {
          ...meta,
          planYear: year,
          rows: [
            ...renewalPlans.map((p) => ({ section: 'Capital Renewal', ...p })),
            ...pmRows.slice(0, 100).map((p) => ({ section: 'Preventive Maintenance', ...p })),
          ],
          summary: {
            planYear: year,
            pmTasks: pmRows.length,
            pmOverdue: pmRows.filter((r) => r.status === 'overdue').length,
            annualRenewalPlans: renewalPlans.length,
            activeContracts: contracts.length,
          },
        };
      }

      case 'asset_renewal_plan': {
        const plans = await this.lifecycleService.listPlans(user, tenantId, {
          ...f,
        });
        const filtered = plans.filter((p) => p.planType === 'rehabilitation' || p.planType === 'replacement' || p.planType === 'annual_capital');
        return this.wrap(meta, filtered, {}, (rows) => ({
          totalPlans: rows.length,
          rehabilitation: rows.filter((r) => r.planType === 'rehabilitation').length,
          replacement: rows.filter((r) => r.planType === 'replacement').length,
          annualCapital: rows.filter((r) => r.planType === 'annual_capital').length,
          totalEstimatedCost: rows.reduce((s, r) => s + (r.estimatedCost ?? 0), 0),
        }));
      }

      case 'gis_om': {
        const dash = await this.dashboardService.getGisDashboard(user, tenantId, f);
        return {
          ...meta,
          rows: dash.mapMarkers ?? [],
          panels: dash.panels,
          overallStatus: dash.overallStatus,
          summary: {
            mapFeatures: dash.mapMarkers?.length ?? 0,
            overallStatus: dash.overallStatus,
            avgHealthIndex: dash.panels?.assetHealth?.avgHealthIndex ?? null,
            openBreakdowns: dash.panels?.activeBreakdowns?.open ?? 0,
            openComplaints: dash.panels?.complaintStatus?.open ?? 0,
          },
        };
      }

      case 'nrw_analysis': {
        const qb = this.kpiEntryRepo
          .createQueryBuilder('k')
          .where('k.tenant_id = :tenantId', { tenantId })
          .andWhere('k.nrw_pct IS NOT NULL')
          .orderBy('k.period_month', 'DESC')
          .take(100);
        if (meta.projectId) {
          qb.innerJoin('om_contracts', 'c', 'c.id = k.contract_id')
            .andWhere('c.project_id = :projectId', { projectId: meta.projectId });
        }
        const entries = await qb.getMany();
        const rows = entries.map((e) => ({
          periodMonth: e.periodMonth,
          nrwPct: e.nrwPct != null ? Number(e.nrwPct) : null,
          waterSupplyHoursPerDay: e.waterSupplyHoursPerDay != null ? Number(e.waterSupplyHoursPerDay) : null,
          pumpAvailabilityPct: e.pumpAvailabilityPct != null ? Number(e.pumpAvailabilityPct) : null,
          notes: e.notes,
        }));
        const nrwValues = rows.map((r) => r.nrwPct).filter((v): v is number => v != null);
        return {
          ...meta,
          rows,
          summary: {
            entryCount: rows.length,
            avgNrwPct: nrwValues.length
              ? Math.round(nrwValues.reduce((s, v) => s + v, 0) / nrwValues.length * 100) / 100
              : null,
            minNrwPct: nrwValues.length ? Math.min(...nrwValues) : null,
            maxNrwPct: nrwValues.length ? Math.max(...nrwValues) : null,
          },
        };
      }

      case 'consumer_service': {
        const [consumers, requests] = await Promise.all([
          this.consumerService.listConsumers(user, tenantId, f),
          this.listAllServiceRequests(user, tenantId, meta.projectId),
        ]);
        return {
          ...meta,
          rows: consumers,
          serviceRequests: requests,
          summary: {
            consumerCount: consumers.length,
            activeConnections: consumers.filter((c) => c.connectionStatus === 'active').length,
            serviceRequestCount: requests.length,
            pendingRequests: requests.filter((r) => r.status !== 'completed').length,
          },
        };
      }

      case 'audit': {
        const [handovers, inspections, inspSummary, pmSummary, wqSummary] = await Promise.all([
          (async () => {
            const qb = this.handoverRepo.createQueryBuilder('h').where('h.tenant_id = :tenantId', { tenantId });
            await this.scope.scopeProjectQb(qb, user, tenantId, 'h', meta.projectId);
            return qb.orderBy('h.created_at', 'DESC').take(50).getMany();
          })(),
          this.inspectionService.listInspections(user, tenantId, { ...f }),
          this.inspectionService.getSummary(user, tenantId, meta.projectId ?? undefined),
          this.pmService.getSummary(user, tenantId, meta.projectId ?? undefined),
          this.wqService.getSummary(user, tenantId, meta.projectId ?? undefined),
        ]);
        const rows = handovers.map((h) => ({
          schemeName: h.schemeName,
          status: h.status,
          assetRegisterVerified: h.assetRegisterVerified,
          gisMappingVerified: h.gisMappingVerified,
          commissioningVerified: h.commissioningVerified,
          createdAt: h.createdAt,
        }));
        return {
          ...meta,
          rows,
          inspections: inspections.slice(0, 50),
          summary: {
            handoverCount: handovers.length,
            approvedHandovers: handovers.filter((h) => h.status === 'approved' || h.status === 'completed').length,
            inspectionCount: inspections.length,
            inspectionDue: inspSummary.inspectionDue,
            pmOverdue: pmSummary.pmOverdue,
            waterQualityAlerts: wqSummary.waterQualityAlerts,
            complianceFlags: {
              assetRegisterGaps: handovers.filter((h) => !h.assetRegisterVerified).length,
              gisMappingGaps: handovers.filter((h) => !h.gisMappingVerified).length,
            },
          },
        };
      }

      default:
        throw new BadRequestException('Unsupported report type');
    }
  }

  private wrap<T extends Record<string, unknown>>(
    meta: Record<string, unknown>,
    rows: T[],
    defaultSummary: Record<string, unknown>,
    summaryFn?: (rows: T[]) => Record<string, unknown>,
  ) {
    return {
      ...meta,
      rows,
      summary: summaryFn ? summaryFn(rows) : { ...defaultSummary, rowCount: rows.length },
    };
  }

  private async listAllServiceRequests(user: JwtPayload, tenantId: string, projectId: string | null) {
    const qb = this.serviceRequestRepo
      .createQueryBuilder('r')
      .where('r.tenant_id = :tenantId', { tenantId })
      .orderBy('r.created_at', 'DESC')
      .take(200);
    if (projectId) {
      qb.innerJoin('om_consumers', 'c', 'c.id = r.consumer_id')
        .andWhere('c.project_id = :projectId', { projectId });
    } else {
      const consumerIds = await this.consumerService.listConsumers(user, tenantId, {}).then((rows) => rows.map((c) => c.id));
      if (!consumerIds.length) return [];
      qb.andWhere('r.consumer_id IN (:...consumerIds)', { consumerIds });
    }
    const rows = await qb.getMany();
    return rows.map((r) => ({
      id: r.id,
      requestNo: r.requestNo,
      requestType: r.requestType,
      status: r.status,
      consumerId: r.consumerId,
      createdAt: r.createdAt,
    }));
  }

  private async buildMeta(
    user: JwtPayload,
    tenantId: string,
    reportType: OmReportType,
    title: string,
    filters: ReportFilters,
  ) {
    const resolvedProjectId = await this.scope.resolveProjectId(user, tenantId, filters.projectId, filters.projectCode);
    const { from, to } = this.resolvePeriod(filters.from, filters.to);

    let projectName: string | null = null;
    let projectCode: string | null = null;
    if (resolvedProjectId) {
      const project = await this.projectRepo.findOne({ where: { id: resolvedProjectId, tenantId } });
      projectName = project?.name ?? null;
      projectCode = project?.projectCode ?? null;
    }

    return {
      reportType,
      title,
      generatedAt: new Date().toISOString(),
      period: { from, to },
      projectId: resolvedProjectId,
      projectName,
      projectCode,
    };
  }

  private resolvePeriod(from?: string, to?: string): { from: string; to: string } {
    const now = new Date();
    const defaultTo = to ?? this.formatDate(now);
    const defaultFrom = from ?? this.formatDate(new Date(now.getFullYear(), now.getMonth(), 1));
    return { from: defaultFrom, to: defaultTo };
  }

  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
