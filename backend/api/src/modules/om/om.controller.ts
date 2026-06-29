import { Body, Controller, Get, Param, Patch, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Response } from 'express';
import { createReadStream } from 'fs';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ActOnTaskDto } from '../workflows/dto/workflow.dto';
import { ApproveHandoverDocumentDto } from './dto/approve-handover-document.dto';
import { CreateBreakdownTicketDto, AdvanceBreakdownTicketDto } from './dto/create-breakdown-ticket.dto';
import { CreateHandoverDto } from './dto/create-handover.dto';
import { UpdateHandoverDto } from './dto/update-handover.dto';
import { RegisterOmAssetDto, ImportConstructionAssetsDto } from './dto/register-om-asset.dto';
import { UpdateOmAssetDto } from './dto/update-om-asset.dto';
import { CreateOmInspectionDto } from './dto/create-om-inspection.dto';
import { CompleteOmPmDto } from './dto/complete-om-pm.dto';
import { GenerateOmPmDto } from './dto/generate-om-pm.dto';
import { CreateOmWqTestDto, AdvanceOmWqTestDto } from './dto/create-om-wq-test.dto';
import { CreateOmEnergyReadingDto } from './dto/create-om-energy-reading.dto';
import { IngestScadaReadingDto } from './dto/ingest-scada-reading.dto';
import { CreateOmConsumerDto, CreateConsumerServiceRequestDto } from './dto/create-om-consumer.dto';
import { CreateOmComplaintDto, AdvanceOmComplaintDto } from './dto/create-om-complaint.dto';
import {
  CreateOmContractDto,
  RecordContractAttendanceDto,
  RecordContractKpiDto,
  CreateContractReviewDto,
} from './dto/create-om-contract.dto';
import {
  AssessAssetLifecycleDto,
  CreateRenewalPlanDto,
  GenerateAnnualRenewalPlanDto,
  GenerateRenewalPlansDto,
  UpdateRenewalPlanDto,
} from './dto/create-om-lifecycle.dto';
import {
  CreateBillingTariffDto,
  ArrearActionDto,
  DeliverBillDto,
  GenerateBillsDto,
  CreateConsumerAccountDto,
  LinkConsumerAccountDto,
  RecordMeterReadingDto,
  RecordPaymentDto,
  UpdateBillStatusDto,
} from './dto/create-om-billing.dto';
import { CreateAccountingAdjustmentDto } from './dto/om-accounting.dto';
import { GenerateOmReportQueryDto } from './dto/generate-om-report.dto';
import { OmAssetService } from './om-asset.service';
import { OmBreakdownService } from './om-breakdown.service';
import { OmEnergyService } from './om-energy.service';
import { OmScadaService } from './om-scada.service';
import { OmConsumerService } from './om-consumer.service';
import { OmComplaintService } from './om-complaint.service';
import { OmContractService } from './om-contract.service';
import { OmLifecycleService } from './om-lifecycle.service';
import { OmDashboardService } from './om-dashboard.service';
import { OmBillingService } from './om-billing.service';
import { OmAccountingService } from './om-accounting.service';
import { OmMobileBillingService } from './om-mobile-billing.service';
import { ConsumerNotificationService } from './consumer-notification.service';
import { AlertNotificationService } from './alert-notification.service';
import { MobileMeterReadingDto, MobilePaymentDto, MobileSyncBatchDto, CreatePaymentGatewayOrderDto, VerifyPaymentGatewayDto } from './dto/om-mobile-billing.dto';
import { OmReportsService } from './om-reports.service';
import { OmInspectionService } from './om-inspection.service';
import { OmPmService } from './om-pm.service';
import { OmWqService } from './om-wq.service';
import { OmService } from './om.service';

