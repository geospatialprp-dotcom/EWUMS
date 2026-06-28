import {
  Body, Controller, Get, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import {
  AdvanceLaCaseDto,
  AutoRouteDto,
  CreateLaCaseDto,
  LinkLaCaseProjectDto,
  IdentifyParcelsDto,
  TraceAlignmentDto,
  UpdateLaClearanceDto,
  UpdateLaParcelDto,
} from './dto/land-acquisition.dto';
import { LandAcquisitionService } from './land-acquisition.service';

@ApiTags('Land Acquisition')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('land-acquisition')
export class LandAcquisitionController {
  constructor(private readonly service: LandAcquisitionService) {}

  @Get('catalog')
  @RequirePermissions('la_case:read')
  @ApiOperation({ summary: 'LA module catalog — scheme types, statuses, clearance types' })
  getCatalog() {
    return this.service.getCatalog();
  }

  @Get('dashboard')
  @RequirePermissions('la_case:read')
  getDashboard(@CurrentUser() user: JwtPayload) {
    return this.service.dashboard(user.tenantId, user);
  }

  @Get('gis-dashboard')
  @RequirePermissions('la_case:read')
  @ApiOperation({ summary: 'Tenant-wide LA GIS dashboard KPIs' })
  gisDashboard(@CurrentUser() user: JwtPayload) {
    return this.service.gisDashboard(user.tenantId, user);
  }

  @Get('cases/:id/gis-dashboard')
  @RequirePermissions('la_case:read')
  caseGisDashboard(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.service.caseGisDashboard(user.tenantId, user, id);
  }

  @Get('cases')
  @RequirePermissions('la_case:read')
  listCases(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: string,
  ) {
    return this.service.listCases(user.tenantId, user, { status });
  }

  @Post('cases')
  @RequirePermissions('la_case:create')
  createCase(@CurrentUser() user: JwtPayload, @Body() dto: CreateLaCaseDto) {
    return this.service.createCase(user.tenantId, user, dto);
  }

  @Get('cases/:id')
  @RequirePermissions('la_case:read')
  getCase(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.service.getCase(user.tenantId, user, id);
  }

  @Patch('cases/:id/link-project')
  @RequirePermissions('la_case:update')
  @ApiOperation({ summary: 'Link a GIS project to an LA case for routing and overlay analysis' })
  linkProject(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: LinkLaCaseProjectDto,
  ) {
    return this.service.linkProject(user.tenantId, user, id, dto);
  }

  @Get('ai-alerts')
  @RequirePermissions('la_case:read')
  @ApiOperation({ summary: 'Tenant-wide LA AI alerts' })
  tenantAiAlerts(@CurrentUser() user: JwtPayload) {
    return this.service.tenantAiAlerts(user.tenantId, user);
  }

  @Get('cases/:id/ai-alerts')
  @RequirePermissions('la_case:read')
  caseAiAlerts(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.service.caseAiAlerts(user.tenantId, user, id);
  }

  @Get('cases/:id/map-geojson')
  @RequirePermissions('la_case:read')
  getMapGeoJson(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.service.getMapGeoJson(user.tenantId, user, id);
  }

  @Get('proposals/:proposalId/readiness')
  @RequirePermissions('la_case:read')
  getProposalReadiness(@CurrentUser() user: JwtPayload, @Param('proposalId') proposalId: string) {
    return this.service.getReadinessForProposal(user.tenantId, proposalId);
  }

  @Post('cases/:id/trace-alignment')
  @RequirePermissions('la_case:update')
  traceAlignment(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: TraceAlignmentDto,
  ) {
    return this.service.traceAlignment(user.tenantId, user, id, dto);
  }

  @Post('cases/:id/preview-auto-route')
  @RequirePermissions('la_case:update')
  @ApiOperation({ summary: 'Preview GIS auto-routed pipeline alignment without saving' })
  previewAutoRoute(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AutoRouteDto,
  ) {
    return this.service.previewAutoRoute(user.tenantId, user, id, dto);
  }

  @Post('cases/:id/recommend-routes')
  @RequirePermissions('la_case:update')
  @ApiOperation({ summary: 'AI route recommendation — compare current route with 3 alternatives' })
  recommendRoutes(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AutoRouteDto,
  ) {
    return this.service.recommendRoutes(user.tenantId, user, id, dto);
  }

  @Post('cases/:id/auto-route')
  @RequirePermissions('la_case:update')
  @ApiOperation({ summary: 'Generate optimal pipeline route, save to la_alignment, and trace ROW' })
  autoRoute(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AutoRouteDto,
  ) {
    return this.service.autoRoute(user.tenantId, user, id, dto);
  }

  @Post('cases/:id/identify-parcels')
  @RequirePermissions('la_case:update')
  identifyParcels(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: IdentifyParcelsDto,
  ) {
    return this.service.identifyParcels(user.tenantId, user, id, dto);
  }

  @Post('cases/:id/detect-clearances')
  @RequirePermissions('la_case:update')
  detectClearances(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.service.detectClearances(user.tenantId, user, id);
  }

  @Post('cases/:id/estimate-compensation')
  @RequirePermissions('la_case:update')
  estimateCompensation(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.service.estimateCompensation(user.tenantId, user, id);
  }

  @Post('cases/:id/generate-documents')
  @RequirePermissions('la_case:update')
  @ApiOperation({ summary: 'Auto-generate all LA statutory documents from case data' })
  generateDocuments(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.service.generateDocuments(user.tenantId, user, id);
  }

  @Get('cases/:id/documents/:code')
  @RequirePermissions('la_case:read')
  getDocument(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('code') code: string,
  ) {
    return this.service.getDocument(user.tenantId, user, id, code);
  }

  @Post('cases/:id/advance')
  @RequirePermissions('la_case:approve')
  advanceCase(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AdvanceLaCaseDto,
  ) {
    return this.service.advanceCase(user.tenantId, user, id, dto);
  }

  @Patch('parcels/:parcelId')
  @RequirePermissions('la_case:update')
  updateParcel(
    @CurrentUser() user: JwtPayload,
    @Param('parcelId') parcelId: string,
    @Body() dto: UpdateLaParcelDto,
  ) {
    return this.service.updateParcel(user.tenantId, user, parcelId, dto);
  }

  @Patch('clearances/:clearanceId')
  @RequirePermissions('la_case:approve')
  updateClearance(
    @CurrentUser() user: JwtPayload,
    @Param('clearanceId') clearanceId: string,
    @Body() dto: UpdateLaClearanceDto,
  ) {
    return this.service.updateClearance(user.tenantId, user, clearanceId, dto);
  }
}
