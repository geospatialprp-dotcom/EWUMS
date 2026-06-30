import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectsModule } from '../projects/projects.module';
import { DprProposal } from '../dpr-planning/entities/dpr-proposal.entity';
import { ProjectFeatureClass } from '../projects/entities/project-feature-class.entity';
import { Project } from '../projects/entities/project.entity';
import {
  LaAlignmentSegment,
  LaCase,
  LaCaseDocument,
  LaClearanceItem,
  LaClearanceProposal,
  LaCompensationSchedule,
  LaParcel,
  LaParcelOwner,
  LaWorkflowEvent,
} from './entities/la.entities';
import { LandAcquisitionController } from './land-acquisition.controller';
import { LandAcquisitionService } from './land-acquisition.service';
import { LaAutoRouteService } from './la-auto-route.service';

@Module({
  imports: [
    forwardRef(() => ProjectsModule),
    TypeOrmModule.forFeature([
      LaCase,
      LaCaseDocument,
      LaAlignmentSegment,
      LaParcel,
      LaParcelOwner,
      LaClearanceItem,
      LaClearanceProposal,
      LaCompensationSchedule,
      LaWorkflowEvent,
      Project,
      DprProposal,
      ProjectFeatureClass,
    ]),
  ],
  controllers: [LandAcquisitionController],
  providers: [LandAcquisitionService, LaAutoRouteService],
  exports: [LandAcquisitionService],
})
export class LandAcquisitionModule {}
