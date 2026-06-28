import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder, ObjectLiteral } from 'typeorm';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { DivisionAccessService } from '../divisions/division-access.service';
import { Project } from '../projects/entities/project.entity';
import {
  calculateSlabCharge,
  computeBillingPeriod,
  DEFAULT_TARIFF_SLABS,
  getArrearBucket,
  getWorkflowStepForBillStatus,
  OM_ARREAR_BUCKETS,
  OM_ARREAR_ACTIONS,
  OM_BILL_DELIVERY_CHANNELS,
  OM_BILL_STATUSES,
  OM_BILLING_CYCLES,
  OM_DEMAND_REGISTER_VIEWS,
  OM_BILLING_REPORT_TYPES,
  OM_BILLING_REVENUE_REPORTS_1512,
  OM_REVENUE_KPI_GROUPS,
  OM_REVENUE_KPI_DEFINITIONS,
  OM_BILLING_WORKFLOW,
  OM_COLLECTION_WORKFLOW,
  OM_GIS_REVENUE_LAYERS,
  OM_NRW_EFFICIENCY_THRESHOLD_PCT,
  OM_CONSUMER_CATEGORIES,
  OM_CONNECTION_STATUSES,
  OM_METER_CONDITIONS,
  OM_PAYMENT_MODES,
  OM_READING_METHODS,
  validateMeterReading,
  type OmBillingCycle,
  type OmDemandGroupBy,
  type TariffSlab,
} from './constants/om-billing-catalog';
import {
  CreateBillingTariffDto,
  CreateConsumerAccountDto,
  ArrearActionDto,
  DeliverBillDto,
  GenerateBillsDto,
  LinkConsumerAccountDto,
  RecordMeterReadingDto,
  RecordPaymentDto,
} from './dto/create-om-billing.dto';
import { OmBillingPayment } from './entities/om-billing-payment.entity';
import { OmBillingTariff } from './entities/om-billing-tariff.entity';
import { OmConsumerBill } from './entities/om-consumer-bill.entity';
import { OmConsumer } from './entities/om-consumer.entity';
import { OmMeterReading } from './entities/om-meter-reading.entity';
import { BillingNotificationService, type NotificationSendResult } from './billing-notification.service';
import { ConsumerNotificationService } from './consumer-notification.service';
import { OmAccountingService } from './om-accounting.service';
import { OmEnergyService } from './om-energy.service';

@Injectable()
export class OmBillingService {
  constructor(
    @InjectRepository(OmBillingTariff) private tariffRepo: Repository<OmBillingTariff>,
    @InjectRepository(OmMeterReading) private readingRepo: Repository<OmMeterReading>,
    @InjectRepository(OmConsumerBill) private billRepo: Repository<OmConsumerBill>,
    @InjectRepository(OmBillingPayment) private paymentRepo: Repository<OmBillingPayment>,
    @InjectRepository(OmConsumer) private consumerRepo: Repository<OmConsumer>,
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    private notificationService: BillingNotificationService,
    private consumerNotifications: ConsumerNotificationService,
    private accountingService: OmAccountingService,
    private energyService: OmEnergyService,
    private divisionAccess: DivisionAccessService,
  ) {}

  getCatalog() {
    return {
      consumerCategories: OM_CONSUMER_CATEGORIES,
      connectionStatuses: OM_CONNECTION_STATUSES,
      billingCycles: OM_BILLING_CYCLES,
      billStatuses: OM_BILL_STATUSES,
      paymentModes: OM_PAYMENT_MODES,
      readingMethods: OM_READING_METHODS,
      meterConditions: OM_METER_CONDITIONS,
      arrearBuckets: OM_ARREAR_BUCKETS,
      arrearActions: OM_ARREAR_ACTIONS,
      workflow: OM_BILLING_WORKFLOW,
      collectionWorkflow: OM_COLLECTION_WORKFLOW,
      deliveryChannels: OM_BILL_DELIVERY_CHANNELS,
      demandRegisterViews: OM_DEMAND_REGISTER_VIEWS,
      notificationConfig: this.notificationService.getConfigStatus(),
      reportTypes: OM_BILLING_REPORT_TYPES,
      revenueReports1512: OM_BILLING_REVENUE_REPORTS_1512,
      revenueKpiGroups: OM_REVENUE_KPI_GROUPS,
      revenueKpiDefinitions: OM_REVENUE_KPI_DEFINITIONS,
      gisRevenueLayers: OM_GIS_REVENUE_LAYERS,
      defaultSlabs: DEFAULT_TARIFF_SLABS,
    };
  }

  async getSummary(tenantId: string, projectId?: string, user?: JwtPayload) {
    const resolvedProjectId = projectId && user
      ? await this.divisionAccess.resolveAccessibleProjectId(user, tenantId, projectId)
      : (projectId ?? null);
    const consumerQb = this.consumerRepo.createQueryBuilder('c').where('c.tenant_id = :tenantId', { tenantId });
    if (user) {
      await this.scopeProjectQb(consumerQb, user, tenantId, 'c', resolvedProjectId);
    } else if (resolvedProjectId) {
      consumerQb.andWhere('c.project_id = :projectId', { projectId: resolvedProjectId });
    }

    const [totalConsumers, activeConsumers, meteredConsumers] = await Promise.all([
      consumerQb.clone().getCount(),
      consumerQb.clone().andWhere('c.connection_status = :s', { s: 'active' }).getCount(),
      consumerQb.clone().andWhere('c.meter_number IS NOT NULL').getCount(),
    ]);

    const billBase = this.billRepo.createQueryBuilder('b').where('b.tenant_id = :tenantId', { tenantId });
    if (user) {
      await this.scopeProjectQb(billBase, user, tenantId, 'b', resolvedProjectId);
    } else if (resolvedProjectId) {
      billBase.andWhere('b.project_id = :projectId', { projectId: resolvedProjectId });
    }

    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

    const paymentQb = this.paymentRepo.createQueryBuilder('p')
      .select('COALESCE(SUM(p.amount), 0)', 'sum')
      .where('p.tenant_id = :tenantId', { tenantId })
      .andWhere('p.payment_date >= :monthStart', { monthStart });
    if (resolvedProjectId) {
      paymentQb.innerJoin('om_consumers', 'c', 'c.id = p.consumer_id')
        .andWhere('c.project_id = :projectId', { projectId: resolvedProjectId });
    } else if (user) {
      const scopedIds = await this.divisionAccess.getAccessibleProjectIds(user, tenantId);
      if (scopedIds !== null) {
        if (scopedIds.length === 0) {
          paymentQb.andWhere('1 = 0');
        } else {
          paymentQb.innerJoin('om_consumers', 'c', 'c.id = p.consumer_id')
            .andWhere('c.project_id IN (:...scopedProjectIds)', { scopedProjectIds: scopedIds });
        }
      }
    }

    const energySummaryPromise = this.energyService.getSummary(
      user!,
      tenantId,
      resolvedProjectId ?? undefined,
      monthStart,
      monthEnd,
    ).catch(() => ({ energyCost: 0 }));

    const [monthlyDemand, monthlyCollection, outstandingArrears, defaulterCount, overdueCount, energySummary] = await Promise.all([
      billBase.clone()
        .select('COALESCE(SUM(b.total_amount), 0)', 'sum')
        .andWhere('b.billing_period_from >= :monthStart', { monthStart })
        .getRawOne()
        .then((r) => Number(r?.sum ?? 0)),
      paymentQb.getRawOne().then((r) => Number(r?.sum ?? 0)),
      billBase.clone()
        .select('COALESCE(SUM(b.balance_amount), 0)', 'sum')
        .andWhere('b.balance_amount > 0')
        .getRawOne()
        .then((r) => Number(r?.sum ?? 0)),
      billBase.clone()
        .andWhere('b.status IN (:...statuses)', { statuses: ['overdue', 'partial'] })
        .andWhere('b.balance_amount > 0')
        .getCount(),
      billBase.clone().andWhere('b.status = :s', { s: 'overdue' }).getCount(),
      energySummaryPromise,
    ]);

    const roundedDemand = Math.round(monthlyDemand * 100) / 100;
    const roundedCollection = Math.round(monthlyCollection * 100) / 100;
    const roundedArrears = Math.round(outstandingArrears * 100) / 100;
    const monthlyOmCost = Math.round(Number(energySummary.energyCost ?? 0) * 100) / 100;

    const collectionEfficiency = roundedDemand > 0
      ? Math.round((roundedCollection / roundedDemand) * 1000) / 10
      : null;

    const revenueRealization = roundedDemand > 0
      ? Math.round(((roundedDemand - roundedArrears) / roundedDemand) * 1000) / 10
      : null;

    const nrwPct = collectionEfficiency != null
      ? Math.round((100 - collectionEfficiency) * 10) / 10
      : null;

    const costRecoveryRatioPct = monthlyOmCost > 0
      ? Math.round((roundedCollection / monthlyOmCost) * 1000) / 10
      : null;

    return {
      totalConsumers,
      activeConsumers,
      meteredConnections: meteredConsumers,
      unmeteredConnections: Math.max(0, activeConsumers - meteredConsumers),
      monthlyDemand: roundedDemand,
      monthlyCollection: roundedCollection,
      collectionEfficiencyPct: collectionEfficiency,
      outstandingArrears: roundedArrears,
      defaulterCount,
      overdueBills: overdueCount,
      revenueRealizationPct: revenueRealization,
      nrwPct,
      monthlyOmCost,
      costRecoveryRatioPct,
      omCostVsRevenue: {
        omCost: monthlyOmCost,
        revenue: roundedCollection,
        surplus: Math.round((roundedCollection - monthlyOmCost) * 100) / 100,
        revenueCoversOmCost: monthlyOmCost > 0 ? roundedCollection >= monthlyOmCost : null,
      },
      period: { from: monthStart, to: monthEnd },
      nrwThresholdPct: OM_NRW_EFFICIENCY_THRESHOLD_PCT,
    };
  }

  async listTariffs(
    tenantId: string,
    filters: { projectId?: string; projectCode?: string; status?: string },
    user?: JwtPayload,
  ) {
    const resolvedProjectId = user
      ? await this.resolveProjectId(user, tenantId, filters.projectId, filters.projectCode)
      : await this.resolveProjectIdUnscoped(tenantId, filters.projectId, filters.projectCode);
    const qb = this.tariffRepo.createQueryBuilder('t')
      .where('t.tenant_id = :tenantId', { tenantId })
      .orderBy('t.effectiveFrom', 'DESC')
      .take(100);

    await this.scopeTariffQb(qb, user, tenantId, resolvedProjectId);
    if (filters.status) qb.andWhere('t.status = :status', { status: filters.status });

    const rows = await qb.getMany();
    return Promise.all(rows.map((r) => this.toTariffRecord(tenantId, r)));
  }

