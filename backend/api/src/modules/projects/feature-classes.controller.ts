import {
  Body, Controller, Delete, Get, Param, Patch, Post, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { ProjectDivisionGuard } from '../../common/guards/project-division.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CreateFeatureClassDto, UpdateFeatureClassDto } from './dto/feature-class.dto';
import { CreateProjectFeatureDto, ImportProjectFeaturesDto, UpdateProjectFeatureDto } from './dto/project-feature.dto';
import { FeatureClassesService } from './feature-classes.service';

@ApiTags('Project Feature Classes')
@Controller('projects/:projectId')
@UseGuards(JwtAuthGuard, PermissionsGuard, ProjectDivisionGuard)
@ApiBearerAuth()
export class FeatureClassesController {
  constructor(private featureClassesService: FeatureClassesService) {}

  @Get('feature-classes')
  @RequirePermissions('project:read')
  @ApiOperation({ summary: 'List feature classes for a project' })
  listClasses(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string) {
    return this.featureClassesService.listClasses(user.tenantId, projectId);
  }

  @Post('feature-classes/scaffold-la-gis-layers')
  @RequirePermissions('project:create', 'layer:create')
  @ApiOperation({ summary: 'Create all 44 standard Land Acquisition GIS overlay layers for a project' })
  scaffoldLaGisLayers(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
  ) {
    return this.featureClassesService.scaffoldLaGisLayers(user.tenantId, projectId);
  }

  @Post('feature-classes')
  @RequirePermissions('project:create', 'layer:create')
  @ApiOperation({ summary: 'Create a feature class with custom attribute table schema' })
  createClass(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Body() dto: CreateFeatureClassDto,
  ) {
    return this.featureClassesService.createClass(user.tenantId, projectId, dto);
  }

  @Get('feature-classes/:classId')
  @RequirePermissions('project:read')
  @ApiOperation({ summary: 'Get feature class definition' })
  getClass(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('classId') classId: string,
  ) {
    return this.featureClassesService.getClass(user.tenantId, projectId, classId);
  }

  @Patch('feature-classes/:classId')
  @RequirePermissions('project:update', 'layer:update')
  @ApiOperation({ summary: 'Update feature class name or attribute schema' })
  updateClass(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('classId') classId: string,
    @Body() dto: UpdateFeatureClassDto,
  ) {
    return this.featureClassesService.updateClass(user.tenantId, projectId, classId, dto);
  }

  @Delete('feature-classes/:classId')
  @RequirePermissions('project:delete', 'layer:delete')
  @ApiOperation({ summary: 'Delete feature class and all its features' })
  deleteClass(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('classId') classId: string,
  ) {
    return this.featureClassesService.deleteClass(user.tenantId, projectId, classId);
  }

  @Get('feature-classes/:classId/features')
  @RequirePermissions('project:read')
  @ApiOperation({ summary: 'List features in a feature class as GeoJSON' })
  listFeatures(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('classId') classId: string,
  ) {
    return this.featureClassesService.listFeatures(user, user.tenantId, projectId, classId);
  }

  @Post('feature-classes/:classId/features')
  @RequirePermissions('project:update', 'layer:update')
  @ApiOperation({ summary: 'Create a feature with geometry and attribute values' })
  createFeature(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('classId') classId: string,
    @Body() dto: CreateProjectFeatureDto,
  ) {
    return this.featureClassesService.createFeature(
      user.tenantId, projectId, classId, user.sub, dto,
    );
  }

  @Post('feature-classes/:classId/features/import')
  @RequirePermissions('project:update', 'layer:update')
  @ApiOperation({ summary: 'Bulk import survey/KML features with geometries and attributes' })
  importFeatures(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('classId') classId: string,
    @Body() dto: ImportProjectFeaturesDto,
  ) {
    return this.featureClassesService.importFeatures(
      user, user.tenantId, projectId, classId, user.sub, dto,
    );
  }

  @Patch('features/:featureId')
  @RequirePermissions('project:update', 'layer:update')
  @ApiOperation({ summary: 'Update feature geometry or attributes' })
  updateFeature(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('featureId') featureId: string,
    @Body() dto: UpdateProjectFeatureDto,
  ) {
    return this.featureClassesService.updateFeature(user.tenantId, projectId, featureId, dto);
  }

  @Delete('features/:featureId')
  @RequirePermissions('project:delete', 'project:update', 'layer:delete', 'layer:update')
  @ApiOperation({ summary: 'Delete a feature' })
  deleteFeature(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('featureId') featureId: string,
  ) {
    return this.featureClassesService.deleteFeature(user.tenantId, projectId, featureId);
  }
}
