import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ConstructionModule } from '../construction/construction.module';
import { GisLayer } from '../gis/entities/gis-layer.entity';
import { FeatureClassesController } from './feature-classes.controller';
import { FeatureClassesService } from './feature-classes.service';
import { ProjectFeatureClass } from './entities/project-feature-class.entity';
import { ProjectFeature } from './entities/project-feature.entity';
import { ProjectMilestone } from './entities/project-milestone.entity';
import { DprProposal } from '../dpr-planning/entities/dpr-proposal.entity';
import { Project } from './entities/project.entity';
import { MilestonesController } from './milestones.controller';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [
    AuthModule,
    ConstructionModule,
    TypeOrmModule.forFeature([
      Project, ProjectMilestone, ProjectFeatureClass, ProjectFeature, GisLayer, DprProposal,
    ]),
  ],
  controllers: [ProjectsController, MilestonesController, FeatureClassesController],
  providers: [ProjectsService, FeatureClassesService],
})
export class ProjectsModule {}