import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { DivisionAccessService } from '../divisions/division-access.service';
import {
  DPR_DOCUMENT_TYPES,
  DPR_HQ_VERIFICATION_ITEMS,
  DPR_PLANNING_STAGES,
  DPR_STAGE_1_REQUIRED_DOCUMENT_TYPES,
  DPR_STAGE_3_REQUIRED_DOCUMENT_TYPES,
  DPR_STAGE_3_UPLOAD_STATUSES,
  DPR_REVISION_STATUSES,
  DPR_ROUND2_COMPLIANCE_STATUSES,
  DPR_SANCTION_RECORD_STATUSES,
  DPR_STAGE_8_SANCTION_DOCUMENT_TYPES,
  DPR_STAGE_9_PREP_DOCUMENT_TYPES,
  DPR_STAGE_10_REQUIRED_DOCUMENT_TYPES,
  DPR_TENDER_PROCESSING_PREP_CHECKLIST,
  DPR_TENDER_APPROVAL_LABELS,
  DPR_TENDER_UPLOAD_STATUSES,
  DPR_TENDER_PREP_CHECKLIST,
  DPR_TENDER_PREP_STATUSES,
  DPR_TAC_PACKAGE_TYPES,
  DPR_TAC_ROUND1_CHECKLIST,
  DPR_TAC_ROUND2_CHECKLIST,
  DPR_TAC_ACTION_LABELS,
  DPR_TAC_ROUND2_ACTION_LABELS,
  DPR_STATUS_LABELS,
  DprAdvanceAction,
  getDprStageForStatus,
  getDprStatusLabel,
  canRecordDprSanction,
  getDprViewerStatusLabel,
  isDivisionDprViewer,
  DPR_STATE_REVIEWER_ROLES,
  isSecretariatReviewer,
  isStateReviewer,
} from './constants/dpr-planning.constants';
import { AdvanceDprProposalDto, AssignRound2ComplianceToEeDto, BeginTacRound2ExaminationDto, BeginTenderProcessingDto, CreateDprProposalDto, ForwardToSecretariatDto, ForwardToTacDto, HqReviewDprProposalDto, InitiateTenderPreparationDto, PublishTenderDto, RecordAdministrativeSanctionDto, ResubmitRevisedDprDto, ReviewRound2ComplianceAdminDto, Stage3HqRemarksDto, SubmitDprProposalDto, SubmitDprToHqDto, SubmitRound2ComplianceDto, TacReviewDprProposalDto, TacRound2ReviewDto, TacValidationModeDto, TenderApprovalReviewDto, UpdateDprProposalDto, UploadDprDocumentDto } from './dto/dpr-planning.dto';
import { DprProposal } from './entities/dpr-proposal.entity';
import {
  DprProposalDocument,
  DprBoqValidation,
  DprSanction,
  DprTenderPackage,
  DprWorkflowEvent,
} from './entities/dpr-planning-support.entity';
import { fileExists, guessMimeType, resolveDprProposalFilePath, saveDprProposalFile } from './utils/dpr-files.util';
import { validateBoqExcelBuffer } from './utils/dpr-boq-validation.util';
import type { DprExcelAuditReport } from './utils/dpr-excel-audit.types';
import { validateDprPdfBuffer, type DprPdfValidationReport } from './utils/dpr-pdf-validation.util';
import { buildDprValidationExcelExport } from './utils/dpr-excel-audit-export.util';
import { LandAcquisitionService } from '../land-acquisition/land-acquisition.service';
import type { LaReadiness } from '../land-acquisition/land-acquisition.service';
import { readFileSync } from 'fs';
import { DprPdfReview, DprPdfAnnotation } from '../dpr-pdf-review/entities/dpr-pdf-review.entity';
import { assertNotSuperAdminRolesForOperations, isSuperAdmin } from '../../common/utils/operational-access.util';

type Transition = { next: string; stage: number };

@Injectable()
export class DprPlanningService {
  constructor(
    @InjectRepository(DprProposal) private proposalRepo: Repository<DprProposal>,
    @InjectRepository(DprProposalDocument) private docRepo: Repository<DprProposalDocument>,
    @InjectRepository(DprBoqValidation) private boqValidationRepo: Repository<DprBoqValidation>,
    @InjectRepository(DprWorkflowEvent) private eventRepo: Repository<DprWorkflowEvent>,
    @InjectRepository(DprSanction) private sanctionRepo: Repository<DprSanction>,
    @InjectRepository(DprTenderPackage) private tenderRepo: Repository<DprTenderPackage>,
    @InjectRepository(DprPdfReview) private pdfReviewRepo: Repository<DprPdfReview>,
    @InjectRepository(DprPdfAnnotation) private pdfAnnotationRepo: Repository<DprPdfAnnotation>,
    private divisionAccess: DivisionAccessService,
    private landAcquisitionService: LandAcquisitionService,
  ) {}

  getCatalog() {
    return {
      stages: DPR_PLANNING_STAGES,
      statusLabels: DPR_STATUS_LABELS,
      documentTypes: DPR_DOCUMENT_TYPES,
      hqVerificationItems: DPR_HQ_VERIFICATION_ITEMS,
      tacRound1Checklist: DPR_TAC_ROUND1_CHECKLIST,
      tacRound2Checklist: DPR_TAC_ROUND2_CHECKLIST,
      tenderPrepChecklist: DPR_TENDER_PREP_CHECKLIST,
      tenderProcessingChecklist: DPR_TENDER_PROCESSING_PREP_CHECKLIST,
    };
  }

  async getDashboard(tenantId: string, user: JwtPayload) {
    const qb = this.proposalRepo.createQueryBuilder('p')
      .where('p.tenant_id = :tenantId', { tenantId })
      .orderBy('p.updated_at', 'DESC');
    await this.divisionAccess.applyDivisionScope(qb, user, 'p', tenantId);
    const rows = await qb.getMany();
    const byStatus = Object.fromEntries(
      Object.keys(DPR_STATUS_LABELS).map((s) => [s, rows.filter((r) => r.status === s).length]),
    );
    return {
      total: rows.length,
      hqPending: rows.filter((r) => ['hq_review', 'proposal_submitted'].includes(r.status)).length,
      returnedFromHq: rows.filter((r) => r.status === 'proposal_returned').length,
      dprPreparationInProgress: rows.filter((r) => ['dpr_prep_approved', 'dpr_preparation'].includes(r.status)).length,
      sanctioned: rows.filter((r) => ['sanctioned', 'tender_prep_initiated', 'tender_processing', 'tender_published'].includes(r.status)).length,
      tacPending: rows.filter((r) => r.status.includes('tac') && !r.status.includes('cleared') && !r.status.includes('final') && !r.status.includes('concurrence')).length,
      secretariatPending: rows.filter((r) => r.status === 'secretariat_submitted').length,
      tacRound2Pending: rows.filter((r) =>
        ['tac_round2_review', 'tac_round2_corrections_required', 'tac_round2_compliance', 'tac_round2_compliance_submitted'].includes(r.status),
      ).length,
      govtConcurrencePending: rows.filter((r) => r.status === 'govt_technical_concurrence').length,
      tenderPrepPending: rows.filter((r) => r.status === 'sanctioned').length,
      tenderInProgress: rows.filter((r) => ['tender_prep_initiated', 'tender_processing'].includes(r.status)).length,
      byStatus,
      recent: await Promise.all(rows.slice(0, 10).map((r) => this.toRecord(tenantId, r))),
    };
  }

  async listProposals(tenantId: string, user: JwtPayload, filters: { divisionId?: string; status?: string }) {
    const qb = this.proposalRepo.createQueryBuilder('p')
      .where('p.tenant_id = :tenantId', { tenantId })
      .orderBy('p.updated_at', 'DESC')
      .take(200);
    await this.divisionAccess.applyDivisionScope(qb, user, 'p', tenantId);
    if (filters.divisionId) qb.andWhere('p.division_id = :divisionId', { divisionId: filters.divisionId });
    if (filters.status) qb.andWhere('p.status = :status', { status: filters.status });
    const rows = await qb.getMany();
    return Promise.all(rows.map((r) => this.toRecord(tenantId, r, false, user.roles ?? [])));
  }

  async getProposal(tenantId: string, id: string, roles: string[] = [], userId?: string) {
    const row = await this.proposalRepo.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('DPR proposal not found');
    if (userId && (isSecretariatReviewer(roles) || isSuperAdmin(roles))) {
      const needsTac1Snap = [
        'secretariat_submitted',
        'tac_round2_review',
      ].includes(row.status)
        && this.getRound2ExaminationDocumentMode(row) === 'tac1_official';
      if (needsTac1Snap) {
        const docs = await this.docRepo.find({ where: { tenantId, proposalId: id } });
        await this.ensureTac1OfficialSnapshot(tenantId, userId, row, docs);
        await this.proposalRepo.save(row);
      }
    }
    return this.toRecord(tenantId, row, true, roles);
  }

  async saveStage3HqRemarks(
    tenantId: string,
    userId: string,
    roles: string[],
    proposalId: string,
    dto: Stage3HqRemarksDto,
  ) {
    const proposal = await this.requireProposal(tenantId, proposalId);
    if (!['dpr_prep_approved', 'dpr_preparation'].includes(proposal.status)) {
      throw new BadRequestException('State review remarks can only be added while DPR preparation is in progress');
    }
    this.assertCanCommentStage3(roles);

    const existing = (proposal.hqVerification as Record<string, unknown> | null) ?? {};
    proposal.hqVerification = {
      ...existing,
      stage3Remarks: dto.remarks.trim(),
      stage3RemarksBy: userId,
      stage3RemarksAt: new Date().toISOString(),
    };
    const saved = await this.proposalRepo.save(proposal);
    const actorRole = roles.find((r) => r !== 'super_admin') ?? roles[0] ?? null;
    await this.logEvent(
      tenantId,
      proposalId,
      3,
      'stage3_hq_remarks',
      proposal.status,
      saved.status,
      userId,
      actorRole,
      dto.remarks.trim(),
    );
    return this.toRecord(tenantId, saved, true, roles);
  }

  async createProposal(
    tenantId: string,
    userId: string,
    divisionId: string | null | undefined,
    roles: string[],
    dto: CreateDprProposalDto,
  ) {
    this.assertCanPlatformInitiate(roles);
    const resolvedDivisionId = dto.divisionId ?? divisionId ?? null;
    if (!resolvedDivisionId) {
      throw new BadRequestException(
        isSuperAdmin(roles)
          ? 'Select a field division before initiating a DPR proposal'
          : 'Division EE must be assigned to a division to initiate a DPR proposal',
      );
    }

    const count = await this.proposalRepo.count({ where: { tenantId } });
    const fy = this.currentFinancialYear();
    const divCode = resolvedDivisionId ? await this.getDivisionCode(resolvedDivisionId) : 'HQ';
    const proposalNo = `DPRP-${fy}-${divCode}-${String(count + 1).padStart(4, '0')}`;

    const record = this.proposalRepo.create({
      tenantId,
      proposalNo,
      title: dto.title.trim(),
      divisionId: resolvedDivisionId,
      initiatedBy: userId,
      currentStage: 1,
      status: 'proposal_draft',
      schemeJustification: dto.schemeJustification?.trim() ?? null,
      preliminaryEstimate: dto.preliminaryEstimate ?? null,
      fundingSource: dto.fundingSource?.trim() ?? null,
      priority: dto.priority ?? 'medium',
      gisBoundary: dto.gisBoundary ?? null,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
    });
    const saved = await this.proposalRepo.save(record);
    const initLabel = isSuperAdmin(roles)
      ? 'Proposal initiated by Super Admin (platform setup)'
      : 'Proposal initiated by Division EE';
    await this.logEvent(tenantId, saved.id, 1, 'create', null, saved.status, userId, null, initLabel);
    return this.toRecord(tenantId, saved, true);
  }

  async updateProposal(
    tenantId: string,
    userId: string,
    roles: string[],
    proposalId: string,
    dto: UpdateDprProposalDto,
  ) {
    const proposal = await this.requireProposal(tenantId, proposalId);
    this.assertEditableDraft(proposal);
    this.assertCanInitiate(roles);

    if (dto.schemeJustification !== undefined) proposal.schemeJustification = dto.schemeJustification.trim() || null;
    if (dto.preliminaryEstimate !== undefined) proposal.preliminaryEstimate = dto.preliminaryEstimate;
    if (dto.fundingSource !== undefined) proposal.fundingSource = dto.fundingSource.trim() || null;
    if (dto.priority !== undefined) proposal.priority = dto.priority;
    if (dto.gisBoundary !== undefined) proposal.gisBoundary = dto.gisBoundary;
    if (dto.latitude !== undefined) proposal.latitude = dto.latitude;
    if (dto.longitude !== undefined) proposal.longitude = dto.longitude;

    const saved = await this.proposalRepo.save(proposal);
    await this.logEvent(tenantId, proposalId, 1, 'update_draft', proposal.status, saved.status, userId, null, 'Draft updated');
    return this.toRecord(tenantId, saved, true);
  }

  async submitToHq(
    tenantId: string,
    userId: string,
    roles: string[],
    proposalId: string,
    dto: SubmitDprProposalDto,
  ) {
    const proposal = await this.requireProposal(tenantId, proposalId);
    if (!['proposal_draft', 'proposal_returned'].includes(proposal.status)) {
      throw new BadRequestException('Only draft or returned proposals can be forwarded for review');
    }
    this.assertCanInitiate(roles);
    await this.assertStage1Ready(tenantId, proposal);

    const fromStatus = proposal.status;
    proposal.status = 'hq_review';
    proposal.currentStage = 2;
    if (dto.comments?.trim()) proposal.hqRemarks = dto.comments.trim();

    const saved = await this.proposalRepo.save(proposal);
    const actorRole = roles.find((r) => r !== 'super_admin') ?? roles[0] ?? null;
    await this.logEvent(
      tenantId,
      proposalId,
      2,
      'submit',
      fromStatus,
      saved.status,
      userId,
      actorRole,
      dto.comments ?? 'Forwarded for DPR preparation approval',
    );
    return this.toRecord(tenantId, saved, true);
  }

  async reviewByHq(
    tenantId: string,
    userId: string,
    roles: string[],
    proposalId: string,
    dto: HqReviewDprProposalDto,
  ) {
    const proposal = await this.requireProposal(tenantId, proposalId);
    if (!['hq_review', 'proposal_submitted'].includes(proposal.status)) {
      throw new BadRequestException('Proposal is not awaiting state review');
    }
    this.assertCanReviewHq(roles);

    const action = dto.action === 'return_to_division' ? 'return' : dto.action;

    const verification = {
      needAssessment: !!dto.needAssessment,
      budgetAvailability: !!dto.budgetAvailability,
      schemePriority: !!dto.schemePriority,
      fundingSource: !!dto.fundingSource,
      verifiedBy: userId,
      verifiedAt: new Date().toISOString(),
    };
    proposal.hqVerification = verification;
    proposal.hqReviewedBy = userId;
    proposal.hqReviewedAt = new Date();
    if (dto.remarks?.trim()) proposal.hqRemarks = dto.remarks.trim();

    const fromStatus = proposal.status;
    let toStatus: string;
    let stage: number;
    let eventAction: string;
    let eventComments: string | undefined;

    if (action === 'approve') {
      const missing = DPR_HQ_VERIFICATION_ITEMS.filter((item) => !verification[item.key]);
      if (missing.length) {
        throw new BadRequestException(
          `All verification items must be confirmed before approval: ${missing.map((m) => m.label).join(', ')}`,
        );
      }
      const orderNo = await this.generatePrepOrderNo(tenantId);
      proposal.dprPrepOrderNo = orderNo;
      proposal.dprPrepOrderIssuedAt = new Date();
      toStatus = 'dpr_prep_approved';
      stage = 3;
      eventAction = 'hq_approve';
      eventComments = dto.remarks ?? `DPR Preparation Order ${orderNo} issued`;
    } else if (action === 'return') {
      if (!dto.remarks?.trim()) {
        throw new BadRequestException('Remarks are required when returning proposal to Division EE');
      }
      toStatus = 'proposal_returned';
      stage = 1;
      eventAction = 'hq_return';
      eventComments = dto.remarks;
    } else {
      if (!dto.remarks?.trim()) {
        throw new BadRequestException('Remarks are required when rejecting a proposal');
      }
      toStatus = 'proposal_rejected';
      stage = 1;
      eventAction = 'hq_reject';
      eventComments = dto.remarks;
    }

    proposal.status = toStatus;
    proposal.currentStage = stage;
    const saved = await this.proposalRepo.save(proposal);
    const actorRole = roles.find((r) => r !== 'super_admin') ?? roles[0] ?? null;
    await this.logEvent(
      tenantId,
      proposalId,
      stage,
      eventAction,
      fromStatus,
      saved.status,
      userId,
      actorRole,
      eventComments,
      action === 'approve' ? { dprPrepOrderNo: saved.dprPrepOrderNo } : undefined,
    );
    return this.toRecord(tenantId, saved, true);
  }

  async forwardToTac(
    tenantId: string,
    userId: string,
    roles: string[],
    proposalId: string,
    dto: ForwardToTacDto,
  ) {
    const proposal = await this.requireProposal(tenantId, proposalId);
    if (proposal.status !== 'dpr_submitted') {
      throw new BadRequestException('Completed DPR must be submitted before forwarding to TAC Section');
    }
    this.assertCanForwardToTac(roles);
    await this.assertTacPackageReady(tenantId, proposal);

    const fromStatus = proposal.status;
    proposal.status = 'tac_round1_review';
    proposal.currentStage = 4;
    if (dto.comments?.trim()) proposal.tacRound1Remarks = dto.comments.trim();

    const saved = await this.proposalRepo.save(proposal);
    const actorRole = roles.find((r) => r !== 'super_admin') ?? roles[0] ?? null;
    await this.logEvent(
      tenantId,
      proposalId,
      4,
      'forward_tac',
      fromStatus,
      saved.status,
      userId,
      actorRole,
      dto.comments ?? 'Completed DPR forwarded to TAC Section for Round 1 review',
    );
    return this.toRecord(tenantId, saved, true, roles);
  }

  async forwardToSecretariat(
    tenantId: string,
    userId: string,
    roles: string[],
    proposalId: string,
    dto: ForwardToSecretariatDto,
  ) {
    const proposal = await this.requireProposal(tenantId, proposalId);
    if (!['tac_round1_cleared', 'tac_round1_final'].includes(proposal.status)) {
      throw new BadRequestException('Only TAC-cleared DPR can be forwarded to Secretariat / Sachiwalaya');
    }
    this.assertCanForwardToSecretariat(roles);

    const documents = await this.docRepo.find({ where: { tenantId, proposalId } });
    const readiness = await this.buildStage6Readiness(tenantId, proposal, documents, roles);
    if (!readiness?.canForward) {
      const missing = (readiness?.missingAttachments ?? []).join(', ');
      throw new BadRequestException(
        missing
          ? `Cannot forward to Secretariat — missing: ${missing}`
          : 'Cannot forward to Secretariat — package incomplete',
      );
    }

    const fromStatus = proposal.status;
    const forwardedAt = new Date();
    const attachmentSummary = readiness.attachments.reduce((acc, a) => {
      acc[a.key] = a.attached;
      return acc;
    }, {} as Record<string, boolean>);

    const existingHq = (proposal.hqVerification ?? {}) as Record<string, unknown>;
    proposal.hqVerification = {
      ...existingHq,
      secretariatSubmission: {
        secretariatRef: dto.secretariatRef.trim(),
        receivingAuthority: dto.receivingAuthority.trim(),
        forwardedAt: forwardedAt.toISOString(),
        forwardedBy: userId,
        comments: dto.comments?.trim() ?? null,
        fundingRequirementNotes: dto.fundingRequirementNotes?.trim() ?? null,
        preliminaryEstimate: proposal.preliminaryEstimate,
        fundingSource: proposal.fundingSource,
        attachmentSummary,
        tacRecommendations: readiness.tacRecommendations,
      },
    };

    proposal.secretariatRef = dto.secretariatRef.trim();
    proposal.secretariatForwardedAt = forwardedAt;
    proposal.status = 'secretariat_submitted';
    proposal.currentStage = 6;

    const saved = await this.proposalRepo.save(proposal);
    const actorRole = roles.find((r) => r !== 'super_admin') ?? roles[0] ?? null;
    await this.logEvent(
      tenantId,
      proposalId,
      6,
      'forward_secretariat',
      fromStatus,
      saved.status,
      userId,
      actorRole,
      dto.comments ?? `Forwarded to ${dto.receivingAuthority.trim()} (Ref: ${dto.secretariatRef.trim()})`,
      {
        secretariatRef: dto.secretariatRef.trim(),
        receivingAuthority: dto.receivingAuthority.trim(),
        forwardedAt: forwardedAt.toISOString(),
      },
    );
    return this.toRecord(tenantId, saved, true, roles);
  }

