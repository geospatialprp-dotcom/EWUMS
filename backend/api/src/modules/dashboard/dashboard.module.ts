import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Asset } from '../assets/entities/asset.entity';
import { Project } from '../projects/entities/project.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [TypeOrmModule.forFeature([Asset, Project])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
