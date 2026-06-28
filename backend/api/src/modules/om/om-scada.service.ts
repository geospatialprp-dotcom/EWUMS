import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asset } from '../assets/entities/asset.entity';
import { Project } from '../projects/entities/project.entity';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { OmDivisionScopeService } from './om-division-scope.service';
import {
  getAlertTypeLabel,
  getScadaMetricDef,
  OM_SCADA_ALERT_TYPES,
  OM_SCADA_SITES,
  SCADA_THRESHOLDS,
  type OmScadaAlertType,
} from './constants/om-scada-catalog';
import { IngestScadaReadingDto } from './dto/ingest-scada-reading.dto';
import { OmScadaAlert } from './entities/om-scada-alert.entity';
import { OmScadaReading } from './entities/om-scada-reading.entity';

@Injectable()
export class OmScadaService {
  constructor(
    @InjectRepository(OmScadaReading) private readingRepo: Repository<OmScadaReading>,
    @InjectRepository(OmScadaAlert) private alertRepo: Repository<OmScadaAlert>,
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    @InjectRepository(Asset) private assetRepo: Repository<Asset>,
    private scope: OmDivisionScopeService,
  ) {}

  getCatalog() {
    return { sites: OM_SCADA_SITES, alertTypes: OM_SCADA_ALERT_TYPES, thresholds: SCADA_THRESHOLDS };
  }

  async getLiveDashboard(user: JwtPayload, tenantId: string, projectId?: string, projectCode?: string) {
    const resolvedProjectId = await this.scope.resolveProjectId(user, tenantId, projectId, projectCode);
    const categories = await Promise.all(
      OM_SCADA_SITES.map(async (site) => {
        const metrics = await Promise.all(
          site.metrics.map(async (metric) => {
            const latest = await this.latestReading(user, tenantId, site.category, metric.key, resolvedProjectId);
            return {
              ...metric,
              latest: latest ? this.formatReadingValue(latest) : null,
              recordedAt: latest?.recordedAt ?? null,
            };
          }),
        );
        return { ...site, metrics };
      }),
    );

    const [openAlerts, criticalAlerts] = await Promise.all([
      this.countOpenAlerts(user, tenantId, resolvedProjectId),
      (async () => {
        const qb = this.alertRepo
          .createQueryBuilder('a')
          .where('a.tenant_id = :tenantId', { tenantId })
          .andWhere('a.status = :status', { status: 'open' })
          .andWhere('a.severity = :severity', { severity: 'critical' });
        await this.scope.scopeProjectQb(qb, user, tenantId, 'a', resolvedProjectId);
        return qb.getCount();
      })(),
    ]);

    return { categories, openAlerts, criticalAlerts, scadaAlerts: openAlerts };
  }

  async listReadings(
    user: JwtPayload,
    tenantId: string,
    filters: {
      projectId?: string;
      projectCode?: string;
      siteCategory?: string;
      metricKey?: string;
      limit?: number;
    },
  ) {
    const resolvedProjectId = await this.scope.resolveProjectId(user, tenantId, filters.projectId, filters.projectCode);
    const qb = this.readingRepo
      .createQueryBuilder('r')
      .where('r.tenant_id = :tenantId', { tenantId })
      .orderBy('r.recorded_at', 'DESC')
      .take(filters.limit ?? 100);

    await this.scope.scopeProjectQb(qb, user, tenantId, 'r', resolvedProjectId);
    if (filters.siteCategory) qb.andWhere('r.site_category = :siteCategory', { siteCategory: filters.siteCategory });
    if (filters.metricKey) qb.andWhere('r.metric_key = :metricKey', { metricKey: filters.metricKey });

    const rows = await qb.getMany();
    return Promise.all(rows.map((r) => this.toReadingRecord(tenantId, r)));
  }

