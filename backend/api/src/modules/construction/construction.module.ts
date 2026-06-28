import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkflowsModule } from '../workflows/workflows.module';
import { WorkflowTask } from '../workflows/entities/workflow-task.entity';
import { ConstructionController } from './construction.controller';
import { ConstructionService } from './construction.service';
import { BoqItem } from './entities/boq-item.entity';
import { ConstructionAsset } from './entities/construction-asset.entity';
import { ConstructionDocument } from './entities/construction-document.entity';
import { ContractorInvoice } from './entities/contractor-invoice.entity';
import { DprActivity } from './entities/dpr-activity.entity';
import { DprReport } from './entities/dpr-report.entity';
import { InvoiceLineItem } from './entities/invoice-line-item.entity';
import { MbEntry } from './entities/mb-entry.entity';
import { MeasurementBook } from './entities/measurement-book.entity';
import { ProjectCompletion } from './entities/project-completion.entity';
import { RaBill } from './entities/ra-bill.entity';
import { RaBillLine } from './entities/ra-bill-line.entity';
import { WorkPackage } from './entities/work-package.entity';
import { WorkPlanning } from './entities/work-planning.entity';
import { Project } from '../projects/entities/project.entity';
import { ProjectMilestone } from '../projects/entities/project-milestone.entity';
import { ProjectProgressSyncService } from './project-progress-sync.service';

@Module({
  imports: [
    WorkflowsModule,
    TypeOrmModule.forFeature([
      BoqItem,
      DprReport,
      DprActivity,
      MeasurementBook,
      MbEntry,
      ContractorInvoice,
      InvoiceLineItem,
      ConstructionDocument,
      WorkflowTask,
      WorkPackage,
      WorkPlanning,
      RaBill,
      RaBillLine,
      ConstructionAsset,
      ProjectCompletion,
      Project,
      ProjectMilestone,
    ]),
  ],
  controllers: [ConstructionController],
  providers: [ConstructionService, ProjectProgressSyncService],
  exports: [ProjectProgressSyncService],
})
export class ConstructionModule {}
