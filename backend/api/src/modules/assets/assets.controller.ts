import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { SpatialQueryDto } from './dto/spatial-query.dto';

@ApiTags('Assets')
@Controller('assets')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class AssetsController {
  constructor(private assetsService: AssetsService) {}

  @Get()
  @RequirePermissions('asset:read')
  @ApiOperation({ summary: 'List assets with optional spatial and attribute filters' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'assetType', required: false })
  @ApiQuery({ name: 'bbox', required: false, description: 'minX,minY,maxX,maxY' })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: string,
    @Query('assetType') assetType?: string,
    @Query('bbox') bbox?: string,
  ) {
    return this.assetsService.findAll(user.tenantId, user, { status, assetType, bbox });
  }

  @Get('types')
  @RequirePermissions('asset:read')
  @ApiOperation({ summary: 'List asset types for current tenant' })
  getTypes(@CurrentUser() user: JwtPayload) {
    return this.assetsService.getAssetTypes(user.tenantId);
  }

  @Get(':id')
  @RequirePermissions('asset:read')
  @ApiOperation({ summary: 'Get asset by ID' })
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.assetsService.findOne(user.tenantId, user, id);
  }

  @Post()
  @RequirePermissions('asset:create')
  @ApiOperation({ summary: 'Create new asset' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateAssetDto) {
    return this.assetsService.create(user.tenantId, user, dto);
  }

  @Post('spatial-query')
  @RequirePermissions('asset:read')
  @ApiOperation({ summary: 'Perform spatial query (buffer, intersect, within)' })
  spatialQuery(@CurrentUser() user: JwtPayload, @Body() dto: SpatialQueryDto) {
    return this.assetsService.spatialQuery(user.tenantId, user, dto);
  }
}
