import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asset } from '../assets/entities/asset.entity';
import { Project } from '../projects/entities/project.entity';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { OmDivisionScopeService } from './om-division-scope.service';
import {
  computeKwhPerKl,
  OM_ENERGY_METRICS,
  OM_ENERGY_REPORT_TYPES,
  type OmEnergyReportType,
} from './constants/om-energy-catalog';
import { CreateOmEnergyReadingDto } from './dto/create-om-energy-reading.dto';
import { OmEnergyReading } from './entities/om-energy-reading.entity';

type ReadingRow = {
  id: string;
  readingCode: string | null;
  readingDate: string;
  projectId: string | null;
  projectName: string | null;
  projectCode: string | null;
  assetId: string | null;
  assetCode: string | null;
  pumpRunningHours: number | null;
  energyKwh: number | null;
  energyCost: number | null;
  waterPumpedKl: number | null;
  powerFactor: number | null;
  pumpEfficiencyPct: number | null;
  kwhPerKl: number | null;
  notes: string | null;
  createdAt: Date;
};

@Injectable()
export class OmEnergyService {
  constructor(
    @InjectRepository(OmEnergyReading) private energyRepo: Repository<OmEnergyReading>,
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    @InjectRepository(Asset) private assetRepo: Repository<Asset>,
    private scope: OmDivisionScopeService,
  ) {}

  getCatalog() {
    return { metrics: OM_ENERGY_METRICS, reportTypes: OM_ENERGY_REPORT_TYPES };
  }

  async listReadings(
    user: JwtPayload,
    tenantId: string,
    filters: { projectId?: string; projectCode?: string; from?: string; to?: string },
  ) {
    const resolvedProjectId = await this.scope.resolveProjectId(user, tenantId, filters.projectId, filters.projectCode);
    const qb = this.energyRepo
      .createQueryBuilder('e')
      .where('e.tenant_id = :tenantId', { tenantId })
      .orderBy('e.reading_date', 'DESC')
      .addOrderBy('e.created_at', 'DESC')
      .take(365);

    await this.scope.scopeProjectQb(qb, user, tenantId, 'e', resolvedProjectId);
    if (filters.from) qb.andWhere('e.reading_date >= :from', { from: filters.from });
    if (filters.to) qb.andWhere('e.reading_date <= :to', { to: filters.to });

    const rows = await qb.getMany();
    return Promise.all(rows.map((r) => this.toRecord(tenantId, r)));
  }

