import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ConsumerPortalGuard } from '../../common/guards/consumer-portal.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ConsumerPortalAuthService } from './consumer-portal-auth.service';
import { ConsumerPortalService } from './consumer-portal.service';
import {
  ConsumerPortalComplaintDto,
  ConsumerPortalLoginDto,
  ConsumerPortalNewConnectionDto,
  ConsumerPortalOtpRequestDto,
  ConsumerPortalOtpVerifyDto,
  ConsumerPortalTrackApplicationDto,
  ConsumerPortalUpdateMobileDto,
} from './dto/consumer-portal.dto';

@ApiTags('Consumer Portal')
@Controller('consumer-portal')
export class ConsumerPortalController {
  constructor(
    private authService: ConsumerPortalAuthService,
    private portalService: ConsumerPortalService,
    private jwtService: JwtService,
  ) {}

  @Get('catalog')
  @ApiOperation({ summary: 'Consumer portal feature catalog' })
  getCatalog() {
    return this.portalService.getCatalog();
  }

  @Post('auth/login')
  @ApiOperation({ summary: 'Consumer login with FHTC + mobile' })
  login(@Body() dto: ConsumerPortalLoginDto) {
    return this.authService.login(dto);
  }

  @Get('auth/config')
  @ApiOperation({ summary: 'Consumer portal auth configuration' })
  authConfig() {
    return this.authService.getAuthConfig();
  }

  @Post('auth/otp/request')
  @ApiOperation({ summary: 'Request OTP for consumer login' })
  requestOtp(@Body() dto: ConsumerPortalOtpRequestDto) {
    return this.authService.requestOtp(dto);
  }

  @Post('auth/otp/verify')
  @ApiOperation({ summary: 'Verify OTP and issue consumer JWT' })
  verifyOtp(@Body() dto: ConsumerPortalOtpVerifyDto) {
    return this.authService.verifyOtpLogin(dto);
  }

  @Post('applications/track')
  @ApiOperation({ summary: 'Track new connection application (public; uses consumer JWT when present)' })
  trackApplication(@Body() dto: ConsumerPortalTrackApplicationDto, @Req() req: Request) {
    return this.portalService.trackApplication(dto, this.resolveConsumerId(req));
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
      // Public track without a valid consumer token.
    }
    return undefined;
  }

  @Post('applications/new-connection')
  @ApiOperation({ summary: 'Apply for new connection (public)' })
  applyNewConnectionPublic(@Body() dto: ConsumerPortalNewConnectionDto) {
    return this.portalService.applyNewConnection('a0000000-0000-0000-0000-000000000001', dto);
  }

  @UseGuards(JwtAuthGuard, ConsumerPortalGuard)
  @Get('me')
  getProfile(@CurrentUser() user: JwtPayload) {
    return this.portalService.getProfile(user.tenantId, user.consumerId!);
  }

  @UseGuards(JwtAuthGuard, ConsumerPortalGuard)
  @Get('bills')
  listBills(@CurrentUser() user: JwtPayload) {
    return this.portalService.listMyBills(user.tenantId, user.consumerId!);
  }

  @UseGuards(JwtAuthGuard, ConsumerPortalGuard)
  @Get('bills/:id')
  getBill(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.portalService.getMyBill(user.tenantId, user.consumerId!, id);
  }

  @UseGuards(JwtAuthGuard, ConsumerPortalGuard)
  @Get('payments')
  listPayments(@CurrentUser() user: JwtPayload) {
    return this.portalService.listMyPayments(user.tenantId, user.consumerId!);
  }

  @UseGuards(JwtAuthGuard, ConsumerPortalGuard)
  @Get('payments/:id')
  getPayment(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.portalService.getMyPayment(user.tenantId, user.consumerId!, id);
  }

  @UseGuards(JwtAuthGuard, ConsumerPortalGuard)
  @Get('complaints')
  listComplaints(@CurrentUser() user: JwtPayload) {
    return this.portalService.listMyComplaints(user.tenantId, user.consumerId!);
  }

  @UseGuards(JwtAuthGuard, ConsumerPortalGuard)
  @Post('complaints')
  registerComplaint(@CurrentUser() user: JwtPayload, @Body() dto: ConsumerPortalComplaintDto) {
    return this.portalService.registerComplaint(user.tenantId, user.consumerId!, dto);
  }

  @UseGuards(JwtAuthGuard, ConsumerPortalGuard)
  @Get('applications')
  listApplications(@CurrentUser() user: JwtPayload) {
    return this.portalService.listMyApplications(user.tenantId, user.consumerId!);
  }

  @UseGuards(JwtAuthGuard, ConsumerPortalGuard)
  @Post('applications/track/me')
  @ApiOperation({ summary: 'Track application for logged-in consumer (alias)' })
  trackMyApplication(@CurrentUser() user: JwtPayload, @Body() dto: ConsumerPortalTrackApplicationDto) {
    return this.portalService.trackApplication(dto, user.consumerId!);
  }

  @UseGuards(JwtAuthGuard, ConsumerPortalGuard)
  @Get('applications/:requestNo')
  getApplication(@CurrentUser() user: JwtPayload, @Param('requestNo') requestNo: string) {
    return this.portalService.getMyApplication(user.tenantId, user.consumerId!, requestNo);
  }

  @UseGuards(JwtAuthGuard, ConsumerPortalGuard)
  @Post('applications/new-connection')
  applyNewConnection(@CurrentUser() user: JwtPayload, @Body() dto: ConsumerPortalNewConnectionDto) {
    return this.portalService.applyNewConnection(user.tenantId, dto, user.consumerId!);
  }

  @UseGuards(JwtAuthGuard, ConsumerPortalGuard)
  @Patch('profile/mobile')
  updateMobile(@CurrentUser() user: JwtPayload, @Body() dto: ConsumerPortalUpdateMobileDto) {
    return this.portalService.updateMobile(user.tenantId, user.consumerId!, dto);
  }

  @UseGuards(JwtAuthGuard, ConsumerPortalGuard)
  @Get('notifications')
  @ApiOperation({ summary: 'Consumer notification inbox' })
  listNotifications(@CurrentUser() user: JwtPayload) {
    return this.portalService.listNotifications(user.tenantId, user.consumerId!);
  }

  @UseGuards(JwtAuthGuard, ConsumerPortalGuard)
  @Patch('notifications/:id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  markNotificationRead(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.portalService.markNotificationRead(user.tenantId, user.consumerId!, id);
  }

  @UseGuards(JwtAuthGuard, ConsumerPortalGuard)
  @Post('notifications/read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllNotificationsRead(@CurrentUser() user: JwtPayload) {
    return this.portalService.markAllNotificationsRead(user.tenantId, user.consumerId!);
  }
}
