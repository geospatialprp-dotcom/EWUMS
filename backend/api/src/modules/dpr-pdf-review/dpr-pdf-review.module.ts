import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { DprProposalDivisionGuard } from '../../common/guards/dpr-proposal-division.guard';
import { DprPlanningModule } from '../dpr-planning/dpr-planning.module';
import { DprProposal } from '../dpr-planning/entities/dpr-proposal.entity';
import { DprProposalDocument } from '../dpr-planning/entities/dpr-planning-support.entity';
import { DprPdfReviewController } from './dpr-pdf-review.controller';
import { DprPdfReviewService } from './dpr-pdf-review.service';
import {
  DprPdfAnnotation,
  DprPdfComment,
  DprPdfReview,
  DprPdfVersion,
} from './entities/dpr-pdf-review.entity';

@Module({
  imports: [
    DprPlanningModule,
    AuditModule,
    TypeOrmModule.forFeature([
      DprPdfReview,
      DprPdfAnnotation,
      DprPdfComment,
      DprPdfVersion,
      DprProposalDocument,
      DprProposal,
    ]),
  ],
  controllers: [DprPdfReviewController],
  providers: [DprPdfReviewService, DprProposalDivisionGuard],
  exports: [DprPdfReviewService],
})
export class DprPdfReviewModule {}
