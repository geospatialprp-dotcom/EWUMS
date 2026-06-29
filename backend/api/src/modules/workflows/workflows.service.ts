import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { isSuperAdmin } from '../../common/utils/operational-access.util';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../../common/services/audit.service';
import { AuditContext } from '../../common/utils/request-context.util';
import { ActOnTaskDto, SubmitWorkflowDto } from './dto/workflow.dto';
import { WorkflowDefinition } from './entities/workflow-definition.entity';
import { WorkflowInstance } from './entities/workflow-instance.entity';
import { WorkflowTask } from './entities/workflow-task.entity';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { DivisionAccessService } from '../divisions/division-access.service';
import { AlertNotificationService } from '../om/alert-notification.service';

@Injectable()
export class WorkflowsService {
  private readonly logger = new Logger(WorkflowsService.name);
  private workflowTablesReady: boolean | null = null;
  private assetProjectColumnReady: boolean | null = null;
  private assetSoftDeleteReady: boolean | null = null;

  constructor(
    @InjectRepository(WorkflowDefinition) private defsRepo: Repository<WorkflowDefinition>,
    @InjectRepository(WorkflowInstance) private instancesRepo: Repository<WorkflowInstance>,
    @InjectRepository(WorkflowTask) private tasksRepo: Repository<WorkflowTask>,
    private auditService: AuditService,
    private divisionAccess: DivisionAccessService,
    private alertNotifications: AlertNotificationService,
  ) {}

  async getDefinitions(tenantId: string) {
    try {
      if (!(await this.workflowTablesExist())) return [];
      return this.defsRepo.find({
        where: { tenantId, isActive: true },
        order: { name: 'ASC' },
      });
    } catch (err) {
      this.logWorkflowLoadError('definitions', tenantId, err);
      return [];
    }
  }

  async getInbox(tenantId: string, user: JwtPayload) {
    try {
      if (!(await this.workflowTablesExist())) return [];

      const roles = user.roles ?? [];
      const canViewAll = await this.divisionAccess.canViewAllDivisions(user);
      if (!canViewAll && roles.length === 0) return [];

      const qb = this.tasksRepo
        .createQueryBuilder('t')
        .innerJoinAndSelect('t.instance', 'i')
        .where('i.tenant_id = :tenantId', { tenantId })
        .andWhere('i.status = :status', { status: 'pending' })
        .andWhere('t.status = :taskStatus', { taskStatus: 'pending' });

      if (!canViewAll) {
        qb.andWhere('t.assigned_role IN (:...roles)', { roles });
      }

      const tasks = await qb.orderBy('t.created_at', 'DESC').take(25).getMany();
      const scopedTasks = await this.filterTasksByDivisionScope(tasks, user, tenantId);

      return scopedTasks.map((t) => ({
        taskId: t.id,
        stepOrder: t.stepOrder,
        stepName: t.stepName,
        assignedRole: t.assignedRole,
        createdAt: t.createdAt,
        instance: {
          id: t.instance.id,
          title: t.instance.title,
          resourceType: t.instance.resourceType,
          resourceId: t.instance.resourceId,
          status: t.instance.status,
          currentStep: t.instance.currentStep,
          payload: t.instance.payload,
          submittedBy: t.instance.submittedBy,
          submittedAt: t.instance.submittedAt,
        },
      }));
    } catch (err) {
      this.logWorkflowLoadError('inbox', tenantId, err, user.sub);
      return [];
    }
  }

