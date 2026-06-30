import {
  Body, Controller, Get, Param, Patch, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { createReadStream } from 'fs';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { DprProposalDivisionGuard } from '../../common/guards/dpr-proposal-division.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import {
  AdvanceDprProposalDto,
  CreateDprProposalDto,
  ForwardToSecretariatDto,
  ForwardToTacDto,
  BeginTacRound2ExaminationDto,
  HqReviewDprProposalDto,
  SubmitDprProposalDto,
  Stage3HqRemarksDto,
  SubmitDprToHqDto,
  TacReviewDprProposalDto,
  TacValidationModeDto,
  ResubmitRevisedDprDto,
  SubmitRound2ComplianceDto,
  RecordAdministrativeSanctionDto,
  InitiateTenderPreparationDto,
  BeginTenderProcessingDto,
  TenderApprovalReviewDto,
  PublishTenderDto,
  TacRound2ReviewDto,
  UpdateDprProposalDto,
  UploadDprDocumentDto,
} from './dto/dpr-planning.dto';
import { DprPlanningService } from './dpr-planning.service';

@ApiTags('DPR Planning')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard, DprProposalDivisionGuard)
@Controller('dpr-planning')
export class DprPlanningController {
  constructor(private readonly service: DprPlanningService) {}

  @Get('catalog')
  @RequirePermissions('dpr_proposal:read')
  @ApiOperation({ summary: 'DPR workflow stages, statuses & document types' })
  getCatalog() {
    return this.service.getCatalog();
  }

  @Get('dashboard')
  @RequirePermissions('dpr_proposal:read')
  @ApiOperation({ summary: 'DPR pipeline dashboard KPIs' })
  getDashboard(@CurrentUser() user: JwtPayload) {
    return this.service.getDashboard(user.tenantId, user);
  }

  @Get('proposals')
  @RequirePermissions('dpr_proposal:read')
  listProposals(
    @CurrentUser() user: JwtPayload,
    @Query('divisionId') divisionId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.listProposals(user.tenantId, user, { divisionId, status });
  }

  @Get('proposals/:id')
  @RequirePermissions('dpr_proposal:read')
  getProposal(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.service.getProposal(user.tenantId, id, user.roles ?? []);
  }

  @Post('proposals/:id/stage3-hq-remarks')
  @RequirePermissions('dpr_proposal:approve')
  @ApiOperation({ summary: 'Stage 3 — HQ review remarks on DPR preparation progress (read-only monitoring)' })
  saveStage3HqRemarks(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: Stage3HqRemarksDto,
  ) {
    return this.service.saveStage3HqRemarks(user.tenantId, user.sub, user.roles ?? [], id, dto);
  }

  @Get('proposals/:id/events')
  @RequirePermissions('dpr_proposal:read')
  listEvents(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.service.listEvents(user.tenantId, id);
  }

  @Get('proposals/:id/documents')
  @RequirePermissions('dpr_proposal:read')
  @ApiOperation({ summary: 'Stage document checklist with latest version per type' })
  listDocuments(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.service.listDocuments(user.tenantId, id);
  }

  @Get('proposals/:id/documents/:documentId/file')
  @RequirePermissions('dpr_proposal:read')
  @ApiOperation({ summary: 'Download uploaded DPR proposal document' })
  async downloadDocument(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @Res() res: Response,
  ) {
    const { doc, absolutePath, mimeType } = await this.service.getDocumentFile(user.tenantId, id, documentId);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${doc.fileName ?? 'document'}"`);
    const stream = createReadStream(absolutePath);
    stream.on('error', () => {
      if (!res.headersSent) {
        res.status(404).json({
          statusCode: 404,
          message: 'File not found on server — re-upload the document',
        });
      }
    });
    stream.pipe(res);
  }

  @Get('proposals/:id/documents/:documentType/versions')
  @RequirePermissions('dpr_proposal:read')
  @ApiOperation({ summary: 'Version history for a document type' })
  listDocumentVersions(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('documentType') documentType: string,
  ) {
    return this.service.listDocumentVersions(user.tenantId, id, documentType);
  }

