import { BadRequestException, Inject, Injectable, NotFoundException, forwardRef } from '@nestjs/common';
import { assertNotSuperAdminForOperations } from '../../common/utils/operational-access.util';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { DivisionAccessService } from '../divisions/division-access.service';
import { DprProposal } from '../dpr-planning/entities/dpr-proposal.entity';
import { Project } from '../projects/entities/project.entity';
import { ProjectFeatureClass } from '../projects/entities/project-feature-class.entity';
import {
  LA_ALIGNMENT_FEATURE_CODES,
  LA_CLEARANCE_TYPES,
  LA_DPR_STAGE3_MIN_STATUS,
  LA_DPR_STAGE8_MIN_STATUS,
  LA_PARCEL_FEATURE_CODES,
  LA_SCHEME_TYPES,
  LA_STATUSES,
  LA_WORKFLOW_TRANSITIONS,
  LA_ASSET_TYPES,
  buildLaWorkflowProgress,
  getLaStatusLabel,
  getLaStageForStatus,
  laStatusAtLeast,
  normalizeLaStatus,
} from './constants/la-acquisition.constants';
import {
  LA_GIS_LAYER_CATEGORIES,
  LA_GIS_OVERLAY_LAYERS,
  type LaGisLayerDef,
} from './constants/la-gis-layers.constants';
import { LA_ROUTE_VARIANT_PROFILES, LA_AI_RECOMMENDATION_TYPES } from './constants/la-route-recommendation.constants';
import { LA_ROUTING_CRITERIA, LA_ROUTING_DEFAULTS } from './constants/la-routing.constants';
import {
  getOwnershipClassLabel,
  LA_OWNERSHIP_CLASSES,
  LA_OWNERSHIP_LAYER_MAP,
} from './constants/la-ownership-classification.constants';
import {
  LA_COMPENSATION_COMPONENTS,
  LA_COMPENSATION_RATES,
} from './constants/la-compensation.constants';
import {
  LA_GIS_VIZ_LEGEND,
  getParcelVizColor,
  resolveParcelVizCategory,
} from './constants/la-gis-visualization.constants';
import { LA_AUTO_DOCUMENTS } from './constants/la-documents.constants';
import { LA_AI_ALERT_TYPES } from './constants/la-ai-alerts.constants';
import {
  buildLaAiAlerts,
  summarizeLaAiAlerts,
  type LaAiAlert,
} from './utils/la-ai-alerts.util';
import {
  calculateParcelCompensation,
  summarizeCompensation,
} from './utils/la-compensation.util';
import {
  EMPTY_LA_GIS_DASHBOARD,
  LA_GIS_DASHBOARD_METRICS,
  type LaGisDashboardStats,
} from './constants/la-gis-dashboard.constants';
import {
  generateAllLaDocuments,
  generateLaDocumentHtml,
  type LaDocumentContext,
} from './utils/la-document-generator.util';
import { LaAutoRouteService, type RouteGeometry } from './la-auto-route.service';
import { ProjectsService } from '../projects/projects.service';
import { DPR_GIS_WORKSPACE_PROJECT_STATUS } from '../projects/constants/project-status.constants';
import { classifyParcelOwnership } from './utils/la-ownership-classification.util';
import {
  classifyAcquisition,
  extractLaParcelFields,
  LA_PARCEL_DETECTION_FIELDS,
} from './utils/la-parcel-attributes.util';
import {
  findStatutoryClearance,
  mapLegacyClearanceType,
} from './constants/la-statutory-clearances.constants';
import {
  buildClearanceProposalPackage,
  detectClearancesFromParcel,
  enrichClearanceDetails,
} from './utils/la-clearance-proposal.util';
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
import {
  LaAlignmentSegment,
  LaCase,
  LaCaseDocument,
  LaClearanceItem,
  LaClearanceProposal,
  LaCompensationSchedule,
  LaParcel,
  LaParcelOwner,
  LaWorkflowEvent,
} from './entities/la.entities';

export type LaReadiness = {
  hasCase: boolean;
  caseId?: string;
  caseNo?: string;
  status?: string;
  statusLabel?: string;
  complete: boolean;
  canSubmitDprStage3: boolean;
  canRecordSanction: boolean;
  parcelsTotal: number;
  parcelsPossession: number;
  clearancesPending: string[];
  estimatedCompensation: number;
  missingActions: string[];
};

@Injectable()
export class LandAcquisitionService {
  constructor(
    @InjectRepository(LaCase) private caseRepo: Repository<LaCase>,
    @InjectRepository(LaAlignmentSegment) private alignmentRepo: Repository<LaAlignmentSegment>,
    @InjectRepository(LaParcel) private parcelRepo: Repository<LaParcel>,
    @InjectRepository(LaParcelOwner) private ownerRepo: Repository<LaParcelOwner>,
    @InjectRepository(LaClearanceItem) private clearanceRepo: Repository<LaClearanceItem>,
    @InjectRepository(LaClearanceProposal) private clearanceProposalRepo: Repository<LaClearanceProposal>,
    @InjectRepository(LaCaseDocument) private documentRepo: Repository<LaCaseDocument>,
    @InjectRepository(LaCompensationSchedule) private compensationRepo: Repository<LaCompensationSchedule>,
    @InjectRepository(LaWorkflowEvent) private eventRepo: Repository<LaWorkflowEvent>,
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    @InjectRepository(DprProposal) private proposalRepo: Repository<DprProposal>,
    @InjectRepository(ProjectFeatureClass) private fcRepo: Repository<ProjectFeatureClass>,
    private divisionAccess: DivisionAccessService,
    private dataSource: DataSource,
    private autoRouteService: LaAutoRouteService,
    @Inject(forwardRef(() => ProjectsService))
    private projectsService: ProjectsService,
  ) {}

  getCatalog() {
    return {
      schemeTypes: LA_SCHEME_TYPES,
      assetTypes: LA_ASSET_TYPES,
      statuses: LA_STATUSES,
      clearanceTypes: LA_CLEARANCE_TYPES,
      alignmentFeatureCodes: LA_ALIGNMENT_FEATURE_CODES,
      parcelFeatureCodes: LA_PARCEL_FEATURE_CODES,
      overlayLayers: LA_GIS_OVERLAY_LAYERS,
      overlayLayerCategories: LA_GIS_LAYER_CATEGORIES,
      routingCriteria: LA_ROUTING_CRITERIA,
      routingDefaults: LA_ROUTING_DEFAULTS,
      routeVariantProfiles: LA_ROUTE_VARIANT_PROFILES,
      aiRecommendationTypes: LA_AI_RECOMMENDATION_TYPES,
      parcelDetectionFields: LA_PARCEL_DETECTION_FIELDS,
      ownershipClasses: LA_OWNERSHIP_CLASSES,
      compensationRates: LA_COMPENSATION_RATES,
      compensationComponents: LA_COMPENSATION_COMPONENTS,
      autoDocuments: LA_AUTO_DOCUMENTS,
      gisDashboardMetrics: LA_GIS_DASHBOARD_METRICS,
      gisVisualizationLegend: LA_GIS_VIZ_LEGEND,
      aiAlertTypes: LA_AI_ALERT_TYPES,
      workflowPipeline: buildLaWorkflowProgress('pipeline_designed').steps.map(({ code, label, group, groupLabel }) => ({
        code, label, group, groupLabel,
      })),
    };
  }

  async dashboard(tenantId: string, user: JwtPayload) {
    const gis = await this.gisDashboard(tenantId, user);
    return {
      total: gis.totalCases,
      draft: 0,
      inProgress: gis.inProgressCases,
      possessionComplete: gis.possessionCompleteCases,
      clearanceBlocked: 0,
      totalCompensationEst: gis.totalCompensationInr,
      gis,
    };
  }

  async gisDashboard(tenantId: string, user: JwtPayload): Promise<LaGisDashboardStats> {
    const qb = this.caseRepo.createQueryBuilder('c')
      .where('c.tenant_id = :tenantId', { tenantId });
    await this.divisionAccess.applyDivisionScope(qb, user, 'c', tenantId);
    const cases = await qb.getMany();
    const caseIds = cases.map((c) => c.id);

    if (!caseIds.length) {
      return { ...EMPTY_LA_GIS_DASHBOARD };
    }

    const parcelRows = await this.dataSource.query(
      `SELECT
         COUNT(DISTINCT NULLIF(TRIM(village), ''))::int AS villages,
         COUNT(*)::int AS parcels,
         COALESCE(SUM(affected_area_sqm), 0)::float AS total_area,
         COALESCE(SUM(CASE
           WHEN ownership_classification = ANY($3)
             OR department IS NOT NULL AND TRIM(department) <> ''
             OR LOWER(COALESCE(land_use, '') || ' ' || COALESCE(land_class, '')) ~ 'government|govt|nazul|revenue'
           THEN affected_area_sqm ELSE 0 END), 0)::float AS govt_area,
         COALESCE(SUM(CASE
           WHEN ownership_classification = ANY($4)
             OR LOWER(COALESCE(land_use, '') || ' ' || COALESCE(land_class, '')) ~ 'forest|soyam|van panchayat'
           THEN affected_area_sqm ELSE 0 END), 0)::float AS forest_area,
         COALESCE(SUM(CASE
           WHEN ownership_classification = ANY($5)
             OR (ownership_classification IS NULL AND department IS NULL
               AND LOWER(COALESCE(land_use, '') || ' ' || COALESCE(land_class, '')) !~ 'government|govt|forest|soyam')
           THEN affected_area_sqm ELSE 0 END), 0)::float AS private_area,
         COUNT(*) FILTER (WHERE status IN ('notified', 'awarded', 'paid', 'possession'))::int AS approved_parcels,
         COUNT(*) FILTER (WHERE status = 'possession')::int AS possession_parcels,
         COUNT(*) FILTER (WHERE
           LOWER(COALESCE(mutation_status, '')) ~ 'complete|completed|done|intkal|mutated'
         )::int AS mutation_completed,
         COUNT(*) FILTER (WHERE
           LOWER(COALESCE(current_status, '')) ~ 'litigation|dispute|court|stay'
           OR LOWER(COALESCE(attributes::text, '')) ~ 'litigation|dispute|court'
           OR LOWER(COALESCE(mutation_status, '')) ~ 'pending.*litigation|disputed'
         )::int AS litigation_parcels
       FROM la_parcels
       WHERE tenant_id = $1 AND la_case_id = ANY($2::uuid[])`,
      [
        tenantId,
        caseIds,
        ['government_land', 'revenue_department', 'municipality', 'pwd', 'national_highway', 'railway', 'irrigation_department', 'defense', 'other_department', 'gram_sabha'],
        ['forest_land', 'forest_department', 'civil_soyam', 'van_panchayat'],
        ['private_land', 'private_institution', 'religious_trust'],
      ],
    ) as Array<{
      villages: number;
      parcels: number;
      total_area: number;
      govt_area: number;
      forest_area: number;
      private_area: number;
      approved_parcels: number;
      possession_parcels: number;
      mutation_completed: number;
      litigation_parcels: number;
    }>;

    const clearanceRows = await this.dataSource.query(
      `SELECT
         COUNT(*) FILTER (WHERE status IN ('required', 'applied'))::int AS pending,
         COUNT(*) FILTER (WHERE status = 'approved')::int AS approved,
         COUNT(*) FILTER (WHERE status = 'not_applicable')::int AS rejected
       FROM la_clearance_items
       WHERE tenant_id = $1 AND la_case_id = ANY($2::uuid[])`,
      [tenantId, caseIds],
    ) as Array<{ pending: number; approved: number; rejected: number }>;

    const proposalRows = await this.dataSource.query(
      `SELECT COUNT(*)::int AS rejected
       FROM la_clearance_proposals
       WHERE tenant_id = $1 AND la_case_id = ANY($2::uuid[]) AND status NOT IN ('approved', 'draft')`,
      [tenantId, caseIds],
    ) as Array<{ rejected: number }>;

    const p = parcelRows[0] ?? {};
    const c = clearanceRows[0] ?? { pending: 0, approved: 0, rejected: 0 };
    const totalArea = Number(p.total_area ?? 0);
    const govtArea = Number(p.govt_area ?? 0);
    const forestArea = Number(p.forest_area ?? 0);
    const privateArea = Number(p.private_area ?? 0);
    const otherArea = Math.max(0, totalArea - govtArea - forestArea - privateArea);

    const totalCompensation = cases.reduce((s, r) => s + Number(r.totalCompensationEst ?? 0), 0);
    const rejectedProposals = Number(c.rejected ?? 0) + Number(proposalRows[0]?.rejected ?? 0);

    return {
      totalCases: cases.length,
      totalAffectedVillages: Number(p.villages ?? 0),
      totalParcels: Number(p.parcels ?? 0),
      governmentLandSqm: Math.round(govtArea),
      privateLandSqm: Math.round(privateArea),
      forestLandSqm: Math.round(forestArea),
      otherLandSqm: Math.round(otherArea),
      totalAcquisitionAreaSqm: Math.round(totalArea),
      totalCompensationInr: Math.round(totalCompensation),
      pendingApprovals: Number(c.pending ?? 0),
      approvedClearances: Number(c.approved ?? 0),
      approvedParcels: Number(p.approved_parcels ?? 0),
      rejectedProposals,
      litigationCases: Number(p.litigation_parcels ?? 0),
      possessionCompleted: Number(p.possession_parcels ?? 0),
      mutationCompleted: Number(p.mutation_completed ?? 0),
      inProgressCases: cases.filter((r) => normalizeLaStatus(r.status) !== 'construction_started').length,
      possessionCompleteCases: cases.filter((r) => r.possessionStatus === 'complete'
        || laStatusAtLeast(r.status, 'possession_taken')).length,
    };
  }

