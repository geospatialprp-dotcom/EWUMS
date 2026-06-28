import { Controller, ForbiddenException, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { DivisionAccessService } from './division-access.service';
import { DivisionStaffProvisionerService } from './division-staff-provisioner.service';

@ApiTags('Divisions')
@Controller('divisions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DivisionsController {
  constructor(
    private divisionAccess: DivisionAccessService,
    private divisionStaff: DivisionStaffProvisionerService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List divisions visible to the current user' })
  list(@CurrentUser() user: JwtPayload) {
    return this.divisionAccess.listDivisions(user.tenantId, user);
  }

  @Get('access')
  @ApiOperation({ summary: 'Current user division access context' })
  access(@CurrentUser() user: JwtPayload) {
    return this.divisionAccess.accessContext(user);
  }

  @Get('staff-logins')
  @ApiOperation({ summary: 'Division staff logins (Super Admin only — not for public login screen)' })
  staffLogins(@CurrentUser() user: JwtPayload) {
    if (!user.roles?.includes('super_admin')) {
      throw new ForbiddenException('Only Super Admin can view division staff credentials.');
    }
    return this.divisionStaff.listDemoAccounts(user.tenantId);
  }
}