  async createTariff(tenantId: string, userId: string, dto: CreateBillingTariffDto, user?: JwtPayload) {
    const resolvedProjectId = user
      ? await this.resolveProjectId(user, tenantId, dto.projectId, dto.projectCode)
      : await this.resolveProjectIdUnscoped(tenantId, dto.projectId, dto.projectCode);
    const count = await this.tariffRepo.count({ where: { tenantId } });
    const tariffCode = `TAR-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const record = this.tariffRepo.create({
      tenantId,
      createdBy: userId,
      tariffCode,
      tariffName: dto.tariffName.trim(),
      projectId: resolvedProjectId,
      consumerCategory: dto.consumerCategory ?? null,
      billingCycle: dto.billingCycle ?? 'monthly',
      fixedCharge: dto.fixedCharge ?? 0,
      serviceCharge: dto.serviceCharge ?? 0,
      maintenanceCharge: dto.maintenanceCharge ?? 0,
      meterRent: dto.meterRent ?? 0,
      latePenaltyPct: dto.latePenaltyPct ?? 2,
      reconnectionCharge: dto.reconnectionCharge ?? 0,
      newConnectionCharge: dto.newConnectionCharge ?? 0,
      taxPct: dto.taxPct ?? 0,
      slabs: dto.slabs?.length ? dto.slabs : DEFAULT_TARIFF_SLABS,
      effectiveFrom: dto.effectiveFrom,
      effectiveTo: dto.effectiveTo ?? null,
      status: 'active',
    });

    const saved = await this.tariffRepo.save(record);
    return this.toTariffRecord(tenantId, saved);
  }

  async listMeterReadings(
    tenantId: string,
    filters: { projectId?: string; projectCode?: string; consumerId?: string },
    user?: JwtPayload,
  ) {
    const resolvedProjectId = user
      ? await this.resolveProjectId(user, tenantId, filters.projectId, filters.projectCode)
      : await this.resolveProjectIdUnscoped(tenantId, filters.projectId, filters.projectCode);
    const qb = this.readingRepo.createQueryBuilder('r')
      .where('r.tenant_id = :tenantId', { tenantId })
      .orderBy('r.readingDate', 'DESC')
      .take(200);

    if (filters.consumerId) qb.andWhere('r.consumer_id = :consumerId', { consumerId: filters.consumerId });
    await this.scopeConsumerJoinQb(qb, user, tenantId, 'r', 'c', resolvedProjectId);

    const rows = await qb.getMany();
    return Promise.all(rows.map((r) => this.toReadingRecord(tenantId, r)));
  }

  async recordMeterReading(
    tenantId: string,
    userId: string,
    consumerId: string,
    dto: RecordMeterReadingDto,
    user?: JwtPayload,
  ) {
    const consumer = await this.ensureConsumer(tenantId, consumerId);
    if (user) await this.assertConsumerAccess(user, tenantId, consumer);
    const previous = dto.previousReading ?? await this.getLastReading(consumerId, dto.readingDate);

    const validation = validateMeterReading(previous, dto.currentReading, dto.meterCondition);
    if (!validation.valid) {
      throw new BadRequestException('Invalid meter reading — check negative or decreasing values');
    }

    const consumption = previous != null ? Math.round((dto.currentReading - previous) * 1000) / 1000 : 0;

    const existing = await this.readingRepo.findOne({
      where: { consumerId, readingDate: dto.readingDate },
    });
    if (existing) throw new BadRequestException('Reading already recorded for this date');

    const record = this.readingRepo.create({
      tenantId,
      consumerId,
      readingDate: dto.readingDate,
      readingMethod: dto.readingMethod ?? 'manual',
      previousReading: previous,
      currentReading: dto.currentReading,
      consumptionKl: consumption,
      latitude: dto.latitude ?? consumer.latitude,
      longitude: dto.longitude ?? consumer.longitude,
      meterCondition: dto.meterCondition ?? 'normal',
      photoUrl: dto.photoUrl?.trim() ?? null,
      validationFlags: validation.flags,
      isAbnormal: validation.isAbnormal,
      notes: dto.notes?.trim() ?? null,
      details: this.buildReadingMobileDetails(dto),
      recordedBy: userId,
    });

    const saved = await this.readingRepo.save(record);
    return this.toReadingRecord(tenantId, saved);
  }

  async listBills(
    tenantId: string,
    filters: { projectId?: string; projectCode?: string; consumerId?: string; status?: string },
    user?: JwtPayload,
  ) {
    const resolvedProjectId = user
      ? await this.resolveProjectId(user, tenantId, filters.projectId, filters.projectCode)
      : await this.resolveProjectIdUnscoped(tenantId, filters.projectId, filters.projectCode);
    const qb = this.billRepo.createQueryBuilder('b')
      .where('b.tenant_id = :tenantId', { tenantId })
      .orderBy('b.billingPeriodFrom', 'DESC')
      .take(200);

    await this.scopeProjectQb(qb, user, tenantId, 'b', resolvedProjectId);
    if (filters.consumerId) qb.andWhere('b.consumer_id = :consumerId', { consumerId: filters.consumerId });
    if (filters.status) qb.andWhere('b.status = :status', { status: filters.status });

    const rows = await qb.getMany();
    return Promise.all(rows.map((r) => this.toBillRecord(tenantId, r)));
  }

  async getBill(tenantId: string, id: string, user?: JwtPayload) {
    const row = await this.billRepo.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Bill not found');
    await this.assertBillAccess(user, tenantId, row);
    return this.toBillRecord(tenantId, row);
  }

  async generateBills(tenantId: string, userId: string, dto: GenerateBillsDto, user?: JwtPayload) {
    const resolvedProjectId = user
      ? await this.resolveProjectId(user, tenantId, dto.projectId, dto.projectCode)
      : await this.resolveProjectIdUnscoped(tenantId, dto.projectId, dto.projectCode);
    const cycle = (dto.billingCycle ?? 'monthly') as OmBillingCycle;
    const period = computeBillingPeriod(cycle);
    const billingPeriodFrom = dto.billingPeriodFrom ?? period.billingPeriodFrom;
    const billingPeriodTo = dto.billingPeriodTo ?? period.billingPeriodTo;
    const dueDate = dto.dueDate ?? period.dueDate;
    const generationDto: GenerateBillsDto = {
      ...dto,
      billingCycle: cycle,
      billingPeriodFrom,
      billingPeriodTo,
      dueDate,
    };

    const consumerQb = this.consumerRepo.createQueryBuilder('c')
      .where('c.tenant_id = :tenantId', { tenantId })
      .andWhere('c.connection_status = :status', { status: 'active' });

    await this.scopeProjectQb(consumerQb, user, tenantId, 'c', resolvedProjectId);

    const consumers = await consumerQb.getMany();
    const created: Array<Awaited<ReturnType<typeof this.toBillRecord>>> = [];

    for (const consumer of consumers) {
      const existing = await this.billRepo.findOne({
        where: {
          tenantId,
          consumerId: consumer.id,
          billingPeriodFrom,
          billingPeriodTo,
        },
      });
      if (existing) continue;

      const reading = await this.readingRepo.findOne({
        where: { tenantId, consumerId: consumer.id },
        order: { readingDate: 'DESC' },
      });
      if (!reading) continue;

      const tariff = await this.resolveTariff(tenantId, consumer, dto.tariffId, resolvedProjectId);
      const arrears = await this.getConsumerArrears(tenantId, consumer.id);
      const bill = await this.buildBill(
        tenantId, userId, consumer, tariff, reading, generationDto, arrears,
      );
      created.push(await this.toBillRecord(tenantId, bill));
    }

    return { generated: created.length, billingCycle: cycle, billingPeriodFrom, billingPeriodTo, bills: created };
  }

  async deliverBill(tenantId: string, billId: string, dto: DeliverBillDto, user?: JwtPayload) {
    const row = await this.billRepo.findOne({ where: { id: billId, tenantId } });
    if (!row) throw new NotFoundException('Bill not found');
    await this.assertBillAccess(user, tenantId, row);
    if (!['generated', 'approved', 'issued', 'paid', 'partial', 'overdue'].includes(row.status)) {
      throw new BadRequestException('Bill cannot be delivered in its current status');
    }

    const bill = await this.toBillRecord(tenantId, row);
    const consumer = await this.consumerRepo.findOne({ where: { id: row.consumerId, tenantId } });
    const sentAt = new Date().toISOString();
    const deliveries: Array<Record<string, unknown>> = [];
    const notifyText = this.buildBillNotifyText(bill);

    for (const channel of dto.channels) {
      if (channel === 'pdf') {
        deliveries.push({
          channel,
          label: 'Digital Bill PDF',
          status: 'ready',
          sentAt,
          message: `PDF ready for ${bill.billNo}`,
        });
        continue;
      }
      if (channel === 'sms') {
        if (!consumer?.mobile) {
          deliveries.push({
            channel,
            label: 'SMS Notification',
            status: 'failed',
            sentAt,
            reason: 'Consumer mobile number not registered',
          });
        } else {
          deliveries.push(this.mapNotifyResult(
            await this.notificationService.sendSms(consumer.mobile, notifyText),
            'SMS Notification',
            sentAt,
          ));
        }
        continue;
      }
      if (channel === 'whatsapp') {
        if (!consumer?.mobile) {
          deliveries.push({
            channel,
            label: 'WhatsApp Bill',
            status: 'failed',
            sentAt,
            reason: 'Consumer mobile number not registered',
          });
        } else {
          deliveries.push(this.mapNotifyResult(
            await this.notificationService.sendWhatsApp(consumer.mobile, notifyText),
            'WhatsApp Bill',
            sentAt,
          ));
        }
        continue;
      }
      if (channel === 'email') {
        const email = consumer?.consumerCode
          ? `${consumer.consumerCode.toLowerCase().replace(/[^a-z0-9]/g, '')}@egip.local`
          : null;
        if (!email) {
          deliveries.push({
            channel,
            label: 'Email Bill',
            status: 'failed',
            sentAt,
            reason: 'Consumer email not available',
          });
        } else {
          deliveries.push(this.mapNotifyResult(
            await this.notificationService.sendEmail(email, `Water Bill ${bill.billNo}`, notifyText),
            'Email Bill',
            sentAt,
          ));
        }
      }
    }

    const existingDetails = (row.details ?? {}) as Record<string, unknown>;
    const prior = Array.isArray(existingDetails.notifications) ? existingDetails.notifications as unknown[] : [];
    row.details = {
      ...existingDetails,
      workflowStep: 'notification',
      notifications: [...prior, ...deliveries],
    };
    if (row.status === 'generated' || row.status === 'approved') {
      row.status = 'issued';
      row.issuedAt = new Date();
    }
    await this.billRepo.save(row);

    if (row.status === 'issued') {
      await this.accountingService.postBillIssued(tenantId, null, row).catch(() => undefined);
    }

    if (consumer) {
      await this.consumerNotifications.notifyBillDelivered(
        tenantId,
        consumer,
        {
          id: row.id,
          billNo: bill.billNo,
          totalAmount: Number(bill.totalAmount ?? row.totalAmount),
          dueDate: bill.dueDate ?? (row.dueDate ? String(row.dueDate) : null),
          balanceAmount: Number(bill.balanceAmount ?? row.balanceAmount),
        },
        notifyText,
      ).catch(() => undefined);
    }

    return {
      billId,
      billNo: bill.billNo,
      deliveries,
      notificationConfig: this.notificationService.getConfigStatus(),
      bill: await this.toBillRecord(tenantId, row),
    };
  }

  private buildBillNotifyText(bill: Awaited<ReturnType<typeof this.toBillRecord>>): string {
    return [
      `EGIP Water Bill ${bill.billNo}`,
      `Consumer: ${bill.consumerCode ?? bill.fhtcNumber ?? ''}`,
      `Period: ${bill.billingPeriodFrom} to ${bill.billingPeriodTo}`,
      `Consumption: ${bill.consumptionKl} KL`,
      `Total Demand: ₹${bill.totalAmount}`,
      `Due Date: ${bill.dueDate ?? 'N/A'}`,
    ].join('\n');
  }

  private mapNotifyResult(
    result: NotificationSendResult,
    label: string,
    sentAt: string,
  ): Record<string, unknown> {
    if (result.status === 'sent') {
      return {
        channel: result.channel,
        label,
        status: 'sent',
        sentAt,
        destination: result.destination,
        provider: result.provider,
        message: result.message,
        externalId: result.externalId ?? null,
        note: `Delivered via ${result.provider}`,
      };
    }
    if (result.status === 'handoff') {
      return {
        channel: result.channel,
        label,
        status: 'handoff',
        sentAt,
        destination: result.destination,
        message: result.message,
        note: result.note ?? 'Open device app and tap Send.',
      };
    }
    return {
      channel: result.channel,
      label,
      status: 'failed',
      sentAt,
      destination: result.destination,
      reason: result.reason ?? 'Delivery failed',
    };
  }

  async updateBillStatus(
    tenantId: string,
    id: string,
    status: 'approved' | 'issued' | 'waived',
    user?: JwtPayload,
  ) {
    const bill = await this.billRepo.findOne({ where: { id, tenantId } });
    if (!bill) throw new NotFoundException('Bill not found');
    await this.assertBillAccess(user, tenantId, bill);

    if (status === 'approved' && bill.status !== 'generated') {
      throw new BadRequestException('Only generated bills can be approved');
    }
    if (status === 'issued' && !['approved', 'generated'].includes(bill.status)) {
      throw new BadRequestException('Bill cannot be issued from current status');
    }

    bill.status = status;
    if (status === 'issued') bill.issuedAt = new Date();
    const details = (bill.details ?? {}) as Record<string, unknown>;
    bill.details = {
      ...details,
      workflowStep: getWorkflowStepForBillStatus(status),
    };
    const saved = await this.billRepo.save(bill);

    if (status === 'issued') {
      await this.accountingService.postBillIssued(tenantId, null, saved).catch(() => undefined);
    } else if (status === 'waived') {
      await this.accountingService.postBillWaived(tenantId, null, saved).catch(() => undefined);
    }

    return this.toBillRecord(tenantId, saved);
  }

  async recordPayment(tenantId: string, userId: string, dto: RecordPaymentDto, user?: JwtPayload) {
    const consumer = await this.ensureConsumer(tenantId, dto.consumerId);
    if (user) await this.assertConsumerAccess(user, tenantId, consumer);

    const count = await this.paymentRepo.count({ where: { tenantId } });
    const receiptNo = `RCP-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;

    let ledgerUpdate: Record<string, unknown> | null = null;
    let demandAdjustment: Record<string, unknown> = {
      appliedAmount: dto.amount,
      note: 'General payment recorded',
    };

    if (dto.billId) {
      const bill = await this.billRepo.findOne({ where: { id: dto.billId, tenantId } });
      if (bill) {
        await this.assertBillAccess(user, tenantId, bill);
        const balanceBefore = Number(bill.balanceAmount);
        ledgerUpdate = {
          billId: bill.id,
          billNo: bill.billNo,
          balanceBefore,
          balanceAfter: Math.max(0, balanceBefore - dto.amount),
        };
        demandAdjustment = {
          appliedAmount: dto.amount,
          billNo: bill.billNo,
          balanceBefore,
          balanceAfter: Math.max(0, balanceBefore - dto.amount),
        };
      }
    }

    const acknowledgement = {
      receiptNo,
      message: `Payment of ₹${dto.amount} received via ${dto.paymentMode}. Receipt ${receiptNo} generated.`,
      generatedAt: new Date().toISOString(),
    };

    const payment = this.paymentRepo.create({
      tenantId,
      consumerId: dto.consumerId,
      billId: dto.billId ?? null,
      receiptNo,
      paymentDate: dto.paymentDate,
      paymentMode: dto.paymentMode,
      amount: dto.amount,
      transactionRef: dto.transactionRef?.trim() ?? null,
      notes: dto.notes?.trim() ?? null,
      collectedBy: userId,
      details: {
        workflow: OM_COLLECTION_WORKFLOW,
        workflowStep: 'ledger_update',
        acknowledgement,
        ledgerUpdate,
        demandAdjustment,
        mobileCapture: this.buildPaymentMobileCapture(dto),
      },
    });

    const saved = await this.paymentRepo.save(payment);

    if (dto.billId) {
      const bill = await this.billRepo.findOne({ where: { id: dto.billId, tenantId } });
      if (bill) {
        bill.amountPaid = Number(bill.amountPaid) + dto.amount;
        bill.balanceAmount = Math.max(0, Number(bill.totalAmount) - Number(bill.amountPaid));
        if (bill.balanceAmount <= 0) {
          bill.status = 'paid';
          bill.paidAt = new Date();
          bill.balanceAmount = 0;
        } else {
          bill.status = 'partial';
        }
        await this.billRepo.save(bill);
        if (ledgerUpdate) {
          ledgerUpdate.billStatus = bill.status;
          ledgerUpdate.balanceAfter = Number(bill.balanceAmount);
        }
      }
    }

    const notifyText = [
      `EGIP Payment Acknowledgement`,
      `Receipt: ${receiptNo}`,
      `Amount: ₹${dto.amount}`,
      `Mode: ${dto.paymentMode}`,
      `Date: ${dto.paymentDate}`,
      acknowledgement.message,
    ].join('\n');

    const notification = consumer.mobile
      ? await this.notificationService.sendSms(consumer.mobile, notifyText)
      : { channel: 'sms' as const, status: 'failed' as const, destination: null, provider: null, message: notifyText, reason: 'Consumer mobile not registered' };

    saved.details = {
      ...(saved.details ?? {}),
      workflowStep: 'notification',
      ledgerUpdate,
      demandAdjustment,
      acknowledgement,
      notification: {
        channel: notification.channel,
        status: notification.status,
        destination: notification.destination,
        provider: notification.provider,
        note: notification.note ?? notification.reason ?? 'Payment acknowledgement sent',
      },
    };
    await this.paymentRepo.save(saved);

    await this.consumerNotifications.notifyPaymentReceived(
      tenantId,
      consumer,
      { receiptNo, amount: dto.amount, paymentMode: dto.paymentMode },
      notifyText,
    ).catch(() => undefined);

    await this.accountingService.postPaymentReceived(tenantId, userId, saved).catch(() => undefined);

    return this.toPaymentRecord(tenantId, saved);
  }

