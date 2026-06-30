import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createReadStream, readFileSync } from 'fs';
import type { Response } from 'express';
import { QueryFailedError, Repository } from 'typeorm';
import { AuditService } from '../../common/services/audit.service';
import { DprPlanningService } from '../dpr-planning/dpr-planning.service';
import { DprProposalDocument } from '../dpr-planning/entities/dpr-planning-support.entity';
import { resolveReviewerScope } from './constants/dpr-pdf-review.constants';
import { aiSeverityToAnnotationType } from './constants/dpr-pdf-ai-review.constants';
import {
  CreateDprPdfAnnotationDto,
  CreateDprPdfCommentDto,
  UpdateDprPdfAnnotationDto,
  UpdateDprPdfCommentDto,
} from './dto/dpr-pdf-review.dto';
import {
  DprPdfAnnotation,
  DprPdfComment,
  DprPdfReview,
  DprPdfVersion,
} from './entities/dpr-pdf-review.entity';
import {
  getAiSeverityColor,
  runDprPdfAiReview,
} from './utils/dpr-pdf-ai-review.util';

@Injectable()
export class DprPdfReviewService {
  constructor(
    @InjectRepository(DprPdfReview) private reviewRepo: Repository<DprPdfReview>,
    @InjectRepository(DprPdfAnnotation) private annotationRepo: Repository<DprPdfAnnotation>,
    @InjectRepository(DprPdfComment) private commentRepo: Repository<DprPdfComment>,
    @InjectRepository(DprPdfVersion) private versionRepo: Repository<DprPdfVersion>,
    @InjectRepository(DprProposalDocument) private docRepo: Repository<DprProposalDocument>,
    private dprPlanning: DprPlanningService,
    private audit: AuditService,
  ) {}

  async getOrCreateReview(
    tenantId: string,
    userId: string,
    roles: string[],
    proposalId: string,
    documentId: string,
  ) {
    const review = await this.ensureReviewSession(
      tenantId,
      userId,
      roles,
      proposalId,
      documentId,
    );
    const [annotationCount, commentCount] = await Promise.all([
      this.countAnnotations(tenantId, review.id),
      this.countComments(tenantId, review.id),
    ]);
    return {
      id: review.id,
      proposalId: review.proposalId,
      documentId: review.documentId,
      status: review.status,
      reviewerScope: review.reviewerScope,
      assignedTo: review.assignedTo,
      annotationCount,
      commentCount,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
    };
  }

  async streamPdf(
    tenantId: string,
    proposalId: string,
    documentId: string,
    res: Response,
  ) {
    const { doc, absolutePath, mimeType } = await this.dprPlanning.getDocumentFile(
      tenantId,
      proposalId,
      documentId,
    );
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${doc.fileName ?? 'document.pdf'}"`);
    const stream = createReadStream(absolutePath);
    stream.on('error', (err) => {
      if (!res.headersSent) {
        res.status(404).json({
          statusCode: 404,
          message: 'File not found on server — re-upload the document',
        });
        return;
      }
      res.destroy(err);
    });
    stream.pipe(res);
  }

  async listAnnotations(
    tenantId: string,
    userId: string,
    roles: string[],
    proposalId: string,
    documentId: string,
  ) {
    const review = await this.ensureReviewSession(
      tenantId,
      userId,
      roles,
      proposalId,
      documentId,
    );
    const rows = await this.findAnnotations(tenantId, review.id);
    return rows.map((a) => this.mapAnnotation(a));
  }

  async createAnnotation(
    tenantId: string,
    userId: string,
    proposalId: string,
    dto: CreateDprPdfAnnotationDto,
  ) {
    const review = await this.requireReview(tenantId, proposalId, dto.documentId);
    const annotation = this.annotationRepo.create({
      tenantId,
      reviewId: review.id,
      proposalId,
      documentId: dto.documentId,
      pageNumber: dto.pageNumber,
      annotationType: dto.annotationType,
      geometry: dto.geometry,
      color: dto.color ?? '#d32f2f',
      content: dto.content ?? null,
      createdBy: userId,
    });
    const saved = await this.annotationRepo.save(annotation);
    await this.audit.log(
      tenantId,
      userId,
      'dpr_pdf_annotation.created',
      'dpr_pdf_annotation',
      saved.id,
      { proposalId, pageNumber: dto.pageNumber, type: dto.annotationType },
    );
    return this.mapAnnotation(saved);
  }

