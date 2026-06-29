import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { statSync, writeFileSync } from 'fs';
import { In, Repository } from 'typeorm';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { DivisionAccessService } from '../divisions/division-access.service';
import { DivisionStaffProvisionerService } from '../divisions/division-staff-provisioner.service';
import { ProjectProgressSyncService, milestoneComponents } from '../construction/project-progress-sync.service';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { OrthomosaicConfigDto } from './dto/orthomosaic-config.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { DprProposal } from '../dpr-planning/entities/dpr-proposal.entity';
import { ProjectMilestone } from './entities/project-milestone.entity';
import { OrthomosaicConfig, Project } from './entities/project.entity';

export type PortfolioReadinessPhase = 'no_dpr' | 'awaiting_tender' | 'ready';

export type PortfolioReadiness = {
  phase: PortfolioReadinessPhase;
  constructionUnlocked: boolean;
  canCreateProject: boolean;
  publishedTenderCount: number;
  pipelineProposalCount: number;
  projectCount: number;
  readySchemes: Array<{
    id: string;
    proposalNo: string;
    title: string;
    divisionId: string | null;
  }>;
};
import {
  ensureDir,
  fileExists,
  isAllowedOrthomosaicFileName,
  orthomosaicFileAbsolutePath,
  orthomosaicFileApiUrl,
  orthomosaicMimeType,
  orthomosaicUploadDir,
  removeOrthomosaicFile,
  uniqueOrthomosaicFileName,
} from './utils/orthomosaic-files.util';
import { buildProjectCodeFromName, isValidProjectCode } from './utils/project-code.util';
import { assertNotSuperAdminForOperations } from '../../common/utils/operational-access.util';
import { DPR_GIS_WORKSPACE_PROJECT_STATUS } from './constants/project-status.constants';
import { FeatureClassesService } from './feature-classes.service';

function sortMilestones(milestones: ProjectMilestone[] = []): ProjectMilestone[] {
  return [...milestones].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return (a.dueDate ?? '').localeCompare(b.dueDate ?? '');
  });
}

const DEFAULT_CONSTRUCTION_MILESTONES = [
  { name: 'Survey & DPR', sortOrder: 1 },
  { name: 'Pipeline Laying', sortOrder: 2 },
  { name: 'FHTC Connections', sortOrder: 3 },
  { name: 'Testing & Commissioning', sortOrder: 4 },
] as const;

