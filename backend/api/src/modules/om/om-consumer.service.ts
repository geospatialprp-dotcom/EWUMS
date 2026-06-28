import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../projects/entities/project.entity';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { OmDivisionScopeService } from './om-division-scope.service';
import {
  getConnectionStatusLabel,
  getConsumerServiceLabel,
  OM_CONSUMER_SERVICE_TYPES,
  type OmConsumerServiceType,
} from './constants/om-consumer-catalog';
import { CreateConsumerServiceRequestDto, CreateOmConsumerDto } from './dto/create-om-consumer.dto';
import { OmConsumerServiceRequest } from './entities/om-consumer-service-request.entity';
import { OmConsumer } from './entities/om-consumer.entity';

@Injectable()
export class OmConsumerService {
  constructor(
    @InjectRepository(OmConsumer) private consumerRepo: Repository<OmConsumer>,
    @InjectRepository(OmConsumerServiceRequest) private requestRepo: Repository<OmConsumerServiceRequest>,
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    private scope: OmDivisionScopeService,
  ) {}

  getCatalog() {
    return { serviceTypes: OM_CONSUMER_SERVICE_TYPES };
  }

  async listConsumers(
    user: JwtPayload,
    tenantId: string,
    filters: { projectId?: string; projectCode?: string; village?: string; status?: string },
  ) {
    const resolvedProjectId = await this.scope.resolveProjectId(user, tenantId, filters.projectId, filters.projectCode);
    const qb = this.consumerRepo
      .createQueryBuilder('c')
      .where('c.tenant_id = :tenantId', { tenantId })
      .orderBy('c.consumer_code', 'ASC')
      .take(500);

    if (resolvedProjectId && filters.status === 'pending') {
      qb.andWhere('(c.project_id = :projectId OR c.project_id IS NULL)', { projectId: resolvedProjectId });
    } else {
      await this.scope.scopeProjectQb(qb, user, tenantId, 'c', resolvedProjectId);
    }
    if (filters.village?.trim()) qb.andWhere('c.village ILIKE :village', { village: `%${filters.village.trim()}%` });
    if (filters.status) qb.andWhere('c.connection_status = :status', { status: filters.status });

    const rows = await qb.getMany();
    return Promise.all(rows.map((r) => this.toConsumerRecord(tenantId, r)));
  }

  async getConsumer(user: JwtPayload, tenantId: string, id: string) {
    const row = await this.consumerRepo.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Consumer not found');
    await this.scope.assertProjectAccess(user, row.projectId, tenantId);
    const requests = await this.requestRepo.find({
      where: { tenantId, consumerId: id },
      order: { createdAt: 'DESC' },
      take: 20,
    });
    const consumer = await this.toConsumerRecord(tenantId, row);
    return {
      ...consumer,
      serviceHistory: requests.map((r) => this.toRequestRecord(r)),
    };
  }

  async registerConsumer(user: JwtPayload, tenantId: string, userId: string, dto: CreateOmConsumerDto) {
    const resolvedProjectId = await this.scope.resolveProjectId(user, tenantId, dto.projectId, dto.projectCode);
    this.validateCoordinates(dto.latitude, dto.longitude);

    const fhtc = dto.fhtcNumber.trim();
    const existing = await this.consumerRepo.findOne({ where: { tenantId, fhtcNumber: fhtc } });
    if (existing) throw new BadRequestException('FHTC number already registered');

    const count = await this.consumerRepo.count({ where: { tenantId } });
    const consumerCode = `CON-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

    const record = this.consumerRepo.create({
      tenantId,
      createdBy: userId,
      consumerCode,
      projectId: resolvedProjectId,
      fhtcNumber: fhtc,
      consumerName: dto.consumerName?.trim() ?? null,
      mobile: dto.mobile?.trim() ?? null,
      village: dto.village?.trim() ?? null,
      ward: dto.ward?.trim() ?? null,
      consumerCategory: dto.consumerCategory ?? null,
      aadhaarLast4: dto.aadhaarLast4?.trim() ?? null,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      meterNumber: dto.meterNumber?.trim() ?? null,
      meterType: dto.meterType?.trim() ?? null,
      meterInstallDate: dto.meterInstallDate ?? null,
      connectionStatus: dto.connectionStatus ?? 'active',
      notes: dto.notes?.trim() ?? null,
    });

    const saved = await this.consumerRepo.save(record);
    return this.toConsumerRecord(tenantId, saved);
  }

  async createServiceRequest(
    user: JwtPayload,
    tenantId: string,
    userId: string | null,
    consumerId: string,
    dto: CreateConsumerServiceRequestDto,
  ) {
    const consumer = await this.consumerRepo.findOne({ where: { id: consumerId, tenantId } });
    if (!consumer) throw new NotFoundException('Consumer not found');
    await this.scope.assertProjectAccess(user, consumer.projectId, tenantId);

    const requestType = dto.requestType as OmConsumerServiceType;
    this.validateServiceRequest(consumer, requestType);

    const count = await this.requestRepo.count({ where: { tenantId } });
    const requestNo = `CSR-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

    const details: Record<string, unknown> = { ...(dto.details ?? {}) };
    if (dto.newMeterNumber) details.newMeterNumber = dto.newMeterNumber.trim();
    if (dto.newMeterType) details.newMeterType = dto.newMeterType.trim();
    if (dto.newOwnerName) details.newOwnerName = dto.newOwnerName.trim();
    if (dto.newMobile) details.newMobile = dto.newMobile.trim();

    const request = this.requestRepo.create({
      tenantId,
      consumerId,
      requestNo,
      requestType,
      status: 'requested',
      details,
      notes: dto.notes?.trim() ?? null,
      createdBy: userId,
    });

    const saved = await this.requestRepo.save(request);
    return this.toRequestRecord(saved);
  }

