import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asset } from '../assets/entities/asset.entity';
import { Project } from '../projects/entities/project.entity';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { OmDivisionScopeService } from './om-division-scope.service';
import {
  OM_GIS_DASHBOARD_PANELS,
  statusFromHealth,
  type OmDashboardStatus,
} from './constants/om-dashboard-catalog';
import { OmBreakdownTicket } from './entities/om-breakdown-ticket.entity';
import { OmConsumerComplaint } from './entities/om-consumer-complaint.entity';
import { OmRenewalPlan } from './entities/om-renewal-plan.entity';
import { OmBreakdownService } from './om-breakdown.service';
import { OmComplaintService } from './om-complaint.service';
import { OmContractService } from './om-contract.service';
import { OmEnergyService } from './om-energy.service';
import { OmLifecycleService } from './om-lifecycle.service';
import { OmScadaService } from './om-scada.service';
import { OmWqService } from './om-wq.service';

type MapMarker = {
  id: string;
  markerType: 'asset' | 'breakdown' | 'complaint';
  label: string;
  latitude: number;
  longitude: number;
  status: string;
  severity: 'normal' | 'warning' | 'critical';
};

@Injectable()
export class OmDashboardService {
  constructor(
    private breakdownService: OmBreakdownService,
    private scadaService: OmScadaService,
    private wqService: OmWqService,
    private energyService: OmEnergyService,
    private complaintService: OmComplaintService,
    private contractService: OmContractService,
    private lifecycleService: OmLifecycleService,
    @InjectRepository(Asset) private assetRepo: Repository<Asset>,
    @InjectRepository(OmBreakdownTicket) private breakdownRepo: Repository<OmBreakdownTicket>,
    @InjectRepository(OmConsumerComplaint) private complaintRepo: Repository<OmConsumerComplaint>,
    @InjectRepository(OmRenewalPlan) private planRepo: Repository<OmRenewalPlan>,
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    private scope: OmDivisionScopeService,
  ) {}

  getCatalog() {
    return { panels: OM_GIS_DASHBOARD_PANELS };
  }