  async beginTacRound2Examination(
    tenantId: string,
    userId: string,
    roles: string[],
    proposalId: string,
    dto: BeginTacRound2ExaminationDto,
  ) {
    const proposal = await this.requireProposal(tenantId, proposalId);
    if (proposal.status !== 'secretariat_submitted') {
      throw new BadRequestException('Round 2 examination can only begin after Secretariat submission');
    }
    this.assertCanReviewTacRound2(roles);
    const docs = await this.docRepo.find({ where: { tenantId, proposalId } });
    if (this.getRound2ExaminationDocumentMode(proposal) === 'tac1_official') {
      await this.ensureTac1OfficialSnapshot(tenantId, userId, proposal, docs);
      await this.proposalRepo.save(proposal);
    }
    const docsForAssert = await this.docRepo.find({ where: { tenantId, proposalId } });
    await this.assertRound2ExaminationDocumentsReady(tenantId, proposal, docsForAssert);

    const fromStatus = proposal.status;
    const startedAt = new Date();
    const existingHq = (proposal.hqVerification ?? {}) as Record<string, unknown>;
    proposal.hqVerification = {
      ...existingHq,
      tacRound2: {
        ...((existingHq.tacRound2 ?? {}) as Record<string, unknown>),
        examinationDocumentMode: 'tac1_official',
        examination: {
          committeeRef: dto.committeeRef?.trim() ?? null,
          examiningAuthority: dto.examiningAuthority?.trim() ?? 'Secretariat / Govt TAC Committee',
          startedAt: startedAt.toISOString(),
          startedBy: userId,
          comments: dto.comments?.trim() ?? null,
        },
      },
    };

    proposal.status = 'tac_round2_review';
    proposal.currentStage = 7;
    if (dto.comments?.trim()) proposal.tacRound2Remarks = dto.comments.trim();

    const saved = await this.proposalRepo.save(proposal);
    const actorRole = roles.find((r) => r !== 'super_admin') ?? roles[0] ?? null;
    await this.logEvent(
      tenantId,
      proposalId,
      7,
      'begin_tac_round2',
      fromStatus,
      saved.status,
      userId,
      actorRole,
      dto.comments ?? 'Second Round TAC / Govt technical examination commenced',
      {
        committeeRef: dto.committeeRef?.trim() ?? null,
        examiningAuthority: dto.examiningAuthority?.trim() ?? null,
      },
    );
    return this.toRecord(tenantId, saved, true, roles);
  }

  async reviewByTacRound2(
    tenantId: string,
    userId: string,
    roles: string[],
    proposalId: string,
    dto: TacRound2ReviewDto,
  ) {
    const proposal = await this.requireProposal(tenantId, proposalId);
    if (proposal.status !== 'tac_round2_review') {
      throw new BadRequestException('Proposal is not awaiting Round 2 TAC / Govt technical examination');
    }
    this.assertCanReviewTacRound2(roles);
    const docs = await this.docRepo.find({ where: { tenantId, proposalId } });
    if (this.getRound2ExaminationDocumentMode(proposal) === 'tac1_official') {
      await this.ensureTac1OfficialSnapshot(tenantId, userId, proposal, docs);
      await this.proposalRepo.save(proposal);
      const docsRefreshed = await this.docRepo.find({ where: { tenantId, proposalId } });
      await this.assertRound2ExaminationDocumentsReady(tenantId, proposal, docsRefreshed);
    } else {
      await this.assertRound2ExaminationDocumentsReady(tenantId, proposal, docs);
    }

    const checklist = {
      technicalExamination: !!dto.technicalExamination,
      financialExamination: !!dto.financialExamination,
      costEstimateScrutiny: !!dto.costEstimateScrutiny,
      budgetFundProvisioning: !!dto.budgetFundProvisioning,
      boqFinancialCompliance: !!dto.boqFinancialCompliance,
      designStandardsCompliance: !!dto.designStandardsCompliance,
      envSocialClearances: !!dto.envSocialClearances,
      fundingRequirements: !!dto.fundingRequirements,
    };

    const existingHqV = (proposal.hqVerification ?? {}) as Record<string, unknown>;
    const existingTac2 = (existingHqV.tacRound2 ?? {}) as {
      observations?: Array<Record<string, unknown>>;
      complianceNotes?: string | null;
    };
    const observations = Array.isArray(existingTac2.observations) ? [...existingTac2.observations] : [];
    observations.push({
      at: new Date().toISOString(),
      by: userId,
      action: dto.action,
      remarks: dto.remarks?.trim() ?? null,
      complianceNotes: dto.complianceNotes?.trim() ?? null,
      complianceRequirements: dto.complianceNotes?.trim() ?? null,
      checklist: { ...checklist },
    });

    const reviewedAt = new Date().toISOString();
    proposal.hqVerification = {
      ...existingHqV,
      tacRound2: {
        ...existingTac2,
        checklist,
        complianceNotes: dto.complianceNotes?.trim() ?? existingTac2.complianceNotes ?? null,
        observations,
        lastAction: dto.action,
        reviewedBy: userId,
        reviewedAt,
      },
    };

    if (dto.remarks?.trim()) proposal.tacRound2Remarks = dto.remarks.trim();

    const fromStatus = proposal.status;
    let toStatus: string;
    let stage: number;
    let eventAction: string;
    let eventComments: string | undefined = dto.remarks?.trim() || undefined;

    if (dto.action === 'approve') {
      const missing = DPR_TAC_ROUND2_CHECKLIST.filter((item) => !checklist[item.key]);
      if (missing.length) {
        throw new BadRequestException(
          `All Round 2 examination items must be confirmed before concurrence: ${missing.map((m) => m.label).join(', ')}`,
        );
      }
      toStatus = 'govt_technical_concurrence';
      stage = 8;
      eventAction = 'tac_round2_concurrence';
      eventComments = dto.remarks ?? 'Government technical concurrence granted — Round 2 examination complete';
      const hq = (proposal.hqVerification ?? {}) as Record<string, unknown>;
      const tac2 = (hq.tacRound2 ?? {}) as Record<string, unknown>;
      proposal.hqVerification = {
        ...hq,
        tacRound2: {
          ...tac2,
          concurrenceGrantedAt: reviewedAt,
          concurrenceGrantedBy: userId,
        },
      };
    } else if (dto.action === 'suggest_corrections') {
      if (!dto.remarks?.trim()) {
        throw new BadRequestException('Remarks are required when requesting compliance submission');
      }
      toStatus = 'tac_round2_corrections_required';
      stage = 7;
      eventAction = 'tac_round2_request_compliance';
    } else if (dto.action === 'request_info') {
      if (!dto.remarks?.trim()) {
        throw new BadRequestException('Remarks are required when requesting additional information');
      }
      toStatus = 'tac_round2_review';
      stage = 7;
      eventAction = 'tac_round2_request_info';
    } else {
      if (!dto.remarks?.trim()) {
        throw new BadRequestException('Remarks are required when returning for major revision');
      }
      toStatus = 'tac_round2_corrections_required';
      stage = 7;
      eventAction = 'tac_round2_return_revision';
    }

    proposal.status = toStatus;
    proposal.currentStage = stage;
    const saved = await this.proposalRepo.save(proposal);
    const actorRole = roles.find((r) => r !== 'super_admin') ?? roles[0] ?? null;
    await this.logEvent(
      tenantId,
      proposalId,
      stage,
      eventAction,
      fromStatus,
      saved.status,
      userId,
      actorRole,
      eventComments,
      dto.complianceNotes?.trim() ? { complianceNotes: dto.complianceNotes.trim() } : undefined,
    );
    return this.toRecord(tenantId, saved, true, roles);
  }

  async beginRound2Compliance(
    tenantId: string,
    userId: string,
    roles: string[],
    proposalId: string,
  ) {
    const proposal = await this.requireProposal(tenantId, proposalId);
    if (proposal.status !== 'tac_round2_corrections_required') {
      throw new BadRequestException('Round 2 compliance can only begin when committee has requested compliance');
    }
    this.assertCanPrepare(roles);

    const fromStatus = proposal.status;
    proposal.status = 'tac_round2_compliance';
    proposal.currentStage = 7;
    proposal.hqVerification = this.acknowledgeEeComplianceAssignment(
      (proposal.hqVerification ?? {}) as Record<string, unknown>,
      userId,
    );
    const saved = await this.proposalRepo.save(proposal);
    const actorRole = roles.find((r) => r !== 'super_admin') ?? roles[0] ?? null;
    await this.logEvent(
      tenantId,
      proposalId,
      7,
      'begin_round2_compliance',
      fromStatus,
      saved.status,
      userId,
      actorRole,
      'DPR team commenced Round 2 compliance submission',
    );
    return this.toRecord(tenantId, saved, true, roles);
  }

  async assignRound2ComplianceToEe(
    tenantId: string,
    userId: string,
    roles: string[],
    proposalId: string,
    dto: AssignRound2ComplianceToEeDto,
  ) {
    if (!isSuperAdmin(roles)) {
      throw new ForbiddenException('Only Super Admin can assign Round 2 compliance tasks to division EE');
    }
    const proposal = await this.requireProposal(tenantId, proposalId);
    if (!DPR_ROUND2_COMPLIANCE_STATUSES.includes(proposal.status as typeof DPR_ROUND2_COMPLIANCE_STATUSES[number])) {
      throw new BadRequestException('EE assignment is only available when Secretariat compliance is required');
    }

    const existingHq = (proposal.hqVerification ?? {}) as Record<string, unknown>;
    const message = dto.message?.trim() || null;
    proposal.hqVerification = {
      ...existingHq,
      eeComplianceAssignment: {
        assignedBy: userId,
        assignedAt: new Date().toISOString(),
        message,
        acknowledgedAt: null,
        acknowledgedBy: null,
      },
    };

    const saved = await this.proposalRepo.save(proposal);
    await this.logEvent(
      tenantId,
      proposalId,
      7,
      'assign_round2_compliance_to_ee',
      proposal.status,
      saved.status,
      userId,
      'super_admin',
      message ?? 'Super Admin assigned Round 2 compliance submission to division EE',
      { message },
    );
    return this.toRecord(tenantId, saved, true, roles);
  }

  async submitRound2Compliance(
    tenantId: string,
    userId: string,
    roles: string[],
    proposalId: string,
    dto: SubmitRound2ComplianceDto,
  ) {
    const proposal = await this.requireProposal(tenantId, proposalId);
    if (!DPR_ROUND2_COMPLIANCE_STATUSES.includes(proposal.status as typeof DPR_ROUND2_COMPLIANCE_STATUSES[number])) {
      throw new BadRequestException('Round 2 compliance can only be submitted during Stage 7 compliance phase');
    }
    this.assertCanPrepare(roles);

    if (!dto.observationResponse?.trim()) {
      throw new BadRequestException('Describe how committee observations and compliance requirements were addressed');
    }

    const fromStatus = proposal.status;
    if (proposal.status === 'tac_round2_corrections_required') {
      proposal.status = 'tac_round2_compliance';
      proposal.currentStage = 7;
    }

    await this.assertRound2CompliancePackageReady(tenantId, proposal);

    const existingHq = (proposal.hqVerification ?? {}) as Record<string, unknown>;
    const existingCompliance = (existingHq.tacRound2Compliance ?? {}) as {
      responses?: Array<Record<string, unknown>>;
    };
    const responses = Array.isArray(existingCompliance.responses) ? [...existingCompliance.responses] : [];
    responses.push({
      at: new Date().toISOString(),
      by: userId,
      comments: dto.comments?.trim() ?? null,
      observationResponse: dto.observationResponse.trim(),
    });

    proposal.hqVerification = {
      ...existingHq,
      ...this.acknowledgeEeComplianceAssignment(existingHq, userId),
      tacRound2Compliance: {
        ...existingCompliance,
        responses,
        lastSubmittedAt: new Date().toISOString(),
        lastObservationResponse: dto.observationResponse.trim(),
      },
    };

    proposal.status = 'tac_round2_compliance_submitted';
    proposal.currentStage = 7;
    if (dto.comments?.trim()) proposal.tacRound2Remarks = dto.comments.trim();

    const saved = await this.proposalRepo.save(proposal);
    const actorRole = roles.find((r) => r !== 'super_admin') ?? roles[0] ?? null;
    await this.logEvent(
      tenantId,
      proposalId,
      7,
      'submit_round2_compliance',
      fromStatus,
      saved.status,
      userId,
      actorRole,
      dto.comments ?? 'Round 2 compliance submitted to Super Admin for online review',
      { observationResponse: dto.observationResponse.trim() },
    );
    return this.toRecord(tenantId, saved, true, roles);
  }

  async reviewRound2ComplianceByAdmin(
    tenantId: string,
    userId: string,
    roles: string[],
    proposalId: string,
    dto: ReviewRound2ComplianceAdminDto,
  ) {
    if (!isSuperAdmin(roles)) {
      throw new ForbiddenException('Only Super Admin can review and forward Round 2 compliance to Secretariat');
    }
    const proposal = await this.requireProposal(tenantId, proposalId);
    if (proposal.status !== 'tac_round2_compliance_submitted') {
      throw new BadRequestException('Round 2 compliance admin review is only available after division EE submission');
    }

    const documents = await this.docRepo.find({ where: { tenantId, proposalId } });
    const uploadedTypes = new Set(documents.map((d) => d.documentType));
    if (!uploadedTypes.has('dpr_complete_pdf') || !uploadedTypes.has('tac_round2_compliance')) {
      throw new BadRequestException('Revised DPR PDF and Round 2 compliance document must be uploaded before admin review');
    }

    const fromStatus = proposal.status;
    const existingHq = (proposal.hqVerification ?? {}) as Record<string, unknown>;
    const existingCompliance = (existingHq.tacRound2Compliance ?? {}) as Record<string, unknown>;
    const adminReview = {
      action: dto.action,
      remarks: dto.remarks?.trim() ?? null,
      reviewedBy: userId,
      reviewedAt: new Date().toISOString(),
    };

    if (dto.action === 'forward_secretariat') {
      proposal.status = 'tac_round2_review';
      proposal.currentStage = 7;
      const dprDoc = this.getLatestDocumentByType(documents, 'dpr_complete_pdf');
      const complianceDoc = this.getLatestDocumentByType(documents, 'tac_round2_compliance');
      const existingTac2 = (existingHq.tacRound2 ?? {}) as Record<string, unknown>;
      proposal.hqVerification = {
        ...existingHq,
        tacRound2: {
          ...existingTac2,
          examinationDocumentMode: 'ee_compliance_resubmit',
          eeCompliancePackage: {
            dprDocumentId: dprDoc?.id ?? null,
            complianceDocumentId: complianceDoc?.id ?? null,
            dprFileName: dprDoc?.fileName ?? null,
            complianceFileName: complianceDoc?.fileName ?? null,
            forwardedAt: new Date().toISOString(),
            forwardedBy: userId,
          },
        },
        tacRound2Compliance: {
          ...existingCompliance,
          adminReview,
          lastAdminAction: dto.action,
          lastAdminRemarks: dto.remarks?.trim() ?? null,
        },
      };
    } else {
      proposal.status = 'tac_round2_corrections_required';
      proposal.currentStage = 7;
      proposal.hqVerification = {
        ...existingHq,
        tacRound2Compliance: {
          ...existingCompliance,
          adminReview,
          lastAdminAction: dto.action,
          lastAdminRemarks: dto.remarks?.trim() ?? null,
        },
      };
    }
    if (dto.remarks?.trim()) proposal.tacRound2Remarks = dto.remarks.trim();

    const saved = await this.proposalRepo.save(proposal);
    const eventAction = dto.action === 'forward_secretariat'
      ? 'forward_round2_compliance_to_secretariat'
      : 'return_round2_compliance_to_ee';
    const eventMsg = dto.action === 'forward_secretariat'
      ? 'Super Admin reviewed compliance online and forwarded to Secretariat for Round 2 re-examination'
      : 'Super Admin returned Round 2 compliance to division EE for revision';
    await this.logEvent(
      tenantId,
      proposalId,
      7,
      eventAction,
      fromStatus,
      saved.status,
      userId,
      'super_admin',
      dto.remarks ?? eventMsg,
      { action: dto.action },
    );
    return this.toRecord(tenantId, saved, true, roles);
  }

  async exportTacRound2ComplianceReport(tenantId: string, proposalId: string): Promise<{
    buffer: Buffer;
    fileName: string;
  }> {
    const proposal = await this.requireProposal(tenantId, proposalId);
    const documents = await this.docRepo.find({ where: { tenantId, proposalId } });
    const tacState = await this.buildTacRound2ReviewState(tenantId, proposal, [...DPR_STATE_REVIEWER_ROLES], documents);
    const lines: string[] = [
      'TAC ROUND 2 — GOVT TECHNICAL EXAMINATION REPORT',
      '=================================================',
      `Proposal No: ${proposal.proposalNo}`,
      `Title: ${proposal.title}`,
      `Status: ${getDprStatusLabel(proposal.status)}`,
      `Generated: ${new Date().toISOString()}`,
      '',
      'TECHNICAL & FINANCIAL EXAMINATION CHECKLIST',
      '-------------------------------------------',
    ];
    for (const item of tacState.checklist) {
      lines.push(`[${item.reviewed ? 'X' : ' '}] ${item.label}`);
    }
    if (tacState.complianceNotes) {
      lines.push('', 'COMPLIANCE REQUIREMENTS', '-----------------------', tacState.complianceNotes);
    }
    if (proposal.tacRound2Remarks) {
      lines.push('', 'LATEST COMMITTEE REMARKS', '------------------------', proposal.tacRound2Remarks);
    }
    if (tacState.concurrenceGrantedAt) {
      lines.push('', 'GOVT TECHNICAL CONCURRENCE', '--------------------------', `Granted: ${tacState.concurrenceGrantedAt}`);
    }
    lines.push('', 'OBSERVATIONS & RECOMMENDATIONS', '------------------------------');
    const observations = tacState.observations as Array<{
      at?: string;
      action?: string;
      remarks?: string | null;
      complianceNotes?: string | null;
    }>;
    if (!observations.length) {
      lines.push('(No Round 2 observations recorded yet)');
    } else {
      observations.forEach((obs, i) => {
        lines.push(
          `${i + 1}. ${obs.at ? new Date(obs.at).toLocaleString('en-IN') : '—'} — ${DPR_TAC_ROUND2_ACTION_LABELS[obs.action as keyof typeof DPR_TAC_ROUND2_ACTION_LABELS] ?? obs.action ?? 'Action'}`,
        );
        if (obs.remarks) lines.push(`   Remarks: ${obs.remarks}`);
        if (obs.complianceNotes) lines.push(`   Compliance: ${obs.complianceNotes}`);
        lines.push('');
      });
    }
    const complianceResponses = tacState.complianceResponses as Array<{
      at?: string;
      observationResponse?: string | null;
      comments?: string | null;
    }>;
    if (complianceResponses.length) {
      lines.push('DPR TEAM COMPLIANCE SUBMISSIONS', '---------------------------------');
      complianceResponses.forEach((r, i) => {
        lines.push(`${i + 1}. ${r.at ? new Date(r.at).toLocaleString('en-IN') : '—'}`);
        if (r.observationResponse) lines.push(`   Response: ${r.observationResponse}`);
        if (r.comments) lines.push(`   Comments: ${r.comments}`);
        lines.push('');
      });
    }
    const safeNo = proposal.proposalNo.replace(/[^a-zA-Z0-9-_]/g, '_');
    return {
      buffer: Buffer.from(lines.join('\n'), 'utf-8'),
      fileName: `TAC-Round2-${safeNo}.txt`,
    };
  }

