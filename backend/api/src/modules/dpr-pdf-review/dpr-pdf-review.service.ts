import {
  ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createReadStream } from 'fs';
import type { Response } from 'express';
import { Repository } from 'typeorm';
import { AuditService } from '../../common/services/audit.service';
import { DprPlanningService } from '../dpr-planning/dpr-planning.service';
import { DprProposalDocument } from '../dpr-planning/entities/dpr-planning-support.entity';
import { resolveReviewerScope } from './constants/dpr-pdf-review.constants';
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
    await this.requireDocument(tenantId, proposalId, documentId);
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
    const [annotationCount, commentCount] = await Promise.all([
      this.annotationRepo.count({ where: { tenantId, reviewId: review.id } }),
      this.commentRepo.count({ where: { tenantId, reviewId: review.id } }),
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
    createReadStream(absolutePath).pipe(res);
  }

  async listAnnotations(tenantId: string, proposalId: string, documentId: string) {
    const review = await this.requireReview(tenantId, proposalId, documentId);
    const rows = await this.annotationRepo.find({
      where: { tenantId, reviewId: review.id },
      order: { pageNumber: 'ASC', createdAt: 'ASC' },
    });
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
      color: dto.color ?? '#e53935',
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

  async listComments(tenantId: string, proposalId: string, documentId: string) {
    const review = await this.requireReview(tenantId, proposalId, documentId);
    const rows = await this.commentRepo.find({
      where: { tenantId, reviewId: review.id },
      order: { createdAt: 'ASC' },
    });
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

  async listVersions(tenantId: string, proposalId: string, documentId: string) {
    const review = await this.requireReview(tenantId, proposalId, documentId);
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

  private async requireDocument(tenantId: string, proposalId: string, documentId: string) {
    const doc = await this.docRepo.findOne({ where: { id: documentId, tenantId, proposalId } });
    if (!doc) throw new NotFoundException('DPR document not found');
    return doc;
  }

  private async requireReview(tenantId: string, proposalId: string, documentId: string) {
    await this.requireDocument(tenantId, proposalId, documentId);
    const review = await this.reviewRepo.findOne({ where: { tenantId, proposalId, documentId } });
    if (!review) {
      throw new NotFoundException('PDF review session not found — open the review viewer first');
    }
    return review;
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