  async getPayment(tenantId: string, id: string, user?: JwtPayload) {
    const row = await this.paymentRepo.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Payment not found');
    const consumer = await this.consumerRepo.findOne({ where: { id: row.consumerId, tenantId } });
    if (user && consumer) await this.assertConsumerAccess(user, tenantId, consumer);
    return this.toPaymentRecord(tenantId, row);
  }

  async generateRevenueRegister(
    tenantId: string,
    filters: { projectId?: string; projectCode?: string; periodFrom?: string; periodTo?: string },
    user?: JwtPayload,
  ) {
    const resolvedProjectId = user
      ? await this.resolveProjectId(user, tenantId, filters.projectId, filters.projectCode)
      : await this.resolveProjectIdUnscoped(tenantId, filters.projectId, filters.projectCode);
    const defaultPeriod = computeBillingPeriod('monthly');
    const periodFrom = filters.periodFrom ?? defaultPeriod.billingPeriodFrom;
    const periodTo = filters.periodTo ?? defaultPeriod.billingPeriodTo;

    const qb = this.paymentRepo.createQueryBuilder('p')
      .where('p.tenant_id = :tenantId', { tenantId })
      .andWhere('p.payment_date >= :periodFrom', { periodFrom })
      .andWhere('p.payment_date <= :periodTo', { periodTo })
      .orderBy('p.paymentDate', 'DESC');

    await this.scopeConsumerJoinQb(qb, user, tenantId, 'p', 'c', resolvedProjectId);

    const payments = await qb.getMany();
    const records = await Promise.all(payments.map((p) => this.toPaymentRecord(tenantId, p)));

    const byMode = new Map<string, { paymentMode: string; paymentModeLabel: string; count: number; amount: number }>();
    for (const p of records) {
      const mode = String(p.paymentMode);
      const label = String(p.paymentModeLabel ?? mode);
      const entry = byMode.get(mode) ?? { paymentMode: mode, paymentModeLabel: label, count: 0, amount: 0 };
      entry.count += 1;
      entry.amount = Math.round((entry.amount + Number(p.amount)) * 100) / 100;
      byMode.set(mode, entry);
    }

    const totalCollection = records.reduce((s, p) => s + Number(p.amount), 0);

    return {
      generatedAt: new Date().toISOString(),
      periodFrom,
      periodTo,
      summary: {
        totalReceipts: records.length,
        totalCollection: Math.round(totalCollection * 100) / 100,
        byMode: [...byMode.values()],
      },
      rows: records,
    };
  }

  async listPayments(
    tenantId: string,
    filters: { projectId?: string; projectCode?: string; consumerId?: string },
    user?: JwtPayload,
  ) {
    const resolvedProjectId = user
      ? await this.resolveProjectId(user, tenantId, filters.projectId, filters.projectCode)
      : await this.resolveProjectIdUnscoped(tenantId, filters.projectId, filters.projectCode);
    const qb = this.paymentRepo.createQueryBuilder('p')
      .where('p.tenant_id = :tenantId', { tenantId })
      .orderBy('p.paymentDate', 'DESC')
      .take(200);

    if (filters.consumerId) qb.andWhere('p.consumer_id = :consumerId', { consumerId: filters.consumerId });
    await this.scopeConsumerJoinQb(qb, user, tenantId, 'p', 'c', resolvedProjectId);

    const rows = await qb.getMany();
    return Promise.all(rows.map((r) => this.toPaymentRecord(tenantId, r)));
  }

  async getDemandRegister(
    tenantId: string,
    filters: {
      projectId?: string;
      projectCode?: string;
      village?: string;
      groupBy?: OmDemandGroupBy;
      periodFrom?: string;
      periodTo?: string;
    },
    user?: JwtPayload,
  ) {
    return this.generateDemandRegister(tenantId, filters, user);
  }

