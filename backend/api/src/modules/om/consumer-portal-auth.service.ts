import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ConsumerPortalOtpService } from './consumer-portal-otp.service';
import { ConsumerPortalLoginDto, ConsumerPortalOtpVerifyDto } from './dto/consumer-portal.dto';
import { OmConsumer } from './entities/om-consumer.entity';

const DEMO_TENANT = 'a0000000-0000-0000-0000-000000000001';

@Injectable()
export class ConsumerPortalAuthService {
  constructor(
    @InjectRepository(OmConsumer) private consumerRepo: Repository<OmConsumer>,
    private jwtService: JwtService,
    private otpService: ConsumerPortalOtpService,
  ) {}

  getAuthConfig() {
    return {
      otpMode: this.otpService.getOtpMode(),
      otpEnabled: this.otpService.getOtpMode() !== 'off',
    };
  }

  async login(dto: ConsumerPortalLoginDto) {
    if (this.otpService.getOtpMode() === 'required') {
      throw new UnauthorizedException('OTP verification is required. Request an OTP first.');
    }
    const consumer = await this.findMatchingConsumer(dto.fhtcNumber, dto.mobile);
    return this.issueToken(consumer);
  }

  async requestOtp(dto: ConsumerPortalLoginDto) {
    return this.otpService.requestOtp(DEMO_TENANT, dto.fhtcNumber, dto.mobile, 'portal_login');
  }

  async verifyOtpLogin(dto: ConsumerPortalOtpVerifyDto) {
    const { consumer } = await this.otpService.verifyOtp(
      DEMO_TENANT,
      dto.fhtcNumber,
      dto.mobile,
      dto.otp,
      'portal_login',
    );
    return this.issueToken(consumer);
  }

  private async findMatchingConsumer(fhtcNumber: string, mobile: string) {
    const fhtc = fhtcNumber.trim();
    const mobileDigits = this.otpService.normalizeMobile(mobile);
    if (!mobileDigits) throw new UnauthorizedException('Invalid mobile number');

    const consumer = await this.consumerRepo.findOne({
      where: { fhtcNumber: fhtc },
      order: { createdAt: 'DESC' },
    });

    if (!consumer?.mobile) {
      throw new UnauthorizedException('Consumer account not found or mobile not registered');
    }

    const storedDigits = this.otpService.normalizeMobile(consumer.mobile);
    if (!storedDigits || storedDigits !== mobileDigits) {
      throw new UnauthorizedException('FHTC number and mobile do not match our records');
    }

    return consumer;
  }

  private issueToken(consumer: OmConsumer) {
    const payload: JwtPayload = {
      sub: consumer.id,
      email: `consumer:${consumer.consumerCode}`,
      tenantId: consumer.tenantId,
      roles: ['consumer'],
      permissions: ['portal:read', 'portal:write'],
      consumerId: consumer.id,
      portalType: 'consumer',
    };

    return {
      accessToken: this.jwtService.sign(payload),
      consumer: {
        id: consumer.id,
        consumerCode: consumer.consumerCode,
        fhtcNumber: consumer.fhtcNumber,
        consumerName: consumer.consumerName,
        mobile: consumer.mobile,
        village: consumer.village,
        connectionStatus: consumer.connectionStatus,
        tenantId: consumer.tenantId,
      },
    };
  }
}
