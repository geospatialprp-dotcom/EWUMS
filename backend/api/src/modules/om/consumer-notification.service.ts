import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BillingNotificationService, NotificationSendResult } from './billing-notification.service';
import { OmConsumerBill } from './entities/om-consumer-bill.entity';
import { OmConsumerNotification } from './entities/om-consumer-notification.entity';
import { OmConsumer } from './entities/om-consumer.entity';

export type ConsumerNotifyInput = {
  tenantId: string;
  consumerId?: string | null;
  mobile?: string | null;
  eventType: string;
  title: string;
  message: string;
  smsText?: string;
  payload?: Record<string, unknown>;
  sendSms?: boolean;
};

@Injectable()
export class ConsumerNotificationService {
  private readonly logger = new Logger(ConsumerNotificationService.name);

  constructor(
    @InjectRepository(OmConsumerNotification) private notifRepo: Repository<OmConsumerNotification>,
    @InjectRepository(OmConsumerBill) private billRepo: Repository<OmConsumerBill>,
    @InjectRepository(OmConsumer) private consumerRepo: Repository<OmConsumer>,
    private billingNotify: BillingNotificationService,
  ) {}

  async notify(input: ConsumerNotifyInput) {
    let smsResult: NotificationSendResult | null = null;
    if (input.sendSms !== false && input.mobile?.trim()) {
      try {
        smsResult = await this.billingNotify.sendSms(input.mobile, input.smsText ?? input.message);
      } catch (err) {
        this.logger.warn(`SMS failed for ${input.eventType}: ${(err as Error).message}`);
        smsResult = {
          channel: 'sms',
          status: 'failed',
          destination: input.mobile,
          provider: null,
          message: input.smsText ?? input.message,
          reason: (err as Error).message,
        };
      }
    }

    const row = await this.notifRepo.save(this.notifRepo.create({
      tenantId: input.tenantId,
      consumerId: input.consumerId ?? null,
      eventType: input.eventType,
      channel: 'portal',
      status: 'sent',
      title: input.title,
      message: input.message,
      payload: {
        ...(input.payload ?? {}),
        sms: smsResult,
      },
      sentAt: new Date(),
    }));

    return { notification: this.toDto(row), sms: smsResult };
  }

  async notifyBillDelivered(
    tenantId: string,
    consumer: OmConsumer,
    bill: { id: string; billNo: string; totalAmount: number; dueDate?: string | null; balanceAmount?: number },
    smsText: string,
  ) {
    return this.notify({
      tenantId,
      consumerId: consumer.id,
      mobile: consumer.mobile,
      eventType: 'bill_issued',
      title: `Bill ${bill.billNo} issued`,
      message: `Your water bill ${bill.billNo} for ₹${bill.totalAmount} is ready. Due date: ${bill.dueDate ?? '—'}.`,
      smsText,
      payload: { billId: bill.id, billNo: bill.billNo },
      sendSms: true,
    });
  }

  async notifyPaymentReceived(
    tenantId: string,
    consumer: OmConsumer,
    payment: { receiptNo: string; amount: number; paymentMode: string },
    smsText: string,
  ) {
    return this.notify({
      tenantId,
      consumerId: consumer.id,
      mobile: consumer.mobile,
      eventType: 'payment_received',
      title: `Payment received — ${payment.receiptNo}`,
      message: `Payment of ₹${payment.amount} received via ${payment.paymentMode}. Receipt: ${payment.receiptNo}.`,
      smsText,
      payload: { receiptNo: payment.receiptNo, amount: payment.amount },
      sendSms: true,
    });
  }

  async notifyArrearReminder(
    tenantId: string,
    consumer: OmConsumer,
    bill: { id: string; billNo: string; balanceAmount: number; dueDate?: string | null },
    action: string,
    smsText: string,
  ) {
    return this.notify({
      tenantId,
      consumerId: consumer.id,
      mobile: consumer.mobile,
      eventType: `arrear_${action}`,
      title: `Bill reminder — ${bill.billNo}`,
      message: `Outstanding ₹${bill.balanceAmount} on bill ${bill.billNo}. Please pay before the due date.`,
      smsText,
      payload: { billId: bill.id, billNo: bill.billNo, action },
      sendSms: true,
    });
  }

  async notifyComplaintRegistered(
    tenantId: string,
    data: {
      consumerId?: string | null;
      mobile?: string | null;
      complaintNo: string;
      complaintType: string;
      complaintId: string;
    },
  ) {
    const msg = `Complaint ${data.complaintNo} registered (${data.complaintType}). We will update you on progress. - UJS Jal Mitra`;
    return this.notify({
      tenantId,
      consumerId: data.consumerId,
      mobile: data.mobile,
      eventType: 'complaint_registered',
      title: `Complaint ${data.complaintNo} registered`,
      message: msg,
      smsText: msg,
      payload: { complaintId: data.complaintId, complaintNo: data.complaintNo },
      sendSms: Boolean(data.mobile),
    });
  }