  async ingestReading(user: JwtPayload, tenantId: string, dto: IngestScadaReadingDto) {
    const metricDef = getScadaMetricDef(dto.siteCategory, dto.metricKey);
    if (!metricDef) throw new BadRequestException('Invalid site category or metric');

    const resolvedProjectId = await this.scope.resolveProjectId(user, tenantId, dto.projectId, dto.projectCode);
    if (dto.assetId) {
      const asset = await this.assetRepo.findOne({ where: { id: dto.assetId, tenantId } });
      if (!asset) throw new BadRequestException('Asset not found');
    }

    if (metricDef.type === 'number' && dto.valueNumeric == null) {
      throw new BadRequestException(`${metricDef.label} requires a numeric value`);
    }
    if (metricDef.type === 'text' && !dto.valueText?.trim()) {
      throw new BadRequestException(`${metricDef.label} requires a text value`);
    }
    if (metricDef.type === 'boolean' && dto.valueNumeric == null && !dto.valueText) {
      throw new BadRequestException(`${metricDef.label} requires a boolean value`);
    }

    const row = this.readingRepo.create({
      tenantId,
      projectId: resolvedProjectId,
      assetId: dto.assetId ?? null,
      siteCategory: dto.siteCategory,
      metricKey: dto.metricKey,
      valueNumeric: dto.valueNumeric ?? null,
      valueText: dto.valueText?.trim() ?? null,
      unit: dto.unit ?? metricDef.unit ?? null,
      source: dto.source ?? 'scada',
      recordedAt: dto.recordedAt ? new Date(dto.recordedAt) : new Date(),
    });

    const saved = await this.readingRepo.save(row);
    const alerts = await this.evaluateAlerts(user, tenantId, saved);
    const record = await this.toReadingRecord(tenantId, saved);
    return { reading: record, alertsGenerated: alerts.length, alerts };
  }

  async simulateSnapshot(user: JwtPayload, tenantId: string, projectId?: string, projectCode?: string) {
    const resolvedProjectId = await this.scope.resolveProjectId(user, tenantId, projectId, projectCode);
    const now = new Date();
    const projectRef = {
      projectId: resolvedProjectId ?? undefined,
      projectCode: projectCode?.trim() || undefined,
    };
    const samples: IngestScadaReadingDto[] = [
      { siteCategory: 'reservoir', metricKey: 'water_level', valueNumeric: 55 + Math.random() * 30, ...projectRef },
      { siteCategory: 'pump_house', metricKey: 'pump_status', valueText: Math.random() > 0.85 ? 'trip' : 'running', ...projectRef },
      { siteCategory: 'pump_house', metricKey: 'flow', valueNumeric: 12 + Math.random() * 8, ...projectRef },
      { siteCategory: 'pump_house', metricKey: 'pressure', valueNumeric: 2.5 + Math.random() * 1.5, ...projectRef },
      { siteCategory: 'electrical', metricKey: 'transformer_status', valueText: Math.random() > 0.9 ? 'fault' : 'online', ...projectRef },
      { siteCategory: 'electrical', metricKey: 'power_available', valueNumeric: Math.random() > 0.92 ? 0 : 1, ...projectRef },
      { siteCategory: 'chlorination', metricKey: 'residual_chlorine', valueNumeric: 0.1 + Math.random() * 1.2, ...projectRef },
    ];

    const results = [];
    for (const sample of samples) {
      sample.recordedAt = now.toISOString();
      sample.source = 'scada';
      results.push(await this.ingestReading(user, tenantId, sample));
    }
    return { ingested: results.length, results };
  }

  async listAlerts(
    user: JwtPayload,
    tenantId: string,
    filters: { projectId?: string; projectCode?: string; status?: string; alertType?: string },
  ) {
    const resolvedProjectId = await this.scope.resolveProjectId(user, tenantId, filters.projectId, filters.projectCode);
    const qb = this.alertRepo
      .createQueryBuilder('a')
      .where('a.tenant_id = :tenantId', { tenantId })
      .orderBy('a.created_at', 'DESC')
      .take(200);

    await this.scope.scopeProjectQb(qb, user, tenantId, 'a', resolvedProjectId);
    if (filters.status) qb.andWhere('a.status = :status', { status: filters.status });
    if (filters.alertType) qb.andWhere('a.alert_type = :alertType', { alertType: filters.alertType });

    const rows = await qb.getMany();
    return Promise.all(rows.map((a) => this.toAlertRecord(tenantId, a)));
  }

  async acknowledgeAlert(user: JwtPayload, tenantId: string, id: string) {
    const alert = await this.alertRepo.findOne({ where: { id, tenantId } });
    if (!alert) throw new NotFoundException('Alert not found');
    await this.scope.assertProjectAccess(user, alert.projectId, tenantId);
    if (alert.status === 'resolved') throw new BadRequestException('Alert is already resolved');
    alert.status = 'acknowledged';
    alert.acknowledgedAt = new Date();
    const saved = await this.alertRepo.save(alert);
    return this.toAlertRecord(tenantId, saved);
  }

  async resolveAlert(user: JwtPayload, tenantId: string, id: string) {
    const alert = await this.alertRepo.findOne({ where: { id, tenantId } });
    if (!alert) throw new NotFoundException('Alert not found');
    await this.scope.assertProjectAccess(user, alert.projectId, tenantId);
    alert.status = 'resolved';
    alert.resolvedAt = new Date();
    const saved = await this.alertRepo.save(alert);
    return this.toAlertRecord(tenantId, saved);
  }

