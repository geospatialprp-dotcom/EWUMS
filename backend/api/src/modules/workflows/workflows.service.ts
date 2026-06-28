import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isSuperAdmin } from '../../common/utils/operational-access.util';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../../common/services/audit.service';
import { ActOnTaskDto, SubmitWorkflowDto } from './dto/workflow.dto';
import { WorkflowDefinition } from './entities/workflow-definition.entity';
import { WorkflowInstance } from './entities/workflow-instance.entity';
import { WorkflowTask } from './entities/workflow-task.entity';

@Injectable()
export class WorkflowsService {
  constructor(
    @InjectRepository(WorkflowDefinition) private defsRepo: Repository<WorkflowDefinition>,
    @InjectRepository(WorkflowInstance) private instancesRepo: Repository<WorkflowInstance>,
    @InjectRepository(WorkflowTask) private tasksRepo: Repository<WorkflowTask>,
    private auditService: AuditService,
  ) {}

  async getDefinitions(tenantId: string) {
    return this.defsRepo.find({
      where: { tenantId, isActive: true },
      order: { name: 'ASC' },
    });
  }

  async getInbox(tenantId: string, roles: string[]) {
    const qb = this.tasksRepo
      .createQueryBuilder('t')
      .innerJoinAndSelect('t.instance', 'i')
      .where('i.tenant_id = :tenantId', { tenantId })
      .andWhere('i.status = :status', { status: 'pending' })
      .andWhere('t.status = :taskStatus', { taskStatus: 'pending' });

    qb.andWhere('t.assigned_role IN (:...roles)', { roles });

    const tasks = await qb.orderBy('t.created_at', 'DESC').getMany();

    return tasks.map((t) => ({
      taskId: t.id,
      stepOrder: t.stepOrder,
      stepName: t.stepName,
      assignedRole: t.assignedRole,
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
  }

  async getMySubmissions(tenantId: string, userId: string) {
    const instances = await this.instancesRepo.find({
      where: { tenantId, submittedBy: userId },
      relations: ['tasks'],
      order: { submittedAt: 'DESC' },
    });

    return instances.map((i) => ({
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

  async submit(tenantId: string, userId: string, dto: SubmitWorkflowDto) {
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
      await this.tasksRepo.save(
        this.tasksRepo.create({
          instanceId: saved.id,
          stepOrder: firstStep.order,
          stepName: firstStep.name,
          assignedRole: firstStep.role,
          status: 'pending',
        }),
      );
    }

    await this.auditService.log(tenantId, userId, 'workflow.submit', 'workflow', saved.id, {
      definitionCode: dto.definitionCode,
      title: dto.title,
    });

    return { id: saved.id, status: 'pending' };
  }

  async actOnTask(
    tenantId: string,
    userId: string,
    roles: string[],
    taskId: string,
    dto: ActOnTaskDto,
  ) {
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
        await this.tasksRepo.save(
          this.tasksRepo.create({
            instanceId: instance.id,
            stepOrder: nextStep.order,
            stepName: nextStep.name,
            assignedRole: nextStep.role,
            status: 'pending',
          }),
        );
      } else {
        instance.status = 'approved';
        instance.completedAt = new Date();
        await this.instancesRepo.save(instance);
      }
    }

    await this.auditService.log(tenantId, userId, `workflow.${dto.action}`, 'workflow', instance.id, {
      taskId,
      comments: dto.comments,
    });

    return {
      success: true,
      instanceStatus: instance.status,
      currentStep: instance.currentStep,
    };
  }
}
