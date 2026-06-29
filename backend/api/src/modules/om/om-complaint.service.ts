import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../projects/entities/project.entity';
import { User } from '../auth/entities/user.entity';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { OmDivisionScopeService } from './om-division-scope.service';
import {
  getComplaintChannelLabel,
  getComplaintTypeLabel,
  getComplaintWorkflowStep,
  getNextComplaintStatus,
  normalizeComplaintStatus,
  OM_COMPLAINT_CHANNELS,
  OM_COMPLAINT_TYPES,
  OM_COMPLAINT_WORKFLOW,
  type OmComplaintStatus,
} from './constants/om-complaint-catalog';
import { AdvanceOmComplaintDto, CreateOmComplaintDto } from './dto/create-om-complaint.dto';
import { OmConsumerComplaint } from './entities/om-consumer-complaint.entity';
import { OmConsumer } from './entities/om-consumer.entity';
import { ConsumerNotificationService } from './consumer-notification.service';
import { AlertNotificationService } from './alert-notification.service';

@Injectable()
export class OmComplaintService {
  constructor(
    @InjectRepository(OmConsumerComplaint) private complaintRepo: Repository<OmConsumerComplaint>,
    @InjectRepository(OmConsumer) private consumerRepo: Repository<OmConsumer>,
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private consumerNotifications: ConsumerNotificationService,
    private alertNotifications: AlertNotificationService,
    private scope: OmDivisionScopeService,
  ) {}

  getCatalog() {
    return {
      channels: OM_COMPLAINT_CHANNELS,
      complaintTypes: OM_COMPLAINT_TYPES,
      workflow: OM_COMPLAINT_WORKFLOW,
    };
  }

  async listComplaints(
    user: JwtPayload,
    tenantId: string,
    filters: {
      status?: string;
      projectId?: string;
      projectCode?: string;
      channel?: string;
      complaintType?: string;
    },
  ) {
    const resolvedProjectId = await this.scope.resolveProjectId(user, tenantId, filters.projectId, filters.projectCode);
    const qb = this.complaintRepo
      .createQueryBuilder('c')
      .where('c.tenant_id = :tenantId', { tenantId })
      .orderBy('c.created_at', 'DESC')
      .take(200);

    await this.scope.scopeComplaintProjectQb(qb, user, tenantId, 'c', resolvedProjectId);

    if (filters.status) {
      if (filters.status === 'open') {
        qb.andWhere('c.status = :ticketGenerated', { ticketGenerated: 'ticket_generated' });
      } else if (filters.status === 'in_progress') {
        qb.andWhere('c.status IN (:...inProgress)', { inProgress: ['assigned', 'resolution', 'feedback'] });
      } else if (filters.status === 'closed') {
        qb.andWhere('c.status = :closed', { closed: 'closed' });
      } else {
        qb.andWhere('c.status = :status', { status: filters.status });
      }
    }
    if (filters.channel) qb.andWhere('c.channel = :channel', { channel: filters.channel });
    if (filters.complaintType) qb.andWhere('c.complaint_type = :complaintType', { complaintType: filters.complaintType });

    const rows = await qb.getMany();
    return Promise.all(rows.map((r) => this.toRecord(tenantId, r)));
  }

  async getComplaint(user: JwtPayload, tenantId: string, id: string) {
    const row = await this.complaintRepo.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Complaint not found');
    await this.scope.assertProjectAccess(user, row.projectId, tenantId);
    return this.toRecord(tenantId, row);
  }

  async listAssignees(user: JwtPayload, tenantId: string, projectCode?: string) {
    const roleCodes = ['je', 'ae', 'ee', 'accounts', 'consumer_service'];
    let divisionId: string | null = null;

    if (projectCode?.trim()) {
      const projectId = await this.scope.resolveProjectId(user, tenantId, undefined, projectCode.trim());
      if (projectId) {
        divisionId = await this.getProjectDivisionId(tenantId, projectId);
      }
    }

    const rows = await this.queryAssignees(tenantId, roleCodes, divisionId);
    if (!rows.length && divisionId) {
      return this.queryAssignees(tenantId, roleCodes, null);
    }
    return rows;
  }