  async caseGisDashboard(tenantId: string, user: JwtPayload, caseId: string) {
    const laCase = await this.requireCase(tenantId, caseId);
    await this.assertCaseAccess(user, laCase, tenantId);

    const savedScope = await this.gisDashboard(tenantId, user);
    const parcelRows = await this.dataSource.query(
      `SELECT
         COUNT(DISTINCT NULLIF(TRIM(village), ''))::int AS villages,
         COUNT(*)::int AS parcels,
         COALESCE(SUM(affected_area_sqm), 0)::float AS total_area,
         COALESCE(SUM(CASE WHEN ownership_classification = ANY($3) OR department IS NOT NULL THEN affected_area_sqm ELSE 0 END), 0)::float AS govt_area,
         COALESCE(SUM(CASE WHEN ownership_classification = ANY($4) THEN affected_area_sqm ELSE 0 END), 0)::float AS forest_area,
         COALESCE(SUM(CASE WHEN ownership_classification = ANY($5) OR ownership_classification IS NULL THEN affected_area_sqm ELSE 0 END), 0)::float AS private_area,
         COUNT(*) FILTER (WHERE status IN ('notified', 'awarded', 'paid', 'possession'))::int AS approved_parcels,
         COUNT(*) FILTER (WHERE status = 'possession')::int AS possession_parcels,
         COUNT(*) FILTER (WHERE LOWER(COALESCE(mutation_status, '')) ~ 'complete|completed|done|intkal|mutated')::int AS mutation_completed,
         COUNT(*) FILTER (WHERE LOWER(COALESCE(current_status, '') || COALESCE(attributes::text, '')) ~ 'litigation|dispute|court')::int AS litigation_parcels
       FROM la_parcels WHERE tenant_id = $1 AND la_case_id = $2`,
      [
        tenantId,
        caseId,
        ['government_land', 'revenue_department', 'municipality', 'pwd', 'national_highway', 'railway', 'irrigation_department', 'defense', 'other_department', 'gram_sabha'],
        ['forest_land', 'forest_department', 'civil_soyam', 'van_panchayat'],
        ['private_land', 'private_institution', 'religious_trust'],
      ],
    ) as Array<Record<string, number>>;

    const clearanceRows = await this.dataSource.query(
      `SELECT
         COUNT(*) FILTER (WHERE status IN ('required', 'applied'))::int AS pending,
         COUNT(*) FILTER (WHERE status = 'approved')::int AS approved,
         COUNT(*) FILTER (WHERE status = 'not_applicable')::int AS rejected
       FROM la_clearance_items WHERE tenant_id = $1 AND la_case_id = $2`,
      [tenantId, caseId],
    ) as Array<Record<string, number>>;

    const p = parcelRows[0] ?? {};
    const c = clearanceRows[0] ?? {};

    return {
      caseId,
      caseNo: laCase.caseNo,
      title: laCase.title,
      totalAffectedVillages: Number(p.villages ?? 0),
      totalParcels: Number(p.parcels ?? 0),
      governmentLandSqm: Math.round(Number(p.govt_area ?? 0)),
      privateLandSqm: Math.round(Number(p.private_area ?? 0)),
      forestLandSqm: Math.round(Number(p.forest_area ?? 0)),
      totalAcquisitionAreaSqm: Math.round(Number(p.total_area ?? 0)),
      totalCompensationInr: Math.round(Number(laCase.totalCompensationEst ?? 0)),
      pendingApprovals: Number(c.pending ?? 0),
      approvedParcels: Number(p.approved_parcels ?? 0),
      rejectedProposals: Number(c.rejected ?? 0),
      litigationCases: Number(p.litigation_parcels ?? 0),
      possessionCompleted: Number(p.possession_parcels ?? 0),
      mutationCompleted: Number(p.mutation_completed ?? 0),
      tenantGis: savedScope,
    };
  }

  async listCases(tenantId: string, user: JwtPayload, filters: { status?: string }) {
    const qb = this.caseRepo.createQueryBuilder('c')
      .where('c.tenant_id = :tenantId', { tenantId })
      .orderBy('c.updated_at', 'DESC')
      .take(200);
    await this.divisionAccess.applyDivisionScope(qb, user, 'c', tenantId);
    if (filters.status) qb.andWhere('c.status = :status', { status: filters.status });
    const rows = await qb.getMany();
    return rows.map((r) => this.toCaseSummary(r));
  }

  async createCase(tenantId: string, user: JwtPayload, dto: CreateLaCaseDto) {
    assertNotSuperAdminForOperations(user, 'land acquisition case creation');
    let projectId = dto.projectId ?? null;
    let divisionId: string | null = null;
    let title = dto.title.trim();

    if (dto.dprProposalId) {
      const proposal = await this.proposalRepo.findOne({ where: { id: dto.dprProposalId, tenantId } });
      if (!proposal) throw new NotFoundException('DPR proposal not found');
      projectId = proposal.projectId ?? projectId;
      divisionId = proposal.divisionId;
      if (!title) title = proposal.title;
      if (!projectId) {
        const workspace = await this.projectsService.ensureDprGisWorkspaceProject(tenantId, proposal);
        projectId = workspace.id;
      }
    }

    if (projectId) {
      await this.divisionAccess.assertProjectAccess(user, projectId, tenantId);
      const project = await this.projectRepo.findOne({ where: { id: projectId, tenantId } });
      if (!project) throw new NotFoundException('Project not found');
      divisionId = divisionId ?? await this.divisionAccess.getProjectDivisionId(projectId);
      if (!title) title = project.name;
    }

    if (!divisionId && user.activeDivisionId) {
      divisionId = user.activeDivisionId;
    }

    const existing = dto.dprProposalId
      ? await this.caseRepo.findOne({ where: { tenantId, dprProposalId: dto.dprProposalId } })
      : null;
    if (existing) {
      if (!existing.projectId && existing.dprProposalId) {
        const proposal = await this.proposalRepo.findOne({
          where: { id: existing.dprProposalId, tenantId },
        });
        if (proposal) {
          const workspace = await this.projectsService.ensureDprGisWorkspaceProject(tenantId, proposal);
          existing.projectId = workspace.id;
          if (!existing.divisionId && proposal.divisionId) {
            existing.divisionId = proposal.divisionId;
          }
          await this.caseRepo.save(existing);
        }
      }
      return this.getCase(tenantId, user, existing.id);
    }

    const caseNo = await this.generateCaseNo(tenantId, divisionId);
    const row = this.caseRepo.create({
      tenantId,
      projectId,
      dprProposalId: dto.dprProposalId ?? null,
      divisionId,
      caseNo,
      title,
      schemeType: dto.schemeType ?? 'gravity',
      status: 'pipeline_designed',
      createdBy: user.sub,
    });
    const saved = await this.caseRepo.save(row);
    await this.logEvent(tenantId, saved.id, 'pipeline_designed', 'case_created', user.sub, 'Land acquisition case opened');
    return this.getCase(tenantId, user, saved.id);
  }

  async getRoutingSchemes(tenantId: string, user: JwtPayload, caseId: string) {
    const laCase = await this.requireCase(tenantId, caseId);
    await this.assertCaseAccess(user, laCase, tenantId);

    const schemes: Array<{
      id: string;
      projectId: string | null;
      label: string;
      kind: 'linked_project' | 'dpr_scheme';
      projectStatus?: string;
      proposalNo?: string;
    }> = [];
    const seenProjectIds = new Set<string>();

    if (laCase.projectId) {
      const project = await this.projectRepo.findOne({ where: { id: laCase.projectId, tenantId } });
      if (project) {
        schemes.push({
          id: project.id,
          projectId: project.id,
          label: project.status === DPR_GIS_WORKSPACE_PROJECT_STATUS
            ? `${project.name} (DPR GIS workspace)`
            : project.name,
          kind: 'linked_project',
          projectStatus: project.status,
        });
        seenProjectIds.add(project.id);
      }
    }

    if (laCase.dprProposalId) {
      const proposal = await this.proposalRepo.findOne({ where: { id: laCase.dprProposalId, tenantId } });
      if (proposal) {
        const dprLabel = `${proposal.proposalNo} — ${proposal.title} (DPR scheme)`;
        if (proposal.projectId && !seenProjectIds.has(proposal.projectId)) {
          const planningProject = await this.projectRepo.findOne({
            where: { id: proposal.projectId, tenantId },
          });
          schemes.push({
            id: `dpr:${proposal.id}`,
            projectId: proposal.projectId,
            label: dprLabel,
            kind: 'dpr_scheme',
            projectStatus: planningProject?.status,
            proposalNo: proposal.proposalNo,
          });
        } else if (!proposal.projectId) {
          schemes.push({
            id: `dpr:${proposal.id}`,
            projectId: null,
            label: dprLabel,
            kind: 'dpr_scheme',
            proposalNo: proposal.proposalNo,
          });
        }
      }
    }

    return {
      linkedProjectId: laCase.projectId,
      dprProposalId: laCase.dprProposalId,
      schemes,
    };
  }

  async linkLaCasesForDprProposal(tenantId: string, dprProposalId: string, projectId: string) {
    await this.caseRepo.update(
      { tenantId, dprProposalId },
      { projectId },
    );
  }

  async linkProject(tenantId: string, user: JwtPayload, caseId: string, dto: LinkLaCaseProjectDto) {
    const laCase = await this.requireCase(tenantId, caseId);
    await this.assertCaseAccess(user, laCase, tenantId);

    let projectId = dto.projectId?.trim() ?? '';
    if (!projectId && dto.dprProposalId) {
      const proposal = await this.proposalRepo.findOne({ where: { id: dto.dprProposalId, tenantId } });
      if (!proposal) throw new NotFoundException('DPR proposal not found');
      const workspace = await this.projectsService.ensureDprGisWorkspaceProject(tenantId, proposal);
      projectId = workspace.id;
    }
    if (!projectId) {
      throw new BadRequestException('Select a GIS project or DPR scheme to link');
    }
    if (laCase.projectId) {
      if (laCase.projectId === projectId) return this.getCase(tenantId, user, caseId);
      throw new BadRequestException('This LA case already has a linked project');
    }

    await this.divisionAccess.assertProjectAccess(user, projectId, tenantId);
    const project = await this.projectRepo.findOne({ where: { id: projectId, tenantId } });
    if (!project) throw new NotFoundException('Project not found');

    laCase.projectId = projectId;
    if (!laCase.divisionId) {
      laCase.divisionId = await this.divisionAccess.getProjectDivisionId(projectId);
    }
    await this.caseRepo.save(laCase);
    await this.logEvent(
      tenantId,
      caseId,
      laCase.status,
      'project_linked',
      user.sub,
      `Linked to project ${project.name}`,
    );
    return this.getCase(tenantId, user, caseId);
  }

