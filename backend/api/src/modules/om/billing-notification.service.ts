import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type BillNotifyMode = 'live' | 'handoff';
export type NotificationChannel = 'sms' | 'whatsapp' | 'email';

export type NotificationSendResult = {
  channel: NotificationChannel;
  status: 'sent' | 'failed' | 'handoff';
  destination: string | null;
  provider: string | null;
  message: string;
  note?: string;
  reason?: string;
  externalId?: string;
};

@Injectable()
export class BillingNotificationService {
  private readonly logger = new Logger(BillingNotificationService.name);

  constructor(private readonly config: ConfigService) {}

  getMode(): BillNotifyMode {
    return this.config.get<string>('BILL_NOTIFY_MODE', 'handoff') === 'live' ? 'live' : 'handoff';
  }

  getConfigStatus() {
    const mode = this.getMode();
    const smsProvider = this.resolveSmsProvider();
    const whatsappProvider = this.resolveWhatsappProvider();
    const emailProvider = this.resolveEmailProvider();

    return {
      mode,
      sms: { configured: !!smsProvider, provider: smsProvider },
      whatsapp: { configured: !!whatsappProvider, provider: whatsappProvider },
      email: { configured: !!emailProvider, provider: emailProvider },
      handoffNote: mode === 'handoff'
        ? 'Set BILL_NOTIFY_MODE=live and configure gateway credentials in .env for automatic delivery.'
        : null,
    };
  }

  async sendSms(mobile: string, message: string): Promise<NotificationSendResult> {
    const destination = this.normalizeIndianMobile(mobile);
    if (!destination) {
      return this.failed('sms', mobile, null, 'Invalid mobile number');
    }

    if (this.getMode() !== 'live') {
      return this.handoff('sms', destination, message, 'SMS app will open on the user device.');
    }

    const provider = this.resolveSmsProvider();
    if (provider === 'msg91') return this.sendSmsMsg91(destination, message);
    if (provider === 'twilio') return this.sendSmsTwilio(destination, message);
    return this.failed('sms', destination, null, 'SMS gateway not configured (MSG91 or Twilio)');
  }

  async sendWhatsApp(mobile: string, message: string): Promise<NotificationSendResult> {
    const destination = this.normalizeIndianMobile(mobile);
    if (!destination) {
      return this.failed('whatsapp', mobile, null, 'Invalid mobile number');
    }

    if (this.getMode() !== 'live') {
      return this.handoff('whatsapp', destination, message, 'WhatsApp will open with the bill message.');
    }

    const provider = this.resolveWhatsappProvider();
    if (provider === 'twilio') return this.sendWhatsAppTwilio(destination, message);
    if (provider === 'meta') return this.sendWhatsAppMeta(destination, message);
    return this.failed('whatsapp', destination, null, 'WhatsApp gateway not configured (Twilio or Meta Cloud API)');
  }

  async sendEmail(email: string, subject: string, body: string): Promise<NotificationSendResult> {
    const destination = email?.trim() ?? '';
    if (!destination) {
      return this.failed('email', null, null, 'Email address is required');
    }

    if (this.getMode() !== 'live') {
      return this.handoff('email', destination, body, 'Email app will open with the bill message.');
    }

    const provider = this.resolveEmailProvider();
    if (provider === 'sendgrid') return this.sendEmailSendGrid(destination, subject, body);
    if (provider === 'mailgun') return this.sendEmailMailgun(destination, subject, body);
    return this.failed('email', destination, null, 'Email gateway not configured (SendGrid or Mailgun)');
  }

  private resolveSmsProvider(): string | null {
    if (this.config.get('MSG91_AUTH_KEY')?.trim()) return 'msg91';
    if (this.config.get('TWILIO_ACCOUNT_SID')?.trim() && this.config.get('TWILIO_AUTH_TOKEN')?.trim()) return 'twilio';
    return null;
  }

  private resolveWhatsappProvider(): string | null {
    if (this.config.get('TWILIO_WHATSAPP_FROM')?.trim()
      && this.config.get('TWILIO_ACCOUNT_SID')?.trim()
      && this.config.get('TWILIO_AUTH_TOKEN')?.trim()) return 'twilio';
    if (this.config.get('WHATSAPP_CLOUD_TOKEN')?.trim()
      && this.config.get('WHATSAPP_PHONE_NUMBER_ID')?.trim()) return 'meta';
    return null;
  }

