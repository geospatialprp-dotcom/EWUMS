import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditService } from '../../common/services/audit.service';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { WorkflowDefinition } from './entities/workflow-definition.entity';
import { WorkflowInstance } from './entities/workflow-instance.entity';
import { WorkflowTask } from './entities/workflow-task.entity';
import { WorkflowsController } from './workflows.controller';
import { WorkflowsService } from './workflows.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkflowDefinition,
      WorkflowInstance,
      WorkflowTask,
      AuditLog,
    ]),
  ],
  controllers: [WorkflowsController],
  providers: [WorkflowsService, AuditService],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}
