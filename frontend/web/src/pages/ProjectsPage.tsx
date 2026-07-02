import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  Grid,
  IconButton,
  LinearProgress,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import HandshakeOutlinedIcon from '@mui/icons-material/HandshakeOutlined';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import LayersIcon from '@mui/icons-material/Layers';
import EngineeringIcon from '@mui/icons-material/Engineering';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { projectsApi, divisionsApi, type Division, type DivisionStaffLogin, type MilestoneStatus, type OrthomosaicConfig, type PortfolioReadiness, type ProjectDeletionRequest } from '../services/api';
import { hasOrthomosaicBasemap, normalizeOrthomosaicConfig } from '../utils/orthomosaicBasemap';
import { useAuth } from '../context/AuthContext';
import { useDivisionScope, useDivisionScopeKey } from '../context/DivisionContext';
import { exportProjectsPdf } from '../utils/pdfExport';
import ExportPdfButton from '../components/common/ExportPdfButton';
import { formatApiError } from '../utils/apiError';
import { canManageMilestones, isMilestoneReadOnlyViewer } from '../utils/milestoneAccess';
import { isDivisionScopedUser } from '../utils/projectWorkflow';
import { isSuperAdmin, canPerformOperational } from '../utils/operationalAccess';
import { buildProjectCodeFromName, formatIndianFinancialYearLabel } from '../utils/projectCode';
import PageShell from '../components/layout/PageShell';
import PageHeader from '../components/layout/PageHeader';
import KpiStatCard from '../components/layout/KpiStatCard';
import {
  ProjectChipRow,
  ProjectDialogHeader,
  ProjectEmptyState,
  ProjectKpiGroupLabel,
  ProjectLifecycleTracker,
  ProjectSectionCard,
  projectDialogActionsSx,
  projectDialogContentSx,
  projectDialogPaperSx,
  projectToolbarSx,
} from '../components/projects/projectUi';
import {
  projectCardSx,
  projectCardHeaderSx,
  projectKpiPanelSx,
  projectKpiValueSx,
  projectKpiLabelSx,
  projectKpiProgressSx,
  projectMilestoneSectionSx,
  projectMilestoneTableSx,
  projectStatusChipSx,
} from '../utils/projectPresentationStyles';

interface MilestoneDprDetail {
  pct: number;
  dprQty: number;
  contractQty: number;
  unit: string;
  components: string[];
}

interface Milestone {
  id: string;
  name: string;
  dueDate: string | null;
  status: string;
  progress: number;
  dprLinked?: boolean;
  dprDetail?: MilestoneDprDetail;
}

type ChipColor = 'default' | 'success' | 'info' | 'warning' | 'error';

const MILESTONE_STATUS_META: Record<string, { label: string; color: ChipColor }> = {
  pending: { label: 'Pending', color: 'default' },
  in_progress: { label: 'In Progress', color: 'info' },
  completed: { label: 'Completed', color: 'success' },
  on_hold: { label: 'On Hold', color: 'warning' },
  delayed: { label: 'Delayed', color: 'error' },
};

function milestoneStatusMeta(status: string) {
  return MILESTONE_STATUS_META[status] ?? { label: status, color: 'default' as ChipColor };
}

const emptyMilestoneForm = {
  name: '',
  dueDate: '',
  status: 'pending' as MilestoneStatus,
  progress: 0,
};

interface Project {
  id: string;
  projectCode: string;
  name: string;
  description?: string;
  status: string;
  divisionId?: string | null;
  budget: number | null;
  spent: number;
  physicalProgress: number;
  financialProgress: number;
  milestones: Milestone[];
  orthomosaicConfig?: OrthomosaicConfig | null;
}

const emptyForm = {
  name: '',
  projectCode: '',
  description: '',
  status: 'active',
  divisionId: '',
  dprProposalId: '',
  orthomosaicTileUrl: '',
  orthomosaicName: '',
};

/** Milestones whose progress is auto-derived from contractor daily DPR. */
function milestoneLinkedToDpr(name: string) {
  const n = name.toLowerCase();
  return /pipeline|laying|main\s*line|pipe\s*line|distribution|network|reservoir|tank|fhtc|household|connection|source|intake/.test(n);
}

function formatDprQty(value: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value);
}

function dprProgressCaption(milestone: Milestone) {
  if (!milestone.dprLinked || !milestone.dprDetail) {
    return 'Auto from daily DPR';
  }
  const { dprQty, contractQty, unit, pct } = milestone.dprDetail;
  if (contractQty > 0) {
    return `${pct}% from contractor DPR · ${formatDprQty(dprQty)} / ${formatDprQty(contractQty)}${unit ? ` ${unit}` : ''}`;
  }
  if (dprQty > 0) {
    return `${pct}% from contractor DPR · ${formatDprQty(dprQty)}${unit ? ` ${unit}` : ''} done`;
  }
  return '0% — enter daily DPR in Construction';
}

function formatCurrency(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number(value));
}

function getErrorMessage(err: unknown, action = 'save project'): string {
  return formatApiError(
    err,
    `Failed to ${action}. Is the API running on port 3000? Start it with: cd backend/api && npm run start:dev`,
  );
}

function buildGisWorkspaceUrl(projectId: string) {
  return `/projects/${projectId}/feature-classes`;
}

function buildMapExplorerUrl(divisionFilter = '') {
  if (!divisionFilter) return '/map';
  return `/map?division=${encodeURIComponent(divisionFilter)}&fit=1`;
}

function getPortfolioEmptyMessage(
  readiness: PortfolioReadiness | null,
  divisionName?: string | null,
  canViewAllDivisions?: boolean,
  isDivisionUser?: boolean,
): { title: string; detail?: string } {
  if (readiness?.phase === 'awaiting_tender') {
    return {
      title: divisionName
        ? `Scheme(s) in ${divisionName} are in DPR approval`
        : 'Scheme(s) are progressing through DPR approval',
      detail: 'HQ registers construction projects after tender is published. Division office staff then execute GIS, daily DPR, and billing.',
    };
  }
  if (readiness?.phase === 'ready' && isDivisionUser) {
    return {
      title: divisionName
        ? `Tender published — awaiting HQ registration in ${divisionName}`
        : 'Tender published — awaiting HQ registration',
      detail: 'HQ officials (SE, CE, CGM, MD) register the construction project. Your division can begin GIS mapping and construction execution once registration is complete.',
    };
  }
  if (divisionName && !canViewAllDivisions) {
    return {
      title: `No schemes in ${divisionName} yet`,
      detail: 'Initiate a DPR proposal in DPR & Planning. HQ registers construction projects after tender is published; division office staff execute the work.',
    };
  }
  return {
    title: 'No projects yet',
    detail: 'HQ registers construction projects after tender is published in the DPR & Planning pipeline. Division offices execute GIS, construction, and billing.',
  };
}