  async getMySubmissions(tenantId: string, userId: string, user: JwtPayload) {
    try {
      if (!(await this.workflowTablesExist())) return [];

      const instances = await this.instancesRepo.find({
        where: { tenantId, submittedBy: userId },
        relations: ['tasks'],
        order: { submittedAt: 'DESC' },
      });

      const scopedInstances = await this.filterInstancesByDivisionScope(instances, user, tenantId);

      return scopedInstances.map((i) => ({
        id: i.id,
        title: i.title,
        resourceType: i.resourceType,
        status: i.status,
        currentStep: i.currentStep,
        submittedAt: i.submittedAt,
        completedAt: i.completedAt,
        tasks: i.tasks?.map((t) => ({
          id: t.id,
          stepName: t.stepName,
          status: t.status,
          actedAt: t.actedAt,
          comments: t.comments,
        })),
      }));
    } catch (err) {
      this.logWorkflowLoadError('submissions', tenantId, err, userId);
      return [];
    }
  }

  async getAllInstances(tenantId: string) {
    const instances = await this.instancesRepo.find({
      where: { tenantId },
      relations: ['tasks'],
      order: { submittedAt: 'DESC' },
      take: 100,
    });

    return instances.map((i) => ({
      id: i.id,
      title: i.title,
      resourceType: i.resourceType,
      status: i.status,
      currentStep: i.currentStep,
      payload: i.payload,
      submittedBy: i.submittedBy,
      submittedAt: i.submittedAt,
      completedAt: i.completedAt,
      tasks: i.tasks,
    }));
  }

  async submit(tenantId: string, user: JwtPayload, dto: SubmitWorkflowDto, auditContext?: AuditContext) {
    if (isSuperAdmin(user.roles)) {
      throw new ForbiddenException('Super Admin cannot submit workflow requests. Use an HQ or division account.');
    }
    const userId = user.sub;
    const def = await this.defsRepo.findOne({
      where: { tenantId, code: dto.definitionCode, isActive: true },
    });
    if (!def) throw new NotFoundException('Workflow definition not found');

    const instance = this.instancesRepo.create({
      tenantId,
      definitionId: def.id,
      resourceType: def.resourceType,
      resourceId: dto.resourceId,
      title: dto.title,
      status: 'pending',
      currentStep: 1,
      payload: dto.payload ?? {},
      submittedBy: userId,
      submittedAt: new Date(),
    });
    const saved = await this.instancesRepo.save(instance);

    const firstStep = def.steps.find((s) => s.order === 1);
    if (firstStep) {
      const task = await this.tasksRepo.save(
        this.tasksRepo.create({
          instanceId: saved.id,
          stepOrder: firstStep.order,
          stepName: firstStep.name,
          assignedRole: firstStep.role,
          status: 'pending',
        }),
      );
      this.notifyPendingTask(tenantId, saved, firstStep.name, firstStep.role, task.id).catch(() => undefined);
    }

    await this.auditService.log(tenantId, userId, 'workflow.submit', 'workflow', saved.id, {
      definitionCode: dto.definitionCode,
      title: dto.title,
    }, auditContext);

    return { id: saved.id, status: 'pending' };
  }

