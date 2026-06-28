import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { extractAuditContext } from '../../common/utils/request-context.util';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ActOnTaskDto, SubmitWorkflowDto } from './dto/workflow.dto';
import { WorkflowsService } from './workflows.service';

@ApiTags('Workflows')
@Controller('workflows')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class WorkflowsController {
  constructor(private workflowsService: WorkflowsService) {}

  @Get('definitions')
  @ApiOperation({ summary: 'List active workflow definitions' })
  definitions(@CurrentUser() user: JwtPayload) {
    return this.workflowsService.getDefinitions(user.tenantId);
  }

  @Get('inbox')
  @ApiOperation({ summary: 'Get pending workflow tasks for current user roles' })
  inbox(@CurrentUser() user: JwtPayload) {
    return this.workflowsService.getInbox(user.tenantId, user);
  }

  @Get('submissions')
  @ApiOperation({ summary: 'Get workflows submitted by current user' })
  submissions(@CurrentUser() user: JwtPayload) {
    return this.workflowsService.getMySubmissions(user.tenantId, user.sub, user);
  }

  @Get('instances')
  @RequirePermissions('audit:read')
  @ApiOperation({ summary: 'List all workflow instances' })
  instances(@CurrentUser() user: JwtPayload) {
    return this.workflowsService.getAllInstances(user.tenantId);
  }

  @Post('submit')
  @ApiOperation({ summary: 'Submit a new workflow instance' })
  submit(@CurrentUser() user: JwtPayload, @Body() dto: SubmitWorkflowDto, @Req() req: Request) {
    return this.workflowsService.submit(user.tenantId, user, dto, extractAuditContext(req));
  }

  @Post('tasks/:taskId/act')
  @ApiOperation({ summary: 'Approve or reject a workflow task' })
  actOnTask(
    @CurrentUser() user: JwtPayload,
    @Param('taskId') taskId: string,
    @Body() dto: ActOnTaskDto,
    @Req() req: Request,
  ) {
    return this.workflowsService.actOnTask(user.tenantId, user, taskId, dto, extractAuditContext(req));
  }
}
