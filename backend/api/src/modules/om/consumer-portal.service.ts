import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../projects/entities/project.entity';
import {
  ConsumerPortalComplaintDto,
  ConsumerPortalNewConnectionDto,
  ConsumerPortalTrackApplicationDto,
  ConsumerPortalUpdateMobileDto,
} from './dto/consumer-portal.dto';
import { CreateConsumerServiceRequestDto } from './dto/create-om-consumer.dto';
import { OmConsumerServiceRequest } from './entities/om-consumer-service-request.entity';
import { OmConsumer } from './entities/om-consumer.entity';
import { OmBillingService } from './om-billing.service';
import { OmComplaintService } from './om-complaint.service';
import { ConsumerNotificationService } from './consumer-notification.service';
import { OmConsumerService } from './om-consumer.service';
import { getConsumerServiceLabel } from './constants/om-consumer-catalog';
import { getComplaintTypeLabel, OM_COMPLAINT_TYPES } from './constants/om-complaint-catalog';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Injectable()
export class ConsumerPortalService {
  constructor(
    @InjectRepository(OmConsumer) private consumerRepo: Repository<OmConsumer>,
    @InjectRepository(OmConsumerServiceRequest) private requestRepo: Repository<OmConsumerServiceRequest>,
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    private consumerService: OmConsumerService,
    private billingService: OmBillingService,
    private complaintService: OmComplaintService,
    private notifications: ConsumerNotificationService,
  ) {}

  getCatalog() {
    return {
      complaintTypes: OM_COMPLAINT_TYPES,
      features: [
        'view_bills',
        'download_receipts',
        'payment_history',
        'register_complaints',
        'apply_new_connection',
        'track_applications',
        'update_mobile',
      ],
    };
  }

  async getProfile(tenantId: string, consumerId: string) {
    return this.consumerService.getConsumer(this.portalUser(tenantId, consumerId), tenantId, consumerId);
  }

  async listMyBills(tenantId: string, consumerId: string) {
    return this.billingService.listBills(tenantId, { consumerId });
  }

  async getMyBill(tenantId: string, consumerId: string, billId: string) {
    const bill = await this.billingService.getBill(tenantId, billId);
    if (bill.consumerId !== consumerId) throw new NotFoundException('Bill not found');
    return bill;
  }

  async listMyPayments(tenantId: string, consumerId: string) {
    return this.billingService.listPayments(tenantId, { consumerId });
  }

  async getMyPayment(tenantId: string, consumerId: string, paymentId: string) {
    const payment = await this.billingService.getPayment(tenantId, paymentId);
    if (payment.consumerId !== consumerId) throw new NotFoundException('Payment not found');
    return payment;
  }

  async registerComplaint(tenantId: string, consumerId: string, dto: ConsumerPortalComplaintDto) {
    const consumer = await this.consumerRepo.findOne({ where: { id: consumerId, tenantId } });
    if (!consumer) throw new NotFoundException('Consumer not found');

    const projectId = await this.resolveConsumerProjectId(tenantId, consumer);

    return this.complaintService.registerComplaint(this.portalUser(tenantId, consumerId), tenantId, null, {
      complaintType: dto.complaintType,
      channel: 'web_portal',
      description: dto.description,
      omConsumerId: consumerId,
      fhtcNumber: consumer.fhtcNumber,
      mobile: consumer.mobile ?? undefined,
      village: consumer.village ?? undefined,
      priority: dto.priority ?? 'medium',
      projectId,
    });
  }

  async listMyComplaints(tenantId: string, consumerId: string) {
    const consumer = await this.consumerRepo.findOne({ where: { id: consumerId, tenantId } });
    if (!consumer) throw new NotFoundException('Consumer not found');

    return this.complaintService.listComplaintsForConsumer(tenantId, consumerId, consumer.fhtcNumber);
  }