  async getGisDashboard(
    user: JwtPayload,
    tenantId: string,
    filters: { projectId?: string; projectCode?: string },
  ) {
    const resolvedProjectId = await this.scope.resolveProjectId(user, tenantId, filters.projectId, filters.projectCode);

    const [
      lifecycle,
      breakdown,
      scada,
      wq,
      energy,
      complaints,
      contracts,
      openBreakdowns,
      openComplaints,
      renewalPlans,
      mapMarkers,
    ] = await Promise.all([
      this.lifecycleService.getSummary(user, tenantId, resolvedProjectId ?? undefined),
      this.breakdownService.getSummary(user, tenantId, resolvedProjectId ?? undefined),
      this.scadaService.getLiveDashboard(user, tenantId, filters.projectId, filters.projectCode),
      this.wqService.getSummary(user, tenantId, resolvedProjectId ?? undefined),
      this.energyService.getSummary(user, tenantId, resolvedProjectId ?? undefined),
      this.complaintService.getSummary(user, tenantId, resolvedProjectId ?? undefined),
      this.contractService.getSummary(user, tenantId, resolvedProjectId ?? undefined),
      this.breakdownService.listTickets(user, tenantId, {
        projectId: filters.projectId,
        projectCode: filters.projectCode,
        status: 'open',
      }),
      this.complaintService.listComplaints(user, tenantId, {
        projectId: filters.projectId,
        projectCode: filters.projectCode,
        status: 'open',
      }),
      this.listActiveRenewalPlans(user, tenantId, resolvedProjectId),
      this.buildMapMarkers(user, tenantId, resolvedProjectId),
    ]);

    const reservoirSite = scada.categories?.find((c: { category: string }) => c.category === 'reservoir');
    const pumpSite = scada.categories?.find((c: { category: string }) => c.category === 'pump_house');

    const waterLevelMetric = reservoirSite?.metrics?.find((m: { key: string }) => m.key === 'water_level');
    const pumpStatusMetric = pumpSite?.metrics?.find((m: { key: string }) => m.key === 'pump_status');
    const flowMetric = pumpSite?.metrics?.find((m: { key: string }) => m.key === 'flow');

    const waterLevelPct = this.parseNumeric(waterLevelMetric?.latest);
    const pumpStatus = pumpStatusMetric?.latest ?? null;
    const flowLps = this.parseNumeric(flowMetric?.latest);

    const noWaterComplaints = (openComplaints as Array<{ complaintType: string }>)
      .filter((c) => c.complaintType === 'no_water_supply' || c.complaintType === 'low_pressure').length;

    const waterSupplyStatus = this.computeWaterSupplyStatus(
      pumpStatus,
      waterLevelPct,
      noWaterComplaints,
      scada.criticalAlerts ?? 0,
    );

    const reservoirStatus = this.computeReservoirStatus(waterLevelPct);
    const pumpPanelStatus = this.computePumpStatus(pumpStatus, flowLps);

    let projectName: string | null = null;
    let projectCode: string | null = null;
    if (resolvedProjectId) {
      const project = await this.projectRepo.findOne({ where: { id: resolvedProjectId, tenantId } });
      projectName = project?.name ?? null;
      projectCode = project?.projectCode ?? null;
    }

    const wqCompliancePct = wq.total > 0 ? Math.round((wq.compliant / wq.total) * 100) : null;
    const assetHealthStatus = statusFromHealth(lifecycle.avgHealthIndex);

    const overallStatus = this.computeOverallStatus([
      assetHealthStatus,
      breakdown.openBreakdowns > 0 ? 'warning' : 'normal',
      waterSupplyStatus.status,
      reservoirStatus.status,
      pumpPanelStatus.status,
      wqCompliancePct != null && wqCompliancePct < 90 ? 'warning' : wq.waterQualityAlerts > 0 ? 'critical' : 'normal',
      complaints.openComplaints > 5 ? 'warning' : complaints.openComplaints > 0 ? 'warning' : 'normal',
      contracts.avgSlaCompliancePct != null && contracts.avgSlaCompliancePct < 80 ? 'warning' : 'normal',
      lifecycle.replacementDue > 0 ? 'warning' : 'normal',
    ]);

    return {
      generatedAt: new Date().toISOString(),
      projectId: resolvedProjectId,
      projectName,
      projectCode,
      overallStatus,
      panels: {
        assetHealth: {
          status: assetHealthStatus,
          avgHealthIndex: lifecycle.avgHealthIndex,
          trackedAssets: lifecycle.trackedAssets,
          criticalAssets: lifecycle.criticalAssets,
          byCategory: lifecycle.byCategory,
        },
        activeBreakdowns: {
          status: breakdown.openBreakdowns > 0 ? 'warning' : 'normal',
          open: breakdown.openBreakdowns,
          closed: breakdown.closedBreakdowns,
          avgResponseTimeMins: breakdown.avgResponseTimeMins,
          recent: (openBreakdowns as Array<Record<string, unknown>>).slice(0, 5),
        },
        waterSupply: {
          status: waterSupplyStatus.status,
          label: waterSupplyStatus.label,
          pumpStatus,
          reservoirLevelPct: waterLevelPct,
          openSupplyComplaints: noWaterComplaints,
          scadaCriticalAlerts: scada.criticalAlerts ?? 0,
        },
        reservoirLevels: {
          status: reservoirStatus.status,
          levelPct: waterLevelPct,
          label: reservoirStatus.label,
          lastReadingAt: waterLevelMetric?.recordedAt ?? null,
        },
        pumpStatus: {
          status: pumpPanelStatus.status,
          pumpState: pumpStatus,
          flowLps,
          label: pumpPanelStatus.label,
          lastReadingAt: pumpStatusMetric?.recordedAt ?? null,
        },
        waterQuality: {
          status: wq.waterQualityAlerts > 0 ? 'critical' : wqCompliancePct != null && wqCompliancePct < 95 ? 'warning' : 'normal',
          totalTests: wq.total,
          compliant: wq.compliant,
          nonCompliant: wq.nonCompliant,
          alerts: wq.waterQualityAlerts,
          compliancePct: wqCompliancePct,
          openWorkflow: wq.openWorkflow,
        },
        energyConsumption: {
          status: 'normal',
          period: energy.period,
          readingCount: energy.readingCount,
          energyKwh: energy.energyKwh,
          waterPumpedKl: energy.waterPumpedKl,
          kwhPerKl: energy.kwhPerKl,
          energyCost: energy.energyCost,
          avgPumpEfficiencyPct: energy.avgPumpEfficiencyPct,
        },
        complaintStatus: {
          status: complaints.openComplaints > 0 ? 'warning' : 'normal',
          open: complaints.openComplaints,
          closed: complaints.closedComplaints,
          avgResponseTimeMins: complaints.avgResponseTimeMins,
          channelBreakdown: complaints.channelBreakdown,
          recent: (openComplaints as Array<Record<string, unknown>>).slice(0, 5),
        },
        slaCompliance: {
          status: contracts.avgSlaCompliancePct != null && contracts.avgSlaCompliancePct >= 80
            ? 'normal'
            : contracts.avgSlaCompliancePct != null
              ? 'warning'
              : 'unknown',
          avgSlaCompliancePct: contracts.avgSlaCompliancePct,
          activeContracts: contracts.activeContracts,
          contractsBelowSla: contracts.contractsBelowSla,
          underReview: contracts.underReview,
        },
        assetRenewal: {
          status: lifecycle.replacementDue > 0 || lifecycle.criticalAssets > 0 ? 'warning' : 'normal',
          replacementDue: lifecycle.replacementDue,
          rehabilitationPlans: lifecycle.rehabilitationPlans,
          replacementPlans: lifecycle.replacementPlans,
          annualPlans: lifecycle.annualPlans,
          draftPlans: lifecycle.draftPlans,
          upcoming: renewalPlans,
        },
      },
      scadaSites: scada.categories ?? [],
      mapMarkers,
    };
  }