  async actOnTask(
    tenantId: string,
    user: JwtPayload,
    taskId: string,
    dto: ActOnTaskDto,
    auditContext?: AuditContext,
  ) {
    const userId = user.sub;
    const roles = user.roles ?? [];
    const task = await this.tasksRepo.findOne({
      where: { id: taskId },
      relations: ['instance'],
    });
    if (!task || task.instance.tenantId !== tenantId) {
      throw new NotFoundException('Task not found');
    }
    if (task.status !== 'pending') {
      throw new BadRequestException('Task already processed');
    }
    if (isSuperAdmin(roles)) {
      throw new ForbiddenException('Super Admin cannot act on workflow tasks. Use an HQ or division account.');
    }
    await this.assertInstanceDivisionAccess(user, tenantId, task.instance);
    if (!roles.includes(task.assignedRole)) {
      throw new BadRequestException('You are not authorized to act on this task');
    }

    task.status = dto.action === 'approve' ? 'approved' : 'rejected';
    task.comments = dto.comments ?? '';
    task.actedBy = userId;
    task.actedAt = new Date();
    await this.tasksRepo.save(task);

    const instance = task.instance;

    if (dto.action === 'reject') {
      instance.status = 'rejected';
      instance.completedAt = new Date();
      await this.instancesRepo.save(instance);
    } else {
      const def = await this.defsRepo.findOne({ where: { id: instance.definitionId } });
      const nextStep = def?.steps.find((s) => s.order === instance.currentStep + 1);

      if (nextStep) {
        instance.currentStep = nextStep.order;
        await this.instancesRepo.save(instance);
        const nextTask = await this.tasksRepo.save(
          this.tasksRepo.create({
            instanceId: instance.id,
            stepOrder: nextStep.order,
            stepName: nextStep.name,
            assignedRole: nextStep.role,
            status: 'pending',
          }),
        );
        this.notifyPendingTask(tenantId, instance, nextStep.name, nextStep.role, nextTask.id).catch(() => undefined);
      } else {
        instance.status = 'approved';
        instance.completedAt = new Date();
        await this.instancesRepo.save(instance);
      }
    }

    await this.auditService.log(tenantId, userId, `workflow.${dto.action}`, 'workflow', instance.id, {
      taskId,
      comments: dto.comments,
    }, auditContext);

    return {
      success: true,
      instanceStatus: instance.status,
      currentStep: instance.currentStep,
    };
  }

  private notifyPendingTask(
    tenantId: string,
    instance: Pick<WorkflowInstance, 'id' | 'title'>,
    stepName: string,
    assignedRole: string,
    taskId: string,
  ) {
    return this.alertNotifications.notifyWorkflowPendingApproval(tenantId, {
      assignedRole,
      instanceTitle: instance.title,
      stepName,
      taskId,
      instanceId: instance.id,
    });
  }

  private async assertInstanceDivisionAccess(
    user: JwtPayload,
    tenantId: string,
    instance: Pick<WorkflowInstance, 'resourceType' | 'resourceId' | 'payload'>,
  ): Promise<void> {
    const divisionIds = await this.divisionAccess.getAccessibleDivisionIds(user, tenantId);
    if (divisionIds === null) return;
    if (divisionIds.length === 0) {
      throw new ForbiddenException('This workflow belongs to another division.');
    }
    const divisionId = await this.resolveInstanceDivisionId(tenantId, instance);
    if (!divisionId || !divisionIds.includes(divisionId)) {
      throw new ForbiddenException('This workflow belongs to another division.');
    }
  }

  private readPayloadDivisionId(payload: Record<string, unknown> | null | undefined): string | null {
    const raw = payload?.divisionId ?? payload?.division_id;
    return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
  }