  async registerComplaint(user: JwtPayload, tenantId: string, reportedBy: string | null, dto: CreateOmComplaintDto) {
    this.validateCoordinates(dto.latitude, dto.longitude);

    let omConsumerId = dto.omConsumerId ?? null;
    let consumerRef: string | null = null;
    let fhtcNumber = dto.fhtcNumber?.trim() ?? null;
    let mobile = dto.mobile?.trim() ?? null;
    let village = dto.village?.trim() ?? null;
    let consumerProjectId: string | null = null;

    if (omConsumerId) {
      const consumer = await this.consumerRepo.findOne({ where: { id: omConsumerId, tenantId } });
      if (!consumer) throw new BadRequestException('Consumer not found');
      consumerRef = consumer.consumerCode;
      fhtcNumber = fhtcNumber ?? consumer.fhtcNumber;
      mobile = mobile ?? consumer.mobile;
      village = village ?? consumer.village;
      consumerProjectId = consumer.projectId ?? null;
    } else if (fhtcNumber) {
      const consumer = await this.consumerRepo.findOne({ where: { tenantId, fhtcNumber } });
      if (consumer) {
        omConsumerId = consumer.id;
        consumerRef = consumer.consumerCode;
        mobile = mobile ?? consumer.mobile;
        village = village ?? consumer.village;
        consumerProjectId = consumer.projectId ?? null;
      }
    }

    let resolvedProjectId = await this.scope.resolveProjectId(user, tenantId, dto.projectId, dto.projectCode);
    if (!resolvedProjectId && consumerProjectId) {
      await this.scope.assertProjectAccess(user, consumerProjectId, tenantId);
      resolvedProjectId = consumerProjectId;
    }
    if (!resolvedProjectId) {
      resolvedProjectId = await this.scope.resolveDefaultProjectId(user, tenantId);
    }
    if (!resolvedProjectId) {
      throw new BadRequestException('Select a scheme for this complaint or link a registered consumer.');
    }

    const duplicate = await this.findOpenDuplicateComplaint(tenantId, {
      omConsumerId,
      fhtcNumber,
      complaintType: dto.complaintType,
    });
    if (duplicate) {
      return this.toRecord(tenantId, duplicate);
    }

    const count = await this.complaintRepo.count({ where: { tenantId } });
    const complaintNo = `CMP-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

    const record = this.complaintRepo.create({
      tenantId,
      reportedBy: reportedBy ?? null,
      complaintNo,
      omConsumerId,
      consumerRef,
      fhtcNumber,
      mobile,
      village,
      complaintType: dto.complaintType,
      channel: dto.channel,
      description: dto.description?.trim() ?? null,
      projectId: resolvedProjectId,
      priority: dto.priority ?? 'medium',
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      status: 'ticket_generated',
    });

    const saved = await this.complaintRepo.save(record);
    const result = await this.toRecord(tenantId, saved);

    const contact = await this.resolveComplaintContact(tenantId, saved);

    await this.consumerNotifications.notifyComplaintRegistered(tenantId, {
      consumerId: contact.consumerId,
      mobile: contact.mobile,
      complaintNo: saved.complaintNo,
      complaintType: getComplaintTypeLabel(saved.complaintType),
      complaintId: saved.id,
    }).catch(() => undefined);

    return result;
  }

  async advanceComplaint(user: JwtPayload, tenantId: string, userId: string, id: string, dto: AdvanceOmComplaintDto) {
    const complaint = await this.complaintRepo.findOne({ where: { id, tenantId } });
    if (!complaint) throw new NotFoundException('Complaint not found');
    await this.scope.assertProjectAccess(user, complaint.projectId, tenantId);

    const current = normalizeComplaintStatus(complaint.status);
    if (current === 'closed') throw new BadRequestException('Complaint is already closed');

    const next = getNextComplaintStatus(current);
    if (!next) throw new BadRequestException('Complaint cannot be advanced further');

    const now = new Date();

    if (current === 'ticket_generated') {
      const assigneeId = dto.assignedTo ?? userId;
      const assignee = await this.userRepo.findOne({ where: { id: assigneeId, tenantId } });
      if (!assignee) throw new BadRequestException('Assignee not found');
      complaint.assignedTo = assigneeId;
      complaint.assignedAt = now;
      complaint.responseTimeMins = Math.round((now.getTime() - complaint.createdAt.getTime()) / 60000);

      const assigneeName = [assignee.firstName, assignee.lastName].filter(Boolean).join(' ') || null;
      const contactPreview = await this.resolveComplaintContact(tenantId, complaint);
      await this.alertNotifications.notifyComplaintAssigned(tenantId, {
        assigneeEmail: assignee.email,
        assigneeName,
        complaintNo: complaint.complaintNo,
        complaintType: getComplaintTypeLabel(complaint.complaintType),
        complaintId: complaint.id,
        consumerMobile: contactPreview.mobile,
      }).catch(() => undefined);
    }

    if (current === 'assigned') {
      if (!dto.resolutionNotes?.trim()) {
        throw new BadRequestException('Resolution notes are required');
      }
      complaint.resolutionNotes = dto.resolutionNotes.trim();
      complaint.resolvedAt = now;
    }

    if (current === 'resolution') {
      if (!dto.consumerFeedback?.trim()) {
        throw new BadRequestException('Consumer feedback is required');
      }
      complaint.consumerFeedback = dto.consumerFeedback.trim();
      complaint.feedbackAt = now;
    }

    if (current === 'feedback') {
      complaint.closedAt = now;
    }

    complaint.status = next;
    const saved = await this.complaintRepo.save(complaint);
    const result = await this.toRecord(tenantId, saved);

    const contact = await this.resolveComplaintContact(tenantId, saved);

    if (next === 'closed') {
      await this.consumerNotifications.notifyComplaintClosed(tenantId, {
        consumerId: contact.consumerId,
        mobile: contact.mobile,
        complaintNo: saved.complaintNo,
        complaintId: saved.id,
        complaintTypeLabel: getComplaintTypeLabel(saved.complaintType),
        resolutionNotes: saved.resolutionNotes,
      }).catch(() => undefined);

      await this.alertNotifications.notifyComplaintResolved(tenantId, {
        mobile: contact.mobile,
        complaintNo: saved.complaintNo,
        complaintId: saved.id,
        resolutionNotes: saved.resolutionNotes,
      }).catch(() => undefined);
    } else {
      const statusDetail = next === 'resolution' && saved.resolutionNotes
        ? saved.resolutionNotes.slice(0, 120)
        : next === 'assigned'
          ? 'Assigned to field team.'
          : undefined;

      await this.consumerNotifications.notifyComplaintStatus(tenantId, {
        consumerId: contact.consumerId,
        mobile: contact.mobile,
        complaintNo: saved.complaintNo,
        complaintId: saved.id,
        status: next,
        detail: statusDetail,
      }, { sendSms: next === 'assigned' }).catch(() => undefined);
    }

    return result;
  }

  async getSummary(user: JwtPayload, tenantId: string, projectId?: string) {
    const resolvedProjectId = projectId
      ? await this.scope.resolveProjectId(user, tenantId, projectId)
      : null;
    const base = this.complaintRepo
      .createQueryBuilder('c')
      .where('c.tenant_id = :tenantId', { tenantId });
    await this.scope.scopeComplaintProjectQb(base, user, tenantId, 'c', resolvedProjectId);

    const slaResolutionMins = 480;

    const [openComplaints, inProgressComplaints, closedComplaints, slaBreached, total, avgResponse, byChannel] = await Promise.all([
      base.clone().andWhere('c.status = :ticketGenerated', { ticketGenerated: 'ticket_generated' }).getCount(),
      base.clone().andWhere('c.status IN (:...inProgress)', { inProgress: ['assigned', 'resolution', 'feedback'] }).getCount(),
      base.clone().andWhere('c.status = :closed', { closed: 'closed' }).getCount(),
      base.clone()
        .andWhere('c.status != :closed', { closed: 'closed' })
        .andWhere('EXTRACT(EPOCH FROM (NOW() - c.created_at)) / 60 > :slaMins', { slaMins: slaResolutionMins })
        .getCount(),
      base.clone().getCount(),
      base.clone()
        .andWhere('c.response_time_mins IS NOT NULL')
        .select('AVG(c.response_time_mins)', 'avg')
        .getRawOne<{ avg: string | null }>(),
      base.clone()
        .select('c.channel', 'channel')
        .addSelect('COUNT(*)', 'count')
        .groupBy('c.channel')
        .getRawMany<{ channel: string; count: string }>(),
    ]);

    const channelBreakdown = Object.fromEntries(
      byChannel.map((r) => [r.channel, Number(r.count)]),
    );

    return {
      openComplaints,
      inProgressComplaints,
      closedComplaints,
      slaBreached,
      total,
      avgResponseTimeMins: avgResponse?.avg ? Math.round(Number(avgResponse.avg)) : null,
      channelBreakdown,
    };
  }

  countOpen(tenantId: string) {
    return this.complaintRepo
      .createQueryBuilder('c')
      .where('c.tenant_id = :tenantId', { tenantId })
      .andWhere('c.status != :closed', { closed: 'closed' })
      .getCount();
  }

  private async findOpenDuplicateComplaint(
    tenantId: string,
    data: { omConsumerId?: string | null; fhtcNumber?: string | null; complaintType: string },
  ) {
    if (!data.omConsumerId && !data.fhtcNumber) return null;

    const qb = this.complaintRepo
      .createQueryBuilder('c')
      .where('c.tenant_id = :tenantId', { tenantId })
      .andWhere('c.complaint_type = :complaintType', { complaintType: data.complaintType })
      .andWhere('c.status != :closed', { closed: 'closed' })
      .orderBy('c.created_at', 'DESC')
      .take(1);

    if (data.omConsumerId) {
      qb.andWhere('c.om_consumer_id = :omConsumerId', { omConsumerId: data.omConsumerId });
    } else if (data.fhtcNumber) {
      qb.andWhere('c.fhtc_number = :fhtcNumber', { fhtcNumber: data.fhtcNumber });
    }

    return qb.getOne();
  }

  private async resolveComplaintContact(
    tenantId: string,
    complaint: OmConsumerComplaint,
  ): Promise<{ consumerId: string | null; mobile: string | null }> {
    let consumerId = complaint.omConsumerId ?? null;
    let mobile = complaint.mobile?.trim() ?? null;

    if ((!mobile || !consumerId) && (complaint.omConsumerId || complaint.fhtcNumber)) {
      const consumer = complaint.omConsumerId
        ? await this.consumerRepo.findOne({ where: { id: complaint.omConsumerId, tenantId } })
        : await this.consumerRepo.findOne({ where: { tenantId, fhtcNumber: complaint.fhtcNumber! } });
      if (consumer) {
        consumerId = consumerId ?? consumer.id;
        mobile = mobile ?? consumer.mobile?.trim() ?? null;
      }
    }

    return { consumerId, mobile };
  }

  private async getProjectDivisionId(tenantId: string, projectId: string): Promise<string | null> {
    const rows = await this.projectRepo.query(
      'SELECT division_id FROM projects WHERE id = $1 AND tenant_id = $2',
      [projectId, tenantId],
    ) as Array<{ division_id?: string | null }>;
    return rows[0]?.division_id ?? null;
  }

  private async queryAssignees(
    tenantId: string,
    roleCodes: string[],
    divisionId: string | null,
  ) {
    const params: unknown[] = [tenantId, roleCodes];
    let divisionClause = '';
    if (divisionId) {
      divisionClause = `AND (
        EXISTS (
          SELECT 1 FROM user_division_assignments uda
          WHERE uda.user_id = u.id AND uda.division_id = $3
        )
        OR u.division_id = $3
      )`;
      params.push(divisionId);
    }

    const rows = await this.userRepo.query(
      `SELECT DISTINCT u.id, u.email, u.first_name AS "firstName", u.last_name AS "lastName"
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       JOIN roles r ON r.id = ur.role_id
       WHERE u.tenant_id = $1
         AND u.status = 'active'
         AND r.code = ANY($2::text[])
         ${divisionClause}
       ORDER BY u.first_name NULLS LAST, u.last_name NULLS LAST, u.email`,
      params,
    ) as Array<{ id: string; email: string; firstName?: string | null; lastName?: string | null }>;

    return rows.map((r) => ({
      id: r.id,
      email: r.email,
      firstName: r.firstName ?? null,
      lastName: r.lastName ?? null,
    }));
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

  private async toRecord(tenantId: string, row: OmConsumerComplaint) {
    let projectName: string | null = null;
    let projectCode: string | null = null;
    let divisionName: string | null = null;
    let divisionCode: string | null = null;
    if (row.projectId) {
      const projectRows = await this.projectRepo.query(
        `SELECT p.name, p.project_code AS "projectCode", d.name AS "divisionName", d.code AS "divisionCode"
         FROM projects p
         LEFT JOIN divisions d ON d.id = p.division_id AND d.tenant_id = p.tenant_id
         WHERE p.id = $1 AND p.tenant_id = $2`,
        [row.projectId, tenantId],
      ) as Array<{ name: string; projectCode: string; divisionName?: string | null; divisionCode?: string | null }>;
      const project = projectRows[0];
      projectName = project?.name ?? null;
      projectCode = project?.projectCode ?? null;
      divisionName = project?.divisionName ?? null;
      divisionCode = project?.divisionCode ?? null;
    }

    let assignedToName: string | null = null;
    if (row.assignedTo) {
      const user = await this.userRepo.findOne({ where: { id: row.assignedTo, tenantId } });
      assignedToName = ([user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email) ?? null;
    }

    let consumerName: string | null = null;
    if (row.omConsumerId) {
      const consumer = await this.consumerRepo.findOne({ where: { id: row.omConsumerId, tenantId } });
      consumerName = consumer?.consumerName ?? null;
    }

    const status = normalizeComplaintStatus(row.status);
    const workflowStep = getComplaintWorkflowStep(status);

    return {
      id: row.id,
      complaintNo: row.complaintNo,
      omConsumerId: row.omConsumerId,
      consumerRef: row.consumerRef,
      consumerName,
      fhtcNumber: row.fhtcNumber,
      mobile: row.mobile,
      village: row.village,
      complaintType: row.complaintType,
      complaintTypeLabel: getComplaintTypeLabel(row.complaintType),
      channel: row.channel,
      channelLabel: getComplaintChannelLabel(row.channel),
      description: row.description,
      status,
      workflowStep,
      nextStatus: getNextComplaintStatus(status),
      priority: row.priority,
      latitude: row.latitude,
      longitude: row.longitude,
      assignedTo: row.assignedTo,
      assignedToName,
      resolutionNotes: row.resolutionNotes,
      consumerFeedback: row.consumerFeedback,
      responseTimeMins: row.responseTimeMins,
      projectId: row.projectId,
      projectName,
      projectCode,
      divisionName,
      divisionCode,
      reportedBy: row.reportedBy,
      assignedAt: row.assignedAt,
      resolvedAt: row.resolvedAt,
      feedbackAt: row.feedbackAt,
      closedAt: row.closedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