  private async listActiveRenewalPlans(user: JwtPayload, tenantId: string, projectId: string | null) {
    const qb = this.planRepo
      .createQueryBuilder('p')
      .where('p.tenant_id = :tenantId', { tenantId })
      .andWhere('p.status IN (:...statuses)', { statuses: ['draft', 'approved', 'in_progress'] })
      .orderBy('p.created_at', 'DESC')
      .take(8);
    await this.scope.scopeProjectQb(qb, user, tenantId, 'p', projectId);
    const rows = await qb.getMany();
    return rows.map((r) => ({
      id: r.id,
      planNo: r.planNo,
      planType: r.planType,
      title: r.title,
      priority: r.priority,
      status: r.status,
    }));
  }

  private async buildMapMarkers(user: JwtPayload, tenantId: string, projectId: string | null): Promise<MapMarker[]> {
    const markers: MapMarker[] = [];

    const assetQb = this.assetRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.assetType', 't')
      .where('a.tenant_id = :tenantId', { tenantId })
      .andWhere('a.deleted_at IS NULL')
      .andWhere('(a.project_id IS NOT NULL OR a.handover_id IS NOT NULL OR a.om_category IS NOT NULL)');
    await this.scope.scopeProjectQb(assetQb, user, tenantId, 'a', projectId);
    const assets = await assetQb.take(100).getMany();

    for (const asset of assets) {
      const coords = this.extractCoords(asset.attributes);
      if (!coords) continue;
      const health = asset.healthScore ?? 100;
      markers.push({
        id: asset.id,
        markerType: 'asset',
        label: `${asset.assetCode} — ${asset.name ?? asset.assetType?.name ?? 'Asset'}`,
        latitude: coords.lat,
        longitude: coords.lng,
        status: health >= 70 ? 'healthy' : health >= 50 ? 'degraded' : 'critical',
        severity: health >= 70 ? 'normal' : health >= 50 ? 'warning' : 'critical',
      });
    }

    const bdQb = this.breakdownRepo
      .createQueryBuilder('b')
      .where('b.tenant_id = :tenantId', { tenantId })
      .andWhere('b.status != :closed', { closed: 'closed' })
      .andWhere('b.latitude IS NOT NULL AND b.longitude IS NOT NULL');
    await this.scope.scopeProjectQb(bdQb, user, tenantId, 'b', projectId);
    const breakdowns = await bdQb.take(30).getMany();

    for (const b of breakdowns) {
      markers.push({
        id: b.id,
        markerType: 'breakdown',
        label: `${b.ticketNo} — ${b.title}`,
        latitude: b.latitude!,
        longitude: b.longitude!,
        status: b.status,
        severity: b.priority === 'critical' || b.priority === 'high' ? 'critical' : 'warning',
      });
    }

    const cpQb = this.complaintRepo
      .createQueryBuilder('c')
      .where('c.tenant_id = :tenantId', { tenantId })
      .andWhere('c.status != :closed', { closed: 'closed' })
      .andWhere('c.latitude IS NOT NULL AND c.longitude IS NOT NULL');
    await this.scope.scopeProjectQb(cpQb, user, tenantId, 'c', projectId);
    const complaints = await cpQb.take(30).getMany();

    for (const c of complaints) {
      markers.push({
        id: c.id,
        markerType: 'complaint',
        label: `${c.complaintNo} — ${c.complaintType.replace(/_/g, ' ')}`,
        latitude: c.latitude!,
        longitude: c.longitude!,
        status: c.status,
        severity: c.priority === 'critical' || c.priority === 'high' ? 'critical' : 'warning',
      });
    }

    return markers;
  }