  async getCase(tenantId: string, user: JwtPayload, caseId: string) {
    const laCase = await this.requireCase(tenantId, caseId);
    await this.assertCaseAccess(user, laCase, tenantId);

    if (!laCase.projectId && laCase.dprProposalId) {
      try {
        await this.resolveCaseProjectId(tenantId, user, laCase);
      } catch {
        // Non-fatal on read — manual project link remains available for standalone cases.
      }
    }

    const [alignments, parcels, clearances, events, compensations, clearanceProposal, documents] = await Promise.all([
      this.alignmentRepo.find({ where: { tenantId, laCaseId: caseId }, order: { createdAt: 'ASC' } }),
      this.parcelRepo.find({ where: { tenantId, laCaseId: caseId }, order: { khasraNo: 'ASC' } }),
      this.clearanceRepo.find({ where: { tenantId, laCaseId: caseId }, order: { clearanceType: 'ASC' } }),
      this.eventRepo.find({ where: { tenantId, laCaseId: caseId }, order: { createdAt: 'DESC' }, take: 30 }),
      this.compensationRepo.find({ where: { tenantId, laCaseId: caseId } }),
      this.clearanceProposalRepo.findOne({ where: { tenantId, laCaseId: caseId } }),
      this.documentRepo.find({ where: { tenantId, laCaseId: caseId }, order: { documentCode: 'ASC' } }),
    ]);

    const allOwners = parcels.length
      ? await this.ownerRepo
        .createQueryBuilder('o')
        .where('o.tenant_id = :tenantId', { tenantId })
        .andWhere('o.la_parcel_id IN (:...ids)', { ids: parcels.map((p) => p.id) })
        .getMany()
      : [];

    const project = laCase.projectId
      ? await this.projectRepo.findOne({ where: { id: laCase.projectId, tenantId } })
      : null;
    const dprProposal = laCase.dprProposalId
      ? await this.proposalRepo.findOne({ where: { id: laCase.dprProposalId, tenantId } })
      : null;

    return {
      ...this.toCaseSummary(laCase),
      projectName: project?.name ?? dprProposal?.title ?? null,
      projectStatus: project?.status ?? null,
      isDprGisWorkspace: project?.status === DPR_GIS_WORKSPACE_PROJECT_STATUS,
      dprProposalNo: dprProposal?.proposalNo ?? null,
      alignments: alignments.map((a) => this.toAlignment(a)),
      parcels: parcels.map((p) => ({
        ...this.toParcel(p),
        owners: allOwners.filter((o) => o.laParcelId === p.id).map((o) => this.toOwner(o)),
      })),
      clearances: clearances.map((c) => this.toClearance(c)),
      clearanceProposal: clearanceProposal
        ? {
          id: clearanceProposal.id,
          proposalNo: clearanceProposal.proposalNo,
          title: clearanceProposal.title,
          status: clearanceProposal.status,
          package: clearanceProposal.package,
          updatedAt: clearanceProposal.updatedAt,
        }
        : null,
      compensations: compensations.map((c) => this.toCompensation(c)),
      compensationSummary: compensations.length
        ? summarizeCompensation(compensations.map((c) => ({
          circleRatePerSqm: Number(c.circleRatePerSqm ?? 0),
          marketRatePerSqm: Number(c.marketRatePerSqm ?? 0),
          affectedAreaSqm: Number(c.affectedAreaSqm ?? 0),
          landCompensation: Number(c.landCompensation ?? c.marketValue ?? 0),
          solatium: Number(c.solatiumAmount ?? 0),
          additionalCompensation: Number(c.additionalCompensation ?? 0),
          treeCompensation: Number(c.treeCompensation ?? 0),
          cropCompensation: Number(c.cropCompensation ?? 0),
          structureCompensation: Number(c.structureValue ?? 0),
          totalCompensation: Number(c.totalCompensation ?? c.totalAward ?? 0),
          interest: Number(c.interestAmount ?? 0),
          rehabilitationCost: Number(c.rehabilitationCost ?? 0),
          totalAcquisitionCost: Number(c.totalAcquisitionCost ?? c.totalAward ?? 0),
          acquisitionModeFactor: Number((c.calculationBreakdown?.acquisitionModeFactor as number) ?? 1),
          rrEntitlements: c.rrEntitlements ?? {},
          calculationNotes: (c.calculationBreakdown?.calculationNotes as string[]) ?? [],
        })))
        : null,
      documents: documents.map((d) => this.toDocument(d)),
      documentCatalog: LA_AUTO_DOCUMENTS.map((d) => ({
        code: d.code,
        label: d.label,
        category: d.category,
        generated: documents.some((doc) => doc.documentCode === d.code),
      })),
      events: events.map((e) => ({
        id: e.id,
        stage: e.stage,
        action: e.action,
        remarks: e.remarks,
        createdAt: e.createdAt,
      })),
      readiness: await this.buildReadiness(laCase),
      layerReadiness: laCase.projectId
        ? await this.buildLayerReadiness(tenantId, laCase.projectId)
        : [],
      workflow: buildLaWorkflowProgress(laCase.status),
      aiAlerts: await this.buildCaseAiAlertsForId(tenantId, caseId, laCase),
      nextAction: LA_WORKFLOW_TRANSITIONS[normalizeLaStatus(laCase.status)] ?? null,
    };
  }

  async traceAlignment(
    tenantId: string,
    user: JwtPayload,
    caseId: string,
    dto: TraceAlignmentDto,
  ) {
    const laCase = await this.requireCase(tenantId, caseId);
    await this.assertCaseAccess(user, laCase, tenantId);
    const projectId = await this.resolveCaseProjectId(tenantId, user, laCase);

    const rowWidth = dto.rowWidthM ?? 6;
    await this.alignmentRepo.delete({ tenantId, laCaseId: caseId });

    const codes = dto.featureClassCode
      ? [dto.featureClassCode]
      : [...LA_ALIGNMENT_FEATURE_CODES];

    const featureClasses = await this.fcRepo
      .createQueryBuilder('fc')
      .where('fc.tenant_id = :tenantId', { tenantId })
      .andWhere('fc.project_id = :projectId', { projectId })
      .andWhere('(fc.code IN (:...codes) OR fc.geometry_type = :lineType)', {
        codes,
        lineType: 'LineString',
      })
      .getMany();

    if (!featureClasses.length) {
      throw new BadRequestException(
        'No pipeline alignment feature class found. Create a LineString feature class (e.g. la_alignment) and digitize the route in Map Explorer.',
      );
    }

    let traced = 0;
    for (const fc of featureClasses) {
      const rows = await this.dataSource.query(
        `SELECT pf.id, pf.attributes,
                ST_AsGeoJSON(pf.geometry)::json AS geometry
         FROM project_features pf
         WHERE pf.tenant_id = $1 AND pf.project_id = $2 AND pf.feature_class_id = $3
           AND pf.geometry IS NOT NULL
           AND GeometryType(pf.geometry) IN ('LINESTRING', 'MULTILINESTRING')`,
        [tenantId, projectId, fc.id],
      ) as Array<{ id: string; attributes: Record<string, unknown>; geometry: object }>;

      for (const row of rows) {
        await this.dataSource.query(
          `INSERT INTO la_alignment_segments
            (tenant_id, la_case_id, project_id, feature_id, component, asset_type,
             chainage_from, chainage_to, row_width_m, geometry, corridor_geometry, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
             ST_SetSRID(ST_GeomFromGeoJSON($10), 4326),
             ST_Transform(ST_Buffer(ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($10), 4326), 32644), $11), 4326),
             'traced')`,
          [
            tenantId,
            caseId,
            projectId,
            row.id,
            fc.code,
            fc.code,
            row.attributes?.chainage_from ?? row.attributes?.chainageFrom ?? null,
            row.attributes?.chainage_to ?? row.attributes?.chainageTo ?? null,
            rowWidth,
            JSON.stringify(row.geometry),
            rowWidth,
          ],
        );
        traced += 1;
      }
    }

    if (!traced) {
      throw new BadRequestException('No LineString features found in alignment feature classes');
    }

    laCase.status = 'gis_trace';
    await this.caseRepo.save(laCase);
    await this.logEvent(tenantId, caseId, 'gis_trace', 'trace_alignment', user.sub, `Traced ${traced} segment(s)`);
    return this.getCase(tenantId, user, caseId);
  }

  async identifyParcels(
    tenantId: string,
    user: JwtPayload,
    caseId: string,
    dto: IdentifyParcelsDto,
  ) {
    const laCase = await this.requireCase(tenantId, caseId);
    await this.assertCaseAccess(user, laCase, tenantId);
    const projectId = await this.resolveCaseProjectId(tenantId, user, laCase);

    const segments = await this.alignmentRepo.find({ where: { tenantId, laCaseId: caseId } });
    if (!segments.length) {
      throw new BadRequestException('Trace alignment before identifying parcels');
    }

    const rowWidth = dto.rowWidthM ?? 6;
    await this.parcelRepo.delete({ tenantId, laCaseId: caseId });
    await this.clearanceRepo.delete({ tenantId, laCaseId: caseId });
    await this.clearanceProposalRepo.delete({ tenantId, laCaseId: caseId });

    const parcelCodes = dto.parcelFeatureClassCode
      ? [dto.parcelFeatureClassCode]
      : [...LA_PARCEL_FEATURE_CODES];

    const parcelClasses = await this.fcRepo
      .createQueryBuilder('fc')
      .where('fc.tenant_id = :tenantId', { tenantId })
      .andWhere('fc.project_id = :projectId', { projectId })
      .andWhere('(fc.code IN (:...codes) OR fc.geometry_type = :polyType)', {
        codes: parcelCodes,
        polyType: 'Polygon',
      })
      .getMany();

    if (!parcelClasses.length) {
      throw new BadRequestException(
        'No parcel layer found. Import cadastral parcels as feature class la_parcels (Polygon) in Feature Class Catalog.',
      );
    }

    let identified = 0;
    type ParcelHit = {
      id: string;
      attributes: Record<string, unknown>;
      affected_area_sqm: number;
      total_area_sqm: number;
      affected_length_m: number;
      geometry: object;
      intersection_geometry: object | null;
      rowWidthM: number;
    };
    const bestHits = new Map<string, ParcelHit>();

    for (const fc of parcelClasses) {
      for (const seg of segments) {
        const segRowWidth = Number(seg.rowWidthM ?? rowWidth);
        const hits = await this.dataSource.query(
          `WITH corridor AS (
             SELECT COALESCE(
               (SELECT corridor_geometry FROM la_alignment_segments WHERE id = $1),
               ST_Buffer(ST_Transform(geometry, 32644), $2)::geometry
             ) AS geom
             FROM la_alignment_segments WHERE id = $1
           ),
           seg AS (
             SELECT geometry AS line_geom FROM la_alignment_segments WHERE id = $1
           )
           SELECT pf.id, pf.attributes,
             ST_Area(ST_Intersection(pf.geometry, c.geom)::geography) AS affected_area_sqm,
             ST_Area(pf.geometry::geography) AS total_area_sqm,
             COALESCE(
               ST_Length(
                 ST_Intersection(
                   ST_Transform(s.line_geom, 32644),
                   ST_Transform(pf.geometry, 32644)
                 )::geography
               ),
               0
             ) AS affected_length_m,
             ST_AsGeoJSON(pf.geometry)::json AS geometry,
             ST_AsGeoJSON(ST_Intersection(pf.geometry, c.geom))::json AS intersection_geometry
           FROM project_features pf
           CROSS JOIN corridor c
           CROSS JOIN seg s
           WHERE pf.tenant_id = $3 AND pf.project_id = $4 AND pf.feature_class_id = $5
             AND pf.geometry IS NOT NULL
             AND s.line_geom IS NOT NULL
             AND ST_Intersects(pf.geometry, c.geom)`,
          [seg.id, segRowWidth, tenantId, laCase.projectId, fc.id],
        ) as Array<{
          id: string;
          attributes: Record<string, unknown>;
          affected_area_sqm: string;
          total_area_sqm: string;
          affected_length_m: string;
          geometry: object;
          intersection_geometry: object | null;
        }>;

        for (const hit of hits) {
          const affected = Number(hit.affected_area_sqm ?? 0);
          if (affected <= 0) continue;
          const existing = bestHits.get(hit.id);
          if (!existing || affected > existing.affected_area_sqm) {
            bestHits.set(hit.id, {
              id: hit.id,
              attributes: hit.attributes ?? {},
              affected_area_sqm: affected,
              total_area_sqm: Number(hit.total_area_sqm ?? 0),
              affected_length_m: Number(hit.affected_length_m ?? 0),
              geometry: hit.geometry,
              intersection_geometry: hit.intersection_geometry,
              rowWidthM: segRowWidth,
            });
          }
        }
      }
    }

    for (const hit of bestHits.values()) {
      const fields = extractLaParcelFields(hit.attributes);
      const acquisition = classifyAcquisition(
        hit.affected_area_sqm,
        hit.total_area_sqm,
        hit.affected_length_m,
      );

      let village = fields.village;
      if (!village && laCase.projectId) {
        village = await this.lookupAdminNameForParcel(
          tenantId,
          laCase.projectId,
          hit.geometry,
          ['village_boundary', 'village', 'revenue_village', 'rev_village'],
        );
      }

      let tehsil = fields.tehsil;
      let district = fields.district;
      if (laCase.projectId) {
        if (!tehsil) {
          tehsil = await this.lookupAdminNameForParcel(
            tenantId, laCase.projectId, hit.geometry, ['tehsil', 'tehsil_boundary'],
          );
        }
        if (!district) {
          district = await this.lookupAdminNameForParcel(
            tenantId, laCase.projectId, hit.geometry, ['district_boundary', 'district'],
          );
        }
      }

      const overlayLayers = laCase.projectId
        ? await this.detectParcelOwnershipOverlays(tenantId, laCase.projectId, hit.geometry)
        : [];
      const ownership = classifyParcelOwnership(fields, overlayLayers);

      const parcel = this.parcelRepo.create({
        tenantId,
        laCaseId: caseId,
        sourceFeatureId: hit.id,
        village: village || fields.village,
        tehsil,
        district,
        khasraNo: fields.khasraNo,
        khataNo: fields.khataNo,
        landUse: fields.landUse,
        landClass: fields.landClass,
        landCategory: fields.landCategory,
        ownershipType: fields.ownershipType || ownership.label,
        ownershipClassification: ownership.code,
        ownershipClassificationSource: ownership.source,
        ownershipClassificationDetails: {
          matchedLayers: ownership.matchedLayers,
          matchedRule: ownership.matchedRule,
          label: ownership.label,
        },
        department: fields.department,
        ownerName: fields.ownerName,
        currentStatus: fields.currentStatus,
        mutationStatus: fields.mutationStatus,
        totalAreaSqm: hit.total_area_sqm,
        affectedAreaSqm: hit.affected_area_sqm,
        affectedLengthM: hit.affected_length_m,
        rowWidthM: hit.rowWidthM,
        temporaryAreaSqm: acquisition.temporaryAreaSqm,
        permanentAreaSqm: acquisition.permanentAreaSqm,
        circleRatePerSqm: fields.circleRatePerSqm,
        acquisitionMode: acquisition.acquisitionMode,
        attributes: hit.attributes,
        status: 'identified',
      });
      const saved = await this.parcelRepo.save(parcel);
      await this.dataSource.query(
        `UPDATE la_parcels SET
           geometry = ST_SetSRID(ST_GeomFromGeoJSON($1), 4326),
           intersection_geometry = ST_SetSRID(ST_GeomFromGeoJSON($2), 4326)
         WHERE id = $3`,
        [JSON.stringify(hit.geometry), JSON.stringify(hit.intersection_geometry ?? hit.geometry), saved.id],
      );

      if (fields.ownerName) {
        await this.ownerRepo.save(this.ownerRepo.create({
          tenantId,
          laParcelId: saved.id,
          ownerName: fields.ownerName,
          sharePct: 100,
          verificationStatus: 'pending',
          isPrimary: true,
        }));
      }
      identified += 1;
    }

    if (!identified) {
      identified += await this.identifyParcelsFromRowCorridor(tenantId, caseId, laCase, segments);
    }

    const cadastralHits = bestHits.size;
    await this.refreshCaseTotals(tenantId, caseId);
    if (identified > 0) {
      laCase.status = 'ownership_detected';
      await this.caseRepo.save(laCase);
      if (cadastralHits > 0) {
        await this.logEvent(
          tenantId,
          caseId,
          'parcel_intersect',
          'identify_parcels',
          user.sub,
          `Intersected ${cadastralHits} parcel(s) with pipeline corridor`,
        );
      } else {
        await this.logEvent(
          tenantId,
          caseId,
          laCase.status,
          'identify_parcels_row_fallback',
          user.sub,
          `Created ${identified} ROW corridor placeholder parcel(s) — import la_parcels for cadastral intersections`,
        );
      }
    }
    await this.logEvent(
      tenantId,
      caseId,
      laCase.status,
      'detect_ownership',
      user.sub,
      `Classified ownership for ${identified} parcel(s)`,
    );
    return this.getCase(tenantId, user, caseId);
  }

