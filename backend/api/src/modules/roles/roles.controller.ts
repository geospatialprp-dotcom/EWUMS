import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { RolesService } from './roles.service';

@ApiTags('Roles')
@Controller('roles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class RolesController {
  constructor(private rolesService: RolesService) {}

  @Get()
  @RequirePermissions('user:read')
  @ApiOperation({ summary: 'List roles with permissions' })
  findAll(@CurrentUser() user: JwtPayload) {
    return this.rolesService.findAll(user.tenantId);
  }

  @Get('permissions')
  @RequirePermissions('user:read')
  @ApiOperation({ summary: 'List all system permissions' })
  permissions() {
    return this.rolesService.findAllPermissions();
  }
}