  async recordAdministrativeSanction(
    tenantId: string,
    userId: string,
    roles: string[],
    proposalId: string,
    dto: RecordAdministrativeSanctionDto,
  ) {
    const proposal = await this.requireProposal(tenantId, proposalId);
    if (proposal.status !== 'govt_technical_concurrence') {
      throw new BadRequestException('Administrative sanction can only be recorded after Government Technical Concurrence');
    }
    this.assertCanRecordSanction(roles);

    const documents = await this.docRepo.find({ where: { tenantId, proposalId } });
    const laReadiness = await this.landAcquisitionService.getReadinessForProposal(tenantId, proposalId);
    const readiness = this.buildStage8Readiness(proposal, documents, roles, null, laReadiness);
    if (!readiness?.canRecord) {
      const missing = [
        ...(readiness?.missingDocuments ?? []),
        ...(readiness?.laReadiness?.missingActions ?? []),
      ].filter(Boolean);
      throw new BadRequestException(
        missing.length
          ? `Cannot record sanction — ${missing.join('; ')}`
          : 'Cannot record sanction — requirements incomplete',
      );
    }

    if (!dto.administrativeApprovalNo?.trim() || !dto.expenditureSanctionNo?.trim()) {
      throw new BadRequestException('Both Administrative Approval (AA) and Expenditure Sanction (ES) numbers are required');
    }
    if (!dto.sanctionedAmount || Number(dto.sanctionedAmount) <= 0) {
      throw new BadRequestException('Approved sanctioned amount is required');
    }
    if (!dto.sanctionDate?.trim()) {
      throw new BadRequestException('Sanction date is required');
    }
    if (!dto.budgetHead?.trim()) {
      throw new BadRequestException('Budget allocation / budget head is required');
    }
    if (!dto.fundingReleaseRef?.trim()) {
      throw new BadRequestException('Funding release order reference is required');
    }

    const existing = await this.sanctionRepo.findOne({ where: { tenantId, proposalId } });
    const row = existing ?? this.sanctionRepo.create({ tenantId, proposalId });
    row.administrativeApprovalNo = dto.administrativeApprovalNo.trim();
    row.expenditureSanctionNo = dto.expenditureSanctionNo.trim();
    row.sanctionedAmount = dto.sanctionedAmount;
    row.budgetHead = dto.budgetHead.trim();
    row.sanctionDate = dto.sanctionDate.trim();
    row.fundingReleaseRef = dto.fundingReleaseRef.trim();
    row.recordedBy = userId;
    await this.sanctionRepo.save(row);

    const recordedAt = new Date().toISOString();
    const existingHq = (proposal.hqVerification ?? {}) as Record<string, unknown>;
    proposal.hqVerification = {
      ...existingHq,
      administrativeSanction: {
        administrativeApprovalNo: dto.administrativeApprovalNo.trim(),
        expenditureSanctionNo: dto.expenditureSanctionNo.trim(),
        sanctionedAmount: dto.sanctionedAmount,
        budgetHead: dto.budgetHead.trim(),
        sanctionDate: dto.sanctionDate.trim(),
        fundingReleaseRef: dto.fundingReleaseRef.trim(),
        recordedAt,
        recordedBy: userId,
        comments: dto.comments?.trim() ?? null,
        documentSummary: readiness.attachments.reduce((acc, a) => {
          acc[a.key] = a.attached;
          return acc;
        }, {} as Record<string, boolean>),
      },
    };

    const fromStatus = proposal.status;
    proposal.status = 'sanctioned';
    proposal.currentStage = 9;

    const saved = await this.proposalRepo.save(proposal);
    const actorRole = roles.find((r) => r !== 'super_admin') ?? roles[0] ?? null;
    await this.logEvent(
      tenantId,
      proposalId,
      8,
      'record_admin_sanction',
      fromStatus,
      saved.status,
      userId,
      actorRole,
      dto.comments ?? `Sanctioned — AA: ${dto.administrativeApprovalNo.trim()}, ES: ${dto.expenditureSanctionNo.trim()}`,
      {
        administrativeApprovalNo: dto.administrativeApprovalNo.trim(),
        expenditureSanctionNo: dto.expenditureSanctionNo.trim(),
        sanctionedAmount: dto.sanctionedAmount,
        sanctionDate: dto.sanctionDate.trim(),
      },
    );
    return this.toRecord(tenantId, saved, true, roles);
  }