  async detectClearances(tenantId: string, user: JwtPayload, caseId: string) {
    const laCase = await this.requireCase(tenantId, caseId);
    await this.assertCaseAccess(user, laCase, tenantId);
    const projectId = await this.resolveCaseProjectId(tenantId, user, laCase);

    const segments = await this.alignmentRepo.find({ where: { tenantId, laCaseId: caseId } });
    if (!segments.length) {
      throw new BadRequestException('Trace alignment before detecting clearances');
    }

    const parcels = await this.parcelRepo.find({ where: { tenantId, laCaseId: caseId } });
    if (!parcels.length) {
      throw new BadRequestException('Identify parcels before detecting clearances');
    }

    await this.clearanceRepo.delete({ tenantId, laCaseId: caseId });
    await this.clearanceProposalRepo.delete({ tenantId, laCaseId: caseId });
    const items: LaClearanceItem[] = [];
    const seen = new Set<string>();

    const pushClearance = (input: {
      laParcelId?: string | null;
      clearanceType: string;
      overlayLayerCode?: string | null;
      sourceFeatureId?: string | null;
      sourceFeatureClassCode?: string | null;
      notes?: string | null;
      details?: Record<string, unknown>;
    }) => {
      const clearanceType = mapLegacyClearanceType(input.clearanceType);
      const key = [
        input.laParcelId ?? 'case',
        clearanceType,
        input.overlayLayerCode ?? '',
        input.sourceFeatureId ?? '',
      ].join(':');
      if (seen.has(key)) return;
      seen.add(key);
      const statutory = findStatutoryClearance(clearanceType);
      const def = statutory ?? LA_CLEARANCE_TYPES.find((c) => c.code === clearanceType);
      const enriched = enrichClearanceDetails(clearanceType);
      items.push(this.clearanceRepo.create({
        tenantId,
        laCaseId: caseId,
        laParcelId: input.laParcelId ?? null,
        clearanceType,
        authority: statutory?.authority ?? def?.authority ?? null,
        status: 'required',
        overlayLayerCode: input.overlayLayerCode ?? null,
        sourceFeatureId: input.sourceFeatureId ?? null,
        sourceFeatureClassCode: input.sourceFeatureClassCode ?? null,
        notes: input.notes ?? null,
        details: { ...enriched, ...(input.details ?? {}) },
      }));
    };

    for (const parcel of parcels) {
      const detected = detectClearancesFromParcel({
        landUse: parcel.landUse,
        landClass: parcel.landClass,
        ownershipClassification: parcel.ownershipClassification,
        attributes: parcel.attributes,
      });
      for (const clearanceType of detected) {
        pushClearance({
          laParcelId: parcel.id,
          clearanceType,
          notes: `Parcel trigger: ${parcel.khasraNo ?? parcel.id.slice(0, 8)}`,
        });
      }

      const landUse = (parcel.landUse ?? '').toLowerCase();
      const landClass = (parcel.landClass ?? '').toLowerCase();
      if (/revenue|nazul|government|govt/.test(`${landUse} ${landClass}`)) {
        pushClearance({ laParcelId: parcel.id, clearanceType: 'revenue' });
      }
    }

    const corridorReady = await this.dataSource.query(
      `SELECT ST_AsGeoJSON(ST_Union(corridor_geometry))::json AS geometry
       FROM la_alignment_segments
       WHERE tenant_id = $1 AND la_case_id = $2 AND corridor_geometry IS NOT NULL`,
      [tenantId, caseId],
    ) as Array<{ geometry: object | null }>;

    const corridorGeom = corridorReady[0]?.geometry;
    if (corridorGeom) {
      const featureClasses = await this.fcRepo.find({
        where: { tenantId, projectId },
      });
      const parcelGeometries = await this.dataSource.query(
        `SELECT id, geometry FROM la_parcels
         WHERE tenant_id = $1 AND la_case_id = $2 AND geometry IS NOT NULL`,
        [tenantId, caseId],
      ) as Array<{ id: string }>;

      const overlayLayers = LA_GIS_OVERLAY_LAYERS.filter(
        (layer) => layer.analysisMode === 'corridor_intersect' && layer.clearanceType,
      );

      for (const layer of overlayLayers) {
        const matchingClasses = this.matchFeatureClasses(featureClasses, layer);
        for (const fc of matchingClasses) {
          const hits = await this.dataSource.query(
            `WITH corridor AS (
               SELECT ST_SetSRID(ST_GeomFromGeoJSON($1), 4326) AS geom
             )
             SELECT pf.id, pf.attributes, fc.code AS fc_code
             FROM project_features pf
             JOIN project_feature_classes fc ON fc.id = pf.feature_class_id
             CROSS JOIN corridor c
             WHERE pf.tenant_id = $2 AND pf.project_id = $3 AND pf.feature_class_id = $4
               AND pf.geometry IS NOT NULL
               AND ST_Intersects(pf.geometry, c.geom)`,
            [JSON.stringify(corridorGeom), tenantId, projectId, fc.id],
          ) as Array<{ id: string; attributes: Record<string, unknown>; fc_code: string }>;

          for (const hit of hits) {
            let linkedParcelId: string | null = null;
            if (parcelGeometries.length) {
              const parcelHit = await this.dataSource.query(
                `SELECT lp.id
                 FROM la_parcels lp, project_features pf
                 WHERE lp.id = ANY($1::uuid[]) AND pf.id = $2
                   AND lp.geometry IS NOT NULL AND pf.geometry IS NOT NULL
                   AND ST_Intersects(lp.geometry, pf.geometry)
                 LIMIT 1`,
                [parcelGeometries.map((p) => p.id), hit.id],
              ) as Array<{ id: string }>;
              linkedParcelId = parcelHit[0]?.id ?? null;
            }

            const featureLabel = String(
              hit.attributes?.name
              ?? hit.attributes?.Name
              ?? hit.attributes?.label
              ?? hit.id.slice(0, 8),
            );

            pushClearance({
              laParcelId: linkedParcelId,
              clearanceType: layer.clearanceType!,
              overlayLayerCode: layer.code,
              sourceFeatureId: hit.id,
              sourceFeatureClassCode: hit.fc_code,
              notes: `GIS overlay: ${layer.label} — ${featureLabel}`,
              details: {
                layerCode: layer.code,
                layerLabel: layer.label,
                featureClassCode: hit.fc_code,
                attributes: hit.attributes ?? {},
              },
            });
          }
        }
      }
    }

    if (!items.some((i) => i.clearanceType === 'revenue')) {
      pushClearance({
        clearanceType: 'revenue',
        notes: 'Standard revenue / land acquisition approval for affected parcels',
      });
    }

    if (items.length) await this.clearanceRepo.save(items);

    await this.saveClearanceProposal(tenantId, laCase, items);

    laCase.clearanceStatus = items.some((i) => i.status === 'required') ? 'partial' : 'cleared';
    if (laStatusAtLeast(laCase.status, 'parcel_intersect')) {
      laCase.status = 'clearances_identified';
    }
    await this.caseRepo.save(laCase);
    await this.logEvent(
      tenantId,
      caseId,
      laCase.status,
      'detect_clearances',
      user.sub,
      `${items.length} clearance item(s); statutory proposal auto-generated`,
      {
        overlayHits: items.filter((i) => i.overlayLayerCode).length,
        statutoryTypes: [...new Set(items.map((i) => i.clearanceType))],
      },
    );
    return this.getCase(tenantId, user, caseId);
  }

  async recommendRoutes(tenantId: string, user: JwtPayload, caseId: string, dto: AutoRouteDto) {
    const laCase = await this.requireCase(tenantId, caseId);
    await this.assertCaseAccess(user, laCase, tenantId);
    const projectId = await this.resolveCaseProjectId(tenantId, user, laCase);

    const result = await this.autoRouteService.generateRouteRecommendations({
      tenantId,
      projectId,
      laCaseId: caseId,
      start: [dto.start.lon, dto.start.lat],
      end: [dto.end.lon, dto.end.lat],
      gridCellSizeM: dto.gridCellSizeM,
      rowWidthM: dto.rowWidthM,
      baseWeights: dto.weights,
      importedNetwork: dto.importedNetwork,
      snapToImportedNetwork: dto.snapToImportedNetwork,
      useImportedAsCorridor: dto.useImportedAsCorridor,
    });

    await this.logEvent(
      tenantId,
      caseId,
      laCase.status,
      'recommend_routes',
      user.sub,
      `AI route comparison: ${result.routes.length} alternatives; recommended: ${result.recommendedRouteKey}`,
      { recommendedRouteKey: result.recommendedRouteKey },
    );

    return {
      ...result,
      start: result.snappedStart
        ? { lon: result.snappedStart[0], lat: result.snappedStart[1] }
        : dto.start,
      end: result.snappedEnd
        ? { lon: result.snappedEnd[0], lat: result.snappedEnd[1] }
        : dto.end,
    };
  }

