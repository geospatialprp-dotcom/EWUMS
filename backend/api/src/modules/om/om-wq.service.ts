import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asset } from '../assets/entities/asset.entity';
import { Project } from '../projects/entities/project.entity';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { OmDivisionScopeService } from './om-division-scope.service';
import {
  evaluateCompliance,
  getNextWqStatus,
  getWqSamplePointLabel,
  normalizeWqStatus,
  OM_WQ_PARAMETER_GROUPS,
  OM_WQ_SAMPLE_POINTS,
  OM_WQ_WORKFLOW,
  type OmWqStatus,
} from './constants/om-wq-catalog';
import { AdvanceOmWqTestDto, CreateOmWqTestDto } from './dto/create-om-wq-test.dto';
import { OmWaterQualityTest } from './entities/om-water-quality-test.entity';

@Injectable()
export class OmWqService {
  constructor(
    @InjectRepository(OmWaterQualityTest) private wqRepo: Repository<OmWaterQualityTest>,
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    @InjectRepository(Asset) private assetRepo: Repository<Asset>,
    private scope: OmDivisionScopeService,
  ) {}

  getCatalog() {
    return {
      samplePoints: OM_WQ_SAMPLE_POINTS,
      parameterGroups: OM_WQ_PARAMETER_GROUPS,
      workflow: OM_WQ_WORKFLOW,
    };
  }

  async listTests(
    user: JwtPayload,
    tenantId: string,
    filters: {
      projectId?: string;
      projectCode?: string;
      samplePoint?: string;
      status?: string;
      compliantOnly?: string;
      alertsOnly?: string;
    },
  ) {
    const resolvedProjectId = await this.scope.resolveProjectId(user, tenantId, filters.projectId, filters.projectCode);
    const qb = this.wqRepo
      .createQueryBuilder('w')
      .where('w.tenant_id = :tenantId', { tenantId })
      .orderBy('w.sample_date', 'DESC')
      .take(200);

    await this.scope.scopeProjectQb(qb, user, tenantId, 'w', resolvedProjectId);
    if (filters.samplePoint) qb.andWhere('w.sample_point = :samplePoint', { samplePoint: filters.samplePoint });
    if (filters.status) qb.andWhere('w.status = :status', { status: filters.status });
    if (filters.compliantOnly === 'false') qb.andWhere('w.is_compliant = false');
    if (filters.compliantOnly === 'true') qb.andWhere('w.is_compliant = true');
    if (filters.alertsOnly === 'true') {
      qb.andWhere('w.is_compliant = false').andWhere('w.status != :closed', { closed: 'closed' });
    }

    const rows = await qb.getMany();
    return Promise.all(rows.map((r) => this.toRecord(tenantId, r)));
  }

  async getTest(user: JwtPayload, tenantId: string, id: string) {
    const row = await this.wqRepo.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Water quality test not found');
    await this.scope.assertProjectAccess(user, row.projectId, tenantId);
    return this.toRecord(tenantId, row);
  }

