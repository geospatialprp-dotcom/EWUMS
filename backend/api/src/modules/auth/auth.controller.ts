import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { extractAuditContext } from '../../common/utils/request-context.util';
import { AuthService } from './auth.service';
import { PlatformStatsService } from './platform-stats.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private platformStats: PlatformStatsService,
  ) {}

  @Get('platform-stats')
  @ApiOperation({ summary: 'Public platform KPIs for login screen (live DB counts when available)' })
  getPlatformStats() {
    return this.platformStats.getLoginStats();
  }

  @Post('login')
  @ApiOperation({ summary: 'Authenticate user and receive JWT token' })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, extractAuditContext(req));
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Request a password reset for the given email' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  profile(@CurrentUser() user: JwtPayload) {
    return this.authService.getProfile(user.sub);
  }
}