  async completeServiceRequest(user: JwtPayload, tenantId: string, consumerId: string, requestId: string) {
    const consumer = await this.consumerRepo.findOne({ where: { id: consumerId, tenantId } });
    if (!consumer) throw new NotFoundException('Consumer not found');
    await this.scope.assertProjectAccess(user, consumer.projectId, tenantId);

    const request = await this.requestRepo.findOne({
      where: { id: requestId, consumerId, tenantId },
    });
    if (!request) throw new NotFoundException('Service request not found');
    if (request.status === 'completed') throw new BadRequestException('Request already completed');

    const type = request.requestType as OmConsumerServiceType;
    const details = request.details ?? {};

    if (type === 'new_connection') consumer.connectionStatus = 'active';
    if (type === 'disconnection') consumer.connectionStatus = 'disconnected';
    if (type === 'reconnection') consumer.connectionStatus = 'active';
    if (type === 'meter_replacement') {
      if (details.newMeterNumber) consumer.meterNumber = String(details.newMeterNumber);
      if (details.newMeterType) consumer.meterType = String(details.newMeterType);
      consumer.meterInstallDate = new Date().toISOString().slice(0, 10);
    }
    if (type === 'ownership_transfer') {
      if (details.newOwnerName) consumer.consumerName = String(details.newOwnerName);
      if (details.newMobile) consumer.mobile = String(details.newMobile);
    }

    request.status = 'completed';
    request.completedAt = new Date();

    await this.consumerRepo.save(consumer);
    const saved = await this.requestRepo.save(request);
    return {
      consumer: await this.toConsumerRecord(tenantId, consumer),
      request: this.toRequestRecord(saved),
    };
  }

  async listServiceRequests(
    user: JwtPayload,
    tenantId: string,
    filters: {
      consumerId?: string;
      status?: string;
      requestType?: string;
      projectId?: string;
      projectCode?: string;
    },
  ) {
    const resolvedProjectId = await this.scope.resolveProjectId(user, tenantId, filters.projectId, filters.projectCode);
    const qb = this.requestRepo
      .createQueryBuilder('r')
      .where('r.tenant_id = :tenantId', { tenantId })
      .orderBy('r.created_at', 'DESC')
      .take(200);
    if (filters.consumerId) qb.andWhere('r.consumer_id = :consumerId', { consumerId: filters.consumerId });
    if (filters.status) qb.andWhere('r.status = :status', { status: filters.status });
    if (filters.requestType) qb.andWhere('r.request_type = :requestType', { requestType: filters.requestType });

    if (resolvedProjectId) {
      const consumerIds = await this.consumerIdsForProjectScope(tenantId, resolvedProjectId);
      if (consumerIds.length === 0) return [];
      qb.andWhere('r.consumer_id IN (:...consumerIds)', { consumerIds });
    }

    const rows = await qb.getMany();
    if (filters.consumerId && !resolvedProjectId && !filters.requestType) {
      return rows.map((r) => this.toRequestRecord(r));
    }
    return this.enrichServiceRequests(tenantId, rows);
  }

  private async consumerIdsForProjectScope(tenantId: string, projectId: string): Promise<string[]> {
    const rows = await this.consumerRepo
      .createQueryBuilder('c')
      .select('c.id', 'id')
      .where('c.tenant_id = :tenantId', { tenantId })
      .andWhere('(c.project_id = :projectId OR c.project_id IS NULL)', { projectId })
      .getRawMany<{ id: string }>();
    return rows.map((r) => r.id);
  }

  private async enrichServiceRequests(tenantId: string, rows: OmConsumerServiceRequest[]) {
    return Promise.all(
      rows.map(async (r) => {
        const consumer = await this.consumerRepo.findOne({ where: { id: r.consumerId, tenantId } });
        const details = (r.details ?? {}) as Record<string, unknown>;
        return {
          ...this.toRequestRecord(r),
          consumerId: r.consumerId,
          fhtcNumber: consumer?.fhtcNumber ?? null,
          consumerCode: consumer?.consumerCode ?? null,
          consumerName: consumer?.consumerName ?? null,
          mobile: consumer?.mobile ?? null,
          village: consumer?.village ?? null,
          connectionStatus: consumer?.connectionStatus ?? null,
          source: details.source ?? null,
        };
      }),
    );
  }

