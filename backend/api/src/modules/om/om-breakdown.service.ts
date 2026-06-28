import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asset } from '../assets/entities/asset.entity';
import { Project } from '../projects/entities/project.entity';
import { User } from '../auth/entities/user.entity';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import {
  getBreakdownComplaintLabel,
  getBreakdownGroupForComplaint,
  getNextBreakdownStatus,
  normalizeBreakdownStatus,
  OM_BREAKDOWN_CATALOG,
  OM_BREAKDOWN_WORKFLOW,
  type OmBreakdownStatus,
} from './constants/om-breakdown-catalog';
import { AdvanceBreakdownTicketDto, CreateBreakdownTicketDto } from './dto/create-breakdown-ticket.dto';
import { OmBreakdownTicket } from './entities/om-breakdown-ticket.entity';
import { OmDivisionScopeService } from './om-division-scope.service';

@Injectable()
export class OmBreakdownService {
  constructor(
    @InjectRepository(OmBreakdownTicket) private breakdownRepo: Repository<OmBreakdownTicket>,
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    @InjectRepository(Asset) private assetRepo: Repository<Asset>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private scope: OmDivisionScopeService,
  ) {}

  getCatalog() {
    return { groups: OM_BREAKDOWN_CATALOG, workflow: OM_BREAKDOWN_WORKFLOW };
  }

  async listTickets(
    user: JwtPayload,
    tenantId: string,
    filters: { status?: string; projectId?: string; projectCode?: string; categoryGroup?: string },
  ) {
    const resolvedProjectId = await this.scope.resolveProjectId(user, tenantId, filters.projectId, filters.projectCode);
    const qb = this.breakdownRepo
      .createQueryBuilder('b')
      .where('b.tenant_id = :tenantId', { tenantId })
      .orderBy('b.created_at', 'DESC')
      .take(200);

    await this.scope.scopeProjectQb(qb, user, tenantId, 'b', resolvedProjectId);

    if (filters.status) {
      if (filters.status === 'open') {
        qb.andWhere('b.status != :closed', { closed: 'closed' });
      } else {
        qb.andWhere('b.status = :status', { status: filters.status });
      }
    }
    if (filters.categoryGroup) qb.andWhere('b.category_group = :categoryGroup', { categoryGroup: filters.categoryGroup });

    const rows = await qb.getMany();
    return Promise.all(rows.map((r) => this.toRecord(tenantId, r)));
  }

  async getTicket(user: JwtPayload, tenantId: string, id: string) {
    const row = await this.breakdownRepo.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Breakdown ticket not found');
    await this.scope.assertProjectAccess(user, row.projectId, tenantId);
    return this.toRecord(tenantId, row);
  }