  async updateAnnotation(
    tenantId: string,
    userId: string,
    proposalId: string,
    annotationId: string,
    dto: UpdateDprPdfAnnotationDto,
  ) {
    const annotation = await this.annotationRepo.findOne({
      where: { id: annotationId, tenantId, proposalId },
    });
    if (!annotation) throw new NotFoundException('Annotation not found');
    if (dto.geometry !== undefined) annotation.geometry = dto.geometry;
    if (dto.color !== undefined) annotation.color = dto.color;
    if (dto.content !== undefined) annotation.content = dto.content;
    annotation.updatedBy = userId;
    const saved = await this.annotationRepo.save(annotation);
    await this.audit.log(
      tenantId,
      userId,
      'dpr_pdf_annotation.updated',
      'dpr_pdf_annotation',
      saved.id,
      { proposalId },
    );
    return this.mapAnnotation(saved);
  }

  async deleteAnnotation(
    tenantId: string,
    userId: string,
    proposalId: string,
    annotationId: string,
  ) {
    const annotation = await this.annotationRepo.findOne({
      where: { id: annotationId, tenantId, proposalId },
    });
    if (!annotation) throw new NotFoundException('Annotation not found');
    await this.annotationRepo.remove(annotation);
    await this.audit.log(
      tenantId,
      userId,
      'dpr_pdf_annotation.deleted',
      'dpr_pdf_annotation',
      annotationId,
      { proposalId },
    );
    return { deleted: true };
  }

  async listComments(
    tenantId: string,
    userId: string,
    roles: string[],
    proposalId: string,
    documentId: string,
  ) {
    const review = await this.ensureReviewSession(
      tenantId,
      userId,
      roles,
      proposalId,
      documentId,
    );
    const rows = await this.findComments(tenantId, review.id);
    return rows.map((c) => this.mapComment(c));
  }

  async createComment(
    tenantId: string,
    userId: string,
    proposalId: string,
    dto: CreateDprPdfCommentDto,
  ) {
    const review = await this.requireReview(tenantId, proposalId, dto.documentId);
    if (dto.annotationId) {
      const linked = await this.annotationRepo.findOne({
        where: { id: dto.annotationId, tenantId, reviewId: review.id },
      });
      if (!linked) throw new NotFoundException('Linked annotation not found');
    }
    const comment = this.commentRepo.create({
      tenantId,
      reviewId: review.id,
      proposalId,
      annotationId: dto.annotationId ?? null,
      pageNumber: dto.pageNumber ?? null,
      body: dto.body,
      parentId: dto.parentId ?? null,
      createdBy: userId,
    });
    const saved = await this.commentRepo.save(comment);
    await this.audit.log(
      tenantId,
      userId,
      'dpr_pdf_comment.created',
      'dpr_pdf_comment',
      saved.id,
      { proposalId, pageNumber: dto.pageNumber ?? null },
    );
    return this.mapComment(saved);
  }