  @Post('proposals')
  @RequirePermissions('dpr_proposal:create')
  @ApiOperation({ summary: 'Stage 1 — Division EE initiates DPR proposal (generates unique Proposal ID)' })
  createProposal(@CurrentUser() user: JwtPayload, @Body() dto: CreateDprProposalDto) {
    return this.service.createProposal(
      user.tenantId,
      user.sub,
      user.activeDivisionId ?? user.divisionId,
      user.roles ?? [],
      dto,
    );
  }

  @Patch('proposals/:id')
  @RequirePermissions('dpr_proposal:update')
  @ApiOperation({ summary: 'Update Stage 1 draft fields (estimate, justification, GIS)' })
  updateProposal(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateDprProposalDto,
  ) {
    return this.service.updateProposal(user.tenantId, user.sub, user.roles ?? [], id, dto);
  }

  @Post('proposals/:id/submit')
  @RequirePermissions('dpr_proposal:update')
  @ApiOperation({ summary: 'Stage 1 — Division forwards proposal to HQ for DPR preparation approval' })
  submitToHq(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: SubmitDprProposalDto,
  ) {
    return this.service.submitToHq(user.tenantId, user.sub, user.roles ?? [], id, dto);
  }

  @Post('proposals/:id/hq-review')
  @RequirePermissions('dpr_proposal:approve')
  @ApiOperation({ summary: 'Stage 2 — HQ reviews proposal and approves, returns, or rejects' })
  reviewByHq(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: HqReviewDprProposalDto,
  ) {
    return this.service.reviewByHq(user.tenantId, user.sub, user.roles ?? [], id, dto);
  }

  @Post('proposals/:id/forward-to-tac')
  @RequirePermissions('dpr_proposal:approve')
  @ApiOperation({ summary: 'Stage 4 — HQ forwards completed DPR to TAC Section for Round 1 review' })
  forwardToTac(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ForwardToTacDto,
  ) {
    return this.service.forwardToTac(user.tenantId, user.sub, user.roles ?? [], id, dto);
  }

  @Post('proposals/:id/forward-to-secretariat')
  @RequirePermissions('dpr_proposal:approve')
  @ApiOperation({ summary: 'Stage 6 — Forward TAC-cleared DPR to Secretariat / Sachiwalaya' })
  forwardToSecretariat(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ForwardToSecretariatDto,
  ) {
    return this.service.forwardToSecretariat(user.tenantId, user.sub, user.roles ?? [], id, dto);
  }

  @Post('proposals/:id/begin-tac-round2')
  @RequirePermissions('dpr_proposal:approve')
  @ApiOperation({ summary: 'Stage 7 — Begin Second Round TAC / Govt technical examination' })
  beginTacRound2Examination(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: BeginTacRound2ExaminationDto,
  ) {
    return this.service.beginTacRound2Examination(user.tenantId, user.sub, user.roles ?? [], id, dto);
  }

  @Post('proposals/:id/tac-round2-review')
  @RequirePermissions('dpr_proposal:approve')
  @ApiOperation({ summary: 'Stage 7 — Round 2 TAC / Govt examination (concurrence, compliance, info)' })
  reviewByTacRound2(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: TacRound2ReviewDto,
  ) {
    return this.service.reviewByTacRound2(user.tenantId, user.sub, user.roles ?? [], id, dto);
  }

  @Post('proposals/:id/begin-round2-compliance')
  @RequirePermissions('dpr_proposal:update')
  @ApiOperation({ summary: 'Stage 7 — DPR team begins Round 2 compliance submission' })
  beginRound2Compliance(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.service.beginRound2Compliance(user.tenantId, user.sub, user.roles ?? [], id);
  }

  @Post('proposals/:id/submit-round2-compliance')
  @RequirePermissions('dpr_proposal:update')
  @ApiOperation({ summary: 'Stage 7 — Submit Round 2 compliance and resubmit to committee' })
  submitRound2Compliance(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: SubmitRound2ComplianceDto,
  ) {
    return this.service.submitRound2Compliance(user.tenantId, user.sub, user.roles ?? [], id, dto);
  }

  @Get('proposals/:id/tac-round2-report')
  @RequirePermissions('dpr_proposal:read')
  @ApiOperation({ summary: 'Download Round 2 TAC / Govt examination report' })
  async exportTacRound2Report(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { buffer, fileName } = await this.service.exportTacRound2ComplianceReport(user.tenantId, id);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  }