  async createTest(user: JwtPayload, tenantId: string, userId: string, dto: CreateOmWqTestDto) {
    const resolvedProjectId = await this.scope.resolveProjectId(user, tenantId, dto.projectId, dto.projectCode);
    if (dto.assetId) {
      const asset = await this.assetRepo.findOne({ where: { id: dto.assetId, tenantId } });
      if (!asset) throw new BadRequestException('Asset not found');
    }
    this.validateCoordinates(dto.latitude, dto.longitude);

    const count = await this.wqRepo.count({ where: { tenantId } });
    const sampleCode = `WQ-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;
    const now = new Date();

    const record = this.wqRepo.create({
      tenantId,
      createdBy: userId,
      sampleCode,
      samplePoint: dto.samplePoint,
      sampleDate: dto.sampleDate ? new Date(dto.sampleDate) : now,
      projectId: resolvedProjectId,
      assetId: dto.assetId ?? null,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      resultNotes: dto.sampleLabel?.trim() || dto.resultNotes?.trim() || null,
      status: 'sample_collection',
      collectedAt: now,
      parameters: {},
      nonComplianceDetails: [],
    });

    const saved = await this.wqRepo.save(record);
    return this.toRecord(tenantId, saved);
  }

  async advanceTest(user: JwtPayload, tenantId: string, id: string, dto: AdvanceOmWqTestDto) {
    const row = await this.wqRepo.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Water quality test not found');
    await this.scope.assertProjectAccess(user, row.projectId, tenantId);

    const current = normalizeWqStatus(row.status);
    if (current === 'closed') throw new BadRequestException('Sample workflow is already closed');

    const now = new Date();

    if (current === 'sample_collection') {
      if (!dto.labName?.trim()) throw new BadRequestException('Laboratory name is required');
      row.labName = dto.labName.trim();
    }

    if (current === 'laboratory_testing') {
      if (!dto.parameters || !Object.keys(dto.parameters).length) {
        throw new BadRequestException('Test parameters are required');
      }
      row.parameters = { ...row.parameters, ...dto.parameters };
      const evaluation = evaluateCompliance(row.parameters);
      row.isCompliant = evaluation.isCompliant;
      row.nonComplianceDetails = evaluation.failures;
      row.labTestedAt = now;
      row.resultUploadedAt = now;
      if (dto.resultNotes?.trim()) row.resultNotes = dto.resultNotes.trim();
    }

    if (current === 'result_upload') {
      if (dto.latitude != null || dto.longitude != null) {
        this.validateCoordinates(dto.latitude, dto.longitude);
        row.latitude = dto.latitude ?? row.latitude;
        row.longitude = dto.longitude ?? row.longitude;
      }
      if (row.latitude == null || row.longitude == null) {
        throw new BadRequestException('GIS coordinates are required for mapping');
      }
      row.gisMappedAt = now;
    }

    if (current === 'gis_mapping') {
      row.verifiedAt = now;
    }

    if (current === 'corrective_action') {
      if (!dto.correctiveAction?.trim()) {
        throw new BadRequestException('Corrective action is required for non-compliant samples');
      }
      row.correctiveAction = dto.correctiveAction.trim();
      row.closedAt = now;
    }

    const next = getNextWqStatus(current, row.isCompliant);
    if (!next) throw new BadRequestException('Sample cannot be advanced further');

    if (next === 'closed' && current !== 'corrective_action') {
      row.closedAt = now;
    }

    row.status = next;
    const saved = await this.wqRepo.save(row);
    return this.toRecord(tenantId, saved);
  }

  async countAlerts(tenantId: string): Promise<number> {
    return this.wqRepo
      .createQueryBuilder('w')
      .where('w.tenant_id = :tenantId', { tenantId })
      .andWhere('w.is_compliant = false')
      .andWhere('w.status != :closed', { closed: 'closed' })
      .getCount();
  }

  async getSummary(user: JwtPayload, tenantId: string, projectId?: string) {
    const resolvedProjectId = projectId
      ? await this.scope.resolveProjectId(user, tenantId, projectId)
      : null;
    const base = this.wqRepo
      .createQueryBuilder('w')
      .where('w.tenant_id = :tenantId', { tenantId });
    await this.scope.scopeProjectQb(base, user, tenantId, 'w', resolvedProjectId);

    const [total, compliant, nonCompliant, alerts, openWorkflow] = await Promise.all([
      base.clone().getCount(),
      base.clone().andWhere('w.is_compliant = true').getCount(),
      base.clone().andWhere('w.is_compliant = false').getCount(),
      base.clone()
        .andWhere('w.is_compliant = false')
        .andWhere('w.status != :closed', { closed: 'closed' })
        .getCount(),
      base.clone().andWhere('w.status != :closed', { closed: 'closed' }).getCount(),
    ]);

    return { total, compliant, nonCompliant, alerts, openWorkflow, waterQualityAlerts: alerts };
  }

  private validateCoordinates(latitude?: number, longitude?: number) {
    if (latitude == null && longitude == null) return;
    if (latitude == null || longitude == null) {
      throw new BadRequestException('Provide both latitude and longitude for GIS mapping');
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      throw new BadRequestException('Invalid latitude or longitude');
    }
  }

  private async toRecord(tenantId: string, row: OmWaterQualityTest) {
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

    const status = normalizeWqStatus(row.status);
    const workflowStep = OM_WQ_WORKFLOW.findIndex((s) => s.status === status);

    return {
      id: row.id,
      sampleCode: row.sampleCode,
      samplePoint: row.samplePoint,
      samplePointLabel: getWqSamplePointLabel(row.samplePoint),
      sampleDate: row.sampleDate,
      projectId: row.projectId,
      projectName,
      projectCode,
      assetId: row.assetId,
      assetCode,
      parameters: row.parameters ?? {},
      isCompliant: row.isCompliant,
      labName: row.labName,
      resultNotes: row.resultNotes,
      latitude: row.latitude,
      longitude: row.longitude,
      correctiveAction: row.correctiveAction,
      status,
      workflowStep,
      nextStatus: getNextWqStatus(status, row.isCompliant),
      nonComplianceDetails: row.nonComplianceDetails ?? [],
      collectedAt: row.collectedAt,
      labTestedAt: row.labTestedAt,
      resultUploadedAt: row.resultUploadedAt,
      gisMappedAt: row.gisMappedAt,
      verifiedAt: row.verifiedAt,
      closedAt: row.closedAt,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      alert: row.isCompliant === false && status !== 'closed',
    };
  }
}