  async listMyApplications(tenantId: string, consumerId: string) {
    const ownRequests = await this.consumerService.listServiceRequests(this.portalUser(tenantId, consumerId), tenantId, { consumerId });
    const submitted = await this.requestRepo.createQueryBuilder('r')
      .where('r.tenant_id = :tenantId', { tenantId })
      .andWhere("r.details->>'submittedByConsumerId' = :consumerId", { consumerId })
      .orderBy('r.created_at', 'DESC')
      .take(200)
      .getMany();

    const merged = new Map<string, Record<string, unknown>>();
    for (const row of submitted) {
      merged.set(row.id, {
        id: row.id,
        consumerId: row.consumerId,
        requestNo: row.requestNo,
        requestType: row.requestType,
        status: row.status,
        details: row.details,
        notes: row.notes,
        completedAt: row.completedAt,
        createdAt: row.createdAt,
      });
    }
    for (const row of ownRequests) {
      merged.set(String(row.id), row as Record<string, unknown>);
    }

    const records = await Promise.all(
      [...merged.values()].map(async (r) => {
        const consumer = await this.consumerRepo.findOne({
          where: { id: String(r.consumerId), tenantId },
        });
        return {
          ...r,
          requestTypeLabel: getConsumerServiceLabel(String(r.requestType)),
          fhtcNumber: consumer?.fhtcNumber ?? null,
          mobile: consumer?.mobile ?? null,
          applicantName: consumer?.consumerName ?? null,
          village: consumer?.village ?? null,
          connectionStatus: consumer?.connectionStatus ?? null,
        };
      }),
    );

    return records.sort(
      (a, b) => String((b as Record<string, unknown>).createdAt ?? '')
        .localeCompare(String((a as Record<string, unknown>).createdAt ?? '')),
    );
  }

  async getMyApplication(tenantId: string, consumerId: string, requestNo: string) {
    const request = await this.requestRepo.findOne({
      where: { tenantId, requestNo: requestNo.trim() },
    });
    if (!request) throw new NotFoundException('Application not found');

    const consumer = await this.consumerRepo.findOne({ where: { id: request.consumerId, tenantId } });
    if (!consumer) throw new NotFoundException('Application not found');

    const details = (request.details ?? {}) as Record<string, unknown>;
    const submittedBy = String(details.submittedByConsumerId ?? '');
    const allowed = request.consumerId === consumerId || submittedBy === consumerId;
    if (!allowed) throw new NotFoundException('Application not found');

    return {
      requestNo: request.requestNo,
      requestType: request.requestType,
      requestTypeLabel: getConsumerServiceLabel(request.requestType),
      status: request.status,
      createdAt: request.createdAt,
      completedAt: request.completedAt,
      consumerCode: consumer.consumerCode,
      fhtcNumber: consumer.fhtcNumber,
      mobile: consumer.mobile,
      connectionStatus: consumer.connectionStatus,
      notes: request.notes,
      details,
    };
  }

  async trackApplication(dto: ConsumerPortalTrackApplicationDto, loggedInConsumerId?: string) {
    const fhtc = dto.fhtcNumber?.trim() ?? '';
    const mobileDigits = dto.mobile?.replace(/\D/g, '').slice(-10) ?? '';
    const request = await this.requestRepo.findOne({
      where: { requestNo: dto.requestNo.trim() },
      order: { createdAt: 'DESC' },
    });
    if (!request) throw new NotFoundException('Application not found');

    const consumer = await this.consumerRepo.findOne({ where: { id: request.consumerId } });
    if (!consumer) throw new NotFoundException('Application not found');

    const details = (request.details ?? {}) as Record<string, unknown>;
    const submittedBy = String(details.submittedByConsumerId ?? '');
    if (loggedInConsumerId && (request.consumerId === loggedInConsumerId || submittedBy === loggedInConsumerId)) {
      return this.formatTrackResult(request, consumer);
    }

    if (!fhtc || !mobileDigits) {
      throw new BadRequestException('FHTC number and mobile are required to track this application');
    }

    const storedMobile = consumer.mobile?.replace(/\D/g, '').slice(-10) ?? '';
    const detailsMobile = String(details.mobile ?? '').replace(/\D/g, '').slice(-10);
    const mobileMatches = storedMobile === mobileDigits || (detailsMobile && detailsMobile === mobileDigits);

    if (consumer.fhtcNumber !== fhtc || !mobileMatches) {
      throw new NotFoundException('Application not found for the provided FHTC and mobile');
    }

    return this.formatTrackResult(request, consumer);
  }

