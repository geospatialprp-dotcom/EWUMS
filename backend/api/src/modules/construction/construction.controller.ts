import {
  Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Put, Query, Res, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Response } from 'express';
import { createReadStream } from 'fs';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { ProjectDivisionGuard } from '../../common/guards/project-division.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { assertNotSuperAdminForOperations } from '../../common/utils/operational-access.util';
import { ConstructionService } from './construction.service';
import {
  CreateConstructionAssetDto, CreateDprDto, CreateInvoiceDto, CreateMbDto,
  CreateRaBillDto, CreateWorkPackageDto, GenerateFinalBillDto, ImportBoqDto,
  UpdateCompletionVerificationDto, UpdateConstructionAssetDto, UpdateWorkPackageDto, UpdateWorkPlanningDto, UploadDocumentDto, WorkflowActionDto,
} from './dto/construction.dto';

@ApiTags('Construction')
@Controller('projects/:projectId/construction')
@UseGuards(JwtAuthGuard, PermissionsGuard, ProjectDivisionGuard)
@ApiBearerAuth()
export class ConstructionController {
  constructor(private constructionService: ConstructionService) {}

  private assertAdminPlanning(user: JwtPayload) {
    assertNotSuperAdminForOperations(user, 'work planning and BOQ uploads');
    const allowed = ['se', 'ce', 'cgm', 'md', 'ee'];
    if (!user.roles?.some((r) => allowed.includes(r))) {
      throw new ForbiddenException('Only HQ or division EE officials can update work planning and uploads');
    }
  }

  @Get('overview')
  @RequirePermissions('construction:read')
  overview(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string) {
    return this.constructionService.getOverview(user.tenantId, projectId);
  }

  @Get('dashboard')
  @RequirePermissions('construction:read')
  dashboard(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string) {
    return this.constructionService.getDashboard(user.tenantId, projectId);
  }

  @Get('boq-reconciliation')
  @RequirePermissions('construction:read')
  boqReconciliation(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string) {
    return this.constructionService.getBoqReconciliation(user.tenantId, projectId);
  }

  @Get('reports')
  @RequirePermissions('construction:read')
  reports(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string) {
    return this.constructionService.getReports(user.tenantId, projectId);
  }

  @Get('work-packages')
  @RequirePermissions('construction:read')
  listWorkPackages(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string) {
    return this.constructionService.listWorkPackages(user.tenantId, projectId);
  }

  @Post('work-packages')
  @RequirePermissions('construction:create')
  createWorkPackage(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Body() dto: CreateWorkPackageDto,
  ) {
    this.assertAdminPlanning(user);
    return this.constructionService.createWorkPackage(user.tenantId, projectId, dto);
  }

  @Put('work-packages/:id')
  @RequirePermissions('construction:update')
  updateWorkPackage(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: UpdateWorkPackageDto,
  ) {
    this.assertAdminPlanning(user);
    return this.constructionService.updateWorkPackage(user.tenantId, projectId, id, dto);
  }

  @Get('work-planning')
  @RequirePermissions('construction:read')
  getWorkPlanning(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string) {
    return this.constructionService.getWorkPlanning(user.tenantId, projectId);
  }

  @Put('work-planning')
  @RequirePermissions('construction:update')
  upsertWorkPlanning(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Body() dto: UpdateWorkPlanningDto,
  ) {
    this.assertAdminPlanning(user);
    return this.constructionService.upsertWorkPlanning(user.tenantId, projectId, user.sub, dto);
  }

  @Get('boq')
  @RequirePermissions('construction:read')
  listBoq(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Query('schemeType') schemeType?: string,
    @Query('component') component?: string,
    @Query('boqSource') boqSource?: string,
  ) {
    return this.constructionService.listBoq(user.tenantId, projectId, schemeType, component, boqSource);
  }

  @Post('boq/import')
  @RequirePermissions('construction:update')
  importBoq(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Body() dto: ImportBoqDto,
  ) {
    this.assertAdminPlanning(user);
    return this.constructionService.importBoq(user.tenantId, projectId, dto);
  }