  async getSummary(user: JwtPayload, tenantId: string, projectId?: string) {
    const resolvedProjectId = projectId
      ? await this.scope.resolveProjectId(user, tenantId, projectId)
      : null;
    const base = this.alertRepo.createQueryBuilder('a').where('a.tenant_id = :tenantId', { tenantId });
    await this.scope.scopeProjectQb(base, user, tenantId, 'a', resolvedProjectId);

    const [openAlerts, criticalAlerts, resolvedAlerts, total] = await Promise.all([
      base.clone().andWhere('a.status = :s', { s: 'open' }).getCount(),
      base.clone().andWhere('a.status = :s', { s: 'open' }).andWhere('a.severity = :sev', { sev: 'critical' }).getCount(),
      base.clone().andWhere('a.status = :s', { s: 'resolved' }).getCount(),
      base.clone().getCount(),
    ]);

    return { openAlerts, criticalAlerts, resolvedAlerts, total, scadaAlerts: openAlerts };
  }

  private async evaluateAlerts(user: JwtPayload, tenantId: string, reading: OmScadaReading): Promise<OmScadaAlert[]> {
    const generated: OmScadaAlert[] = [];
    const ctx = {
      tenantId,
      projectId: reading.projectId,
      assetId: reading.assetId,
      metricKey: reading.metricKey,
      metricValue: reading.valueNumeric,
    };

    if (reading.metricKey === 'water_level' && reading.valueNumeric != null) {
      if (reading.valueNumeric >= SCADA_THRESHOLDS.water_level_high_pct) {
        generated.push(await this.createAlert(ctx, 'high_reservoir_level', 'warning',
          `High reservoir level: ${reading.valueNumeric.toFixed(1)}%`, reading.valueNumeric));
      }
      if (reading.valueNumeric <= SCADA_THRESHOLDS.water_level_low_pct) {
        generated.push(await this.createAlert(ctx, 'low_reservoir_level', 'critical',
          `Low reservoir level: ${reading.valueNumeric.toFixed(1)}%`, reading.valueNumeric));
      }
    }

    if (reading.metricKey === 'pump_status' && reading.valueText === 'trip') {
      generated.push(await this.createAlert(ctx, 'pump_trip', 'critical', 'Pump trip detected', null));
    }

    if (reading.metricKey === 'pump_status' && reading.valueText === 'running') {
      const flow = await this.latestReading(user, tenantId, 'pump_house', 'flow', reading.projectId);
      if (flow?.valueNumeric != null && flow.valueNumeric < SCADA_THRESHOLDS.flow_min_when_running_lps) {
        generated.push(await this.createAlert(ctx, 'pump_trip', 'critical',
          `Pump running but flow is low (${flow.valueNumeric} LPS)`, flow.valueNumeric));
      }
    }

    if (reading.metricKey === 'pressure' && reading.valueNumeric != null) {
      const prev = await this.previousReading(tenantId, reading);
      if (prev?.valueNumeric != null && prev.valueNumeric - reading.valueNumeric >= SCADA_THRESHOLDS.pressure_leakage_drop_bar) {
        generated.push(await this.createAlert(ctx, 'leakage_detection', 'warning',
          `Pressure drop detected: ${prev.valueNumeric.toFixed(2)} → ${reading.valueNumeric.toFixed(2)} bar`,
          reading.valueNumeric));
      }
    }

    if (reading.metricKey === 'power_available') {
      const available = reading.valueNumeric === 1 || reading.valueText === 'true' || reading.valueText === '1';
      if (!available) {
        generated.push(await this.createAlert(ctx, 'power_failure', 'critical', 'Power failure detected', 0));
      }
    }

    if (reading.metricKey === 'transformer_status' && reading.valueText === 'fault') {
      generated.push(await this.createAlert(ctx, 'power_failure', 'critical', 'Transformer fault detected', null));
    }

    if (reading.metricKey === 'residual_chlorine' && reading.valueNumeric != null) {
      if (reading.valueNumeric < SCADA_THRESHOLDS.residual_chlorine_min
        || reading.valueNumeric > SCADA_THRESHOLDS.residual_chlorine_max) {
        generated.push(await this.createAlert(ctx, 'water_quality_failure', 'critical',
          `Residual chlorine out of range: ${reading.valueNumeric.toFixed(2)} mg/L`, reading.valueNumeric));
      }
    }

    return generated;
  }