  @Post('proposals/:id/record-sanction')
  @RequirePermissions('dpr_proposal:approve')
  @ApiOperation({ summary: 'Stage 8 — Record Administrative Approval, ES, budget allocation & funding release' })
  recordAdministrativeSanction(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: RecordAdministrativeSanctionDto,
  ) {
    return this.service.recordAdministrativeSanction(user.tenantId, user.sub, user.roles ?? [], id, dto);
  }

  @Post('proposals/:id/initiate-tender-prep')
  @RequirePermissions('dpr_proposal:approve')
  @ApiOperation({ summary: 'Stage 9 — HQ initiates tender preparation and issues Task Order to division' })
  initiateTenderPreparation(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: InitiateTenderPreparationDto,
  ) {
    return this.service.initiateTenderPreparation(user.tenantId, user.sub, user.roles ?? [], id, dto);
  }

  @Get('proposals/:id/tender-task-order')
  @RequirePermissions('dpr_proposal:read')
  @ApiOperation({ summary: 'Download Tender Preparation Task Order' })
  async exportTenderTaskOrder(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { buffer, fileName } = await this.service.exportTenderTaskOrder(user.tenantId, id);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  }

  @Post('proposals/:id/begin-tender-processing')
  @RequirePermissions('dpr_proposal:approve', 'dpr_proposal:update')
  @ApiOperation({ summary: 'Stage 10 — Begin tender processing & procurement (JE verification queue)' })
  beginTenderProcessing(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: BeginTenderProcessingDto,
  ) {
    return this.service.beginTenderProcessing(user.tenantId, user.sub, user.roles ?? [], id, dto);
  }

  @Post('proposals/:id/tender-approval-review')
  @RequirePermissions('dpr_proposal:approve', 'dpr_proposal:update')
  @ApiOperation({ summary: 'Stage 10 — JE / AE / EE tender approval hierarchy action' })
  reviewTenderApproval(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: TenderApprovalReviewDto,
  ) {
    return this.service.reviewTenderApproval(user.tenantId, user.sub, user.roles ?? [], id, dto);
  }

  @Post('proposals/:id/publish-tender')
  @RequirePermissions('dpr_proposal:approve')
  @ApiOperation({ summary: 'Stage 10 — Publish tender after EE approval' })
  publishTenderProposal(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: PublishTenderDto,
  ) {
    return this.service.publishTenderProposal(user.tenantId, user.sub, user.roles ?? [], id, dto);
  }

  @Post('proposals/:id/tac-review')
  @RequirePermissions('dpr_proposal:approve')
  @ApiOperation({ summary: 'Stage 4 — TAC Round 1 review (approve, suggest corrections, request info, return)' })
  reviewByTac(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: TacReviewDprProposalDto,
  ) {
    return this.service.reviewByTac(user.tenantId, user.sub, user.roles ?? [], id, dto);
  }

  @Get('proposals/:id/tac-compliance-report')
  @RequirePermissions('dpr_proposal:read')
  @ApiOperation({ summary: 'Download TAC Round 1 compliance & observations report' })
  async exportTacCompliance(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { buffer, fileName } = await this.service.exportTacComplianceReport(user.tenantId, id);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  }

  @Post('proposals/:id/tac-package/validation-mode')
  @RequirePermissions('dpr_proposal:update')
  @ApiOperation({ summary: 'Stage 3 — choose Excel auto-audit or PDF-only manual TAC review' })
  setTacValidationMode(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: TacValidationModeDto,
  ) {
    return this.service.setTacValidationMode(user.tenantId, user.sub, user.roles ?? [], id, dto);
  }

  @Get('proposals/:id/pdf-validation')
  @RequirePermissions('dpr_proposal:read')
  @ApiOperation({ summary: 'Latest basic PDF validation for Complete DPR upload' })
  getPdfValidation(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.service.getPdfValidation(user.tenantId, id);
  }

  @Post('proposals/:id/begin-preparation')
  @RequirePermissions('dpr_proposal:update')
  @ApiOperation({ summary: 'Stage 3 — Begin DPR preparation after HQ approval' })
  beginDprPreparation(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.service.beginDprPreparation(user.tenantId, user.sub, user.roles ?? [], id);
  }