  async createReading(user: JwtPayload, tenantId: string, userId: string, dto: CreateOmEnergyReadingDto) {
    const resolvedProjectId = await this.scope.resolveProjectId(user, tenantId, dto.projectId, dto.projectCode);
    if (dto.assetId) {
      const asset = await this.assetRepo.findOne({ where: { id: dto.assetId, tenantId } });
      if (!asset) throw new BadRequestException('Asset not found');
    }

    const count = await this.energyRepo.count({ where: { tenantId } });
    const readingCode = `EN-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

    const record = this.energyRepo.create({
      tenantId,
      createdBy: userId,
      readingCode,
      projectId: resolvedProjectId,
      assetId: dto.assetId ?? null,
      readingDate: dto.readingDate,
      pumpRunningHours: dto.pumpRunningHours ?? null,
      energyKwh: dto.energyKwh ?? null,
      energyCost: dto.energyCost ?? null,
      waterPumpedKl: dto.waterPumpedKl ?? null,
      powerFactor: dto.powerFactor ?? null,
      pumpEfficiencyPct: dto.pumpEfficiencyPct ?? null,
      notes: dto.notes?.trim() ?? null,
    });

    const saved = await this.energyRepo.save(record);
    return this.toRecord(tenantId, saved);
  }

  async getSummary(user: JwtPayload, tenantId: string, projectId?: string, from?: string, to?: string) {
    const resolvedProjectId = projectId
      ? await this.scope.resolveProjectId(user, tenantId, projectId)
      : null;
    const { start, end } = this.resolvePeriod(from, to);
    const qb = this.energyRepo
      .createQueryBuilder('e')
      .where('e.tenant_id = :tenantId', { tenantId })
      .andWhere('e.reading_date >= :start', { start })
      .andWhere('e.reading_date <= :end', { end });
    await this.scope.scopeProjectQb(qb, user, tenantId, 'e', resolvedProjectId);

    const rows = await qb.getMany();
    const totals = this.aggregateRows(rows);

    return {
      period: { from: start, to: end },
      readingCount: rows.length,
      ...totals,
    };
  }

  async generateReport(
    user: JwtPayload,
    tenantId: string,
    type: OmEnergyReportType,
    filters: { projectId?: string; projectCode?: string; from?: string; to?: string },
  ) {
    const resolvedProjectId = await this.scope.resolveProjectId(user, tenantId, filters.projectId, filters.projectCode);
    const { start, end } = this.resolvePeriod(filters.from, filters.to);

    const qb = this.energyRepo
      .createQueryBuilder('e')
      .where('e.tenant_id = :tenantId', { tenantId })
      .andWhere('e.reading_date >= :start', { start })
      .andWhere('e.reading_date <= :end', { end });
    await this.scope.scopeProjectQb(qb, user, tenantId, 'e', resolvedProjectId);

    const rows = await qb.orderBy('e.reading_date', 'ASC').getMany();
    const enriched = await Promise.all(rows.map((r) => this.toRecord(tenantId, r)));

    let projectName: string | null = null;
    let projectCode: string | null = null;
    if (resolvedProjectId) {
      const project = await this.projectRepo.findOne({ where: { id: resolvedProjectId, tenantId } });
      projectName = project?.name ?? null;
      projectCode = project?.projectCode ?? null;
    }

    const base = {
      reportType: type,
      generatedAt: new Date().toISOString(),
      period: { from: start, to: end },
      projectId: resolvedProjectId,
      projectName,
      projectCode,
      readingCount: enriched.length,
    };

    if (!OM_ENERGY_REPORT_TYPES.some((r) => r.type === type)) {
      throw new BadRequestException('Invalid report type');
    }

    switch (type) {
      case 'daily_energy':
        return {
          ...base,
          title: 'Daily Energy Report',
          rows: this.groupByDate(enriched).map((g) => ({
            date: g.key,
            ...g.totals,
          })),
          totals: this.aggregateRecords(enriched),
        };
      case 'monthly_energy':
        return {
          ...base,
          title: 'Monthly Energy Report',
          rows: this.groupByMonth(enriched).map((g) => ({
            month: g.key,
            ...g.totals,
          })),
          totals: this.aggregateRecords(enriched),
        };
      case 'energy_cost_analysis':
        return {
          ...base,
          title: 'Energy Cost Analysis',
          totalCost: this.sum(enriched, 'energyCost'),
          totalKwh: this.sum(enriched, 'energyKwh'),
          costPerKwh: this.ratio(this.sum(enriched, 'energyCost'), this.sum(enriched, 'energyKwh')),
          dailyCost: this.groupByDate(enriched).map((g) => ({
            date: g.key,
            energyCost: g.totals.energyCost,
            energyKwh: g.totals.energyKwh,
            costPerKwh: this.ratio(g.totals.energyCost, g.totals.energyKwh),
          })),
        };
      case 'pump_efficiency':
        return {
          ...base,
          title: 'Pump Efficiency Report',
          rows: await this.efficiencyByAsset(tenantId, enriched),
          averageEfficiencyPct: this.avg(enriched, 'pumpEfficiencyPct'),
        };
      case 'kwh_per_kl':
        return {
          ...base,
          title: 'kWh per KL Water Pumped Report',
          averageKwhPerKl: this.ratio(this.sum(enriched, 'energyKwh'), this.sum(enriched, 'waterPumpedKl')),
          rows: enriched.map((r) => ({
            readingCode: r.readingCode,
            readingDate: r.readingDate,
            assetCode: r.assetCode,
            energyKwh: r.energyKwh,
            waterPumpedKl: r.waterPumpedKl,
            kwhPerKl: r.kwhPerKl,
          })),
        };
      default:
        throw new BadRequestException('Invalid report type');
    }
  }

  private async efficiencyByAsset(tenantId: string, records: ReadingRow[]) {
    const map = new Map<string, ReadingRow[]>();
    for (const r of records) {
      const key = r.assetId ?? 'scheme-level';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }

    const out = [];
    for (const [assetId, list] of map.entries()) {
      let assetCode = list[0]?.assetCode ?? 'Scheme-level';
      if (assetId !== 'scheme-level') {
        const asset = await this.assetRepo.findOne({ where: { id: assetId, tenantId } });
        assetCode = asset?.assetCode ?? assetCode;
      }
      out.push({
        assetId: assetId === 'scheme-level' ? null : assetId,
        assetCode,
        readingCount: list.length,
        avgPumpEfficiencyPct: this.avg(list, 'pumpEfficiencyPct'),
        avgPowerFactor: this.avg(list, 'powerFactor'),
        totalPumpHours: this.sum(list, 'pumpRunningHours'),
        totalEnergyKwh: this.sum(list, 'energyKwh'),
      });
    }
    return out;
  }

  private groupByDate(records: ReadingRow[]) {
    const map = new Map<string, ReadingRow[]>();
    for (const r of records) {
      const key = r.readingDate;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return [...map.entries()].map(([key, list]) => ({
      key,
      totals: this.aggregateRecords(list),
    }));
  }

  private groupByMonth(records: ReadingRow[]) {
    const map = new Map<string, ReadingRow[]>();
    for (const r of records) {
      const key = r.readingDate.slice(0, 7);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return [...map.entries()].map(([key, list]) => ({
      key,
      totals: this.aggregateRecords(list),
    }));
  }

  private aggregateRows(rows: OmEnergyReading[]) {
    return this.aggregateRecords(rows.map((r) => ({
      pumpRunningHours: r.pumpRunningHours != null ? Number(r.pumpRunningHours) : null,
      energyKwh: r.energyKwh != null ? Number(r.energyKwh) : null,
      energyCost: r.energyCost != null ? Number(r.energyCost) : null,
      waterPumpedKl: r.waterPumpedKl != null ? Number(r.waterPumpedKl) : null,
      powerFactor: r.powerFactor != null ? Number(r.powerFactor) : null,
      pumpEfficiencyPct: r.pumpEfficiencyPct != null ? Number(r.pumpEfficiencyPct) : null,
    })) as ReadingRow[]);
  }

  private aggregateRecords(records: Array<Partial<ReadingRow>>) {
    const energyKwh = this.sum(records as ReadingRow[], 'energyKwh');
    const waterPumpedKl = this.sum(records as ReadingRow[], 'waterPumpedKl');
    return {
      pumpRunningHours: this.sum(records as ReadingRow[], 'pumpRunningHours'),
      energyKwh,
      energyCost: this.sum(records as ReadingRow[], 'energyCost'),
      waterPumpedKl,
      avgPowerFactor: this.avg(records as ReadingRow[], 'powerFactor'),
      avgPumpEfficiencyPct: this.avg(records as ReadingRow[], 'pumpEfficiencyPct'),
      kwhPerKl: computeKwhPerKl(energyKwh, waterPumpedKl),
    };
  }

  private sum(records: ReadingRow[], field: keyof ReadingRow): number {
    return records.reduce((acc, r) => acc + (Number(r[field]) || 0), 0);
  }

  private avg(records: ReadingRow[], field: keyof ReadingRow): number | null {
    const vals = records.map((r) => r[field]).filter((v) => v != null && Number.isFinite(Number(v))) as number[];
    if (!vals.length) return null;
    return Math.round((vals.reduce((a, b) => a + Number(b), 0) / vals.length) * 100) / 100;
  }

  private ratio(numerator: number, denominator: number): number | null {
    if (!denominator) return null;
    return Math.round((numerator / denominator) * 1000) / 1000;
  }

  private resolvePeriod(from?: string, to?: string) {
    const now = new Date();
    const end = to?.trim() || now.toISOString().slice(0, 10);
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 30);
    const start = from?.trim() || startDate.toISOString().slice(0, 10);
    return { start, end };
  }

  private async toRecord(tenantId: string, row: OmEnergyReading): Promise<ReadingRow> {
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

    const energyKwh = row.energyKwh != null ? Number(row.energyKwh) : null;
    const waterPumpedKl = row.waterPumpedKl != null ? Number(row.waterPumpedKl) : null;

    return {
      id: row.id,
      readingCode: row.readingCode,
      readingDate: row.readingDate,
      projectId: row.projectId,
      projectName,
      projectCode,
      assetId: row.assetId,
      assetCode,
      pumpRunningHours: row.pumpRunningHours != null ? Number(row.pumpRunningHours) : null,
      energyKwh,
      energyCost: row.energyCost != null ? Number(row.energyCost) : null,
      waterPumpedKl,
      powerFactor: row.powerFactor != null ? Number(row.powerFactor) : null,
      pumpEfficiencyPct: row.pumpEfficiencyPct != null ? Number(row.pumpEfficiencyPct) : null,
      kwhPerKl: computeKwhPerKl(energyKwh, waterPumpedKl),
      notes: row.notes,
      createdAt: row.createdAt,
    };
  }
}
