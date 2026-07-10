import { createHash, randomInt } from 'crypto';
import {
  BadRequestException, HttpException, HttpStatus, Injectable, Logger, UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BillingNotificationService } from './billing-notification.service';
import { ConsumerPortalOtpChallenge } from './entities/consumer-portal-otp-challenge.entity';
import { OmConsumer } from './entities/om-consumer.entity';

const DEMO_TENANT = 'a0000000-0000-0000-0000-000000000001';
const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 3;

export type OtpPurpose = 'portal_login' | 'jal_mitra_verify';

@Injectable()
export class ConsumerPortalOtpService {
  private readonly logger = new Logger(ConsumerPortalOtpService.name);

  constructor(
    @InjectRepository(ConsumerPortalOtpChallenge) private otpRepo: Repository<ConsumerPortalOtpChallenge>,
    @InjectRepository(OmConsumer) private consumerRepo: Repository<OmConsumer>,
    private notifications: BillingNotificationService,
    private config: ConfigService,
  ) {}

  getOtpMode(): 'off' | 'optional' | 'required' {
    const mode = this.config.get<string>('CONSUMER_PORTAL_OTP_MODE', 'optional').toLowerCase();
    if (mode === 'off' || mode === 'required') return mode;
    return 'optional';
  }

  async requestOtp(
    tenantId: string,
    fhtcNumber: string,
    mobile: string,
    purpose: OtpPurpose = 'portal_login',
    sessionId?: string,
  ) {
    try {
      return await this.requestOtpInternal(tenantId, fhtcNumber, mobile, purpose, sessionId);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`OTP request failed: ${err instanceof Error ? err.message : String(err)}`);
      throw new BadRequestException(
        'OTP could not be sent. Apply for a new connection first, or use Sign in without OTP.',
      );
    }
  }

  private async requestOtpInternal(
    tenantId: string,
    fhtcNumber: string,
    mobile: string,
    purpose: OtpPurpose = 'portal_login',
    sessionId?: string,
  ) {
    const tid = tenantId || DEMO_TENANT;
    const fhtc = fhtcNumber.trim();
    if (!fhtc) throw new BadRequestException('FHTC number is required');
    const mobileDigits = this.normalizeMobile(mobile);
    if (!mobileDigits) throw new BadRequestException('Valid 10-digit mobile number is required');

    const consumers = await this.consumerRepo.find({
      where: { tenantId: tid, fhtcNumber: fhtc },
      order: { createdAt: 'DESC' },
      take: 1,
    });
    const consumer = consumers[0];
    if (!consumer?.mobile) {
      throw new UnauthorizedException(
        'No account found for this FHTC. Use New connection — Apply here first, then sign in with the same FHTC and mobile.',
      );
    }
    const storedDigits = this.normalizeMobile(consumer.mobile);
    if (!storedDigits || storedDigits !== mobileDigits) {
      throw new UnauthorizedException('FHTC number and mobile do not match our records');
    }

    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
    const recentCount = await this.otpRepo
      .createQueryBuilder('challenge')
      .where('challenge.tenantId = :tid', { tid })
      .andWhere('challenge.fhtcNumber = :fhtc', { fhtc })
      .andWhere('challenge.mobile = :mobile', { mobile: mobileDigits })
      .andWhere('challenge.purpose = :purpose', { purpose })
      .andWhere('challenge.createdAt > :since', { since })
      .getCount();
    if (recentCount >= RATE_LIMIT_MAX) {
      throw new HttpException('Too many OTP requests. Please wait 15 minutes.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const otp = String(randomInt(100000, 999999));
    const challenge = await this.otpRepo.save(this.otpRepo.create({
      tenantId: tid,
      fhtcNumber: fhtc,
      mobile: mobileDigits,
      otpHash: this.hashOtp(otp),
      purpose,
      sessionId: sessionId ?? null,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    }));

    const smsText = `Your Jal Mitra OTP is ${otp}. Valid for 5 minutes. Do not share. - UJS`;
    let smsResult: Awaited<ReturnType<BillingNotificationService['sendSms']>>;
    try {
      smsResult = await this.notifications.sendSms(mobileDigits, smsText);
    } catch {
      smsResult = {
        channel: 'sms',
        status: 'handoff',
        destination: mobileDigits,
        provider: null,
        message: 'SMS gateway unavailable — use OTP shown in the portal.',
      };
    }

    const exposeOtpInUi = smsResult.status !== 'sent'
      || this.config.get<string>('NODE_ENV', 'development') !== 'production'
      || this.notifications.getMode() === 'handoff'
      || this.config.get<string>('CONSUMER_PORTAL_OTP_DEV_EXPOSE', 'false') === 'true';

    return {
      challengeId: challenge.id,
      expiresInSeconds: OTP_TTL_MS / 1000,
      smsStatus: smsResult.status,
      smsMessage: smsResult.message,
      devOtp: exposeOtpInUi ? otp : undefined,
      note: smsResult.status === 'sent'
        ? undefined
        : 'SMS not delivered — use the OTP shown below to continue.',
    };
  }

  async verifyOtp(
    tenantId: string,
    fhtcNumber: string,
    mobile: string,
    otpCode: string,
    purpose: OtpPurpose = 'portal_login',
  ) {
    const tid = tenantId || DEMO_TENANT;
    const fhtc = fhtcNumber.trim();
    const mobileDigits = this.normalizeMobile(mobile);
    if (!mobileDigits) throw new BadRequestException('Invalid mobile number');

    const challenge = await this.otpRepo.findOne({
      where: { tenantId: tid, fhtcNumber: fhtc, mobile: mobileDigits, purpose },
      order: { createdAt: 'DESC' },
    });
    if (!challenge || challenge.verifiedAt) {
      throw new UnauthorizedException('OTP expired or not found. Request a new OTP.');
    }
    if (challenge.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('OTP has expired. Request a new OTP.');
    }
    if (challenge.attempts >= MAX_ATTEMPTS) {
      throw new UnauthorizedException('Too many incorrect attempts. Request a new OTP.');
    }

    const ok = this.hashOtp(otpCode.trim()) === challenge.otpHash;
    challenge.attempts += 1;
    if (!ok) {
      await this.otpRepo.save(challenge);
      throw new UnauthorizedException('Incorrect OTP. Please try again.');
    }

    challenge.verifiedAt = new Date();
    await this.otpRepo.save(challenge);

    const consumer = await this.consumerRepo.findOne({
      where: { tenantId: tid, fhtcNumber: fhtc },
      order: { createdAt: 'DESC' },
    });
    if (!consumer) throw new UnauthorizedException('Consumer not found');

    return { consumer, challengeId: challenge.id };
  }

  normalizeMobile(mobile: string): string | null {
    const digits = mobile.replace(/\D/g, '');
    if (digits.length === 10) return digits;
    if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
    if (digits.length >= 10) return digits.slice(-10);
    return null;
  }

  private hashOtp(otp: string): string {
    return createHash('sha256').update(otp).digest('hex');
  }
}