  async generateDemandRegister(
    tenantId: string,
    filters: {
      projectId?: string;
      projectCode?: string;
      village?: string;
      groupBy?: OmDemandGroupBy;
      periodFrom?: string;
      periodTo?: string;
    },
    user?: JwtPayload,
  ) {
    const resolvedProjectId = user
      ? await this.resolveProjectId(user, tenantId, filters.projectId, filters.projectCode)
      : await this.resolveProjectIdUnscoped(tenantId, filters.projectId, filters.projectCode);
    const defaultPeriod = computeBillingPeriod('monthly');
    const periodFrom = filters.periodFrom ?? defaultPeriod.billingPeriodFrom;
    const periodTo = filters.periodTo ?? defaultPeriod.billingPeriodTo;
    const groupBy = filters.groupBy ?? 'village';
    const today = new Date().toISOString().slice(0, 10);

    const billQb = this.billRepo.createQueryBuilder('b').where('b.tenant_id = :tenantId', { tenantId });
    await this.scopeProjectQb(billQb, user, tenantId, 'b', resolvedProjectId);
    const billRows = await billQb.getMany();

    const paymentQb = this.paymentRepo.createQueryBuilder('p').where('p.tenant_id = :tenantId', { tenantId });
    await this.scopeConsumerJoinQb(paymentQb, user, tenantId, 'p', 'c', resolvedProjectId);
    const paymentRows = await paymentQb.getMany();

    const consumerQb = this.consumerRepo.createQueryBuilder('c').where('c.tenant_id = :tenantId', { tenantId });
    await this.scopeProjectQb(consumerQb, user, tenantId, 'c', resolvedProjectId);
    const consumerRows = await consumerQb.getMany();

    const consumerMap = new Map(consumerRows.map((c) => [c.id, c]));
    const projectCodes = new Map<string, string>();
    for (const c of consumerRows) {
      if (c.projectId && !projectCodes.has(c.projectId)) {
        const project = await this.projectRepo.findOne({ where: { id: c.projectId, tenantId } });
        if (project) projectCodes.set(c.projectId, project.projectCode);
      }
    }

    type DemandRow = {
      key: string;
      label: string;
      openingDemand: number;
      currentDemand: number;
      collection: number;
      balance: number;
      arrears: number;
      billCount: number;
    };

    const rows = new Map<string, DemandRow>();

    const ensureRow = (key: string, label: string): DemandRow => {
      const existing = rows.get(key);
      if (existing) return existing;
      const row: DemandRow = {
        key,
        label,
        openingDemand: 0,
        currentDemand: 0,
        collection: 0,
        balance: 0,
        arrears: 0,
        billCount: 0,
      };
      rows.set(key, row);
      return row;
    };

    const resolveGroup = (
      consumerId: string,
      bill?: { projectId?: string | null; billingPeriodFrom?: string },
    ): { key: string; label: string } => {
      const consumer = consumerMap.get(consumerId);
      if (groupBy === 'consumer') {
        return {
          key: consumerId,
          label: consumer?.consumerCode ?? consumer?.fhtcNumber ?? consumerId,
        };
      }
      if (groupBy === 'scheme') {
        const projectId = bill?.projectId ?? consumer?.projectId ?? 'unassigned';
        return {
          key: projectId,
          label: projectCodes.get(projectId) ?? 'Unassigned Scheme',
        };
      }
      if (groupBy === 'month') {
        const monthKey = bill?.billingPeriodFrom?.slice(0, 7) ?? periodFrom.slice(0, 7);
        return { key: monthKey, label: monthKey };
      }
      const village = consumer?.village?.trim() || 'Unknown';
      return { key: village, label: village };
    };

    for (const bill of billRows) {
      const { key, label } = resolveGroup(bill.consumerId, bill);
      const row = ensureRow(key, label);
      const total = Number(bill.totalAmount);
      const balance = Number(bill.balanceAmount);
      const periodEnd = String(bill.billingPeriodTo);
      const periodStart = String(bill.billingPeriodFrom);

      if (periodEnd < periodFrom && balance > 0) {
        row.openingDemand = Math.round((row.openingDemand + balance) * 100) / 100;
      }
      if (periodStart >= periodFrom && periodEnd <= periodTo) {
        row.currentDemand = Math.round((row.currentDemand + total) * 100) / 100;
        row.billCount += 1;
      }
      if (balance > 0) {
        row.balance = Math.round((row.balance + balance) * 100) / 100;
        const dueDate = bill.dueDate ? String(bill.dueDate) : null;
        if (dueDate && dueDate < today && ['issued', 'overdue', 'partial'].includes(bill.status)) {
          row.arrears = Math.round((row.arrears + balance) * 100) / 100;
        }
      }
    }

    for (const payment of paymentRows) {
      const payDate = String(payment.paymentDate);
      if (payDate < periodFrom || payDate > periodTo) continue;
      const { key, label } = resolveGroup(payment.consumerId);
      const row = ensureRow(key, label);
      row.collection = Math.round((row.collection + Number(payment.amount)) * 100) / 100;
    }

    let resultRows = [...rows.values()].sort((a, b) => a.label.localeCompare(b.label));
    if (filters.village) {
      resultRows = resultRows.filter((r) => r.label.toLowerCase().includes(filters.village!.toLowerCase()));
    }

    const summary = resultRows.reduce(
      (acc, r) => ({
        openingDemand: Math.round((acc.openingDemand + r.openingDemand) * 100) / 100,
        currentDemand: Math.round((acc.currentDemand + r.currentDemand) * 100) / 100,
        collection: Math.round((acc.collection + r.collection) * 100) / 100,
        balance: Math.round((acc.balance + r.balance) * 100) / 100,
        arrears: Math.round((acc.arrears + r.arrears) * 100) / 100,
      }),
      { openingDemand: 0, currentDemand: 0, collection: 0, balance: 0, arrears: 0 },
    );

    const viewDef = OM_DEMAND_REGISTER_VIEWS.find((v) => v.code === groupBy);

    return {
      generatedAt: new Date().toISOString(),
      periodFrom,
      periodTo,
      groupBy,
      groupByLabel: viewDef?.label ?? groupBy,
      summary,
      rows: resultRows,
    };
  }

  async getArrears(
    tenantId: string,
    filters: { projectId?: string; projectCode?: string; bucket?: string },
    user?: JwtPayload,
  ) {
    return this.getArrearManagement(tenantId, filters, user);
  }

  async getArrearManagement(
    tenantId: string,
    filters: { projectId?: string; projectCode?: string; bucket?: string },
    user?: JwtPayload,
  ) {
    const rows = await this.buildArrearRows(tenantId, filters, user);
    const filteredRows = filters.bucket?.trim()
      ? rows.filter((r) => r.arrearBucket === filters.bucket)
      : rows;

    const byBucket = OM_ARREAR_BUCKETS.map((bucket) => {
      const bucketRows = rows.filter((r) => r.arrearBucket === bucket.code);
      return {
        ...bucket,
        count: bucketRows.length,
        amount: Math.round(bucketRows.reduce((s, r) => s + Number(r.balanceAmount ?? 0), 0) * 100) / 100,
        consumerCount: new Set(bucketRows.map((r) => r.consumerId)).size,
      };
    });

    const agingRows = this.buildConsumerAgingRows(rows);
    const defaulterRows = agingRows.filter((a) => Number(a.maxDaysOverdue) >= 30);
    const totalArrearAmount = Math.round(
      rows.reduce((s, r) => s + Number(r.balanceAmount ?? 0), 0) * 100,
    ) / 100;

    return {
      generatedAt: new Date().toISOString(),
      summary: {
        totalUnpaidBills: rows.length,
        totalArrearAmount,
        defaulterCount: defaulterRows.length,
        consumerCount: new Set(rows.map((r) => r.consumerId)).size,
        byBucket,
      },
      rows: filteredRows,
      agingRows,
      defaulterRows,
      arrearBuckets: OM_ARREAR_BUCKETS,
      arrearActions: OM_ARREAR_ACTIONS,
    };
  }

  async sendArrearAction(tenantId: string, userId: string, billId: string, dto: ArrearActionDto, user?: JwtPayload) {
    const row = await this.billRepo.findOne({ where: { id: billId, tenantId } });
    if (!row) throw new NotFoundException('Bill not found');
    await this.assertBillAccess(user, tenantId, row);

    const bill = await this.toBillRecord(tenantId, row);
    if ((bill.balanceAmount ?? 0) <= 0) {
      throw new BadRequestException('Bill has no outstanding balance');
    }

    const consumer = await this.consumerRepo.findOne({ where: { id: row.consumerId, tenantId } });
    if (!consumer?.mobile) {
      throw new BadRequestException('Consumer mobile number not registered for reminders');
    }

    const actionDef = OM_ARREAR_ACTIONS.find((a) => a.code === dto.action);
    if (!actionDef) throw new BadRequestException('Unsupported arrear action');

    const daysOverdue = this.computeDaysOverdue(bill.dueDate);
    const message = this.buildArrearActionMessage(dto.action, bill, daysOverdue);
    const sentAt = new Date().toISOString();

    const notifyResult = actionDef.channel === 'whatsapp'
      ? await this.notificationService.sendWhatsApp(consumer.mobile, message)
      : await this.notificationService.sendSms(consumer.mobile, message);

    const delivery = this.mapNotifyResult(notifyResult, actionDef.label, sentAt);
    const details = (row.details ?? {}) as Record<string, unknown>;
    const arrearActions = Array.isArray(details.arrearActions) ? [...details.arrearActions] : [];
    arrearActions.push({
      action: dto.action,
      actionLabel: actionDef.label,
      sentAt,
      sentBy: userId,
      daysOverdue,
      balanceAmount: Number(row.balanceAmount),
      ...delivery,
    });

    row.details = { ...details, arrearActions };
    if (dto.action === 'disconnection_notice' && row.status === 'issued') {
      row.status = 'overdue';
    }
    if (dto.action === 'demand_notice' && ['issued', 'partial'].includes(row.status)) {
      row.status = 'overdue';
    }
    await this.billRepo.save(row);

    if (consumer) {
      await this.consumerNotifications.notifyArrearReminder(
        tenantId,
        consumer,
        {
          id: row.id,
          billNo: row.billNo,
          balanceAmount: Number(row.balanceAmount),
          dueDate: bill.dueDate ?? null,
        },
        dto.action,
        message,
      ).catch(() => undefined);
    }

    return {
      billId: row.id,
      billNo: row.billNo,
      action: dto.action,
      actionLabel: actionDef.label,
      daysOverdue,
      notification: delivery,
      notificationConfig: this.notificationService.getConfigStatus(),
      bill: await this.toBillRecord(tenantId, row),
    };
  }

  private async buildArrearRows(
    tenantId: string,
    filters: { projectId?: string; projectCode?: string },
    user?: JwtPayload,
  ) {
    const bills = await this.listBills(tenantId, {
      projectId: filters.projectId,
      projectCode: filters.projectCode,
      status: undefined,
    }, user);

    const overdue = bills.filter(
      (b) => (b.balanceAmount ?? 0) > 0 && ['issued', 'overdue', 'partial'].includes(String(b.status)),
    );

    return overdue.map((b) => {
      const daysOverdue = this.computeDaysOverdue(b.dueDate);
      const bucket = getArrearBucket(daysOverdue);
      const bucketDef = bucket ? OM_ARREAR_BUCKETS.find((x) => x.code === bucket) : null;
      return {
        ...b,
        daysOverdue,
        arrearBucket: bucket,
        arrearBucketLabel: bucketDef?.label ?? (daysOverdue > 0 ? 'Current' : '—'),
        isDefaulter: daysOverdue >= 30,
      };
    }).sort((a, b) => Number(b.daysOverdue) - Number(a.daysOverdue));
  }

