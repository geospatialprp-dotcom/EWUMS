import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { AuditLogsService } from './audit.service';

@ApiTags('Audit')
@Controller('audit')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class AuditController {
  constructor(private auditService: AuditLogsService) {}

  @Get('logs')
  @RequirePermissions('audit:read')
  @ApiOperation({ summary: 'List audit log entries' })
  logs(@CurrentUser() user: JwtPayload, @Query('limit') limit?: string) {
    return this.auditService.findAll(user.tenantId, limit ? parseInt(limit, 10) : 100);
  }
}
