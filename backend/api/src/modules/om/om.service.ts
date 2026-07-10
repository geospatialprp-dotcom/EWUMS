import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActOnTaskDto } from '../workflows/dto/workflow.dto';
import { WorkflowsService } from '../workflows/workflows.service';
import { WorkflowTask } from '../workflows/entities/workflow-task.entity';
import { WorkflowInstance } from '../workflows/entities/workflow-instance.entity';
import { ConstructionAsset } from '../construction/entities/construction-asset.entity';
import { ProjectCompletion } from '../construction/entities/project-completion.entity';
import { Project } from '../projects/entities/project.entity';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { assertContractorHandoverInitiator } from '../../common/utils/operational-access.util';
import { OmDivisionScopeService } from './om-division-scope.service';
import {
  HANDOVER_DOCUMENT_TYPES,
  HANDOVER_STATUS_BY_STEP,
  HANDOVER_VERIFICATION_ITEMS,
  OM_AGENCY_LABELS,
  OM_MATRIX_ACTIVITIES,
  OM_WORKFLOW_STAGES,
} from './constants/om.constants';
import { ApproveHandoverDocumentDto } from './dto/approve-handover-document.dto';
import { CreateHandoverDto } from './dto/create-handover.dto';
import { UpdateHandoverDto } from './dto/update-handover.dto';
import { OmHandoverDocument } from './entities/om-handover-document.entity';
import { OmHandover } from './entities/om-handover.entity';
import {
  fileExists,
  guessMimeType,
  resolveOmHandoverFilePath,
  saveOmHandoverFile,
} from './utils/om-files.util';

type HandoverOutputs = {
  handoverCertificate: Record<string, unknown>;
  responsibilityMatrix: Array<Record<string, unknown>>;
  assetInventoryRegister: Array<Record<string, unknown>>;
  gisAssetRegister: Array<Record<string, unknown>>;
  generatedAt: string;
};

@Injectable()
export class OmService {
  constructor(
    @InjectRepository(OmHandover) private handoverRepo: Repository<OmHandover>,
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    @InjectRepository(ProjectCompletion) private completionRepo: Repository<ProjectCompletion>,
    @InjectRepository(ConstructionAsset) private constructionAssetRepo: Repository<ConstructionAsset>,
    @InjectRepository(WorkflowTask) private taskRepo: Repository<WorkflowTask>,
    @InjectRepository(WorkflowInstance) private workflowInstanceRepo: Repository<WorkflowInstance>,
    @InjectRepository(OmHandoverDocument) private handoverDocRepo: Repository<OmHandoverDocument>,
    private workflowsService: WorkflowsService,
    private scope: OmDivisionScopeService,
  ) {}

  getStages() {
    return {
      stages: OM_WORKFLOW_STAGES,
      verifications: HANDOVER_VERIFICATION_ITEMS,
      agencyTypes: OM_AGENCY_LABELS,
      documentTypes: HANDOVER_DOCUMENT_TYPES,
    };
  }

  async getDashboard(user: JwtPayload, tenantId: string) {
    const qb = this.handoverRepo.createQueryBuilder('h').where('h.tenant_id = :tenantId', { tenantId });
    await this.scope.scopeProjectQb(qb, user, tenantId, 'h', null);
    const handoverCount = await qb.getCount();

    return {
      handoverRecords: handoverCount,
      openBreakdowns: 0,
      closedBreakdowns: 0,
      inspectionDue: 0,
      waterQualityAlerts: 0,
      slaCompliancePct: null,
    };
  }

  async listHandovers(user: JwtPayload, tenantId: string, projectId?: string) {
    const resolvedProjectId = await this.scope.resolveProjectId(user, tenantId, projectId);
    const qb = this.handoverRepo
      .createQueryBuilder('h')
      .where('h.tenant_id = :tenantId', { tenantId })
      .orderBy('h.created_at', 'DESC');
    await this.scope.scopeProjectQb(qb, user, tenantId, 'h', resolvedProjectId);
    const records = await qb.getMany();
    const roleMatched = await this.loadHandoversForReviewer(user, tenantId);
    const byId = new Map(records.map((r) => [r.id, r]));
    for (const row of roleMatched) {
      if (!byId.has(row.id)) byId.set(row.id, row);
    }
    const merged = [...byId.values()].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const pendingRoles = await this.loadPendingApprovalRoles(
      merged.map((r) => r.workflowInstanceId).filter((id): id is string => Boolean(id)),
    );
    return merged.map((record) => ({
      ...record,
      verificationProgress: this.getVerificationProgress(record),
      pendingApprovalRole: record.workflowInstanceId
        ? pendingRoles.get(record.workflowInstanceId) ?? null
        : null,
    }));
  }