  @Post('boq/upload-excel')
  @RequirePermissions('construction:update')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 },
  }))
  uploadBoqExcel(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @UploadedFile() file: { buffer: Buffer; originalname?: string },
    @Body('boqSource') boqSource?: 'government' | 'l1_contractor',
  ) {
    this.assertAdminPlanning(user);
    const source = boqSource === 'l1_contractor' ? 'l1_contractor' : 'government';
    return this.constructionService.importBoqExcelFile(user.tenantId, projectId, file, source);
  }

  @Get('dprs')
  @RequirePermissions('construction:read')
  listDprs(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string) {
    return this.constructionService.listDprs(user.tenantId, projectId);
  }

  @Get('dprs/:id')
  @RequirePermissions('construction:read')
  getDpr(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.constructionService.getDpr(user.tenantId, projectId, id);
  }

  @Post('dprs')
  @RequirePermissions('construction:create')
  createDpr(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Body() dto: CreateDprDto,
  ) {
    return this.constructionService.createDpr(user.tenantId, projectId, user.sub, dto);
  }

  @Put('dprs/:id')
  @RequirePermissions('construction:update', 'construction:create')
  updateDpr(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: CreateDprDto,
  ) {
    return this.constructionService.updateDpr(user.tenantId, projectId, user.sub, id, dto);
  }

  @Post('dprs/:id/submit')
  @RequirePermissions('construction:submit')
  submitDpr(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.constructionService.submitDpr(user.tenantId, projectId, user.sub, id);
  }

  @Post('dprs/:id/workflow')
  @RequirePermissions('construction:approve')
  dprWorkflow(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: WorkflowActionDto,
  ) {
    return this.constructionService.actOnResourceWorkflow(
      user.tenantId, user.sub, user.roles, 'dpr', id, dto,
    );
  }

  @Get('measurement-books')
  @RequirePermissions('construction:read')
  listMbs(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string) {
    return this.constructionService.listMbs(user.tenantId, projectId);
  }

  @Get('measurement-books/:id')
  @RequirePermissions('construction:read')
  getMb(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.constructionService.getMb(user.tenantId, projectId, id);
  }

  @Post('measurement-books')
  @RequirePermissions('construction:measure')
  createMb(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Body() dto: CreateMbDto,
  ) {
    return this.constructionService.createMb(user.tenantId, projectId, user.sub, dto);
  }

  @Put('measurement-books/:id')
  @RequirePermissions('construction:measure')
  updateMb(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: CreateMbDto,
  ) {
    return this.constructionService.updateMb(user.tenantId, projectId, user.sub, id, dto);
  }

  @Post('measurement-books/:id/submit')
  @RequirePermissions('construction:submit')
  submitMb(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.constructionService.submitMb(user.tenantId, projectId, user.sub, id, user.roles);
  }

  @Post('measurement-books/:id/workflow')
  @RequirePermissions('construction:approve')
  mbWorkflow(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: WorkflowActionDto,
  ) {
    return this.constructionService.actOnResourceWorkflow(
      user.tenantId, user.sub, user.roles, 'measurement_book', id, dto,
    );
  }

  @Get('ra-bills')
  @RequirePermissions('construction:read')
  listRaBills(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string) {
    return this.constructionService.listRaBills(user.tenantId, projectId);
  }

  @Get('ra-bills/:id')
  @RequirePermissions('construction:read')
  getRaBill(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.constructionService.getRaBill(user.tenantId, projectId, id);
  }

  @Post('ra-bills/generate')
  @RequirePermissions('construction:submit')
  generateRaBill(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Body() dto: CreateRaBillDto,
  ) {
    return this.constructionService.generateRaBill(user.tenantId, projectId, user.sub, dto);
  }

  @Post('ra-bills/:id/submit')
  @RequirePermissions('construction:submit')
  submitRaBill(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.constructionService.submitRaBill(user.tenantId, projectId, user.sub, id);
  }

  @Delete('ra-bills/:id')
  @RequirePermissions('construction:submit')
  deleteRaBill(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.constructionService.deleteRaBill(user.tenantId, projectId, id);
  }

  @Post('ra-bills/:id/workflow')
  @RequirePermissions('construction:approve')
  raBillWorkflow(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: WorkflowActionDto,
  ) {
    return this.constructionService.actOnResourceWorkflow(
      user.tenantId, user.sub, user.roles, 'ra_bill', id, dto,
    );
  }

  @Get('invoices')
  @RequirePermissions('construction:read')
  listInvoices(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string) {
    return this.constructionService.listInvoices(user.tenantId, projectId);
  }

  @Get('invoices/:id')
  @RequirePermissions('construction:read')
  getInvoice(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.constructionService.getInvoice(user.tenantId, projectId, id);
  }

  @Post('invoices')
  @RequirePermissions('construction:create')
  createInvoice(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Body() dto: CreateInvoiceDto,
  ) {
    return this.constructionService.createInvoice(user.tenantId, projectId, user.sub, dto);
  }

  @Post('invoices/from-mb/:mbId')
  @RequirePermissions('construction:create')
  invoiceFromMb(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('mbId') mbId: string,
    @Body('invoiceNumber') invoiceNumber: string,
  ) {
    return this.constructionService.buildInvoiceFromMb(
      user.tenantId, projectId, user.sub, mbId, invoiceNumber,
    );
  }

  @Post('invoices/:id/submit')
  @RequirePermissions('construction:submit')
  submitInvoice(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.constructionService.submitInvoice(user.tenantId, projectId, user.sub, id);
  }

  @Post('invoices/:id/workflow')
  @RequirePermissions('construction:approve')
  invoiceWorkflow(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: WorkflowActionDto,
  ) {
    return this.constructionService.actOnResourceWorkflow(
      user.tenantId, user.sub, user.roles, 'invoice', id, dto,
    );
  }

  @Get('assets')
  @RequirePermissions('construction:read')
  listAssets(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Query('assetType') assetType?: string,
  ) {
    return this.constructionService.listConstructionAssets(user.tenantId, projectId, assetType);
  }

  @Post('assets')
  @RequirePermissions('construction:create')
  createAsset(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Body() dto: CreateConstructionAssetDto,
  ) {
    return this.constructionService.createConstructionAsset(user.tenantId, projectId, dto);
  }

  @Put('assets/:assetId')
  @RequirePermissions('construction:update')
  @ApiOperation({ summary: 'Update a GIS construction asset' })
  updateAsset(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('assetId') assetId: string,
    @Body() dto: UpdateConstructionAssetDto,
  ) {
    return this.constructionService.updateConstructionAsset(user.tenantId, projectId, assetId, dto);
  }

  @Delete('assets/:assetId')
  @RequirePermissions('construction:update')
  @ApiOperation({ summary: 'Delete a GIS construction asset' })
  deleteAsset(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('assetId') assetId: string,
  ) {
    return this.constructionService.deleteConstructionAsset(user.tenantId, projectId, assetId);
  }

  @Get('completion')
  @RequirePermissions('construction:read')
  getCompletion(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string) {
    return this.constructionService.getProjectCompletion(user.tenantId, projectId);
  }

  @Get('final-bill-preparation')
  @RequirePermissions('construction:read')
  @ApiOperation({ summary: 'Stage 7 — completion verification checklist and final bill outputs' })
  getFinalBillPreparation(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string) {
    return this.constructionService.getFinalBillPreparation(user.tenantId, projectId);
  }

  @Patch('completion/verify')
  @RequirePermissions('construction:approve')
  @ApiOperation({ summary: 'EE verification — as-built, reservoir & pumping commissioning' })
  verifyCompletion(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Body() dto: UpdateCompletionVerificationDto,
  ) {
    return this.constructionService.verifyProjectCompletion(user.tenantId, projectId, dto);
  }

  @Post('final-bill/generate')
  @RequirePermissions('construction:approve')
  @ApiOperation({ summary: 'Generate final bill package after all verifications pass' })
  generateFinalBill(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Body() dto: GenerateFinalBillDto,
  ) {
    return this.constructionService.generateFinalBillPackage(user.tenantId, projectId, user.sub, dto);
  }

  @Get('documents')
  @RequirePermissions('construction:read')
  listDocuments(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Query('resourceType') resourceType?: string,
    @Query('resourceId') resourceId?: string,
  ) {
    return this.constructionService.listDocuments(
      user.tenantId, projectId, resourceType, resourceId,
    );
  }

  @Post('documents')
  @RequirePermissions('construction:create')
  uploadDocument(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Body() dto: UploadDocumentDto,
  ) {
    return this.constructionService.uploadDocument(user.tenantId, projectId, user.sub, dto);
  }

  @Post('documents/upload')
  @RequirePermissions('construction:create', 'construction:update')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 },
  }))
  uploadDocumentFile(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @UploadedFile() file: { buffer: Buffer; originalname?: string; mimetype?: string },
    @Body('resourceType') resourceType: UploadDocumentDto['resourceType'],
    @Body('resourceId') resourceId: string,
    @Body('docType') docType: string,
  ) {
    return this.constructionService.uploadDocumentFile(
      user.tenantId,
      projectId,
      user.sub,
      resourceType,
      resourceId,
      docType ?? 'site_photo',
      file,
    );
  }

  @Get('documents/:docId/file')
  @RequirePermissions('construction:read')
  async downloadDocumentFile(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('docId') docId: string,
    @Query('download') download: string | undefined,
    @Res() res: Response,
  ) {
    const { doc, absolutePath, mimeType } = await this.constructionService.resolveDocumentFile(
      user.tenantId,
      projectId,
      docId,
    );
    const disposition = download === '1' ? 'attachment' : 'inline';
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(doc.fileName)}"`);
    createReadStream(absolutePath).pipe(res);
  }
}