  async previewAutoRoute(tenantId: string, user: JwtPayload, caseId: string, dto: AutoRouteDto) {
    const laCase = await this.requireCase(tenantId, caseId);
    await this.assertCaseAccess(user, laCase, tenantId);
    const projectId = await this.resolveCaseProjectId(tenantId, user, laCase);

    const networkLines = dto.importedNetwork
      ? await this.autoRouteService.extractLineStringsFromNetwork(dto.importedNetwork)
      : [];
    const networkCorridors = dto.useImportedAsCorridor !== false && networkLines.length
      ? networkLines
      : undefined;

    let start: [number, number] = [dto.start.lon, dto.start.lat];
    let end: [number, number] = [dto.end.lon, dto.end.lat];
    if (dto.snapToImportedNetwork !== false && networkLines.length) {
      const merged = await this.autoRouteService.mergeLineStrings(networkLines);
      if (merged) {
        if (dto.useImportedAsCorridor !== false) {
          const extent = await this.autoRouteService.extractNetworkExtentEndpoints(merged);
          if (extent) {
            start = extent.start;
            end = extent.end;
          }
        } else {
          const snapped = await this.autoRouteService.snapEndpointsToLine(start, end, merged);
          start = snapped.start;
          end = snapped.end;
        }
      }
    }

    const mergedImported = networkLines.length
      ? await this.autoRouteService.mergeLineStrings(networkLines)
      : null;

    const route = mergedImported && dto.useImportedAsCorridor !== false
      ? await this.autoRouteService.buildRouteFromExistingGeometry(
        tenantId,
        projectId,
        mergedImported,
        dto.gridCellSizeM,
        dto.weights,
      )
      : await this.autoRouteService.generateRoute({
        tenantId,
        projectId,
        start,
        end,
        gridCellSizeM: dto.gridCellSizeM,
        weights: dto.weights,
        networkCorridors,
        networkCorridorBufferM: 60,
        networkCorridorMultiplier: 0.45,
      });

    return {
      ...route,
      start: { lon: start[0], lat: start[1] },
      end: { lon: end[0], lat: end[1] },
      manualDrawHint: 'Digitize a LineString in Map Explorer on feature class la_alignment as an alternative.',
    };
  }

  async autoRoute(tenantId: string, user: JwtPayload, caseId: string, dto: AutoRouteDto) {
    const laCase = await this.requireCase(tenantId, caseId);
    await this.assertCaseAccess(user, laCase, tenantId);
    const projectId = await this.resolveCaseProjectId(tenantId, user, laCase);

    const networkLines = dto.importedNetwork
      ? await this.autoRouteService.extractLineStringsFromNetwork(dto.importedNetwork)
      : [];
    const networkCorridors = dto.useImportedAsCorridor !== false && networkLines.length
      ? networkLines
      : undefined;

    let start: [number, number] = [dto.start.lon, dto.start.lat];
    let end: [number, number] = [dto.end.lon, dto.end.lat];
    if (dto.snapToImportedNetwork !== false && networkLines.length) {
      const merged = await this.autoRouteService.mergeLineStrings(networkLines);
      if (merged) {
        if (dto.useImportedAsCorridor !== false) {
          const extent = await this.autoRouteService.extractNetworkExtentEndpoints(merged);
          if (extent) {
            start = extent.start;
            end = extent.end;
          }
        } else {
          const snapped = await this.autoRouteService.snapEndpointsToLine(start, end, merged);
          start = snapped.start;
          end = snapped.end;
        }
      }
    }

    const mergedImported = networkLines.length
      ? await this.autoRouteService.mergeLineStrings(networkLines)
      : null;

    const route = dto.geometry
      ? await this.autoRouteService.buildRouteFromExistingGeometry(
        tenantId,
        projectId,
        dto.geometry as RouteGeometry,
        dto.gridCellSizeM,
        dto.weights,
      )
      : mergedImported && dto.useImportedAsCorridor !== false
        ? await this.autoRouteService.buildRouteFromExistingGeometry(
          tenantId,
          projectId,
          mergedImported,
          dto.gridCellSizeM,
          dto.weights,
        )
        : await this.autoRouteService.generateRoute({
          tenantId,
          projectId,
          start,
          end,
          gridCellSizeM: dto.gridCellSizeM,
          weights: dto.weights,
          networkCorridors,
          networkCorridorBufferM: 60,
          networkCorridorMultiplier: 0.45,
        });

    if (dto.saveAndTrace !== false) {
      if (!this.autoRouteService.isValidRouteGeometry(route.geometry)) {
        throw new BadRequestException(
          'Route geometry must be a LineString with at least two distinct vertices. Re-import the pipeline network or pick start/end points farther apart.',
        );
      }
      const alignmentClass = await this.autoRouteService.ensureAlignmentFeatureClass(
        tenantId,
        projectId,
      );
      await this.autoRouteService.saveRouteFeature(
        tenantId,
        projectId,
        alignmentClass.id,
        user.sub,
        route.geometry,
      );
      await this.traceAlignment(tenantId, user, caseId, {
        rowWidthM: dto.rowWidthM,
        featureClassCode: dto.featureClassCode ?? alignmentClass.code,
      });
      await this.logEvent(
        tenantId,
        caseId,
        laCase.status,
        'auto_route',
        user.sub,
        `Auto-routed ${route.lengthM.toFixed(0)} m pipeline (${route.scores.roadAffinityPct}% road affinity)`,
        { scores: route.scores, weights: route.weights },
      );
      return this.getCase(tenantId, user, caseId);
    }

    return route;
  }

  async estimateCompensation(tenantId: string, user: JwtPayload, caseId: string) {
    const laCase = await this.requireCase(tenantId, caseId);
    await this.assertCaseAccess(user, laCase, tenantId);
    const parcels = await this.parcelRepo.find({ where: { tenantId, laCaseId: caseId } });
    if (!parcels.length) {
      throw new BadRequestException('Identify parcels before estimating compensation');
    }

    const owners = parcels.length
      ? await this.ownerRepo
        .createQueryBuilder('o')
        .where('o.tenant_id = :tenantId', { tenantId })
        .andWhere('o.la_parcel_id IN (:...ids)', { ids: parcels.map((p) => p.id) })
        .getMany()
      : [];

    await this.compensationRepo.delete({ tenantId, laCaseId: caseId });

    const breakdowns = [];
    let totalAcquisition = 0;

    for (const parcel of parcels) {
      const parcelOwners = owners.filter((o) => o.laParcelId === parcel.id);
      const calc = calculateParcelCompensation({
        circleRatePerSqm: parcel.circleRatePerSqm,
        affectedAreaSqm: parcel.affectedAreaSqm,
        acquisitionMode: parcel.acquisitionMode,
        landUse: parcel.landUse,
        attributes: parcel.attributes,
        ownerCount: parcelOwners.length || 1,
      });
      breakdowns.push(calc);
      totalAcquisition += calc.totalAcquisitionCost;

      const primaryOwner = parcelOwners.find((o) => o.isPrimary) ?? parcelOwners[0];

      await this.compensationRepo.save(this.compensationRepo.create({
        tenantId,
        laCaseId: caseId,
        laParcelId: parcel.id,
        ownerId: primaryOwner?.id ?? null,
        circleRatePerSqm: calc.circleRatePerSqm,
        marketRatePerSqm: calc.marketRatePerSqm,
        affectedAreaSqm: calc.affectedAreaSqm,
        landCompensation: calc.landCompensation,
        marketValue: calc.landCompensation,
        solatiumAmount: calc.solatium,
        additionalCompensation: calc.additionalCompensation,
        structureValue: calc.structureCompensation,
        treeCompensation: calc.treeCompensation,
        cropCompensation: calc.cropCompensation,
        treesCropsValue: calc.treeCompensation + calc.cropCompensation,
        totalCompensation: calc.totalCompensation,
        interestAmount: calc.interest,
        rehabilitationCost: calc.rehabilitationCost,
        totalAcquisitionCost: calc.totalAcquisitionCost,
        totalAward: calc.totalAcquisitionCost,
        rrEntitlements: calc.rrEntitlements,
        calculationBreakdown: {
          acquisitionModeFactor: calc.acquisitionModeFactor,
          calculationNotes: calc.calculationNotes,
          statutoryBasis: 'RFCTLARR Act 2013',
        },
        paymentStatus: 'pending',
      }));
    }

    laCase.totalCompensationEst = totalAcquisition;
    await this.caseRepo.save(laCase);
    await this.refreshCaseTotals(tenantId, caseId);

    const summary = summarizeCompensation(breakdowns);
    await this.logEvent(
      tenantId,
      caseId,
      laCase.status,
      'estimate_compensation',
      user.sub,
      `Auto-calculated compensation for ${parcels.length} parcel(s): ₹ ${totalAcquisition.toLocaleString('en-IN')} total acquisition cost`,
      { summary },
    );
    return this.getCase(tenantId, user, caseId);
  }

  async generateDocuments(tenantId: string, user: JwtPayload, caseId: string) {
    const laCase = await this.requireCase(tenantId, caseId);
    await this.assertCaseAccess(user, laCase, tenantId);

    const ctx = await this.buildDocumentContext(tenantId, caseId, laCase);
    const results = generateAllLaDocuments(ctx);
    let generated = 0;

    for (const result of results) {
      if (result.status !== 'generated' || !result.contentHtml) continue;
      let row = await this.documentRepo.findOne({
        where: { tenantId, laCaseId: caseId, documentCode: result.code },
      });
      if (!row) {
        row = this.documentRepo.create({
          tenantId,
          laCaseId: caseId,
          documentCode: result.code,
          title: result.label,
          status: 'generated',
          contentHtml: result.contentHtml,
          metadata: { category: result.category },
          generatedAt: new Date(),
        });
      } else {
        row.title = result.label;
        row.contentHtml = result.contentHtml;
        row.status = 'generated';
        row.metadata = { category: result.category };
        row.generatedAt = new Date();
      }
      await this.documentRepo.save(row);
      generated += 1;
    }

    if (generated > 0 && laStatusAtLeast(laCase.status, 'clearances_identified')) {
      laCase.status = 'proposal_generated';
      await this.caseRepo.save(laCase);
    }

    await this.logEvent(
      tenantId,
      caseId,
      laCase.status,
      'generate_documents',
      user.sub,
      `Auto-generated ${generated} LA document(s)`,
      { generated, skipped: results.filter((r) => r.status === 'skipped').length },
    );

    return {
      generated,
      skipped: results.filter((r) => r.status === 'skipped').map((r) => ({
        code: r.code,
        label: r.label,
        reason: r.reason,
      })),
      documents: (await this.documentRepo.find({ where: { tenantId, laCaseId: caseId } }))
        .map((d) => this.toDocument(d)),
    };
  }

  async getDocument(tenantId: string, user: JwtPayload, caseId: string, documentCode: string) {
    const laCase = await this.requireCase(tenantId, caseId);
    await this.assertCaseAccess(user, laCase, tenantId);

    const row = await this.documentRepo.findOne({
      where: { tenantId, laCaseId: caseId, documentCode },
    });
    if (row) {
      return { ...this.toDocument(row), contentHtml: row.contentHtml };
    }

    const ctx = await this.buildDocumentContext(tenantId, caseId, laCase);
    const html = generateLaDocumentHtml(documentCode, ctx);
    if (!html) throw new NotFoundException('Document type not found');

    const def = LA_AUTO_DOCUMENTS.find((d) => d.code === documentCode);
    return {
      documentCode,
      title: def?.label ?? documentCode,
      contentHtml: html,
      generatedAt: ctx.generatedAt,
      status: 'preview',
    };
  }

