import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ConsumerPortalGuard } from '../../common/guards/consumer-portal.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import {
  JalMitraEscalateDto,
  JalMitraLanguageDto,
  JalMitraMessageDto,
  JalMitraOtpRequestDto,
  JalMitraOtpVerifyDto,
  JalMitraVerifyDto,
  StartJalMitraSessionDto,
} from './dto/jal-mitra.dto';
import { JalMitraService } from './jal-mitra.service';
import { resolveJalMitraLanguage, resolveRequestLocale } from './jal-mitra/request-locale.util';
import type { JalMitraLang } from './jal-mitra/jal-mitra-i18n';

const DEMO_TENANT = 'a0000000-0000-0000-0000-000000000001';

@ApiTags('Jal Mitra — Consumer AI Assistant')
@Controller()
export class JalMitraController {
  constructor(
    private jalMitra: JalMitraService,
    private jwtService: JwtService,
  ) {}

  @Get('consumer-portal/jal-mitra/quick-actions')
  @ApiOperation({ summary: 'Quick action chips for chat UI' })
  quickActions(@Req() req: Request) {
    const lang = (resolveRequestLocale(req) ?? 'hi') as JalMitraLang;
    return this.jalMitra.getQuickActions(lang);
  }

  @Post('consumer-portal/jal-mitra/sessions')
  @ApiOperation({ summary: 'Start Jal Mitra chat session' })
  startSession(@Body() dto: StartJalMitraSessionDto, @Req() req: Request) {
    const consumerId = this.resolveConsumerId(req);
    const language = resolveJalMitraLanguage(req, dto.language);
    return this.jalMitra.startSession(
      DEMO_TENANT,
      { ...dto, language: language ?? dto.language },
      consumerId,
    );
  }

  @Get('consumer-portal/jal-mitra/sessions/:sessionId/messages')
  @ApiOperation({ summary: 'Chat history' })
  listMessages(@Param('sessionId') sessionId: string) {
    return this.jalMitra.listMessages(sessionId, DEMO_TENANT);
  }

  @Post('consumer-portal/jal-mitra/sessions/:sessionId/messages')
  @ApiOperation({ summary: 'Send message to Jal Mitra' })
  sendMessage(
    @Param('sessionId') sessionId: string,
    @Body() dto: JalMitraMessageDto,
    @Req() req: Request,
  ) {
    return this.jalMitra.sendMessage(sessionId, DEMO_TENANT, dto, this.resolveConsumerId(req));
  }

  @Post('consumer-portal/jal-mitra/sessions/:sessionId/verify')
  @ApiOperation({ summary: 'Verify consumer with FHTC + mobile' })
  verify(@Param('sessionId') sessionId: string, @Body() dto: JalMitraVerifyDto) {
    return this.jalMitra.verifySession(sessionId, DEMO_TENANT, dto);
  }

  @Post('consumer-portal/jal-mitra/sessions/:sessionId/otp/request')
  @ApiOperation({ summary: 'Send OTP to verify consumer in chat' })
  requestOtp(@Param('sessionId') sessionId: string, @Body() dto: JalMitraOtpRequestDto) {
    return this.jalMitra.requestSessionOtp(sessionId, DEMO_TENANT, dto);
  }

  @Post('consumer-portal/jal-mitra/sessions/:sessionId/otp/verify')
  @ApiOperation({ summary: 'Verify OTP in Jal Mitra chat' })
  verifyOtp(@Param('sessionId') sessionId: string, @Body() dto: JalMitraOtpVerifyDto) {
    return this.jalMitra.verifySessionOtp(sessionId, DEMO_TENANT, dto);
  }

  @Get('consumer-portal/jal-mitra/config')
  @ApiOperation({ summary: 'Jal Mitra assistant configuration' })
  config() {
    return this.jalMitra.getAssistantConfig();
  }

  @Patch('consumer-portal/jal-mitra/sessions/:sessionId/language')
  @ApiOperation({ summary: 'Switch conversation language' })
  setLanguage(@Param('sessionId') sessionId: string, @Body() dto: JalMitraLanguageDto) {
    return this.jalMitra.setLanguage(sessionId, DEMO_TENANT, dto);
  }

  @Post('consumer-portal/jal-mitra/sessions/:sessionId/escalate')
  @ApiOperation({ summary: 'Escalate to human officer' })
  escalate(@Param('sessionId') sessionId: string, @Body() dto: JalMitraEscalateDto) {
    return this.jalMitra.escalate(sessionId, DEMO_TENANT, dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('om:read')
  @ApiBearerAuth()
  @Get('om/jal-mitra/analytics')
  @ApiOperation({ summary: 'Jal Mitra analytics dashboard data' })
  analytics(@CurrentUser() user: JwtPayload) {
    return this.jalMitra.getAnalytics(user.tenantId);
  }

  private resolveConsumerId(req: Request): string | undefined {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return undefined;
    try {
      const payload = this.jwtService.verify<JwtPayload>(auth.slice(7));
      if (payload.portalType === 'consumer' && payload.consumerId) {
        return payload.consumerId;
      }
    } catch {
      return undefined;
    }
    return undefined;
  }
}