  @Post('proposals/:id/begin-revision')
  @RequirePermissions('dpr_proposal:update')
  @ApiOperation({ summary: 'Stage 5 — Begin DPR revision after TAC corrections' })
  beginDprRevision(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.service.beginDprRevision(user.tenantId, user.sub, user.roles ?? [], id);
  }

  @Post('proposals/:id/resubmit-revised-dpr')
  @RequirePermissions('dpr_proposal:update')
  @ApiOperation({ summary: 'Stage 5 — Resubmit revised DPR to TAC for Round 1 re-review' })
  resubmitRevisedDprToTac(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ResubmitRevisedDprDto,
  ) {
    return this.service.resubmitRevisedDprToTac(user.tenantId, user.sub, user.roles ?? [], id, dto);
  }

  @Post('proposals/:id/submit-dpr')
  @RequirePermissions('dpr_proposal:update')
  @ApiOperation({ summary: 'Stage 3 — Submit completed DPR to HQ' })
  submitDprToHq(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: SubmitDprToHqDto,
  ) {
    return this.service.submitDprToHq(user.tenantId, user.sub, user.roles ?? [], id, dto);
  }

  @Get('proposals/:id/boq-validation')
  @RequirePermissions('dpr_proposal:read')
  @ApiOperation({ summary: 'Latest BOQ auto-validation report for TAC review' })
  getBoqValidation(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('detail') detail?: string,
  ) {
    return this.service.getBoqValidation(user.tenantId, id, detail);
  }

  @Get('proposals/:id/boq-validation/history')
  @RequirePermissions('dpr_proposal:read')
  listBoqValidationHistory(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.service.listBoqValidationHistory(user.tenantId, id);
  }

  @Get('proposals/:id/boq-validation/export')
  @RequirePermissions('dpr_proposal:read')
  @ApiOperation({ summary: 'Download DPR Excel validation report (Error Log, Formula Audit, Dashboard, Certificate)' })
  async exportBoqValidation(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { buffer, fileName } = await this.service.exportBoqValidationReport(user.tenantId, id);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  }

  @Post('proposals/:id/tac-package/dpr-pdf')
  @RequirePermissions('dpr_proposal:update')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Upload complete DPR PDF for HQ TAC submission' })
  uploadCompleteDprPdf(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @UploadedFile() file: { buffer: Buffer; originalname?: string },
    @Body('remarks') remarks?: string,
  ) {
    return this.service.uploadCompleteDprPdf(user.tenantId, user.sub, user.roles ?? [], id, file, remarks);
  }

  @Post('proposals/:id/tac-package/boq-excel')
  @RequirePermissions('dpr_proposal:update')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Upload complete BOQ Excel — system auto-validates Qty×Rate=Amount for TAC' })
  uploadTacBoqExcel(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @UploadedFile() file: { buffer: Buffer; originalname?: string },
    @Body('remarks') remarks?: string,
  ) {
    return this.service.uploadTacBoqExcel(user.tenantId, user.sub, user.roles ?? [], id, file, remarks);
  }

  @Post('proposals/:id/documents')
  @RequirePermissions('dpr_proposal:update')
  uploadDocument(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UploadDprDocumentDto,
  ) {
    return this.service.uploadDocument(user.tenantId, user.sub, user.roles ?? [], id, dto);
  }

  @Post('proposals/:id/documents/upload')
  @RequirePermissions('dpr_proposal:update')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Upload DPR document with automatic version control' })
  uploadDocumentFile(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @UploadedFile() file: { buffer: Buffer; originalname?: string },
    @Body('documentType') documentType: string,
    @Body('remarks') remarks?: string,
  ) {
    return this.service.uploadDocumentFile(user.tenantId, user.sub, user.roles ?? [], id, documentType, file, remarks);
  }

  @Patch('proposals/:id/advance')
  @RequirePermissions('dpr_proposal:update', 'dpr_proposal:approve')
  @ApiOperation({ summary: 'Advance DPR proposal through workflow stage (HQ approval and beyond)' })
  advanceProposal(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AdvanceDprProposalDto,
  ) {
    return this.service.advanceProposal(user.tenantId, user.sub, user.roles ?? [], id, dto);
  }
}