  private async buildDocumentContext(
    tenantId: string,
    caseId: string,
    laCase: LaCase,
  ): Promise<LaDocumentContext> {
    const [parcels, clearances, compensations, alignments] = await Promise.all([
      this.parcelRepo.find({ where: { tenantId, laCaseId: caseId } }),
      this.clearanceRepo.find({ where: { tenantId, laCaseId: caseId } }),
      this.compensationRepo.find({ where: { tenantId, laCaseId: caseId } }),
      this.alignmentRepo.find({ where: { tenantId, laCaseId: caseId } }),
    ]);

    const owners = parcels.length
      ? await this.ownerRepo
        .createQueryBuilder('o')
        .where('o.tenant_id = :tenantId', { tenantId })
        .andWhere('o.la_parcel_id IN (:...ids)', { ids: parcels.map((p) => p.id) })
        .getMany()
      : [];

    const ownersByParcel = new Map<string, LaParcelOwner[]>();
    for (const o of owners) {
      const list = ownersByParcel.get(o.laParcelId) ?? [];
      list.push(o);
      ownersByParcel.set(o.laParcelId, list);
    }

    let alignmentLengthM = 0;
    if (alignments.length) {
      const lenRow = await this.dataSource.query(
        `SELECT COALESCE(SUM(ST_Length(geometry::geography)), 0) AS len
         FROM la_alignment_segments WHERE tenant_id = $1 AND la_case_id = $2 AND geometry IS NOT NULL`,
        [tenantId, caseId],
      ) as Array<{ len: string }>;
      alignmentLengthM = Number(lenRow[0]?.len ?? 0);
    }

    return {
      caseNo: laCase.caseNo,
      title: laCase.title,
      schemeType: laCase.schemeType,
      status: laCase.status,
      statusLabel: getLaStatusLabel(laCase.status),
      totalParcels: laCase.totalParcels,
      totalAreaSqm: Number(laCase.totalAreaSqm ?? 0),
      totalCompensationEst: Number(laCase.totalCompensationEst ?? 0),
      clearanceStatus: laCase.clearanceStatus,
      possessionStatus: laCase.possessionStatus,
      generatedAt: new Date().toLocaleString('en-IN'),
      parcels: parcels.map((p) => ({
        id: p.id,
        village: p.village,
        tehsil: p.tehsil,
        district: p.district,
        khasraNo: p.khasraNo,
        khataNo: p.khataNo,
        landUse: p.landUse,
        landClass: p.landClass,
        affectedAreaSqm: Number(p.affectedAreaSqm ?? 0),
        totalAreaSqm: Number(p.totalAreaSqm ?? 0),
        ownershipType: p.ownershipType,
        ownershipClassification: p.ownershipClassification,
        department: p.department,
        ownerName: p.ownerName,
        acquisitionMode: p.acquisitionMode,
        mutationStatus: p.mutationStatus,
        circleRatePerSqm: Number(p.circleRatePerSqm ?? 0),
        status: p.status,
        owners: (ownersByParcel.get(p.id) ?? []).map((o) => ({
          ownerName: o.ownerName,
          sharePct: Number(o.sharePct),
        })),
      })),
      clearances: clearances.map((c) => {
        const cleared = this.toClearance(c);
        return {
          clearanceType: cleared.clearanceType,
          label: cleared.label ?? c.clearanceType,
          authority: cleared.authority ?? undefined,
          status: c.status,
        };
      }),
      compensations: compensations.map((c) => ({
        laParcelId: c.laParcelId,
        circleRatePerSqm: Number(c.circleRatePerSqm ?? 0),
        marketRatePerSqm: Number(c.marketRatePerSqm ?? 0),
        affectedAreaSqm: Number(c.affectedAreaSqm ?? 0),
        landCompensation: Number(c.landCompensation ?? c.marketValue ?? 0),
        solatiumAmount: Number(c.solatiumAmount ?? 0),
        additionalCompensation: Number(c.additionalCompensation ?? 0),
        treeCompensation: Number(c.treeCompensation ?? 0),
        cropCompensation: Number(c.cropCompensation ?? 0),
        structureCompensation: Number(c.structureValue ?? 0),
        totalCompensation: Number(c.totalCompensation ?? 0),
        interestAmount: Number(c.interestAmount ?? 0),
        rehabilitationCost: Number(c.rehabilitationCost ?? 0),
        totalAcquisitionCost: Number(c.totalAcquisitionCost ?? c.totalAward ?? 0),
      })),
      alignmentLengthM,
    };
  }

  async advanceCase(tenantId: string, user: JwtPayload, caseId: string, dto: AdvanceLaCaseDto) {
    const laCase = await this.requireCase(tenantId, caseId);
    await this.assertCaseAccess(user, laCase, tenantId);
    const current = normalizeLaStatus(laCase.status);
    const transition = LA_WORKFLOW_TRANSITIONS[current];
    if (!transition) {
      throw new BadRequestException('Case is at final stage or cannot be advanced further');
    }

    laCase.status = transition.next;
    if (laCase.status === 'possession_taken') laCase.possessionStatus = 'complete';
    if (laCase.status === 'construction_started') laCase.possessionStatus = 'complete';
    await this.caseRepo.save(laCase);
    await this.logEvent(tenantId, caseId, laCase.status, 'advance', user.sub, dto.remarks ?? transition.label);
    return this.getCase(tenantId, user, caseId);
  }

  async updateParcel(
    tenantId: string,
    user: JwtPayload,
    parcelId: string,
    dto: UpdateLaParcelDto,
  ) {
    const parcel = await this.parcelRepo.findOne({ where: { id: parcelId, tenantId } });
    if (!parcel) throw new NotFoundException('Parcel not found');
    const laCase = await this.requireCase(tenantId, parcel.laCaseId);
    await this.assertCaseAccess(user, laCase, tenantId);

    if (dto.village != null) parcel.village = dto.village;
    if (dto.khasraNo != null) parcel.khasraNo = dto.khasraNo;
    if (dto.landUse != null) parcel.landUse = dto.landUse;
    if (dto.acquisitionMode != null) parcel.acquisitionMode = dto.acquisitionMode;
    if (dto.status != null) parcel.status = dto.status;
    if (dto.circleRatePerSqm != null) parcel.circleRatePerSqm = dto.circleRatePerSqm;
    await this.parcelRepo.save(parcel);

    if (dto.ownerName?.trim()) {
      let owner = await this.ownerRepo.findOne({ where: { tenantId, laParcelId: parcelId, isPrimary: true } });
      if (!owner) {
        owner = this.ownerRepo.create({ tenantId, laParcelId: parcelId, isPrimary: true, sharePct: 100, verificationStatus: 'verified' });
      }
      owner.ownerName = dto.ownerName.trim();
      owner.verificationStatus = 'verified';
      await this.ownerRepo.save(owner);
    }

    await this.refreshCaseTotals(tenantId, parcel.laCaseId);
    return this.getCase(tenantId, user, parcel.laCaseId);
  }

  async updateClearance(
    tenantId: string,
    user: JwtPayload,
    clearanceId: string,
    dto: UpdateLaClearanceDto,
  ) {
    const item = await this.clearanceRepo.findOne({ where: { id: clearanceId, tenantId } });
    if (!item) throw new NotFoundException('Clearance item not found');
    const laCase = await this.requireCase(tenantId, item.laCaseId);
    await this.assertCaseAccess(user, laCase, tenantId);

    item.status = dto.status;
    if (dto.referenceNo != null) item.referenceNo = dto.referenceNo;
    if (dto.notes != null) item.notes = dto.notes;
    if (dto.status === 'applied') item.appliedAt = new Date();
    if (dto.status === 'approved') item.approvedAt = new Date();
    await this.clearanceRepo.save(item);

    const pending = await this.clearanceRepo.count({
      where: { tenantId, laCaseId: laCase.id, status: 'required' },
    });
    laCase.clearanceStatus = pending > 0 ? 'partial' : 'cleared';
    await this.caseRepo.save(laCase);

    const allClearances = await this.clearanceRepo.find({ where: { tenantId, laCaseId: laCase.id } });
    await this.saveClearanceProposal(tenantId, laCase, allClearances);

    return this.getCase(tenantId, user, laCase.id);
  }

  async caseAiAlerts(tenantId: string, user: JwtPayload, caseId: string) {
    const laCase = await this.requireCase(tenantId, caseId);
    await this.assertCaseAccess(user, laCase, tenantId);
    return this.buildCaseAiAlertsForId(tenantId, caseId, laCase);
  }

  async tenantAiAlerts(tenantId: string, user: JwtPayload) {
    const qb = this.caseRepo.createQueryBuilder('c')
      .where('c.tenant_id = :tenantId', { tenantId });
    await this.divisionAccess.applyDivisionScope(qb, user, 'c', tenantId);
    const cases = await qb.getMany();
    const allAlerts: LaAiAlert[] = [];
    for (const laCase of cases) {
      const bundle = await this.buildCaseAiAlertsForId(tenantId, laCase.id, laCase);
      allAlerts.push(...bundle.alerts);
    }
    allAlerts.sort((a, b) => {
      const rank = { critical: 0, warning: 1, info: 2 };
      return rank[a.severity] - rank[b.severity];
    });
    return { ...summarizeLaAiAlerts(allAlerts), alerts: allAlerts };
  }

  async getMapGeoJson(tenantId: string, user: JwtPayload, caseId: string) {
    const laCase = await this.requireCase(tenantId, caseId);
    await this.assertCaseAccess(user, laCase, tenantId);

    const alignments = await this.dataSource.query(
      `SELECT id, component, asset_type, status, row_width_m,
              ST_AsGeoJSON(geometry)::json AS geometry,
              ST_AsGeoJSON(corridor_geometry)::json AS corridor_geometry
       FROM la_alignment_segments WHERE tenant_id = $1 AND la_case_id = $2 AND geometry IS NOT NULL`,
      [tenantId, caseId],
    );

    const parcels = await this.dataSource.query(
      `SELECT id, khasra_no, village, status, affected_area_sqm,
              ownership_classification, ownership_type, current_status, mutation_status, attributes,
              ST_AsGeoJSON(COALESCE(intersection_geometry, geometry))::json AS geometry
       FROM la_parcels WHERE tenant_id = $1 AND la_case_id = $2 AND geometry IS NOT NULL`,
      [tenantId, caseId],
    );

    const roadCorridorColor = '#3b82f6';

    return {
      type: 'FeatureCollection',
      features: [
        ...alignments.map((a: Record<string, unknown>) => ({
          type: 'Feature',
          id: `alignment-${a.id}`,
          properties: {
            layer: 'alignment',
            component: a.component,
            status: a.status,
            rowWidthM: a.row_width_m,
            vizCategory: 'road_corridor',
            markerColor: roadCorridorColor,
          },
          geometry: a.geometry,
        })),
        ...alignments.filter((a: Record<string, unknown>) => a.corridor_geometry).map((a: Record<string, unknown>) => ({
          type: 'Feature',
          id: `corridor-${a.id}`,
          properties: {
            layer: 'corridor',
            component: a.component,
            rowWidthM: a.row_width_m,
            vizCategory: 'road_corridor',
            markerColor: roadCorridorColor,
          },
          geometry: a.corridor_geometry,
        })),
        ...parcels.map((p: Record<string, unknown>) => {
          const vizInput = {
            ownershipClassification: p.ownership_classification as string | null,
            status: p.status as string | null,
            currentStatus: p.current_status as string | null,
            mutationStatus: p.mutation_status as string | null,
            attributes: (p.attributes ?? {}) as Record<string, unknown>,
          };
          const vizCategory = resolveParcelVizCategory(vizInput);
          const markerColor = getParcelVizColor(vizInput);
          return {
            type: 'Feature',
            id: `parcel-${p.id}`,
            properties: {
              layer: 'parcel',
              khasraNo: p.khasra_no,
              village: p.village,
              status: p.status,
              affectedAreaSqm: p.affected_area_sqm,
              ownershipClassification: p.ownership_classification,
              ownershipType: p.ownership_type,
              currentStatus: p.current_status,
              mutationStatus: p.mutation_status,
              vizCategory,
              markerColor,
            },
            geometry: p.geometry,
          };
        }),
      ],
    };
  }

  /** Used by DPR planning for Stage 3 / Stage 8 gates */
  async getReadinessForProposal(tenantId: string, proposalId: string): Promise<LaReadiness> {
    const laCase = await this.caseRepo.findOne({ where: { tenantId, dprProposalId: proposalId } });
    if (!laCase) {
      return {
        hasCase: false,
        complete: false,
        canSubmitDprStage3: false,
        canRecordSanction: false,
        parcelsTotal: 0,
        parcelsPossession: 0,
        clearancesPending: [],
        estimatedCompensation: 0,
        missingActions: ['Create Land Acquisition case and trace alignment'],
      };
    }
    return this.buildReadiness(laCase);
  }