  private formatTrackResult(request: OmConsumerServiceRequest, consumer: OmConsumer) {
    return {
      requestNo: request.requestNo,
      requestType: request.requestType,
      requestTypeLabel: getConsumerServiceLabel(request.requestType),
      status: request.status,
      createdAt: request.createdAt,
      completedAt: request.completedAt,
      consumerCode: consumer.consumerCode,
      fhtcNumber: consumer.fhtcNumber,
      mobile: consumer.mobile,
      connectionStatus: consumer.connectionStatus,
      notes: request.notes,
    };
  }

  async applyNewConnection(tenantId: string, dto: ConsumerPortalNewConnectionDto, loggedInConsumerId?: string) {
    const fhtc = dto.fhtcNumber.trim();
    const mobile = dto.mobile.trim();
    const projectId = await this.resolveProjectId(tenantId, dto.projectCode);

    const loggedInConsumer = loggedInConsumerId
      ? await this.consumerRepo.findOne({ where: { id: loggedInConsumerId, tenantId } })
      : null;
    const applyingForSelf = !!loggedInConsumer && loggedInConsumer.fhtcNumber === fhtc;

    let consumer = await this.consumerRepo.findOne({ where: { tenantId, fhtcNumber: fhtc } });

    if (!consumer) {
      const count = await this.consumerRepo.count({ where: { tenantId } });
      const consumerCode = `CON-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;
      consumer = this.consumerRepo.create({
        tenantId,
        projectId: projectId ?? loggedInConsumer?.projectId ?? null,
        consumerCode,
        fhtcNumber: fhtc,
        consumerName: dto.consumerName?.trim() ?? null,
        mobile,
        village: dto.village?.trim() ?? null,
        ward: dto.ward?.trim() ?? null,
        consumerCategory: dto.consumerCategory ?? null,
        connectionStatus: 'pending',
        notes: dto.notes?.trim() ?? 'New connection application via consumer portal',
      });
      consumer = await this.consumerRepo.save(consumer);
    } else if (applyingForSelf && consumer.connectionStatus === 'active') {
      throw new BadRequestException(
        'You already have an active connection on this FHTC. Enter a new FHTC number to apply for an additional connection.',
      );
    } else if (!applyingForSelf) {
      if (dto.consumerName?.trim()) consumer.consumerName = dto.consumerName.trim();
      if (dto.village?.trim()) consumer.village = dto.village.trim();
      if (dto.ward?.trim()) consumer.ward = dto.ward.trim();
      if (mobile) consumer.mobile = mobile;
      consumer = await this.consumerRepo.save(consumer);
    }

    const serviceDto: CreateConsumerServiceRequestDto = {
      requestType: 'new_connection',
      notes: dto.notes?.trim() ?? 'Online new connection application',
      details: {
        applicantName: dto.consumerName?.trim() ?? consumer.consumerName,
        village: dto.village?.trim() ?? consumer.village,
        ward: dto.ward?.trim() ?? consumer.ward,
        mobile,
        source: 'consumer_portal',
        submittedByConsumerId: loggedInConsumerId ?? null,
      },
    };

    const request = await this.consumerService.createServiceRequest(
      this.portalUser(tenantId, consumer.id),
      tenantId,
      null,
      consumer.id,
      serviceDto,
    );

    return {
      application: request,
      consumer: {
        id: consumer.id,
        consumerCode: consumer.consumerCode,
        fhtcNumber: consumer.fhtcNumber,
        connectionStatus: consumer.connectionStatus,
      },
      message: `Application ${request.requestNo} submitted. Track status using FHTC and mobile.`,
    };
  }

  async updateMobile(tenantId: string, consumerId: string, dto: ConsumerPortalUpdateMobileDto) {
    const consumer = await this.consumerRepo.findOne({ where: { id: consumerId, tenantId } });
    if (!consumer) throw new NotFoundException('Consumer not found');

    const mobile = dto.mobile.trim();
    if (!mobile) throw new BadRequestException('Mobile number is required');

    consumer.mobile = mobile;
    await this.consumerRepo.save(consumer);

    const profile = await this.consumerService.getConsumer(this.portalUser(tenantId, consumerId), tenantId, consumerId);
    return {
      message: 'Mobile number updated successfully',
      consumer: profile,
    };
  }

  listNotifications(tenantId: string, consumerId: string) {
    return this.notifications.listForConsumer(tenantId, consumerId);
  }

  markNotificationRead(tenantId: string, consumerId: string, notificationId: string) {
    return this.notifications.markRead(tenantId, consumerId, notificationId);
  }

  markAllNotificationsRead(tenantId: string, consumerId: string) {
    return this.notifications.markAllRead(tenantId, consumerId);
  }

  private portalUser(tenantId: string, consumerId: string): JwtPayload {
    return {
      sub: consumerId,
      email: '',
      tenantId,
      roles: ['consumer'],
      permissions: ['portal:read', 'portal:write'],
      accessScope: 'division',
      consumerId,
      portalType: 'consumer',
      canViewAllDivisions: false,
    };
  }

  /** Consumer complaints must carry the scheme in their division — never a statewide default. */
  private async resolveConsumerProjectId(tenantId: string, consumer: OmConsumer): Promise<string> {
    const kpgProjectId = await this.findTharaliProjectId(tenantId);
    const kpgDivisionId = 'd1000000-0000-0000-0000-000000000010';
    const kpgVillages = ['tharali', 'karanprayag', 'pinder'];
    const village = consumer.village?.trim().toLowerCase() ?? '';
    const inKpgArea = !village || kpgVillages.some((name) => village.includes(name));

    if (consumer.projectId) {
      const linked = await this.projectRepo.findOne({
        where: { id: consumer.projectId, tenantId },
      });
      if (linked) {
        const divisionRows = await this.projectRepo.query(
          'SELECT division_id FROM projects WHERE id = $1 AND tenant_id = $2',
          [linked.id, tenantId],
        ) as Array<{ division_id?: string | null }>;
        const divisionId = divisionRows[0]?.division_id ?? null;
        if (
          kpgProjectId
          && inKpgArea
          && divisionId !== kpgDivisionId
          && linked.id !== kpgProjectId
        ) {
          consumer.projectId = kpgProjectId;
          await this.consumerRepo.save(consumer);
          return kpgProjectId;
        }
        return linked.id;
      }
    }

    if (kpgProjectId && inKpgArea) {
      consumer.projectId = kpgProjectId;
      await this.consumerRepo.save(consumer);
      return kpgProjectId;
    }

    throw new BadRequestException(
      'Your Jal Mitra account is not linked to a water supply scheme. Please contact your local Jal Sansthan office.',
    );
  }

  private async findTharaliProjectId(tenantId: string): Promise<string | null> {
    const rows = await this.projectRepo.query(
      `SELECT p.id
       FROM projects p
       WHERE p.tenant_id = $1
         AND p.status = 'active'
         AND (
           p.project_code IN ('PRJ-TPPWSS-2026-27', 'PRJ-2026-001')
           OR p.name ILIKE '%Tharali%'
         )
       ORDER BY
         CASE p.project_code WHEN 'PRJ-TPPWSS-2026-27' THEN 0 WHEN 'PRJ-2026-001' THEN 1 ELSE 2 END,
         CASE WHEN p.division_id = 'd1000000-0000-0000-0000-000000000010' THEN 0 ELSE 1 END,
         p.name ASC
       LIMIT 1`,
      [tenantId],
    ) as Array<{ id: string }>;
    return rows[0]?.id ?? null;
  }

  private async resolveProjectId(tenantId: string, projectCode?: string): Promise<string | null> {
    if (!projectCode?.trim()) return null;
    const project = await this.projectRepo.findOne({
      where: { tenantId, projectCode: projectCode.trim() },
    });
    return project?.id ?? null;
  }
}
