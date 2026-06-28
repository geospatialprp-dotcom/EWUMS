import { Module } from '@nestjs/common';

import { TypeOrmModule } from '@nestjs/typeorm';

import { ProjectFeatureClass } from '../projects/entities/project-feature-class.entity';

import { ProjectFeature } from '../projects/entities/project-feature.entity';

import { GisMapAccessLog } from './entities/gis-map-access-log.entity';

import { GisLayerGroup } from './entities/gis-layer-group.entity';

import { GisLayer } from './entities/gis-layer.entity';

import { GisController } from './gis.controller';

import { GisMapAuditService } from './gis-map-audit.service';

import { GisService } from './gis.service';



@Module({

  imports: [TypeOrmModule.forFeature([

    GisLayer, GisLayerGroup, ProjectFeature, ProjectFeatureClass, GisMapAccessLog,

  ])],

  controllers: [GisController],

  providers: [GisService, GisMapAuditService],

})

export class GisModule {}


