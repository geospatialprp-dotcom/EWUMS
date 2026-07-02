import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DprProposalDivisionGuard } from '../../common/guards/dpr-proposal-division.guard';
import { LandAcquisitionModule } from '../land-acquisition/land-acquisition.module';
import { DprPlanningController } from './dpr-planning.controller';
import { DprPlanningService } from './dpr-planning.service';
import { DprProposal } from './entities/dpr-proposal.entity';
import {
  DprProposalDocument,
  DprBoqValidation,
  DprSanction,
  DprTenderPackage,
  DprWorkflowEvent,
} from './entities/dpr-planning-support.entity';
import { DprPdfReview } from '../dpr-pdf-review/entities/dpr-pdf-review.entity';

@Module({
  imports: [
    LandAcquisitionModule,
    TypeOrmModule.forFeature([
      DprProposal,
      DprProposalDocument,
      DprBoqValidation,
      DprWorkflowEvent,
      DprSanction,
      DprTenderPackage,
      DprPdfReview,
    ]),
  ],
  controllers: [DprPlanningController],
  providers: [DprPlanningService, DprProposalDivisionGuard],
  exports: [DprPlanningService],
})
export class DprPlanningModule {}