  private resolveEmailProvider(): string | null {
    if (this.config.get('SENDGRID_API_KEY')?.trim()) return 'sendgrid';
    if (this.config.get('MAILGUN_API_KEY')?.trim() && this.config.get('MAILGUN_DOMAIN')?.trim()) return 'mailgun';
    return null;
  }

  private normalizeIndianMobile(mobile: string): string | null {
    const digits = mobile.replace(/\D/g, '');
    if (digits.length === 10) return `91${digits}`;
    if (digits.length === 12 && digits.startsWith('91')) return digits;
    if (digits.length >= 10) return digits;
    return null;
  }

  private handoff(
    channel: NotificationChannel,
    destination: string,
    message: string,
    note: string,
  ): NotificationSendResult {
    return {
      channel,
      status: 'handoff',
      destination,
      provider: null,
      message,
      note,
    };
  }

  private failed(
    channel: NotificationChannel,
    destination: string | null,
    provider: string | null,
    reason: string,
  ): NotificationSendResult {
    return {
      channel,
      status: 'failed',
      destination,
      provider,
      message: '',
      reason,
    };
  }

  private async sendSmsMsg91(mobile: string, message: string): Promise<NotificationSendResult> {
    const authKey = this.config.get<string>('MSG91_AUTH_KEY', '').trim();
    const sender = this.config.get<string>('MSG91_SENDER_ID', 'EGIPIN').trim();
    const route = this.config.get<string>('MSG91_ROUTE', '4').trim();

    try {
      const res = await fetch('https://control.msg91.com/api/v5/sms/', {
        method: 'POST',
        headers: {
          authkey: authKey,
          'Content-Type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          sender,
          route,
          country: '91',
          sms: [{ message, to: [mobile] }],
        }),
      });
      const data = await res.json().catch(() => ({})) as Record<string, unknown>;
      if (!res.ok) {
        this.logger.warn(`MSG91 SMS failed: ${res.status} ${JSON.stringify(data)}`);
        return this.failed('sms', mobile, 'msg91', String(data.message ?? data.type ?? 'MSG91 request failed'));
      }
      return {
        channel: 'sms',
        status: 'sent',
        destination: mobile,
        provider: 'msg91',
        message,
        externalId: String(data.request_id ?? data.message ?? ''),
      };
    } catch (err) {
      this.logger.error(`MSG91 SMS error: ${String(err)}`);
      return this.failed('sms', mobile, 'msg91', 'MSG91 connection failed');
    }
  }

  private async sendSmsTwilio(mobile: string, message: string): Promise<NotificationSendResult> {
    const sid = this.config.get<string>('TWILIO_ACCOUNT_SID', '').trim();
    const token = this.config.get<string>('TWILIO_AUTH_TOKEN', '').trim();
    const from = this.config.get<string>('TWILIO_SMS_FROM', '').trim();
    if (!from) return this.failed('sms', mobile, 'twilio', 'TWILIO_SMS_FROM is not configured');

    const body = new URLSearchParams({
      To: mobile.startsWith('+') ? mobile : `+${mobile}`,
      From: from,
      Body: message,
    });

    try {
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      });
      const data = await res.json().catch(() => ({})) as Record<string, unknown>;
      if (!res.ok) {
        this.logger.warn(`Twilio SMS failed: ${res.status} ${JSON.stringify(data)}`);
        return this.failed('sms', mobile, 'twilio', String(data.message ?? 'Twilio SMS failed'));
      }
      return {
        channel: 'sms',
        status: 'sent',
        destination: mobile,
        provider: 'twilio',
        message,
        externalId: String(data.sid ?? ''),
      };
    } catch (err) {
      this.logger.error(`Twilio SMS error: ${String(err)}`);
      return this.failed('sms', mobile, 'twilio', 'Twilio connection failed');
    }
  }

  private async sendWhatsAppTwilio(mobile: string, message: string): Promise<NotificationSendResult> {
    const sid = this.config.get<string>('TWILIO_ACCOUNT_SID', '').trim();
    const token = this.config.get<string>('TWILIO_AUTH_TOKEN', '').trim();
    const from = this.config.get<string>('TWILIO_WHATSAPP_FROM', '').trim();

    const body = new URLSearchParams({
      To: `whatsapp:+${mobile}`,
      From: from,
      Body: message,
    });

    try {
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      });
      const data = await res.json().catch(() => ({})) as Record<string, unknown>;
      if (!res.ok) {
        this.logger.warn(`Twilio WhatsApp failed: ${res.status} ${JSON.stringify(data)}`);
        return this.failed('whatsapp', mobile, 'twilio', String(data.message ?? 'Twilio WhatsApp failed'));
      }
      return {
        channel: 'whatsapp',
        status: 'sent',
        destination: mobile,
        provider: 'twilio',
        message,
        externalId: String(data.sid ?? ''),
      };
    } catch (err) {
      this.logger.error(`Twilio WhatsApp error: ${String(err)}`);
      return this.failed('whatsapp', mobile, 'twilio', 'Twilio connection failed');
    }
  }

  private async sendWhatsAppMeta(mobile: string, message: string): Promise<NotificationSendResult> {
    const token = this.config.get<string>('WHATSAPP_CLOUD_TOKEN', '').trim();
    const phoneId = this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID', '').trim();

    try {
      const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: mobile,
          type: 'text',
          text: { body: message },
        }),
      });
      const data = await res.json().catch(() => ({})) as Record<string, unknown>;
      if (!res.ok) {
        const err = data.error as Record<string, unknown> | undefined;
        this.logger.warn(`Meta WhatsApp failed: ${res.status} ${JSON.stringify(data)}`);
        return this.failed('whatsapp', mobile, 'meta', String(err?.message ?? 'Meta WhatsApp failed'));
      }
      const messages = data.messages as Array<Record<string, unknown>> | undefined;
      return {
        channel: 'whatsapp',
        status: 'sent',
        destination: mobile,
        provider: 'meta',
        message,
        externalId: String(messages?.[0]?.id ?? ''),
      };
    } catch (err) {
      this.logger.error(`Meta WhatsApp error: ${String(err)}`);
      return this.failed('whatsapp', mobile, 'meta', 'Meta WhatsApp connection failed');
    }
  }

  private async sendEmailSendGrid(email: string, subject: string, body: string): Promise<NotificationSendResult> {
    const apiKey = this.config.get<string>('SENDGRID_API_KEY', '').trim();
    const from = this.config.get<string>('SENDGRID_FROM', 'billing@egip.local').trim();

    try {
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email }] }],
          from: { email: from },
          subject,
          content: [{ type: 'text/plain', value: body }],
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        this.logger.warn(`SendGrid failed: ${res.status} ${text}`);
        return this.failed('email', email, 'sendgrid', 'SendGrid email failed');
      }
      return {
        channel: 'email',
        status: 'sent',
        destination: email,
        provider: 'sendgrid',
        message: body,
      };
    } catch (err) {
      this.logger.error(`SendGrid error: ${String(err)}`);
      return this.failed('email', email, 'sendgrid', 'SendGrid connection failed');
    }
  }

  private async sendEmailMailgun(email: string, subject: string, body: string): Promise<NotificationSendResult> {
    const apiKey = this.config.get<string>('MAILGUN_API_KEY', '').trim();
    const domain = this.config.get<string>('MAILGUN_DOMAIN', '').trim();
    const from = this.config.get<string>('MAILGUN_FROM', `billing@${domain}`).trim();

    const form = new URLSearchParams({
      from,
      to: email,
      subject,
      text: body,
    });

    try {
      const res = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form,
      });
      const data = await res.json().catch(() => ({})) as Record<string, unknown>;
      if (!res.ok) {
        this.logger.warn(`Mailgun failed: ${res.status} ${JSON.stringify(data)}`);
        return this.failed('email', email, 'mailgun', String(data.message ?? 'Mailgun email failed'));
      }
      return {
        channel: 'email',
        status: 'sent',
        destination: email,
        provider: 'mailgun',
        message: body,
        externalId: String(data.id ?? ''),
      };
    } catch (err) {
      this.logger.error(`Mailgun error: ${String(err)}`);
      return this.failed('email', email, 'mailgun', 'Mailgun connection failed');
    }
  }
}