  async assertDprStage3LaGate(tenantId: string, proposalId: string) {
    const readiness = await this.getReadinessForProposal(tenantId, proposalId);
    if (!readiness.canSubmitDprStage3) {
      throw new BadRequestException(
        `Land acquisition incomplete for TAC submission: ${readiness.missingActions.join('; ')}`,
      );
    }
  }

  async assertDprStage8LaGate(tenantId: string, proposalId: string) {
    const readiness = await this.getReadinessForProposal(tenantId, proposalId);
    if (!readiness.canRecordSanction) {
      throw new BadRequestException(
        `Land acquisition clearances incomplete for sanction: ${readiness.missingActions.join('; ')}`,
      );
    }
  }

  private async buildReadiness(laCase: LaCase): Promise<LaReadiness> {
    const parcels = await this.parcelRepo.find({ where: { tenantId: laCase.tenantId, laCaseId: laCase.id } });
    const clearances = await this.clearanceRepo.find({ where: { tenantId: laCase.tenantId, laCaseId: laCase.id } });
    const pendingClearances = clearances
      .filter((c) => c.status === 'required' || c.status === 'applied')
      .map((c) => {
        const code = mapLegacyClearanceType(c.clearanceType);
        return findStatutoryClearance(code)?.label ?? LA_CLEARANCE_TYPES.find((t) => t.code === code)?.label ?? code;
      });

    const missingActions: string[] = [];
    if (!laStatusAtLeast(laCase.status, LA_DPR_STAGE3_MIN_STATUS)) {
      missingActions.push(`LA status must reach "${getLaStatusLabel(LA_DPR_STAGE3_MIN_STATUS)}" (current: ${getLaStatusLabel(laCase.status)})`);
    }
    if (parcels.length === 0) missingActions.push('Identify affected land parcels');
    const unverified = parcels.filter((p) => p.status === 'identified').length;
    if (unverified > 0) missingActions.push(`${unverified} parcel(s) pending survey verification`);

    const canSubmitDprStage3 = laStatusAtLeast(laCase.status, LA_DPR_STAGE3_MIN_STATUS) && parcels.length > 0;

    if (!laStatusAtLeast(laCase.status, LA_DPR_STAGE8_MIN_STATUS)) {
      missingActions.push(`LA must reach "${getLaStatusLabel(LA_DPR_STAGE8_MIN_STATUS)}" for sanction`);
    }
    if (pendingClearances.length > 0) {
      missingActions.push(`Pending clearances: ${pendingClearances.join(', ')}`);
    }

    const canRecordSanction = laStatusAtLeast(laCase.status, LA_DPR_STAGE8_MIN_STATUS)
      && pendingClearances.length === 0;

    const possessionCount = parcels.filter((p) => p.status === 'possession').length;

    return {
      hasCase: true,
      caseId: laCase.id,
      caseNo: laCase.caseNo,
      status: laCase.status,
      statusLabel: getLaStatusLabel(laCase.status),
      complete: normalizeLaStatus(laCase.status) === 'construction_started',
      canSubmitDprStage3,
      canRecordSanction,
      parcelsTotal: parcels.length,
      parcelsPossession: possessionCount,
      clearancesPending: pendingClearances,
      estimatedCompensation: Number(laCase.totalCompensationEst ?? 0),
      missingActions,
    };
  }

  private async identifyParcelsFromRowCorridor(
    tenantId: string,
    caseId: string,
    laCase: LaCase,
    segments: LaAlignmentSegment[],
  ): Promise<number> {
    let identified = 0;
    for (let i = 0; i < segments.length; i += 1) {
      const seg = segments[i];
      const rowWidth = Number(seg.rowWidthM ?? 6);
      const rows = await this.dataSource.query(
        `SELECT
           ST_AsGeoJSON(
             COALESCE(
               corridor_geometry,
               ST_Buffer(geometry::geography, $2)::geometry
             )
           )::json AS corridor_geom,
           ST_Area(
             COALESCE(
               corridor_geometry,
               ST_Buffer(geometry::geography, $2)::geometry
             )::geography
           ) AS affected_area_sqm,
           ST_Length(geometry::geography) AS affected_length_m
         FROM la_alignment_segments
         WHERE id = $1 AND geometry IS NOT NULL`,
        [seg.id, rowWidth],
      ) as Array<{
        corridor_geom: object;
        affected_area_sqm: string;
        affected_length_m: string;
      }>;

      const row = rows[0];
      if (!row?.corridor_geom) continue;

      const affectedAreaSqm = Number(row.affected_area_sqm ?? 0);
      if (affectedAreaSqm <= 0) continue;

      const affectedLengthM = Number(row.affected_length_m ?? 0);
      const acquisition = classifyAcquisition(affectedAreaSqm, affectedAreaSqm, affectedLengthM);
      const khasraNo = `ROW-${String(i + 1).padStart(3, '0')}`;

      const parcel = this.parcelRepo.create({
        tenantId,
        laCaseId: caseId,
        sourceFeatureId: null,
        khasraNo,
        khataNo: seg.chainageFrom ? String(seg.chainageFrom) : null,
        landUse: 'right_of_way',
        landClass: 'pipeline_corridor',
        ownershipType: 'Pending cadastral match',
        ownershipClassification: 'unknown',
        ownershipClassificationSource: 'row_corridor_fallback',
        ownershipClassificationDetails: {
          matchedLayers: [],
          matchedRule: 'row_corridor_fallback',
          label: 'ROW corridor segment (import la_parcels for cadastral parcels)',
        },
        totalAreaSqm: affectedAreaSqm,
        affectedAreaSqm,
        affectedLengthM,
        rowWidthM: rowWidth,
        temporaryAreaSqm: acquisition.temporaryAreaSqm,
        permanentAreaSqm: acquisition.permanentAreaSqm,
        circleRatePerSqm: 500,
        acquisitionMode: acquisition.acquisitionMode,
        attributes: {
          source: 'row_corridor_fallback',
          segmentId: seg.id,
          note: 'No cadastral parcel layer intersected the corridor; ROW segment used as placeholder parcel',
        },
        status: 'identified',
      });
      const saved = await this.parcelRepo.save(parcel);
      await this.dataSource.query(
        `UPDATE la_parcels SET
           geometry = ST_SetSRID(ST_GeomFromGeoJSON($1), 4326),
           intersection_geometry = ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)
         WHERE id = $2`,
        [JSON.stringify(row.corridor_geom), saved.id],
      );
      await this.ownerRepo.save(this.ownerRepo.create({
        tenantId,
        laParcelId: saved.id,
        ownerName: 'To be verified from revenue records',
        sharePct: 100,
        verificationStatus: 'pending',
        isPrimary: true,
      }));
      identified += 1;
    }

    return identified;
  }

  private async refreshCaseTotals(tenantId: string, caseId: string) {
    const parcels = await this.parcelRepo.find({ where: { tenantId, laCaseId: caseId } });
    const totalArea = parcels.reduce((s, p) => s + Number(p.affectedAreaSqm ?? 0), 0);
    const laCase = await this.caseRepo.findOne({ where: { id: caseId, tenantId } });
    if (!laCase) return;
    laCase.totalParcels = parcels.length;
    laCase.totalAreaSqm = totalArea;
    await this.caseRepo.save(laCase);
  }

  private async generateCaseNo(tenantId: string, divisionId: string | null): Promise<string> {
    const year = new Date().getFullYear();
    let divCode = 'HQ';
    if (divisionId) {
      const rows = await this.dataSource.query(
        'SELECT code FROM divisions WHERE id = $1',
        [divisionId],
      ) as Array<{ code: string }>;
      divCode = rows[0]?.code?.slice(0, 3).toUpperCase() ?? 'DIV';
    }
    const countRows = await this.dataSource.query(
      'SELECT COUNT(*)::int AS cnt FROM la_cases WHERE tenant_id = $1 AND case_no LIKE $2',
      [tenantId, `LA-${year}-${divCode}-%`],
    ) as Array<{ cnt: number }>;
    const seq = (countRows[0]?.cnt ?? 0) + 1;
    return `LA-${year}-${divCode}-${String(seq).padStart(4, '0')}`;
  }

  private async logEvent(
    tenantId: string,
    caseId: string,
    stage: string,
    action: string,
    actorId: string | undefined,
    remarks?: string,
    payload?: Record<string, unknown>,
  ) {
    await this.eventRepo.save(this.eventRepo.create({
      tenantId,
      laCaseId: caseId,
      stage,
      action,
      actorId: actorId ?? null,
      remarks: remarks ?? null,
      payload: payload ?? {},
    }));
  }

  private matchFeatureClasses(
    featureClasses: ProjectFeatureClass[],
    layer: LaGisLayerDef,
  ): ProjectFeatureClass[] {
    const aliases = new Set(layer.featureClassCodes.map((code) => code.toLowerCase()));
    return featureClasses.filter((fc) => {
      if (!aliases.has(fc.code.toLowerCase())) return false;
      if (fc.geometryType === 'Any') return true;
      return layer.geometryTypes.includes(fc.geometryType);
    });
  }

  private async buildLayerReadiness(tenantId: string, projectId: string) {
    const featureClasses = await this.fcRepo.find({ where: { tenantId, projectId } });

    return LA_GIS_OVERLAY_LAYERS.map((layer) => {
      const matching = this.matchFeatureClasses(featureClasses, layer);
      const configured = matching.length > 0;
      return {
        code: layer.code,
        label: layer.label,
        category: layer.category,
        geometryTypes: layer.geometryTypes,
        featureClassCodes: layer.featureClassCodes,
        clearanceType: layer.clearanceType ?? null,
        requiredForOverlay: layer.requiredForOverlay,
        analysisMode: layer.analysisMode,
        configured,
        featureClassCode: matching[0]?.code ?? null,
        featureClassName: matching[0]?.name ?? null,
        suggestedCode: layer.featureClassCodes[0],
      };
    });
  }

  private async resolveCaseProjectId(
    tenantId: string,
    user: JwtPayload,
    laCase: LaCase,
  ): Promise<string> {
    if (laCase.projectId) return laCase.projectId;
    if (!laCase.dprProposalId) {
      throw new BadRequestException('Link a project to this LA case before GIS routing');
    }

    const proposal = await this.proposalRepo.findOne({
      where: { id: laCase.dprProposalId, tenantId },
    });
    if (!proposal) throw new NotFoundException('DPR proposal not found');

    const workspace = await this.projectsService.ensureDprGisWorkspaceProject(tenantId, proposal);
    laCase.projectId = workspace.id;
    if (!laCase.divisionId && proposal.divisionId) {
      laCase.divisionId = proposal.divisionId;
    }
    await this.caseRepo.save(laCase);
    await this.logEvent(
      tenantId,
      laCase.id,
      laCase.status,
      'dpr_gis_workspace_linked',
      user.sub,
      `GIS workspace linked from DPR ${proposal.proposalNo}`,
      { projectId: workspace.id, dprProposalId: proposal.id },
    );
    return workspace.id;
  }

  private async requireCase(tenantId: string, caseId: string) {
    const row = await this.caseRepo.findOne({ where: { id: caseId, tenantId } });
    if (!row) throw new NotFoundException('Land acquisition case not found');
    return row;
  }

  private async assertCaseAccess(user: JwtPayload, laCase: LaCase, tenantId: string) {
    if (laCase.projectId) {
      await this.divisionAccess.assertProjectAccess(user, laCase.projectId, tenantId);
      return;
    }
    if (laCase.divisionId) {
      const accessible = await this.divisionAccess.getAccessibleDivisionIds(user, tenantId);
      if (accessible !== null && !accessible.includes(laCase.divisionId)) {
        throw new NotFoundException('Land acquisition case not found');
      }
    }
  }

