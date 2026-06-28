import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../projects/entities/project.entity';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { OmDivisionScopeService } from './om-division-scope.service';
import {
  DEFAULT_SLA_TARGETS,
  mergeSlaTargets,
  OM_CONTRACT_KPIS,
  OM_CONTRACT_MONITORING_AREAS,
  OM_CONTRACT_REVIEW_RATINGS,
  OM_CONTRACT_WORKFLOW,
} from './constants/om-contract-catalog';
import {
  CreateContractReviewDto,
  CreateOmContractDto,
  RecordContractAttendanceDto,
  RecordContractKpiDto,
} from './dto/create-om-contract.dto';
import { OmBreakdownTicket } from './entities/om-breakdown-ticket.entity';
import { OmConsumerComplaint } from './entities/om-consumer-complaint.entity';
import { OmContractAttendance } from './entities/om-contract-attendance.entity';
import { OmContractKpiEntry } from './entities/om-contract-kpi-entry.entity';
import { OmContractReview } from './entities/om-contract-review.entity';
import { OmContract } from './entities/om-contract.entity';
import { OmEnergyReading } from './entities/om-energy-reading.entity';
import { OmPmSchedule } from './entities/om-pm-schedule.entity';
import { OmWaterQualityTest } from './entities/om-water-quality-test.entity';

type MetricResult = {
  value: number | null;
  target: number;
  compliant: boolean | null;
  unit: string;
  lowerIsBetter?: boolean;
};

@Injectable()
export class OmContractService {
  constructor(
    @InjectRepository(OmContract) private contractRepo: Repository<OmContract>,
    @InjectRepository(OmContractAttendance) private attendanceRepo: Repository<OmContractAttendance>,
    @InjectRepository(OmContractKpiEntry) private kpiRepo: Repository<OmContractKpiEntry>,
    @InjectRepository(OmContractReview) private reviewRepo: Repository<OmContractReview>,
    @InjectRepository(OmBreakdownTicket) private breakdownRepo: Repository<OmBreakdownTicket>,
    @InjectRepository(OmPmSchedule) private pmRepo: Repository<OmPmSchedule>,
    @InjectRepository(OmWaterQualityTest) private wqRepo: Repository<OmWaterQualityTest>,
    @InjectRepository(OmConsumerComplaint) private complaintRepo: Repository<OmConsumerComplaint>,
    @InjectRepository(OmEnergyReading) private energyRepo: Repository<OmEnergyReading>,
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    private scope: OmDivisionScopeService,
  ) {}

  getCatalog() {
    return {
      defaultSlaTargets: DEFAULT_SLA_TARGETS,
      monitoringAreas: OM_CONTRACT_MONITORING_AREAS,
      kpis: OM_CONTRACT_KPIS,
      workflow: OM_CONTRACT_WORKFLOW,
      reviewRatings: OM_CONTRACT_REVIEW_RATINGS,
    };
  }

  async listContracts(
    user: JwtPayload,
    tenantId: string,
    filters: { projectId?: string; projectCode?: string; status?: string },
  ) {
    const resolvedProjectId = await this.scope.resolveProjectId(user, tenantId, filters.projectId, filters.projectCode);
    const qb = this.contractRepo
      .createQueryBuilder('c')
      .where('c.tenant_id = :tenantId', { tenantId })
      .orderBy('c.created_at', 'DESC')
      .take(100);

    await this.scope.scopeProjectQb(qb, user, tenantId, 'c', resolvedProjectId);
    if (filters.status) qb.andWhere('c.status = :status', { status: filters.status });

    const rows = await qb.getMany();
    return Promise.all(rows.map((r) => this.toContractRecord(tenantId, r)));
  }

  async getContract(user: JwtPayload, tenantId: string, id: string) {
    const row = await this.contractRepo.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Contract not found');
    await this.scope.assertProjectAccess(user, row.projectId, tenantId);
    return this.toContractRecord(tenantId, row);
  }