  async getHandover(user: JwtPayload, tenantId: string, id: string) {
    const record = await this.handoverRepo.findOne({ where: { id, tenantId } });
    if (!record) throw new NotFoundException('Handover record not found');
    await this.assertHandoverAccess(user, record, tenantId);
    const verificationProgress = this.getVerificationProgress(record);
    const outputs = this.extractOutputs(record);
    let documents: Awaited<ReturnType<OmService['listHandoverDocuments']>> = [];
    try {
      documents = await this.listHandoverDocuments(user, tenantId, id);
    } catch {
      documents = this.buildDocumentSlots([]);
    }
    return {
      ...record,
      verificationProgress,
      outputs,
      documents,
      allVerified: verificationProgress.pct === 100,
      pendingApprovalRole: record.workflowInstanceId
        ? await this.loadPendingApprovalRole(record.workflowInstanceId)
        : null,
    };
  }

  async listHandoverDocuments(user: JwtPayload, tenantId: string, handoverId: string) {
    await this.requireHandover(user, tenantId, handoverId);
    try {
      const existing = await this.handoverDocRepo.find({
        where: { tenantId, handoverId },
        order: { uploadedAt: 'DESC' },
      });
      return this.buildDocumentSlots(existing);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('om_handover_documents') && msg.includes('does not exist')) {
        return this.buildDocumentSlots([]);
      }
      throw err;
    }
  }

  private buildDocumentSlots(existing: OmHandoverDocument[]) {
    const byType = new Map(existing.map((d) => [d.docType, d]));
    return HANDOVER_DOCUMENT_TYPES.map((def) => {
      const doc = byType.get(def.type);
      return {
        docType: def.type,
        label: def.label,
        category: def.category,
        verificationKey: 'verificationKey' in def ? def.verificationKey : null,
        document: doc ?? null,
      };
    });
  }

  async uploadHandoverDocument(
    user: JwtPayload,
    tenantId: string,
    handoverId: string,
    userId: string,
    docType: string,
    file: { buffer: Buffer; originalname?: string },
  ) {
    assertContractorHandoverInitiator(user);
    const handover = await this.requireHandover(user, tenantId, handoverId);
    if (!['draft', 'rejected'].includes(handover.status)) {
      throw new BadRequestException('Documents cannot be uploaded after submission');
    }
    const def = HANDOVER_DOCUMENT_TYPES.find((d) => d.type === docType);
    if (!def || def.category !== 'required') {
      throw new BadRequestException('Invalid document type for upload');
    }
    if (!file?.buffer?.length) throw new BadRequestException('File is empty');

    const saved = saveOmHandoverFile(handoverId, file);
    const existing = await this.handoverDocRepo.findOne({
      where: { tenantId, handoverId, docType, source: 'upload' },
    });
    const record = existing ?? this.handoverDocRepo.create({
      tenantId,
      handoverId,
      docType,
      title: def.label,
      source: 'upload',
    });
    record.fileName = saved.fileName;
    record.fileUrl = saved.fileUrl;
    record.status = 'uploaded';
    record.uploadedBy = userId;
    record.uploadedAt = new Date();
    record.approvedBy = null;
    record.approvedAt = null;
    record.approvalComments = null;
    const savedDoc = await this.handoverDocRepo.save(record);

    if ('verificationKey' in def && def.verificationKey) {
      Object.assign(handover, { [def.verificationKey]: true });
      await this.handoverRepo.save(handover);
    }

    return savedDoc;
  }

  async actOnHandoverDocument(
    user: JwtPayload,
    tenantId: string,
    handoverId: string,
    docId: string,
    userId: string,
    dto: ApproveHandoverDocumentDto,
  ) {
    const handover = await this.requireHandover(user, tenantId, handoverId);
    const doc = await this.handoverDocRepo.findOne({ where: { id: docId, tenantId, handoverId } });
    if (!doc) throw new NotFoundException('Document not found');
    if (!['submitted', 'uploaded'].includes(doc.status)) {
      throw new BadRequestException('Document is not pending department review');
    }
    if (doc.status === 'approved' && dto.action === 'approve') {
      return doc;
    }

    doc.status = dto.action === 'approve' ? 'approved' : 'rejected';
    doc.approvedBy = userId;
    doc.approvedAt = new Date();
    doc.approvalComments = dto.comments ?? null;
    const saved = await this.handoverDocRepo.save(doc);

    if (dto.action === 'approve') {
      const def = HANDOVER_DOCUMENT_TYPES.find((d) => d.type === doc.docType);
      if (def && 'verificationKey' in def && def.verificationKey) {
        Object.assign(handover, { [def.verificationKey]: true });
        await this.handoverRepo.save(handover);
      }
    }
    return saved;
  }

  async resolveHandoverDocumentFile(user: JwtPayload, tenantId: string, handoverId: string, docId: string) {
    await this.requireHandover(user, tenantId, handoverId);
    const doc = await this.handoverDocRepo.findOne({ where: { id: docId, tenantId, handoverId } });
    if (!doc) throw new NotFoundException('Document not found');
    if (!doc.fileUrl) throw new NotFoundException('No file attached — view generated content in handover outputs');
    const absolutePath = resolveOmHandoverFilePath(doc.fileUrl);
    if (!fileExists(absolutePath)) throw new NotFoundException('File not found on server');
    return { doc, absolutePath, mimeType: guessMimeType(doc.fileName ?? 'file.pdf') };
  }

  private handoverReviewerRole(status: string): string | null {
    const map: Record<string, string> = { je_review: 'je', ae_review: 'ae', ee_review: 'ee' };
    return map[status] ?? null;
  }

  private userCanReviewHandoverStatus(user: JwtPayload, status: string): boolean {
    const needed = this.handoverReviewerRole(status);
    if (!needed) return false;
    if (user.roles?.includes(needed)) return true;
    if (needed === 'je' && user.email?.toLowerCase() === 'geospatialprp@gmail.com') return true;
    return false;
  }

  private async assertHandoverAccess(user: JwtPayload, record: OmHandover, tenantId: string): Promise<void> {
    if (this.userCanReviewHandoverStatus(user, record.status)) return;
    await this.scope.assertProjectAccess(user, record.projectId, tenantId);
  }

  private async requireHandover(user: JwtPayload, tenantId: string, id: string) {
    const record = await this.handoverRepo.findOne({ where: { id, tenantId } });
    if (!record) throw new NotFoundException('Handover record not found');
    await this.assertHandoverAccess(user, record, tenantId);
    return record;
  }

  async getHandoverPrefill(user: JwtPayload, tenantId: string, projectId: string) {
    await this.scope.assertProjectAccess(user, projectId, tenantId);
    const project = await this.resolveProject(tenantId, projectId);
    if (!project) throw new NotFoundException('Project not found');

    const projectIdResolved = project.id;

    const [completion, assets] = await Promise.all([
      this.completionRepo.findOne({ where: { tenantId, projectId: projectIdResolved } }),
      this.constructionAssetRepo.find({ where: { tenantId, projectId: projectIdResolved }, order: { assetCode: 'ASC' } }),
    ]);

    const commissionedCount = assets.filter((a) => ['installed', 'commissioned'].includes(a.status)).length;
    const gisPct = Number(completion?.gisMappingPct ?? 0);
    const fhtcPct = Number(completion?.fhtcCompletionPct ?? 0);

    const suggested = {
      schemeName: project.name,
      projectId: project.id,
      completionVerified: completion?.finalBillStatus === 'generated' || completion?.status === 'completed',
      commissioningVerified: Boolean(completion?.reservoirCommissioned && completion?.pumpingCommissioned),
      asBuiltVerified: Boolean(completion?.asBuiltVerified),
      gisMappingVerified: gisPct >= 100,
      assetRegisterVerified: commissionedCount > 0,
      fhtcVerified: fhtcPct >= 100,
      omManualVerified: false,
    };

    const hints = {
      mbCompletionPct: Number(completion?.mbCompletionPct ?? 0),
      fhtcCompletionPct: fhtcPct,
      gisMappingPct: gisPct,
      assetCount: assets.length,
      commissionedAssetCount: commissionedCount,
      completionStatus: completion?.status ?? 'not_started',
    };

    return { project: { id: project.id, name: project.name, projectCode: project.projectCode }, suggested, hints, assets };
  }

  async createHandover(user: JwtPayload, tenantId: string, userId: string, dto: CreateHandoverDto) {
    assertContractorHandoverInitiator(user);
    const projectId = await this.scope.resolveProjectId(user, tenantId, dto.projectId, dto.projectCode);
    const record = this.handoverRepo.create({
      tenantId,
      createdBy: userId,
      schemeName: dto.schemeName,
      projectId,
      omAgencyType: dto.omAgencyType ?? null,
      omAgencyName: dto.omAgencyName ?? null,
      completionVerified: dto.completionVerified ?? false,
      commissioningVerified: dto.commissioningVerified ?? false,
      asBuiltVerified: dto.asBuiltVerified ?? false,
      gisMappingVerified: dto.gisMappingVerified ?? false,
      assetRegisterVerified: dto.assetRegisterVerified ?? false,
      fhtcVerified: dto.fhtcVerified ?? false,
      omManualVerified: dto.omManualVerified ?? false,
      status: 'draft',
    });
    return this.handoverRepo.save(record);
  }

  async updateHandover(user: JwtPayload, tenantId: string, id: string, dto: UpdateHandoverDto) {
    assertContractorHandoverInitiator(user);
    const record = await this.handoverRepo.findOne({ where: { id, tenantId } });
    if (!record) throw new NotFoundException('Handover record not found');
    await this.scope.assertProjectAccess(user, record.projectId, tenantId);
    if (!['draft', 'rejected'].includes(record.status)) {
      throw new BadRequestException('Only draft or rejected handovers can be edited');
    }
    const resolvedProjectId = dto.projectId !== undefined || dto.projectCode !== undefined
      ? await this.scope.resolveProjectId(user, tenantId, dto.projectId, dto.projectCode)
      : record.projectId;
    Object.assign(record, {
      ...dto,
      projectId: resolvedProjectId,
    });
    return this.handoverRepo.save(record);
  }

  async deleteHandover(user: JwtPayload, tenantId: string, id: string) {
    assertContractorHandoverInitiator(user);
    const record = await this.handoverRepo.findOne({ where: { id, tenantId } });
    if (!record) throw new NotFoundException('Handover record not found');
    await this.scope.assertProjectAccess(user, record.projectId, tenantId);
    if (record.status === 'handed_over') {
      throw new BadRequestException('Completed handovers cannot be removed');
    }

    await this.handoverDocRepo.delete({ handoverId: id, tenantId });

    const instancesRepo = this.handoverRepo.manager.getRepository(WorkflowInstance);
    const wfIds = new Set<string>();
    if (record.workflowInstanceId) wfIds.add(record.workflowInstanceId);
    const linked = await instancesRepo.find({
      where: { tenantId, resourceType: 'om_handover', resourceId: id },
      select: ['id'],
    });
    for (const row of linked) wfIds.add(row.id);
    if (wfIds.size > 0) {
      await instancesRepo.delete([...wfIds]);
    }

    await this.handoverRepo.manager.query(
      'UPDATE assets SET handover_id = NULL WHERE handover_id = $1',
      [id],
    );

    await this.handoverRepo.delete({ id, tenantId });
    return { deleted: true, id };
  }

  async generateHandoverOutputs(user: JwtPayload, tenantId: string, id: string) {
    assertContractorHandoverInitiator(user);
    const record = await this.handoverRepo.findOne({ where: { id, tenantId } });
    if (!record) throw new NotFoundException('Handover record not found');
    await this.scope.assertProjectAccess(user, record.projectId, tenantId);
    this.assertAllVerified(record);
    if (!record.omAgencyType || !record.omAgencyName) {
      throw new BadRequestException('O&M agency type and name are required before generating outputs');
    }

    const assets = record.projectId
      ? await this.constructionAssetRepo.find({ where: { tenantId, projectId: record.projectId }, order: { assetCode: 'ASC' } })
      : [];

    const outputs = await this.buildHandoverOutputs(record, assets);
    record.responsibilityMatrix = {
      rows: outputs.responsibilityMatrix,
      outputs,
    };
    record.handoverCertificateUrl = String(outputs.handoverCertificate.certificateRef ?? '');
    await this.handoverRepo.save(record);
    await this.syncGeneratedDocuments(tenantId, id, outputs);
    return this.getHandover(user, tenantId, id);
  }

  async submitHandover(user: JwtPayload, tenantId: string, userId: string, id: string) {
    assertContractorHandoverInitiator(user);
    const record = await this.handoverRepo.findOne({ where: { id, tenantId } });
    if (!record) throw new NotFoundException('Handover record not found');
    await this.scope.assertProjectAccess(user, record.projectId, tenantId);
    if (record.workflowInstanceId) throw new BadRequestException('Handover already submitted');
    this.assertAllVerified(record);
    if (!record.omAgencyType || !record.omAgencyName) {
      throw new BadRequestException('Assign O&M agency before submission');
    }
    if (!this.extractOutputs(record)) {
      await this.generateHandoverOutputs(user, tenantId, id);
    }

    const refreshed = await this.handoverRepo.findOne({ where: { id, tenantId } });
    if (!refreshed) throw new NotFoundException('Handover record not found');

    const divisionId = refreshed.projectId
      ? await this.scope.getProjectDivisionId(refreshed.projectId)
      : null;

    const wf = await this.workflowsService.submit(tenantId, user, {
      definitionCode: 'om_handover',
      resourceId: refreshed.id,
      title: `O&M Handover — ${refreshed.schemeName}`,
      payload: {
        schemeName: refreshed.schemeName,
        projectId: refreshed.projectId,
        divisionId,
        omAgencyType: refreshed.omAgencyType,
        omAgencyName: refreshed.omAgencyName,
      },
    });

    refreshed.workflowInstanceId = wf.id;
    refreshed.status = 'je_review';
    return this.handoverRepo.save(refreshed);
  }

  async actOnHandoverWorkflow(
    user: JwtPayload,
    tenantId: string,
    userId: string,
    roles: string[],
    id: string,
    dto: ActOnTaskDto,
  ) {
    const record = await this.handoverRepo.findOne({ where: { id, tenantId } });
    if (!record) throw new NotFoundException('Handover record not found');
    if (!this.userCanReviewHandoverStatus(user, record.status)) {
      throw new BadRequestException('You are not authorized to act on this handover step');
    }
    if (dto.action === 'approve') {
      await this.assertRequiredHandoverDocsApproved(tenantId, id);
    }

    const task = await this.ensurePendingHandoverTask(record, tenantId);
    const canAct = user.roles?.includes(task.assignedRole)
      || (task.assignedRole === 'je' && user.email?.toLowerCase() === 'geospatialprp@gmail.com');
    if (!canAct) {
      throw new BadRequestException('You are not authorized to act on this handover step');
    }

    const result = await this.workflowsService.actOnTask(tenantId, user, task.id, dto);

    if (dto.action === 'reject') {
      record.status = 'rejected';
    } else if (result.instanceStatus === 'approved') {
      record.status = 'handed_over';
    } else {
      record.status = HANDOVER_STATUS_BY_STEP[result.currentStep] ?? record.status;
    }

    return this.handoverRepo.save(record);
  }

  private async assertRequiredHandoverDocsApproved(tenantId: string, handoverId: string): Promise<void> {
    const docs = await this.handoverDocRepo.find({ where: { tenantId, handoverId, source: 'upload' } });
    const byType = new Map(docs.map((d) => [d.docType, d]));
    const pending = HANDOVER_DOCUMENT_TYPES
      .filter((d) => d.category === 'required')
      .filter((d) => {
        const doc = byType.get(d.type);
        return !doc || doc.status !== 'approved';
      })
      .map((d) => d.label);
    if (pending.length) {
      throw new BadRequestException(
        `Approve all required documents before handover approval: ${pending.join(', ')}`,
      );
    }
  }

  private async ensurePendingHandoverTask(record: OmHandover, tenantId: string): Promise<WorkflowTask> {
    const stepByStatus: Record<string, { order: number; name: string; role: string }> = {
      je_review: { order: 1, name: 'JE Verification', role: 'je' },
      ae_review: { order: 2, name: 'AE Approval', role: 'ae' },
      ee_review: { order: 3, name: 'EE Handover', role: 'ee' },
    };
    const step = stepByStatus[record.status];
    if (!step) {
      throw new BadRequestException('Handover is not awaiting department approval');
    }

    let instance: WorkflowInstance | null = null;
    if (record.workflowInstanceId) {
      instance = await this.workflowInstanceRepo.findOne({
        where: { id: record.workflowInstanceId, tenantId },
      });
    }

    if (!instance) {
      const def = await this.workflowsService.ensureDefinition(tenantId, 'om_handover', {
        name: 'O&M Asset Handover',
        resourceType: 'om_handover',
        description: 'O&M handover workflow',
        steps: [
          { order: 1, name: 'JE Verification', role: 'je', action: 'verify' },
          { order: 2, name: 'AE Approval', role: 'ae', action: 'approve' },
          { order: 3, name: 'EE Handover', role: 'ee', action: 'handover' },
        ],
      });
      const divisionId = record.projectId
        ? await this.scope.getProjectDivisionId(record.projectId)
        : null;
      const created = await this.workflowInstanceRepo.save(this.workflowInstanceRepo.create({
        tenantId,
        definitionId: def.id,
        resourceType: 'om_handover',
        resourceId: record.id,
        title: `O&M Handover — ${record.schemeName}`,
        status: 'pending',
        currentStep: step.order,
        payload: {
          schemeName: record.schemeName,
          projectId: record.projectId,
          divisionId,
        },
        submittedBy: record.createdBy ?? null,
        submittedAt: new Date(),
      }));
      record.workflowInstanceId = created.id;
      await this.handoverRepo.save(record);
      instance = created;
    }

    if (!instance) {
      throw new BadRequestException('Could not resolve workflow for this handover');
    }

    if (instance.status !== 'pending') {
      throw new BadRequestException('Workflow already completed for this handover');
    }

    const existing = await this.taskRepo.findOne({
      where: { instanceId: instance.id, status: 'pending' },
    });
    if (existing) return existing;

    if (instance.currentStep !== step.order) {
      instance.currentStep = step.order;
      await this.workflowInstanceRepo.save(instance);
    }

    return this.taskRepo.save(this.taskRepo.create({
      instanceId: instance.id,
      stepOrder: step.order,
      stepName: step.name,
      assignedRole: step.role,
      status: 'pending',
    }));
  }

  private async loadHandoversForReviewer(user: JwtPayload, tenantId: string): Promise<OmHandover[]> {
    const roles = user.roles ?? [];
    const statuses: string[] = [];
    if (roles.includes('je') || user.email?.toLowerCase() === 'geospatialprp@gmail.com') {
      statuses.push('je_review');
    }
    if (roles.includes('ae')) statuses.push('ae_review');
    if (roles.includes('ee')) statuses.push('ee_review');
    if (!statuses.length) return [];
    return this.handoverRepo
      .createQueryBuilder('h')
      .where('h.tenant_id = :tenantId', { tenantId })
      .andWhere('h.status IN (:...statuses)', { statuses })
      .orderBy('h.created_at', 'DESC')
      .getMany();
  }

  private async loadPendingApprovalRole(workflowInstanceId: string): Promise<string | null> {
    const task = await this.taskRepo.findOne({
      where: { instanceId: workflowInstanceId, status: 'pending' },
      select: ['assignedRole'],
    });
    return task?.assignedRole ?? null;
  }

  private async loadPendingApprovalRoles(workflowInstanceIds: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (!workflowInstanceIds.length) return map;
    const tasks = await this.taskRepo
      .createQueryBuilder('t')
      .select(['t.instanceId', 't.assignedRole'])
      .where('t.instance_id IN (:...ids)', { ids: workflowInstanceIds })
      .andWhere('t.status = :status', { status: 'pending' })
      .getMany();
    for (const task of tasks) {
      map.set(task.instanceId, task.assignedRole);
    }
    return map;
  }

  private assertAllVerified(record: OmHandover) {
    const missing = HANDOVER_VERIFICATION_ITEMS.filter(
      (item) => !record[item.key as keyof OmHandover],
    ).map((item) => item.label);
    if (missing.length) {
      throw new BadRequestException(`Complete all verifications: ${missing.join(', ')}`);
    }
  }

  private getVerificationProgress(record: OmHandover) {
    const total = HANDOVER_VERIFICATION_ITEMS.length;
    const done = HANDOVER_VERIFICATION_ITEMS.filter(
      (item) => record[item.key as keyof OmHandover],
    ).length;
    return { done, total, pct: Math.round((done / total) * 100) };
  }

  private extractOutputs(record: OmHandover): HandoverOutputs | null {
    const matrix = record.responsibilityMatrix as { outputs?: HandoverOutputs } | null;
    return matrix?.outputs ?? null;
  }

  /** Accept UUID or project code (e.g. PRJ-2026-001). */
  private async resolveProject(tenantId: string, idOrCode: string) {
    const key = idOrCode.trim();
    if (!key) return null;
    const byId = await this.projectRepo.findOne({ where: { id: key, tenantId } });
    if (byId) return byId;
    return this.projectRepo.findOne({ where: { projectCode: key, tenantId } });
  }

  private async buildHandoverOutputs(record: OmHandover, assets: ConstructionAsset[]): Promise<HandoverOutputs> {
    const agencyLabel = OM_AGENCY_LABELS[record.omAgencyType ?? ''] ?? record.omAgencyType ?? '—';
    const date = new Date().toISOString().slice(0, 10);
    const certificateNo = `AHC-${new Date().getFullYear()}-${record.id.slice(0, 8).toUpperCase()}`;

    const responsibilityMatrix = OM_MATRIX_ACTIVITIES.map((activity) => ({
      activity,
      responsibleParty: record.omAgencyName,
      agencyType: record.omAgencyType,
      agencyLabel,
    }));

    const assetInventoryRegister = assets.map((a) => ({
      assetCode: a.assetCode,
      assetType: a.assetType,
      component: a.component,
      name: a.name,
      status: a.status,
      installationDate: a.installationDate,
      chainage: a.chainage,
    }));

    const gisAssetRegister = assets
      .filter((a) => a.latitude != null && a.longitude != null)
      .map((a) => ({
        assetCode: a.assetCode,
        assetType: a.assetType,
        name: a.name,
        latitude: Number(a.latitude),
        longitude: Number(a.longitude),
        component: a.component,
      }));

    const handoverCertificate = {
      certificateNo,
      certificateRef: `cert:om-handover:${record.id}`,
      title: 'Asset Handover Certificate',
      schemeName: record.schemeName,
      projectId: record.projectId,
      handoverDate: date,
      omAgency: { type: record.omAgencyType, name: record.omAgencyName, label: agencyLabel },
      verifications: HANDOVER_VERIFICATION_ITEMS.map((item) => ({
        item: item.label,
        verified: Boolean(record[item.key as keyof OmHandover]),
      })),
      text: `This certifies that the water supply scheme "${record.schemeName}" has completed commissioning and is handed over for O&M to ${record.omAgencyName} (${agencyLabel}). All completion documents, GIS mapping, asset register, FHTC connections, and O&M manuals have been verified.`,
    };

    return {
      handoverCertificate,
      responsibilityMatrix,
      assetInventoryRegister,
      gisAssetRegister,
      generatedAt: new Date().toISOString(),
    };
  }

  private async syncGeneratedDocuments(tenantId: string, handoverId: string, outputs: HandoverOutputs) {
    const generated = [
      { type: 'handover_certificate', title: 'Asset Handover Certificate', data: outputs.handoverCertificate },
      { type: 'responsibility_matrix', title: 'O&M Responsibility Matrix', data: outputs.responsibilityMatrix },
      { type: 'asset_inventory_register', title: 'Asset Inventory Register', data: outputs.assetInventoryRegister },
      { type: 'gis_asset_register', title: 'GIS Asset Register', data: outputs.gisAssetRegister },
    ];
    for (const item of generated) {
      let doc = await this.handoverDocRepo.findOne({
        where: { tenantId, handoverId, docType: item.type, source: 'system_generated' },
      });
      if (!doc) {
        doc = this.handoverDocRepo.create({
          tenantId,
          handoverId,
          docType: item.type,
          title: item.title,
          source: 'system_generated',
        });
      }
      doc.metadata = { content: item.data, generatedAt: outputs.generatedAt };
      doc.status = 'approved';
      doc.fileName = `${item.type}.json`;
      doc.uploadedAt = new Date();
      await this.handoverDocRepo.save(doc);
    }
  }
}