  async getSummary(user: JwtPayload, tenantId: string, projectId?: string) {
    const resolvedProjectId = projectId
      ? await this.scope.resolveProjectId(user, tenantId, projectId)
      : null;
    const base = this.consumerRepo.createQueryBuilder('c').where('c.tenant_id = :tenantId', { tenantId });
    await this.scope.scopeProjectQb(base, user, tenantId, 'c', resolvedProjectId);

    const pendingBase = this.consumerRepo.createQueryBuilder('c')
      .where('c.tenant_id = :tenantId', { tenantId })
      .andWhere('c.connection_status = :s', { s: 'pending' });
    if (resolvedProjectId) {
      pendingBase.andWhere('(c.project_id = :projectId OR c.project_id IS NULL)', { projectId: resolvedProjectId });
    } else {
      await this.scope.scopeProjectQb(pendingBase, user, tenantId, 'c', null);
    }

    const openRequestsQb = this.requestRepo
      .createQueryBuilder('r')
      .where('r.tenant_id = :tenantId', { tenantId })
      .andWhere('r.status = :status', { status: 'requested' });
    let openRequestsPromise: Promise<number>;
    const scopeProjectId = resolvedProjectId ?? projectId ?? null;
    if (scopeProjectId) {
      openRequestsPromise = this.consumerIdsForProjectScope(tenantId, scopeProjectId).then((consumerIds) => {
        if (consumerIds.length === 0) return 0;
        return this.requestRepo
          .createQueryBuilder('r')
          .where('r.tenant_id = :tenantId', { tenantId })
          .andWhere('r.status = :status', { status: 'requested' })
          .andWhere('r.consumer_id IN (:...consumerIds)', { consumerIds })
          .getCount();
      });
    } else {
      openRequestsPromise = openRequestsQb.getCount();
    }

    const [total, active, disconnected, pending, openRequests] = await Promise.all([
      base.clone().getCount(),
      base.clone().andWhere('c.connection_status = :s', { s: 'active' }).getCount(),
      base.clone().andWhere('c.connection_status = :s', { s: 'disconnected' }).getCount(),
      pendingBase.getCount(),
      openRequestsPromise,
    ]);

    return { total, active, disconnected, pending, openRequests };
  }

  private validateServiceRequest(consumer: OmConsumer, type: OmConsumerServiceType) {
    if (type === 'disconnection' && consumer.connectionStatus !== 'active') {
      throw new BadRequestException('Only active connections can be disconnected');
    }
    if (type === 'reconnection' && consumer.connectionStatus !== 'disconnected') {
      throw new BadRequestException('Only disconnected connections can be reconnected');
    }
    if (type === 'new_connection' && consumer.connectionStatus === 'active') {
      throw new BadRequestException('Consumer already has an active connection');
    }
  }

  private validateCoordinates(latitude?: number, longitude?: number) {
    if (latitude == null && longitude == null) return;
    if (latitude == null || longitude == null) {
      throw new BadRequestException('Provide both latitude and longitude for GIS location');
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      throw new BadRequestException('Invalid latitude or longitude');
    }
  }

  private async toConsumerRecord(tenantId: string, row: OmConsumer) {
    let projectName: string | null = null;
    let projectCode: string | null = null;
    if (row.projectId) {
      const project = await this.projectRepo.findOne({ where: { id: row.projectId, tenantId } });
      projectName = project?.name ?? null;
      projectCode = project?.projectCode ?? null;
    }
    return {
      id: row.id,
      consumerCode: row.consumerCode,
      fhtcNumber: row.fhtcNumber,
      consumerName: row.consumerName,
      mobile: row.mobile,
      village: row.village,
      ward: row.ward,
      consumerCategory: row.consumerCategory,
      aadhaarLast4: row.aadhaarLast4,
      latitude: row.latitude,
      longitude: row.longitude,
      meterNumber: row.meterNumber,
      meterType: row.meterType,
      meterInstallDate: row.meterInstallDate,
      connectionStatus: row.connectionStatus,
      connectionStatusLabel: getConnectionStatusLabel(row.connectionStatus),
      projectId: row.projectId,
      projectName,
      projectCode,
      notes: row.notes,
      createdAt: row.createdAt,
    };
  }

  private toRequestRecord(row: OmConsumerServiceRequest) {
    return {
      id: row.id,
      consumerId: row.consumerId,
      requestNo: row.requestNo,
      requestType: row.requestType,
      requestTypeLabel: getConsumerServiceLabel(row.requestType),
      status: row.status,
      details: row.details,
      notes: row.notes,
      completedAt: row.completedAt,
      createdAt: row.createdAt,
    };
  }
}
