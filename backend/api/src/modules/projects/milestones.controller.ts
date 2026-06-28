import {
  Body, Controller, Delete, Param, Patch, Post, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { ProjectDivisionGuard } from '../../common/guards/project-division.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import { ProjectsService } from './projects.service';

@ApiTags('Project Milestones')
@Controller('projects/:projectId/milestones')
@UseGuards(JwtAuthGuard, PermissionsGuard, ProjectDivisionGuard)
@ApiBearerAuth()
export class MilestonesController {
  constructor(private projectsService: ProjectsService) {}

  @Post()
  @RequirePermissions('project:milestone')
  @ApiOperation({ summary: 'Add a milestone to a project (division JE/AE/EE/Accounts only)' })
  create(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Body() dto: CreateMilestoneDto,
  ) {
    return this.projectsService.createMilestone(user.tenantId, projectId, dto, user);
  }

  @Patch(':milestoneId')
  @RequirePermissions('project:milestone')
  @ApiOperation({ summary: 'Update a project milestone (division JE/AE/EE/Accounts only)' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('milestoneId') milestoneId: string,
    @Body() dto: UpdateMilestoneDto,
  ) {
    return this.projectsService.updateMilestone(user.tenantId, projectId, milestoneId, dto, user);
  }

  @Delete(':milestoneId')
  @RequirePermissions('project:milestone')
  @ApiOperation({ summary: 'Delete a project milestone (division JE/AE/EE/Accounts only)' })
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('milestoneId') milestoneId: string,
  ) {
    return this.projectsService.deleteMilestone(user.tenantId, projectId, milestoneId, user);
  }
}
