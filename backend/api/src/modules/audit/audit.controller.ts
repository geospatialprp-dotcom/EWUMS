import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { isSuperAdmin } from '../../common/utils/operational-access.util';
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
  @ApiOperation({ summary: 'List audit log entries (HQ: optional division filter; EE: own division)' })
  logs(@CurrentUser() user: JwtPayload, @Query('limit') limit?: string) {
    const hqView = Boolean(user.canViewAllDivisions) || isSuperAdmin(user.roles);
    // HQ: only filter when header division is selected. EE: always own division.
    const divisionScope = hqView
      ? (user.activeDivisionId ?? null)
      : (user.activeDivisionId ?? user.divisionId ?? null);

    return this.auditService.findAll(
      user.tenantId,
      limit ? parseInt(limit, 10) : 100,
      divisionScope,
    );
  }
}
