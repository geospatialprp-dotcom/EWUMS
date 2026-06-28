import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectDivisionGuard } from '../../common/guards/project-division.guard';
import { Role } from '../auth/entities/role.entity';
import { User } from '../auth/entities/user.entity';
import { Project } from '../projects/entities/project.entity';
import { DivisionAccessService } from './division-access.service';
import { DivisionStaffProvisionerService } from './division-staff-provisioner.service';
import { DivisionsController } from './divisions.controller';
import { Division } from './entities/division.entity';
import { Circle } from './entities/circle.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Division, Circle, User, Project, Role])],
  controllers: [DivisionsController],
  providers: [DivisionAccessService, DivisionStaffProvisionerService, ProjectDivisionGuard],
  exports: [DivisionAccessService, DivisionStaffProvisionerService, ProjectDivisionGuard, TypeOrmModule],
})
export class DivisionsModule {}