  async updateComment(
    tenantId: string,
    userId: string,
    proposalId: string,
    commentId: string,
    dto: UpdateDprPdfCommentDto,
  ) {
    const comment = await this.commentRepo.findOne({
      where: { id: commentId, tenantId, proposalId },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.createdBy !== userId) {
      throw new ForbiddenException('You can only edit your own comments');
    }
    comment.body = dto.body;
    const saved = await this.commentRepo.save(comment);
    await this.audit.log(
      tenantId,
      userId,
      'dpr_pdf_comment.updated',
      'dpr_pdf_comment',
      saved.id,
      { proposalId },
    );
    return this.mapComment(saved);
  }

  async deleteComment(
    tenantId: string,
    userId: string,
    proposalId: string,
    commentId: string,
  ) {
    const comment = await this.commentRepo.findOne({
      where: { id: commentId, tenantId, proposalId },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.createdBy !== userId) {
      throw new ForbiddenException('You can only delete your own comments');
    }
    await this.commentRepo.remove(comment);
    await this.audit.log(
      tenantId,
      userId,
      'dpr_pdf_comment.deleted',
      'dpr_pdf_comment',
      commentId,
      { proposalId },
    );
    return { deleted: true };
  }

  async listVersions(
    tenantId: string,
    userId: string,
    roles: string[],
    proposalId: string,
    documentId: string,
  ) {
    const review = await this.ensureReviewSession(
      tenantId,
      userId,
      roles,
      proposalId,
      documentId,
    );
    const doc = await this.requireDocument(tenantId, proposalId, documentId);
    const snapshots = await this.versionRepo.find({
      where: { tenantId, reviewId: review.id },
      order: { versionNo: 'DESC' },
    });
    return {
      documentVersionNo: doc.versionNo,
      snapshots: snapshots.map((v) => ({
        id: v.id,
        versionNo: v.versionNo,
        label: v.label,
        documentId: v.documentId,
        createdAt: v.createdAt,
      })),
    };
  }

  async runAiReview(
    tenantId: string,
    userId: string,
    roles: string[],
    proposalId: string,
    documentId: string,
  ) {
    const review = await this.ensureReviewSession(
      tenantId,
      userId,
      roles,
      proposalId,
      documentId,
    );
    const { absolutePath } = await this.dprPlanning.getDocumentFile(
      tenantId,
      proposalId,
      documentId,
    );
    const buffer = readFileSync(absolutePath);
    let result;
    try {
      result = await runDprPdfAiReview(buffer);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(
        msg.includes('valid JSON') || msg.includes('pdf-parse')
          ? 'AI review could not parse this PDF — try re-exporting the DPR as a standard text PDF'
          : `AI review failed: ${msg}`,
      );
    }

    await this.deleteAiAnnotations(tenantId, review.id);

    const createdAnnotations: DprPdfAnnotation[] = [];
    for (const finding of result.findings) {
      const annotation = this.annotationRepo.create({
        tenantId,
        reviewId: review.id,
        proposalId,
        documentId,
        pageNumber: finding.pageNumber,
        annotationType: aiSeverityToAnnotationType(finding.severity),
        geometry: {
          rect: finding.rect,
          normalized: true,
          ruleId: finding.ruleId,
          category: finding.category,
        },
        color: getAiSeverityColor(finding.severity),
        content: `${finding.title}\n${finding.message}`,
        createdBy: userId,
      });
      createdAnnotations.push(annotation);
    }
    const saved = createdAnnotations.length
      ? await this.annotationRepo.save(createdAnnotations)
      : [];

    let summaryComment: DprPdfComment | null = null;
    if (result.summary.total > 0) {
      const body =
        `AI Review completed: ${result.summary.total} finding(s) — ` +
        `${result.summary.critical} critical, ${result.summary.major} major, ` +
        `${result.summary.minor} minor, ${result.summary.info} info.`;
      summaryComment = await this.commentRepo.save(
        this.commentRepo.create({
          tenantId,
          reviewId: review.id,
          proposalId,
          annotationId: null,
          pageNumber: null,
          body,
          parentId: null,
          createdBy: userId,
        }),
      );
    }

    await this.audit.log(
      tenantId,
      userId,
      'dpr_pdf_ai_review.completed',
      'dpr_pdf_review',
      review.id,
      {
        proposalId,
        documentId,
        findings: result.summary.total,
        critical: result.summary.critical,
      },
    );

    return {
      pageCount: result.pageCount,
      summary: result.summary,
      findings: result.findings,
      annotations: saved.map((a) => this.mapAnnotation(a)),
      summaryComment: summaryComment ? this.mapComment(summaryComment) : null,
    };
  }

  private async deleteAiAnnotations(tenantId: string, reviewId: string) {
    try {
      const aiTypes = ['ai_critical', 'ai_major', 'ai_minor', 'ai_info'];
      for (const t of aiTypes) {
        await this.annotationRepo.delete({ tenantId, reviewId, annotationType: t });
      }
    } catch (err) {
      this.rethrowPdfReviewDbError(err);
    }
  }

  private async ensureReviewSession(
    tenantId: string,
    userId: string,
    roles: string[],
    proposalId: string,
    documentId: string,
  ): Promise<DprPdfReview> {
    await this.requireDocument(tenantId, proposalId, documentId);
    try {
      let review = await this.reviewRepo.findOne({
        where: { tenantId, proposalId, documentId },
      });
      if (!review) {
        review = this.reviewRepo.create({
          tenantId,
          proposalId,
          documentId,
          status: 'open',
          reviewerScope: resolveReviewerScope(roles),
          createdBy: userId,
        });
        review = await this.reviewRepo.save(review);
        await this.audit.log(
          tenantId,
          userId,
          'dpr_pdf_review.created',
          'dpr_pdf_review',
          review.id,
          { proposalId, documentId },
        );
      }
      return review;
    } catch (err) {
      this.rethrowPdfReviewDbError(err);
    }
  }

  private async requireDocument(tenantId: string, proposalId: string, documentId: string) {
    const doc = await this.docRepo.findOne({ where: { id: documentId, tenantId, proposalId } });
    if (!doc) throw new NotFoundException('DPR document not found');
    return doc;
  }

  private async requireReview(tenantId: string, proposalId: string, documentId: string) {
    await this.requireDocument(tenantId, proposalId, documentId);
    try {
      const review = await this.reviewRepo.findOne({ where: { tenantId, proposalId, documentId } });
      if (!review) {
        throw new NotFoundException('PDF review session not found — open the review viewer first');
      }
      return review;
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      this.rethrowPdfReviewDbError(err);
    }
  }

  private async countAnnotations(tenantId: string, reviewId: string) {
    try {
      return await this.annotationRepo.count({ where: { tenantId, reviewId } });
    } catch (err) {
      this.rethrowPdfReviewDbError(err);
    }
  }

  private async countComments(tenantId: string, reviewId: string) {
    try {
      return await this.commentRepo.count({ where: { tenantId, reviewId } });
    } catch (err) {
      this.rethrowPdfReviewDbError(err);
    }
  }

  private async findAnnotations(tenantId: string, reviewId: string) {
    try {
      return await this.annotationRepo.find({
        where: { tenantId, reviewId },
        order: { pageNumber: 'ASC', createdAt: 'ASC' },
      });
    } catch (err) {
      this.rethrowPdfReviewDbError(err);
    }
  }

  private async findComments(tenantId: string, reviewId: string) {
    try {
      return await this.commentRepo.find({
        where: { tenantId, reviewId },
        order: { createdAt: 'ASC' },
      });
    } catch (err) {
      this.rethrowPdfReviewDbError(err);
    }
  }

  private rethrowPdfReviewDbError(err: unknown): never {
    if (err instanceof QueryFailedError) {
      const message = err.message ?? '';
      if (/relation "dpr_pdf_/i.test(message)) {
        throw new ServiceUnavailableException(
          'DPR PDF review is not initialized on this server. Apply database migration 094_dpr_pdf_review.sql and redeploy.',
        );
      }
    }
    if (err instanceof Error) throw err;
    throw new InternalServerErrorException('DPR PDF review request failed');
  }

  private mapAnnotation(a: DprPdfAnnotation) {
    return {
      id: a.id,
      reviewId: a.reviewId,
      proposalId: a.proposalId,
      documentId: a.documentId,
      pageNumber: a.pageNumber,
      annotationType: a.annotationType,
      geometry: a.geometry,
      color: a.color,
      content: a.content,
      createdBy: a.createdBy,
      updatedBy: a.updatedBy,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    };
  }

  private mapComment(c: DprPdfComment) {
    return {
      id: c.id,
      reviewId: c.reviewId,
      annotationId: c.annotationId,
      proposalId: c.proposalId,
      pageNumber: c.pageNumber,
      body: c.body,
      parentId: c.parentId,
      createdBy: c.createdBy,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }
}