  async createContract(user: JwtPayload, tenantId: string, userId: string, dto: CreateOmContractDto) {
    const resolvedProjectId = await this.scope.resolveProjectId(user, tenantId, dto.projectId, dto.projectCode);
    const count = await this.contractRepo.count({ where: { tenantId } });
    const contractCode = `OMC-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

    const record = this.contractRepo.create({
      tenantId,
      createdBy: userId,
      contractCode,
      contractorName: dto.contractorName.trim(),
      contractorContact: dto.contractorContact?.trim() ?? null,
      projectId: resolvedProjectId,
      startDate: dto.startDate,
      endDate: dto.endDate ?? null,
      slaTargets: mergeSlaTargets(dto.slaTargets),
      notes: dto.notes?.trim() ?? null,
      status: 'active',
    });

    const saved = await this.contractRepo.save(record);
    return this.toContractRecord(tenantId, saved);
  }

  async listAttendance(user: JwtPayload, tenantId: string, contractId: string) {
    await this.ensureContract(user, tenantId, contractId);
    const rows = await this.attendanceRepo.find({
      where: { tenantId, contractId },
      order: { attendanceDate: 'DESC' },
      take: 90,
    });
    return rows.map((r) => ({
      id: r.id,
      attendanceDate: r.attendanceDate,
      staffRequired: r.staffRequired,
      staffPresent: r.staffPresent,
      attendancePct: r.staffRequired > 0
        ? Math.round((r.staffPresent / r.staffRequired) * 10000) / 100
        : null,
      notes: r.notes,
      createdAt: r.createdAt,
    }));
  }

  async recordAttendance(
    user: JwtPayload,
    tenantId: string,
    userId: string,
    contractId: string,
    dto: RecordContractAttendanceDto,
  ) {
    await this.ensureContract(user, tenantId, contractId);
    if (dto.staffPresent > dto.staffRequired) {
      throw new BadRequestException('Staff present cannot exceed staff required');
    }

    const existing = await this.attendanceRepo.findOne({
      where: { tenantId, contractId, attendanceDate: dto.attendanceDate },
    });

    const record = existing ?? this.attendanceRepo.create({ tenantId, contractId });
    record.attendanceDate = dto.attendanceDate;
    record.staffRequired = dto.staffRequired;
    record.staffPresent = dto.staffPresent;
    record.notes = dto.notes?.trim() ?? null;
    record.recordedBy = userId;

    const saved = await this.attendanceRepo.save(record);
    return {
      id: saved.id,
      attendanceDate: saved.attendanceDate,
      staffRequired: saved.staffRequired,
      staffPresent: saved.staffPresent,
      attendancePct: saved.staffRequired > 0
        ? Math.round((saved.staffPresent / saved.staffRequired) * 10000) / 100
        : null,
      notes: saved.notes,
    };
  }

  async listKpiEntries(user: JwtPayload, tenantId: string, contractId: string) {
    await this.ensureContract(user, tenantId, contractId);
    const rows = await this.kpiRepo.find({
      where: { tenantId, contractId },
      order: { periodMonth: 'DESC' },
      take: 24,
    });
    return rows.map((r) => ({
      id: r.id,
      periodMonth: r.periodMonth,
      waterSupplyHoursPerDay: r.waterSupplyHoursPerDay != null ? Number(r.waterSupplyHoursPerDay) : null,
      pumpAvailabilityPct: r.pumpAvailabilityPct != null ? Number(r.pumpAvailabilityPct) : null,
      nrwPct: r.nrwPct != null ? Number(r.nrwPct) : null,
      notes: r.notes,
      createdAt: r.createdAt,
    }));
  }

  async recordKpiEntry(user: JwtPayload, tenantId: string, userId: string, contractId: string, dto: RecordContractKpiDto) {
    await this.ensureContract(user, tenantId, contractId);
    const periodMonth = dto.periodMonth.slice(0, 7) + '-01';

    const existing = await this.kpiRepo.findOne({
      where: { tenantId, contractId, periodMonth },
    });

    const record = existing ?? this.kpiRepo.create({ tenantId, contractId, periodMonth });
    if (dto.waterSupplyHoursPerDay != null) record.waterSupplyHoursPerDay = dto.waterSupplyHoursPerDay;
    if (dto.pumpAvailabilityPct != null) record.pumpAvailabilityPct = dto.pumpAvailabilityPct;
    if (dto.nrwPct != null) record.nrwPct = dto.nrwPct;
    record.notes = dto.notes?.trim() ?? record.notes;
    record.recordedBy = userId;

    const saved = await this.kpiRepo.save(record);
    return {
      id: saved.id,
      periodMonth: saved.periodMonth,
      waterSupplyHoursPerDay: saved.waterSupplyHoursPerDay != null ? Number(saved.waterSupplyHoursPerDay) : null,
      pumpAvailabilityPct: saved.pumpAvailabilityPct != null ? Number(saved.pumpAvailabilityPct) : null,
      nrwPct: saved.nrwPct != null ? Number(saved.nrwPct) : null,
      notes: saved.notes,
    };
  }

  async listReviews(user: JwtPayload, tenantId: string, contractId: string) {
    await this.ensureContract(user, tenantId, contractId);
    const rows = await this.reviewRepo.find({
      where: { tenantId, contractId },
      order: { reviewDate: 'DESC' },
      take: 20,
    });
    return rows.map((r) => ({
      id: r.id,
      reviewDate: r.reviewDate,
      overallRating: r.overallRating,
      overallRatingLabel: OM_CONTRACT_REVIEW_RATINGS.find((x) => x.code === r.overallRating)?.label ?? r.overallRating,
      slaCompliancePct: r.slaCompliancePct != null ? Number(r.slaCompliancePct) : null,
      notes: r.notes,
      createdAt: r.createdAt,
    }));
  }

  async createReview(user: JwtPayload, tenantId: string, userId: string, contractId: string, dto: CreateContractReviewDto) {
    const contract = await this.ensureContract(user, tenantId, contractId);
    const performance = await this.getPerformance(user, tenantId, contractId);

    const record = this.reviewRepo.create({
      tenantId,
      contractId,
      reviewDate: dto.reviewDate,
      overallRating: dto.overallRating,
      slaCompliancePct: dto.slaCompliancePct ?? performance.overallSlaCompliancePct,
      notes: dto.notes?.trim() ?? null,
      reviewedBy: userId,
    });

    const saved = await this.reviewRepo.save(record);
    contract.status = 'under_review';
    await this.contractRepo.save(contract);

    return {
      id: saved.id,
      reviewDate: saved.reviewDate,
      overallRating: saved.overallRating,
      slaCompliancePct: saved.slaCompliancePct != null ? Number(saved.slaCompliancePct) : null,
      notes: saved.notes,
      performance,
    };
  }

  async getPerformance(user: JwtPayload, tenantId: string, contractId: string) {
    const contract = await this.ensureContract(user, tenantId, contractId);
    const sla = mergeSlaTargets(contract.slaTargets);
    const projectId = contract.projectId;

    const [
      attendancePct,
      breakdownResponseMins,
      maintenanceCompliancePct,
      waterQualityCompliancePct,
      complaintResolutionMins,
      energyKwhPerKl,
      latestKpi,
    ] = await Promise.all([
      this.computeAttendancePct(tenantId, contractId),
      this.computeBreakdownResponseMins(tenantId, projectId),
      this.computeMaintenanceCompliancePct(tenantId, projectId),
      this.computeWaterQualityCompliancePct(tenantId, projectId),
      this.computeComplaintResolutionMins(tenantId, projectId),
      this.computeEnergyKwhPerKl(tenantId, projectId),
      this.kpiRepo.findOne({
        where: { tenantId, contractId },
        order: { periodMonth: 'DESC' },
      }),
    ]);

    const waterSupplyHours = latestKpi?.waterSupplyHoursPerDay != null
      ? Number(latestKpi.waterSupplyHoursPerDay)
      : null;
    const pumpAvailability = latestKpi?.pumpAvailabilityPct != null
      ? Number(latestKpi.pumpAvailabilityPct)
      : null;
    const nrwPct = latestKpi?.nrwPct != null ? Number(latestKpi.nrwPct) : null;

    const monitoring = {
      attendance: this.buildMetric(attendancePct, sla.attendancePct, '%'),
      breakdownResponseTime: this.buildMetric(breakdownResponseMins, sla.breakdownResponseMins, 'mins', true),
      maintenanceCompliance: this.buildMetric(maintenanceCompliancePct, sla.maintenanceCompliancePct, '%'),
      waterQualityCompliance: this.buildMetric(waterQualityCompliancePct, sla.waterQualityCompliancePct, '%'),
    };

    const kpis = {
      waterSupplyHours: this.buildMetric(waterSupplyHours, sla.waterSupplyHoursPerDay, 'hrs/day'),
      pumpAvailability: this.buildMetric(pumpAvailability, sla.pumpAvailabilityPct, '%'),
      complaintResolutionTime: this.buildMetric(complaintResolutionMins, sla.complaintResolutionMins, 'mins', true),
      waterQualityCompliance: this.buildMetric(waterQualityCompliancePct, sla.waterQualityCompliancePct, '%'),
      nrw: this.buildMetric(nrwPct, sla.nrwPctMax, '%', true),
      energyKwhPerKl: this.buildMetric(energyKwhPerKl, sla.energyKwhPerKlMax, 'kWh/KL', true),
    };

    const allMetrics = [
      monitoring.attendance,
      monitoring.breakdownResponseTime,
      monitoring.maintenanceCompliance,
      monitoring.waterQualityCompliance,
      kpis.waterSupplyHours,
      kpis.pumpAvailability,
      kpis.complaintResolutionTime,
      kpis.nrw,
      kpis.energyKwhPerKl,
    ];

    const withData = allMetrics.filter((m) => m.value != null);
    const met = withData.filter((m) => m.compliant === true);
    const overallSlaCompliancePct = withData.length > 0
      ? Math.round((met.length / withData.length) * 10000) / 100
      : null;

    const monitoringWithSla = {
      ...monitoring,
      slaCompliance: {
        value: overallSlaCompliancePct,
        target: 100,
        compliant: overallSlaCompliancePct != null ? overallSlaCompliancePct >= 80 : null,
        unit: '%',
      },
    };

    return {
      contractId: contract.id,
      contractCode: contract.contractCode,
      contractorName: contract.contractorName,
      projectId: contract.projectId,
      slaTargets: sla,
      monitoring: monitoringWithSla,
      kpis,
      overallSlaCompliancePct,
      metricsMet: met.length,
      metricsTotal: withData.length,
    };
  }

  async getSummary(user: JwtPayload, tenantId: string, projectId?: string) {
    const resolvedProjectId = projectId
      ? await this.scope.resolveProjectId(user, tenantId, projectId)
      : null;
    const base = this.contractRepo
      .createQueryBuilder('c')
      .where('c.tenant_id = :tenantId', { tenantId });
    await this.scope.scopeProjectQb(base, user, tenantId, 'c', resolvedProjectId);

    const [activeContracts, underReview, total] = await Promise.all([
      base.clone().andWhere('c.status = :s', { s: 'active' }).getCount(),
      base.clone().andWhere('c.status = :s', { s: 'under_review' }).getCount(),
      base.clone().getCount(),
    ]);

    const contracts = await base.clone().andWhere('c.status IN (:...statuses)', {
      statuses: ['active', 'under_review'],
    }).getMany();

    const performances = await Promise.all(
      contracts.slice(0, 10).map((c) => this.getPerformance(user, tenantId, c.id)),
    );

    const withSla = performances.filter((p) => p.overallSlaCompliancePct != null);
    const avgSlaCompliancePct = withSla.length > 0
      ? Math.round(withSla.reduce((s, p) => s + (p.overallSlaCompliancePct ?? 0), 0) / withSla.length * 100) / 100
      : null;
    const contractsBelowSla = withSla.filter((p) => (p.overallSlaCompliancePct ?? 0) < 80).length;

    return {
      activeContracts,
      underReview,
      total,
      avgSlaCompliancePct,
      contractsBelowSla,
    };
  }

  private buildMetric(
    value: number | null,
    target: number,
    unit: string,
    lowerIsBetter = false,
  ): MetricResult {
    if (value == null) {
      return { value: null, target, compliant: null, unit, lowerIsBetter };
    }
    const compliant = lowerIsBetter ? value <= target : value >= target;
    return {
      value: Math.round(value * 100) / 100,
      target,
      compliant,
      unit,
      lowerIsBetter,
    };
  }

  private async computeAttendancePct(tenantId: string, contractId: string): Promise<number | null> {
    const since = this.daysAgo(30);
    const rows = await this.attendanceRepo
      .createQueryBuilder('a')
      .where('a.tenant_id = :tenantId', { tenantId })
      .andWhere('a.contract_id = :contractId', { contractId })
      .andWhere('a.attendance_date >= :since', { since })
      .getMany();

    if (!rows.length) return null;
    const totalRequired = rows.reduce((s, r) => s + r.staffRequired, 0);
    const totalPresent = rows.reduce((s, r) => s + r.staffPresent, 0);
    if (totalRequired === 0) return null;
    return (totalPresent / totalRequired) * 100;
  }

  private async computeBreakdownResponseMins(tenantId: string, projectId: string | null): Promise<number | null> {
    const qb = this.breakdownRepo
      .createQueryBuilder('b')
      .where('b.tenant_id = :tenantId', { tenantId })
      .andWhere('b.response_time_mins IS NOT NULL');
    if (projectId) qb.andWhere('b.project_id = :projectId', { projectId });

    const result = await qb.select('AVG(b.response_time_mins)', 'avg').getRawOne<{ avg: string | null }>();
    return result?.avg ? Number(result.avg) : null;
  }

  private async computeMaintenanceCompliancePct(tenantId: string, projectId: string | null): Promise<number | null> {
    const qb = this.pmRepo.createQueryBuilder('p').where('p.tenant_id = :tenantId', { tenantId });
    if (projectId) qb.andWhere('p.project_id = :projectId', { projectId });

    const rows = await qb.getMany();
    if (!rows.length) return null;

    const today = this.formatDate(new Date());
    let completed = 0;
    let overdue = 0;
    for (const row of rows) {
      if (row.status === 'completed') completed += 1;
      else if (row.dueDate < today) overdue += 1;
    }
    const denominator = completed + overdue;
    if (denominator === 0) return null;
    return (completed / denominator) * 100;
  }

  private async computeWaterQualityCompliancePct(tenantId: string, projectId: string | null): Promise<number | null> {
    const qb = this.wqRepo.createQueryBuilder('w').where('w.tenant_id = :tenantId', { tenantId });
    if (projectId) qb.andWhere('w.project_id = :projectId', { projectId });

    const total = await qb.getCount();
    if (total === 0) return null;
    const compliant = await qb.clone().andWhere('w.is_compliant = true').getCount();
    return (compliant / total) * 100;
  }

  private async computeComplaintResolutionMins(tenantId: string, projectId: string | null): Promise<number | null> {
    const qb = this.complaintRepo
      .createQueryBuilder('c')
      .where('c.tenant_id = :tenantId', { tenantId })
      .andWhere('c.status = :closed', { closed: 'closed' })
      .andWhere('c.closed_at IS NOT NULL');
    if (projectId) qb.andWhere('c.project_id = :projectId', { projectId });

    const result = await qb
      .select('AVG(EXTRACT(EPOCH FROM (c.closed_at - c.created_at)) / 60)', 'avg')
      .getRawOne<{ avg: string | null }>();
    return result?.avg ? Number(result.avg) : null;
  }

  private async computeEnergyKwhPerKl(tenantId: string, projectId: string | null): Promise<number | null> {
    const since = this.daysAgo(90);
    const qb = this.energyRepo
      .createQueryBuilder('e')
      .where('e.tenant_id = :tenantId', { tenantId })
      .andWhere('e.reading_date >= :since', { since });
    if (projectId) qb.andWhere('e.project_id = :projectId', { projectId });

    const rows = await qb.getMany();
    if (!rows.length) return null;

    const energyKwh = rows.reduce((s, r) => s + (r.energyKwh != null ? Number(r.energyKwh) : 0), 0);
    const waterKl = rows.reduce((s, r) => s + (r.waterPumpedKl != null ? Number(r.waterPumpedKl) : 0), 0);
    if (waterKl <= 0) return null;
    return energyKwh / waterKl;
  }

  private async ensureContract(user: JwtPayload, tenantId: string, id: string): Promise<OmContract> {
    const row = await this.contractRepo.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Contract not found');
    await this.scope.assertProjectAccess(user, row.projectId, tenantId);
    return row;
  }

  private async toContractRecord(tenantId: string, row: OmContract) {
    let projectName: string | null = null;
    let projectCode: string | null = null;
    if (row.projectId) {
      const project = await this.projectRepo.findOne({ where: { id: row.projectId, tenantId } });
      projectName = project?.name ?? null;
      projectCode = project?.projectCode ?? null;
    }

    return {
      id: row.id,
      contractCode: row.contractCode,
      contractorName: row.contractorName,
      contractorContact: row.contractorContact,
      contractType: row.contractType,
      projectId: row.projectId,
      projectName,
      projectCode,
      startDate: row.startDate,
      endDate: row.endDate,
      status: row.status,
      slaTargets: mergeSlaTargets(row.slaTargets),
      notes: row.notes,
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

  private daysAgo(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return this.formatDate(d);
  }
}