  async createTicket(user: JwtPayload, tenantId: string, userId: string, dto: CreateBreakdownTicketDto) {
    const categoryGroup = getBreakdownGroupForComplaint(dto.category);
    if (!categoryGroup) throw new BadRequestException('Invalid complaint type');

    const resolvedProjectId = await this.scope.resolveProjectId(user, tenantId, dto.projectId, dto.projectCode);
    if (dto.assetId) {
      const asset = await this.assetRepo.findOne({ where: { id: dto.assetId, tenantId } });
      if (!asset) throw new BadRequestException('Asset not found');
    }
    this.validateCoordinates(dto.latitude, dto.longitude);

    const count = await this.breakdownRepo.count({ where: { tenantId } });
    const ticketNo = `BD-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

    const record = this.breakdownRepo.create({
      tenantId,
      reportedBy: userId,
      ticketNo,
      title: dto.title.trim(),
      category: dto.category,
      categoryGroup,
      description: dto.description?.trim() ?? null,
      projectId: resolvedProjectId,
      assetId: dto.assetId ?? null,
      priority: dto.priority ?? 'medium',
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      status: 'ticket_generated',
      materialsUsed: [],
      labourUsed: [],
      beforePhotos: [],
      afterPhotos: [],
    });

    const saved = await this.breakdownRepo.save(record);
    return this.toRecord(tenantId, saved);
  }

  async advanceTicket(user: JwtPayload, tenantId: string, userId: string, id: string, dto: AdvanceBreakdownTicketDto) {
    const ticket = await this.breakdownRepo.findOne({ where: { id, tenantId } });
    if (!ticket) throw new NotFoundException('Breakdown ticket not found');
    await this.scope.assertProjectAccess(user, ticket.projectId, tenantId);

    const current = normalizeBreakdownStatus(ticket.status);
    if (current === 'closed') throw new BadRequestException('Ticket is already closed');

    const next = getNextBreakdownStatus(current);
    if (!next) throw new BadRequestException('Ticket cannot be advanced further');

    const now = new Date();

    if (current === 'ticket_generated') {
      if (!dto.assignedTo) throw new BadRequestException('Assignee is required');
      const assignee = await this.userRepo.findOne({ where: { id: dto.assignedTo, tenantId } });
      if (!assignee) throw new BadRequestException('Assignee not found');
      ticket.assignedTo = dto.assignedTo;
      ticket.assignedAt = now;
      ticket.responseTimeMins = Math.round((now.getTime() - ticket.createdAt.getTime()) / 60000);
    }

    if (current === 'assigned') {
      if (dto.latitude != null || dto.longitude != null) {
        this.validateCoordinates(dto.latitude, dto.longitude);
        ticket.latitude = dto.latitude ?? ticket.latitude;
        ticket.longitude = dto.longitude ?? ticket.longitude;
      }
      if (dto.beforePhotos?.length) {
        ticket.beforePhotos = dto.beforePhotos as Array<Record<string, unknown>>;
        ticket.beforePhotoUrl = dto.beforePhotos[0]?.url ?? ticket.beforePhotoUrl;
      }
      if (dto.inspectionNotes?.trim()) {
        ticket.description = [ticket.description, `Site inspection: ${dto.inspectionNotes.trim()}`]
          .filter(Boolean)
          .join('\n\n');
      }
      ticket.inspectedAt = now;
    }

    if (current === 'site_inspection') {
      if (!dto.repairDetails?.trim()) {
        throw new BadRequestException('Repair details are required');
      }
      ticket.repairDetails = dto.repairDetails.trim();
      if (dto.materialsUsed?.length) ticket.materialsUsed = dto.materialsUsed;
      if (dto.labourUsed?.length) ticket.labourUsed = dto.labourUsed;
      ticket.repairedAt = now;
    }

    if (current === 'repair_work') {
      if (dto.afterPhotos?.length) {
        ticket.afterPhotos = dto.afterPhotos as Array<Record<string, unknown>>;
        ticket.afterPhotoUrl = dto.afterPhotos[0]?.url ?? ticket.afterPhotoUrl;
      }
      if (dto.verificationNotes?.trim()) {
        ticket.description = [ticket.description, `Verification: ${dto.verificationNotes.trim()}`]
          .filter(Boolean)
          .join('\n\n');
      }
      ticket.verifiedAt = now;
    }

    if (current === 'verification') {
      ticket.closedAt = now;
    }

    ticket.status = next;
    const saved = await this.breakdownRepo.save(ticket);
    return this.toRecord(tenantId, saved);
  }

  async getSummary(user: JwtPayload, tenantId: string, projectId?: string) {
    const resolvedProjectId = projectId
      ? await this.scope.resolveProjectId(user, tenantId, projectId)
      : null;
    const base = this.breakdownRepo
      .createQueryBuilder('b')
      .where('b.tenant_id = :tenantId', { tenantId });
    await this.scope.scopeProjectQb(base, user, tenantId, 'b', resolvedProjectId);

    const [openBreakdowns, closedBreakdowns, total, avgResponse] = await Promise.all([
      base.clone().andWhere('b.status != :closed', { closed: 'closed' }).getCount(),
      base.clone().andWhere('b.status = :closed', { closed: 'closed' }).getCount(),
      base.clone().getCount(),
      base.clone()
        .andWhere('b.response_time_mins IS NOT NULL')
        .select('AVG(b.response_time_mins)', 'avg')
        .getRawOne<{ avg: string | null }>(),
    ]);

    return {
      openBreakdowns,
      closedBreakdowns,
      total,
      avgResponseTimeMins: avgResponse?.avg ? Math.round(Number(avgResponse.avg)) : null,
    };
  }

  countOpen(tenantId: string) {
    return this.breakdownRepo
      .createQueryBuilder('b')
      .where('b.tenant_id = :tenantId', { tenantId })
      .andWhere('b.status != :closed', { closed: 'closed' })
      .getCount();
  }

  countClosed(tenantId: string) {
    return this.breakdownRepo.count({ where: { tenantId, status: 'closed' } });
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

  private async toRecord(tenantId: string, row: OmBreakdownTicket) {
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

    let assignedToName: string | null = null;
    if (row.assignedTo) {
      const user = await this.userRepo.findOne({ where: { id: row.assignedTo, tenantId } });
      assignedToName = ([user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email) ?? null;
    }

    const status = normalizeBreakdownStatus(row.status);
    const workflowStep = OM_BREAKDOWN_WORKFLOW.findIndex((s) => s.status === status);

    return {
      id: row.id,
      ticketNo: row.ticketNo,
      title: row.title,
      description: row.description,
      category: row.category,
      categoryGroup: row.categoryGroup,
      complaintLabel: getBreakdownComplaintLabel(row.category),
      projectId: row.projectId,
      projectName,
      projectCode,
      assetId: row.assetId,
      assetCode,
      status,
      workflowStep,
      nextStatus: getNextBreakdownStatus(status),
      priority: row.priority,
      latitude: row.latitude,
      longitude: row.longitude,
      assignedTo: row.assignedTo,
      assignedToName,
      responseTimeMins: row.responseTimeMins,
      repairDetails: row.repairDetails,
      materialsUsed: row.materialsUsed ?? [],
      labourUsed: row.labourUsed ?? [],
      beforePhotos: row.beforePhotos ?? [],
      afterPhotos: row.afterPhotos ?? [],
      beforePhotoUrl: row.beforePhotoUrl,
      afterPhotoUrl: row.afterPhotoUrl,
      assignedAt: row.assignedAt,
      inspectedAt: row.inspectedAt,
      repairedAt: row.repairedAt,
      verifiedAt: row.verifiedAt,
      reportedBy: row.reportedBy,
      closedAt: row.closedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
