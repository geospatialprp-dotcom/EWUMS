import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import {
  OM_BILLING_CYCLES,
  OM_METER_CONDITIONS,
  OM_PAYMENT_MODES,
  OM_READING_METHODS,
} from './constants/om-billing-catalog';
import { OM_MOBILE_BILLING_FEATURES, OM_MOBILE_CAPTURE_SOURCE } from './constants/om-mobile-billing-catalog';
import { MobileMeterReadingDto, MobilePaymentDto, MobileSyncBatchDto, CreatePaymentGatewayOrderDto, VerifyPaymentGatewayDto } from './dto/om-mobile-billing.dto';
import { OmBillingService } from './om-billing.service';
import { PaymentGatewayService } from './payment-gateway.service';
import { saveOmMobileBillingPhoto } from './utils/om-files.util';

@Injectable()
export class OmMobileBillingService {
  constructor(
    private billingService: OmBillingService,
    private paymentGatewayService: PaymentGatewayService,
  ) {}

  getCatalog() {
    const gateway = this.paymentGatewayService.getConfig();
    return {
      features: OM_MOBILE_BILLING_FEATURES,
      captureSource: OM_MOBILE_CAPTURE_SOURCE,
      readingMethods: OM_READING_METHODS.filter((m) => m.code === 'mobile_app' || m.code === 'manual'),
      paymentModes: OM_PAYMENT_MODES.filter((m) => ['cash', 'upi', 'qr_code', 'pos', 'csc'].includes(m.code)),
      gatewayPaymentModes: OM_PAYMENT_MODES.filter((m) => gateway.gatewayModes.includes(m.code as typeof gateway.gatewayModes[number])),
      paymentGateway: gateway,
      meterConditions: OM_METER_CONDITIONS,
      billingCycles: OM_BILLING_CYCLES,
      offlineSupported: true,
    };
  }

  getPaymentGatewayConfig() {
    return this.paymentGatewayService.getConfig();
  }

  createPaymentGatewayOrder(dto: CreatePaymentGatewayOrderDto) {
    return this.paymentGatewayService.createOrder(dto);
  }

  async verifyPaymentGatewayAndRecord(
    tenantId: string,
    userId: string,
    dto: VerifyPaymentGatewayDto,
    user?: JwtPayload,
  ) {
    const verified = this.paymentGatewayService.verifySignature({
      razorpayOrderId: dto.razorpayOrderId,
      razorpayPaymentId: dto.razorpayPaymentId,
      razorpaySignature: dto.razorpaySignature,
    });

    return this.billingService.recordPayment(tenantId, userId, {
      consumerId: dto.consumerId,
      billId: dto.billId,
      paymentDate: dto.paymentDate,
      paymentMode: dto.paymentMode,
      amount: dto.amount,
      transactionRef: verified.transactionRef,
      notes: [
        dto.notes?.trim(),
        `Gateway: ${verified.provider}`,
        verified.demo ? 'Demo gateway' : `Order: ${verified.gatewayOrderId}`,
      ].filter(Boolean).join(' · ') || undefined,
      latitude: dto.latitude,
      longitude: dto.longitude,
      consumerSignature: dto.consumerSignature,
      consumerConsentType: dto.consumerConsentType,
      offlineId: dto.offlineId,
      capturedAt: dto.capturedAt ?? new Date().toISOString(),
    }, user);
  }

  async getFieldSummary(tenantId: string, filters: { projectId?: string; projectCode?: string }, user?: JwtPayload) {
    const [accounts, readings, payments, bills] = await Promise.all([
      this.billingService.listConsumerAccounts(tenantId, filters, user),
      this.billingService.listMeterReadings(tenantId, filters, user),
      this.billingService.listPayments(tenantId, filters, user),
      this.billingService.listBills(tenantId, { ...filters, status: 'issued' }, user),
    ]);

    const mobileReadings = readings.filter((r) => r.readingMethod === 'mobile_app').length;
    const mobilePayments = payments.filter((p) => p.mobileCapture?.captureSource === OM_MOBILE_CAPTURE_SOURCE).length;

    return {
      consumers: accounts.length,
      pendingBills: bills.length,
      recentReadings: readings.length,
      recentPayments: payments.length,
      mobileReadings,
      mobilePayments,
    };
  }