  private extractCoords(attributes: Record<string, unknown> | null | undefined): { lat: number; lng: number } | null {
    if (!attributes) return null;
    const lat = attributes.latitude ?? attributes.lat;
    const lng = attributes.longitude ?? attributes.lng ?? attributes.lon;
    if (lat == null || lng == null) return null;
    const latN = Number(lat);
    const lngN = Number(lng);
    if (Number.isNaN(latN) || Number.isNaN(lngN)) return null;
    return { lat: latN, lng: lngN };
  }

  private parseNumeric(value: string | null | undefined): number | null {
    if (value == null) return null;
    const n = Number.parseFloat(String(value).replace(/[^\d.-]/g, ''));
    return Number.isNaN(n) ? null : n;
  }

  private computeWaterSupplyStatus(
    pumpStatus: string | null,
    waterLevelPct: number | null,
    supplyComplaints: number,
    criticalAlerts: number,
  ): { status: OmDashboardStatus; label: string } {
    if (criticalAlerts > 0 || pumpStatus === 'trip' || supplyComplaints >= 3) {
      return { status: 'critical', label: 'Supply Disrupted' };
    }
    if (pumpStatus === 'stopped' || pumpStatus === 'maintenance' || waterLevelPct != null && waterLevelPct < 15) {
      return { status: 'warning', label: 'Reduced Supply' };
    }
    if (pumpStatus === 'running' && (waterLevelPct == null || waterLevelPct >= 15)) {
      return { status: 'normal', label: 'Normal Supply' };
    }
    if (supplyComplaints > 0) {
      return { status: 'warning', label: 'Supply Complaints Reported' };
    }
    return { status: 'unknown', label: 'Awaiting Telemetry' };
  }

  private computeReservoirStatus(levelPct: number | null): { status: OmDashboardStatus; label: string } {
    if (levelPct == null) return { status: 'unknown', label: 'No reading' };
    if (levelPct >= 90) return { status: 'warning', label: 'High level' };
    if (levelPct <= 15) return { status: 'critical', label: 'Low level' };
    if (levelPct <= 30) return { status: 'warning', label: 'Moderate level' };
    return { status: 'normal', label: 'Normal level' };
  }

  private computePumpStatus(
    pumpStatus: string | null,
    flowLps: number | null,
  ): { status: OmDashboardStatus; label: string } {
    if (!pumpStatus) return { status: 'unknown', label: 'No telemetry' };
    if (pumpStatus === 'trip') return { status: 'critical', label: 'Pump tripped' };
    if (pumpStatus === 'maintenance') return { status: 'warning', label: 'Under maintenance' };
    if (pumpStatus === 'running') {
      if (flowLps != null && flowLps < 1) return { status: 'warning', label: 'Running — low flow' };
      return { status: 'normal', label: 'Running normally' };
    }
    return { status: 'warning', label: 'Pump stopped' };
  }

  private computeOverallStatus(statuses: OmDashboardStatus[]): OmDashboardStatus {
    if (statuses.includes('critical')) return 'critical';
    if (statuses.includes('warning')) return 'warning';
    if (statuses.every((s) => s === 'unknown')) return 'unknown';
    return 'normal';
  }
}