  private toCaseSummary(row: LaCase) {
    return {
      id: row.id,
      caseNo: row.caseNo,
      title: row.title,
      projectId: row.projectId,
      dprProposalId: row.dprProposalId,
      divisionId: row.divisionId,
      schemeType: row.schemeType,
      status: row.status,
      statusLabel: getLaStatusLabel(row.status),
      stage: getLaStageForStatus(row.status),
      totalParcels: row.totalParcels,
      totalAreaSqm: Number(row.totalAreaSqm ?? 0),
      totalCompensationEst: Number(row.totalCompensationEst ?? 0),
      clearanceStatus: row.clearanceStatus,
      possessionStatus: row.possessionStatus,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private toAlignment(row: LaAlignmentSegment) {
    return {
      id: row.id,
      component: row.component,
      assetType: row.assetType,
      chainageFrom: row.chainageFrom,
      chainageTo: row.chainageTo,
      rowWidthM: Number(row.rowWidthM),
      status: row.status,
    };
  }

  private async buildCaseAiAlertsForId(
    tenantId: string,
    caseId: string,
    laCase: LaCase,
  ) {
    const [parcels, clearances, compensations, alignmentCount, owners] = await Promise.all([
      this.parcelRepo.find({ where: { tenantId, laCaseId: caseId } }),
      this.clearanceRepo.find({ where: { tenantId, laCaseId: caseId } }),
      this.compensationRepo.find({ where: { tenantId, laCaseId: caseId } }),
      this.alignmentRepo.count({ where: { tenantId, laCaseId: caseId } }),
      this.parcelRepo.find({ where: { tenantId, laCaseId: caseId } }).then(async (ps) => {
        if (!ps.length) return [];
        return this.ownerRepo
          .createQueryBuilder('o')
          .where('o.tenant_id = :tenantId', { tenantId })
          .andWhere('o.la_parcel_id IN (:...ids)', { ids: ps.map((p) => p.id) })
          .getMany();
      }),
    ]);

    const ownersByParcel = new Map<string, typeof owners>();
    for (const o of owners) {
      const list = ownersByParcel.get(o.laParcelId) ?? [];
      list.push(o);
      ownersByParcel.set(o.laParcelId, list);
    }

    const duplicateRefs = await this.findDuplicateAcquisitionRefs(tenantId, caseId, parcels);
    const alerts = this.buildCaseAiAlerts(
      laCase,
      parcels,
      clearances,
      compensations,
      alignmentCount > 0,
      ownersByParcel,
      duplicateRefs,
    );
    return { caseId, caseNo: laCase.caseNo, ...summarizeLaAiAlerts(alerts), alerts };
  }

  private buildCaseAiAlerts(
    laCase: LaCase,
    parcels: LaParcel[],
    clearances: LaClearanceItem[],
    compensations: LaCompensationSchedule[],
    hasAlignment: boolean,
    ownersByParcel: Map<string, LaParcelOwner[]>,
    duplicateRefs: Array<{ caseId: string; caseNo: string; khasraNo: string; village: string }>,
  ): LaAiAlert[] {
    return buildLaAiAlerts({
      laCaseId: laCase.id,
      caseNo: laCase.caseNo,
      caseTitle: laCase.title,
      hasAlignment,
      parcels: parcels.map((p) => ({
        id: p.id,
        khasraNo: p.khasraNo,
        khataNo: p.khataNo,
        village: p.village,
        landUse: p.landUse,
        landClass: p.landClass,
        ownershipClassification: p.ownershipClassification,
        ownershipType: p.ownershipType,
        department: p.department,
        ownerName: p.ownerName,
        currentStatus: p.currentStatus,
        mutationStatus: p.mutationStatus,
        attributes: p.attributes,
        owners: (ownersByParcel.get(p.id) ?? []).map((o) => ({
          ownerName: o.ownerName,
          verificationStatus: o.verificationStatus,
        })),
      })),
      clearances: clearances.map((c) => {
        const cleared = this.toClearance(c);
        return {
          id: c.id,
          clearanceType: cleared.clearanceType,
          label: cleared.label,
          status: c.status,
          authority: c.authority,
          overlayLayerCode: c.overlayLayerCode,
          approvedAt: c.approvedAt,
          laParcelId: c.laParcelId,
        };
      }),
      compensations: compensations.map((c) => ({
        laParcelId: c.laParcelId,
        totalAcquisitionCost: Number(c.totalAcquisitionCost ?? c.totalAward ?? 0),
        totalCompensation: Number(c.totalCompensation ?? 0),
        totalAward: Number(c.totalAward ?? 0),
      })),
      duplicateRefs,
    });
  }

  private async findDuplicateAcquisitionRefs(
    tenantId: string,
    caseId: string,
    parcels: LaParcel[],
  ): Promise<Array<{ caseId: string; caseNo: string; khasraNo: string; village: string }>> {
    const pairs = parcels
      .filter((p) => p.khasraNo?.trim() && p.village?.trim())
      .map((p) => ({
        khasra: p.khasraNo!.trim().toLowerCase(),
        village: p.village!.trim().toLowerCase(),
        khasraDisplay: p.khasraNo!.trim(),
        villageDisplay: p.village!.trim(),
      }));
    if (!pairs.length) return [];

    const rows = await this.dataSource.query(
      `SELECT DISTINCT c.id AS case_id, c.case_no, p.khasra_no, p.village
       FROM la_parcels p
       JOIN la_cases c ON c.id = p.la_case_id
       CROSS JOIN unnest($3::text[], $4::text[]) AS pair(village_key, khasra_key)
       WHERE p.tenant_id = $1
         AND p.la_case_id <> $2
         AND lower(trim(p.village)) = pair.village_key
         AND lower(trim(p.khasra_no)) = pair.khasra_key`,
      [
        tenantId,
        caseId,
        pairs.map((p) => p.village),
        pairs.map((p) => p.khasra),
      ],
    ) as Array<{ case_id: string; case_no: string; khasra_no: string; village: string }>;

    return rows.map((r) => ({
      caseId: r.case_id,
      caseNo: r.case_no,
      khasraNo: r.khasra_no,
      village: r.village,
    }));
  }

  private toParcel(row: LaParcel) {
    return {
      id: row.id,
      khasraNo: row.khasraNo,
      khataNo: row.khataNo,
      village: row.village,
      tehsil: row.tehsil,
      district: row.district,
      landUse: row.landUse,
      landCategory: row.landCategory,
      landClass: row.landClass,
      ownershipType: row.ownershipType,
      ownershipClassification: row.ownershipClassification,
      ownershipClassificationLabel: getOwnershipClassLabel(row.ownershipClassification),
      ownershipClassificationSource: row.ownershipClassificationSource,
      department: row.department,
      ownerName: row.ownerName,
      currentStatus: row.currentStatus,
      mutationStatus: row.mutationStatus,
      totalAreaSqm: Number(row.totalAreaSqm ?? 0),
      affectedAreaSqm: Number(row.affectedAreaSqm ?? 0),
      affectedLengthM: Number(row.affectedLengthM ?? 0),
      rowWidthM: Number(row.rowWidthM ?? 0),
      temporaryAreaSqm: Number(row.temporaryAreaSqm ?? 0),
      permanentAreaSqm: Number(row.permanentAreaSqm ?? 0),
      acquisitionMode: row.acquisitionMode,
      circleRatePerSqm: Number(row.circleRatePerSqm ?? 0),
      status: row.status,
    };
  }

  private async detectParcelOwnershipOverlays(
    tenantId: string,
    projectId: string,
    parcelGeometry: object,
  ): Promise<string[]> {
    const layerCodes = Object.keys(LA_OWNERSHIP_LAYER_MAP);
    const rows = await this.dataSource.query(
      `SELECT DISTINCT lower(fc.code) AS code
       FROM project_features pf
       JOIN project_feature_classes fc ON fc.id = pf.feature_class_id
       WHERE pf.tenant_id = $1 AND pf.project_id = $2
         AND lower(fc.code) = ANY($3::text[])
         AND pf.geometry IS NOT NULL
         AND ST_Intersects(
           pf.geometry,
           ST_SetSRID(ST_GeomFromGeoJSON($4), 4326)
         )`,
      [
        tenantId,
        projectId,
        layerCodes.map((c) => c.toLowerCase()),
        JSON.stringify(parcelGeometry),
      ],
    ) as Array<{ code: string }>;
    return rows.map((r) => r.code);
  }

  private async lookupAdminNameForParcel(
    tenantId: string,
    projectId: string,
    parcelGeometry: object,
    featureClassCodes: string[],
  ): Promise<string> {
    const rows = await this.dataSource.query(
      `SELECT COALESCE(
         pf.attributes->>'name',
         pf.attributes->>'Name',
         pf.attributes->>'village',
         pf.attributes->>'Village',
         pf.attributes->>'tehsil',
         pf.attributes->>'district',
         pf.attributes->>'label',
         fc.name
       ) AS label
       FROM project_features pf
       JOIN project_feature_classes fc ON fc.id = pf.feature_class_id
       WHERE pf.tenant_id = $1 AND pf.project_id = $2
         AND lower(fc.code) = ANY($3::text[])
         AND pf.geometry IS NOT NULL
         AND ST_Intersects(
           pf.geometry,
           ST_SetSRID(ST_GeomFromGeoJSON($4), 4326)
         )
       LIMIT 1`,
      [
        tenantId,
        projectId,
        featureClassCodes.map((c) => c.toLowerCase()),
        JSON.stringify(parcelGeometry),
      ],
    ) as Array<{ label: string | null }>;
    return String(rows[0]?.label ?? '').trim();
  }

  private toOwner(row: LaParcelOwner) {
    return {
      id: row.id,
      ownerName: row.ownerName,
      sharePct: Number(row.sharePct),
      verificationStatus: row.verificationStatus,
    };
  }

  private async saveClearanceProposal(
    tenantId: string,
    laCase: LaCase,
    items: LaClearanceItem[],
  ) {
    const pkg = buildClearanceProposalPackage(laCase.caseNo, laCase.title, items);
    let row = await this.clearanceProposalRepo.findOne({
      where: { tenantId, laCaseId: laCase.id },
    });
    if (!row) {
      row = this.clearanceProposalRepo.create({
        tenantId,
        laCaseId: laCase.id,
        proposalNo: pkg.proposalNo,
        title: pkg.title,
        status: pkg.status,
        package: pkg as unknown as Record<string, unknown>,
      });
    } else {
      row.proposalNo = pkg.proposalNo;
      row.title = pkg.title;
      row.status = pkg.status;
      row.package = pkg as unknown as Record<string, unknown>;
    }
    await this.clearanceProposalRepo.save(row);
  }

  private toDocument(row: LaCaseDocument) {
    return {
      id: row.id,
      documentCode: row.documentCode,
      title: row.title,
      status: row.status,
      category: (row.metadata?.category as string) ?? 'register',
      generatedAt: row.generatedAt,
    };
  }

  private toCompensation(row: LaCompensationSchedule) {
    return {
      id: row.id,
      laParcelId: row.laParcelId,
      ownerId: row.ownerId,
      circleRatePerSqm: Number(row.circleRatePerSqm ?? 0),
      marketRatePerSqm: Number(row.marketRatePerSqm ?? 0),
      affectedAreaSqm: Number(row.affectedAreaSqm ?? 0),
      landCompensation: Number(row.landCompensation ?? row.marketValue ?? 0),
      marketValue: Number(row.landCompensation ?? row.marketValue ?? 0),
      solatiumAmount: Number(row.solatiumAmount ?? 0),
      additionalCompensation: Number(row.additionalCompensation ?? 0),
      treeCompensation: Number(row.treeCompensation ?? 0),
      cropCompensation: Number(row.cropCompensation ?? 0),
      structureCompensation: Number(row.structureValue ?? 0),
      structureValue: Number(row.structureValue ?? 0),
      treesCropsValue: Number(row.treesCropsValue ?? 0),
      totalCompensation: Number(row.totalCompensation ?? 0),
      interestAmount: Number(row.interestAmount ?? 0),
      rehabilitationCost: Number(row.rehabilitationCost ?? 0),
      totalAcquisitionCost: Number(row.totalAcquisitionCost ?? row.totalAward ?? 0),
      totalAward: Number(row.totalAcquisitionCost ?? row.totalAward ?? 0),
      rrEntitlements: row.rrEntitlements ?? {},
      calculationBreakdown: row.calculationBreakdown ?? {},
      paymentStatus: row.paymentStatus,
    };
  }

  private toClearance(row: LaClearanceItem) {
    const code = mapLegacyClearanceType(row.clearanceType);
    const statutory = findStatutoryClearance(code);
    const def = statutory ?? LA_CLEARANCE_TYPES.find((c) => c.code === code);
    const layer = row.overlayLayerCode
      ? LA_GIS_OVERLAY_LAYERS.find((l) => l.code === row.overlayLayerCode)
      : undefined;
    return {
      id: row.id,
      laParcelId: row.laParcelId,
      clearanceType: code,
      label: def?.label ?? row.clearanceType,
      authority: row.authority ?? def?.authority,
      status: row.status,
      referenceNo: row.referenceNo,
      notes: row.notes,
      overlayLayerCode: row.overlayLayerCode,
      overlayLayerLabel: layer?.label ?? null,
      sourceFeatureClassCode: row.sourceFeatureClassCode,
      sourceFeatureId: row.sourceFeatureId,
      details: row.details ?? {},
    };
  }
}
