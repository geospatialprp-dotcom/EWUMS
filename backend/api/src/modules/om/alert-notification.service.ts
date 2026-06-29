import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BillingNotificationService, NotificationSendResult } from './billing-notification.service';
import { OmAlertNotification } from './entities/om-alert-notification.entity';
import { User } from '../auth/entities/user.entity';

export type AlertChannel = 'email' | 'sms' | 'whatsapp';

export type SendAlertInput = {
  tenantId: string;
  eventType: string;
  subject: string;
  message: string;
  email?: string | null;
  mobile?: string | null;
  channels?: AlertChannel[];
  payload?: Record<string, unknown>;
};

@Injectable()
export class AlertNotificationService {
  private readonly logger = new Logger(AlertNotificationService.name);

  constructor(
    @InjectRepository(OmAlertNotification) private alertRepo: Repository<OmAlertNotification>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private billingNotify: BillingNotificationService,
  ) {}

  getConfigStatus() {
    return this.billingNotify.getConfigStatus();
  }

  async listRecent(tenantId: string, limit = 50) {
    try {
      const rows = await this.alertRepo.find({
        where: { tenantId },
        order: { createdAt: 'DESC' },
        take: limit,
      });
      return rows.map((r) => ({
        id: r.id,
        eventType: r.eventType,
        channel: r.channel,
        status: r.status,
        recipient: r.recipient,
        subject: r.subject,
        message: r.message,
        provider: r.provider,
        errorReason: r.errorReason,
        payload: r.payload,
        createdAt: r.createdAt,
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('om_alert_notifications') && msg.includes('does not exist')) {
        this.logger.warn('om_alert_notifications table missing — returning empty alert log');
        return [];
      }
      throw err;
    }
  }

  async sendAlert(input: SendAlertInput): Promise<Record<string, NotificationSendResult>> {
    const channels = input.channels ?? this.defaultChannels(input);
    const results: Record<string, NotificationSendResult> = {};

    for (const channel of channels) {
      try {
        if (channel === 'email' && input.email?.trim()) {
          results.email = await this.billingNotify.sendEmail(
            input.email.trim(),
            input.subject,
            input.message,
          );
          await this.logAlert(input, 'email', input.email.trim(), results.email);
        } else if (channel === 'sms' && input.mobile?.trim()) {
          results.sms = await this.billingNotify.sendSms(input.mobile, input.message);
          await this.logAlert(input, 'sms', input.mobile.trim(), results.sms);
        } else if (channel === 'whatsapp' && input.mobile?.trim()) {
          results.whatsapp = await this.billingNotify.sendWhatsApp(input.mobile, input.message);
          await this.logAlert(input, 'whatsapp', input.mobile.trim(), results.whatsapp);
        }
      } catch (err) {
        const reason = (err as Error).message;
        this.logger.warn(`Alert ${input.eventType} via ${channel} failed: ${reason}`);
        const failed: NotificationSendResult = {
          channel,
          status: 'failed',
          destination: channel === 'email' ? input.email ?? null : input.mobile ?? null,
          provider: null,
          message: input.message,
          reason,
        };
        results[channel] = failed;
        await this.logAlert(input, channel, failed.destination ?? '', failed);
      }
    }

    if (Object.keys(results).length === 0) {
      this.logger.log(
        `[${input.eventType}] No channels configured or recipients missing — logged only: ${input.message.slice(0, 120)}`,
      );
    }

    return results;
  }

  async notifyComplaintAssigned(
    tenantId: string,
    data: {
      assigneeEmail: string;
      assigneeName?: string | null;
      complaintNo: string;
      complaintType: string;
      complaintId: string;
      consumerMobile?: string | null;
    },
  ) {
    const subject = `Complaint ${data.complaintNo} assigned to you`;
    const message = [
      `Hello${data.assigneeName ? ` ${data.assigneeName}` : ''},`,
      '',
      `Complaint ${data.complaintNo} (${data.complaintType}) has been assigned to you.`,
      'Please review and advance the complaint workflow in EWUMS.',
      '',
      '— Uttarakhand Jal Sansthan / EWUMS',
    ].join('\n');

    return this.sendAlert({
      tenantId,
      eventType: 'complaint_assigned',
      subject,
      message,
      email: data.assigneeEmail,
      mobile: data.consumerMobile,
      channels: ['email'],
      payload: { complaintId: data.complaintId, complaintNo: data.complaintNo },
    });
  }

  async notifyComplaintRegistered(
    tenantId: string,
    data: {
      projectId: string;
      complaintNo: string;
      complaintType: string;
      complaintId: string;
      channel: string;
      village?: string | null;
      fhtcNumber?: string | null;
    },
  ) {
    const divisionRows = await this.userRepo.query(
      'SELECT division_id FROM projects WHERE id = $1 AND tenant_id = $2',
      [data.projectId, tenantId],
    ) as Array<{ division_id?: string | null }>;
    const divisionId = divisionRows[0]?.division_id ?? null;

    const staff = await this.queryDivisionStaff(tenantId, divisionId, ['ee', 'je']);
    if (!staff.length) {
      this.logger.log(
        `[complaint_registered] No EE/JE staff for division ${divisionId ?? 'n/a'} — skipped email alerts`,
      );
      return { notified: 0 };
    }

    const location = [data.village, data.fhtcNumber ? `FHTC ${data.fhtcNumber}` : null]
      .filter(Boolean)
      .join(' · ');
    const subject = `New complaint ${data.complaintNo} — ${data.complaintType}`;
    const message = [
      'A new consumer complaint has been registered in EWUMS.',
      '',
      `Ticket: ${data.complaintNo}`,
      `Type: ${data.complaintType}`,
      `Channel: ${data.channel}`,
      location ? `Location: ${location}` : '',
      '',
      'Open Complaints in EWUMS to review and assign.',
      '',
      '— EWUMS Notifications',
    ].filter(Boolean).join('\n');

    let notified = 0;
    for (const user of staff) {
      if (!user.email?.trim()) continue;
      await this.sendAlert({
        tenantId,
        eventType: 'complaint_registered',
        subject,
        message,
        email: user.email,
        channels: ['email'],
        payload: {
          complaintId: data.complaintId,
          complaintNo: data.complaintNo,
          projectId: data.projectId,
        },
      });
      notified += 1;
    }

    return { notified };
  }

  async notifyComplaintResolved(
    tenantId: string,
    data: {
      email?: string | null;
      mobile?: string | null;
      complaintNo: string;
      complaintId: string;
      resolutionNotes?: string | null;
    },
  ) {
    const resolution = data.resolutionNotes?.trim()
      ? `\nResolution: ${data.resolutionNotes.trim().slice(0, 200)}`
      : '';
    const subject = `Complaint ${data.complaintNo} resolved`;
    const message = `Your complaint ${data.complaintNo} has been resolved.${resolution}\n\n— UJS Jal Mitra`;

    return this.sendAlert({
      tenantId,
      eventType: 'complaint_resolved',
      subject,
      message,
      email: data.email,
      mobile: data.mobile,
      payload: { complaintId: data.complaintId, complaintNo: data.complaintNo },
    });
  }

  async notifyWorkflowPendingApproval(
    tenantId: string,
    data: {
      assignedRole: string;
      instanceTitle: string;
      stepName: string;
      taskId: string;
      instanceId: string;
    },
  ) {
    const users = await this.queryUsersByRole(tenantId, data.assignedRole);
    if (!users.length) {
      this.logger.log(
        `[workflow_pending_approval] No active users with role "${data.assignedRole}" — skipped email alerts`,
      );
      return { notified: 0 };
    }

    const subject = `Pending approval: ${data.instanceTitle}`;
    const message = [
      `A workflow item requires your approval.`,
      '',
      `Title: ${data.instanceTitle}`,
      `Step: ${data.stepName}`,
      `Role: ${data.assignedRole.toUpperCase()}`,
      '',
      'Open the Workflow Inbox in EWUMS to review and act.',
      '',
      '— EWUMS Notifications',
    ].join('\n');

    let notified = 0;
    for (const user of users) {
      if (!user.email?.trim()) continue;
      await this.sendAlert({
        tenantId,
        eventType: 'workflow_pending_approval',
        subject,
        message,
        email: user.email,
        channels: ['email'],
        payload: {
          taskId: data.taskId,
          instanceId: data.instanceId,
          assignedRole: data.assignedRole,
        },
      });
      notified += 1;
    }

    return { notified };
  }

  async notifyBillDueReminder(
    tenantId: string,
    data: {
      email?: string | null;
      mobile?: string | null;
      billNo: string;
      billId: string;
      balanceAmount: number;
      dueDate?: string | null;
    },
  ) {
    const subject = `Bill due reminder — ${data.billNo}`;
    const message = [
      'EGIP Bill Reminder',
      `Bill: ${data.billNo}`,
      `Outstanding: ₹${data.balanceAmount}`,
      data.dueDate ? `Due date: ${data.dueDate}` : '',
      'Pay online via Consumer Portal.',
    ].filter(Boolean).join('\n');

    return this.sendAlert({
      tenantId,
      eventType: 'bill_due_reminder',
      subject,
      message,
      email: data.email,
      mobile: data.mobile,
      payload: { billId: data.billId, billNo: data.billNo },
    });
  }

  private defaultChannels(input: SendAlertInput): AlertChannel[] {
    const channels: AlertChannel[] = [];
    if (input.email?.trim()) channels.push('email');
    if (input.mobile?.trim()) {
      channels.push('sms');
      channels.push('whatsapp');
    }
    return channels;
  }

  private async logAlert(
    input: SendAlertInput,
    channel: AlertChannel,
    recipient: string,
    result: NotificationSendResult,
  ) {
    try {
      await this.alertRepo.save(this.alertRepo.create({
        tenantId: input.tenantId,
        eventType: input.eventType,
        channel,
        status: result.status,
        recipient,
        subject: input.subject,
        message: input.message,
        payload: input.payload ?? {},
        provider: result.provider,
        errorReason: result.reason ?? null,
      }));
    } catch (err) {
      this.logger.warn(`Failed to persist alert log: ${(err as Error).message}`);
    }
  }

  private async queryUsersByRole(tenantId: string, roleCode: string) {
    return this.userRepo.query(
      `SELECT DISTINCT u.id, u.email, u.first_name AS "firstName", u.last_name AS "lastName"
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       JOIN roles r ON r.id = ur.role_id
       WHERE u.tenant_id = $1
         AND u.status = 'active'
         AND r.code = $2
       ORDER BY u.email`,
      [tenantId, roleCode],
    ) as Promise<Array<{ id: string; email: string; firstName?: string | null; lastName?: string | null }>>;
  }

  private async queryDivisionStaff(
    tenantId: string,
    divisionId: string | null,
    roleCodes: string[],
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

    return this.userRepo.query(
      `SELECT DISTINCT u.id, u.email, u.first_name AS "firstName", u.last_name AS "lastName"
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       JOIN roles r ON r.id = ur.role_id
       WHERE u.tenant_id = $1
         AND u.status = 'active'
         AND r.code = ANY($2::text[])
         ${divisionClause}
       ORDER BY u.email`,
      params,
    ) as Promise<Array<{ id: string; email: string; firstName?: string | null; lastName?: string | null }>>;
  }
}
