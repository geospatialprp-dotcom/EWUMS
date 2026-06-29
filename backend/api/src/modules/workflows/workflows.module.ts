import { Module } from '@nestjs/common';

import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditModule } from '../audit/audit.module';

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

    ]),

    AuditModule,

  ],

  controllers: [WorkflowsController],

  providers: [WorkflowsService],

  exports: [WorkflowsService],

})

export class WorkflowsModule {}