  async initiateTenderPreparation(
    tenantId: string,
    userId: string,
    roles: string[],
    proposalId: string,
    dto: InitiateTenderPreparationDto,
  ) {
    const proposal = await this.requireProposal(tenantId, proposalId);
    if (proposal.status !== 'sanctioned') {
      throw new BadRequestException('Tender preparation can only be initiated after Administrative Sanction & Budget Approval');
    }
    this.assertCanInitiateTenderPrep(roles);

    const sanction = await this.sanctionRepo.findOne({ where: { tenantId, proposalId } });
    if (!sanction?.administrativeApprovalNo && !sanction?.expenditureSanctionNo) {
      throw new BadRequestException('Administrative sanction must be recorded before initiating tender preparation');
    }

    const checklist = {
      finalBoqPrep: !!dto.finalBoqPrep,
      sorVerification: !!dto.sorVerification,
      bidPackagePrep: !!dto.bidPackagePrep,
      techSpecsFinalization: !!dto.techSpecsFinalization,
      tenderDocGeneration: !!dto.tenderDocGeneration,
    };
    const missing = DPR_TENDER_PREP_CHECKLIST.filter((item) => !checklist[item.key]);
    if (missing.length) {
      throw new BadRequestException(
        `Confirm all division addressal items before initiating: ${missing.map((m) => m.label).join(', ')}`,
      );
    }

    const taskOrderNo = await this.generateTaskOrderNo(tenantId);
    const initiatedAt = new Date().toISOString();
    let divisionName: string | null = null;
    if (proposal.divisionId) {
      const div = await this.proposalRepo.query(
        'SELECT name FROM divisions WHERE id = $1 AND tenant_id = $2',
        [proposal.divisionId, tenantId],
      ) as Array<{ name?: string }>;
      divisionName = div[0]?.name ?? null;
    }

    const existingTender = await this.tenderRepo.findOne({ where: { tenantId, proposalId } });
    const count = await this.tenderRepo.count({ where: { tenantId } });
    const packageNo = existingTender?.packageNo ?? `TND-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
    const tender = existingTender ?? this.tenderRepo.create({ tenantId, proposalId, packageNo, status: 'prep_initiated' });
    tender.taskOrderRef = taskOrderNo;
    tender.status = 'prep_initiated';
    await this.tenderRepo.save(tender);

    const existingHq = (proposal.hqVerification ?? {}) as Record<string, unknown>;
    proposal.hqVerification = {
      ...existingHq,
      tenderInitiation: {
        taskOrderNo,
        packageNo,
        initiatedAt,
        initiatedBy: userId,
        divisionId: proposal.divisionId,
        divisionName,
        divisionInstructions: dto.divisionInstructions?.trim() ?? null,
        comments: dto.comments?.trim() ?? null,
        checklist,
        addressalItems: DPR_TENDER_PREP_CHECKLIST.map((item) => ({
          key: item.key,
          label: item.label,
          addressed: checklist[item.key],
        })),
        sanctionSummary: {
          administrativeApprovalNo: sanction.administrativeApprovalNo,
          expenditureSanctionNo: sanction.expenditureSanctionNo,
          sanctionedAmount: sanction.sanctionedAmount,
          budgetHead: sanction.budgetHead,
          sanctionDate: sanction.sanctionDate,
        },
      },
    };

    const fromStatus = proposal.status;
    proposal.status = 'tender_prep_initiated';
    proposal.currentStage = 9;

    const saved = await this.proposalRepo.save(proposal);
    const actorRole = roles.find((r) => r !== 'super_admin') ?? roles[0] ?? null;
    await this.logEvent(
      tenantId,
      proposalId,
      9,
      'initiate_tender_prep',
      fromStatus,
      saved.status,
      userId,
      actorRole,
      dto.comments ?? `Tender Preparation Task Order ${taskOrderNo} issued to ${divisionName ?? 'division'}`,
      { taskOrderNo, packageNo, divisionName },
    );
    return this.toRecord(tenantId, saved, true, roles);
  }

  async exportTenderTaskOrder(tenantId: string, proposalId: string): Promise<{
    buffer: Buffer;
    fileName: string;
  }> {
    const proposal = await this.requireProposal(tenantId, proposalId);
    const tender = await this.tenderRepo.findOne({ where: { tenantId, proposalId } });
    const sanction = await this.sanctionRepo.findOne({ where: { tenantId, proposalId } });
    const init = ((proposal.hqVerification ?? {}) as { tenderInitiation?: Record<string, unknown> }).tenderInitiation ?? {};

    const lines: string[] = [
      'TENDER PREPARATION TASK ORDER',
      '==============================',
      `Task Order No: ${(init.taskOrderNo as string) ?? tender?.taskOrderRef ?? '—'}`,
      `Tender Package: ${(init.packageNo as string) ?? tender?.packageNo ?? '—'}`,
      `Proposal No: ${proposal.proposalNo}`,
      `Title: ${proposal.title}`,
      `Division: ${(init.divisionName as string) ?? '—'}`,
      `Issued: ${(init.initiatedAt as string) ? new Date(init.initiatedAt as string).toLocaleString('en-IN') : '—'}`,
      '',
      'ADMINISTRATIVE SANCTION SUMMARY',
      '-------------------------------',
      `AA No: ${sanction?.administrativeApprovalNo ?? '—'}`,
      `ES No: ${sanction?.expenditureSanctionNo ?? '—'}`,
      `Sanctioned Amount: ${sanction?.sanctionedAmount ?? '—'}`,
      `Budget Head: ${sanction?.budgetHead ?? '—'}`,
      `Sanction Date: ${sanction?.sanctionDate ?? '—'}`,
      '',
      'HQ ADDRESSES CONCERNED DIVISION FOR',
      '-----------------------------------',
    ];
    const addressal = (init.addressalItems as Array<{ label?: string; addressed?: boolean }>) ?? [];
    if (addressal.length) {
      addressal.forEach((item) => lines.push(`[${item.addressed ? 'X' : ' '}] ${item.label ?? 'Item'}`));
    } else {
      DPR_TENDER_PREP_CHECKLIST.forEach((item) => lines.push(`[ ] ${item.label}`));
    }
    if (init.divisionInstructions) {
      lines.push('', 'DIVISION INSTRUCTIONS', '--------------------', String(init.divisionInstructions));
    }
    if (init.comments) {
      lines.push('', 'HQ REMARKS', '----------', String(init.comments));
    }
    const safeNo = proposal.proposalNo.replace(/[^a-zA-Z0-9-_]/g, '_');
    return {
      buffer: Buffer.from(lines.join('\n'), 'utf-8'),
      fileName: `TPO-${safeNo}.txt`,
    };
  }

  async beginTenderProcessing(
    tenantId: string,
    userId: string,
    roles: string[],
    proposalId: string,
    dto: BeginTenderProcessingDto,
  ) {
    const proposal = await this.requireProposal(tenantId, proposalId);
    if (proposal.status !== 'tender_prep_initiated') {
      throw new BadRequestException('Tender processing can only begin after tender preparation is initiated');
    }
    this.assertCanBeginTenderProcessing(roles);

    const documents = await this.docRepo.find({ where: { tenantId, proposalId } });
    const readiness = this.buildStage10Readiness(proposal, documents, roles);
    if ((readiness?.missingDocuments?.length ?? 0) > 0) {
      throw new BadRequestException(
        `Cannot begin tender processing — missing: ${(readiness?.missingDocuments ?? []).join(', ')}`,
      );
    }

    const existingHq = (proposal.hqVerification ?? {}) as Record<string, unknown>;
    proposal.hqVerification = {
      ...existingHq,
      tenderProcessing: {
        startedAt: new Date().toISOString(),
        startedBy: userId,
        comments: dto.comments?.trim() ?? null,
        approvalLevel: 'je',
        preparationComplete: true,
        approvals: [],
      },
    };

    const fromStatus = proposal.status;
    proposal.status = 'tender_processing';
    proposal.currentStage = 10;

    const saved = await this.proposalRepo.save(proposal);
    const actorRole = roles.find((r) => r !== 'super_admin') ?? roles[0] ?? null;
    await this.logEvent(
      tenantId,
      proposalId,
      10,
      'begin_tender_processing',
      fromStatus,
      saved.status,
      userId,
      actorRole,
      dto.comments ?? 'Tender processing commenced — JE verification pending',
    );
    return this.toRecord(tenantId, saved, true, roles);
  }

  async reviewTenderApproval(
    tenantId: string,
    userId: string,
    roles: string[],
    proposalId: string,
    dto: TenderApprovalReviewDto,
  ) {
    const proposal = await this.requireProposal(tenantId, proposalId);
    if (proposal.status !== 'tender_processing') {
      throw new BadRequestException('Tender approval actions apply only during tender processing');
    }

    const existingHq = (proposal.hqVerification ?? {}) as Record<string, unknown>;
    const tp = (existingHq.tenderProcessing ?? {}) as {
      approvalLevel?: string;
      approvals?: Array<Record<string, unknown>>;
    };
    const currentLevel = (tp.approvalLevel ?? 'je') as 'je' | 'ae' | 'ee' | 'cleared';
    if (currentLevel === 'cleared') {
      throw new BadRequestException('Tender already approved — ready to publish');
    }

    this.assertCanActTenderApproval(currentLevel, roles);

    if (dto.action === 'return' && !dto.remarks?.trim()) {
      throw new BadRequestException('Remarks are required when returning tender for correction');
    }

    const approvals = Array.isArray(tp.approvals) ? [...tp.approvals] : [];
    approvals.push({
      at: new Date().toISOString(),
      by: userId,
      level: currentLevel,
      action: dto.action,
      remarks: dto.remarks?.trim() ?? null,
    });

    let nextLevel: 'je' | 'ae' | 'ee' | 'cleared' = currentLevel;
    let eventAction = `tender_${currentLevel}_${dto.action}`;
    let eventComments = dto.remarks?.trim() || undefined;

    if (dto.action === 'return') {
      if (currentLevel === 'ee') nextLevel = 'ae';
      else if (currentLevel === 'ae') nextLevel = 'je';
      else nextLevel = 'je';
      eventComments = dto.remarks ?? `Returned at ${DPR_TENDER_APPROVAL_LABELS[currentLevel]}`;
    } else if (currentLevel === 'je' && (dto.action === 'verify' || dto.action === 'approve')) {
      nextLevel = 'ae';
      eventComments = dto.remarks ?? 'JE verification complete — forwarded to AE';
    } else if (currentLevel === 'ae' && dto.action === 'approve') {
      nextLevel = 'ee';
      eventComments = dto.remarks ?? 'AE review complete — forwarded to EE';
    } else if (currentLevel === 'ee' && dto.action === 'approve') {
      nextLevel = 'cleared';
      eventComments = dto.remarks ?? 'EE approval granted — tender ready to publish';
    } else {
      throw new BadRequestException(`Action "${dto.action}" is not valid for ${DPR_TENDER_APPROVAL_LABELS[currentLevel]}`);
    }

    proposal.hqVerification = {
      ...existingHq,
      tenderProcessing: {
        ...tp,
        approvalLevel: nextLevel,
        approvals,
        lastAction: dto.action,
        lastActionAt: new Date().toISOString(),
        lastActionBy: userId,
      },
    };

    const saved = await this.proposalRepo.save(proposal);
    const actorRole = roles.find((r) => r !== 'super_admin') ?? roles[0] ?? null;
    await this.logEvent(
      tenantId,
      proposalId,
      10,
      eventAction,
      proposal.status,
      saved.status,
      userId,
      actorRole,
      eventComments,
      { fromLevel: currentLevel, toLevel: nextLevel },
    );
    return this.toRecord(tenantId, saved, true, roles);
  }

  async publishTenderProposal(
    tenantId: string,
    userId: string,
    roles: string[],
    proposalId: string,
    dto: PublishTenderDto,
  ) {
    const proposal = await this.requireProposal(tenantId, proposalId);
    if (proposal.status !== 'tender_processing') {
      throw new BadRequestException('Tender can only be published during tender processing');
    }

    const tp = ((proposal.hqVerification ?? {}) as { tenderProcessing?: { approvalLevel?: string } }).tenderProcessing;
    if (tp?.approvalLevel !== 'cleared') {
      throw new BadRequestException('Tender must complete JE → AE → EE approval before publishing');
    }
    this.assertCanPublishTender(roles);

    const documents = await this.docRepo.find({ where: { tenantId, proposalId } });
    if (!documents.some((d) => d.documentType === 'nit')) {
      throw new BadRequestException('NIT document must be uploaded before publishing tender');
    }

    await this.publishTender(tenantId, proposalId, dto.nitRef);

    const fromStatus = proposal.status;
    proposal.status = 'tender_published';
    proposal.currentStage = 10;

    const saved = await this.proposalRepo.save(proposal);
    const actorRole = roles.find((r) => r !== 'super_admin') ?? roles[0] ?? null;
    await this.logEvent(
      tenantId,
      proposalId,
      10,
      'publish_tender',
      fromStatus,
      saved.status,
      userId,
      actorRole,
      dto.comments ?? 'Tender published',
      dto.nitRef?.trim() ? { nitRef: dto.nitRef.trim() } : undefined,
    );
    return this.toRecord(tenantId, saved, true, roles);
  }

  async reviewByTac(
    tenantId: string,
    userId: string,
    roles: string[],
    proposalId: string,
    dto: TacReviewDprProposalDto,
  ) {
    const proposal = await this.requireProposal(tenantId, proposalId);
    if (proposal.status !== 'tac_round1_review') {
      throw new BadRequestException('Proposal is not awaiting TAC Round 1 review');
    }
    this.assertCanReviewTac(roles);

    const checklist = {
      technicalFeasibility: !!dto.technicalFeasibility,
      designStandards: !!dto.designStandards,
      hydraulicCalculations: !!dto.hydraulicCalculations,
      costEstimates: !!dto.costEstimates,
      boqQuantities: !!dto.boqQuantities,
      drawingsLayouts: !!dto.drawingsLayouts,
    };

    const existingHqV = (proposal.hqVerification ?? {}) as Record<string, unknown>;
    const existingTac = (existingHqV.tacRound1 ?? {}) as {
      observations?: Array<Record<string, unknown>>;
      complianceNotes?: string | null;
    };
    const observations = Array.isArray(existingTac.observations) ? [...existingTac.observations] : [];
    observations.push({
      at: new Date().toISOString(),
      by: userId,
      action: dto.action,
      remarks: dto.remarks?.trim() ?? null,
      complianceNotes: dto.complianceNotes?.trim() ?? null,
      checklist: { ...checklist },
    });

    proposal.hqVerification = {
      ...existingHqV,
      tacRound1: {
        checklist,
        complianceNotes: dto.complianceNotes?.trim() ?? existingTac.complianceNotes ?? null,
        observations,
        lastAction: dto.action,
        reviewedBy: userId,
        reviewedAt: new Date().toISOString(),
      },
    };

    if (dto.action === 'approve') {
      const docs = await this.docRepo.find({ where: { tenantId, proposalId } });
      const source = await this.resolveTac1ReviewedSourceDocument(tenantId, proposal, docs);
      if (source) {
        const tacRound1 = (proposal.hqVerification as { tacRound1?: Record<string, unknown> }).tacRound1 ?? {};
        (proposal.hqVerification as { tacRound1: Record<string, unknown> }).tacRound1 = {
          ...tacRound1,
          reviewedDocumentId: source.id,
        };
      }
      await this.ensureTac1OfficialSnapshot(tenantId, userId, proposal, docs);
    }

    if (dto.remarks?.trim()) proposal.tacRound1Remarks = dto.remarks.trim();

    const fromStatus = proposal.status;
    let toStatus: string;
    let stage: number;
    let eventAction: string;
    let eventComments: string | undefined = dto.remarks?.trim() || undefined;

    if (dto.action === 'approve') {
      const missing = DPR_TAC_ROUND1_CHECKLIST.filter((item) => !checklist[item.key]);
      if (missing.length) {
        throw new BadRequestException(
          `All TAC review items must be confirmed before approval: ${missing.map((m) => m.label).join(', ')}`,
        );
      }
      toStatus = 'tac_round1_cleared';
      stage = 6;
      eventAction = 'tac_approve';
      eventComments = dto.remarks ?? 'TAC Round 1 — Approved (TAC Cleared – First Stage)';
    } else if (dto.action === 'suggest_corrections') {
      if (!dto.remarks?.trim()) {
        throw new BadRequestException('Remarks are required when suggesting corrections');
      }
      toStatus = 'tac_corrections_required';
      stage = 5;
      eventAction = 'tac_suggest_corrections';
    } else if (dto.action === 'request_info') {
      if (!dto.remarks?.trim()) {
        throw new BadRequestException('Remarks are required when requesting additional information');
      }
      toStatus = 'tac_round1_review';
      stage = 4;
      eventAction = 'tac_request_info';
    } else {
      if (!dto.remarks?.trim()) {
        throw new BadRequestException('Remarks are required when returning DPR for revision');
      }
      toStatus = 'dpr_revision';
      stage = 5;
      eventAction = 'tac_return_revision';
    }

    proposal.status = toStatus;
    proposal.currentStage = stage;
    const saved = await this.proposalRepo.save(proposal);
    const actorRole = roles.find((r) => r !== 'super_admin') ?? roles[0] ?? null;
    await this.logEvent(
      tenantId,
      proposalId,
      stage,
      eventAction,
      fromStatus,
      saved.status,
      userId,
      actorRole,
      eventComments,
      dto.complianceNotes?.trim() ? { complianceNotes: dto.complianceNotes.trim() } : undefined,
    );
    return this.toRecord(tenantId, saved, true, roles);
  }

  async exportTacComplianceReport(tenantId: string, proposalId: string): Promise<{
    buffer: Buffer;
    fileName: string;
  }> {
    const proposal = await this.requireProposal(tenantId, proposalId);
    const tacState = this.buildTacReviewState(proposal, [...DPR_STATE_REVIEWER_ROLES]);
    const lines: string[] = [
      'TAC ROUND 1 — COMPLIANCE & OBSERVATIONS REPORT',
      '================================================',
      `Proposal No: ${proposal.proposalNo}`,
      `Title: ${proposal.title}`,
      `Status: ${getDprStatusLabel(proposal.status)}`,
      `Generated: ${new Date().toISOString()}`,
      '',
      'TECHNICAL REVIEW CHECKLIST',
      '--------------------------',
    ];
    for (const item of tacState.checklist) {
      lines.push(`[${item.reviewed ? 'X' : ' '}] ${item.label}`);
    }
    if (tacState.complianceNotes) {
      lines.push('', 'COMPLIANCE NOTES', '----------------', tacState.complianceNotes);
    }
    if (proposal.tacRound1Remarks) {
      lines.push('', 'LATEST TAC REMARKS', '------------------', proposal.tacRound1Remarks);
    }
    lines.push('', 'WORKFLOW OBSERVATIONS', '---------------------');
    const observations = tacState.observations as Array<{
      at?: string;
      action?: string;
      remarks?: string | null;
      complianceNotes?: string | null;
    }>;
    if (!observations.length) {
      lines.push('(No TAC observations recorded yet)');
    } else {
      observations.forEach((obs, i) => {
        lines.push(
          `${i + 1}. ${obs.at ? new Date(obs.at).toLocaleString('en-IN') : '—'} — ${DPR_TAC_ACTION_LABELS[obs.action as keyof typeof DPR_TAC_ACTION_LABELS] ?? obs.action ?? 'Action'}`,
        );
        if (obs.remarks) lines.push(`   Remarks: ${obs.remarks}`);
        if (obs.complianceNotes) lines.push(`   Compliance: ${obs.complianceNotes}`);
        lines.push('');
      });
    }
    const events = await this.eventRepo.find({
      where: { tenantId, proposalId },
      order: { createdAt: 'ASC' },
    });
    const tacEvents = events.filter((e) => e.action.startsWith('tac_') || e.action === 'forward_tac');
    if (tacEvents.length) {
      lines.push('WORKFLOW EVENT LOG', '------------------');
      for (const ev of tacEvents) {
        lines.push(
          `${ev.createdAt.toISOString()} | ${ev.action} | ${ev.fromStatus} → ${ev.toStatus}${ev.comments ? ` | ${ev.comments}` : ''}`,
        );
      }
    }
    const safeNo = proposal.proposalNo.replace(/[^a-zA-Z0-9-_]/g, '_');
    return {
      buffer: Buffer.from(lines.join('\n'), 'utf-8'),
      fileName: `TAC-Compliance-${safeNo}.txt`,
    };
  }

  async listDocuments(tenantId: string, proposalId: string) {
    await this.requireProposal(tenantId, proposalId);
    const docs = await this.docRepo.find({
      where: { tenantId, proposalId },
      order: { documentType: 'ASC', versionNo: 'DESC' },
    });
    return {
      slots: this.buildDocumentSlots(docs),
      versionHistory: this.buildDocumentVersionHistory(docs),
    };
  }

  async listDocumentVersions(tenantId: string, proposalId: string, documentType: string) {
    await this.requireProposal(tenantId, proposalId);
    const rows = await this.docRepo.find({
      where: { tenantId, proposalId, documentType },
      order: { versionNo: 'DESC' },
    });
    return rows.map((d) => ({
      id: d.id,
      documentType: d.documentType,
      fileName: d.fileName,
      fileUrl: d.fileUrl,
      versionNo: d.versionNo,
      remarks: d.remarks,
      uploadedBy: d.uploadedBy,
      uploadedAt: d.createdAt,
    }));
  }

  async beginDprPreparation(
    tenantId: string,
    userId: string,
    roles: string[],
    proposalId: string,
  ) {
    const proposal = await this.requireProposal(tenantId, proposalId);
    if (proposal.status !== 'dpr_prep_approved') {
      throw new BadRequestException('DPR preparation can only begin after state approval');
    }
    this.assertCanPrepare(roles);

    const fromStatus = proposal.status;
    proposal.status = 'dpr_preparation';
    proposal.currentStage = 3;
    const saved = await this.proposalRepo.save(proposal);
    const actorRole = roles.find((r) => r !== 'super_admin') ?? roles[0] ?? null;
    await this.logEvent(
      tenantId,
      proposalId,
      3,
      'begin_preparation',
      fromStatus,
      saved.status,
      userId,
      actorRole,
      `DPR preparation commenced${saved.dprPrepOrderNo ? ` under order ${saved.dprPrepOrderNo}` : ''}`,
    );
    return this.toRecord(tenantId, saved, true);
  }

  async submitDprToHq(
    tenantId: string,
    userId: string,
    roles: string[],
    proposalId: string,
    dto: SubmitDprToHqDto,
  ) {
    const proposal = await this.requireProposal(tenantId, proposalId);
    if (!['dpr_prep_approved', 'dpr_preparation'].includes(proposal.status)) {
      throw new BadRequestException('Only proposals in DPR preparation can be submitted to TAC');
    }
    this.assertCanPrepare(roles);

    const fromStatus = proposal.status;
    if (proposal.status === 'dpr_prep_approved') {
      proposal.status = 'dpr_preparation';
      proposal.currentStage = 3;
    }

    await this.assertStage3Ready(tenantId, proposal);
    await this.assertTacPackageReady(tenantId, proposal);

    const mode = 'excel_auto' as const;

    const existingHq = (proposal.hqVerification ?? {}) as Record<string, unknown>;
    const existingTac = (existingHq.tacPackage ?? {}) as Record<string, unknown>;
    proposal.hqVerification = {
      ...existingHq,
      tacPackage: {
        ...existingTac,
        validationMode: mode,
        submittedAt: new Date().toISOString(),
      },
    };
    if (dto.comments?.trim()) {
      proposal.hqRemarks = dto.comments.trim();
    }

    const directToTac = true;
    proposal.status = directToTac ? 'tac_round1_review' : 'dpr_submitted';
    proposal.currentStage = 4;
    if (directToTac && dto.comments?.trim()) {
      proposal.tacRound1Remarks = dto.comments.trim();
    }

    const saved = await this.proposalRepo.save(proposal);
    const actorRole = roles.find((r) => r !== 'super_admin') ?? roles[0] ?? null;
    await this.logEvent(
      tenantId,
      proposalId,
      4,
      directToTac ? 'forward_tac' : 'submit_dpr',
      fromStatus,
      saved.status,
      userId,
      actorRole,
      dto.comments ?? (directToTac
        ? 'DPR submitted to TAC after BOQ auto-validation'
        : 'Completed DPR submitted for TAC review'),
    );
    return this.toRecord(tenantId, saved, true, roles);
  }

  async beginDprRevision(
    tenantId: string,
    userId: string,
    roles: string[],
    proposalId: string,
  ) {
    const proposal = await this.requireProposal(tenantId, proposalId);
    if (proposal.status !== 'tac_corrections_required') {
      throw new BadRequestException('Revision can only begin when TAC has requested corrections');
    }
    this.assertCanPrepare(roles);

    const fromStatus = proposal.status;
    proposal.status = 'dpr_revision';
    proposal.currentStage = 5;
    const saved = await this.proposalRepo.save(proposal);
    const actorRole = roles.find((r) => r !== 'super_admin') ?? roles[0] ?? null;
    await this.logEvent(
      tenantId,
      proposalId,
      5,
      'begin_revision',
      fromStatus,
      saved.status,
      userId,
      actorRole,
      'DPR team commenced revision to address TAC observations',
    );
    return this.toRecord(tenantId, saved, true, roles);
  }

  async resubmitRevisedDprToTac(
    tenantId: string,
    userId: string,
    roles: string[],
    proposalId: string,
    dto: ResubmitRevisedDprDto,
  ) {
    const proposal = await this.requireProposal(tenantId, proposalId);
    if (!DPR_REVISION_STATUSES.includes(proposal.status as typeof DPR_REVISION_STATUSES[number])) {
      throw new BadRequestException('Revised DPR can only be resubmitted during Stage 5 revision');
    }
    this.assertCanPrepare(roles);

    const fromStatus = proposal.status;
    if (proposal.status === 'tac_corrections_required') {
      proposal.status = 'dpr_revision';
      proposal.currentStage = 5;
    }

    await this.assertStage3Ready(tenantId, proposal);
    await this.assertTacPackageReady(tenantId, proposal);

    const existingHq = (proposal.hqVerification ?? {}) as Record<string, unknown>;
    const existingRevision = (existingHq.dprRevision ?? {}) as {
      responses?: Array<Record<string, unknown>>;
    };
    const responses = Array.isArray(existingRevision.responses) ? [...existingRevision.responses] : [];
    responses.push({
      at: new Date().toISOString(),
      by: userId,
      comments: dto.comments?.trim() ?? null,
      observationResponse: dto.observationResponse?.trim() ?? null,
    });

    proposal.hqVerification = {
      ...existingHq,
      dprRevision: {
        ...existingRevision,
        responses,
        lastResubmittedAt: new Date().toISOString(),
        lastObservationResponse: dto.observationResponse?.trim() ?? null,
      },
    };

    proposal.status = 'tac_round1_review';
    proposal.currentStage = 4;
    if (dto.comments?.trim()) {
      proposal.tacRound1Remarks = dto.comments.trim();
    }

    const saved = await this.proposalRepo.save(proposal);
    const actorRole = roles.find((r) => r !== 'super_admin') ?? roles[0] ?? null;
    await this.logEvent(
      tenantId,
      proposalId,
      4,
      'resubmit_revised_dpr',
      fromStatus,
      saved.status,
      userId,
      actorRole,
      dto.comments ?? 'Revised DPR resubmitted to TAC for Round 1 review',
      dto.observationResponse?.trim() ? { observationResponse: dto.observationResponse.trim() } : undefined,
    );
    return this.toRecord(tenantId, saved, true, roles);
  }

  async uploadTacBoqExcel(
    tenantId: string,
    userId: string,
    roles: string[],
    proposalId: string,
    file: { buffer: Buffer; originalname?: string },
    remarks?: string,
  ) {
    const proposal = await this.requireProposal(tenantId, proposalId);
    if (!this.isStage3UploadStatus(proposal.status)) {
      throw new BadRequestException('Complete BOQ Excel can only be uploaded during DPR preparation or revision');
    }
    this.assertCanPrepare(roles);
    if (!file?.buffer?.length) throw new BadRequestException('Excel file is empty');
    const ext = (file.originalname ?? '').toLowerCase();
    if (!ext.endsWith('.xlsx') && !ext.endsWith('.xls')) {
      throw new BadRequestException('Complete BOQ must be an Excel file (.xlsx or .xls)');
    }

    const savedFile = saveDprProposalFile(proposalId, file);

    let validationReport: ReturnType<typeof validateBoqExcelBuffer>;
    try {
      validationReport = validateBoqExcelBuffer(file.buffer);
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'BOQ Excel validation failed');
    }

    const doc = await this.saveDocumentVersion(
      tenantId,
      userId,
      proposal,
      'boq_tac_excel',
      savedFile.fileName,
      savedFile.fileUrl,
      remarks ?? `BOQ auto-check: ${validationReport.status}`,
    );

    const validationRow = await this.persistBoqValidation(
      tenantId,
      proposalId,
      doc.id,
      savedFile.fileName,
      validationReport,
    );

    const existingHq = (proposal.hqVerification ?? {}) as Record<string, unknown>;
    const existingTac = (existingHq.tacPackage ?? {}) as Record<string, unknown>;
    proposal.hqVerification = {
      ...existingHq,
      tacPackage: {
        ...existingTac,
        validationMode: 'excel_auto',
        boqValidation: {
          status: validationReport.status,
          readyForTac: validationReport.summary.readyForTac,
          validatedAt: (validationRow.validatedAt ?? new Date()).toISOString(),
          documentId: doc.id,
        },
      },
    };
    await this.proposalRepo.save(proposal);

    await this.logEvent(
      tenantId,
      proposalId,
      proposal.currentStage,
      'upload_document',
      proposal.status,
      proposal.status,
      userId,
      null,
      'boq_tac_excel',
      {
        documentId: doc.id,
        boqValidationStatus: validationReport.status,
        boqValidationPassed: validationReport.summary.readyForTac,
      },
    );
    return {
      document: doc,
      validation: this.toBoqValidationRecord(validationRow, validationReport, { detail: 'full' }),
    };
  }

  async uploadCompleteDprPdf(
    tenantId: string,
    userId: string,
    roles: string[],
    proposalId: string,
    file: { buffer: Buffer; originalname?: string },
    remarks?: string,
  ) {
    const proposal = await this.requireProposal(tenantId, proposalId);
    if (!this.isStage3UploadStatus(proposal.status)) {
      throw new BadRequestException('Complete DPR PDF can only be uploaded during DPR preparation, revision, or Round 2 compliance');
    }
    this.assertCanPrepare(roles);
    if (!file?.buffer?.length) throw new BadRequestException('PDF file is empty');
    const ext = (file.originalname ?? '').toLowerCase();
    if (!ext.endsWith('.pdf')) {
      throw new BadRequestException('Complete DPR must be a PDF file');
    }

    const saved = saveDprProposalFile(proposalId, file);
    const pdfValidation = validateDprPdfBuffer(file.buffer, file.originalname ?? saved.fileName);
    const existingHq = (proposal.hqVerification ?? {}) as Record<string, unknown>;
    const existingTac = (existingHq.tacPackage ?? {}) as Record<string, unknown>;
    proposal.hqVerification = {
      ...existingHq,
      tacPackage: {
        ...existingTac,
        validationMode: 'pdf_only',
        pdfValidation: { ...pdfValidation, validatedAt: new Date().toISOString() },
      },
    };
    await this.proposalRepo.save(proposal);

    const doc = await this.saveDocumentVersion(
      tenantId,
      userId,
      proposal,
      'dpr_complete_pdf',
      saved.fileName,
      saved.fileUrl,
      remarks ?? `PDF check: ${pdfValidation.status}`,
    );
    return { document: doc, pdfValidation };
  }

  async setTacValidationMode(
    tenantId: string,
    userId: string,
    roles: string[],
    proposalId: string,
    dto: TacValidationModeDto,
  ) {
    const proposal = await this.requireProposal(tenantId, proposalId);
    if (!['dpr_prep_approved', 'dpr_preparation'].includes(proposal.status)) {
      throw new BadRequestException('Validation mode can only be set during DPR preparation');
    }
    this.assertCanPrepare(roles);
    const existingHq = (proposal.hqVerification ?? {}) as Record<string, unknown>;
    const existingTac = (existingHq.tacPackage ?? {}) as Record<string, unknown>;
    proposal.hqVerification = {
      ...existingHq,
      tacPackage: {
        ...existingTac,
        validationMode: dto.validationMode,
      },
    };
    const saved = await this.proposalRepo.save(proposal);
    return this.toRecord(tenantId, saved, true, roles);
  }

  async getPdfValidation(tenantId: string, proposalId: string) {
    const proposal = await this.requireProposal(tenantId, proposalId);
    const tac = this.getTacPackageState(proposal);
    return tac.pdfValidation ?? null;
  }

  async getBoqValidation(tenantId: string, proposalId: string, detail?: string) {
    await this.requireProposal(tenantId, proposalId);
    const row = await this.boqValidationRepo.findOne({
      where: { tenantId, proposalId },
      order: { validatedAt: 'DESC' },
    });
    if (!row) return null;
    return this.toBoqValidationRecord(row, undefined, { detail: detail === 'summary' ? 'summary' : 'full' });
  }

  async listBoqValidationHistory(tenantId: string, proposalId: string) {
    await this.requireProposal(tenantId, proposalId);
    const rows = await this.boqValidationRepo.find({
      where: { tenantId, proposalId },
      order: { validatedAt: 'DESC' },
      take: 20,
    });
    return rows.map((r) => this.toBoqValidationRecord(r));
  }

  async exportBoqValidationReport(tenantId: string, proposalId: string): Promise<{
    buffer: Buffer;
    fileName: string;
  }> {
    const proposal = await this.requireProposal(tenantId, proposalId);
    const row = await this.boqValidationRepo.findOne({
      where: { tenantId, proposalId },
      order: { validatedAt: 'DESC' },
    });
    if (!row) throw new NotFoundException('No BOQ validation report found — upload BOQ Excel first');

    const record = this.toBoqValidationRecord(row, undefined, { detail: 'full' }) as unknown as DprExcelAuditReport;
    if (!record.audit) {
      throw new BadRequestException('Validation audit data missing — re-upload BOQ Excel to regenerate report');
    }

    const buffer = buildDprValidationExcelExport(record, {
      proposalNo: proposal.proposalNo,
      fileName: row.fileName ?? undefined,
      validatedAt: row.validatedAt?.toISOString(),
    });
    const safeNo = proposal.proposalNo.replace(/[^a-zA-Z0-9-_]/g, '_');
    return { buffer, fileName: `DPR-Validation-${safeNo}.xlsx` };
  }

  private slimAuditForApi(audit: unknown): unknown {
    if (!audit || typeof audit !== 'object') return audit;
    const a = audit as {
      errors?: unknown[];
      formulaAudits?: unknown[];
      formulasUnverified?: number;
      [key: string]: unknown;
    };
    return {
      ...a,
      errors: Array.isArray(a.errors) ? a.errors.slice(0, 500) : [],
      formulaAudits: Array.isArray(a.formulaAudits) ? a.formulaAudits.slice(0, 200) : [],
      formulasUnverified: a.formulasUnverified ?? 0,
    };
  }

  private toBoqValidationRecord(
    row: DprBoqValidation,
    report?: ReturnType<typeof validateBoqExcelBuffer>,
    options?: { summaryOnly?: boolean; detail?: 'full' | 'summary' },
  ) {
    const stored = row.validationReport as unknown as {
      pages?: unknown[];
      lines?: unknown[];
      crossChecks?: unknown[];
      firstCalculationPageNo?: number | null;
      audit?: unknown;
      sheetReports?: unknown[];
    } | unknown[] | null;
    const storedPages = Array.isArray(stored) ? undefined : stored?.pages;
    const storedLines = Array.isArray(stored) ? stored : stored?.lines;
    const storedCrossChecks = Array.isArray(stored) ? undefined : stored?.crossChecks;
    const storedFirstPage = Array.isArray(stored) ? undefined : stored?.firstCalculationPageNo;
    const storedAudit = Array.isArray(stored) ? undefined : stored?.audit;
    const storedSheetReports = Array.isArray(stored)
      ? undefined
      : stored?.sheetReports
        ?? (storedAudit as { sheetReports?: unknown[] } | undefined)?.sheetReports;
    const summaryOnly = options?.summaryOnly === true;
    const detailFull = options?.detail === 'full';
    const sheetReports = report?.audit?.sheetReports ?? storedSheetReports ?? [];
    const auditBase = this.slimAuditForApi(report?.audit ?? storedAudit ?? null) as Record<string, unknown> | null;
    const audit = summaryOnly
      ? null
      : {
        ...(auditBase ?? {}),
        sheetReports: detailFull ? sheetReports : [],
      };
    return {
      id: row.id,
      documentId: row.documentId,
      fileName: row.fileName,
      status: row.status,
      totalItems: row.totalItems,
      passedItems: row.passedItems,
      failedItems: row.failedItems,
      warningItems: row.warningItems,
      computedGrandTotal: row.computedGrandTotal,
      declaredGrandTotal: row.declaredGrandTotal,
      grandTotalMatch: row.grandTotalMatch,
      pages: summaryOnly || !detailFull ? [] : (report?.pages ?? storedPages ?? []),
      lines: summaryOnly || !detailFull ? [] : (report?.lines ?? storedLines ?? []),
      crossChecks: report?.crossChecks ?? storedCrossChecks ?? [],
      firstCalculationPageNo: summaryOnly ? null : (report?.firstCalculationPageNo ?? storedFirstPage ?? null),
      audit,
      summary: report?.summary ?? row.summary,
      validatedAt: row.validatedAt,
    };
  }

  private async persistBoqValidation(
    tenantId: string,
    proposalId: string,
    documentId: string,
    fileName: string,
    report: ReturnType<typeof validateBoqExcelBuffer>,
  ): Promise<DprBoqValidation> {
    const row = this.boqValidationRepo.create({
      tenantId,
      proposalId,
      documentId,
      fileName,
      status: report.status,
      totalItems: report.totalItems,
      passedItems: report.passedItems,
      failedItems: report.failedItems,
      warningItems: report.warningItems,
      computedGrandTotal: report.computedGrandTotal,
      declaredGrandTotal: report.declaredGrandTotal,
      grandTotalMatch: report.grandTotalMatch,
      validationReport: {
        pages: report.pages,
        lines: report.lines,
        crossChecks: report.crossChecks,
        firstCalculationPageNo: report.firstCalculationPageNo,
        audit: report.audit,
        sheetReports: report.audit?.sheetReports ?? [],
      } as unknown as Record<string, unknown>[],
      summary: report.summary as Record<string, unknown>,
      validatedAt: new Date(),
    });
    return this.boqValidationRepo.save(row);
  }

  private getTacValidationMode(proposal: DprProposal): 'excel_auto' | 'pdf_only' {
    const mode = this.getTacPackageState(proposal).validationMode;
    return mode === 'excel_auto' ? 'excel_auto' : 'pdf_only';
  }

  private getTacPackageState(proposal: DprProposal): {
    validationMode: 'excel_auto' | 'pdf_only';
    pdfValidation: (DprPdfValidationReport & { validatedAt?: string }) | null;
  } {
    const tac = ((proposal.hqVerification ?? {}) as { tacPackage?: Record<string, unknown> }).tacPackage ?? {};
    // Default PDF-only manual TAC review; Excel auto-audit is opt-in only
    const validationMode = tac.validationMode === 'excel_auto' ? 'excel_auto' : 'pdf_only';
    const pdfValidation = (tac.pdfValidation as (DprPdfValidationReport & { validatedAt?: string }) | undefined) ?? null;
    return { validationMode, pdfValidation };
  }

  private async assertRound2CompliancePackageReady(
    tenantId: string,
    proposal: DprProposal,
  ) {
    const docs = await this.docRepo.find({ where: { tenantId, proposalId: proposal.id } });
    const uploaded = new Set(docs.map((d) => d.documentType));
    if (!uploaded.has('dpr_complete_pdf')) {
      throw new BadRequestException('Revised Complete DPR PDF is required for Round 2 compliance submission');
    }
    if (!uploaded.has('tac_round2_compliance')) {
      throw new BadRequestException('Round 2 compliance document is required before submission');
    }
  }

  private async assertTacPackageReady(
    tenantId: string,
    proposal: DprProposal,
  ) {
    const docs = await this.docRepo.find({ where: { tenantId, proposalId: proposal.id } });
    const uploaded = new Set(docs.map((d) => d.documentType));
    if (!uploaded.has('dpr_complete_pdf')) {
      throw new BadRequestException('Complete DPR PDF is required for TAC submission');
    }
    if (!uploaded.has('boq_tac_excel')) {
      throw new BadRequestException(
        'Complete BOQ Excel is required — upload the workbook and resolve all validation errors before TAC submission',
      );
    }

    const boqRow = await this.boqValidationRepo.findOne({
      where: { tenantId, proposalId: proposal.id },
      order: { validatedAt: 'DESC' },
    });
    if (!boqRow) {
      throw new BadRequestException('BOQ Excel must pass auto-validation — re-upload the workbook');
    }
    const summary = boqRow.summary as { readyForTac?: boolean; issues?: string[] } | null;
    if (boqRow.status !== 'passed' || summary?.readyForTac === false) {
      const issues = summary?.issues ?? [];
      throw new BadRequestException(
        issues.length
          ? `BOQ must pass validation before TAC submission: ${issues.slice(0, 3).join('; ')}`
          : 'BOQ must pass validation before TAC submission — fix Qty×Rate, subtotal and grand total errors and re-upload',
      );
    }
  }

  async uploadDocument(
    tenantId: string,
    userId: string,
    roles: string[],
    proposalId: string,
    dto: UploadDprDocumentDto,
  ) {
    const proposal = await this.requireProposal(tenantId, proposalId);
    this.assertCanUploadDocument(proposal, roles, dto.documentType);
    if (!dto.fileUrl?.trim()) throw new BadRequestException('File URL is required');

    return this.saveDocumentVersion(tenantId, userId, proposal, dto.documentType, dto.fileName, dto.fileUrl.trim(), dto.remarks);
  }

  async uploadDocumentFile(
    tenantId: string,
    userId: string,
    roles: string[],
    proposalId: string,
    documentType: string,
    file: { buffer: Buffer; originalname?: string },
    remarks?: string,
  ) {
    const proposal = await this.requireProposal(tenantId, proposalId);
    this.assertCanUploadDocument(proposal, roles, documentType);
    if (!file?.buffer?.length) throw new BadRequestException('File is empty');

    const saved = saveDprProposalFile(proposalId, file);
    return this.saveDocumentVersion(
      tenantId,
      userId,
      proposal,
      documentType,
      saved.fileName,
      saved.fileUrl,
      remarks,
    );
  }

  async getDocumentFile(tenantId: string, proposalId: string, documentId: string) {
    await this.requireProposal(tenantId, proposalId);
    const doc = await this.docRepo.findOne({ where: { id: documentId, tenantId, proposalId } });
    if (!doc?.fileUrl) throw new NotFoundException('Document not found');
    const absolutePath = resolveDprProposalFilePath(doc.fileUrl);
    if (!fileExists(absolutePath)) {
      throw new NotFoundException('File not found on server — re-upload the document');
    }
    return {
      doc,
      absolutePath,
      mimeType: guessMimeType(doc.fileName ?? doc.fileUrl),
    };
  }

  private async saveDocumentVersion(
    tenantId: string,
    userId: string,
    proposal: DprProposal,
    documentType: string,
    fileName: string | undefined | null,
    fileUrl: string,
    remarks?: string | null,
  ) {
    const latest = await this.docRepo.findOne({
      where: { tenantId, proposalId: proposal.id, documentType },
      order: { versionNo: 'DESC' },
    });
    const doc = this.docRepo.create({
      tenantId,
      proposalId: proposal.id,
      documentType,
      fileName: fileName ?? null,
      fileUrl,
      versionNo: (latest?.versionNo ?? 0) + 1,
      uploadedBy: userId,
      remarks: remarks ?? null,
    });
    const saved = await this.docRepo.save(doc);
    await this.logEvent(
      tenantId,
      proposal.id,
      proposal.currentStage,
      'upload_document',
      proposal.status,
      proposal.status,
      userId,
      null,
      documentType,
      { documentId: saved.id },
    );
    return saved;
  }

  async advanceProposal(
    tenantId: string,
    userId: string,
    roles: string[],
    proposalId: string,
    dto: AdvanceDprProposalDto,
  ) {
    const proposal = await this.requireProposal(tenantId, proposalId);
    const action = dto.action as DprAdvanceAction;
    this.assertCanAct(proposal, action, roles);

    const transition = this.resolveTransition(proposal.status, action);
    if (!transition) {
      throw new BadRequestException(`Action "${action}" is not valid for status "${proposal.status}"`);
    }

    if (action === 'record_sanction') {
      await this.recordSanction(tenantId, userId, proposalId, dto);
    }
    if (action === 'initiate_tender') {
      await this.initiateTender(tenantId, proposalId, dto.taskOrderRef);
    }
    if (action === 'publish_tender') {
      await this.publishTender(tenantId, proposalId, dto.nitRef);
    }
    if (action === 'forward_secretariat' && dto.secretariatRef) {
      proposal.secretariatRef = dto.secretariatRef;
      proposal.secretariatForwardedAt = new Date();
    }
    if (dto.comments?.trim()) {
      if (proposal.status.includes('tac')) {
        if (proposal.currentStage <= 5) proposal.tacRound1Remarks = dto.comments.trim();
        else proposal.tacRound2Remarks = dto.comments.trim();
      } else if (['hq_review', 'proposal_submitted'].includes(proposal.status)) {
        proposal.hqRemarks = dto.comments.trim();
      }
    }

    const fromStatus = proposal.status;
    proposal.status = transition.next;
    proposal.currentStage = transition.stage;
    if (transition.next === 'closed') proposal.closedAt = new Date();

    const saved = await this.proposalRepo.save(proposal);
    const actorRole = roles.find((r) => r !== 'super_admin') ?? roles[0] ?? null;
    await this.logEvent(tenantId, proposalId, transition.stage, action, fromStatus, saved.status, userId, actorRole, dto.comments);

    return this.toRecord(tenantId, saved, true);
  }

  async listEvents(tenantId: string, proposalId: string) {
    await this.requireProposal(tenantId, proposalId);
    const rows = await this.eventRepo.find({
      where: { tenantId, proposalId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return rows.map((e) => ({
      id: e.id,
      stage: e.stage,
      action: e.action,
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      actorId: e.actorId,
      actorRole: e.actorRole,
      comments: e.comments,
      payload: e.payload,
      createdAt: e.createdAt,
    }));
  }

  private resolveTransition(status: string, action: DprAdvanceAction): Transition | null {
    const map: Record<string, Partial<Record<DprAdvanceAction, Transition>>> = {
      proposal_draft: { submit: { next: 'proposal_submitted', stage: 2 } },
      proposal_submitted: { approve: { next: 'hq_review', stage: 2 } },
      hq_review: {
        approve: { next: 'dpr_prep_approved', stage: 3 },
        return: { next: 'proposal_returned', stage: 1 },
        reject: { next: 'proposal_rejected', stage: 1 },
      },
      proposal_returned: { submit: { next: 'hq_review', stage: 2 } },
      dpr_prep_approved: { approve: { next: 'dpr_preparation', stage: 3 } },
      dpr_preparation: { submit: { next: 'dpr_submitted', stage: 4 } },
      dpr_submitted: { approve: { next: 'tac_round1_review', stage: 4 }, forward_tac: { next: 'tac_round1_review', stage: 4 } },
      tac_round1_review: {
        approve: { next: 'tac_round1_cleared', stage: 6 },
        request_corrections: { next: 'tac_corrections_required', stage: 5 },
        request_info: { next: 'tac_round1_review', stage: 4 },
        return: { next: 'dpr_revision', stage: 5 },
      },
      tac_corrections_required: { submit: { next: 'dpr_revision', stage: 5 } },
      dpr_revision: { submit: { next: 'tac_round1_review', stage: 4 } },
      tac_round1_cleared: { forward_secretariat: { next: 'secretariat_submitted', stage: 6 } },
      tac_round1_final: { forward_secretariat: { next: 'secretariat_submitted', stage: 6 } },
      secretariat_submitted: { approve: { next: 'tac_round2_review', stage: 7 } },
      tac_round2_review: {
        approve: { next: 'govt_technical_concurrence', stage: 8 },
        request_corrections: { next: 'tac_round2_corrections_required', stage: 7 },
      },
      tac_round2_corrections_required: { submit: { next: 'tac_round2_compliance', stage: 7 } },
      tac_round2_compliance: { submit: { next: 'tac_round2_compliance_submitted', stage: 7 } },
      tac_round2_compliance_submitted: { forward_secretariat: { next: 'tac_round2_review', stage: 7 } },
      govt_technical_concurrence: { record_sanction: { next: 'sanctioned', stage: 9 } },
      sanctioned: { initiate_tender: { next: 'tender_prep_initiated', stage: 9 } },
      tender_prep_initiated: { approve: { next: 'tender_processing', stage: 10 } },
      tender_processing: { publish_tender: { next: 'tender_published', stage: 10 } },
      tender_published: { close: { next: 'closed', stage: 12 } },
    };
    return map[status]?.[action] ?? null;
  }

  private assertCanAct(proposal: DprProposal, action: DprAdvanceAction, roles: string[]) {
    assertNotSuperAdminRolesForOperations(roles, `pipeline action "${action}"`);

    if (action === 'record_sanction') {
      this.assertCanRecordSanction(roles);
      return;
    }
    if (action === 'forward_secretariat') {
      this.assertCanForwardToSecretariat(roles);
      return;
    }
    if (
      (action === 'approve' || action === 'request_corrections')
      && ['secretariat_submitted', 'tac_round2_review'].includes(proposal.status)
    ) {
      this.assertCanReviewTacRound2(roles);
      return;
    }

    const stage = DPR_PLANNING_STAGES.find((s) => s.stage === proposal.currentStage);
    const allowed: string[] = [...(stage?.ownerRoles ?? [])];
    if (allowed.length && !roles.some((r) => allowed.includes(r))) {
      throw new ForbiddenException(`Your role cannot perform "${action}" at stage ${proposal.currentStage}`);
    }
  }

  private async recordSanction(tenantId: string, userId: string, proposalId: string, dto: AdvanceDprProposalDto) {
    if (!dto.administrativeApprovalNo?.trim() && !dto.expenditureSanctionNo?.trim()) {
      throw new BadRequestException('Administrative Approval or Expenditure Sanction number is required');
    }
    const existing = await this.sanctionRepo.findOne({ where: { tenantId, proposalId } });
    const row = existing ?? this.sanctionRepo.create({ tenantId, proposalId });
    row.administrativeApprovalNo = dto.administrativeApprovalNo?.trim() ?? row.administrativeApprovalNo;
    row.expenditureSanctionNo = dto.expenditureSanctionNo?.trim() ?? row.expenditureSanctionNo;
    row.sanctionedAmount = dto.sanctionedAmount ?? row.sanctionedAmount;
    row.budgetHead = dto.budgetHead?.trim() ?? row.budgetHead;
    row.sanctionDate = dto.sanctionDate ?? row.sanctionDate;
    row.fundingReleaseRef = dto.fundingReleaseRef?.trim() ?? row.fundingReleaseRef;
    row.recordedBy = userId;
    await this.sanctionRepo.save(row);
  }

  private async initiateTender(tenantId: string, proposalId: string, taskOrderRef?: string) {
    const existing = await this.tenderRepo.findOne({ where: { tenantId, proposalId } });
    if (existing) return existing;
    const count = await this.tenderRepo.count({ where: { tenantId } });
    return this.tenderRepo.save(this.tenderRepo.create({
      tenantId,
      proposalId,
      packageNo: `TND-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`,
      status: 'prep_initiated',
      taskOrderRef: taskOrderRef?.trim() ?? null,
    }));
  }

  private async publishTender(tenantId: string, proposalId: string, nitRef?: string) {
    const tender = await this.tenderRepo.findOne({ where: { tenantId, proposalId } });
    if (!tender) throw new BadRequestException('Tender package not initiated');
    tender.status = 'published';
    tender.nitRef = nitRef?.trim() ?? tender.nitRef;
    tender.publishedAt = new Date();
    await this.tenderRepo.save(tender);
  }

  private async requireProposal(tenantId: string, id: string) {
    const row = await this.proposalRepo.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('DPR proposal not found');
    return row;
  }

  private async logEvent(
    tenantId: string,
    proposalId: string,
    stage: number,
    action: string,
    fromStatus: string | null,
    toStatus: string | null,
    actorId: string | null,
    actorRole: string | null,
    comments?: string | null,
    payload?: Record<string, unknown>,
  ) {
    await this.eventRepo.save(this.eventRepo.create({
      tenantId,
      proposalId,
      stage,
      action,
      fromStatus,
      toStatus,
      actorId,
      actorRole,
      comments: comments ?? null,
      payload: payload ?? null,
    }));
  }

  private currentFinancialYear(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const start = m >= 4 ? y : y - 1;
    const end = (start + 1) % 100;
    return `${start}-${String(end).padStart(2, '0')}`;
  }

  private async getDivisionCode(divisionId: string): Promise<string> {
    const rows = await this.proposalRepo.query(
      'SELECT code FROM divisions WHERE id = $1',
      [divisionId],
    ) as Array<{ code?: string }>;
    return rows[0]?.code?.replace(/^DIV-/, '') ?? 'DIV';
  }

  private async toRecord(tenantId: string, row: DprProposal, includeDetails = false, roles: string[] = []) {
    let divisionName: string | null = null;
    let divisionCode: string | null = null;
    if (row.divisionId) {
      const div = await this.proposalRepo.query(
        'SELECT code, name FROM divisions WHERE id = $1 AND tenant_id = $2',
        [row.divisionId, tenantId],
      ) as Array<{ code?: string; name?: string }>;
      divisionCode = div[0]?.code ?? null;
      divisionName = div[0]?.name ?? null;
    }

    const base = {
      id: row.id,
      proposalNo: row.proposalNo,
      title: row.title,
      divisionId: row.divisionId,
      divisionCode,
      divisionName,
      projectId: row.projectId,
      currentStage: row.currentStage,
      stageLabel: DPR_PLANNING_STAGES.find((s) => s.stage === row.currentStage)?.name ?? `Stage ${row.currentStage}`,
      status: row.status,
      statusLabel: getDprViewerStatusLabel(row.status, roles),
      preliminaryEstimate: row.preliminaryEstimate,
      fundingSource: row.fundingSource,
      priority: row.priority,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      closedAt: row.closedAt,
      eeComplianceAssignment: this.buildEeComplianceAssignmentView(row, roles),
      eeComplianceAssignmentPending: this.isEeComplianceAssignmentPending(row),
    };

    if (!includeDetails) return base;

    const [documents, events, sanction, tender, boqValidation] = await Promise.all([
      this.docRepo.find({ where: { tenantId, proposalId: row.id }, order: { createdAt: 'DESC' } }),
      this.eventRepo.find({ where: { tenantId, proposalId: row.id }, order: { createdAt: 'DESC' }, take: 20 }),
      this.sanctionRepo.findOne({ where: { tenantId, proposalId: row.id } }),
      this.tenderRepo.findOne({ where: { tenantId, proposalId: row.id } }),
      this.boqValidationRepo.findOne({ where: { tenantId, proposalId: row.id }, order: { validatedAt: 'DESC' } }),
    ]);

    const laReadiness = await this.landAcquisitionService.getReadinessForProposal(tenantId, row.id);

    return {
      ...base,
      schemeJustification: row.schemeJustification,
      latitude: row.latitude,
      longitude: row.longitude,
      gisBoundary: row.gisBoundary,
      hqRemarks: row.hqRemarks,
      hqVerification: row.hqVerification,
      hqReviewedAt: row.hqReviewedAt,
      dprPrepOrderNo: row.dprPrepOrderNo,
      dprPrepOrderIssuedAt: row.dprPrepOrderIssuedAt,
      hqReview: this.buildHqReviewState(row, roles),
      tacReview: this.buildTacReviewState(row, roles),
      tacRound1Remarks: row.tacRound1Remarks,
      tacRound2Remarks: row.tacRound2Remarks,
      secretariatRef: row.secretariatRef,
      secretariatForwardedAt: row.secretariatForwardedAt,
      documents,
      documentSlots: this.buildDocumentSlots(documents),
      documentVersionHistory: this.buildDocumentVersionHistory(documents),
      stage1Readiness: await this.buildStage1Readiness(row, documents),
      stage3Readiness: await this.buildStage3Readiness(tenantId, row, documents, roles, laReadiness),
      stage5Readiness: await this.buildStage5Readiness(tenantId, row, documents, roles),
      stage6Readiness: await this.buildStage6Readiness(tenantId, row, documents, roles),
      stage7Readiness: await this.buildStage7Readiness(tenantId, row, documents, roles),
      stage8Readiness: this.buildStage8Readiness(row, documents, roles, sanction, laReadiness),
      stage9Readiness: this.buildStage9Readiness(row, documents, roles, sanction, tender),
      stage10Readiness: this.buildStage10Readiness(row, documents, roles, tender),
      tacRound2Review: await this.buildTacRound2ReviewState(tenantId, row, roles, documents),
      laReadiness,
      stage3HqRemarks: (row.hqVerification as { stage3Remarks?: string } | null)?.stage3Remarks ?? null,
      boqValidation: boqValidation ? this.toBoqValidationRecord(boqValidation, undefined, { summaryOnly: true }) : null,
      events,
      sanction,
      tender,
      allowedActions: this.getAllowedActions(row.status),
    };
  }

  private buildDocumentSlots(docs: DprProposalDocument[]) {
    const latestByType = new Map<string, DprProposalDocument>();
    for (const doc of docs) {
      const existing = latestByType.get(doc.documentType);
      if (!existing || doc.versionNo > existing.versionNo) latestByType.set(doc.documentType, doc);
    }
    return DPR_DOCUMENT_TYPES.map((def) => {
      const document = latestByType.get(def.type) ?? null;
      return {
        documentType: def.type,
        label: def.label,
        stage: def.stage,
        document: document ? {
          id: document.id,
          fileName: document.fileName,
          fileUrl: document.fileUrl,
          versionNo: document.versionNo,
          uploadedAt: document.createdAt,
          remarks: document.remarks,
        } : null,
      };
    });
  }

  private buildDocumentVersionHistory(docs: DprProposalDocument[]) {
    const byType = new Map<string, DprProposalDocument[]>();
    for (const doc of docs) {
      const list = byType.get(doc.documentType) ?? [];
      list.push(doc);
      byType.set(doc.documentType, list);
    }
    return DPR_DOCUMENT_TYPES.map((def) => {
      const versions = (byType.get(def.type) ?? [])
        .sort((a, b) => b.versionNo - a.versionNo)
        .map((d) => ({
          id: d.id,
          versionNo: d.versionNo,
          fileName: d.fileName,
          fileUrl: d.fileUrl,
          remarks: d.remarks,
          uploadedBy: d.uploadedBy,
          uploadedAt: d.createdAt,
        }));
      return {
        documentType: def.type,
        label: def.label,
        stage: def.stage,
        versions,
        latestVersion: versions[0] ?? null,
      };
    }).filter((h) => h.stage === 3 || h.versions.length > 0);
  }

  private async buildStage3Readiness(
    tenantId: string,
    proposal: DprProposal,
    documents: DprProposalDocument[],
    roles: string[] = [],
    laReadiness?: LaReadiness,
  ) {
    const canPrepare = this.isDivisionPreparer(roles);
    const canReview = this.isStateReviewerRole(roles);
    const uploadedTypes = new Set(documents.map((d) => d.documentType));
    const missingDocuments = DPR_STAGE_3_REQUIRED_DOCUMENT_TYPES
      .filter((t) => !uploadedTypes.has(t))
      .map((t) => DPR_DOCUMENT_TYPES.find((d) => d.type === t)?.label ?? t);
    const stage3Docs = documents.filter((d) =>
      DPR_STAGE_3_REQUIRED_DOCUMENT_TYPES.includes(d.documentType as typeof DPR_STAGE_3_REQUIRED_DOCUMENT_TYPES[number]),
    );
    const versionCounts = DPR_STAGE_3_REQUIRED_DOCUMENT_TYPES.map((type) => {
      const versions = stage3Docs.filter((d) => d.documentType === type);
      const latest = versions.reduce((max, d) => (d.versionNo > (max?.versionNo ?? 0) ? d : max), null as DprProposalDocument | null);
      return {
        documentType: type,
        label: DPR_DOCUMENT_TYPES.find((d) => d.type === type)?.label ?? type,
        versionCount: versions.length,
        latestVersion: latest?.versionNo ?? 0,
      };
    });
    const inPreparation = ['dpr_prep_approved', 'dpr_preparation'].includes(proposal.status);
    const hasCompletePdf = uploadedTypes.has('dpr_complete_pdf');
    const hasBoqExcel = uploadedTypes.has('boq_tac_excel');
    const inPrepStatus = ['dpr_prep_approved', 'dpr_preparation'].includes(proposal.status);
    const tacState = this.getTacPackageState(proposal);
    const validationMode = tacState.validationMode;

    let boqValidationPassed = false;
    if (hasBoqExcel) {
      const boqRow = await this.boqValidationRepo.findOne({
        where: { tenantId, proposalId: proposal.id },
        order: { validatedAt: 'DESC' },
      });
      boqValidationPassed = boqRow != null && boqRow.status === 'passed';
    }

    const pdfValidationReady = validationMode === 'pdf_only'
      ? hasCompletePdf
      : !!tacState.pdfValidation?.summary?.readyForTac && tacState.pdfValidation?.status !== 'failed';

    const tacPackageComplete = hasCompletePdf && hasBoqExcel && boqValidationPassed;

    const la = laReadiness ?? await this.landAcquisitionService.getReadinessForProposal(tenantId, proposal.id);
    const canSubmitLa = la.canSubmitDprStage3;

    return {
      complete: missingDocuments.length === 0,
      missingDocuments,
      laReadiness: la,
      laMissingActions: la.missingActions,
      versionCounts,
      totalVersions: stage3Docs.length,
      viewMode: canPrepare ? 'prepare' : (canReview ? 'review' : 'read'),
      canBeginPreparation: proposal.status === 'dpr_prep_approved' && canPrepare,
      canUpload: inPrepStatus && canPrepare,
      canSubmitToHq: ['dpr_prep_approved', 'dpr_preparation'].includes(proposal.status)
        && missingDocuments.length === 0
        && tacPackageComplete
        && canPrepare
        && canSubmitLa,
      canSaveRemarks: inPrepStatus && this.isStateReviewerRole(roles),
      canReviewOnly: inPrepStatus && canReview && !canPrepare,
      inPreparation,
      tacPackage: {
        hasCompletePdf,
        hasBoqExcel,
        validationMode,
        pdfValidation: tacState.pdfValidation,
        complete: tacPackageComplete,
        boqValidationPassed,
        pdfValidationReady,
      },
    };
  }

  private getLatestDocumentByType(documents: DprProposalDocument[], documentType: string) {
    return documents
      .filter((d) => d.documentType === documentType)
      .reduce<DprProposalDocument | null>(
        (max, d) => (!max || d.versionNo > max.versionNo ? d : max),
        null,
      );
  }

  /**
   * Freeze the DPR PDF that Super Admin actually reviewed online at TAC Round 1 —
   * not the latest EE re-upload (which may be a different version without markup).
   */
  private async resolveTac1OfficialDocumentForFreeze(
    tenantId: string,
    proposal: DprProposal,
    documents: DprProposalDocument[],
  ): Promise<DprProposalDocument | null> {
    const pdfDocs = documents.filter((d) => d.documentType === 'dpr_complete_pdf');
    if (!pdfDocs.length) return null;

    const tacRound1 = ((proposal.hqVerification ?? {}) as { tacRound1?: Record<string, unknown> }).tacRound1 ?? {};
    const reviewedDocumentId = tacRound1.reviewedDocumentId as string | undefined;
    if (reviewedDocumentId) {
      const reviewed = pdfDocs.find((d) => d.id === reviewedDocumentId);
      if (reviewed) return reviewed;
    }

    const reviews = await this.pdfReviewRepo.find({
      where: { tenantId, proposalId: proposal.id, reviewerScope: 'hq' },
      order: { updatedAt: 'DESC' },
    });
    if (reviews.length) {
      const reviewByDoc = new Map(reviews.map((r) => [r.documentId, r]));
      const reviewedDocs = pdfDocs.filter((d) => reviewByDoc.has(d.id));
      if (reviewedDocs.length) {
        const ranked = await Promise.all(
          reviewedDocs.map(async (doc) => ({
            doc,
            annotationCount: await this.countHqPdfAnnotations(tenantId, doc.id),
            review: reviewByDoc.get(doc.id)!,
          })),
        );
        ranked.sort((a, b) => {
          if (b.annotationCount !== a.annotationCount) return b.annotationCount - a.annotationCount;
          if (b.doc.versionNo !== a.doc.versionNo) return b.doc.versionNo - a.doc.versionNo;
          return b.review.updatedAt.getTime() - a.review.updatedAt.getTime();
        });
        return ranked[0].doc;
      }
    }

    return this.getLatestDocumentByType(documents, 'dpr_complete_pdf');
  }

  /** Annotated source dpr_complete_pdf reviewed at TAC Round 1 (for Secretariat PDF viewer). */
  private async resolveTac1ReviewedSourceDocument(
    tenantId: string,
    proposal: DprProposal,
    documents: DprProposalDocument[],
  ): Promise<DprProposalDocument | null> {
    const tacRound1 = ((proposal.hqVerification ?? {}) as { tacRound1?: Record<string, unknown> }).tacRound1 ?? {};
    const reviewedDocumentId = tacRound1.reviewedDocumentId as string | undefined;
    if (reviewedDocumentId) {
      const doc = documents.find((d) => d.id === reviewedDocumentId && d.documentType === 'dpr_complete_pdf');
      if (doc) return doc;
    }

    const frozen = tacRound1.officialPackage as { copiedFromDocumentId?: string } | null | undefined;
    if (frozen?.copiedFromDocumentId) {
      const doc = documents.find(
        (d) => d.id === frozen.copiedFromDocumentId && d.documentType === 'dpr_complete_pdf',
      );
      if (doc) return doc;
    }

    return this.resolveTac1OfficialDocumentForFreeze(tenantId, proposal, documents);
  }

  private async countHqPdfAnnotations(tenantId: string, documentId: string): Promise<number> {
    const reviews = await this.pdfReviewRepo.find({
      where: { tenantId, documentId, reviewerScope: 'hq' },
    });
    if (!reviews.length) return 0;
    let total = 0;
    for (const review of reviews) {
      total += await this.pdfAnnotationRepo.count({ where: { tenantId, reviewId: review.id } });
    }
    return total;
  }

  private async clonePdfReviewMarkup(
    tenantId: string,
    userId: string,
    proposalId: string,
    sourceDocumentId: string,
    destDocumentId: string,
  ) {
    const sourceReview = await this.pdfReviewRepo.findOne({
      where: { tenantId, proposalId, documentId: sourceDocumentId, reviewerScope: 'hq' },
      order: { updatedAt: 'DESC' },
    });
    if (!sourceReview) return;

    let destReview = await this.pdfReviewRepo.findOne({
      where: { tenantId, proposalId, documentId: destDocumentId, reviewerScope: 'hq' },
    });
    if (!destReview) {
      destReview = await this.pdfReviewRepo.save(this.pdfReviewRepo.create({
        tenantId,
        proposalId,
        documentId: destDocumentId,
        reviewerScope: 'hq',
        status: 'verified',
        createdBy: userId,
      }));
    }

    const annotations = await this.pdfAnnotationRepo.find({
      where: { tenantId, reviewId: sourceReview.id },
    });
    await this.pdfAnnotationRepo.delete({ tenantId, reviewId: destReview.id });
    for (const ann of annotations) {
      await this.pdfAnnotationRepo.save(this.pdfAnnotationRepo.create({
        tenantId,
        reviewId: destReview.id,
        proposalId,
        documentId: destDocumentId,
        pageNumber: ann.pageNumber,
        annotationType: ann.annotationType,
        geometry: ann.geometry,
        color: ann.color,
        content: ann.content,
        createdBy: ann.createdBy,
        updatedBy: userId,
      }));
    }
  }

  /**
   * Immutable TAC1 official PDF + copied Super Admin markup for Secretariat.
   * EE re-uploads to dpr_complete_pdf cannot change this snapshot.
   */
  async ensureTac1OfficialSnapshot(
    tenantId: string,
    userId: string,
    proposal: DprProposal,
    documents: DprProposalDocument[],
  ): Promise<DprProposalDocument | null> {
    const hq = (proposal.hqVerification ?? {}) as Record<string, unknown>;
    const tacRound1 = (hq.tacRound1 ?? {}) as Record<string, unknown>;
    const frozen = tacRound1.officialPackage as {
      documentId?: string;
      copiedFromDocumentId?: string;
      frozenAt?: string;
    } | null | undefined;

    const source = await this.resolveTac1OfficialDocumentForFreeze(tenantId, proposal, documents);

    const existingSnap = frozen?.documentId
      ? documents.find((d) => d.id === frozen.documentId && d.documentType === 'tac_round1_official_pdf') ?? null
      : this.getLatestDocumentByType(documents, 'tac_round1_official_pdf');

    if (existingSnap && source) {
      const markupCount = await this.countHqPdfAnnotations(tenantId, existingSnap.id);
      const sourceMatches = frozen?.copiedFromDocumentId === source.id;
      if (markupCount > 0 && sourceMatches) {
        tacRound1.reviewedDocumentId = (tacRound1.reviewedDocumentId as string | undefined) ?? source.id;
        tacRound1.officialPackage = {
          ...(frozen ?? {}),
          documentId: existingSnap.id,
          versionNo: existingSnap.versionNo,
          fileName: existingSnap.fileName,
          frozenAt: frozen?.frozenAt ?? new Date().toISOString(),
          source: 'tac_round1_official_snapshot',
          label: 'TAC Round 1 — Reviewed DPR (official snapshot)',
          copiedFromDocumentId: source.id,
          copiedFromVersionNo: source.versionNo,
          reviewedDocumentId: (tacRound1.reviewedDocumentId as string) ?? source.id,
        };
        proposal.hqVerification = { ...hq, tacRound1 };
        return existingSnap;
      }
    }

    if (!source?.fileUrl) return null;

    const absPath = resolveDprProposalFilePath(source.fileUrl);
    if (!fileExists(absPath)) return null;

    const buffer = readFileSync(absPath);
    const savedFile = saveDprProposalFile(proposal.id, {
      buffer,
      originalname: source.fileName ?? 'tac1-official-snapshot.pdf',
    });
    const snapDoc = await this.saveDocumentVersion(
      tenantId,
      userId,
      proposal,
      'tac_round1_official_pdf',
      savedFile.fileName,
      savedFile.fileUrl,
      'TAC Round 1 official snapshot — Secretariat examination copy',
    );

    await this.clonePdfReviewMarkup(tenantId, userId, proposal.id, source.id, snapDoc.id);

    proposal.hqVerification = {
      ...hq,
      tacRound1: {
        ...tacRound1,
        reviewedDocumentId: source.id,
        officialPackage: {
          documentId: snapDoc.id,
          versionNo: snapDoc.versionNo,
          fileName: snapDoc.fileName,
          frozenAt: new Date().toISOString(),
          source: 'tac_round1_official_snapshot',
          label: 'TAC Round 1 — Reviewed DPR (official snapshot)',
          copiedFromDocumentId: source.id,
          copiedFromVersionNo: source.versionNo,
          reviewedDocumentId: source.id,
        },
      },
    };

    return snapDoc;
  }

  /** Persist which dpr_complete_pdf Super Admin annotated during TAC Round 1 review. */
  async recordTac1ReviewedDocument(tenantId: string, proposalId: string, documentId: string) {
    const proposal = await this.proposalRepo.findOne({ where: { id: proposalId, tenantId } });
    if (!proposal || proposal.status !== 'tac_round1_review') return;

    const doc = await this.docRepo.findOne({ where: { id: documentId, tenantId, proposalId } });
    if (!doc || doc.documentType !== 'dpr_complete_pdf') return;

    const hq = (proposal.hqVerification ?? {}) as Record<string, unknown>;
    const tacRound1 = (hq.tacRound1 ?? {}) as Record<string, unknown>;
    if (tacRound1.reviewedDocumentId) return;

    tacRound1.reviewedDocumentId = documentId;
    proposal.hqVerification = { ...hq, tacRound1 };
    await this.proposalRepo.save(proposal);
  }

  async rebuildTac1OfficialSnapshot(
    tenantId: string,
    userId: string,
    roles: string[],
    proposalId: string,
  ) {
    if (!isSuperAdmin(roles)) {
      throw new ForbiddenException('Only Super Admin can rebuild the TAC Round 1 official snapshot');
    }
    const proposal = await this.requireProposal(tenantId, proposalId);
    const docs = await this.docRepo.find({ where: { tenantId, proposalId } });
    const hq = (proposal.hqVerification ?? {}) as Record<string, unknown>;
    const tacRound1 = (hq.tacRound1 ?? {}) as Record<string, unknown>;
    tacRound1.officialPackage = null;
    proposal.hqVerification = { ...hq, tacRound1 };
    await this.ensureTac1OfficialSnapshot(tenantId, userId, proposal, docs);
    const saved = await this.proposalRepo.save(proposal);
    return this.toRecord(tenantId, saved, true, roles);
  }

  private async resolveOfficialTac1PackageAsync(
    tenantId: string,
    proposal: DprProposal,
    documents: DprProposalDocument[],
    options?: { officialOnly?: boolean },
  ) {
    const tacData = ((proposal.hqVerification ?? {}) as { tacRound1?: Record<string, unknown> }).tacRound1 ?? {};
    const frozen = tacData.officialPackage as {
      documentId?: string;
      versionNo?: number;
      fileName?: string | null;
      frozenAt?: string;
      label?: string;
      copiedFromDocumentId?: string;
      copiedFromVersionNo?: number;
    } | null | undefined;
    if (frozen?.documentId) {
      const sourceDoc = await this.resolveTac1ReviewedSourceDocument(tenantId, proposal, documents);
      const sourceVersionNo = sourceDoc?.versionNo ?? frozen.copiedFromVersionNo ?? frozen.versionNo ?? null;
      const sourceFileName = sourceDoc?.fileName ?? frozen.fileName ?? 'dpr-complete.pdf';
      const viewDocumentId = sourceDoc?.id ?? frozen.copiedFromDocumentId ?? frozen.documentId;

      return {
        documentId: viewDocumentId,
        versionNo: sourceVersionNo,
        fileName: sourceFileName,
        frozenAt: frozen.frozenAt ?? null,
        label: frozen.label ?? 'TAC Round 1 — Reviewed DPR (official)',
        isOfficial: true,
        sourceCompleteDprVersionNo: sourceVersionNo,
        sourceCompleteDprFileName: sourceFileName,
        snapshotDocumentId: frozen.documentId,
      };
    }
    if (options?.officialOnly) return null;
    const latest = this.getLatestDocumentByType(documents, 'dpr_complete_pdf');
    if (!latest) return null;
    return {
      documentId: latest.id,
      versionNo: latest.versionNo,
      fileName: latest.fileName ?? 'dpr-complete.pdf',
      frozenAt: null,
      label: 'Complete DPR PDF (latest — TAC1 official package not frozen)',
      isOfficial: false,
    };
  }

  private getRound2ExaminationDocumentMode(proposal: DprProposal): 'tac1_official' | 'ee_compliance_resubmit' {
    const tac2 = ((proposal.hqVerification ?? {}) as { tacRound2?: Record<string, unknown> }).tacRound2 ?? {};
    if (tac2.examinationDocumentMode === 'ee_compliance_resubmit') {
      return 'ee_compliance_resubmit';
    }
    return 'tac1_official';
  }

  private resolveEeComplianceDprPackage(proposal: DprProposal, documents: DprProposalDocument[]) {
    const tac2 = ((proposal.hqVerification ?? {}) as { tacRound2?: Record<string, unknown> }).tacRound2 ?? {};
    const pkg = tac2.eeCompliancePackage as {
      dprDocumentId?: string;
      dprFileName?: string | null;
    } | null | undefined;
    const doc = pkg?.dprDocumentId
      ? documents.find((d) => d.id === pkg.dprDocumentId) ?? null
      : this.getLatestDocumentByType(documents, 'dpr_complete_pdf');
    if (!doc) return null;
    return {
      documentId: doc.id,
      versionNo: doc.versionNo,
      fileName: pkg?.dprFileName ?? doc.fileName ?? 'dpr-revised.pdf',
      label: 'Division EE — Revised Complete DPR',
      isOfficial: false,
      isEeCompliance: true,
    };
  }

  private resolveEeComplianceDocPackage(proposal: DprProposal, documents: DprProposalDocument[]) {
    const tac2 = ((proposal.hqVerification ?? {}) as { tacRound2?: Record<string, unknown> }).tacRound2 ?? {};
    const pkg = tac2.eeCompliancePackage as {
      complianceDocumentId?: string;
      complianceFileName?: string | null;
    } | null | undefined;
    const doc = pkg?.complianceDocumentId
      ? documents.find((d) => d.id === pkg.complianceDocumentId) ?? null
      : this.getLatestDocumentByType(documents, 'tac_round2_compliance');
    if (!doc) return null;
    return {
      documentId: doc.id,
      versionNo: doc.versionNo,
      fileName: pkg?.complianceFileName ?? doc.fileName ?? 'round2-compliance.pdf',
      label: 'Division EE — Round 2 Compliance Document',
      isEeCompliance: true,
    };
  }

  private async assertRound2ExaminationDocumentsReady(
    tenantId: string,
    proposal: DprProposal,
    documents: DprProposalDocument[],
  ) {
    if (this.getRound2ExaminationDocumentMode(proposal) === 'ee_compliance_resubmit') {
      const dpr = this.resolveEeComplianceDprPackage(proposal, documents);
      const compliance = this.resolveEeComplianceDocPackage(proposal, documents);
      if (!dpr?.documentId || !documents.find((d) => d.id === dpr.documentId)?.fileUrl) {
        throw new BadRequestException('Division EE revised Complete DPR PDF is missing for compliance re-examination');
      }
      if (!compliance?.documentId || !documents.find((d) => d.id === compliance.documentId)?.fileUrl) {
        throw new BadRequestException('Round 2 compliance document is missing for Secretariat re-examination');
      }
      return;
    }
    await this.assertOfficialTac1PackageForSecretariat(tenantId, proposal, documents);
  }

  /** Secretariat Stage 7 — only the DPR frozen at TAC Round 1 clearance (not later division uploads). */
  private async assertOfficialTac1PackageForSecretariat(
    tenantId: string,
    proposal: DprProposal,
    documents: DprProposalDocument[],
  ) {
    const pkg = await this.resolveOfficialTac1PackageAsync(tenantId, proposal, documents, { officialOnly: true });
    if (!pkg?.documentId) {
      throw new BadRequestException(
        'TAC Round 1 official DPR is not on file. Super Admin must approve TAC Round 1 (freezes the reviewed PDF) before Secretariat examination.',
      );
    }
    const doc = documents.find((d) => d.id === pkg.documentId);
    if (!doc?.fileUrl) {
      throw new BadRequestException(
        'TAC Round 1 official DPR file is missing on the server. Ask Super Admin to re-upload or restore the frozen package.',
      );
    }
  }

  private async buildStage6Readiness(
    tenantId: string,
    proposal: DprProposal,
    documents: DprProposalDocument[],
    roles: string[] = [],
  ) {
    if (!['tac_round1_cleared', 'tac_round1_final', 'secretariat_submitted'].includes(proposal.status)) {
      return null;
    }

    const uploadedTypes = new Set(documents.map((d) => d.documentType));
    const attachmentDefs = [
      { key: 'dpr_complete_pdf', label: 'Complete DPR PDF', required: true },
      { key: 'cost_estimate', label: 'Cost Estimates', required: true },
      { key: 'boq_tac_excel', label: 'BOQ Excel (TAC)', required: false },
      { key: 'boq_draft', label: 'BOQ Draft', required: false },
      { key: 'engineering_design', label: 'Engineering Design', required: false },
      { key: 'hydraulic_design', label: 'Hydraulic Design', required: false },
      { key: 'survey_drawings', label: 'Survey Drawings', required: false },
      { key: 'gis_maps', label: 'GIS Maps', required: false },
      { key: 'env_social', label: 'Environmental & Social', required: false },
      { key: 'technical_specs', label: 'Technical Specifications', required: false },
    ];
    const officialTac1 = await this.resolveOfficialTac1PackageAsync(tenantId, proposal, documents);
    const attachments = attachmentDefs.map((def) => {
      if (def.key === 'dpr_complete_pdf') {
        return {
          ...def,
          label: officialTac1?.label ?? def.label,
          attached: !!officialTac1?.documentId,
          officialDocumentId: officialTac1?.documentId ?? null,
        };
      }
      return {
        ...def,
        attached: uploadedTypes.has(def.key),
        officialDocumentId: null as string | null,
      };
    });
    const missingAttachments = attachments.filter((a) => a.required && !a.attached).map((a) => a.label);

    const tacData = ((proposal.hqVerification ?? {}) as { tacRound1?: Record<string, unknown> }).tacRound1 ?? {};
    const observations = (Array.isArray(tacData.observations) ? tacData.observations : []) as Array<{
      action?: string;
      remarks?: string | null;
      complianceNotes?: string | null;
      at?: string;
    }>;
    const tacRecommendations = observations.length
      ? observations
      : proposal.tacRound1Remarks
        ? [{ action: 'tac_cleared', remarks: proposal.tacRound1Remarks, at: tacData.reviewedAt as string | undefined }]
        : [];

    const secretariatData = ((proposal.hqVerification ?? {}) as {
      secretariatSubmission?: Record<string, unknown>;
    }).secretariatSubmission ?? null;

    const hasFundingInfo = !!(proposal.fundingSource?.trim() || proposal.preliminaryEstimate);
    if (!hasFundingInfo) {
      missingAttachments.push('Funding source or preliminary estimate');
    }

    return {
      canForward: ['tac_round1_cleared', 'tac_round1_final'].includes(proposal.status)
        && missingAttachments.length === 0
        && this.canForwardToSecretariat(roles),
      canTrack: proposal.status === 'secretariat_submitted',
      forwarded: proposal.status === 'secretariat_submitted',
      secretariatRef: proposal.secretariatRef,
      secretariatForwardedAt: proposal.secretariatForwardedAt,
      receivingAuthority: (secretariatData?.receivingAuthority as string | null) ?? null,
      submissionComments: (secretariatData?.comments as string | null) ?? null,
      fundingRequirementNotes: (secretariatData?.fundingRequirementNotes as string | null) ?? null,
      preliminaryEstimate: proposal.preliminaryEstimate,
      fundingSource: proposal.fundingSource,
      attachments,
      missingAttachments,
      tacRecommendations,
      submission: secretariatData,
      officialTac1Dpr: await this.resolveOfficialTac1PackageAsync(tenantId, proposal, documents),
    };
  }

  private async buildStage7Readiness(
    tenantId: string,
    proposal: DprProposal,
    documents: DprProposalDocument[],
    roles: string[] = [],
  ) {
    const stage7Statuses = [
      'secretariat_submitted',
      'tac_round2_review',
      'tac_round2_corrections_required',
      'tac_round2_compliance',
      'tac_round2_compliance_submitted',
      'govt_technical_concurrence',
    ];
    if (!stage7Statuses.includes(proposal.status)) return null;

    const canPrepare = this.isDivisionPreparer(roles);
    const uploadedTypes = new Set(documents.map((d) => d.documentType));
    const hasCompletePdf = uploadedTypes.has('dpr_complete_pdf');
    const hasRound2ComplianceDoc = uploadedTypes.has('tac_round2_compliance');

    const tac2Data = ((proposal.hqVerification ?? {}) as { tacRound2?: Record<string, unknown> }).tacRound2 ?? {};
    const observations = (Array.isArray(tac2Data.observations) ? tac2Data.observations : []) as Array<{
      action?: string;
      remarks?: string | null;
      complianceNotes?: string | null;
      at?: string;
    }>;
    const complianceResponses = ((
      (proposal.hqVerification as { tacRound2Compliance?: { responses?: unknown[] } })?.tacRound2Compliance?.responses
    ) ?? []) as Array<{ at?: string; observationResponse?: string | null; comments?: string | null }>;

    const revisionActions = new Set(['suggest_corrections', 'return_revision', 'request_info']);
    const pendingObservations = observations.filter((o) => revisionActions.has(o.action ?? ''));
    const officialTac1Dpr = await this.resolveOfficialTac1PackageAsync(tenantId, proposal, documents, { officialOnly: true });

    return {
      status: proposal.status,
      canBeginExamination: proposal.status === 'secretariat_submitted' && this.canReviewTacRound2(roles),
      canReview: proposal.status === 'tac_round2_review' && this.canReviewTacRound2(roles),
      canBeginCompliance: proposal.status === 'tac_round2_corrections_required' && canPrepare,
      canUploadCompliance: DPR_ROUND2_COMPLIANCE_STATUSES.includes(
        proposal.status as typeof DPR_ROUND2_COMPLIANCE_STATUSES[number],
      ) && canPrepare,
      canSubmitCompliance: DPR_ROUND2_COMPLIANCE_STATUSES.includes(
        proposal.status as typeof DPR_ROUND2_COMPLIANCE_STATUSES[number],
      ) && hasCompletePdf && hasRound2ComplianceDoc && canPrepare,
      canAssignToEe: isSuperAdmin(roles) && DPR_ROUND2_COMPLIANCE_STATUSES.includes(
        proposal.status as typeof DPR_ROUND2_COMPLIANCE_STATUSES[number],
      ),
      canReviewComplianceAdmin: isSuperAdmin(roles) && proposal.status === 'tac_round2_compliance_submitted',
      canForwardComplianceToSecretariat: isSuperAdmin(roles) && proposal.status === 'tac_round2_compliance_submitted',
      eeComplianceAssignment: this.buildEeComplianceAssignmentView(proposal, roles),
      concurrenceGranted: proposal.status === 'govt_technical_concurrence',
      concurrenceGrantedAt: (tac2Data.concurrenceGrantedAt as string | null) ?? null,
      examination: (tac2Data.examination as Record<string, unknown> | null) ?? null,
      hasCompletePdf,
      hasRound2ComplianceDoc,
      pendingObservations,
      complianceResponses,
      latestTacRemarks: proposal.tacRound2Remarks ?? null,
      officialTac1Dpr,
      officialTac1Missing: !officialTac1Dpr?.documentId,
    };
  }

  private async buildTacRound2ReviewState(
    tenantId: string,
    proposal: DprProposal,
    roles: string[] = [],
    documents: DprProposalDocument[] = [],
  ) {
    const tacData = ((proposal.hqVerification ?? {}) as { tacRound2?: Record<string, unknown> }).tacRound2 ?? {};
    const checklistState = (tacData.checklist ?? {}) as Record<string, boolean>;
    const checklist = DPR_TAC_ROUND2_CHECKLIST.map((item) => ({
      key: item.key,
      label: item.label,
      reviewed: !!checklistState[item.key],
    }));
    const allReviewed = checklist.every((c) => c.reviewed);
    const pending = proposal.status === 'tac_round2_review';
    const canBeginExamination = proposal.status === 'secretariat_submitted' && this.canReviewTacRound2(roles);
    const canReview = pending && this.canReviewTacRound2(roles);
    const inRound2Stage = [
      'secretariat_submitted',
      'tac_round2_review',
      'tac_round2_corrections_required',
      'tac_round2_compliance',
      'tac_round2_compliance_submitted',
      'govt_technical_concurrence',
    ].includes(proposal.status);
    const observations = Array.isArray(tacData.observations) ? tacData.observations : [];
    const complianceResponses = ((
      (proposal.hqVerification as { tacRound2Compliance?: { responses?: unknown[] } })?.tacRound2Compliance?.responses
    ) ?? []);

    const resultsPublished = proposal.status === 'govt_technical_concurrence'
      || ['sanctioned', 'tender_prep_initiated', 'tender_processing', 'tender_published'].includes(proposal.status);
    const canViewRound2Details = isSecretariatReviewer(roles)
      || isStateReviewer(roles)
      || (isDivisionDprViewer(roles) && resultsPublished);
    const divisionTracking = inRound2Stage && isDivisionDprViewer(roles) && !canViewRound2Details;
    const adminTracking = inRound2Stage && isStateReviewer(roles) && !this.canReviewTacRound2(roles);
    const examinationDocumentMode = this.getRound2ExaminationDocumentMode(proposal);
    const officialTac1Dpr = await this.resolveOfficialTac1PackageAsync(tenantId, proposal, documents, { officialOnly: true });
    const eeComplianceDpr = examinationDocumentMode === 'ee_compliance_resubmit'
      ? this.resolveEeComplianceDprPackage(proposal, documents)
      : null;
    const eeComplianceDoc = examinationDocumentMode === 'ee_compliance_resubmit'
      ? this.resolveEeComplianceDocPackage(proposal, documents)
      : null;

    return {
      pending,
      inRound2Stage,
      canBeginExamination,
      canReview,
      concurrenceGranted: proposal.status === 'govt_technical_concurrence',
      concurrenceGrantedAt: (tacData.concurrenceGrantedAt as string | null) ?? null,
      examination: (tacData.examination as Record<string, unknown> | null) ?? null,
      examinationDocumentMode,
      viewMode: canBeginExamination
        ? 'initiate' as const
        : canReview
          ? 'review' as const
          : inRound2Stage
            ? 'track' as const
            : 'read' as const,
      trackingStatusLabel: divisionTracking ? 'Under Secretariat Examination' : null,
      resultsPublished,
      canViewRound2Details,
      awaitingAdminLiaison: adminTracking,
      officialTac1Dpr: examinationDocumentMode === 'tac1_official' ? officialTac1Dpr : null,
      officialTac1Missing: examinationDocumentMode === 'tac1_official' && !officialTac1Dpr?.documentId,
      eeComplianceDpr,
      eeComplianceDoc,
      eeCompliancePackageMissing: examinationDocumentMode === 'ee_compliance_resubmit'
        && (!eeComplianceDpr?.documentId || !eeComplianceDoc?.documentId),
      checklist,
      allReviewed,
      complianceNotes: canViewRound2Details ? ((tacData.complianceNotes as string | null) ?? null) : null,
      lastAction: (tacData.lastAction as string | null) ?? null,
      reviewedAt: (tacData.reviewedAt as string | null) ?? null,
      observations: canViewRound2Details ? observations : [],
      complianceResponses: canViewRound2Details ? complianceResponses : [],
    };
  }

  private canReviewTacRound2(roles: string[]) {
    return isSecretariatReviewer(roles);
  }

  private assertCanReviewTacRound2(roles: string[]) {
    if (!this.canReviewTacRound2(roles)) {
      throw new ForbiddenException('Only Secretariat officials can conduct Round 2 TAC / Govt examination');
    }
  }

  private buildStage8Readiness(
    proposal: DprProposal,
    documents: DprProposalDocument[],
    roles: string[] = [],
    sanction: DprSanction | null = null,
    laReadiness?: LaReadiness,
  ) {
    const stage8Statuses = ['govt_technical_concurrence', 'sanctioned', 'tender_prep_initiated', 'tender_processing', 'tender_published'];
    if (!stage8Statuses.includes(proposal.status)) return null;

    const uploadedTypes = new Set(documents.map((d) => d.documentType));
    const attachmentDefs = [
      { key: 'sanction_aa', label: 'Administrative Approval (AA)', required: true },
      { key: 'sanction_es', label: 'Expenditure Sanction (ES)', required: true },
      { key: 'sanction_budget_allocation', label: 'Budget Allocation Order', required: true },
      { key: 'funding_release_order', label: 'Funding Release Order', required: true },
    ];
    const attachments = attachmentDefs.map((def) => ({
      ...def,
      attached: uploadedTypes.has(def.key),
    }));
    const missingDocuments = attachments.filter((a) => a.required && !a.attached).map((a) => a.label);

    const sanctionData = sanction ?? null;
    const adminSanctionMeta = ((proposal.hqVerification ?? {}) as {
      administrativeSanction?: Record<string, unknown>;
    }).administrativeSanction ?? null;

    const la = laReadiness ?? {
      hasCase: false,
      complete: false,
      canSubmitDprStage3: false,
      canRecordSanction: false,
      parcelsTotal: 0,
      parcelsPossession: 0,
      clearancesPending: [],
      estimatedCompensation: 0,
      missingActions: ['Create Land Acquisition case'],
    };

    return {
      status: proposal.status,
      sanctioned: ['sanctioned', 'tender_prep_initiated', 'tender_processing', 'tender_published'].includes(proposal.status),
      canRecord: proposal.status === 'govt_technical_concurrence'
        && missingDocuments.length === 0
        && this.canRecordSanction(roles)
        && la.canRecordSanction,
      canUploadDocuments: proposal.status === 'govt_technical_concurrence' && this.canRecordSanction(roles),
      canTrack: proposal.status !== 'govt_technical_concurrence',
      attachments,
      missingDocuments,
      laReadiness: la,
      laMissingActions: la.missingActions,
      preliminaryEstimate: proposal.preliminaryEstimate,
      fundingSource: proposal.fundingSource,
      sanction: sanctionData ? {
        administrativeApprovalNo: sanctionData.administrativeApprovalNo,
        expenditureSanctionNo: sanctionData.expenditureSanctionNo,
        sanctionedAmount: sanctionData.sanctionedAmount,
        budgetHead: sanctionData.budgetHead,
        sanctionDate: sanctionData.sanctionDate,
        fundingReleaseRef: sanctionData.fundingReleaseRef,
        recordedAt: sanctionData.createdAt,
      } : null,
      recordedSanction: adminSanctionMeta,
    };
  }

  private buildStage9Readiness(
    proposal: DprProposal,
    documents: DprProposalDocument[],
    roles: string[] = [],
    sanction: DprSanction | null = null,
    tender: DprTenderPackage | null = null,
  ) {
    const stage9Statuses = ['sanctioned', 'tender_prep_initiated', 'tender_processing', 'tender_published'];
    if (!stage9Statuses.includes(proposal.status)) return null;

    const uploadedTypes = new Set(documents.map((d) => d.documentType));
    const prepDocs = DPR_STAGE_9_PREP_DOCUMENT_TYPES.map((type) => {
      const def = DPR_DOCUMENT_TYPES.find((d) => d.type === type);
      return {
        key: type,
        label: def?.label ?? type,
        attached: uploadedTypes.has(type),
        required: type !== 'tender_task_order',
      };
    });
    const missingPrepDocuments = prepDocs.filter((d) => d.required && !d.attached).map((d) => d.label);

    const init = ((proposal.hqVerification ?? {}) as { tenderInitiation?: Record<string, unknown> }).tenderInitiation ?? null;
    const hasSanction = !!(sanction?.administrativeApprovalNo || sanction?.expenditureSanctionNo);

    return {
      status: proposal.status,
      canInitiate: proposal.status === 'sanctioned' && hasSanction && this.canInitiateTenderPrep(roles),
      initiated: proposal.status === 'tender_prep_initiated',
      canUploadPrepDocuments: proposal.status === 'tender_prep_initiated' && this.canUploadTenderPrep(roles),
      canTrack: ['tender_prep_initiated', 'tender_processing', 'tender_published'].includes(proposal.status),
      taskOrderNo: (init?.taskOrderNo as string | null) ?? tender?.taskOrderRef ?? null,
      packageNo: (init?.packageNo as string | null) ?? tender?.packageNo ?? null,
      initiatedAt: (init?.initiatedAt as string | null) ?? null,
      divisionName: (init?.divisionName as string | null) ?? null,
      divisionInstructions: (init?.divisionInstructions as string | null) ?? null,
      addressalItems: (init?.addressalItems as Array<{ key: string; label: string; addressed: boolean }>) ?? [],
      prepDocuments: prepDocs,
      missingPrepDocuments,
      prepComplete: proposal.status === 'tender_prep_initiated' && missingPrepDocuments.length === 0,
      sanction: sanction ? {
        administrativeApprovalNo: sanction.administrativeApprovalNo,
        expenditureSanctionNo: sanction.expenditureSanctionNo,
        sanctionedAmount: sanction.sanctionedAmount,
        budgetHead: sanction.budgetHead,
        sanctionDate: sanction.sanctionDate,
      } : null,
    };
  }

  private buildStage10Readiness(
    proposal: DprProposal,
    documents: DprProposalDocument[],
    roles: string[] = [],
    tender: DprTenderPackage | null = null,
  ) {
    const stage10Statuses = ['tender_prep_initiated', 'tender_processing', 'tender_published'];
    if (!stage10Statuses.includes(proposal.status)) return null;

    const uploadedTypes = new Set(documents.map((d) => d.documentType));
    const prepDocs = DPR_TENDER_PROCESSING_PREP_CHECKLIST.map((item) => ({
      key: item.key,
      label: item.label,
      attached: uploadedTypes.has(item.key),
      required: true,
    }));
    const missingDocuments = prepDocs.filter((d) => d.required && !d.attached).map((d) => d.label);

    const tp = ((proposal.hqVerification ?? {}) as { tenderProcessing?: Record<string, unknown> }).tenderProcessing ?? null;
    const approvalLevel = (tp?.approvalLevel as string | null) ?? null;
    const approvals = (tp?.approvals as Array<{
      level?: string;
      action?: string;
      remarks?: string | null;
      at?: string;
    }>) ?? [];

    const isEe = roles.includes('ee');
    const canActJe = proposal.status === 'tender_processing' && approvalLevel === 'je' && (roles.includes('je') || isEe);
    const canActAe = proposal.status === 'tender_processing' && approvalLevel === 'ae' && (roles.includes('ae') || isEe);
    const canActEe = proposal.status === 'tender_processing' && approvalLevel === 'ee' && isEe;
    const canPublish = proposal.status === 'tender_processing' && approvalLevel === 'cleared' && this.canPublishTender(roles);

    return {
      status: proposal.status,
      canBeginProcessing: proposal.status === 'tender_prep_initiated'
        && missingDocuments.length === 0
        && this.canBeginTenderProcessing(roles),
      canUploadDocuments: DPR_TENDER_UPLOAD_STATUSES.includes(proposal.status as typeof DPR_TENDER_UPLOAD_STATUSES[number])
        && this.canUploadTenderProcessing(roles),
      inProcessing: proposal.status === 'tender_processing',
      published: proposal.status === 'tender_published',
      preparationComplete: missingDocuments.length === 0,
      prepDocuments: prepDocs,
      missingDocuments,
      approvalLevel,
      approvalLevelLabel: approvalLevel ? (DPR_TENDER_APPROVAL_LABELS[approvalLevel] ?? approvalLevel) : null,
      canActJe,
      canActAe,
      canActEe,
      canPublish,
      canReview: canActJe || canActAe || canActEe,
      approvals,
      packageNo: tender?.packageNo ?? null,
      nitRef: tender?.nitRef ?? null,
      publishedAt: tender?.publishedAt ?? null,
    };
  }

  private canBeginTenderProcessing(roles: string[]) {
    return roles.includes('ee');
  }

  private assertCanBeginTenderProcessing(roles: string[]) {
    if (!this.canBeginTenderProcessing(roles)) {
      throw new ForbiddenException('Only Division EE can begin tender processing');
    }
  }

  private assertCanActTenderApproval(level: 'je' | 'ae' | 'ee' | 'cleared', roles: string[]) {
    assertNotSuperAdminRolesForOperations(roles, 'tender approval review');
    const roleMap: Record<string, string> = { je: 'je', ae: 'ae', ee: 'ee' };
    const required = roleMap[level];
    const isEe = roles.includes('ee');
    const hasRole = !!required && (roles.includes(required) || ((level === 'je' || level === 'ae') && isEe));
    if (!hasRole) {
      throw new ForbiddenException(`Only ${DPR_TENDER_APPROVAL_LABELS[level] ?? level} officials can act at this stage`);
    }
  }

  private canPublishTender(roles: string[]) {
    return roles.includes('ee');
  }

  private assertCanPublishTender(roles: string[]) {
    if (!this.canPublishTender(roles)) {
      throw new ForbiddenException('Only Division EE can publish tender');
    }
  }

  private canInitiateTenderPrep(roles: string[]) {
    return isStateReviewer(roles);
  }

  private assertCanInitiateTenderPrep(roles: string[]) {
    if (!this.canInitiateTenderPrep(roles)) {
      throw new ForbiddenException('Only Super Admin / HQ officials can issue tender preparation task to Division EE');
    }
  }

  private canUploadTenderPrep(roles: string[]) {
    return roles.includes('ee');
  }

  private canUploadTenderProcessing(roles: string[]) {
    return roles.includes('ee');
  }

  private assertCanUploadTenderPrep(roles: string[]) {
    if (!this.canUploadTenderPrep(roles)) {
      throw new ForbiddenException('Only Division EE can upload tender preparation documents');
    }
  }

  private assertCanUploadTenderProcessing(roles: string[]) {
    if (!this.canUploadTenderProcessing(roles)) {
      throw new ForbiddenException('Only Division EE can upload tender processing documents');
    }
  }

  private canRecordSanction(roles: string[]) {
    return canRecordDprSanction(roles);
  }

  private assertCanRecordSanction(roles: string[]) {
    if (!this.canRecordSanction(roles)) {
      throw new ForbiddenException('Only Secretariat officials can record administrative sanction');
    }
  }

  private canForwardToSecretariat(roles: string[]) {
    return isStateReviewer(roles);
  }

  private assertCanForwardToSecretariat(roles: string[]) {
    if (!this.canForwardToSecretariat(roles)) {
      throw new ForbiddenException('Only HQ officials (SE/CE/CGM/MD) can forward DPR to Secretariat / Sachiwalaya');
    }
  }

  private isStage3UploadStatus(status: string) {
    return (DPR_STAGE_3_UPLOAD_STATUSES as readonly string[]).includes(status)
      || (DPR_ROUND2_COMPLIANCE_STATUSES as readonly string[]).includes(status);
  }

  private async buildStage5Readiness(
    tenantId: string,
    proposal: DprProposal,
    documents: DprProposalDocument[],
    roles: string[] = [],
  ) {
    if (!DPR_REVISION_STATUSES.includes(proposal.status as typeof DPR_REVISION_STATUSES[number])) {
      return null;
    }
    const canPrepare = this.isDivisionPreparer(roles);
    const uploadedTypes = new Set(documents.map((d) => d.documentType));
    const missingDocuments = DPR_STAGE_3_REQUIRED_DOCUMENT_TYPES
      .filter((t) => !uploadedTypes.has(t))
      .map((t) => DPR_DOCUMENT_TYPES.find((d) => d.type === t)?.label ?? t);
    const hasCompletePdf = uploadedTypes.has('dpr_complete_pdf');
    const hasBoqExcel = uploadedTypes.has('boq_tac_excel');
    let boqValidationPassed = false;
    if (hasBoqExcel) {
      const boqRow = await this.boqValidationRepo.findOne({
        where: { tenantId, proposalId: proposal.id },
        order: { validatedAt: 'DESC' },
      });
      boqValidationPassed = boqRow != null && boqRow.status === 'passed';
    }
    const tacData = ((proposal.hqVerification ?? {}) as { tacRound1?: Record<string, unknown> }).tacRound1 ?? {};
    const observations = (Array.isArray(tacData.observations) ? tacData.observations : []) as Array<{
      at?: string;
      action?: string;
      remarks?: string | null;
      complianceNotes?: string | null;
    }>;
    const revisionActions = new Set(['suggest_corrections', 'return_revision', 'request_info']);
    const tacObservations = observations.filter((o) => revisionActions.has(o.action ?? ''));

    return {
      status: proposal.status,
      canBeginRevision: proposal.status === 'tac_corrections_required' && canPrepare,
      canUpload: canPrepare,
      canResubmitToTac: DPR_REVISION_STATUSES.includes(proposal.status as typeof DPR_REVISION_STATUSES[number])
        && missingDocuments.length === 0
        && hasCompletePdf
        && hasBoqExcel
        && boqValidationPassed
        && canPrepare,
      missingDocuments,
      hasCompletePdf,
      hasBoqExcel,
      boqValidationPassed,
      tacObservations,
      latestTacRemarks: proposal.tacRound1Remarks ?? null,
      revisionResponses: ((proposal.hqVerification as { dprRevision?: { responses?: unknown[] } })?.dprRevision?.responses ?? []),
    };
  }

  private async assertStage3Ready(tenantId: string, proposal: DprProposal) {
    const documents = await this.docRepo.find({ where: { tenantId, proposalId: proposal.id } });
    const laReadiness = await this.landAcquisitionService.getReadinessForProposal(tenantId, proposal.id);
    const readiness = await this.buildStage3Readiness(tenantId, proposal, documents, [], laReadiness);
    if (!readiness.complete) {
      throw new BadRequestException(
        `Cannot submit DPR for TAC — missing documents: ${readiness.missingDocuments.join(', ')}`,
      );
    }
    if (!readiness.canSubmitToHq) {
      if (readiness.tacPackage?.hasBoqExcel && !readiness.tacPackage?.boqValidationPassed) {
        throw new BadRequestException('BOQ must pass validation before TAC submission — fix highlighted errors and re-upload Excel');
      }
      if (laReadiness.missingActions.length) {
        throw new BadRequestException(
          `Land acquisition incomplete: ${laReadiness.missingActions.join('; ')}`,
        );
      }
    }
  }

  private assertCanUploadDocument(proposal: DprProposal, roles: string[], documentType: string) {
    const def = DPR_DOCUMENT_TYPES.find((d) => d.type === documentType);
    if (!def) throw new BadRequestException(`Unknown document type: ${documentType}`);

    if (def.stage === 1) {
      this.assertEditableDraft(proposal);
      this.assertCanInitiate(roles);
    } else if (def.stage === 3) {
      if (DPR_TAC_PACKAGE_TYPES.includes(documentType as typeof DPR_TAC_PACKAGE_TYPES[number])) {
        throw new BadRequestException(
          `Use dedicated upload endpoints for ${def.label} (Complete PDF / BOQ Excel with auto-validation)`,
        );
      }
      if (!this.isStage3UploadStatus(proposal.status)) {
        throw new BadRequestException('Stage 3 documents can only be uploaded during DPR preparation, revision, or Round 2 compliance');
      }
      this.assertCanPrepare(roles);
    } else if (def.stage === 7) {
      if (!DPR_ROUND2_COMPLIANCE_STATUSES.includes(proposal.status as typeof DPR_ROUND2_COMPLIANCE_STATUSES[number])) {
        throw new BadRequestException('Round 2 compliance documents can only be uploaded during Stage 7 compliance phase');
      }
      this.assertCanPrepare(roles);
    } else if (def.stage === 8) {
      if (!DPR_SANCTION_RECORD_STATUSES.includes(proposal.status as typeof DPR_SANCTION_RECORD_STATUSES[number])) {
        throw new BadRequestException('Sanction documents can only be uploaded before administrative sanction is recorded');
      }
      this.assertCanRecordSanction(roles);
    } else if (def.stage === 9) {
      if (!DPR_TENDER_PREP_STATUSES.includes(proposal.status as typeof DPR_TENDER_PREP_STATUSES[number])) {
        throw new BadRequestException('Tender preparation documents can only be uploaded after HQ initiates tender preparation');
      }
      this.assertCanUploadTenderPrep(roles);
    } else if (def.stage === 10) {
      if (!DPR_TENDER_UPLOAD_STATUSES.includes(proposal.status as typeof DPR_TENDER_UPLOAD_STATUSES[number])) {
        throw new BadRequestException('Tender processing documents can only be uploaded during tender preparation or processing');
      }
      this.assertCanUploadTenderProcessing(roles);
    } else {
      throw new BadRequestException(`Upload not supported for document type "${def.label}" at this stage`);
    }
    this.assertValidDocumentType(documentType, proposal);
  }

  /** Workflow statuses may allow uploads before currentStage advances (e.g. Stage 10 docs during tender_prep_initiated). */
  private getUploadEffectiveStage(proposal: DprProposal): number {
    let effective = proposal.currentStage;
    if ((DPR_TENDER_UPLOAD_STATUSES as readonly string[]).includes(proposal.status)) {
      effective = Math.max(effective, 10);
    }
    if ((DPR_TENDER_PREP_STATUSES as readonly string[]).includes(proposal.status)) {
      effective = Math.max(effective, 9);
    }
    if ((DPR_SANCTION_RECORD_STATUSES as readonly string[]).includes(proposal.status)) {
      effective = Math.max(effective, 8);
    }
    if ((DPR_ROUND2_COMPLIANCE_STATUSES as readonly string[]).includes(proposal.status)) {
      effective = Math.max(effective, 7);
    }
    if (this.isStage3UploadStatus(proposal.status)) {
      effective = Math.max(effective, 3);
    }
    return effective;
  }

  private isDivisionPreparer(roles: string[]) {
    return roles.some((r) => ['ee', 'je', 'ae'].includes(r));
  }

  private isStateReviewerRole(roles: string[]) {
    return isStateReviewer(roles);
  }

  private assertCanPrepare(roles: string[]) {
    if (!this.isDivisionPreparer(roles)) {
      throw new ForbiddenException('Only Division EE, JE, or AE can prepare, upload, and submit Stage 3 DPR documents');
    }
  }

  private assertCanCommentStage3(roles: string[]) {
    if (!this.isStateReviewerRole(roles)) {
      throw new ForbiddenException('Only HQ officials (SE/CE/CGM/MD) can save Stage 3 review remarks');
    }
  }

  private async buildStage1Readiness(proposal: DprProposal, documents: DprProposalDocument[]) {
    const uploadedTypes = new Set(
      documents.map((d) => d.documentType),
    );
    const missingDocuments = DPR_STAGE_1_REQUIRED_DOCUMENT_TYPES.filter((t) => !uploadedTypes.has(t))
      .map((t) => DPR_DOCUMENT_TYPES.find((d) => d.type === t)?.label ?? t);
    const missingFields: string[] = [];
    if (!proposal.preliminaryEstimate || Number(proposal.preliminaryEstimate) <= 0) {
      missingFields.push('Preliminary estimate (₹)');
    }
    if (!proposal.schemeJustification?.trim()) {
      missingFields.push('Scheme justification (narrative)');
    }
    const hasGis = (
      (proposal.latitude != null && proposal.longitude != null)
      || (proposal.gisBoundary && Object.keys(proposal.gisBoundary).length > 0)
      || uploadedTypes.has('gis_boundary')
    );
    if (!hasGis) {
      missingFields.push('GIS location / project boundaries');
    }
    return {
      complete: missingDocuments.length === 0 && missingFields.length === 0,
      missingDocuments,
      missingFields,
      canForwardToHq: ['proposal_draft', 'proposal_returned'].includes(proposal.status)
        && missingDocuments.length === 0
        && missingFields.length === 0,
    };
  }

  private async assertStage1Ready(tenantId: string, proposal: DprProposal) {
    const documents = await this.docRepo.find({ where: { tenantId, proposalId: proposal.id } });
    const readiness = await this.buildStage1Readiness(proposal, documents);
    if (!readiness.complete) {
      const parts = [
        ...readiness.missingDocuments.map((d) => `Missing document: ${d}`),
        ...readiness.missingFields.map((f) => `Missing field: ${f}`),
      ];
      throw new BadRequestException(`Cannot forward for review — ${parts.join('; ')}`);
    }
  }

  private async generatePrepOrderNo(tenantId: string): Promise<string> {
    const issued = await this.proposalRepo
      .createQueryBuilder('p')
      .where('p.tenant_id = :tenantId', { tenantId })
      .andWhere('p.dpr_prep_order_no IS NOT NULL')
      .getCount();
    const fy = this.currentFinancialYear();
    return `DPO-${fy}-${String(issued + 1).padStart(4, '0')}`;
  }

  private async generateTaskOrderNo(tenantId: string): Promise<string> {
    const count = await this.tenderRepo.count({ where: { tenantId } });
    const fy = this.currentFinancialYear();
    return `TPO-${fy}-${String(count + 1).padStart(4, '0')}`;
  }

  private buildHqReviewState(proposal: DprProposal, roles: string[] = []) {
    const pending = ['hq_review', 'proposal_submitted'].includes(proposal.status);
    const canReview = pending && this.isStateReviewerRole(roles);
    const verification = (proposal.hqVerification ?? {}) as Record<string, boolean>;
    const checklist = DPR_HQ_VERIFICATION_ITEMS.map((item) => ({
      key: item.key,
      label: item.label,
      verified: !!verification[item.key],
    }));
    const allVerified = checklist.every((c) => c.verified);
    return {
      pending,
      canReview,
      checklist,
      allVerified,
      proposalSummary: {
        preliminaryEstimate: proposal.preliminaryEstimate,
        fundingSource: proposal.fundingSource,
        priority: proposal.priority,
        schemeJustification: proposal.schemeJustification,
      },
    };
  }

  private buildTacReviewState(proposal: DprProposal, roles: string[] = []) {
    const tacData = ((proposal.hqVerification ?? {}) as { tacRound1?: Record<string, unknown> }).tacRound1 ?? {};
    const checklistState = (tacData.checklist ?? {}) as Record<string, boolean>;
    const checklist = DPR_TAC_ROUND1_CHECKLIST.map((item) => ({
      key: item.key,
      label: item.label,
      reviewed: !!checklistState[item.key],
    }));
    const allReviewed = checklist.every((c) => c.reviewed);
    const pending = proposal.status === 'tac_round1_review';
    const canForward = proposal.status === 'dpr_submitted' && this.canForwardToTac(roles);
    const canReview = pending && this.canReviewTac(roles);
    const inTacStage = [
      'dpr_submitted',
      'tac_round1_review',
      'tac_corrections_required',
      'dpr_revision',
      'tac_round1_cleared',
    ].includes(proposal.status);
    const observations = Array.isArray(tacData.observations) ? tacData.observations : [];
    const divisionTracking = inTacStage && !canReview && !canForward && isDivisionDprViewer(roles);
    return {
      pending,
      inTacStage,
      canReview,
      canForward,
      viewMode: canForward ? 'forward' as const : canReview ? 'review' as const : inTacStage ? 'track' as const : 'read' as const,
      trackingStatusLabel: proposal.status === 'tac_round1_review' && divisionTracking ? 'Under Review' : null,
      awaitingDivisionAction: divisionTracking
        && ['tac_corrections_required', 'dpr_revision'].includes(proposal.status),
      hasFeedback: observations.length > 0,
      checklist,
      allReviewed,
      complianceNotes: (tacData.complianceNotes as string | null) ?? null,
      lastAction: (tacData.lastAction as string | null) ?? null,
      reviewedAt: (tacData.reviewedAt as string | null) ?? null,
      observations,
    };
  }

  private canForwardToTac(roles: string[]) {
    return isStateReviewer(roles);
  }

  private canReviewTac(roles: string[]) {
    return isStateReviewer(roles);
  }

  private assertCanForwardToTac(roles: string[]) {
    if (!this.canForwardToTac(roles)) {
      throw new ForbiddenException('Only Super Admin or HQ officials (SE/CE/CGM/MD) can forward completed DPR to TAC Section');
    }
  }

  private assertCanReviewTac(roles: string[]) {
    if (!this.canReviewTac(roles)) {
      throw new ForbiddenException('Only Super Admin or HQ officials (SE/CE/CGM/MD) can perform Round 1 TAC review');
    }
  }

  private getEeComplianceAssignment(hq: Record<string, unknown> | null | undefined) {
    const raw = hq?.eeComplianceAssignment;
    if (!raw || typeof raw !== 'object') return null;
    const a = raw as {
      assignedBy?: string;
      assignedAt?: string;
      message?: string | null;
      acknowledgedAt?: string | null;
      acknowledgedBy?: string | null;
    };
    if (!a.assignedAt) return null;
    return {
      assignedBy: a.assignedBy ?? null,
      assignedAt: a.assignedAt,
      message: a.message ?? null,
      acknowledgedAt: a.acknowledgedAt ?? null,
      acknowledgedBy: a.acknowledgedBy ?? null,
    };
  }

  private isEeComplianceAssignmentPending(proposal: DprProposal): boolean {
    if (!DPR_ROUND2_COMPLIANCE_STATUSES.includes(proposal.status as typeof DPR_ROUND2_COMPLIANCE_STATUSES[number])) {
      return false;
    }
    const assignment = this.getEeComplianceAssignment(proposal.hqVerification as Record<string, unknown> | null);
    return !!assignment && !assignment.acknowledgedAt;
  }

  private buildEeComplianceAssignmentView(proposal: DprProposal, roles: string[] = []) {
    const inCompliancePhase = DPR_ROUND2_COMPLIANCE_STATUSES.includes(
      proposal.status as typeof DPR_ROUND2_COMPLIANCE_STATUSES[number],
    );
    const assignment = this.getEeComplianceAssignment(proposal.hqVerification as Record<string, unknown> | null);
    if (!assignment && !inCompliancePhase) return null;

    const isPending = !!assignment && !assignment.acknowledgedAt && inCompliancePhase;
    return {
      ...assignment,
      isPending: isPending && this.isDivisionPreparer(roles),
      canAssign: isSuperAdmin(roles) && inCompliancePhase,
    };
  }

  private acknowledgeEeComplianceAssignment(hq: Record<string, unknown>, userId: string) {
    const assignment = this.getEeComplianceAssignment(hq);
    if (!assignment || assignment.acknowledgedAt) return hq;
    return {
      ...hq,
      eeComplianceAssignment: {
        ...assignment,
        acknowledgedAt: new Date().toISOString(),
        acknowledgedBy: userId,
      },
    };
  }

  private assertCanReviewHq(roles: string[]) {
    if (!this.isStateReviewerRole(roles)) {
      throw new ForbiddenException('Only Super Admin or HQ officials (SE/CE/CGM/MD) can review and approve DPR proposals');
    }
  }

  private assertCanPlatformInitiate(roles: string[]) {
    if (isSuperAdmin(roles)) return;
    this.assertCanInitiate(roles);
  }

  private assertCanInitiate(roles: string[]) {
    assertNotSuperAdminRolesForOperations(roles, 'division DPR proposal operations');
    if (!roles.some((r) => ['ee', 'je', 'ae'].includes(r))) {
      throw new ForbiddenException('Only Division EE, JE, or AE can initiate and prepare Stage 1 proposals');
    }
  }

  private assertEditableDraft(proposal: DprProposal) {
    if (!['proposal_draft', 'proposal_returned'].includes(proposal.status)) {
      throw new BadRequestException('Documents and draft fields can only be edited before state review submission');
    }
  }

  private assertValidDocumentType(documentType: string, proposal: DprProposal) {
    const def = DPR_DOCUMENT_TYPES.find((d) => d.type === documentType);
    if (!def) throw new BadRequestException(`Unknown document type: ${documentType}`);
    const effectiveStage = this.getUploadEffectiveStage(proposal);
    if (def.stage > effectiveStage) {
      throw new BadRequestException(`Document type "${def.label}" is not required until stage ${def.stage}`);
    }
  }

  private getAllowedActions(status: string): string[] {
    const map: Record<string, string[]> = {
      proposal_draft: [],
      proposal_submitted: [],
      hq_review: [],
      proposal_returned: [],
      dpr_prep_approved: [],
      dpr_preparation: [],
      dpr_submitted: ['forward_tac'],
      tac_round1_review: ['approve', 'request_corrections', 'request_info', 'return'],
      tac_corrections_required: ['submit'],
      dpr_revision: ['submit'],
      tac_round1_cleared: ['forward_secretariat'],
      tac_round1_final: ['forward_secretariat'],
      secretariat_submitted: ['approve'],
      tac_round2_review: ['approve', 'request_corrections'],
      tac_round2_corrections_required: ['submit'],
      tac_round2_compliance: ['submit'],
      tac_round2_compliance_submitted: ['forward_secretariat', 'return_to_ee'],
      govt_technical_concurrence: ['record_sanction'],
      sanctioned: ['initiate_tender'],
      tender_prep_initiated: ['approve'],
      tender_processing: ['publish_tender'],
      tender_published: ['close'],
    };
    return map[status] ?? [];
  }
}
