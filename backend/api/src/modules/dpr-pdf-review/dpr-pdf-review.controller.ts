import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { DprProposalDivisionGuard } from '../../common/guards/dpr-proposal-division.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import {
  CreateDprPdfAnnotationDto,
  CreateDprPdfCommentDto,
  DocumentIdQueryDto,
  UpdateDprPdfAnnotationDto,
  UpdateDprPdfCommentDto,
} from './dto/dpr-pdf-review.dto';
import { DprPdfReviewService } from './dpr-pdf-review.service';

@ApiTags('DPR PDF Review')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard, DprProposalDivisionGuard)
@Controller('dpr-pdf-review')
export class DprPdfReviewController {
  constructor(private readonly service: DprPdfReviewService) {}

  @Get('proposals/:id/review')
  @RequirePermissions('dpr_pdf_review:read', 'dpr_proposal:read')
  @ApiOperation({ summary: 'Get or create PDF review session for a DPR document' })
  getReview(
    @CurrentUser() user: JwtPayload,
    @Param('id') proposalId: string,
    @Query() query: DocumentIdQueryDto,
  ) {
    return this.service.getOrCreateReview(
      user.tenantId,
      user.sub,
      user.roles ?? [],
      proposalId,
      query.documentId,
    );
  }

  @Get('proposals/:id/pdf-stream')
  @RequirePermissions('dpr_pdf_review:read', 'dpr_proposal:read')
  @ApiOperation({ summary: 'Stream secured DPR PDF for inline viewer' })
  async streamPdf(
    @CurrentUser() user: JwtPayload,
    @Param('id') proposalId: string,
    @Query() query: DocumentIdQueryDto,
    @Res() res: Response,
  ) {
    await this.service.streamPdf(user.tenantId, proposalId, query.documentId, res);
  }

  @Get('proposals/:id/annotations')
  @RequirePermissions('dpr_pdf_review:read', 'dpr_proposal:read')
  listAnnotations(
    @CurrentUser() user: JwtPayload,
    @Param('id') proposalId: string,
    @Query() query: DocumentIdQueryDto,
  ) {
    return this.service.listAnnotations(
      user.tenantId,
      user.sub,
      user.roles ?? [],
      proposalId,
      query.documentId,
    );
  }

  @Post('proposals/:id/annotations')
  @RequirePermissions('dpr_pdf_review:annotate')
  createAnnotation(
    @CurrentUser() user: JwtPayload,
    @Param('id') proposalId: string,
    @Body() dto: CreateDprPdfAnnotationDto,
  ) {
    return this.service.createAnnotation(user.tenantId, user.sub, proposalId, dto);
  }

  @Patch('proposals/:id/annotations/:annotationId')
  @RequirePermissions('dpr_pdf_review:annotate')
  updateAnnotation(
    @CurrentUser() user: JwtPayload,
    @Param('id') proposalId: string,
    @Param('annotationId') annotationId: string,
    @Body() dto: UpdateDprPdfAnnotationDto,
  ) {
    return this.service.updateAnnotation(user.tenantId, user.sub, proposalId, annotationId, dto);
  }

  @Delete('proposals/:id/annotations/:annotationId')
  @RequirePermissions('dpr_pdf_review:annotate')
  deleteAnnotation(
    @CurrentUser() user: JwtPayload,
    @Param('id') proposalId: string,
    @Param('annotationId') annotationId: string,
  ) {
    return this.service.deleteAnnotation(user.tenantId, user.sub, proposalId, annotationId);
  }

  @Get('proposals/:id/comments')
  @RequirePermissions('dpr_pdf_review:read', 'dpr_proposal:read')
  listComments(
    @CurrentUser() user: JwtPayload,
    @Param('id') proposalId: string,
    @Query() query: DocumentIdQueryDto,
  ) {
    return this.service.listComments(
      user.tenantId,
      user.sub,
      user.roles ?? [],
      proposalId,
      query.documentId,
    );
  }

  @Post('proposals/:id/comments')
  @RequirePermissions('dpr_pdf_review:comment')
  createComment(
    @CurrentUser() user: JwtPayload,
    @Param('id') proposalId: string,
    @Body() dto: CreateDprPdfCommentDto,
  ) {
    return this.service.createComment(user.tenantId, user.sub, proposalId, dto);
  }

  @Patch('proposals/:id/comments/:commentId')
  @RequirePermissions('dpr_pdf_review:comment')
  updateComment(
    @CurrentUser() user: JwtPayload,
    @Param('id') proposalId: string,
    @Param('commentId') commentId: string,
    @Body() dto: UpdateDprPdfCommentDto,
  ) {
    return this.service.updateComment(user.tenantId, user.sub, proposalId, commentId, dto);
  }

  @Delete('proposals/:id/comments/:commentId')
  @RequirePermissions('dpr_pdf_review:comment')
  deleteComment(
    @CurrentUser() user: JwtPayload,
    @Param('id') proposalId: string,
    @Param('commentId') commentId: string,
  ) {
    return this.service.deleteComment(user.tenantId, user.sub, proposalId, commentId);
  }

  @Get('proposals/:id/versions')
  @RequirePermissions('dpr_pdf_review:read', 'dpr_proposal:read')
  listVersions(
    @CurrentUser() user: JwtPayload,
    @Param('id') proposalId: string,
    @Query() query: DocumentIdQueryDto,
  ) {
    return this.service.listVersions(
      user.tenantId,
      user.sub,
      user.roles ?? [],
      proposalId,
      query.documentId,
    );
  }
}