@ApiTags('O&M Management')
@Controller('om')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class OmController {
  constructor(
    private omService: OmService,
    private omAssetService: OmAssetService,
    private omInspectionService: OmInspectionService,
    private omPmService: OmPmService,
    private omBreakdownService: OmBreakdownService,
    private omWqService: OmWqService,
    private omEnergyService: OmEnergyService,
    private omScadaService: OmScadaService,
    private omConsumerService: OmConsumerService,
    private omComplaintService: OmComplaintService,
    private omContractService: OmContractService,
    private omLifecycleService: OmLifecycleService,
    private omDashboardService: OmDashboardService,
    private omReportsService: OmReportsService,
    private omBillingService: OmBillingService,
    private omAccountingService: OmAccountingService,
    private omMobileBillingService: OmMobileBillingService,
    private consumerNotificationService: ConsumerNotificationService,
    private alertNotificationService: AlertNotificationService,
  ) {}

  @Get('stages')
  @RequirePermissions('om:read')
  @ApiOperation({ summary: 'Get 15-stage O&M workflow definition' })
  getStages() {
    return this.omService.getStages();
  }

  @Get('dashboard')
  @RequirePermissions('om:read')
  @ApiOperation({ summary: 'O&M operational dashboard summary' })
  async getDashboard(@CurrentUser() user: JwtPayload) {
    const dash = await this.omService.getDashboard(user, user.tenantId);
    const [insp, pm, bd, wq, en, sc, cs, cp, ct, lc] = await Promise.all([
      this.omInspectionService.getSummary(user, user.tenantId),
      this.omPmService.getSummary(user, user.tenantId),
      this.omBreakdownService.getSummary(user, user.tenantId),
      this.omWqService.getSummary(user, user.tenantId),
      this.omEnergyService.getSummary(user, user.tenantId),
      this.omScadaService.getSummary(user, user.tenantId),
      this.omConsumerService.getSummary(user, user.tenantId),
      this.omComplaintService.getSummary(user, user.tenantId),
      this.omContractService.getSummary(user, user.tenantId),
      this.omLifecycleService.getSummary(user, user.tenantId),
    ]);
    return {
      ...dash,
      openBreakdowns: bd.openBreakdowns,
      closedBreakdowns: bd.closedBreakdowns,
      openComplaints: cp.openComplaints,
      closedComplaints: cp.closedComplaints,
      activeContracts: ct.activeContracts,
      avgSlaCompliancePct: ct.avgSlaCompliancePct,
      contractsBelowSla: ct.contractsBelowSla,
      avgHealthIndex: lc.avgHealthIndex,
      criticalAssets: lc.criticalAssets,
      replacementDue: lc.replacementDue,
      inspectionDue: insp.inspectionDue,
      inspections: insp,
      pmOverdue: pm.pmOverdue,
      preventiveMaintenance: pm,
      breakdownMaintenance: bd,
      waterQualityAlerts: wq.waterQualityAlerts,
      waterQuality: wq,
      energyManagement: en,
      scadaAlerts: sc.scadaAlerts,
      scadaIot: sc,
      consumerService: cs,
      complaintManagement: cp,
      contractManagement: ct,
      assetLifecycle: lc,
    };
  }

  @Get('handovers/prefill/:projectId')
  @RequirePermissions('om:read')
  @ApiOperation({ summary: 'Stage 1 — prefill handover from completed project' })
  getHandoverPrefill(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string) {
    return this.omService.getHandoverPrefill(user, user.tenantId, projectId);
  }

  @Get('handovers')
  @RequirePermissions('om:read')
  listHandovers(@CurrentUser() user: JwtPayload, @Query('projectId') projectId?: string) {
    return this.omService.listHandovers(user, user.tenantId, projectId);
  }

  @Get('handovers/:id')
  @RequirePermissions('om:read')
  getHandover(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.omService.getHandover(user, user.tenantId, id);
  }

  @Post('handovers')
  @RequirePermissions('om:create')
  createHandover(@CurrentUser() user: JwtPayload, @Body() dto: CreateHandoverDto) {
    return this.omService.createHandover(user, user.tenantId, user.sub, dto);
  }

  @Patch('handovers/:id')
  @RequirePermissions('om:update')
  updateHandover(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateHandoverDto) {
    return this.omService.updateHandover(user, user.tenantId, id, dto);
  }

  @Post('handovers/:id/generate')
  @RequirePermissions('om:update')
  @ApiOperation({ summary: 'Generate handover certificate, O&M matrix, and asset registers' })
  generateHandover(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.omService.generateHandoverOutputs(user, user.tenantId, id);
  }

  @Post('handovers/:id/submit')
  @RequirePermissions('om:submit')
  @ApiOperation({ summary: 'Submit handover for JE → AE → EE approval workflow' })
  submitHandover(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.omService.submitHandover(user, user.tenantId, user.sub, id);
  }

  @Post('handovers/:id/workflow')
  @RequirePermissions('om:approve')
  actOnHandover(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: ActOnTaskDto) {
    return this.omService.actOnHandoverWorkflow(user, user.tenantId, user.sub, user.roles ?? [], id, dto);
  }

  @Get('handovers/:id/documents')
  @RequirePermissions('om:read')
  @ApiOperation({ summary: 'Electronic handover document repository' })
  listHandoverDocuments(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.omService.listHandoverDocuments(user, user.tenantId, id);
  }

  @Post('handovers/:id/documents/upload')
  @RequirePermissions('om:update')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Upload handover document (PDF/image)' })
  uploadHandoverDocument(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @UploadedFile() file: { buffer: Buffer; originalname?: string },
    @Body('docType') docType: string,
  ) {
    return this.omService.uploadHandoverDocument(user, user.tenantId, id, user.sub, docType, file);
  }

  @Patch('handovers/:handoverId/documents/:docId')
  @RequirePermissions('om:approve')
  @ApiOperation({ summary: 'Department approval / rejection of handover document' })
  actOnHandoverDocument(
    @CurrentUser() user: JwtPayload,
    @Param('handoverId') handoverId: string,
    @Param('docId') docId: string,
    @Body() dto: ApproveHandoverDocumentDto,
  ) {
    return this.omService.actOnHandoverDocument(user, user.tenantId, handoverId, docId, user.sub, dto);
  }

  @Get('handovers/:handoverId/documents/:docId/file')
  @RequirePermissions('om:read')
  async downloadHandoverDocument(
    @CurrentUser() user: JwtPayload,
    @Param('handoverId') handoverId: string,
    @Param('docId') docId: string,
    @Res() res: Response,
  ) {
    const { doc, absolutePath, mimeType } = await this.omService.resolveHandoverDocumentFile(
      user, user.tenantId, handoverId, docId,
    );
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${doc.fileName ?? 'document'}"`);
    createReadStream(absolutePath).pipe(res);
  }

  @Get('assets/catalog')
  @RequirePermissions('om:read')
  @ApiOperation({ summary: 'Stage 2 — O&M asset category catalogue' })
  getAssetCatalog() {
    return this.omAssetService.getCatalog();
  }

  @Get('assets')
  @RequirePermissions('om:read')
  @ApiOperation({ summary: 'Stage 2 — List scheme O&M assets' })
  listSchemeAssets(
    @CurrentUser() user: JwtPayload,
    @Query('projectId') projectId?: string,
    @Query('projectCode') projectCode?: string,
    @Query('handoverId') handoverId?: string,
    @Query('category') category?: string,
    @Query('typeCode') typeCode?: string,
  ) {
    return this.omAssetService.listSchemeAssets(user, user.tenantId, {
      projectId, projectCode, handoverId, category, typeCode,
    });
  }

  @Get('assets/:id')
  @RequirePermissions('om:read')
  getSchemeAsset(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.omAssetService.getSchemeAsset(user, user.tenantId, id);
  }

  @Get('assets/:id/qr')
  @RequirePermissions('om:read')
  getAssetQr(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.omAssetService.getAssetQrInfo(user, user.tenantId, id);
  }

  @Post('assets')
  @RequirePermissions('om:create')
  @ApiOperation({ summary: 'Stage 2 — Register O&M asset with GIS & QR code' })
  registerAsset(@CurrentUser() user: JwtPayload, @Body() dto: RegisterOmAssetDto) {
    return this.omAssetService.registerAsset(user, user.tenantId, user.sub, dto);
  }

  @Patch('assets/:id')
  @RequirePermissions('om:update', 'om:create')
  @ApiOperation({ summary: 'Stage 2 — Update O&M asset details & GIS' })
  updateSchemeAsset(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateOmAssetDto,
  ) {
    return this.omAssetService.updateSchemeAsset(user, user.tenantId, user.sub, id, dto);
  }

  @Post('assets/import-construction')
  @RequirePermissions('om:create')
  @ApiOperation({ summary: 'Import construction assets into O&M register' })
  importConstructionAssetsBody(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ImportConstructionAssetsDto,
  ) {
    return this.omAssetService.importFromConstruction(user, user.tenantId, user.sub, dto);
  }

  @Post('assets/import-construction/:projectId')
  @RequirePermissions('om:create')
  @ApiOperation({ summary: 'Import construction assets (legacy path param)' })
  importConstructionAssets(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Query('handoverId') handoverId?: string,
  ) {
    return this.omAssetService.importFromConstruction(user, user.tenantId, user.sub, { projectId, handoverId });
  }

  @Get('inspections/catalog')
  @RequirePermissions('om:read')
  @ApiOperation({ summary: 'Stage 3 — Inspection checklist catalogue' })
  getInspectionCatalog() {
    return this.omInspectionService.getCatalog();
  }

  @Get('inspections/summary')
  @RequirePermissions('om:read')
  getInspectionSummary(
    @CurrentUser() user: JwtPayload,
    @Query('projectId') projectId?: string,
  ) {
    return this.omInspectionService.getSummary(user, user.tenantId, projectId);
  }

  @Get('inspections')
  @RequirePermissions('om:read')
  @ApiOperation({ summary: 'Stage 3 — List routine inspections' })
  listInspections(
    @CurrentUser() user: JwtPayload,
    @Query('projectId') projectId?: string,
    @Query('projectCode') projectCode?: string,
    @Query('inspectionType') inspectionType?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.omInspectionService.listInspections(user, user.tenantId, {
      projectId, projectCode, inspectionType, from, to,
    });
  }

  @Get('inspections/:id')
  @RequirePermissions('om:read')
  getInspection(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.omInspectionService.getInspection(user, user.tenantId, id);
  }

  @Post('inspections')
  @RequirePermissions('om:create')
  @ApiOperation({ summary: 'Stage 3 — Submit routine inspection' })
  createInspection(@CurrentUser() user: JwtPayload, @Body() dto: CreateOmInspectionDto) {
    return this.omInspectionService.createInspection(user, user.tenantId, user.sub, dto);
  }

  @Get('maintenance/catalog')
  @RequirePermissions('om:read')
  @ApiOperation({ summary: 'Stage 4 — Preventive maintenance task catalogue' })
  getPmCatalog() {
    return this.omPmService.getCatalog();
  }

  @Get('maintenance/summary')
  @RequirePermissions('om:read')
  getPmSummary(
    @CurrentUser() user: JwtPayload,
    @Query('projectId') projectId?: string,
  ) {
    return this.omPmService.getSummary(user, user.tenantId, projectId);
  }

  @Get('maintenance/schedules')
  @RequirePermissions('om:read')
  @ApiOperation({ summary: 'Stage 4 — List preventive maintenance schedules' })
  listPmSchedules(
    @CurrentUser() user: JwtPayload,
    @Query('projectId') projectId?: string,
    @Query('projectCode') projectCode?: string,
    @Query('category') category?: string,
    @Query('frequency') frequency?: string,
    @Query('status') status?: string,
  ) {
    return this.omPmService.listSchedules(user, user.tenantId, {
      projectId, projectCode, category, frequency, status,
    });
  }

  @Post('maintenance/generate')
  @RequirePermissions('om:create')
  @ApiOperation({ summary: 'Stage 4 — Auto-generate PM schedules for current period' })
  generatePmSchedules(@CurrentUser() user: JwtPayload, @Body() dto: GenerateOmPmDto) {
    return this.omPmService.generateSchedules(user, user.tenantId, dto);
  }

  @Patch('maintenance/schedules/:id/complete')
  @RequirePermissions('om:update')
  @ApiOperation({ summary: 'Stage 4 — Mark PM task completed' })
  completePmSchedule(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CompleteOmPmDto,
  ) {
    return this.omPmService.completeSchedule(user, user.tenantId, user.sub, id, dto);
  }

  @Get('breakdown/catalog')
  @RequirePermissions('om:read')
  @ApiOperation({ summary: 'Stage 5 — Breakdown complaint catalogue & workflow' })
  getBreakdownCatalog() {
    return this.omBreakdownService.getCatalog();
  }

  @Get('breakdown/summary')
  @RequirePermissions('om:read')
  getBreakdownSummary(
    @CurrentUser() user: JwtPayload,
    @Query('projectId') projectId?: string,
  ) {
    return this.omBreakdownService.getSummary(user, user.tenantId, projectId);
  }

  @Get('breakdown-tickets')
  @RequirePermissions('om:read')
  @ApiOperation({ summary: 'Stage 5 — List breakdown tickets' })
  listBreakdowns(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: string,
    @Query('projectId') projectId?: string,
    @Query('projectCode') projectCode?: string,
    @Query('categoryGroup') categoryGroup?: string,
  ) {
    return this.omBreakdownService.listTickets(user, user.tenantId, {
      status, projectId, projectCode, categoryGroup,
    });
  }

  @Get('breakdown-tickets/:id')
  @RequirePermissions('om:read')
  getBreakdown(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.omBreakdownService.getTicket(user, user.tenantId, id);
  }

  @Post('breakdown-tickets')
  @RequirePermissions('om:create')
  @ApiOperation({ summary: 'Stage 5 — Raise breakdown complaint / generate ticket' })
  createBreakdown(@CurrentUser() user: JwtPayload, @Body() dto: CreateBreakdownTicketDto) {
    return this.omBreakdownService.createTicket(user, user.tenantId, user.sub, dto);
  }

  @Patch('breakdown-tickets/:id/advance')
  @RequirePermissions('om:update')
  @ApiOperation({ summary: 'Stage 5 — Advance breakdown workflow step' })
  advanceBreakdown(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AdvanceBreakdownTicketDto,
  ) {
    return this.omBreakdownService.advanceTicket(user, user.tenantId, user.sub, id, dto);
  }

  @Get('water-quality/catalog')
  @RequirePermissions('om:read')
  @ApiOperation({ summary: 'Stage 6 — Water quality sample points, parameters & workflow' })
  getWqCatalog() {
    return this.omWqService.getCatalog();
  }

  @Get('water-quality/summary')
  @RequirePermissions('om:read')
  getWqSummary(
    @CurrentUser() user: JwtPayload,
    @Query('projectId') projectId?: string,
  ) {
    return this.omWqService.getSummary(user, user.tenantId, projectId);
  }

  @Get('water-quality/tests')
  @RequirePermissions('om:read')
  @ApiOperation({ summary: 'Stage 6 — List water quality tests' })
  listWqTests(
    @CurrentUser() user: JwtPayload,
    @Query('projectId') projectId?: string,
    @Query('projectCode') projectCode?: string,
    @Query('samplePoint') samplePoint?: string,
    @Query('status') status?: string,
    @Query('compliantOnly') compliantOnly?: string,
    @Query('alertsOnly') alertsOnly?: string,
  ) {
    return this.omWqService.listTests(user, user.tenantId, {
      projectId, projectCode, samplePoint, status, compliantOnly, alertsOnly,
    });
  }

  @Get('water-quality/tests/:id')
  @RequirePermissions('om:read')
  getWqTest(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.omWqService.getTest(user, user.tenantId, id);
  }

  @Post('water-quality/tests')
  @RequirePermissions('om:create')
  @ApiOperation({ summary: 'Stage 6 — Register sample collection' })
  createWqTest(@CurrentUser() user: JwtPayload, @Body() dto: CreateOmWqTestDto) {
    return this.omWqService.createTest(user, user.tenantId, user.sub, dto);
  }

  @Patch('water-quality/tests/:id/advance')
  @RequirePermissions('om:update')
  @ApiOperation({ summary: 'Stage 6 — Advance water quality workflow' })
  advanceWqTest(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AdvanceOmWqTestDto,
  ) {
    return this.omWqService.advanceTest(user, user.tenantId, id, dto);
  }

  @Get('energy/catalog')
  @RequirePermissions('om:read')
  @ApiOperation({ summary: 'Stage 7 — Energy metrics & report types' })
  getEnergyCatalog() {
    return this.omEnergyService.getCatalog();
  }

  @Get('energy/summary')
  @RequirePermissions('om:read')
  getEnergySummary(
    @CurrentUser() user: JwtPayload,
    @Query('projectId') projectId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.omEnergyService.getSummary(user, user.tenantId, projectId, from, to);
  }

  @Get('energy/readings')
  @RequirePermissions('om:read')
  @ApiOperation({ summary: 'Stage 7 — List energy readings' })
  listEnergyReadings(
    @CurrentUser() user: JwtPayload,
    @Query('projectId') projectId?: string,
    @Query('projectCode') projectCode?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.omEnergyService.listReadings(user, user.tenantId, { projectId, projectCode, from, to });
  }

  @Post('energy/readings')
  @RequirePermissions('om:create')
  @ApiOperation({ summary: 'Stage 7 — Log daily energy reading' })
  createEnergyReading(@CurrentUser() user: JwtPayload, @Body() dto: CreateOmEnergyReadingDto) {
    return this.omEnergyService.createReading(user, user.tenantId, user.sub, dto);
  }

  @Get('energy/reports/:type')
  @RequirePermissions('om:read')
  @ApiOperation({ summary: 'Stage 7 — Generate energy report' })
  generateEnergyReport(
    @CurrentUser() user: JwtPayload,
    @Param('type') type: string,
    @Query('projectId') projectId?: string,
    @Query('projectCode') projectCode?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.omEnergyService.generateReport(user, user.tenantId, type as import('./constants/om-energy-catalog').OmEnergyReportType, {
      projectId, projectCode, from, to,
    });
  }

  @Get('scada/catalog')
  @RequirePermissions('om:read')
  @ApiOperation({ summary: 'Stage 8 — SCADA/IoT monitoring catalogue' })
  getScadaCatalog() {
    return this.omScadaService.getCatalog();
  }

  @Get('scada/dashboard')
  @RequirePermissions('om:read')
  @ApiOperation({ summary: 'Stage 8 — Live SCADA monitoring dashboard' })
  getScadaDashboard(
    @CurrentUser() user: JwtPayload,
    @Query('projectId') projectId?: string,
    @Query('projectCode') projectCode?: string,
  ) {
    return this.omScadaService.getLiveDashboard(user, user.tenantId, projectId, projectCode);
  }

  @Get('scada/summary')
  @RequirePermissions('om:read')
  getScadaSummary(
    @CurrentUser() user: JwtPayload,
    @Query('projectId') projectId?: string,
  ) {
    return this.omScadaService.getSummary(user, user.tenantId, projectId);
  }

  @Get('scada/readings')
  @RequirePermissions('om:read')
  listScadaReadings(
    @CurrentUser() user: JwtPayload,
    @Query('projectId') projectId?: string,
    @Query('projectCode') projectCode?: string,
    @Query('siteCategory') siteCategory?: string,
    @Query('metricKey') metricKey?: string,
  ) {
    return this.omScadaService.listReadings(user, user.tenantId, { projectId, projectCode, siteCategory, metricKey });
  }

  @Post('scada/readings')
  @RequirePermissions('om:create')
  @ApiOperation({ summary: 'Stage 8 — Ingest SCADA/IoT telemetry reading' })
  ingestScadaReading(@CurrentUser() user: JwtPayload, @Body() dto: IngestScadaReadingDto) {
    return this.omScadaService.ingestReading(user, user.tenantId, dto);
  }

  @Post('scada/simulate')
  @RequirePermissions('om:create')
  @ApiOperation({ summary: 'Stage 8 — Simulate SCADA snapshot (demo)' })
  simulateScada(
    @CurrentUser() user: JwtPayload,
    @Query('projectId') projectId?: string,
    @Query('projectCode') projectCode?: string,
  ) {
    return this.omScadaService.simulateSnapshot(user, user.tenantId, projectId, projectCode);
  }

  @Get('scada/alerts')
  @RequirePermissions('om:read')
  listScadaAlerts(
    @CurrentUser() user: JwtPayload,
    @Query('projectId') projectId?: string,
    @Query('projectCode') projectCode?: string,
    @Query('status') status?: string,
    @Query('alertType') alertType?: string,
  ) {
    return this.omScadaService.listAlerts(user, user.tenantId, { projectId, projectCode, status, alertType });
  }

  @Patch('scada/alerts/:id/acknowledge')
  @RequirePermissions('om:update')
  acknowledgeScadaAlert(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.omScadaService.acknowledgeAlert(user, user.tenantId, id);
  }

  @Patch('scada/alerts/:id/resolve')
  @RequirePermissions('om:update')
  resolveScadaAlert(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.omScadaService.resolveAlert(user, user.tenantId, id);
  }

  @Get('consumers/catalog')
  @RequirePermissions('om:read')
  @ApiOperation({ summary: 'Stage 9 — Consumer service types' })
  getConsumerCatalog() {
    return this.omConsumerService.getCatalog();
  }

  @Get('consumers/summary')
  @RequirePermissions('om:read')
  getConsumerSummary(
    @CurrentUser() user: JwtPayload,
    @Query('projectId') projectId?: string,
  ) {
    return this.omConsumerService.getSummary(user, user.tenantId, projectId);
  }

  @Get('consumers')
  @RequirePermissions('om:read')
  @ApiOperation({ summary: 'Stage 9 — List consumers' })
  listConsumers(
    @CurrentUser() user: JwtPayload,
    @Query('projectId') projectId?: string,
    @Query('projectCode') projectCode?: string,
    @Query('village') village?: string,
    @Query('status') status?: string,
  ) {
    return this.omConsumerService.listConsumers(user, user.tenantId, {
      projectId, projectCode, village, status,
    });
  }

  @Get('consumers/service-requests')
  @RequirePermissions('om:read')
  @ApiOperation({ summary: 'Stage 9 — List service requests (inbox)' })
  listServiceRequests(
    @CurrentUser() user: JwtPayload,
    @Query('projectId') projectId?: string,
    @Query('projectCode') projectCode?: string,
    @Query('status') status?: string,
    @Query('requestType') requestType?: string,
  ) {
    return this.omConsumerService.listServiceRequests(user, user.tenantId, {
      projectId,
      projectCode,
      status: status ?? 'requested',
      requestType,
    });
  }

  @Get('consumers/:id')
  @RequirePermissions('om:read')
  getConsumer(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.omConsumerService.getConsumer(user, user.tenantId, id);
  }

  @Post('consumers')
  @RequirePermissions('om:create')
  @ApiOperation({ summary: 'Stage 9 — Register consumer / FHTC' })
  registerConsumer(@CurrentUser() user: JwtPayload, @Body() dto: CreateOmConsumerDto) {
    return this.omConsumerService.registerConsumer(user, user.tenantId, user.sub, dto);
  }

  @Get('consumers/:id/service-requests')
  @RequirePermissions('om:read')
  listConsumerServiceRequests(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('status') status?: string,
  ) {
    return this.omConsumerService.listServiceRequests(user, user.tenantId, { consumerId: id, status });
  }

  @Post('consumers/:id/service-requests')
  @RequirePermissions('om:create')
  @ApiOperation({ summary: 'Stage 9 — Raise service request' })
  createConsumerServiceRequest(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreateConsumerServiceRequestDto,
  ) {
    return this.omConsumerService.createServiceRequest(user, user.tenantId, user.sub, id, dto);
  }

  @Patch('consumers/:id/service-requests/:requestId/complete')
  @RequirePermissions('om:update')
  @ApiOperation({ summary: 'Stage 9 — Complete service request' })
  completeConsumerServiceRequest(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('requestId') requestId: string,
  ) {
    return this.omConsumerService.completeServiceRequest(user, user.tenantId, id, requestId);
  }

  @Get('complaints/catalog')
  @RequirePermissions('om:read')
  @ApiOperation({ summary: 'Stage 10 — Complaint channels, types & workflow' })
  getComplaintCatalog() {
    return this.omComplaintService.getCatalog();
  }

  @Get('complaints/summary')
  @RequirePermissions('om:read')
  getComplaintSummary(
    @CurrentUser() user: JwtPayload,
    @Query('projectId') projectId?: string,
  ) {
    return this.omComplaintService.getSummary(user, user.tenantId, projectId);
  }

  @Get('complaints')
  @RequirePermissions('om:read')
  @ApiOperation({ summary: 'Stage 10 — List consumer complaints' })
  listComplaints(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: string,
    @Query('projectId') projectId?: string,
    @Query('projectCode') projectCode?: string,
    @Query('channel') channel?: string,
    @Query('complaintType') complaintType?: string,
  ) {
    return this.omComplaintService.listComplaints(user, user.tenantId, {
      status, projectId, projectCode, channel, complaintType,
    });
  }

  @Get('complaints/assignees')
  @RequirePermissions('om:read')
  @ApiOperation({ summary: 'Stage 10 — List staff assignees for complaint workflow' })
  listComplaintAssignees(
    @CurrentUser() user: JwtPayload,
    @Query('projectCode') projectCode?: string,
  ) {
    return this.omComplaintService.listAssignees(user, user.tenantId, projectCode);
  }

  @Get('complaints/:id')
  @RequirePermissions('om:read')
  getComplaint(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.omComplaintService.getComplaint(user, user.tenantId, id);
  }

  @Post('complaints')
  @RequirePermissions('om:create')
  @ApiOperation({ summary: 'Stage 10 — Register complaint & generate ticket' })
  registerComplaint(@CurrentUser() user: JwtPayload, @Body() dto: CreateOmComplaintDto) {
    return this.omComplaintService.registerComplaint(user, user.tenantId, user.sub, dto);
  }

  @Patch('complaints/:id/advance')
  @RequirePermissions('om:update')
  @ApiOperation({ summary: 'Stage 10 — Advance complaint workflow step' })
  advanceComplaint(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AdvanceOmComplaintDto,
  ) {
    return this.omComplaintService.advanceComplaint(user, user.tenantId, user.sub, id, dto);
  }

  @Get('contracts/catalog')
  @RequirePermissions('om:read')
  @ApiOperation({ summary: 'Stage 11 — Contract SLA targets, monitoring areas & KPIs' })
  getContractCatalog() {
    return this.omContractService.getCatalog();
  }

  @Get('contracts/summary')
  @RequirePermissions('om:read')
  getContractSummary(
    @CurrentUser() user: JwtPayload,
    @Query('projectId') projectId?: string,
  ) {
    return this.omContractService.getSummary(user, user.tenantId, projectId);
  }

  @Get('contracts')
  @RequirePermissions('om:read')
  @ApiOperation({ summary: 'Stage 11 — List O&M contracts' })
  listContracts(
    @CurrentUser() user: JwtPayload,
    @Query('projectId') projectId?: string,
    @Query('projectCode') projectCode?: string,
    @Query('status') status?: string,
  ) {
    return this.omContractService.listContracts(user, user.tenantId, { projectId, projectCode, status });
  }

  @Get('contracts/:id')
  @RequirePermissions('om:read')
  getContract(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.omContractService.getContract(user, user.tenantId, id);
  }

  @Post('contracts')
  @RequirePermissions('om:create')
  @ApiOperation({ summary: 'Stage 11 — Register O&M contract' })
  createContract(@CurrentUser() user: JwtPayload, @Body() dto: CreateOmContractDto) {
    return this.omContractService.createContract(user, user.tenantId, user.sub, dto);
  }

  @Get('contracts/:id/performance')
  @RequirePermissions('om:read')
  @ApiOperation({ summary: 'Stage 11 — Contractor performance dashboard' })
  getContractPerformance(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.omContractService.getPerformance(user, user.tenantId, id);
  }

  @Get('contracts/:id/attendance')
  @RequirePermissions('om:read')
  listContractAttendance(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.omContractService.listAttendance(user, user.tenantId, id);
  }

  @Post('contracts/:id/attendance')
  @RequirePermissions('om:create')
  recordContractAttendance(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: RecordContractAttendanceDto,
  ) {
    return this.omContractService.recordAttendance(user, user.tenantId, user.sub, id, dto);
  }

  @Get('contracts/:id/kpi-entries')
  @RequirePermissions('om:read')
  listContractKpiEntries(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.omContractService.listKpiEntries(user, user.tenantId, id);
  }

  @Post('contracts/:id/kpi-entries')
  @RequirePermissions('om:create')
  recordContractKpi(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: RecordContractKpiDto,
  ) {
    return this.omContractService.recordKpiEntry(user, user.tenantId, user.sub, id, dto);
  }

  @Get('contracts/:id/reviews')
  @RequirePermissions('om:read')
  listContractReviews(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.omContractService.listReviews(user, user.tenantId, id);
  }

  @Post('contracts/:id/reviews')
  @RequirePermissions('om:update')
  createContractReview(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreateContractReviewDto,
  ) {
    return this.omContractService.createReview(user, user.tenantId, user.sub, id, dto);
  }

  @Get('lifecycle/catalog')
  @RequirePermissions('om:read')
  @ApiOperation({ summary: 'Stage 12 — Lifecycle categories, condition grades & plan types' })
  getLifecycleCatalog() {
    return this.omLifecycleService.getCatalog();
  }

  @Get('lifecycle/summary')
  @RequirePermissions('om:read')
  getLifecycleSummary(
    @CurrentUser() user: JwtPayload,
    @Query('projectId') projectId?: string,
  ) {
    return this.omLifecycleService.getSummary(user, user.tenantId, projectId);
  }

  @Get('lifecycle/assets')
  @RequirePermissions('om:read')
  @ApiOperation({ summary: 'Stage 12 — Assets with health index & remaining useful life' })
  listLifecycleAssets(
    @CurrentUser() user: JwtPayload,
    @Query('projectId') projectId?: string,
    @Query('projectCode') projectCode?: string,
    @Query('lifecycleCategory') lifecycleCategory?: string,
  ) {
    return this.omLifecycleService.listLifecycleAssets(user, user.tenantId, {
      projectId, projectCode, lifecycleCategory,
    });
  }

  @Get('lifecycle/assets/:id')
  @RequirePermissions('om:read')
  getLifecycleAsset(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.omLifecycleService.getLifecycleAsset(user, user.tenantId, id);
  }

  @Post('lifecycle/assets/:id/assess')
  @RequirePermissions('om:update')
  @ApiOperation({ summary: 'Stage 12 — Record asset condition assessment' })
  assessLifecycleAsset(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AssessAssetLifecycleDto,
  ) {
    return this.omLifecycleService.assessAsset(user, user.tenantId, user.sub, id, dto);
  }

  @Get('lifecycle/assets/:id/assessments')
  @RequirePermissions('om:read')
  listAssetAssessments(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.omLifecycleService.listAssessments(user, user.tenantId, id);
  }

  @Get('lifecycle/plans')
  @RequirePermissions('om:read')
  @ApiOperation({ summary: 'Stage 12 — List renewal plans' })
  listRenewalPlans(
    @CurrentUser() user: JwtPayload,
    @Query('projectId') projectId?: string,
    @Query('projectCode') projectCode?: string,
    @Query('planType') planType?: string,
    @Query('planYear') planYear?: string,
    @Query('status') status?: string,
  ) {
    return this.omLifecycleService.listPlans(user, user.tenantId, {
      projectId,
      projectCode,
      planType,
      planYear: planYear ? Number(planYear) : undefined,
      status,
    });
  }

  @Post('lifecycle/plans')
  @RequirePermissions('om:create')
  @ApiOperation({ summary: 'Stage 12 — Create rehabilitation or replacement plan' })
  createRenewalPlan(@CurrentUser() user: JwtPayload, @Body() dto: CreateRenewalPlanDto) {
    return this.omLifecycleService.createPlan(user, user.tenantId, user.sub, dto);
  }

  @Post('lifecycle/plans/generate')
  @RequirePermissions('om:create')
  @ApiOperation({ summary: 'Stage 12 — Auto-generate rehab/replacement plans from asset health' })
  generateRenewalPlans(@CurrentUser() user: JwtPayload, @Body() dto: GenerateRenewalPlansDto) {
    return this.omLifecycleService.generatePlans(user, user.tenantId, user.sub, dto);
  }

  @Post('lifecycle/plans/generate-annual')
  @RequirePermissions('om:create')
  @ApiOperation({ summary: 'Stage 12 — Generate annual capital renewal plan' })
  generateAnnualRenewalPlan(@CurrentUser() user: JwtPayload, @Body() dto: GenerateAnnualRenewalPlanDto) {
    return this.omLifecycleService.generateAnnualPlan(user, user.tenantId, user.sub, dto);
  }

  @Patch('lifecycle/plans/:id')
  @RequirePermissions('om:update')
  updateRenewalPlan(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateRenewalPlanDto,
  ) {
    return this.omLifecycleService.updatePlan(user, user.tenantId, id, dto);
  }

  @Get('gis-dashboard/catalog')
  @RequirePermissions('om:read')
  @ApiOperation({ summary: 'Stage 13 — GIS dashboard panel definitions' })
  getGisDashboardCatalog() {
    return this.omDashboardService.getCatalog();
  }

  @Get('gis-dashboard')
  @RequirePermissions('om:read')
  @ApiOperation({ summary: 'Stage 13 — Real-time GIS O&M operations dashboard' })
  getGisDashboard(
    @CurrentUser() user: JwtPayload,
    @Query('projectId') projectId?: string,
    @Query('projectCode') projectCode?: string,
  ) {
    return this.omDashboardService.getGisDashboard(user, user.tenantId, { projectId, projectCode });
  }

  @Get('reports/catalog')
  @RequirePermissions('om:read')
  @ApiOperation({ summary: 'Stage 14 — Available O&M report types' })
  getReportsCatalog() {
    return this.omReportsService.getCatalog();
  }

  @Get('reports/:type')
  @RequirePermissions('om:read')
  @ApiOperation({ summary: 'Stage 14 — Generate O&M report' })
  generateReport(
    @CurrentUser() user: JwtPayload,
    @Param('type') type: string,
    @Query() query: GenerateOmReportQueryDto,
  ) {
    return this.omReportsService.generateReport(user, user.tenantId, type, query);
  }

  @Get('billing/catalog')
  @RequirePermissions('om:read')
  @ApiOperation({ summary: 'Billing catalog (tariffs, payment modes, workflows)' })
  getBillingCatalog() {
    return this.omBillingService.getCatalog();
  }

  @Get('billing/summary')
  @RequirePermissions('om:read')
  @ApiOperation({ summary: 'Billing & revenue KPI summary' })
  getBillingSummary(
    @CurrentUser() user: JwtPayload,
    @Query('projectId') projectId?: string,
  ) {
    return this.omBillingService.getSummary(user.tenantId, projectId, user);
  }

  @Get('billing/accounts')
  @RequirePermissions('om:read')
  listBillingAccounts(
    @CurrentUser() user: JwtPayload,
    @Query('projectId') projectId?: string,
    @Query('projectCode') projectCode?: string,
  ) {
    return this.omBillingService.listConsumerAccounts(user.tenantId, { projectId, projectCode }, user);
  }

  @Post('billing/accounts')
  @RequirePermissions('om:create')
  @ApiOperation({ summary: 'Create unique consumer billing account' })
  createBillingAccount(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateConsumerAccountDto,
  ) {
    return this.omBillingService.createConsumerAccount(user.tenantId, user.sub, dto, user);
  }

  @Patch('billing/accounts/:consumerId')
  @RequirePermissions('om:update')
  linkBillingAccount(
    @CurrentUser() user: JwtPayload,
    @Param('consumerId') consumerId: string,
    @Body() dto: LinkConsumerAccountDto,
  ) {
    return this.omBillingService.linkConsumerAccount(user.tenantId, consumerId, dto, user);
  }

  @Get('billing/tariffs')
  @RequirePermissions('om:read')
  listBillingTariffs(
    @CurrentUser() user: JwtPayload,
    @Query('projectId') projectId?: string,
    @Query('projectCode') projectCode?: string,
    @Query('status') status?: string,
  ) {
    return this.omBillingService.listTariffs(user.tenantId, { projectId, projectCode, status }, user);
  }

  @Post('billing/tariffs')
  @RequirePermissions('om:create')
  createBillingTariff(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateBillingTariffDto,
  ) {
    return this.omBillingService.createTariff(user.tenantId, user.sub, dto, user);
  }

  @Get('billing/meter-readings')
  @RequirePermissions('om:read')
  listMeterReadings(
    @CurrentUser() user: JwtPayload,
    @Query('projectId') projectId?: string,
    @Query('projectCode') projectCode?: string,
    @Query('consumerId') consumerId?: string,
  ) {
    return this.omBillingService.listMeterReadings(user.tenantId, { projectId, projectCode, consumerId }, user);
  }

  @Post('billing/consumers/:consumerId/meter-readings')
  @RequirePermissions('om:create')
  recordMeterReading(
    @CurrentUser() user: JwtPayload,
    @Param('consumerId') consumerId: string,
    @Body() dto: RecordMeterReadingDto,
  ) {
    return this.omBillingService.recordMeterReading(user.tenantId, user.sub, consumerId, dto, user);
  }

  @Get('billing/bills')
  @RequirePermissions('om:read')
  listBills(
    @CurrentUser() user: JwtPayload,
    @Query('projectId') projectId?: string,
    @Query('projectCode') projectCode?: string,
    @Query('consumerId') consumerId?: string,
    @Query('status') status?: string,
  ) {
    return this.omBillingService.listBills(user.tenantId, { projectId, projectCode, consumerId, status }, user);
  }

  @Get('billing/bills/:id')
  @RequirePermissions('om:read')
  getBill(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.omBillingService.getBill(user.tenantId, id, user);
  }

  @Post('billing/bills/generate')
  @RequirePermissions('om:create')
  generateBills(@CurrentUser() user: JwtPayload, @Body() dto: GenerateBillsDto) {
    return this.omBillingService.generateBills(user.tenantId, user.sub, dto, user);
  }

  @Patch('billing/bills/:id/status')
  @RequirePermissions('om:update')
  updateBillStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateBillStatusDto,
  ) {
    return this.omBillingService.updateBillStatus(user.tenantId, id, dto.status, user);
  }

  @Post('billing/bills/:id/deliver')
  @RequirePermissions('om:update')
  deliverBill(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: DeliverBillDto,
  ) {
    return this.omBillingService.deliverBill(user.tenantId, id, dto, user);
  }

  @Post('billing/payments')
  @RequirePermissions('om:create')
  recordPayment(@CurrentUser() user: JwtPayload, @Body() dto: RecordPaymentDto) {
    return this.omBillingService.recordPayment(user.tenantId, user.sub, dto, user);
  }

  @Get('billing/payments')
  @RequirePermissions('om:read')
  listPayments(
    @CurrentUser() user: JwtPayload,
    @Query('projectId') projectId?: string,
    @Query('projectCode') projectCode?: string,
    @Query('consumerId') consumerId?: string,
  ) {
    return this.omBillingService.listPayments(user.tenantId, { projectId, projectCode, consumerId }, user);
  }

  @Get('billing/payments/:id')
  @RequirePermissions('om:read')
  getPayment(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.omBillingService.getPayment(user.tenantId, id, user);
  }

  @Get('billing/revenue-register')
  @RequirePermissions('om:read')
  getRevenueRegister(
    @CurrentUser() user: JwtPayload,
    @Query('projectId') projectId?: string,
    @Query('projectCode') projectCode?: string,
    @Query('periodFrom') periodFrom?: string,
    @Query('periodTo') periodTo?: string,
  ) {
    return this.omBillingService.generateRevenueRegister(user.tenantId, {
      projectId, projectCode, periodFrom, periodTo,
    }, user);
  }

  @Get('billing/demand-register')
  @RequirePermissions('om:read')
  getDemandRegister(
    @CurrentUser() user: JwtPayload,
    @Query('projectId') projectId?: string,
    @Query('projectCode') projectCode?: string,
    @Query('village') village?: string,
    @Query('groupBy') groupBy?: string,
    @Query('periodFrom') periodFrom?: string,
    @Query('periodTo') periodTo?: string,
  ) {
    return this.omBillingService.generateDemandRegister(user.tenantId, {
      projectId,
      projectCode,
      village,
      groupBy: groupBy as 'village' | 'scheme' | 'consumer' | 'month' | undefined,
      periodFrom,
      periodTo,
    }, user);
  }

  @Post('billing/demand-register/generate')
  @RequirePermissions('om:read')
  generateDemandRegister(
    @CurrentUser() user: JwtPayload,
    @Body() body: {
      projectId?: string;
      projectCode?: string;
      village?: string;
      groupBy?: string;
      periodFrom?: string;
      periodTo?: string;
    },
  ) {
    return this.omBillingService.generateDemandRegister(user.tenantId, {
      ...body,
      groupBy: body.groupBy as 'village' | 'scheme' | 'consumer' | 'month' | undefined,
    }, user);
  }

  @Get('billing/arrears')
  @RequirePermissions('om:read')
  getArrears(
    @CurrentUser() user: JwtPayload,
    @Query('projectId') projectId?: string,
    @Query('projectCode') projectCode?: string,
    @Query('bucket') bucket?: string,
  ) {
    return this.omBillingService.getArrears(user.tenantId, { projectId, projectCode, bucket }, user);
  }

  @Post('billing/arrears/:billId/action')
  @RequirePermissions('om:create')
  sendArrearAction(
    @CurrentUser() user: JwtPayload,
    @Param('billId') billId: string,
    @Body() dto: ArrearActionDto,
  ) {
    return this.omBillingService.sendArrearAction(user.tenantId, user.sub, billId, dto, user);
  }

  @Post('notifications/scan-due-bills')
  @RequirePermissions('om:update')
  @ApiOperation({ summary: 'Send proactive bill due reminders (deduped per bill per 7 days)' })
  scanDueBillReminders(@CurrentUser() user: JwtPayload) {
    return this.consumerNotificationService.scanDueBillReminders(user.tenantId);
  }

  @Get('notifications/config')
  @RequirePermissions('om:read')
  @ApiOperation({ summary: 'Notification channel configuration status (read-only)' })
  getNotificationConfig() {
    return this.alertNotificationService.getConfigStatus();
  }

  @Get('notifications/alert-log')
  @RequirePermissions('om:read')
  @ApiOperation({ summary: 'Recent staff/system alert notifications sent' })
  getAlertLog(@CurrentUser() user: JwtPayload, @Query('limit') limit?: string) {
    const parsed = limit ? Number(limit) : 50;
    return this.alertNotificationService.listRecent(user.tenantId, Number.isFinite(parsed) ? parsed : 50);
  }

  @Get('billing/gis-revenue')
  @RequirePermissions('om:read')
  getGisRevenue(
    @CurrentUser() user: JwtPayload,
    @Query('projectId') projectId?: string,
    @Query('projectCode') projectCode?: string,
  ) {
    return this.omBillingService.getGisRevenueAnalytics(user.tenantId, { projectId, projectCode }, user);
  }

  @Get('billing/reports/:type')
  @RequirePermissions('om:read')
  generateBillingReport(
    @CurrentUser() user: JwtPayload,
    @Param('type') type: string,
    @Query('projectId') projectId?: string,
    @Query('projectCode') projectCode?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.omBillingService.generateReport(user.tenantId, type, { projectId, projectCode, from, to }, user);
  }

  @Get('billing/accounting/catalog')
  @RequirePermissions('om:read')
  @ApiOperation({ summary: 'Financial accounting catalog and ERP integration settings' })
  getAccountingCatalog() {
    return this.omAccountingService.getCatalog();
  }

  @Get('billing/accounting/summary')
  @RequirePermissions('om:read')
  @ApiOperation({ summary: 'Financial accounting summary KPIs' })
  getAccountingSummary(@CurrentUser() user: JwtPayload) {
    return this.omAccountingService.getSummary(user, user.tenantId);
  }

  @Get('billing/accounting/chart-of-accounts')
  @RequirePermissions('om:read')
  @ApiOperation({ summary: 'Chart of accounts for ERP GL integration' })
  listChartOfAccounts(@CurrentUser() user: JwtPayload) {
    return this.omAccountingService.listChartOfAccounts(user.tenantId);
  }

  @Get('billing/accounting/postings')
  @RequirePermissions('om:read')
  @ApiOperation({ summary: 'Auto-posting ledger entries from billing, collection, and adjustments' })
  listAccountingPostings(
    @CurrentUser() user: JwtPayload,
    @Query('sourceType') sourceType?: string,
    @Query('limit') limit?: string,
  ) {
    return this.omAccountingService.listPostings(user, user.tenantId, {
      sourceType,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('billing/accounting/journal-entries')
  @RequirePermissions('om:read')
  @ApiOperation({ summary: 'Journal entries posted to general ledger' })
  listJournalEntries(
    @CurrentUser() user: JwtPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    return this.omAccountingService.listJournalEntries(user, user.tenantId, {
      from,
      to,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('billing/accounting/adjustments')
  @RequirePermissions('om:write')
  @ApiOperation({ summary: 'Post manual billing adjustment to journal entries' })
  createAccountingAdjustment(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateAccountingAdjustmentDto,
  ) {
    return this.omAccountingService.createManualAdjustment(user, user.tenantId, user.sub, dto);
  }

  @Get('billing/accounting/reports/:type')
  @RequirePermissions('om:read')
  @ApiOperation({ summary: 'Accounting reports — cash book, bank book, GL, trial balance, income statement, revenue summary' })
  generateAccountingReport(
    @CurrentUser() user: JwtPayload,
    @Param('type') type: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.omAccountingService.generateReport(user, user.tenantId, type, { from, to, projectId });
  }

  @Get('billing/mobile/catalog')
  @RequirePermissions('om:read')
  @ApiOperation({ summary: 'Mobile billing app catalog for field staff' })
  getMobileBillingCatalog() {
    return this.omMobileBillingService.getCatalog();
  }

  @Get('billing/mobile/summary')
  @RequirePermissions('om:read')
  @ApiOperation({ summary: 'Mobile billing field summary' })
  getMobileBillingSummary(
    @CurrentUser() user: JwtPayload,
    @Query('projectId') projectId?: string,
    @Query('projectCode') projectCode?: string,
  ) {
    return this.omMobileBillingService.getFieldSummary(user.tenantId, { projectId, projectCode }, user);
  }

  @Post('billing/mobile/upload-photo')
  @RequirePermissions('om:create')
  @UseInterceptors(FileInterceptor('photo', { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Upload meter photo from mobile billing app' })
  uploadMobileMeterPhoto(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: { buffer: Buffer; originalname?: string; mimetype?: string },
  ) {
    return this.omMobileBillingService.uploadMeterPhoto(user.tenantId, file);
  }

  @Post('billing/mobile/consumers/:consumerId/meter-readings')
  @RequirePermissions('om:create')
  @ApiOperation({ summary: 'Record meter reading from mobile billing app' })
  recordMobileMeterReading(
    @CurrentUser() user: JwtPayload,
    @Param('consumerId') consumerId: string,
    @Body() dto: MobileMeterReadingDto,
  ) {
    return this.omMobileBillingService.recordMobileReading(user.tenantId, user.sub, consumerId, dto, user);
  }

  @Post('billing/mobile/payments')
  @RequirePermissions('om:create')
  @ApiOperation({ summary: 'Collect payment from mobile billing app' })
  recordMobilePayment(
    @CurrentUser() user: JwtPayload,
    @Body() dto: MobilePaymentDto,
  ) {
    return this.omMobileBillingService.recordMobilePayment(user.tenantId, user.sub, dto, user);
  }

  @Get('billing/mobile/payment-gateway/config')
  @RequirePermissions('om:read')
  @ApiOperation({ summary: 'Payment gateway configuration for mobile billing' })
  getMobilePaymentGatewayConfig() {
    return this.omMobileBillingService.getPaymentGatewayConfig();
  }

  @Post('billing/mobile/payment-gateway/orders')
  @RequirePermissions('om:create')
  @ApiOperation({ summary: 'Create Razorpay order for mobile field payment' })
  createMobilePaymentGatewayOrder(
    @Body() dto: CreatePaymentGatewayOrderDto,
  ) {
    return this.omMobileBillingService.createPaymentGatewayOrder(dto);
  }

  @Post('billing/mobile/payment-gateway/verify')
  @RequirePermissions('om:create')
  @ApiOperation({ summary: 'Verify gateway payment and record receipt' })
  verifyMobilePaymentGateway(
    @CurrentUser() user: JwtPayload,
    @Body() dto: VerifyPaymentGatewayDto,
  ) {
    return this.omMobileBillingService.verifyPaymentGatewayAndRecord(user.tenantId, user.sub, dto, user);
  }

  @Post('billing/mobile/sync')
  @RequirePermissions('om:create')
  @ApiOperation({ summary: 'Sync offline mobile billing captures' })
  syncMobileBillingBatch(
    @CurrentUser() user: JwtPayload,
    @Body() dto: MobileSyncBatchDto,
  ) {
    return this.omMobileBillingService.syncOfflineBatch(user.tenantId, user.sub, dto, user);
  }
}
