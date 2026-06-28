import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';

import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';

import { RequirePermissions } from '../../common/decorators/permissions.decorator';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

import { PermissionsGuard } from '../../common/guards/permissions.guard';

import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

import { GisMapAuditDto } from './dto/gis-map-audit.dto';

import { GisSpatialQueryDto } from './dto/gis-spatial-query.dto';

import { GisService } from './gis.service';



@ApiTags('GIS')

@Controller('gis')

@UseGuards(JwtAuthGuard, PermissionsGuard)

@ApiBearerAuth()

export class GisController {

  constructor(private gisService: GisService) {}



  @Get('map-access')

  @RequirePermissions('layer:read', 'project:read')

  @ApiOperation({ summary: 'Role-based map jurisdiction context for Map Explorer' })

  getMapAccess(

    @CurrentUser() user: JwtPayload,

    @Query('divisionId') divisionId?: string,

  ) {

    return this.gisService.getMapAccessContext(user, divisionId?.trim() || undefined);

  }



  @Post('map-audit')

  @RequirePermissions('layer:read', 'project:read')

  @ApiOperation({ summary: 'Record map export or client-side map activity for audit trail' })

  logMapAudit(@CurrentUser() user: JwtPayload, @Body() dto: GisMapAuditDto) {

    return this.gisService.logMapAudit(user, dto);

  }



  @Post('spatial-query')

  @RequirePermissions('layer:read', 'project:read')

  @ApiOperation({ summary: 'Spatial query analysis on a feature class layer' })

  spatialQuery(@CurrentUser() user: JwtPayload, @Body() dto: GisSpatialQueryDto) {

    return this.gisService.spatialQuery(user, dto);

  }



  @Get('layers')

  @RequirePermissions('layer:read', 'project:read')

  @ApiOperation({ summary: 'Get published layer catalog grouped by layer group' })

  getLayerCatalog(@CurrentUser() user: JwtPayload) {

    return this.gisService.getLayerCatalog(user);

  }



  @Get('layers/all')

  @RequirePermissions('layer:read', 'project:read')

  @ApiOperation({ summary: 'Get all layers including unpublished' })

  getAllLayers(@CurrentUser() user: JwtPayload) {

    return this.gisService.getAllLayers(user);

  }



  @Get('layers/:layerId/features')

  @RequirePermissions('layer:read', 'project:read')

  @ApiOperation({ summary: 'Get GeoJSON features for a map layer' })

  getLayerFeatures(@CurrentUser() user: JwtPayload, @Param('layerId') layerId: string) {

    return this.gisService.getLayerFeatures(user, layerId);

  }

}