export default function ProjectsPage() {
  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [portfolioReadiness, setPortfolioReadiness] = useState<PortfolioReadiness | null>(null);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [divisionSetupHint, setDivisionSetupHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [orthoUploadFile, setOrthoUploadFile] = useState<File | null>(null);
  const [staffLoginsOpen, setStaffLoginsOpen] = useState(false);
  const [staffLogins, setStaffLogins] = useState<DivisionStaffLogin[]>([]);
  const [staffLoginsDivision, setStaffLoginsDivision] = useState('');

  const [milestoneDialogOpen, setMilestoneDialogOpen] = useState(false);
  const [milestoneProject, setMilestoneProject] = useState<Project | null>(null);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [milestoneForm, setMilestoneForm] = useState(emptyMilestoneForm);
  const [milestoneError, setMilestoneError] = useState('');
  const [milestoneSaving, setMilestoneSaving] = useState(false);
  const [deletingMilestoneId, setDeletingMilestoneId] = useState<string | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [deletionRequests, setDeletionRequests] = useState<ProjectDeletionRequest[]>([]);
  const [deleteDialogProject, setDeleteDialogProject] = useState<Project | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deletionBusy, setDeletionBusy] = useState(false);
  const [creatingSchemeId, setCreatingSchemeId] = useState<string | null>(null);
  const [lifecycleStep, setLifecycleStep] = useState(3);
  const portfolioRef = useRef<HTMLDivElement>(null);

  const scrollToPortfolio = useCallback(() => {
    requestAnimationFrame(() => {
      portfolioRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  const canCreate = canPerformOperational(user?.roles, hasPermission, 'project:create');
  const canUpdate = canPerformOperational(user?.roles, hasPermission, 'project:update');
  const isSuperAdminUser = isSuperAdmin(user?.roles);
  const isDivisionEe = user?.roles?.includes('ee') ?? false;
  const isDivisionUser = isDivisionScopedUser(user);
  const canCreateProject = portfolioReadiness?.canCreateProject === true && canCreate;
  const canManageProjectMilestones = canManageMilestones(user);
  const milestoneReadOnly = isMilestoneReadOnlyViewer(user);
  const { activeDivisionId, activeDivision } = useDivisionScope();
  const divisionScopeKey = useDivisionScopeKey();
  const canViewAllDivisions = user?.canViewAllDivisions ?? false;
  const hqNeedsDivisionPick = canViewAllDivisions && !activeDivisionId;
  const divisionPickTooltip = 'Select a division from the header switcher first';

  const constructionButtonSx = (highlighted: boolean) => (highlighted ? {
    bgcolor: '#2563eb',
    boxShadow: '0 2px 8px rgba(37,99,235,0.45)',
    fontWeight: 600,
    '&:hover': { bgcolor: '#1d4ed8' },
  } : {
    bgcolor: 'rgba(255,255,255,0.08)',
    color: '#94a3b8',
    boxShadow: 'none',
    fontWeight: 600,
    '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
  });

  const divisionNameById = (id?: string | null) => {
    if (!id) return null;
    return divisions.find((d) => d.id === id)?.name ?? null;
  };

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [projectsRes, readinessRes, divisionsRes, accessRes, deletionRes] = await Promise.all([
        projectsApi.list(),
        projectsApi.portfolioReadiness().catch(() => ({ data: null as PortfolioReadiness | null })),
        divisionsApi.list().catch(() => ({ data: [] as Division[] })),
        divisionsApi.access().catch(() => ({ data: { divisionSchemaReady: false, setupHint: null } })),
        (isSuperAdminUser || isDivisionEe)
          ? projectsApi.listDeletionRequests().catch(() => ({ data: [] as ProjectDeletionRequest[] }))
          : Promise.resolve({ data: [] as ProjectDeletionRequest[] }),
      ]);
      setProjects(projectsRes.data);
      setPortfolioReadiness(readinessRes.data);
      setDivisions(divisionsRes.data ?? []);
      setDeletionRequests(deletionRes.data ?? []);
      if (!accessRes.data?.divisionSchemaReady) {
        setDivisionSetupHint(accessRes.data?.setupHint ?? 'Division database setup is pending. Run: cd backend/api && npm run setup:divisions');
      } else {
        setDivisionSetupHint(null);
      }
    } catch (err) {
      setLoadError(getErrorMessage(err, 'load projects'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [divisionScopeKey]);

  const openCreate = () => {
    setEditing(null);
    const soleReadyScheme = readySchemes.length === 1 ? readySchemes[0] : null;
    setForm({
      ...emptyForm,
      projectCode: buildProjectCodeFromName(soleReadyScheme?.title ?? ''),
      name: soleReadyScheme?.title ?? '',
      divisionId: canViewAllDivisions ? (activeDivisionId ?? soleReadyScheme?.divisionId ?? '') : (user?.divisionId ?? ''),
      dprProposalId: soleReadyScheme?.id ?? '',
    });
    setOrthoUploadFile(null);
    setError('');
    setDialogOpen(true);
  };

  const handleLifecycleStep = useCallback((step: number) => {
    setLifecycleStep(step);
    if (step === 1) {
      navigate('/dpr-planning');
      return;
    }
    if (step === 7) {
      navigate('/om');
      return;
    }
    if (step === 3 && canCreateProject) {
      setEditing(null);
      setForm({
        ...emptyForm,
        projectCode: buildProjectCodeFromName(''),
        divisionId: canViewAllDivisions ? (activeDivisionId ?? '') : (user?.divisionId ?? ''),
      });
      setOrthoUploadFile(null);
      setError('');
      setDialogOpen(true);
      return;
    }
    scrollToPortfolio();
  }, [navigate, scrollToPortfolio, canCreateProject, canViewAllDivisions, user?.divisionId, activeDivisionId]);

  const createAndOpenConstruction = async (scheme: PortfolioReadiness['readySchemes'][number]) => {
    if (!scheme.title.trim() || hqNeedsDivisionPick) return;
    setCreatingSchemeId(scheme.id);
    setLoadError('');
    try {
      const created = await projectsApi.create({
        name: scheme.title.trim(),
        description: `Linked to DPR proposal ${scheme.proposalNo}`,
        status: 'active',
        dprProposalId: scheme.id,
        ...(canViewAllDivisions && (activeDivisionId || scheme.divisionId)
          ? { divisionId: activeDivisionId || scheme.divisionId }
          : {}),
      });
      const projectId = created.data.id;
      const logins = created.data.divisionStaffLogins ?? [];
      if (logins.length > 0) {
        setStaffLogins(logins);
        setStaffLoginsDivision(divisionNameById(scheme.divisionId) ?? user?.divisionName ?? 'this division');
        setStaffLoginsOpen(true);
      }
      navigate(`/projects/${projectId}/construction`);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'create construction project'));
    } finally {
      setCreatingSchemeId(null);
    }
  };

  const openEdit = (project: Project) => {
    setEditing(project);
    const ortho = normalizeOrthomosaicConfig(project.orthomosaicConfig);
    setForm({
      name: project.name,
      projectCode: project.projectCode,
      description: project.description ?? '',
      status: project.status,
      orthomosaicTileUrl: ortho?.sourceType === 'file' ? '' : (ortho?.tileUrl ?? ''),
      orthomosaicName: ortho?.name ?? '',
    });
    setOrthoUploadFile(null);
    setError('');
    setDialogOpen(true);
  };

  const handleNameChange = (name: string) => {
    setForm((prev) => ({
      ...prev,
      name,
      projectCode: !editing ? buildProjectCodeFromName(name) : prev.projectCode,
    }));
  };

  const handleRemoveOrthomosaic = async () => {
    if (!editing) return;
    setSaving(true);
    setError('');
    try {
      await projectsApi.removeOrthomosaic(editing.id);
      setOrthoUploadFile(null);
      setForm((prev) => ({ ...prev, orthomosaicTileUrl: '', orthomosaicName: '' }));
      setEditing((prev) => (prev ? { ...prev, orthomosaicConfig: null } : prev));
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Project name is required.');
      return;
    }
    if (!editing && !/^PRJ-[A-Z]{2,10}-\d{4}-\d{2}$/.test(form.projectCode.trim())) {
      setError('Use at least two words in the project name so a scheme code can be generated (e.g. PRJ-TPPWSS-2026-27).');
      return;
    }
    if (!editing && !form.dprProposalId.trim()) {
      setError('Select a tender-published DPR proposal to register this construction project.');
      return;
    }
    if (canViewAllDivisions && !editing && !activeDivisionId) {
      setError('Select a division from the header switcher before creating a scheme.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        status: form.status,
        ...(canViewAllDivisions && activeDivisionId ? { divisionId: activeDivisionId } : {}),
        ...(!editing ? { dprProposalId: form.dprProposalId.trim() } : {}),
        orthomosaicConfig: form.orthomosaicTileUrl.trim()
          ? {
              tileUrl: form.orthomosaicTileUrl.trim(),
              name: form.orthomosaicName.trim() || undefined,
            }
          : undefined,
      };

      let projectId = editing?.id;
      if (editing) {
        await projectsApi.update(editing.id, payload);
      } else {
        const created = await projectsApi.create(payload);
        projectId = created.data.id;
        const logins = created.data.divisionStaffLogins ?? [];
        if (logins.length > 0) {
          setStaffLogins(logins);
          setStaffLoginsDivision(divisionNameById(activeDivisionId) ?? 'this division');
          setStaffLoginsOpen(true);
        }
      }

      if (orthoUploadFile && projectId) {
        await projectsApi.uploadOrthomosaic(
          projectId,
          orthoUploadFile,
          form.orthomosaicName.trim() || undefined,
        );
      }

      setDialogOpen(false);
      const openConstruction = !editing && projectId && form.dprProposalId;
      await load();
      if (openConstruction) {
        navigate(`/projects/${projectId}/construction`);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const openCreateMilestone = (project: Project) => {
    setMilestoneProject(project);
    setEditingMilestone(null);
    setMilestoneForm(emptyMilestoneForm);
    setMilestoneError('');
    setMilestoneDialogOpen(true);
  };

  const openEditMilestone = (project: Project, milestone: Milestone) => {
    setMilestoneProject(project);
    setEditingMilestone(milestone);
    setMilestoneForm({
      name: milestone.name,
      dueDate: milestone.dueDate ?? '',
      status: (milestone.status as MilestoneStatus) ?? 'pending',
      progress: Number(milestone.progress) || 0,
    });
    setMilestoneError('');
    setMilestoneDialogOpen(true);
  };

  const handleMilestoneStatusChange = (status: MilestoneStatus) => {
    setMilestoneForm((prev) => {
      if (status === 'completed') return { ...prev, status, progress: 100 };
      if (status === 'pending') return { ...prev, status, progress: 0 };
      return { ...prev, status };
    });
  };

  const handleSaveMilestone = async () => {
    if (!milestoneProject) return;
    if (!milestoneForm.name.trim()) {
      setMilestoneError('Milestone name is required.');
      return;
    }

    setMilestoneSaving(true);
    setMilestoneError('');
    try {
      const payload = {
        name: milestoneForm.name.trim(),
        dueDate: milestoneForm.dueDate || undefined,
        status: milestoneForm.status,
        progress: Math.min(100, Math.max(0, Number(milestoneForm.progress) || 0)),
      };

      if (editingMilestone) {
        await projectsApi.updateMilestone(milestoneProject.id, editingMilestone.id, payload);
      } else {
        await projectsApi.createMilestone(milestoneProject.id, payload);
      }

      setMilestoneDialogOpen(false);
      await load();
    } catch (err) {
      setMilestoneError(getErrorMessage(err, 'save milestone'));
    } finally {
      setMilestoneSaving(false);
    }
  };

  const handleRequestProjectDeletion = async () => {
    if (!deleteDialogProject) return;
    setDeletionBusy(true);
    setLoadError('');
    try {
      await projectsApi.requestDeletion(deleteDialogProject.id, {
        reason: deleteReason.trim() || undefined,
      });
      setDeleteDialogProject(null);
      setDeleteReason('');
      await load();
    } catch (err) {
      setLoadError(getErrorMessage(err, 'request project deletion'));
    } finally {
      setDeletionBusy(false);
    }
  };

  const handleApproveDeletion = async (request: ProjectDeletionRequest) => {
    if (!window.confirm(`Approve deletion of "${request.projectName}" (${request.projectCode})? This cannot be undone.`)) {
      return;
    }
    setDeletionBusy(true);
    setLoadError('');
    try {
      await projectsApi.approveDeletionRequest(request.id);
      await load();
    } catch (err) {
      setLoadError(getErrorMessage(err, 'approve deletion'));
    } finally {
      setDeletionBusy(false);
    }
  };

  const handleRejectDeletion = async (request: ProjectDeletionRequest) => {
    const remarks = window.prompt('Optional remarks for rejecting this deletion request:') ?? '';
    setDeletionBusy(true);
    setLoadError('');
    try {
      await projectsApi.rejectDeletionRequest(request.id, { remarks: remarks.trim() || undefined });
      await load();
    } catch (err) {
      setLoadError(getErrorMessage(err, 'reject deletion'));
    } finally {
      setDeletionBusy(false);
    }
  };

  const pendingDeletionByProjectId = useMemo(() => {
    const map = new Map<string, ProjectDeletionRequest>();
    deletionRequests
      .filter((r) => r.status === 'pending')
      .forEach((r) => map.set(r.projectId, r));
    return map;
  }, [deletionRequests]);

  const eePendingDeletions = useMemo(
    () => deletionRequests.filter((r) => r.status === 'pending'),
    [deletionRequests],
  );

  const filteredProjects = useMemo(
    () => projects.filter((p) => !activeDivisionId || p.divisionId === activeDivisionId),
    [projects, activeDivisionId],
  );

  const readySchemes = useMemo(
    () => (portfolioReadiness?.readySchemes ?? []).filter((s) => !activeDivisionId || s.divisionId === activeDivisionId),
    [portfolioReadiness, activeDivisionId],
  );

  const portfolioStats = useMemo(() => {
    const active = filteredProjects.filter((p) => p.status === 'active').length;
    const avgPhysical = filteredProjects.length
      ? Math.round(filteredProjects.reduce((sum, p) => sum + (Number(p.physicalProgress) || 0), 0) / filteredProjects.length)
      : 0;
    const withBudget = filteredProjects.filter((p) => Number(p.budget) > 0);
    const avgFinancial = withBudget.length
      ? Math.round(
          withBudget.reduce((sum, p) => {
            const budget = Number(p.budget) || 0;
            const spent = Number(p.spent) || 0;
            return sum + (budget > 0 ? Math.min(100, (spent / budget) * 100) : 0);
          }, 0) / withBudget.length,
        )
      : 0;
    return {
      total: filteredProjects.length,
      active,
      ready: readySchemes.length,
      avgPhysical,
      avgFinancial,
    };
  }, [filteredProjects, readySchemes]);

  const handleDeleteMilestone = async (project: Project, milestone: Milestone) => {
    if (!window.confirm(`Delete milestone "${milestone.name}"?`)) return;
    setDeletingMilestoneId(milestone.id);
    try {
      await projectsApi.deleteMilestone(project.id, milestone.id);
      await load();
    } catch (err) {
      setLoadError(getErrorMessage(err, 'delete milestone'));
    } finally {
      setDeletingMilestoneId(null);
    }
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Construction Portfolio"
        title="Project Management"
        subtitle="DPR-approved schemes · GIS mapping · daily DPR · measurement books · BOQ · RA bills · milestone tracking"
        accent="blue"
        leading={<AssignmentOutlinedIcon sx={{ fontSize: 36, color: '#2563eb', mt: 0.5 }} />}
        actions={(
          <Box display="flex" alignItems="center" gap={1.5} flexWrap="wrap">
            <ExportPdfButton
              disabled={loading || filteredProjects.length === 0}
              onClick={() => exportProjectsPdf(
                filteredProjects.map((p) => ({
                  projectCode: p.projectCode,
                  name: p.name,
                  divisionName: divisionNameById(p.divisionId),
                  status: p.status,
                  physicalProgress: Number(p.physicalProgress) || 0,
                  financialProgress: Number(p.financialProgress) || 0,
                  budget: p.budget,
                  spent: Number(p.spent) || 0,
                })),
                activeDivision?.name ?? null,
              )}
            />
            {canCreateProject && (
              <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} sx={{ px: 2.5, boxShadow: 2 }}>
                New Project
              </Button>
            )}
          </Box>
        )}
      />

      {loadError && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{loadError}</Alert>}

      {isDivisionEe && eePendingDeletions.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
          <Typography variant="subtitle2" 
            fontWeight={700} sx={{ mb: 1 }}>
            Scheme deletion requests awaiting EE approval ({eePendingDeletions.length})
          </Typography>
          {eePendingDeletions.map((req) => (
            <Box key={req.id} display="flex" alignItems="center" justifyContent="space-between" gap={2} flexWrap="wrap" sx={{ mt: 1 }}>
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  {req.projectName} ({req.projectCode})
                </Typography>
                {req.reason ? (
                  <Typography variant="caption" color="text.secondary">Reason: {req.reason}</Typography>
                ) : null}
              </Box>
              <Box display="flex" gap={1}>
                <Button
                  size="small"
                  color="error"
                  variant="contained"
                  disabled={deletionBusy}
                  onClick={() => handleApproveDeletion(req)}
                >
                  Approve deletion
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={deletionBusy}
                  onClick={() => handleRejectDeletion(req)}
                >
                  Reject
                </Button>
              </Box>
            </Box>
          ))}
        </Alert>
      )}

      {divisionSetupHint && (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
          Division isolation is not active yet. {divisionSetupHint}
        </Alert>
      )}

      <Box
        sx={{
          mb: 2.5,
          p: 2.5,
          borderRadius: 3,
          background: 'linear-gradient(135deg, #0f172a 0%, #1e40af 42%, #0d9488 100%)',
          color: '#f8fafc',
          boxShadow: '0 12px 40px rgba(15, 23, 42, 0.2)',
        }}
      >
        <Typography variant="overline" sx={{ letterSpacing: '0.14em', fontWeight: 700, color: 'rgba(248,250,252,0.75)' }}>
          Construction lifecycle
        </Typography>
        <Typography variant="h6" fontWeight={800} sx={{ mb: 0.5, letterSpacing: '-0.02em' }}>
          DPR → Tender → Project Setup → GIS → Construction → Milestones → O&M Handover
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(248,250,252,0.85)', mb: 2, maxWidth: 760 }}>
          HQ registers schemes after tender; division office staff execute GIS, construction, and billing.
        </Typography>
        <ProjectLifecycleTracker activeStep={lifecycleStep} onStepSelect={handleLifecycleStep} />
      </Box>

      {!loading && (
        <Grid container spacing={2} mb={2.5}>
          <Grid item xs={12}><ProjectKpiGroupLabel>Portfolio snapshot</ProjectKpiGroupLabel></Grid>
          <Grid item xs={6} sm={4} md={3}>
            <KpiStatCard label="Active Schemes" value={portfolioStats.total} tone="blue" />
          </Grid>
          <Grid item xs={6} sm={4} md={3}>
            <KpiStatCard label="In Execution" value={portfolioStats.active} tone="teal" />
          </Grid>
          <Grid item xs={6} sm={4} md={3}>
            <KpiStatCard label="Avg Work Progress" value={`${portfolioStats.avgPhysical}%`} tone="blue" />
          </Grid>
          <Grid item xs={6} sm={4} md={3}>
            <KpiStatCard label="Avg Payment Progress" value={`${portfolioStats.avgFinancial}%`} tone="teal" />
          </Grid>
          {portfolioStats.ready > 0 && (
            <Grid item xs={6} sm={4} md={3}>
              <KpiStatCard label="Ready to Start" value={portfolioStats.ready} tone="amber" />
            </Grid>
          )}
        </Grid>
      )}

      <Box sx={projectToolbarSx}>
        <Box>
          <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#0f172a' }}>
            Scheme portfolio
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Open GIS catalog or construction workspace per scheme
          </Typography>
        </Box>
      </Box>

      <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }} gap={2} mb={2.5}>
        <ProjectSectionCard title="Quick access" phase="planning">
          <ProjectChipRow>
            <Chip component={RouterLink} to="/dpr-planning" clickable icon={<FactCheckOutlinedIcon />} label="DPR & Planning" color="primary" variant="outlined" />
            <Chip component={RouterLink} to={buildMapExplorerUrl(activeDivisionId ?? '')} clickable icon={<MapOutlinedIcon />} label="Map Explorer" color="primary" variant="outlined" />
            <Chip component={RouterLink} to="/om" clickable icon={<HandshakeOutlinedIcon />} label="O&M Handover" color="primary" variant="outlined" />
          </ProjectChipRow>
        </ProjectSectionCard>
        <ProjectSectionCard title="Construction modules" phase="execution">
          <ProjectChipRow>
            <Chip label="Daily DPR" size="small" variant="outlined" />
            <Chip label="Measurement Book" size="small" variant="outlined" />
            <Chip label="Govt. BOQ" size="small" variant="outlined" />
            <Chip label="RA Bills" size="small" variant="outlined" />
            <Chip label="Final Bill" size="small" variant="outlined" />
            <Chip label="Drone Orthomosaic" size="small" variant="outlined" />
          </ProjectChipRow>
        </ProjectSectionCard>
      </Box>

      <Box ref={portfolioRef} sx={{ scrollMarginTop: '88px' }}>
      {loading ? (
        <LinearProgress sx={{ borderRadius: 999 }} />
      ) : filteredProjects.length === 0 && portfolioReadiness?.phase === 'ready' && readySchemes.length > 0 ? (
        <Grid container spacing={3}>
          {readySchemes.map((scheme) => (
            <Grid item xs={12} key={scheme.id}>
              <Card sx={projectCardSx()} elevation={0}>
                <Box sx={projectCardHeaderSx()}>
                  <Box flex={1} minWidth={0}>
                    <Typography variant="h6" fontWeight={700} sx={{ color: '#fff', letterSpacing: '-0.01em' }}>
                      {scheme.title}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600, letterSpacing: '0.04em' }}>
                      {scheme.proposalNo}
                      {scheme.divisionId && divisionNameById(scheme.divisionId)
                        ? ` · ${divisionNameById(scheme.divisionId)}`
                        : user?.divisionName
                          ? ` · ${user.divisionName}`
                          : ''}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#cbd5e1', mt: 0.75, maxWidth: 720 }}>
                      Tender published — HQ registers the construction project; division office staff then begin GIS mapping, daily DPR, measurement books, BOQ, and contractor billing.
                    </Typography>
                  </Box>
                  <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                    <Chip label="Tender Published" size="small" color="success" sx={{ fontWeight: 600 }} />
                    <Tooltip title="Available after the construction project is created">
                      <span>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<LayersIcon />}
                          disabled
                          sx={{
                            color: '#94a3b8',
                            borderColor: 'rgba(255,255,255,0.2)',
                          }}
                        >
                          GIS Mapping
                        </Button>
                      </span>
                    </Tooltip>
                    {canCreateProject ? (
                      <Tooltip title={hqNeedsDivisionPick ? divisionPickTooltip : ''}>
                        <span>
                          <Button
                            variant="contained"
                            startIcon={<EngineeringIcon />}
                            disabled={creatingSchemeId === scheme.id || hqNeedsDivisionPick}
                            onClick={() => createAndOpenConstruction(scheme)}
                            sx={constructionButtonSx(!hqNeedsDivisionPick)}
                          >
                            {creatingSchemeId === scheme.id ? 'Creating…' : 'Construction'}
                          </Button>
                        </span>
                      </Tooltip>
                    ) : isDivisionUser ? (
                      <Chip
                        label="Awaiting HQ registration"
                        size="small"
                        color="warning"
                        sx={{ fontWeight: 600 }}
                      />
                    ) : (
                      <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                        HQ registration required before construction can begin.
                      </Typography>
                    )}
                  </Box>
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : filteredProjects.length === 0 ? (
        <Card sx={projectCardSx()} elevation={0}>
          <CardContent sx={{ p: 0 }}>
            {(() => {
              const emptyMsg = getPortfolioEmptyMessage(
                portfolioReadiness,
                user?.divisionName,
                canViewAllDivisions,
                isDivisionUser,
              );
              return (
                <ProjectEmptyState title={emptyMsg.title} detail={emptyMsg.detail}>
                  {portfolioReadiness?.phase !== 'ready' && (
                    <Button
                      component={RouterLink}
                      to="/dpr-planning"
                      variant="outlined"
                      size="small"
                      sx={{ mt: 0.5 }}
                    >
                      Open DPR & Planning
                    </Button>
                  )}
                  {canCreateProject && (
                    <Box mt={2}>
                      <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
                        Create your first project
                      </Button>
                    </Box>
                  )}
                </ProjectEmptyState>
              );
            })()}
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {filteredProjects.map((project) => {
            const budget = Number(project.budget) || 0;
            const spent = Number(project.spent) || 0;
            const financialPct = budget > 0
              ? Math.min(100, Math.round((spent / budget) * 10000) / 100)
              : 0;
            const physicalPct = Number(project.physicalProgress) || 0;
            return (
            <Grid item xs={12} key={project.id}>
              <Card sx={projectCardSx()} elevation={0}>
                <Box sx={projectCardHeaderSx()}>
                  <Box flex={1} minWidth={0}>
                    <Typography variant="h6" fontWeight={700} sx={{ color: '#fff', letterSpacing: '-0.01em' }}>
                      {project.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600, letterSpacing: '0.04em' }}>
                      {project.projectCode}
                      {project.divisionId && divisionNameById(project.divisionId)
                        ? ` · ${divisionNameById(project.divisionId)}`
                        : ''}
                    </Typography>
                    {project.description ? (
                      <Typography variant="body2" sx={{ color: '#cbd5e1', mt: 0.75, maxWidth: 640 }}>
                        {project.description}
                      </Typography>
                    ) : null}
                  </Box>
                  <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                    <Tooltip title={hqNeedsDivisionPick ? divisionPickTooltip : ''}>
                      <Chip
                        label={hqNeedsDivisionPick ? 'Inactive' : project.status.replace(/_/g, ' ')}
                        size="small"
                        sx={projectStatusChipSx(hqNeedsDivisionPick ? 'inactive' : project.status)}
                      />
                    </Tooltip>
                    {canUpdate && (
                      <Tooltip title="Edit project">
                        <IconButton
                          size="small"
                          onClick={() => openEdit(project)}
                          sx={{ color: '#e2e8f0', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {isSuperAdminUser && (
                      <Tooltip title={
                        pendingDeletionByProjectId.has(project.id)
                          ? 'Deletion request pending EE approval'
                          : 'Request scheme deletion (requires Division EE approval)'
                      }>
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            disabled={deletingProjectId === project.id || pendingDeletionByProjectId.has(project.id)}
                            onClick={() => {
                              setDeleteReason('');
                              setDeleteDialogProject(project);
                            }}
                            sx={{ color: '#fecaca', '&:hover': { bgcolor: 'rgba(239,68,68,0.2)' } }}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    )}
                    <Tooltip title={hqNeedsDivisionPick ? divisionPickTooltip : 'Create feature classes, layers, and attributes'}>
                      <span>
                        <Button
                          component={hqNeedsDivisionPick ? 'button' : RouterLink}
                          to={
                            hqNeedsDivisionPick
                              ? undefined
                              : buildGisWorkspaceUrl(project.id)
                          }
                          disabled={hqNeedsDivisionPick}
                          size="small"
                          variant="outlined"
                          startIcon={<LayersIcon />}
                          sx={{
                            color: '#f8fafc',
                            borderColor: 'rgba(255,255,255,0.35)',
                            '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.08)' },
                          }}
                        >
                          GIS Mapping
                        </Button>
                      </span>
                    </Tooltip>
                    <Tooltip title={hqNeedsDivisionPick ? divisionPickTooltip : ''}>
                      <span>
                        <Button
                          component={hqNeedsDivisionPick ? 'button' : RouterLink}
                          to={hqNeedsDivisionPick ? undefined : `/projects/${project.id}/construction`}
                          disabled={hqNeedsDivisionPick}
                          size="small"
                          variant="contained"
                          startIcon={<EngineeringIcon />}
                          sx={constructionButtonSx(!hqNeedsDivisionPick)}
                        >
                          Construction
                        </Button>
                      </span>
                    </Tooltip>
                  </Box>
                </Box>

                <CardContent sx={{ px: 3, py: 2.5 }}>
                  <Grid container spacing={2} mb={0}>
                    <Grid item xs={12} md={6}>
                      <Box sx={projectKpiPanelSx('physical')}>
                        <Typography sx={projectKpiLabelSx('physical')}>Work Progress</Typography>
                        <Typography sx={projectKpiValueSx('physical')}>{physicalPct}%</Typography>
                        <LinearProgress
                          variant="determinate"
                          value={physicalPct}
                          sx={projectKpiProgressSx('physical')}
                        />
                        <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 1 }}>
                          Milestone average · Pipeline Laying from daily DPR
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Box sx={projectKpiPanelSx('financial')}>
                        <Typography sx={projectKpiLabelSx('financial')}>Payment Progress</Typography>
                        <Typography sx={projectKpiValueSx('financial')}>{financialPct}%</Typography>
                        <LinearProgress
                          variant="determinate"
                          value={financialPct}
                          sx={projectKpiProgressSx('financial')}
                        />
                        <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 1 }}>
                          Spent {formatCurrency(project.spent)} / Budget {formatCurrency(project.budget)}
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>

                  <Box sx={projectMilestoneSectionSx()}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
                      <Typography
                        variant="subtitle2"
                        fontWeight={800}
                        sx={{ color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.75rem' }}
                      >
                        Milestones
                      </Typography>
                      {canManageProjectMilestones && (
                        <Button
                          size="small"
                          startIcon={<AddIcon fontSize="small" />}
                          onClick={() => openCreateMilestone(project)}
                          sx={{ fontWeight: 600 }}
                        >
                          Add Milestone
                        </Button>
                      )}
                    </Box>
                    {project.milestones?.length ? (
                      <Table size="small" sx={projectMilestoneTableSx()}>
                        <TableHead>
                          <TableRow>
                            <TableCell>Name</TableCell>
                            <TableCell>Due Date</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell sx={{ width: 220 }}>Progress</TableCell>
                            {canManageProjectMilestones && <TableCell align="right" sx={{ width: 88 }}>Actions</TableCell>}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {project.milestones.map((m) => {
                            const meta = milestoneStatusMeta(m.status);
                            const pct = Math.min(100, Math.max(0, Number(m.progress) || 0));
                            const fromDpr = m.dprLinked ?? milestoneLinkedToDpr(m.name);
                            return (
                              <TableRow key={m.id}>
                                <TableCell>
                                  <Typography variant="body2" fontWeight={600}>{m.name}</Typography>
                                  {fromDpr && (
                                    <Typography variant="caption" color="info.main" display="block">
                                      {dprProgressCaption(m)}
                                    </Typography>
                                  )}
                                </TableCell>
                                <TableCell>{m.dueDate || '—'}</TableCell>
                                <TableCell>
                                  <Chip label={meta.label} size="small" color={meta.color} variant="outlined" />
                                </TableCell>
                                <TableCell>
                                  <Box display="flex" alignItems="center" gap={1}>
                                    <LinearProgress
                                      variant="determinate"
                                      value={pct}
                                      color={meta.color === 'default' ? 'primary' : meta.color}
                                      sx={{ flex: 1, height: 8, borderRadius: 4 }}
                                    />
                                    <Typography variant="caption" fontWeight={700} sx={{ minWidth: 38, textAlign: 'right' }}>
                                      {pct}%
                                    </Typography>
                                  </Box>
                                </TableCell>
                                {canManageProjectMilestones && (
                                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                    <Box display="inline-flex" alignItems="center" justifyContent="flex-end" gap={0.25}>
                                      <Tooltip title="Edit milestone">
                                        <IconButton size="small" onClick={() => openEditMilestone(project, m)}>
                                          <EditIcon fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                      <Tooltip title="Delete milestone">
                                        <IconButton
                                          size="small"
                                          color="error"
                                          disabled={deletingMilestoneId === m.id}
                                          onClick={() => handleDeleteMilestone(project, m)}
                                        >
                                          <DeleteOutlineIcon fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                    </Box>
                                  </TableCell>
                                )}
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    ) : (
                      <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                        No milestones yet.
                        {canManageProjectMilestones
                          ? ' Use “Add Milestone” to create one.'
                          : milestoneReadOnly
                            ? ' Division JE, AE, EE, or Accounts will add milestones after scheme registration.'
                            : ''}
                      </Typography>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            );
          })}
        </Grid>
      )}
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: projectDialogPaperSx }}>
        <ProjectDialogHeader
          title={editing ? 'Edit Project' : 'Create Project'}
          subtitle={editing ? editing.projectCode : 'HQ registers a construction scheme after tender publication'}
          phase={editing ? 'execution' : 'planning'}
          busy={saving}
        />
        <DialogContent sx={projectDialogContentSx}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <TextField
            fullWidth
            required
            label="Project Name"
            margin="dense"
            value={form.name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="e.g. Pump House Rehabilitation"
          />
          {!editing && readySchemes.length > 0 && (
            <TextField
              fullWidth
              required
              select
              label="DPR proposal (tender published)"
              margin="dense"
              value={form.dprProposalId}
              onChange={(e) => {
                const scheme = readySchemes.find((s) => s.id === e.target.value);
                setForm((prev) => ({
                  ...prev,
                  dprProposalId: e.target.value,
                  name: scheme?.title ?? prev.name,
                  projectCode: scheme?.title ? buildProjectCodeFromName(scheme.title) : prev.projectCode,
                }));
              }}
              helperText="HQ must link each construction project to a tender-published DPR proposal."
            >
              {readySchemes.map((scheme) => (
                <MenuItem key={scheme.id} value={scheme.id}>
                  {scheme.proposalNo} — {scheme.title}
                  {scheme.divisionId && divisionNameById(scheme.divisionId)
                    ? ` (${divisionNameById(scheme.divisionId)})`
                    : ''}
                </MenuItem>
              ))}
            </TextField>
          )}
          <TextField
            fullWidth
            required
            label="Project Code"
            margin="dense"
            value={form.projectCode}
            InputProps={{
              readOnly: true,
              sx: !editing
                ? {
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                    color: '#1d4ed8',
                    bgcolor: '#eff6ff',
                  }
                : undefined,
            }}
            placeholder="PRJ-TPPWSS-2026-27"
            helperText={
              editing
                ? 'Scheme code is fixed after creation'
                : `Auto: PRJ + first letter of each word + ${formatIndianFinancialYearLabel()}`
            }
          />
          <TextField
            fullWidth
            label="Description"
            margin="dense"
            multiline
            minRows={2}
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          />
          <TextField
            fullWidth
            select
            label="Status"
            margin="dense"
            value={form.status}
            onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
          >
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="planning">Planning</MenuItem>
            <MenuItem value="on_hold">On Hold</MenuItem>
            <MenuItem value="completed">Completed</MenuItem>
          </TextField>
          {canViewAllDivisions && !editing && activeDivisionId && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Scheme will be created in <strong>{divisionNameById(activeDivisionId) ?? 'selected division'}</strong>
              {' '}(change via the Division switcher in the header).
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary" display="block" mt={1}>
            Budget and payment progress are synced automatically from Construction:
            approved Govt. BOQ (Work Planning) and finance-released RA bills.
          </Typography>
          <Typography variant="subtitle2" sx={{ mt: 2.5, mb: 0.5 }}>
            Drone mosaic (optional)
          </Typography>
          <Button
            variant="outlined"
            component="label"
            startIcon={<UploadFileIcon />}
            fullWidth
            sx={{ justifyContent: 'flex-start', textTransform: 'none', mb: 1 }}
          >
            {orthoUploadFile
              ? orthoUploadFile.name
              : editing && normalizeOrthomosaicConfig(editing.orthomosaicConfig)?.fileName
                ? `Replace ${normalizeOrthomosaicConfig(editing.orthomosaicConfig)?.fileName}`
                : 'Upload GeoTIFF file (.tif)'}
            <input
              hidden
              type="file"
              accept=".tif,.tiff,.geotiff,image/tiff"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setOrthoUploadFile(file);
              }}
            />
          </Button>
          <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
            Upload a georeferenced orthomosaic file, or use a Mosaic URL below if tiles are already hosted online.
          </Typography>
          <TextField
            fullWidth
            label="Mosaic URL"
            margin="dense"
            value={form.orthomosaicTileUrl}
            onChange={(e) => setForm((prev) => ({ ...prev, orthomosaicTileUrl: e.target.value }))}
            placeholder="https://tiles.example.com/project/{z}/{x}/{y}.png"
            helperText="Optional. XYZ tile URL with {z}, {x}, {y}."
          />
          <TextField
            fullWidth
            label="Basemap label"
            margin="dense"
            value={form.orthomosaicName}
            onChange={(e) => setForm((prev) => ({ ...prev, orthomosaicName: e.target.value }))}
            placeholder="e.g. Badhangarhi Drone Survey 2025"
            disabled={!form.orthomosaicTileUrl.trim() && !orthoUploadFile && !hasOrthomosaicBasemap(editing?.orthomosaicConfig)}
          />
          {editing && hasOrthomosaicBasemap(editing.orthomosaicConfig) && (
            <Button
              color="error"
              size="small"
              startIcon={<DeleteOutlineIcon />}
              onClick={() => { void handleRemoveOrthomosaic(); }}
              disabled={saving}
              sx={{ mt: 1 }}
            >
              Remove orthomosaic
            </Button>
          )}
        </DialogContent>
        <DialogActions sx={projectDialogActionsSx}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Project'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={milestoneDialogOpen} onClose={() => setMilestoneDialogOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: projectDialogPaperSx }}>
        <ProjectDialogHeader
          title={editingMilestone ? 'Edit Milestone' : 'Add Milestone'}
          subtitle={milestoneProject?.name}
          phase="delivery"
          busy={milestoneSaving}
        />
        <DialogContent sx={projectDialogContentSx}>
          {milestoneError && <Alert severity="error" sx={{ mb: 2 }}>{milestoneError}</Alert>}
          {(() => {
            const autoFromDpr = milestoneLinkedToDpr(milestoneForm.name);
            return (
              <>
          <TextField
            autoFocus
            fullWidth
            required
            label="Milestone Name"
            margin="dense"
            value={milestoneForm.name}
            onChange={(e) => setMilestoneForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="e.g. Pipeline Laying"
            helperText={autoFromDpr
              ? 'Progress updates automatically from contractor daily DPR in Construction.'
              : 'Manual milestones (e.g. Procurement) — enter progress yourself.'}
          />
          <TextField
            fullWidth
            label="Due Date"
            type="date"
            margin="dense"
            value={milestoneForm.dueDate}
            onChange={(e) => setMilestoneForm((prev) => ({ ...prev, dueDate: e.target.value }))}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            fullWidth
            select
            label="Status"
            margin="dense"
            value={milestoneForm.status}
            disabled={autoFromDpr}
            onChange={(e) => handleMilestoneStatusChange(e.target.value as MilestoneStatus)}
          >
            {Object.entries(MILESTONE_STATUS_META).map(([value, meta]) => (
              <MenuItem key={value} value={value}>{meta.label}</MenuItem>
            ))}
          </TextField>
          <TextField
            fullWidth
            label="Progress (%)"
            type="number"
            margin="dense"
            value={milestoneForm.progress}
            disabled={autoFromDpr}
            onChange={(e) => setMilestoneForm((prev) => ({ ...prev, progress: Number(e.target.value) }))}
            inputProps={{ min: 0, max: 100, step: 5 }}
            helperText={autoFromDpr
              ? 'Derived from daily DPR quantities vs approved BOQ (Construction → Daily Progress).'
              : 'Included in overall Work Progress average.'}
          />
              </>
            );
          })()}
        </DialogContent>
        <DialogActions sx={projectDialogActionsSx}>
          <Button onClick={() => setMilestoneDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveMilestone} disabled={milestoneSaving}>
            {milestoneSaving ? 'Saving…' : editingMilestone ? 'Save Changes' : 'Add Milestone'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={staffLoginsOpen} onClose={() => setStaffLoginsOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: projectDialogPaperSx }}>
        <ProjectDialogHeader
          title="Division staff — ready to log in"
          subtitle={staffLoginsDivision}
          badge="Scheme created"
          phase="delivery"
        />
        <DialogContent sx={projectDialogContentSx}>
          <Alert severity="success" sx={{ mb: 2 }}>
            Scheme created for <strong>{staffLoginsDivision}</strong>. These accounts are assigned to this division
            and can see the full project workflow (Projects → Construction → Billing).
          </Alert>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Role</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Password</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {staffLogins.map((row) => (
                <TableRow key={row.email}>
                  <TableCell>{row.roleLabel}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{row.email}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{row.password}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Typography variant="caption" color="text.secondary" display="block" mt={1.5}>
            Existing accounts were linked to this division. New accounts were created automatically.
          </Typography>
        </DialogContent>
        <DialogActions sx={projectDialogActionsSx}>
          <Button variant="contained" onClick={() => setStaffLoginsOpen(false)}>Done</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteDialogProject} onClose={() => setDeleteDialogProject(null)} maxWidth="sm" fullWidth>
        <DialogContent>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            Request scheme deletion
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {deleteDialogProject
              ? `"${deleteDialogProject.name}" (${deleteDialogProject.projectCode}) will be permanently removed only after the Division EE approves this request.`
              : ''}
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={3}
            label="Reason for deletion (optional)"
            value={deleteReason}
            onChange={(e) => setDeleteReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogProject(null)} disabled={deletionBusy}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleRequestProjectDeletion} disabled={deletionBusy}>
            Submit request
          </Button>
        </DialogActions>
      </Dialog>
    </PageShell>
  );
}