  uploadMeterPhoto(
    tenantId: string,
    file: { buffer: Buffer; originalname?: string; mimetype?: string },
  ) {
    if (!file?.buffer?.length) throw new BadRequestException('Photo file is required');
    const mime = file.mimetype ?? '';
    if (mime && !mime.startsWith('image/')) {
      throw new BadRequestException('Only image uploads are supported for meter photos');
    }
    const saved = saveOmMobileBillingPhoto(tenantId, file);
    return {
      fileName: saved.fileName,
      photoUrl: saved.fileUrl,
      uploadedAt: new Date().toISOString(),
    };
  }

  async recordMobileReading(
    tenantId: string,
    userId: string,
    consumerId: string,
    dto: MobileMeterReadingDto,
    user?: JwtPayload,
  ) {
    return this.billingService.recordMeterReading(tenantId, userId, consumerId, {
      readingDate: dto.readingDate,
      currentReading: dto.currentReading,
      previousReading: dto.previousReading,
      readingMethod: dto.readingMethod ?? 'mobile_app',
      latitude: dto.latitude,
      longitude: dto.longitude,
      meterCondition: dto.meterCondition,
      photoUrl: dto.photoUrl,
      notes: dto.notes,
      consumerSignature: dto.consumerSignature,
      consumerConsentType: dto.consumerConsentType,
      offlineId: dto.offlineId,
      capturedAt: dto.capturedAt ?? new Date().toISOString(),
    }, user);
  }

  async recordMobilePayment(tenantId: string, userId: string, dto: MobilePaymentDto, user?: JwtPayload) {
    if (this.paymentGatewayService.isGatewayMode(dto.paymentMode)) {
      throw new BadRequestException('Digital payments must be completed through the payment gateway');
    }
    return this.billingService.recordPayment(tenantId, userId, {
      consumerId: dto.consumerId,
      billId: dto.billId,
      paymentDate: dto.paymentDate,
      paymentMode: dto.paymentMode,
      amount: dto.amount,
      transactionRef: dto.transactionRef,
      notes: dto.notes,
      latitude: dto.latitude,
      longitude: dto.longitude,
      consumerSignature: dto.consumerSignature,
      consumerConsentType: dto.consumerConsentType,
      offlineId: dto.offlineId,
      capturedAt: dto.capturedAt ?? new Date().toISOString(),
    }, user);
  }

  async syncOfflineBatch(tenantId: string, userId: string, dto: MobileSyncBatchDto, user?: JwtPayload) {
    const results: Array<Record<string, unknown>> = [];

    for (const item of dto.items) {
      try {
        if (item.type === 'meter_reading') {
          const payload = item.payload as unknown as MobileMeterReadingDto;
          const record = await this.recordMobileReading(tenantId, userId, item.consumerId, {
            ...payload,
            offlineId: item.offlineId,
            capturedAt: item.capturedAt,
          }, user);
          results.push({ offlineId: item.offlineId, type: item.type, status: 'synced', record });
        } else {
          const payload = item.payload as unknown as MobilePaymentDto;
          const record = await this.recordMobilePayment(tenantId, userId, {
            ...payload,
            consumerId: item.consumerId,
            offlineId: item.offlineId,
            capturedAt: item.capturedAt,
          }, user);
          results.push({ offlineId: item.offlineId, type: item.type, status: 'synced', record });
        }
      } catch (err) {
        results.push({
          offlineId: item.offlineId,
          type: item.type,
          status: 'failed',
          error: err instanceof Error ? err.message : 'Sync failed',
        });
      }
    }

    return {
      submitted: dto.items.length,
      synced: results.filter((r) => r.status === 'synced').length,
      failed: results.filter((r) => r.status === 'failed').length,
      results,
    };
  }
}