const HQ_PROJECT_REGISTRAR_ROLES = ['se', 'ce', 'cgm', 'md'] as const;

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project) private projectsRepo: Repository<Project>,
    @InjectRepository(ProjectMilestone) private milestonesRepo: Repository<ProjectMilestone>,
    @InjectRepository(DprProposal) private dprProposalRepo: Repository<DprProposal>,
    private progressSync: ProjectProgressSyncService,
    private divisionAccess: DivisionAccessService,
    private divisionStaff: DivisionStaffProvisionerService,
    private featureClassesService: FeatureClassesService,
  ) {}

  async getPortfolioReadiness(
    tenantId: string,
    user: JwtPayload,
    targetDivisionId?: string | null,
  ): Promise<PortfolioReadiness> {
    const proposalQb = this.dprProposalRepo.createQueryBuilder('dp')
      .where('dp.tenant_id = :tenantId', { tenantId });
    await this.divisionAccess.applyDivisionScope(proposalQb, user, 'dp', tenantId);
    if (targetDivisionId) {
      proposalQb.andWhere('dp.division_id = :targetDivisionId', { targetDivisionId });
    }
    const proposals = await proposalQb.getMany();

    const projectQb = this.projectsRepo.createQueryBuilder('p')
      .where('p.tenant_id = :tenantId', { tenantId })
      .andWhere('p.status != :gisWorkspace', { gisWorkspace: DPR_GIS_WORKSPACE_PROJECT_STATUS });
    await this.divisionAccess.applyProjectScope(projectQb, user, 'p');
    if (targetDivisionId) {
      projectQb.andWhere('p.division_id = :targetDivisionId', { targetDivisionId });
    }
    const projectCount = await projectQb.getCount();

    const published = proposals.filter((p) => p.status === 'tender_published');
    const pipeline = proposals.filter(
      (p) => !['tender_published', 'closed', 'proposal_rejected'].includes(p.status),
    );
    const readySchemes = published
      .filter((p) => !p.projectId)
      .map((p) => ({
        id: p.id,
        proposalNo: p.proposalNo,
        title: p.title,
        divisionId: p.divisionId,
      }));

    let phase: PortfolioReadinessPhase;
    if (published.length > 0) phase = 'ready';
    else if (pipeline.length > 0) phase = 'awaiting_tender';
    else phase = 'no_dpr';

    const constructionUnlocked = published.length > 0 || projectCount > 0;
    const canCreateProject = readySchemes.length > 0 && this.isHqProjectRegistrar(user);

    return {
      phase,
      constructionUnlocked,
      canCreateProject,
      publishedTenderCount: published.length,
      pipelineProposalCount: pipeline.length,
      projectCount,
      readySchemes,
    };
  }

  private isHqProjectRegistrar(user: JwtPayload): boolean {
    const roles = user.roles ?? [];
    return roles.some((r) => (HQ_PROJECT_REGISTRAR_ROLES as readonly string[]).includes(r));
  }

  private assertHqProjectRegistrar(user: JwtPayload): void {
    assertNotSuperAdminForOperations(user, 'construction project registration');
    if (!this.isHqProjectRegistrar(user)) {
      throw new ForbiddenException(
        'Only HQ officials (SE, CE, CGM, MD) can register construction projects after DPR tender is published.',
      );
    }
  }

  private async assertConstructionCreateAllowed(
    tenantId: string,
    user: JwtPayload,
    divisionId: string | null,
  ) {
    const readiness = await this.getPortfolioReadiness(tenantId, user, divisionId);
    if (!readiness.canCreateProject) {
      throw new ForbiddenException(
        'Construction projects unlock after tender is published in DPR & Planning for your division.',
      );
    }
  }

  private async linkDprProposalOnCreate(
    tenantId: string,
    projectId: string,
    dprProposalId: string,
    divisionId: string | null,
  ) {
    const proposal = await this.dprProposalRepo.findOne({ where: { id: dprProposalId, tenantId } });
    if (!proposal) {
      throw new BadRequestException('Linked DPR proposal not found');
    }
    if (proposal.status !== 'tender_published') {
      throw new BadRequestException('Construction can only be linked to a tender-published DPR proposal');
    }
    if (proposal.projectId) {
      if (proposal.projectId === projectId) return proposal;
      throw new BadRequestException('This DPR proposal is already linked to a construction project');
    }
    if (divisionId && proposal.divisionId && proposal.divisionId !== divisionId) {
      throw new BadRequestException('DPR proposal belongs to a different division');
    }
    await this.dprProposalRepo.update(proposal.id, { projectId });
    return proposal;
  }

  private async seedDefaultConstructionMilestones(projectId: string, userId: string) {
    const existing = await this.milestonesRepo.count({ where: { projectId } });
    if (existing > 0) return;
    await this.milestonesRepo.save(
      DEFAULT_CONSTRUCTION_MILESTONES.map((m) => this.milestonesRepo.create({
        projectId,
        name: m.name,
        status: 'pending',
        progress: 0,
        sortOrder: m.sortOrder,
        createdBy: userId,
        updatedBy: userId,
      })),
    );
  }

  async findAll(tenantId: string, user: JwtPayload) {
    const qb = this.projectsRepo.createQueryBuilder('p')
      .leftJoinAndSelect('p.milestones', 'milestones')
      .where('p.tenant_id = :tenantId', { tenantId })
      .orderBy('p.created_at', 'DESC');
    await this.divisionAccess.applyProjectScope(qb, user, 'p');
    const projects = await qb.getMany();
    await Promise.all(
      projects.map((p) => this.progressSync.syncFromConstruction(tenantId, p.id).catch(() => undefined)),
    );
    const refreshed = await this.projectsRepo.find({
      where: { tenantId, id: In(projects.map((p) => p.id)) },
      relations: ['milestones'],
      order: { createdAt: 'DESC' },
    });
    refreshed.forEach((p) => { p.milestones = sortMilestones(p.milestones); });
    return Promise.all(refreshed.map(async (p) => {
      const enriched = await this.enrichProject(p, tenantId);
      const divisionId = await this.divisionAccess.getProjectDivisionId(p.id);
      return { ...enriched, divisionId };
    }));
  }

  async findOne(tenantId: string, id: string, user: JwtPayload) {
    await this.progressSync.syncFromConstruction(tenantId, id).catch(() => undefined);
    const project = await this.divisionAccess.assertProjectAccess(user, id, tenantId);
    const withMilestones = await this.projectsRepo.findOne({
      where: { id: project.id, tenantId },
      relations: ['milestones'],
    });
    if (!withMilestones) throw new NotFoundException('Project not found');
    withMilestones.milestones = sortMilestones(withMilestones.milestones);
    const enriched = await this.enrichProject(withMilestones, tenantId);
    const divisionId = await this.divisionAccess.getProjectDivisionId(withMilestones.id);
    return { ...enriched, divisionId };
  }

  private async enrichProject(project: Project, tenantId: string) {
    try {
      const componentProgress = await this.progressSync.getDprProgressByComponent(tenantId, project.id);
      const milestones = project.milestones.map((m) => {
        const components = milestoneComponents(m.name);
        if (!components) {
          return { ...m, dprLinked: false as const };
        }
        const dprDetail = this.progressSync.buildMilestoneDprDetail(componentProgress, components);
        return { ...m, dprLinked: true as const, dprDetail };
      });
      return { ...project, milestones };
    } catch {
      return {
        ...project,
        milestones: project.milestones.map((m) => ({ ...m, dprLinked: false as const })),
      };
    }
  }

  async ensureDprGisWorkspaceProject(tenantId: string, proposal: DprProposal): Promise<Project> {
    if (proposal.projectId) {
      const linked = await this.projectsRepo.findOne({ where: { id: proposal.projectId, tenantId } });
      if (linked) return linked;
    }

    const existingRows = await this.projectsRepo.manager.query(
      `SELECT p.id
       FROM projects p
       JOIN la_cases c ON c.project_id = p.id AND c.tenant_id = p.tenant_id
       WHERE c.dpr_proposal_id = $1
         AND p.tenant_id = $2
         AND p.status = $3
       LIMIT 1`,
      [proposal.id, tenantId, DPR_GIS_WORKSPACE_PROJECT_STATUS],
    ) as Array<{ id: string }>;
    if (existingRows[0]?.id) {
      const existing = await this.projectsRepo.findOne({
        where: { id: existingRows[0].id, tenantId },
      });
      if (existing) return existing;
    }

    const projectCode = await this.resolveProjectCodeForCreate(tenantId, proposal.title);
    const project = this.projectsRepo.create({
      tenantId,
      name: proposal.title.trim(),
      projectCode,
      description: `GIS workspace for DPR ${proposal.proposalNo} (pre-tender land acquisition)`,
      status: DPR_GIS_WORKSPACE_PROJECT_STATUS,
      spent: 0,
      physicalProgress: 0,
      financialProgress: 0,
    });
    const saved = await this.projectsRepo.save(project);
    if (proposal.divisionId) {
      await this.divisionAccess.assignProjectDivision(saved.id, proposal.divisionId);
    }
    await this.featureClassesService.scaffoldLaGisLayers(tenantId, saved.id).catch(() => undefined);
    return saved;
  }

  private async findLaGisWorkspaceForProposal(tenantId: string, dprProposalId: string) {
    const rows = await this.projectsRepo.manager.query(
      `SELECT p.id
       FROM projects p
       JOIN la_cases c ON c.project_id = p.id AND c.tenant_id = p.tenant_id
       WHERE c.dpr_proposal_id = $1
         AND p.tenant_id = $2
         AND p.status = $3
       LIMIT 1`,
      [dprProposalId, tenantId, DPR_GIS_WORKSPACE_PROJECT_STATUS],
    ) as Array<{ id: string }>;
    if (!rows[0]?.id) return null;
    return this.projectsRepo.findOne({ where: { id: rows[0].id, tenantId } });
  }

  private async upgradeGisWorkspaceToConstruction(
    tenantId: string,
    workspace: Project,
    dto: CreateProjectDto,
    user: JwtPayload,
    divisionId: string | null,
  ) {
    const nextName = dto.name.trim();
    const nextCode = dto.projectCode?.trim()
      ? dto.projectCode.trim().toUpperCase()
      : await this.resolveProjectCodeForCreate(tenantId, nextName);

    workspace.name = nextName;
    workspace.projectCode = nextCode;
    workspace.description = dto.description?.trim() || workspace.description;
    workspace.status = dto.status?.trim() || 'active';
    workspace.startDate = dto.startDate || null;
    workspace.endDate = dto.endDate || null;
    workspace.orthomosaicConfig = this.normalizeOrthomosaicConfig(
      dto.orthomosaicConfig,
      workspace.orthomosaicConfig,
    );

    const saved = await this.projectsRepo.save(workspace);
    await this.divisionAccess.assignProjectDivision(saved.id, divisionId);

    const proposal = await this.linkDprProposalOnCreate(
      tenantId,
      saved.id,
      dto.dprProposalId!.trim(),
      divisionId,
    );
    if (proposal.preliminaryEstimate != null) {
      saved.budget = proposal.preliminaryEstimate;
      await this.projectsRepo.save(saved);
    }
    await this.seedDefaultConstructionMilestones(saved.id, user.sub);

    const divisionIdOut = await this.divisionAccess.getProjectDivisionId(saved.id);

    let divisionStaffLogins: Awaited<ReturnType<DivisionStaffProvisionerService['ensureDivisionStaff']>> = [];
    if (divisionId) {
      divisionStaffLogins = await this.divisionStaff.ensureDivisionStaff(tenantId, divisionId);
    }

    return { ...saved, divisionId: divisionIdOut, divisionStaffLogins, upgradedFromGisWorkspace: true as const };
  }

  async create(tenantId: string, dto: CreateProjectDto, user: JwtPayload) {
    this.assertHqProjectRegistrar(user);
    if (!dto.dprProposalId?.trim()) {
      throw new BadRequestException('dprProposalId is required to register a construction project');
    }

    const divisionId = await this.divisionAccess.resolveDivisionIdForCreate(user, dto.divisionId);
    await this.assertConstructionCreateAllowed(tenantId, user, divisionId);

    const workspace = await this.findLaGisWorkspaceForProposal(tenantId, dto.dprProposalId.trim());
    if (workspace) {
      return this.upgradeGisWorkspaceToConstruction(
        tenantId,
        workspace,
        dto,
        user,
        divisionId,
      );
    }

    const projectCode = await this.resolveProjectCodeForCreate(tenantId, dto.name.trim());

    const project = this.projectsRepo.create({
      tenantId,
      name: dto.name.trim(),
      projectCode,
      description: dto.description?.trim() || null,
      status: dto.status?.trim() || 'active',
      startDate: dto.startDate || null,
      endDate: dto.endDate || null,
      budget: null,
      spent: 0,
      physicalProgress: 0,
      financialProgress: 0,
      orthomosaicConfig: this.normalizeOrthomosaicConfig(dto.orthomosaicConfig),
    });

    const saved = await this.projectsRepo.save(project);
    await this.divisionAccess.assignProjectDivision(saved.id, divisionId);

    const proposal = await this.linkDprProposalOnCreate(
      tenantId,
      saved.id,
      dto.dprProposalId.trim(),
      divisionId,
    );
    if (proposal.preliminaryEstimate != null) {
      saved.budget = proposal.preliminaryEstimate;
      await this.projectsRepo.save(saved);
    }
    await this.seedDefaultConstructionMilestones(saved.id, user.sub);

    const divisionIdOut = await this.divisionAccess.getProjectDivisionId(saved.id);

    let divisionStaffLogins: Awaited<ReturnType<DivisionStaffProvisionerService['ensureDivisionStaff']>> = [];
    if (divisionId) {
      divisionStaffLogins = await this.divisionStaff.ensureDivisionStaff(tenantId, divisionId);
    }

    return { ...saved, divisionId: divisionIdOut, divisionStaffLogins };
  }

  async update(tenantId: string, id: string, dto: UpdateProjectDto, user: JwtPayload) {
    const project = await this.findOne(tenantId, id, user);

    if (dto.projectCode && dto.projectCode.trim() !== project.projectCode) {
      const nextCode = dto.projectCode.trim().toUpperCase();
      if (!isValidProjectCode(nextCode)) {
        throw new BadRequestException(
          'Project code must follow PRJ-INITIALS-2026-27 (first letter of each word + financial year)',
        );
      }
      const existing = await this.projectsRepo.findOne({
        where: { tenantId, projectCode: nextCode },
      });
      if (existing && existing.id !== id) {
        throw new BadRequestException(`Project code "${nextCode}" already exists`);
      }
      project.projectCode = nextCode;
    }

    if (dto.name !== undefined) project.name = dto.name.trim();
    if (dto.description !== undefined) project.description = dto.description.trim() || null;
    if (dto.status !== undefined) project.status = dto.status.trim();
    if (dto.startDate !== undefined) project.startDate = dto.startDate || null;
    if (dto.endDate !== undefined) project.endDate = dto.endDate || null;
    if (dto.orthomosaicConfig !== undefined) {
      project.orthomosaicConfig = this.normalizeOrthomosaicConfig(
        dto.orthomosaicConfig,
        project.orthomosaicConfig,
      );
    }

    return this.projectsRepo.save(project);
  }

  async remove(tenantId: string, id: string, user: JwtPayload) {
    if (!user.roles?.includes('super_admin')) {
      throw new ForbiddenException('Only Super Admin can delete schemes.');
    }

    const project = await this.projectsRepo.findOne({ where: { id, tenantId } });
    if (!project) throw new NotFoundException('Project not found');

    const fileName = project.orthomosaicConfig?.fileName?.trim();
    if (fileName) {
      removeOrthomosaicFile(id, fileName);
    }

    await this.detachProjectReferences(id);
    await this.projectsRepo.delete({ id, tenantId });

    return { success: true, id, projectCode: project.projectCode };
  }

  private async detachProjectReferences(projectId: string): Promise<void> {
    const queries = [
      'UPDATE om_consumer_complaints SET project_id = NULL WHERE project_id = $1',
      'UPDATE om_contracts SET project_id = NULL WHERE project_id = $1',
      'UPDATE om_asset_lifecycle_assessments SET project_id = NULL WHERE project_id = $1',
      'UPDATE om_renewal_plans SET project_id = NULL WHERE project_id = $1',
    ];
    for (const sql of queries) {
      try {
        await this.projectsRepo.query(sql, [projectId]);
      } catch {
        // Optional tables may be absent in older databases.
      }
    }
  }

  async uploadOrthomosaicFile(
    tenantId: string,
    projectId: string,
    file: { buffer: Buffer; originalname?: string; size?: number },
    displayName: string | undefined,
    user: JwtPayload,
  ) {
    const project = await this.findOne(tenantId, projectId, user);
    const originalName = file.originalname ?? 'orthomosaic.tif';
    if (!isAllowedOrthomosaicFileName(originalName)) {
      throw new BadRequestException('Only GeoTIFF files (.tif, .tiff, .geotiff) are supported.');
    }
    if (!file.buffer?.length) {
      throw new BadRequestException('Uploaded file is empty.');
    }

    const storedFileName = uniqueOrthomosaicFileName(originalName);
    ensureDir(orthomosaicUploadDir(projectId));

    const previousFileName = project.orthomosaicConfig?.fileName;
    const absolutePath = orthomosaicFileAbsolutePath(projectId, storedFileName);
    writeFileSync(absolutePath, file.buffer);

    if (previousFileName && previousFileName !== storedFileName) {
      removeOrthomosaicFile(projectId, previousFileName);
    }

    project.orthomosaicConfig = {
      sourceType: 'file',
      fileName: storedFileName,
      fileUrl: orthomosaicFileApiUrl(projectId),
      tileUrl: undefined,
      name: displayName?.trim() || project.orthomosaicConfig?.name?.trim() || `${project.name} Drone`,
      attribution: project.orthomosaicConfig?.attribution?.trim() || 'Drone orthomosaic',
      maxZoom: project.orthomosaicConfig?.maxZoom ?? 22,
    };

    const saved = await this.projectsRepo.save(project);
    return this.enrichProject(saved, tenantId);
  }

  async resolveOrthomosaicFile(tenantId: string, projectId: string, user: JwtPayload) {
    const project = await this.findOne(tenantId, projectId, user);
    const config = project.orthomosaicConfig;
    const fileName = config?.fileName?.trim();
    if (config?.sourceType !== 'file' && !fileName) {
      throw new NotFoundException('No orthomosaic file is configured for this project.');
    }
    if (!fileName) {
      throw new NotFoundException('No orthomosaic file is configured for this project.');
    }
    const absolutePath = orthomosaicFileAbsolutePath(projectId, fileName);
    if (!fileExists(absolutePath)) {
      throw new NotFoundException('Orthomosaic file not found on server.');
    }
    return {
      absolutePath,
      fileName,
      mimeType: orthomosaicMimeType(fileName),
      size: statSync(absolutePath).size,
    };
  }

  async removeOrthomosaic(tenantId: string, projectId: string, user: JwtPayload) {
    const project = await this.findOne(tenantId, projectId, user);
    const fileName = project.orthomosaicConfig?.fileName?.trim();
    if (fileName) {
      removeOrthomosaicFile(projectId, fileName);
    }
    project.orthomosaicConfig = null;
    const saved = await this.projectsRepo.save(project);
    return this.enrichProject(saved, tenantId);
  }

  async createMilestone(tenantId: string, projectId: string, dto: CreateMilestoneDto, user: JwtPayload) {
    this.divisionAccess.assertDivisionMilestoneOperator(user);
    await this.divisionAccess.assertProjectAccess(user, projectId, tenantId);
    const project = await this.projectsRepo.findOne({ where: { id: projectId, tenantId } });
    if (!project) throw new NotFoundException('Project not found');

    let sortOrder = dto.sortOrder;
    if (sortOrder === undefined) {
      const last = await this.milestonesRepo.findOne({
        where: { projectId },
        order: { sortOrder: 'DESC' },
      });
      sortOrder = last ? last.sortOrder + 1 : 1;
    }

    const milestone = this.milestonesRepo.create({
      projectId,
      name: dto.name.trim(),
      dueDate: dto.dueDate || null,
      completedDate: dto.completedDate || null,
      status: dto.status ?? 'pending',
      progress: dto.progress ?? 0,
      sortOrder,
      createdBy: user.sub,
      updatedBy: user.sub,
    });
    const saved = await this.milestonesRepo.save(milestone);
    await this.recomputeProjectProgress(projectId);
    return saved;
  }

  async updateMilestone(
    tenantId: string,
    projectId: string,
    milestoneId: string,
    dto: UpdateMilestoneDto,
    user: JwtPayload,
  ) {
    this.divisionAccess.assertDivisionMilestoneOperator(user);
    await this.divisionAccess.assertProjectAccess(user, projectId, tenantId);
    const project = await this.projectsRepo.findOne({ where: { id: projectId, tenantId } });
    if (!project) throw new NotFoundException('Project not found');
    const milestone = await this.milestonesRepo.findOne({
      where: { id: milestoneId, projectId },
    });
    if (!milestone) throw new NotFoundException('Milestone not found');

    if (dto.name !== undefined) milestone.name = dto.name.trim();
    if (dto.dueDate !== undefined) milestone.dueDate = dto.dueDate || null;
    if (dto.completedDate !== undefined) milestone.completedDate = dto.completedDate || null;
    if (dto.status !== undefined) milestone.status = dto.status;
    if (dto.progress !== undefined) milestone.progress = dto.progress;
    if (dto.sortOrder !== undefined) milestone.sortOrder = dto.sortOrder;
    milestone.updatedBy = user.sub;

    const saved = await this.milestonesRepo.save(milestone);
    await this.recomputeProjectProgress(projectId);
    return saved;
  }

  async deleteMilestone(tenantId: string, projectId: string, milestoneId: string, user: JwtPayload) {
    this.divisionAccess.assertDivisionMilestoneOperator(user);
    await this.divisionAccess.assertProjectAccess(user, projectId, tenantId);
    const project = await this.projectsRepo.findOne({ where: { id: projectId, tenantId } });
    if (!project) throw new NotFoundException('Project not found');
    const result = await this.milestonesRepo.delete({ id: milestoneId, projectId });
    if (!result.affected) throw new NotFoundException('Milestone not found');
    await this.recomputeProjectProgress(projectId);
    return { success: true };
  }

  /** Keep the project's physical progress in sync with the average milestone progress. */
  private async recomputeProjectProgress(projectId: string) {
    const milestones = await this.milestonesRepo.find({ where: { projectId } });
    if (milestones.length === 0) return;
    const total = milestones.reduce((sum, m) => sum + Number(m.progress), 0);
    const average = Number((total / milestones.length).toFixed(2));
    await this.projectsRepo.update(projectId, { physicalProgress: average });
  }

  private async resolveProjectCodeForCreate(tenantId: string, projectName: string): Promise<string> {
    const trimmedName = projectName.trim();
    if (!trimmedName) {
      throw new BadRequestException('Project name is required to generate the scheme code');
    }
    const base = buildProjectCodeFromName(trimmedName);
    if (!/^PRJ-[A-Z]{2,10}-\d{4}-\d{2}$/.test(base)) {
      throw new BadRequestException(
        'Enter a project name with at least two words to generate a scheme code (e.g. PRJ-TPPWSS-2026-27)',
      );
    }
    return this.ensureUniqueProjectCode(tenantId, base);
  }

  private async ensureUniqueProjectCode(tenantId: string, base: string): Promise<string> {
    let code = base;
    let suffix = 2;
    while (await this.projectsRepo.findOne({ where: { tenantId, projectCode: code } })) {
      code = `${base}-${suffix}`;
      suffix += 1;
      if (suffix > 99) {
        throw new BadRequestException('Could not generate a unique project code. Try a different project name.');
      }
    }
    return code;
  }

  private normalizeOrthomosaicConfig(
    config?: OrthomosaicConfigDto | null,
    existing?: OrthomosaicConfig | null,
  ): OrthomosaicConfig | null {
    if (config === null) return null;
    if (!config) return existing ?? null;

    const rawUrl = (config.tileUrl ?? config.mosaicUrl ?? '').trim();
    if (rawUrl) {
      if (!/^https?:\/\//i.test(rawUrl)) {
        throw new BadRequestException('Mosaic URL must start with http:// or https://');
      }
      if (!/\{z\}/i.test(rawUrl) || !/\{x\}/i.test(rawUrl) || !/\{y\}/i.test(rawUrl)) {
        throw new BadRequestException(
          'Mosaic URL must include {z}, {x}, and {y} placeholders (XYZ tile template).',
        );
      }

      return {
        sourceType: 'xyz',
        tileUrl: rawUrl,
        fileName: null,
        fileUrl: null,
        name: config.name?.trim() || null,
        attribution: config.attribution?.trim() || 'Drone orthomosaic',
        maxZoom: config.maxZoom ?? 22,
      };
    }

    if (config.sourceType === 'file' || config.fileName || config.fileUrl) {
      const fileName = (config.fileName ?? existing?.fileName ?? '').trim();
      const fileUrl = (config.fileUrl ?? existing?.fileUrl ?? '').trim();
      if (!fileName || !fileUrl) {
        throw new BadRequestException('Uploaded orthomosaic file metadata is incomplete.');
      }
      return {
        sourceType: 'file',
        fileName,
        fileUrl,
        tileUrl: undefined,
        name: config.name?.trim() || existing?.name?.trim() || null,
        attribution: config.attribution?.trim() || existing?.attribution?.trim() || 'Drone orthomosaic',
        maxZoom: config.maxZoom ?? existing?.maxZoom ?? 22,
      };
    }

    return null;
  }
}