  private async resolveInstanceDivisionId(
    tenantId: string,
    instance: Pick<WorkflowInstance, 'resourceType' | 'resourceId' | 'payload'>,
  ): Promise<string | null> {
    try {
      const payloadDivision = this.readPayloadDivisionId(instance.payload);
      if (payloadDivision) return payloadDivision;

      if (!instance.resourceId) return null;

      if (instance.resourceType === 'project') {
        return this.divisionAccess.getProjectDivisionId(instance.resourceId);
      }

      if (instance.resourceType === 'asset' && await this.assetsHaveProjectLink()) {
        const softDeleteFilter = (await this.assetsHaveSoftDelete()) ? 'AND deleted_at IS NULL' : '';
        const rows = await this.instancesRepo.query(
          `SELECT project_id FROM assets WHERE id = $1 AND tenant_id = $2 ${softDeleteFilter}`,
          [instance.resourceId, tenantId],
        ) as Array<{ project_id: string | null }>;
        const projectId = rows[0]?.project_id ?? null;
        if (projectId) return this.divisionAccess.getProjectDivisionId(projectId);
      }

      const payloadProjectId = instance.payload?.projectId ?? instance.payload?.project_id;
      if (typeof payloadProjectId === 'string' && payloadProjectId.trim()) {
        return this.divisionAccess.getProjectDivisionId(payloadProjectId.trim());
      }

      return null;
    } catch (err) {
      this.logger.warn(
        `Could not resolve workflow division for ${instance.resourceType}/${instance.resourceId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return null;
    }
  }

  private async filterInstancesByDivisionScope(
    instances: WorkflowInstance[],
    user: JwtPayload,
    tenantId: string,
  ): Promise<WorkflowInstance[]> {
    try {
      const divisionIds = await this.divisionAccess.getAccessibleDivisionIds(user, tenantId);
      if (divisionIds === null) return instances;
      if (divisionIds.length === 0) return [];

      const filtered: WorkflowInstance[] = [];
      for (const instance of instances) {
        const divisionId = await this.resolveInstanceDivisionId(tenantId, instance);
        if (divisionId && divisionIds.includes(divisionId)) {
          filtered.push(instance);
        }
      }
      return filtered;
    } catch (err) {
      this.logWorkflowLoadError('instance division scope', tenantId, err, user.sub);
      return [];
    }
  }

  private async filterTasksByDivisionScope(
    tasks: WorkflowTask[],
    user: JwtPayload,
    tenantId: string,
  ): Promise<WorkflowTask[]> {
    try {
      const divisionIds = await this.divisionAccess.getAccessibleDivisionIds(user, tenantId);
      if (divisionIds === null) return tasks;
      if (divisionIds.length === 0) return [];

      const filtered: WorkflowTask[] = [];
      for (const task of tasks) {
        const divisionId = await this.resolveInstanceDivisionId(tenantId, task.instance);
        if (divisionId && divisionIds.includes(divisionId)) {
          filtered.push(task);
        }
      }
      return filtered;
    } catch (err) {
      this.logWorkflowLoadError('task division scope', tenantId, err, user.sub);
      return [];
    }
  }

  private async workflowTablesExist(): Promise<boolean> {
    if (this.workflowTablesReady !== null) return this.workflowTablesReady;
    try {
      const rows = await this.instancesRepo.query(
        `SELECT to_regclass('public.workflow_tasks') AS tasks,
                to_regclass('public.workflow_instances') AS instances,
                to_regclass('public.workflow_definitions') AS definitions`,
      ) as Array<{ tasks: string | null; instances: string | null; definitions: string | null }>;
      const row = rows[0] ?? {};
      this.workflowTablesReady = Boolean(row.tasks && row.instances && row.definitions);
    } catch {
      this.workflowTablesReady = false;
    }
    return this.workflowTablesReady;
  }

  private async assetsHaveProjectLink(): Promise<boolean> {
    if (this.assetProjectColumnReady !== null) return this.assetProjectColumnReady;
    try {
      const rows = await this.instancesRepo.query(
        `SELECT EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'assets' AND column_name = 'project_id'
         ) AS ok`,
      ) as Array<{ ok: boolean }>;
      this.assetProjectColumnReady = Boolean(rows[0]?.ok);
    } catch {
      this.assetProjectColumnReady = false;
    }
    return this.assetProjectColumnReady;
  }

  private async assetsHaveSoftDelete(): Promise<boolean> {
    if (this.assetSoftDeleteReady !== null) return this.assetSoftDeleteReady;
    try {
      const rows = await this.instancesRepo.query(
        `SELECT EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'assets' AND column_name = 'deleted_at'
         ) AS ok`,
      ) as Array<{ ok: boolean }>;
      this.assetSoftDeleteReady = Boolean(rows[0]?.ok);
    } catch {
      this.assetSoftDeleteReady = false;
    }
    return this.assetSoftDeleteReady;
  }

  private logWorkflowLoadError(scope: string, tenantId: string, err: unknown, userId?: string): void {
    this.logger.error(
      `Workflow ${scope} failed for tenant ${tenantId}${userId ? ` user ${userId}` : ''}: ${
        err instanceof Error ? err.message : String(err)
      }`,
      err instanceof Error ? err.stack : undefined,
    );
  }
}