  private async createAlert(
    ctx: {
      tenantId: string;
      projectId: string | null;
      assetId: string | null;
      metricKey: string;
      metricValue: number | null;
    },
    alertType: OmScadaAlertType,
    severity: string,
    message: string,
    metricValue: number | null,
  ) {
    const recent = await this.alertRepo
      .createQueryBuilder('a')
      .where('a.tenant_id = :tenantId', { tenantId: ctx.tenantId })
      .andWhere('a.alert_type = :alertType', { alertType })
      .andWhere('a.status = :status', { status: 'open' })
      .andWhere('a.created_at >= :since', { since: new Date(Date.now() - 15 * 60 * 1000).toISOString() })
      .getOne();
    if (recent) return recent;

    const alert = this.alertRepo.create({
      tenantId: ctx.tenantId,
      projectId: ctx.projectId,
      assetId: ctx.assetId,
      alertType,
      severity,
      message,
      metricKey: ctx.metricKey,
      metricValue: metricValue ?? ctx.metricValue,
      status: 'open',
    });
    return this.alertRepo.save(alert);
  }

  private async latestReading(
    user: JwtPayload,
    tenantId: string,
    siteCategory: string,
    metricKey: string,
    projectId: string | null,
  ) {
    const qb = this.readingRepo
      .createQueryBuilder('r')
      .where('r.tenant_id = :tenantId', { tenantId })
      .andWhere('r.site_category = :siteCategory', { siteCategory })
      .andWhere('r.metric_key = :metricKey', { metricKey })
      .orderBy('r.recorded_at', 'DESC')
      .take(1);
    await this.scope.scopeProjectQb(qb, user, tenantId, 'r', projectId);
    return qb.getOne();
  }

  private async previousReading(tenantId: string, current: OmScadaReading) {
    const qb = this.readingRepo
      .createQueryBuilder('r')
      .where('r.tenant_id = :tenantId', { tenantId })
      .andWhere('r.site_category = :siteCategory', { siteCategory: current.siteCategory })
      .andWhere('r.metric_key = :metricKey', { metricKey: current.metricKey })
      .andWhere('r.recorded_at < :recordedAt', { recordedAt: current.recordedAt })
      .orderBy('r.recorded_at', 'DESC')
      .take(1);
    if (current.projectId) qb.andWhere('r.project_id = :projectId', { projectId: current.projectId });
    return qb.getOne();
  }

  private async countOpenAlerts(user: JwtPayload, tenantId: string, projectId: string | null) {
    const qb = this.alertRepo
      .createQueryBuilder('a')
      .where('a.tenant_id = :tenantId', { tenantId })
      .andWhere('a.status = :status', { status: 'open' });
    await this.scope.scopeProjectQb(qb, user, tenantId, 'a', projectId);
    return qb.getCount();
  }

  private formatReadingValue(row: OmScadaReading) {
    if (row.valueText != null) {
      if (row.metricKey === 'power_available') {
        return row.valueNumeric === 1 || row.valueText === 'true' ? 'Available' : 'Unavailable';
      }
      return row.valueText;
    }
    if (row.valueNumeric != null) {
      return row.unit ? `${row.valueNumeric} ${row.unit}` : String(row.valueNumeric);
    }
    return null;
  }

  private async toReadingRecord(tenantId: string, row: OmScadaReading) {
    let projectCode: string | null = null;
    if (row.projectId) {
      const project = await this.projectRepo.findOne({ where: { id: row.projectId, tenantId } });
      projectCode = project?.projectCode ?? null;
    }
    return {
      id: row.id,
      siteCategory: row.siteCategory,
      metricKey: row.metricKey,
      value: this.formatReadingValue(row),
      valueNumeric: row.valueNumeric,
      valueText: row.valueText,
      unit: row.unit,
      source: row.source,
      projectId: row.projectId,
      projectCode,
      recordedAt: row.recordedAt,
    };
  }

  private async toAlertRecord(tenantId: string, row: OmScadaAlert) {
    let projectCode: string | null = null;
    if (row.projectId) {
      const project = await this.projectRepo.findOne({ where: { id: row.projectId, tenantId } });
      projectCode = project?.projectCode ?? null;
    }
    return {
      id: row.id,
      alertType: row.alertType,
      alertLabel: getAlertTypeLabel(row.alertType),
      severity: row.severity,
      message: row.message,
      metricKey: row.metricKey,
      metricValue: row.metricValue,
      status: row.status,
      projectCode,
      acknowledgedAt: row.acknowledgedAt,
      resolvedAt: row.resolvedAt,
      createdAt: row.createdAt,
    };
  }
}