  private buildConsumerAgingRows(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
    const byConsumer = new Map<string, Record<string, unknown>>();

    for (const row of rows) {
      const consumerId = String(row.consumerId);
      const existing = byConsumer.get(consumerId) ?? {
        consumerId,
        consumerCode: row.consumerCode,
        fhtcNumber: row.fhtcNumber,
        consumerName: row.consumerName,
        village: row.village,
        mobile: row.mobile,
        totalArrear: 0,
        maxDaysOverdue: 0,
        oldestDueDate: row.dueDate,
        billCount: 0,
        bills: [] as Array<Record<string, unknown>>,
      };

      existing.totalArrear = Math.round((Number(existing.totalArrear) + Number(row.balanceAmount ?? 0)) * 100) / 100;
      existing.maxDaysOverdue = Math.max(Number(existing.maxDaysOverdue), Number(row.daysOverdue ?? 0));
      if (row.dueDate && (!existing.oldestDueDate || String(row.dueDate) < String(existing.oldestDueDate))) {
        existing.oldestDueDate = row.dueDate;
      }
      existing.billCount = Number(existing.billCount) + 1;
      (existing.bills as Array<Record<string, unknown>>).push({
        billId: row.id,
        billNo: row.billNo,
        balanceAmount: row.balanceAmount,
        dueDate: row.dueDate,
        daysOverdue: row.daysOverdue,
        arrearBucket: row.arrearBucket,
        arrearBucketLabel: row.arrearBucketLabel,
      });
      byConsumer.set(consumerId, existing);
    }

    return [...byConsumer.values()]
      .map((entry) => {
        const bucket = getArrearBucket(Number(entry.maxDaysOverdue));
        const bucketDef = bucket ? OM_ARREAR_BUCKETS.find((x) => x.code === bucket) : null;
        return {
          ...entry,
          arrearBucket: bucket,
          arrearBucketLabel: bucketDef?.label ?? '—',
          isDefaulter: Number(entry.maxDaysOverdue) >= 30,
        } as Record<string, unknown>;
      })
      .sort((a, b) => Number(b.maxDaysOverdue) - Number(a.maxDaysOverdue));
  }

  private computeDaysOverdue(dueDate?: string | null): number {
    const today = new Date();
    const due = dueDate ? new Date(dueDate) : today;
    return Math.max(0, Math.floor((today.getTime() - due.getTime()) / (24 * 60 * 60 * 1000)));
  }

  private buildArrearActionMessage(
    action: string,
    bill: Awaited<ReturnType<typeof this.toBillRecord>>,
    daysOverdue: number,
  ): string {
    const balance = bill.balanceAmount ?? 0;
    const consumerRef = bill.fhtcNumber ?? bill.consumerCode ?? '';
    switch (action) {
      case 'reminder_sms':
        return [
          'EGIP Payment Reminder',
          `Bill: ${bill.billNo}`,
          `FHTC: ${consumerRef}`,
          `Outstanding: ₹${balance}`,
          `Due date: ${bill.dueDate ?? 'N/A'}`,
          'Please pay promptly to avoid penalty.',
        ].join('\n');
      case 'whatsapp_reminder':
        return [
          'EGIP Water Bill Reminder',
          `Bill ${bill.billNo} for FHTC ${consumerRef}`,
          `Balance due: ₹${balance}`,
          `Overdue by ${daysOverdue} day(s).`,
          'Pay at the nearest collection centre or CSC.',
        ].join('\n');
      case 'demand_notice':
        return [
          'EGIP DEMAND NOTICE',
          `Consumer: ${bill.consumerCode ?? consumerRef}`,
          `Bill: ${bill.billNo}`,
          `Outstanding demand: ₹${balance}`,
          `Overdue: ${daysOverdue} day(s)`,
          'Pay within 7 days to avoid further recovery action.',
        ].join('\n');
      case 'disconnection_notice':
        return [
          'EGIP DISCONNECTION NOTICE',
          `FHTC: ${consumerRef}`,
          `Outstanding: ₹${balance} on bill ${bill.billNo}`,
          'Water supply will be disconnected unless payment is received within 48 hours.',
          'Contact the scheme office immediately.',
        ].join('\n');
      default:
        return `EGIP Arrear Notice: Bill ${bill.billNo}, balance ₹${balance}.`;
    }
  }

  async getGisRevenueAnalytics(
    tenantId: string,
    filters: { projectId?: string; projectCode?: string },
    user?: JwtPayload,
  ) {
    const resolvedProjectId = user
      ? await this.resolveProjectId(user, tenantId, filters.projectId, filters.projectCode)
      : await this.resolveProjectIdUnscoped(tenantId, filters.projectId, filters.projectCode);
    const consumerQb = this.consumerRepo.createQueryBuilder('c')
      .where('c.tenant_id = :tenantId', { tenantId })
      .andWhere('c.latitude IS NOT NULL')
      .andWhere('c.longitude IS NOT NULL');

    await this.scopeProjectQb(consumerQb, user, tenantId, 'c', resolvedProjectId);

    const consumers = await consumerQb.take(500).getMany();
    const consumerIds = consumers.map((c) => c.id);

    const latestBills = consumerIds.length
      ? await this.billRepo.createQueryBuilder('b')
        .distinctOn(['b.consumer_id'])
        .where('b.tenant_id = :tenantId', { tenantId })
        .andWhere('b.consumer_id IN (:...consumerIds)', { consumerIds })
        .orderBy('b.consumer_id', 'ASC')
        .addOrderBy('b.billing_period_from', 'DESC')
        .getMany()
      : [];
    const billByConsumer = new Map(latestBills.map((b) => [b.consumerId, b]));

    const readingQb = this.readingRepo.createQueryBuilder('r')
      .where('r.tenant_id = :tenantId', { tenantId })
      .andWhere('r.latitude IS NOT NULL')
      .andWhere('r.longitude IS NOT NULL')
      .orderBy('r.reading_date', 'DESC')
      .take(500);
    if (resolvedProjectId && consumerIds.length) {
      readingQb.andWhere('r.consumer_id IN (:...consumerIds)', { consumerIds });
    } else if (resolvedProjectId) {
      readingQb.andWhere('1 = 0');
    }
    const meterReadings = await readingQb.getMany();
    const consumerById = new Map(consumers.map((c) => [c.id, c]));

    const mapMarkers = consumers.map((c) => {
      const latestBill = billByConsumer.get(c.id);
      const balance = latestBill ? Number(latestBill.balanceAmount) : 0;
      const billingStatus = latestBill?.status ?? 'none';
      const isDefaulter = latestBill != null
        && balance > 0
        && ['overdue', 'partial', 'issued'].includes(billingStatus);

      let collectionStatus: 'collected' | 'partial' | 'pending' | 'none' = 'none';
      if (billingStatus === 'paid') collectionStatus = 'collected';
      else if (billingStatus === 'partial') collectionStatus = 'partial';
      else if (['issued', 'overdue'].includes(billingStatus)) collectionStatus = 'pending';

      const layers: string[] = ['fhtc', 'billing', 'collection'];
      if (c.meterNumber) layers.push('meter');
      if (isDefaulter) layers.push('defaulter');

      return {
        id: c.id,
        consumerId: c.id,
        consumerCode: c.consumerCode,
        fhtcNumber: c.fhtcNumber,
        consumerName: c.consumerName,
        village: c.village,
        latitude: Number(c.latitude),
        longitude: Number(c.longitude),
        meterNumber: c.meterNumber,
        connectionStatus: c.connectionStatus,
        billingStatus,
        collectionStatus,
        balanceAmount: balance,
        isDefaulter,
        layers,
      };
    });

    const meterLocations = meterReadings.map((r) => {
      const consumer = consumerById.get(r.consumerId);
      return {
        id: r.id,
        consumerId: r.consumerId,
        consumerCode: consumer?.consumerCode ?? null,
        fhtcNumber: consumer?.fhtcNumber ?? null,
        village: consumer?.village ?? null,
        latitude: Number(r.latitude),
        longitude: Number(r.longitude),
        readingDate: r.readingDate,
        currentReading: Number(r.currentReading),
        layers: ['meter'],
      };
    });

    const villages = await this.generateDemandRegister(tenantId, filters, user);
    const villageAnalytics = villages.rows.map((v) => ({
      village: v.label,
      demand: v.currentDemand,
      collection: v.collection,
      balance: v.balance,
      count: v.billCount,
      collectionEfficiencyPct: v.currentDemand > 0
        ? Math.round((v.collection / v.currentDemand) * 1000) / 10
        : null,
    }));

    const totalDemand = villages.summary.currentDemand;
    const totalCollection = villages.summary.collection;

    const defaulterMarkers = mapMarkers.filter((m) => m.isDefaulter);
    const defaulterClusterMap = new Map<string, {
      village: string;
      count: number;
      totalBalance: number;
      latitude: number;
      longitude: number;
    }>();
    for (const m of defaulterMarkers) {
      const key = (m.village ?? 'Unassigned').trim() || 'Unassigned';
      const existing = defaulterClusterMap.get(key);
      if (!existing) {
        defaulterClusterMap.set(key, {
          village: key,
          count: 1,
          totalBalance: m.balanceAmount,
          latitude: m.latitude,
          longitude: m.longitude,
        });
      } else {
        existing.count += 1;
        existing.totalBalance += m.balanceAmount;
        existing.latitude = (existing.latitude + m.latitude) / 2;
        existing.longitude = (existing.longitude + m.longitude) / 2;
      }
    }
    const defaulterClusters = [...defaulterClusterMap.values()]
      .sort((a, b) => b.totalBalance - a.totalBalance);

    const nrwZones = villageAnalytics
      .filter((v) => v.collectionEfficiencyPct != null && v.collectionEfficiencyPct < OM_NRW_EFFICIENCY_THRESHOLD_PCT)
      .sort((a, b) => (a.collectionEfficiencyPct ?? 0) - (b.collectionEfficiencyPct ?? 0));

    const heatCellMap = new Map<string, {
      cellKey: string;
      latitude: number;
      longitude: number;
      totalBalance: number;
      totalDemand: number;
      consumerCount: number;
    }>();
    for (const m of mapMarkers) {
      const gridLat = Math.round(m.latitude * 40) / 40;
      const gridLng = Math.round(m.longitude * 40) / 40;
      const cellKey = `${gridLat},${gridLng}`;
      const existing = heatCellMap.get(cellKey);
      if (!existing) {
        heatCellMap.set(cellKey, {
          cellKey,
          latitude: gridLat,
          longitude: gridLng,
          totalBalance: m.balanceAmount,
          totalDemand: m.balanceAmount,
          consumerCount: 1,
        });
      } else {
        existing.totalBalance += m.balanceAmount;
        existing.totalDemand += m.balanceAmount;
        existing.consumerCount += 1;
      }
    }
    const maxHeat = Math.max(...[...heatCellMap.values()].map((c) => c.totalBalance), 1);
    const revenueHeatMap = [...heatCellMap.values()]
      .map((c) => ({
        ...c,
        intensity: Math.round((c.totalBalance / maxHeat) * 1000) / 1000,
      }))
      .sort((a, b) => b.totalBalance - a.totalBalance);

    const bounds = mapMarkers.length
      ? {
        minLat: Math.min(...mapMarkers.map((m) => m.latitude)),
        maxLat: Math.max(...mapMarkers.map((m) => m.latitude)),
        minLng: Math.min(...mapMarkers.map((m) => m.longitude)),
        maxLng: Math.max(...mapMarkers.map((m) => m.longitude)),
      }
      : null;

    return {
      layers: OM_GIS_REVENUE_LAYERS,
      mapMarkers,
      meterLocations,
      villageAnalytics,
      defaulterClusters,
      nrwZones,
      revenueHeatMap,
      bounds,
      summary: {
        mapFeatures: mapMarkers.length,
        meterLocations: meterLocations.length,
        defaulterCount: defaulterMarkers.length,
        defaulterClusters: defaulterClusters.length,
        nrwZoneCount: nrwZones.length,
        collectionEfficiencyPct: totalDemand > 0
          ? Math.round((totalCollection / totalDemand) * 1000) / 10
          : null,
        nrwThresholdPct: OM_NRW_EFFICIENCY_THRESHOLD_PCT,
      },
    };
  }