  async notifyComplaintStatus(
    tenantId: string,
    data: {
      consumerId?: string | null;
      mobile?: string | null;
      complaintNo: string;
      complaintId: string;
      status: string;
      detail?: string;
    },
    options?: { sendSms?: boolean },
  ) {
    const detail = data.detail ? ` ${data.detail}` : '';
    const msg = `Complaint ${data.complaintNo}: status is now ${data.status}.${detail} - UJS`;
    return this.notify({
      tenantId,
      consumerId: data.consumerId,
      mobile: data.mobile,
      eventType: 'complaint_status',
      title: `Complaint ${data.complaintNo} — ${data.status}`,
      message: msg,
      smsText: msg,
      payload: { complaintId: data.complaintId, complaintNo: data.complaintNo, status: data.status },
      sendSms: options?.sendSms ?? Boolean(data.mobile),
    });
  }

  async notifyComplaintClosed(
    tenantId: string,
    data: {
      consumerId?: string | null;
      mobile?: string | null;
      complaintNo: string;
      complaintId: string;
      complaintTypeLabel: string;
      resolutionNotes?: string | null;
    },
  ) {
    const resolution = data.resolutionNotes?.trim()
      ? ` ${data.resolutionNotes.trim().slice(0, 80)}`
      : '';
    const smsText = `UJS Jal Mitra: Complaint ${data.complaintNo} (${data.complaintTypeLabel}) is closed.${resolution} Thank you.`;
    const message = `Your complaint ${data.complaintNo} has been closed.${resolution ? ` Resolution: ${data.resolutionNotes!.trim().slice(0, 120)}` : ''}`;
    return this.notify({
      tenantId,
      consumerId: data.consumerId,
      mobile: data.mobile,
      eventType: 'complaint_closed',
      title: `Complaint ${data.complaintNo} closed`,
      message,
      smsText,
      payload: {
        complaintId: data.complaintId,
        complaintNo: data.complaintNo,
        complaintType: data.complaintTypeLabel,
      },
      sendSms: Boolean(data.mobile),
    });
  }

  async listForConsumer(tenantId: string, consumerId: string, limit = 30) {
    const rows = await this.notifRepo.find({
      where: { tenantId, consumerId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return {
      unreadCount: rows.filter((r) => !r.readAt).length,
      items: rows.map((r) => this.toDto(r)),
    };
  }

  async markRead(tenantId: string, consumerId: string, notificationId: string) {
    const row = await this.notifRepo.findOne({
      where: { id: notificationId, tenantId, consumerId },
    });
    if (!row) return { updated: false };
    if (!row.readAt) {
      row.readAt = new Date();
      await this.notifRepo.save(row);
    }
    return { updated: true, notification: this.toDto(row) };
  }

  async markAllRead(tenantId: string, consumerId: string) {
    await this.notifRepo.query(
      `UPDATE om_consumer_notifications SET read_at = NOW()
       WHERE tenant_id = $1 AND consumer_id = $2 AND read_at IS NULL`,
      [tenantId, consumerId],
    );
    return { success: true };
  }

  async scanDueBillReminders(tenantId: string) {
    const bills = await this.billRepo
      .createQueryBuilder('b')
      .where('b.tenant_id = :tenantId', { tenantId })
      .andWhere('b.status IN (:...statuses)', { statuses: ['issued', 'partial', 'overdue'] })
      .andWhere('b.balance_amount > 0')
      .andWhere('b.due_date < CURRENT_DATE')
      .orderBy('b.due_date', 'ASC')
      .take(200)
      .getMany();

    let sent = 0;
    let skipped = 0;
    const results: Array<{ billNo: string; status: string }> = [];

    for (const bill of bills) {
      const recent = await this.notifRepo.query(
        `SELECT 1 FROM om_consumer_notifications
         WHERE tenant_id = $1 AND event_type = 'bill_due_reminder'
           AND payload->>'billId' = $2
           AND created_at > NOW() - INTERVAL '7 days'
         LIMIT 1`,
        [tenantId, bill.id],
      );
      if (recent.length) {
        skipped += 1;
        continue;
      }

      const consumer = await this.consumerRepo.findOne({ where: { id: bill.consumerId, tenantId } });
      if (!consumer?.mobile) {
        skipped += 1;
        continue;
      }

      const daysOverdue = bill.dueDate
        ? Math.max(0, Math.floor((Date.now() - new Date(bill.dueDate).getTime()) / 86400000))
        : 0;
      const smsText = [
        `EGIP Bill Reminder`,
        `Bill: ${bill.billNo}`,
        `Outstanding: ₹${bill.balanceAmount}`,
        `Due date was: ${bill.dueDate}`,
        daysOverdue > 0 ? `Overdue by ${daysOverdue} day(s).` : '',
        'Pay online via Consumer Portal.',
      ].filter(Boolean).join('\n');

      await this.notify({
        tenantId,
        consumerId: consumer.id,
        mobile: consumer.mobile,
        eventType: 'bill_due_reminder',
        title: `Bill due — ${bill.billNo}`,
        message: `Bill ${bill.billNo}: ₹${bill.balanceAmount} outstanding.${daysOverdue > 0 ? ` Overdue ${daysOverdue} day(s).` : ''}`,
        smsText,
        payload: { billId: bill.id, billNo: bill.billNo, daysOverdue },
        sendSms: true,
      });
      sent += 1;
      results.push({ billNo: bill.billNo, status: 'sent' });
    }

    return { scanned: bills.length, sent, skipped, results };
  }

  private toDto(row: OmConsumerNotification) {
    return {
      id: row.id,
      eventType: row.eventType,
      title: row.title,
      message: row.message,
      payload: row.payload,
      readAt: row.readAt,
      sentAt: row.sentAt,
      createdAt: row.createdAt,
    };
  }
}