  async createConsumerAccount(tenantId: string, userId: string, dto: CreateConsumerAccountDto, user?: JwtPayload) {
    const resolvedProjectId = user
      ? await this.resolveProjectId(user, tenantId, dto.projectId, dto.projectCode)
      : await this.resolveProjectIdUnscoped(tenantId, dto.projectId, dto.projectCode);
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
      connectionStatus: dto.connectionStatus ?? 'active',
      tariffId: dto.tariffId ?? null,
    });

    const saved = await this.consumerRepo.save(record);
    return this.toAccountRecord(tenantId, saved);
  }

  async linkConsumerAccount(tenantId: string, consumerId: string, dto: LinkConsumerAccountDto, user?: JwtPayload) {
    const consumer = await this.ensureConsumer(tenantId, consumerId);
    if (user) await this.assertConsumerAccess(user, tenantId, consumer);
    if (dto.consumerName !== undefined) consumer.consumerName = dto.consumerName.trim() || null;
    if (dto.mobile !== undefined) consumer.mobile = dto.mobile.trim() || null;
    if (dto.village !== undefined) consumer.village = dto.village.trim() || null;
    if (dto.consumerCategory) consumer.consumerCategory = dto.consumerCategory;
    if (dto.ward !== undefined) consumer.ward = dto.ward.trim() || null;
    if (dto.aadhaarLast4 !== undefined) consumer.aadhaarLast4 = dto.aadhaarLast4.trim() || null;
    if (dto.tariffId !== undefined) consumer.tariffId = dto.tariffId || null;
    if (dto.meterNumber !== undefined) consumer.meterNumber = dto.meterNumber.trim() || null;
    if (dto.connectionStatus) consumer.connectionStatus = dto.connectionStatus;
    if (dto.latitude !== undefined || dto.longitude !== undefined) {
      this.validateCoordinates(
        dto.latitude ?? consumer.latitude ?? undefined,
        dto.longitude ?? consumer.longitude ?? undefined,
      );
      if (dto.latitude !== undefined) consumer.latitude = dto.latitude ?? null;
      if (dto.longitude !== undefined) consumer.longitude = dto.longitude ?? null;
    }
    await this.consumerRepo.save(consumer);
    return this.toAccountRecord(tenantId, consumer);
  }

  async generateReport(
    tenantId: string,
    reportType: string,
    filters: { projectId?: string; projectCode?: string; from?: string; to?: string; periodFrom?: string; periodTo?: string },
    user?: JwtPayload,
  ) {
    const def = OM_BILLING_REPORT_TYPES.find((r) => r.type === reportType);
    if (!def) throw new BadRequestException('Invalid billing report type');

    const periodFilters = {
      ...filters,
      from: filters.from ?? filters.periodFrom,
      to: filters.to ?? filters.periodTo,
      periodFrom: filters.periodFrom ?? filters.from,
      periodTo: filters.periodTo ?? filters.to,
    };

    const meta = {
      reportType,
      title: def.label,
      generatedAt: new Date().toISOString(),
      period: { from: periodFilters.from, to: periodFilters.to },
    };

    switch (reportType) {
      case 'consumer_register':
        return { ...meta, rows: await this.listConsumerAccounts(tenantId, periodFilters, user) };
      case 'meter_register':
        return { ...meta, rows: await this.listMeterReadings(tenantId, periodFilters, user) };
      case 'billing_register':
        return { ...meta, rows: await this.listBills(tenantId, periodFilters, user) };
      case 'demand_register':
        return { ...meta, ...(await this.generateDemandRegister(tenantId, { ...periodFilters, groupBy: 'village' }, user)) };
      case 'village_wise_demand':
        return { ...meta, ...(await this.generateDemandRegister(tenantId, { ...periodFilters, groupBy: 'village' }, user)) };
      case 'scheme_wise_demand':
        return { ...meta, ...(await this.generateDemandRegister(tenantId, { ...periodFilters, groupBy: 'scheme' }, user)) };
      case 'consumer_wise_demand':
        return { ...meta, ...(await this.generateDemandRegister(tenantId, { ...periodFilters, groupBy: 'consumer' }, user)) };
      case 'monthly_demand_register':
        return { ...meta, ...(await this.generateDemandRegister(tenantId, { ...periodFilters, groupBy: 'month' }, user)) };
      case 'collection_register': {
        const payments = await this.listPayments(tenantId, periodFilters, user);
        const filtered = this.filterByPeriod(payments, periodFilters, 'paymentDate');
        const byMode = new Map<string, { mode: string; count: number; amount: number }>();
        for (const p of filtered) {
          const mode = String(p.paymentModeLabel ?? p.paymentMode);
          const e = byMode.get(mode) ?? { mode, count: 0, amount: 0 };
          e.count += 1;
          e.amount += Number(p.amount);
          byMode.set(mode, e);
        }
        const total = filtered.reduce((s, p) => s + Number(p.amount), 0);
        return {
          ...meta,
          summary: { totalReceipts: filtered.length, totalCollection: Math.round(total * 100) / 100, byMode: [...byMode.values()] },
          rows: filtered,
        };
      }
      case 'payment_receipt_register': {
        const register = await this.generateRevenueRegister(tenantId, periodFilters, user);
        return {
          ...meta,
          ...register,
          rows: register.rows.map((r) => ({
            receiptNo: r.receiptNo,
            paymentDate: r.paymentDate,
            consumerCode: r.consumerCode,
            fhtcNumber: r.fhtcNumber,
            consumerName: r.consumerName,
            village: r.village,
            billNo: r.billNo,
            paymentMode: r.paymentModeLabel ?? r.paymentMode,
            amount: r.amount,
            transactionRef: r.transactionRef,
            acknowledgement: r.acknowledgement,
            ledgerUpdate: r.ledgerUpdate,
          })),
        };
      }
      case 'revenue_register':
        return { ...meta, ...(await this.generateRevenueRegister(tenantId, periodFilters, user)) };
      case 'arrear_register':
        return { ...meta, ...(await this.getArrearManagement(tenantId, periodFilters, user)) };
      case 'consumer_aging_report': {
        const arrearData = await this.getArrearManagement(tenantId, periodFilters, user);
        return { ...meta, ...arrearData, rows: arrearData.agingRows };
      }
      case 'defaulter_report': {
        const arrearData = await this.getArrearManagement(tenantId, periodFilters, user);
        return { ...meta, ...arrearData, rows: arrearData.defaulterRows };
      }
      case 'village_revenue':
        return { ...meta, ...(await this.generateDemandRegister(tenantId, { ...periodFilters, groupBy: 'village' }, user)) };
      case 'scheme_revenue': {
        const billingSummary = await this.getSummary(tenantId, periodFilters.projectId, user);
        const register = await this.generateDemandRegister(tenantId, { ...periodFilters, groupBy: 'scheme' }, user);
        return { ...meta, billingSummary, ...register };
      }
      case 'revenue_efficiency': {
        const billingSummary = await this.getSummary(tenantId, periodFilters.projectId, user);
        const register = await this.generateDemandRegister(tenantId, periodFilters, user);
        return {
          ...meta,
          summary: {
            monthlyDemand: billingSummary.monthlyDemand,
            monthlyCollection: billingSummary.monthlyCollection,
            collectionEfficiencyPct: billingSummary.collectionEfficiencyPct,
            outstandingArrears: billingSummary.outstandingArrears,
            defaulterCount: billingSummary.defaulterCount,
            totalConsumers: billingSummary.totalConsumers,
            registerDemand: register.summary?.currentDemand ?? 0,
            registerCollection: register.summary?.collection ?? 0,
            registerBalance: register.summary?.balance ?? 0,
          },
          rows: register.rows,
        };
      }
      case 'consumer_ledger': {
        const consumers = await this.listConsumerAccounts(tenantId, periodFilters, user);
        const ledgers = await Promise.all(consumers.slice(0, 50).map(async (c) => ({
          consumer: c,
          bills: await this.listBills(tenantId, { ...periodFilters, consumerId: c.id }, user),
          payments: await this.listPayments(tenantId, { consumerId: c.id }, user),
        })));
        return { ...meta, rows: ledgers };
      }
      case 'financial_audit': {
        const [summary, bills, payments, arrears, accounting] = await Promise.all([
          this.getSummary(tenantId, periodFilters.projectId, user),
          this.listBills(tenantId, periodFilters, user),
          this.listPayments(tenantId, periodFilters, user),
          this.getArrearManagement(tenantId, periodFilters, user),
          this.accountingService.getSummary(user!, tenantId).catch(() => null),
        ]);
        return {
          ...meta,
          auditSnapshot: {
            generatedAt: new Date().toISOString(),
            billing: summary,
            billsIssued: bills.length,
            paymentsRecorded: payments.length,
            unpaidBills: arrears.summary.totalUnpaidBills,
            outstandingArrears: arrears.summary.totalArrearAmount,
            accounting: accounting ?? { note: 'Accounting module not initialized — run migration 044' },
          },
          arrearRows: arrears.rows.slice(0, 50),
          recentPayments: payments.slice(0, 20),
          recentBills: bills.slice(0, 20),
        };
      }
      case 'gis_revenue':
        return { ...meta, ...(await this.getGisRevenueAnalytics(tenantId, periodFilters, user)) };
      default:
        throw new BadRequestException('Unsupported report type');
    }
  }

  async listConsumerAccounts(
    tenantId: string,
    filters: { projectId?: string; projectCode?: string },
    user?: JwtPayload,
  ) {
    const resolvedProjectId = user
      ? await this.resolveProjectId(user, tenantId, filters.projectId, filters.projectCode)
      : await this.resolveProjectIdUnscoped(tenantId, filters.projectId, filters.projectCode);
    const qb = this.consumerRepo.createQueryBuilder('c')
      .where('c.tenant_id = :tenantId', { tenantId })
      .orderBy('c.consumerCode', 'ASC')
      .take(500);

    await this.scopeProjectQb(qb, user, tenantId, 'c', resolvedProjectId);

    const rows = await qb.getMany();
    return Promise.all(rows.map((c) => this.toAccountRecord(tenantId, c)));
  }

  private async toAccountRecord(tenantId: string, c: OmConsumer) {
    let projectCode: string | null = null;
    if (c.projectId) {
      const project = await this.projectRepo.findOne({ where: { id: c.projectId, tenantId } });
      projectCode = project?.projectCode ?? null;
    }
    const categoryDef = OM_CONSUMER_CATEGORIES.find((cat) => cat.code === c.consumerCategory);
    const statusDef = OM_CONNECTION_STATUSES.find((s) => s.code === c.connectionStatus);
    return {
      id: c.id,
      consumerCode: c.consumerCode,
      fhtcNumber: c.fhtcNumber,
      consumerName: c.consumerName,
      mobile: c.mobile,
      village: c.village,
      ward: c.ward,
      consumerCategory: c.consumerCategory,
      consumerCategoryLabel: categoryDef?.label ?? null,
      aadhaarLast4: c.aadhaarLast4,
      meterNumber: c.meterNumber,
      meterType: c.meterType,
      connectionStatus: c.connectionStatus,
      connectionStatusLabel: statusDef?.label ?? c.connectionStatus,
      latitude: c.latitude,
      longitude: c.longitude,
      gisLocation: c.latitude != null && c.longitude != null
        ? `${c.latitude.toFixed(6)}, ${c.longitude.toFixed(6)}`
        : null,
      projectCode,
      tariffId: c.tariffId,
      createdAt: c.createdAt,
    };
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

  private async buildBill(
    tenantId: string,
    userId: string,
    consumer: OmConsumer,
    tariff: OmBillingTariff,
    reading: OmMeterReading,
    dto: GenerateBillsDto,
    arrears: number,
  ) {
    const consumption = Number(reading.consumptionKl ?? 0);
    const slabs = (tariff.slabs?.length ? tariff.slabs : DEFAULT_TARIFF_SLABS) as TariffSlab[];
    const waterCharge = calculateSlabCharge(consumption, slabs);
    const fixed = Number(tariff.fixedCharge);
    const service = Number(tariff.serviceCharge);
    const maintenance = Number(tariff.maintenanceCharge);
    const meterRent = Number(tariff.meterRent);
    const fixedChargesTotal = fixed + service + maintenance + meterRent;
    const penaltyAmount = arrears > 0
      ? Math.round(arrears * Number(tariff.latePenaltyPct) / 100 * 100) / 100
      : 0;
    const subtotal = waterCharge + fixedChargesTotal + penaltyAmount + arrears;
    const taxAmount = Math.round(subtotal * Number(tariff.taxPct) / 100 * 100) / 100;
    const total = Math.round((subtotal + taxAmount) * 100) / 100;

    const cycle = (dto.billingCycle ?? tariff.billingCycle ?? 'monthly') as OmBillingCycle;
    const cycleDef = OM_BILLING_CYCLES.find((c) => c.code === cycle);
    const billComponents = {
      consumerDetails: {
        consumerCode: consumer.consumerCode,
        fhtcNumber: consumer.fhtcNumber,
        consumerName: consumer.consumerName,
        village: consumer.village,
        ward: consumer.ward,
        mobile: consumer.mobile,
        meterNumber: consumer.meterNumber,
      },
      billingPeriod: { from: dto.billingPeriodFrom, to: dto.billingPeriodTo },
      previousReading: reading.previousReading != null ? Number(reading.previousReading) : null,
      currentReading: Number(reading.currentReading),
      consumptionKl: consumption,
      waterCharges: waterCharge,
      fixedCharges: fixedChargesTotal,
      fixedChargeBreakdown: { fixed, service, maintenance, meterRent },
      taxes: taxAmount,
      penalty: penaltyAmount,
      outstandingArrears: arrears,
      totalDemand: total,
    };

    const count = await this.billRepo.count({ where: { tenantId } });
    const billNo = `BILL-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;

    const record = this.billRepo.create({
      tenantId,
      createdBy: userId,
      projectId: consumer.projectId,
      consumerId: consumer.id,
      tariffId: tariff.id,
      meterReadingId: reading.id,
      billNo,
      billingPeriodFrom: dto.billingPeriodFrom!,
      billingPeriodTo: dto.billingPeriodTo!,
      previousReading: reading.previousReading,
      currentReading: reading.currentReading,
      consumptionKl: consumption,
      waterCharge,
      fixedCharge: fixed,
      serviceCharge: service,
      maintenanceCharge: maintenance,
      meterRent,
      taxAmount,
      penaltyAmount,
      arrearsAmount: arrears,
      totalAmount: total,
      amountPaid: 0,
      balanceAmount: total,
      status: 'generated',
      dueDate: dto.dueDate ?? dto.billingPeriodTo!,
      details: {
        billingCycle: cycle,
        billingCycleLabel: cycleDef?.label ?? cycle,
        workflow: OM_BILLING_WORKFLOW,
        workflowStep: 'generation',
        billComponents,
        notifications: [],
      },
    });

    return this.billRepo.save(record);
  }

  private async resolveTariff(
    tenantId: string,
    consumer: OmConsumer,
    tariffId: string | undefined,
    projectId: string | null,
  ): Promise<OmBillingTariff> {
    if (tariffId) {
      const t = await this.tariffRepo.findOne({ where: { id: tariffId, tenantId } });
      if (t) return t;
    }
    if (consumer.tariffId) {
      const t = await this.tariffRepo.findOne({ where: { id: consumer.tariffId, tenantId } });
      if (t) return t;
    }

    const qb = this.tariffRepo.createQueryBuilder('t')
      .where('t.tenant_id = :tenantId', { tenantId })
      .andWhere('t.status = :status', { status: 'active' });

    if (consumer.consumerCategory) {
      qb.andWhere('(t.consumer_category = :cat OR t.consumer_category IS NULL)', { cat: consumer.consumerCategory });
    }
    if (projectId) qb.andWhere('(t.project_id = :projectId OR t.project_id IS NULL)', { projectId });

    const tariff = await qb.orderBy('t.effectiveFrom', 'DESC').getOne();
    if (!tariff) throw new BadRequestException(`No active tariff for consumer ${consumer.consumerCode}`);
    return tariff;
  }

  private async getConsumerArrears(tenantId: string, consumerId: string): Promise<number> {
    const result = await this.billRepo.createQueryBuilder('b')
      .select('COALESCE(SUM(b.balance_amount), 0)', 'sum')
      .where('b.tenant_id = :tenantId', { tenantId })
      .andWhere('b.consumer_id = :consumerId', { consumerId })
      .andWhere('b.balance_amount > 0')
      .getRawOne();
    return Number(result?.sum ?? 0);
  }

  private async getLastReading(consumerId: string, beforeDate: string): Promise<number | null> {
    const row = await this.readingRepo.findOne({
      where: { consumerId },
      order: { readingDate: 'DESC' },
    });
    if (!row || row.readingDate >= beforeDate) return row ? Number(row.currentReading) : null;
    return Number(row.currentReading);
  }

  private async ensureConsumer(tenantId: string, id: string) {
    const consumer = await this.consumerRepo.findOne({ where: { id, tenantId } });
    if (!consumer) throw new NotFoundException('Consumer not found');
    return consumer;
  }

  private formatSlabSummary(slabs: Array<{ fromKl: number; toKl: number | null; ratePerKl: number }> | null | undefined): string[] {
    if (!slabs?.length) return [];
    return slabs.map((s) => {
      const range = s.toKl != null ? `${s.fromKl}–${s.toKl} KL` : `Above ${s.fromKl} KL`;
      return `${range} @ ₹${s.ratePerKl}/KL`;
    });
  }

  private async toTariffRecord(tenantId: string, row: OmBillingTariff) {
    let projectCode: string | null = null;
    if (row.projectId) {
      const project = await this.projectRepo.findOne({ where: { id: row.projectId, tenantId } });
      projectCode = project?.projectCode ?? null;
    }
    return {
      id: row.id,
      tariffCode: row.tariffCode,
      tariffName: row.tariffName,
      consumerCategory: row.consumerCategory,
      billingCycle: row.billingCycle,
      fixedCharge: Number(row.fixedCharge),
      serviceCharge: Number(row.serviceCharge),
      maintenanceCharge: Number(row.maintenanceCharge),
      meterRent: Number(row.meterRent),
      latePenaltyPct: Number(row.latePenaltyPct),
      reconnectionCharge: Number(row.reconnectionCharge),
      newConnectionCharge: Number(row.newConnectionCharge),
      taxPct: Number(row.taxPct),
      slabs: row.slabs,
      slabSummary: this.formatSlabSummary(row.slabs),
      effectiveFrom: row.effectiveFrom,
      effectiveTo: row.effectiveTo,
      status: row.status,
      projectCode,
    };
  }

  private async toReadingRecord(tenantId: string, row: OmMeterReading) {
    const consumer = await this.consumerRepo.findOne({ where: { id: row.consumerId, tenantId } });
    const methodDef = OM_READING_METHODS.find((m) => m.code === row.readingMethod);
    const conditionDef = OM_METER_CONDITIONS.find((m) => m.code === row.meterCondition);
    const validation = validateMeterReading(
      row.previousReading != null ? Number(row.previousReading) : null,
      Number(row.currentReading),
      row.meterCondition,
    );
    return {
      id: row.id,
      consumerId: row.consumerId,
      consumerCode: consumer?.consumerCode ?? null,
      fhtcNumber: consumer?.fhtcNumber ?? null,
      readingDate: row.readingDate,
      readingMethod: row.readingMethod,
      readingMethodLabel: methodDef?.label ?? row.readingMethod,
      previousReading: row.previousReading != null ? Number(row.previousReading) : null,
      currentReading: Number(row.currentReading),
      consumptionKl: row.consumptionKl != null ? Number(row.consumptionKl) : null,
      latitude: row.latitude,
      longitude: row.longitude,
      gisLocation: row.latitude != null && row.longitude != null
        ? `${Number(row.latitude).toFixed(6)}, ${Number(row.longitude).toFixed(6)}`
        : null,
      meterCondition: row.meterCondition,
      meterConditionLabel: conditionDef?.label ?? row.meterCondition,
      photoUrl: row.photoUrl,
      mobileCapture: (row.details ?? {}) as Record<string, unknown>,
      isAbnormal: row.isAbnormal,
      validationFlags: row.validationFlags,
      validationAlerts: validation.alerts,
      notes: row.notes,
      createdAt: row.createdAt,
    };
  }

  private async toBillRecord(tenantId: string, row: OmConsumerBill) {
    const consumer = await this.consumerRepo.findOne({ where: { id: row.consumerId, tenantId } });
    const details = (row.details ?? {}) as Record<string, unknown>;
    const storedComponents = details.billComponents as Record<string, unknown> | undefined;
    const fixedChargesTotal = Number(row.fixedCharge) + Number(row.serviceCharge)
      + Number(row.maintenanceCharge) + Number(row.meterRent);
    const billComponents = storedComponents ?? {
      consumerDetails: {
        consumerCode: consumer?.consumerCode,
        fhtcNumber: consumer?.fhtcNumber,
        consumerName: consumer?.consumerName,
        village: consumer?.village,
        ward: consumer?.ward,
        mobile: consumer?.mobile,
        meterNumber: consumer?.meterNumber,
      },
      billingPeriod: { from: row.billingPeriodFrom, to: row.billingPeriodTo },
      previousReading: row.previousReading != null ? Number(row.previousReading) : null,
      currentReading: row.currentReading != null ? Number(row.currentReading) : null,
      consumptionKl: Number(row.consumptionKl),
      waterCharges: Number(row.waterCharge),
      fixedCharges: fixedChargesTotal,
      fixedChargeBreakdown: {
        fixed: Number(row.fixedCharge),
        service: Number(row.serviceCharge),
        maintenance: Number(row.maintenanceCharge),
        meterRent: Number(row.meterRent),
      },
      taxes: Number(row.taxAmount),
      penalty: Number(row.penaltyAmount),
      outstandingArrears: Number(row.arrearsAmount),
      totalDemand: Number(row.totalAmount),
    };
    const workflowStep = (details.workflowStep as string | undefined)
      ?? getWorkflowStepForBillStatus(row.status);
    const cycleCode = (details.billingCycle as string | undefined) ?? 'monthly';
    const cycleDef = OM_BILLING_CYCLES.find((c) => c.code === cycleCode);
    const statusDef = OM_BILL_STATUSES.find((s) => s.code === row.status);

    return {
      id: row.id,
      billNo: row.billNo,
      consumerId: row.consumerId,
      consumerCode: consumer?.consumerCode ?? null,
      fhtcNumber: consumer?.fhtcNumber ?? null,
      consumerName: consumer?.consumerName ?? null,
      village: consumer?.village ?? null,
      mobile: consumer?.mobile ?? null,
      billingCycle: cycleCode,
      billingCycleLabel: (details.billingCycleLabel as string | undefined) ?? cycleDef?.label ?? cycleCode,
      billingPeriodFrom: row.billingPeriodFrom,
      billingPeriodTo: row.billingPeriodTo,
      previousReading: row.previousReading != null ? Number(row.previousReading) : null,
      currentReading: row.currentReading != null ? Number(row.currentReading) : null,
      consumptionKl: Number(row.consumptionKl),
      waterCharge: Number(row.waterCharge),
      fixedCharge: Number(row.fixedCharge),
      serviceCharge: Number(row.serviceCharge),
      maintenanceCharge: Number(row.maintenanceCharge),
      meterRent: Number(row.meterRent),
      fixedChargesTotal,
      taxAmount: Number(row.taxAmount),
      penaltyAmount: Number(row.penaltyAmount),
      arrearsAmount: Number(row.arrearsAmount),
      totalAmount: Number(row.totalAmount),
      amountPaid: Number(row.amountPaid),
      balanceAmount: Number(row.balanceAmount),
      status: row.status,
      statusLabel: statusDef?.label ?? row.status,
      dueDate: row.dueDate,
      issuedAt: row.issuedAt,
      paidAt: row.paidAt,
      workflow: OM_BILLING_WORKFLOW,
      workflowStep,
      billComponents,
      notifications: Array.isArray(details.notifications) ? details.notifications : [],
      createdAt: row.createdAt,
    };
  }

  private async toPaymentRecord(tenantId: string, row: OmBillingPayment) {
    const consumer = await this.consumerRepo.findOne({ where: { id: row.consumerId, tenantId } });
    const modeDef = OM_PAYMENT_MODES.find((m) => m.code === row.paymentMode);
    const details = (row.details ?? {}) as Record<string, unknown>;
    let billNo: string | null = null;
    if (row.billId) {
      const bill = await this.billRepo.findOne({ where: { id: row.billId, tenantId } });
      billNo = bill?.billNo ?? null;
    }
    const acknowledgement = details.acknowledgement as Record<string, unknown> | undefined;
    return {
      id: row.id,
      receiptNo: row.receiptNo,
      consumerId: row.consumerId,
      consumerCode: consumer?.consumerCode ?? null,
      fhtcNumber: consumer?.fhtcNumber ?? null,
      consumerName: consumer?.consumerName ?? null,
      village: consumer?.village ?? null,
      mobile: consumer?.mobile ?? null,
      billId: row.billId,
      billNo,
      paymentDate: row.paymentDate,
      paymentMode: row.paymentMode,
      paymentModeLabel: modeDef?.label ?? row.paymentMode,
      amount: Number(row.amount),
      transactionRef: row.transactionRef,
      notes: row.notes,
      workflow: OM_COLLECTION_WORKFLOW,
      workflowStep: (details.workflowStep as string | undefined) ?? 'notification',
      acknowledgement: acknowledgement ?? {
        receiptNo: row.receiptNo,
        message: `Payment of ₹${row.amount} received. Receipt ${row.receiptNo}.`,
      },
      ledgerUpdate: details.ledgerUpdate ?? null,
      demandAdjustment: details.demandAdjustment ?? null,
      notification: details.notification ?? null,
      mobileCapture: (details.mobileCapture ?? null) as Record<string, unknown> | null,
      createdAt: row.createdAt,
    };
  }

  private buildReadingMobileDetails(dto: RecordMeterReadingDto): Record<string, unknown> {
    if (!dto.consumerSignature && !dto.offlineId && !dto.capturedAt) return {};
    return {
      captureSource: dto.readingMethod === 'mobile_app' ? 'mobile_billing_app' : 'field_capture',
      consumerSignature: dto.consumerSignature ?? null,
      consumerConsentType: dto.consumerConsentType ?? (dto.consumerSignature ? 'signature' : null),
      offlineId: dto.offlineId ?? null,
      capturedAt: dto.capturedAt ?? null,
      syncedAt: new Date().toISOString(),
    };
  }

  private buildPaymentMobileCapture(dto: RecordPaymentDto): Record<string, unknown> | null {
    if (!dto.latitude && !dto.longitude && !dto.consumerSignature && !dto.offlineId && !dto.capturedAt) {
      return null;
    }
    return {
      captureSource: 'mobile_billing_app',
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      gisLocation: dto.latitude != null && dto.longitude != null
        ? `${Number(dto.latitude).toFixed(6)}, ${Number(dto.longitude).toFixed(6)}`
        : null,
      consumerSignature: dto.consumerSignature ?? null,
      consumerConsentType: dto.consumerConsentType ?? (dto.consumerSignature ? 'signature' : null),
      offlineId: dto.offlineId ?? null,
      capturedAt: dto.capturedAt ?? null,
      syncedAt: new Date().toISOString(),
    };
  }

  private filterByPeriod<T extends Record<string, unknown>>(
    rows: T[],
    filters: { from?: string; to?: string },
    dateField: string,
  ): T[] {
    if (!filters.from && !filters.to) return rows;
    return rows.filter((r) => {
      const d = String(r[dateField] ?? '');
      if (filters.from && d < filters.from) return false;
      if (filters.to && d > filters.to) return false;
      return true;
    });
  }

  private async resolveProjectIdUnscoped(
    tenantId: string,
    projectId?: string,
    projectCode?: string,
  ): Promise<string | null> {
    if (projectId?.trim()) {
      const byId = await this.projectRepo.findOne({ where: { id: projectId.trim(), tenantId } });
      if (byId) return byId.id;
      const byCode = await this.projectRepo.findOne({ where: { projectCode: projectId.trim(), tenantId } });
      return byCode?.id ?? null;
    }
    if (projectCode?.trim()) {
      const project = await this.projectRepo.findOne({
        where: { tenantId, projectCode: projectCode.trim() },
      });
      return project?.id ?? null;
    }
    return null;
  }

  private async resolveProjectId(
    user: JwtPayload,
    tenantId: string,
    projectId?: string,
    projectCode?: string,
  ): Promise<string | null> {
    if (projectId?.trim() || projectCode?.trim()) {
      return this.divisionAccess.resolveAccessibleProjectId(user, tenantId, projectId, projectCode);
    }
    return null;
  }

  private async scopeProjectQb(
    qb: SelectQueryBuilder<ObjectLiteral>,
    user: JwtPayload | undefined,
    tenantId: string,
    alias: string,
    resolvedProjectId: string | null,
  ) {
    if (!user) {
      if (resolvedProjectId) {
        qb.andWhere(`${alias}.project_id = :projectId`, { projectId: resolvedProjectId });
      }
      return;
    }
    await this.divisionAccess.scopeQueryByAccessibleProjects(
      qb, user, tenantId, alias, resolvedProjectId,
    );
  }

  private async assertConsumerAccess(user: JwtPayload, tenantId: string, consumer: OmConsumer) {
    if (consumer.projectId) {
      await this.divisionAccess.assertProjectAccess(user, consumer.projectId, tenantId);
    }
  }

  private async scopeTariffQb(
    qb: SelectQueryBuilder<ObjectLiteral>,
    user: JwtPayload | undefined,
    tenantId: string,
    resolvedProjectId: string | null,
  ) {
    if (resolvedProjectId) {
      qb.andWhere('(t.project_id = :projectId OR t.project_id IS NULL)', { projectId: resolvedProjectId });
      return;
    }
    if (!user) return;
    const ids = await this.divisionAccess.getAccessibleProjectIds(user, tenantId);
    if (ids === null) return;
    if (ids.length === 0) {
      qb.andWhere('t.project_id IS NULL');
      return;
    }
    qb.andWhere('(t.project_id IS NULL OR t.project_id IN (:...scopedProjectIds))', { scopedProjectIds: ids });
  }

  private async scopeConsumerJoinQb(
    qb: SelectQueryBuilder<ObjectLiteral>,
    user: JwtPayload | undefined,
    tenantId: string,
    paymentAlias: string,
    consumerAlias: string,
    resolvedProjectId: string | null,
  ) {
    if (resolvedProjectId) {
      qb.innerJoin('om_consumers', consumerAlias, `${consumerAlias}.id = ${paymentAlias}.consumer_id`)
        .andWhere(`${consumerAlias}.project_id = :projectId`, { projectId: resolvedProjectId });
      return;
    }
    if (!user) return;
    const ids = await this.divisionAccess.getAccessibleProjectIds(user, tenantId);
    if (ids === null) return;
    if (ids.length === 0) {
      qb.andWhere('1 = 0');
      return;
    }
    qb.innerJoin('om_consumers', consumerAlias, `${consumerAlias}.id = ${paymentAlias}.consumer_id`)
      .andWhere(`${consumerAlias}.project_id IN (:...scopedProjectIds)`, { scopedProjectIds: ids });
  }

  private async assertBillAccess(user: JwtPayload | undefined, tenantId: string, bill: OmConsumerBill) {
    if (!user || !bill.projectId) return;
    await this.divisionAccess.assertProjectAccess(user, bill.projectId, tenantId);
  }
}
