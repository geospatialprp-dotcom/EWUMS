import { useCallback, useEffect, useMemo, useState, Fragment } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Collapse, Dialog, DialogActions, DialogContent,
  FormControl, Grid, IconButton, InputLabel, Link, MenuItem, Select, Stack, Step, StepLabel,
  Stepper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
  useMediaQuery, useTheme,
} from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import PendingActionsOutlinedIcon from '@mui/icons-material/PendingActionsOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import axios from 'axios';
import { omApi, projectsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useDivisionScope } from '../../context/DivisionContext';
import { useTranslation } from '../../context/LanguageContext';
import KpiStatCard from '../layout/KpiStatCard';
import SurfaceCard from '../layout/SurfaceCard';
import {
  COMPLAINT_SLA_RESOLUTION_MINS,
  OM_COMPLAINT_CHANNELS,
  OM_COMPLAINT_STATUS_LABELS,
  OM_COMPLAINT_TYPES,
  OM_COMPLAINT_WORKFLOW,
  channelChipColor,
  normalizeStatus,
  statusChipColor,
  type OmComplaintStatus,
} from '../../constants/omComplaints';
import { dataTableSx } from '../../utils/pagePresentationStyles';
import { OmDialogHeader, omDialogActionsSx, omDialogContentSx, omDialogPaperSx } from './omUi';
import { formatCoordinatePair } from '../../utils/coordinateFields';
import { useCanViewAllDivisions, divisionScopeSubtitle } from '../../utils/divisionAccess';
import { canPerformOperational } from '../../utils/operationalAccess';

type ComplaintRow = {
  id: string;
  complaintNo: string;
  complaintType: string;
  complaintTypeLabel?: string;
  channel: string;
  channelLabel?: string;
  status: string;
  workflowStep?: number;
  nextStatus?: string | null;
  priority: string;
  fhtcNumber?: string | null;
  mobile?: string | null;
  village?: string | null;
  consumerRef?: string | null;
  consumerName?: string | null;
  description?: string | null;
  resolutionNotes?: string | null;
  consumerFeedback?: string | null;
  assignedToName?: string | null;
  responseTimeMins?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  projectCode?: string;
  projectName?: string | null;
  divisionName?: string | null;
  divisionCode?: string | null;
  createdAt?: string;
};

type ProjectOption = { id: string; name: string; projectCode: string; divisionId?: string | null };
type UserOption = { id: string; email: string; firstName?: string; lastName?: string };
type ConsumerOption = { id: string; consumerCode: string; fhtcNumber: string; consumerName?: string | null };

type StatusFilter = 'all' | 'open' | 'in_progress' | 'closed';

function getApiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg)) return msg.join(', ');
  }
  return fallback;
}

function userLabel(u: UserOption): string {
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ');
  return name ? `${name} (${u.email})` : u.email;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function enrichAssignees(assignees: UserOption[], current?: { id: string; email: string; firstName?: string; lastName?: string } | null): UserOption[] {
  if (!current?.id || !isUuid(current.id)) return assignees;
  if (assignees.some((u) => u.id === current.id)) return assignees;
  return [{ id: current.id, email: current.email, firstName: current.firstName, lastName: current.lastName }, ...assignees];
}

function resolveAssignee(assignedTo: string, currentUserId?: string | null): string {
  if (isUuid(assignedTo)) return assignedTo;
  if (currentUserId && isUuid(currentUserId)) return currentUserId;
  return '';
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function isSlaBreached(row: ComplaintRow): boolean {
  if (normalizeStatus(row.status) === 'closed') return false;
  if (!row.createdAt) return false;
  const ageMins = (Date.now() - new Date(row.createdAt).getTime()) / 60000;
  return ageMins > COMPLAINT_SLA_RESOLUTION_MINS;
}

function consumerLabel(row: ComplaintRow): string {
  if (row.consumerName) return row.consumerName;
  if (row.fhtcNumber) return row.fhtcNumber;
  if (row.mobile) return row.mobile;
  return row.consumerRef ?? '—';
}

function mapPinUrl(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;
}

interface ConsumerComplaintsWorkspaceProps {
  embedded?: boolean;
}

export default function ConsumerComplaintsWorkspace({ embedded = false }: ConsumerComplaintsWorkspaceProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const canViewAll = useCanViewAllDivisions();
  const { user, hasPermission } = useAuth();
  const canRegisterComplaint = canPerformOperational(user?.roles, hasPermission, 'om:create');
  const { activeDivision, scopeKey } = useDivisionScope();
  const { t } = useTranslation();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [channelFilter, setChannelFilter] = useState('');
  const [rows, setRows] = useState<ComplaintRow[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [consumers, setConsumers] = useState<ConsumerOption[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectOption | null>(null);
  const [summary, setSummary] = useState<Record<string, number | null>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [workflowOpen, setWorkflowOpen] = useState<ComplaintRow | null>(null);
  const [assigneesLoading, setAssigneesLoading] = useState(false);

  const [createForm, setCreateForm] = useState({
    complaintType: OM_COMPLAINT_TYPES[0].code,
    channel: 'web_portal' as string,
    description: '',
    omConsumerId: '',
    fhtcNumber: '',
    mobile: '',
    village: '',
    priority: 'medium',
    latitude: '',
    longitude: '',
  });

  const [advanceForm, setAdvanceForm] = useState({
    assignedTo: '',
    resolutionNotes: '',
    consumerFeedback: '',
  });

  const scopedProjects = useMemo(() => {
    if (!activeDivision?.id) return projects;
    return projects.filter((p) => !p.divisionId || p.divisionId === activeDivision.id);
  }, [projects, activeDivision?.id]);

  const load = useCallback(() => {
    setBusy(true);
    setError('');
    const listParams = {
      projectCode: selectedProject?.projectCode,
      channel: channelFilter || undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
    };
    Promise.allSettled([
      omApi.listComplaints(listParams),
      omApi.complaintSummary(selectedProject?.id),
    ])
      .then((results) => {
        const [listResult, summaryResult] = results;
        if (listResult.status === 'fulfilled') {
          setRows(listResult.value.data ?? []);
        } else {
          setError(getApiError(listResult.reason, t('complaints.errors.loadFailed')));
          setRows([]);
        }
        if (summaryResult.status === 'fulfilled') {
          setSummary(summaryResult.value.data ?? {});
        } else if (listResult.status === 'fulfilled') {
          setSummary({});
        }
      })
      .finally(() => setBusy(false));
  }, [selectedProject, statusFilter, channelFilter, scopeKey, t]);

  useEffect(() => {
    projectsApi.list()
      .then((pRes) => {
        const plist = (pRes.data ?? []) as ProjectOption[];
        setProjects(plist);
        if (plist.length && !selectedProject) {
          const first = activeDivision?.id
            ? plist.find((p) => p.divisionId === activeDivision.id) ?? plist[0]
            : plist[0];
          setSelectedProject(first);
        }
      })
      .catch(() => setError(t('complaints.errors.projectsFailed')));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey]);

  const loadAssignees = useCallback((projectCode?: string) => {
    return omApi.listComplaintAssignees(projectCode)
      .then((res) => enrichAssignees((res.data ?? []) as UserOption[], user))
      .catch(() => enrichAssignees([], user));
  }, [user]);

  useEffect(() => {
    if (selectedProject?.projectCode) {
      loadAssignees(selectedProject.projectCode).then(setUsers);
    }
  }, [selectedProject, loadAssignees]);

  useEffect(() => {
    if (selectedProject) {
      omApi.listConsumers({ projectCode: selectedProject.projectCode })
        .then((res) => setConsumers(res.data ?? []))
        .catch(() => setConsumers([]));
    }
  }, [selectedProject]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = () => {
    setBusy(true);
    omApi.registerComplaint({
      complaintType: createForm.complaintType,
      channel: createForm.channel,
      description: createForm.description.trim() || undefined,
      projectCode: selectedProject?.projectCode,
      omConsumerId: createForm.omConsumerId || undefined,
      fhtcNumber: createForm.fhtcNumber.trim() || undefined,
      mobile: createForm.mobile.trim() || undefined,
      village: createForm.village.trim() || undefined,
      priority: createForm.priority,
      latitude: createForm.latitude ? Number(createForm.latitude) : undefined,
      longitude: createForm.longitude ? Number(createForm.longitude) : undefined,
    })
      .then(() => {
        setCreateOpen(false);
        setCreateForm({
          complaintType: OM_COMPLAINT_TYPES[0].code,
          channel: 'web_portal',
          description: '',
          omConsumerId: '',
          fhtcNumber: '',
          mobile: '',
          village: '',
          priority: 'medium',
          latitude: '',
          longitude: '',
        });
        load();
      })
      .catch((err) => setError(getApiError(err, t('complaints.errors.registerFailed'))))
      .finally(() => setBusy(false));
  };

  const openWorkflow = async (row: ComplaintRow) => {
    setWorkflowOpen(row);
    setError('');
    setAssigneesLoading(true);
    const projectCode = row.projectCode ?? selectedProject?.projectCode;
    let assignees: UserOption[] = [];
    try {
      assignees = await loadAssignees(projectCode);
    } catch {
      assignees = enrichAssignees([], user);
    } finally {
      setAssigneesLoading(false);
    }
    setUsers(assignees);
    const defaultAssignee =
      (user?.id && assignees.some((u) => u.id === user.id) ? user.id : '')
      || assignees[0]?.id
      || resolveAssignee('', user?.id);
    setAdvanceForm({
      assignedTo: defaultAssignee,
      resolutionNotes: row.resolutionNotes ?? '',
      consumerFeedback: row.consumerFeedback ?? '',
    });
  };

  const buildAdvancePayload = (status: OmComplaintStatus): Record<string, unknown> => {
    if (status === 'ticket_generated') {
      const assignee = resolveAssignee(advanceForm.assignedTo, user?.id);
      if (assignee && user?.id && assignee !== user.id) {
        return { assignedTo: assignee };
      }
      return {};
    }
    if (status === 'assigned') {
      return { resolutionNotes: advanceForm.resolutionNotes.trim() };
    }
    if (status === 'resolution') {
      return { consumerFeedback: advanceForm.consumerFeedback.trim() };
    }
    return {};
  };

  const handleAdvance = () => {
    if (!workflowOpen) return;
    const status = normalizeStatus(workflowOpen.status);
    if (status === 'ticket_generated' && !resolveAssignee(advanceForm.assignedTo, user?.id)) {
      setError(t('complaints.errors.assigneeRequired'));
      return;
    }
    if (status === 'assigned' && !advanceForm.resolutionNotes.trim()) {
      setError(t('complaints.errors.resolutionRequired'));
      return;
    }
    if (status === 'resolution' && !advanceForm.consumerFeedback.trim()) {
      setError(t('complaints.errors.feedbackRequired'));
      return;
    }
    setError('');
    setBusy(true);
    omApi.advanceComplaint(workflowOpen.id, buildAdvancePayload(status))
      .then((res) => {
        if (res.data?.status === 'closed') {
          setWorkflowOpen(null);
        } else {
          setWorkflowOpen(res.data);
        }
        load();
      })
      .catch((err) => setError(getApiError(err, t('complaints.errors.advanceFailed'))))
      .finally(() => setBusy(false));
  };

  const currentStatus = workflowOpen ? normalizeStatus(workflowOpen.status) : null;
  const workflowStep = workflowOpen?.workflowStep ?? 0;

  const statusLabel = (status: string) => {
    const key = `complaints.status.${normalizeStatus(status)}` as const;
    const translated = t(key);
    return translated !== key ? translated : OM_COMPLAINT_STATUS_LABELS[normalizeStatus(status)];
  };

  const renderDetailPanel = (row: ComplaintRow) => (
    <Box sx={{ py: 1.5, px: { xs: 0, sm: 1 } }}>
      {row.description && (
        <Typography variant="body2" color="text.secondary" mb={1}>
          <strong>{t('complaints.columns.description')}:</strong> {row.description}
        </Typography>
      )}
      {(row.village || row.projectName) && (
        <Typography variant="body2" color="text.secondary" mb={1}>
          <strong>{t('complaints.columns.location')}:</strong>{' '}
          {[row.village, row.projectName].filter(Boolean).join(' · ')}
        </Typography>
      )}
      {row.resolutionNotes && (
        <Typography variant="body2" color="text.secondary" mb={1}>
          <strong>{t('complaints.columns.resolution')}:</strong> {row.resolutionNotes}
        </Typography>
      )}
      {row.latitude != null && row.longitude != null && (
        <Stack direction="row" alignItems="center" spacing={0.5} mt={1}>
          <LocationOnOutlinedIcon sx={{ fontSize: 16, color: '#f97316' }} />
          <Typography variant="caption" color="text.secondary">
            {formatCoordinatePair(row.latitude, row.longitude)}
          </Typography>
          <Link href={mapPinUrl(row.latitude, row.longitude)} target="_blank" rel="noopener noreferrer" variant="caption">
            {t('complaints.viewOnMap')}
          </Link>
        </Stack>
      )}
      {isSlaBreached(row) && (
        <Chip
          size="small"
          color="error"
          icon={<WarningAmberOutlinedIcon />}
          label={t('complaints.slaBreached')}
          sx={{ mt: 1 }}
        />
      )}
    </Box>
  );

  const renderMobileCard = (row: ComplaintRow) => {
    const expanded = expandedId === row.id;
    return (
      <Box
        key={row.id}
        sx={{
          p: 2,
          mb: 1.5,
          borderRadius: 2.5,
          border: '1px solid #e2e8f0',
          bgcolor: '#fff',
          boxShadow: expanded ? '0 8px 24px rgba(15,23,42,0.08)' : '0 1px 3px rgba(15,23,42,0.06)',
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box flex={1} minWidth={0}>
            <Typography variant="subtitle2" fontWeight={800} color="#0f172a">
              {row.complaintNo}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {consumerLabel(row)}
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setExpandedId(expanded ? null : row.id)} aria-label="Toggle details">
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Stack>
        <Stack direction="row" flexWrap="wrap" gap={0.75} mt={1}>
          <Chip size="small" label={row.complaintTypeLabel ?? row.complaintType} variant="outlined" />
          <Chip size="small" label={statusLabel(row.status)} color={statusChipColor(row.status)} />
          {isSlaBreached(row) && (
            <Chip size="small" color="error" label={t('complaints.kpi.slaBreached')} />
          )}
        </Stack>
        <Grid container spacing={1} mt={1}>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">{t('complaints.columns.division')}</Typography>
            <Typography variant="body2" fontWeight={600}>{row.divisionName ?? '—'}</Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">{t('complaints.columns.date')}</Typography>
            <Typography variant="body2" fontWeight={600}>{formatDate(row.createdAt)}</Typography>
          </Grid>
          <Grid item xs={12}>
            <Typography variant="caption" color="text.secondary">{t('complaints.columns.assignedTo')}</Typography>
            <Typography variant="body2" fontWeight={600}>{row.assignedToName ?? '—'}</Typography>
          </Grid>
        </Grid>
        <Collapse in={expanded}>{renderDetailPanel(row)}</Collapse>
        {normalizeStatus(row.status) !== 'closed' && (
          <Button
            size="small"
            fullWidth
            sx={{ mt: 1.5 }}
            variant="outlined"
            startIcon={<PlayArrowOutlinedIcon />}
            onClick={() => openWorkflow(row)}
          >
            {t('complaints.workflow')}
          </Button>
        )}
      </Box>
    );
  };

  return (
    <>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {!embedded && (
        <Box
          sx={{
            mb: 2.5,
            p: 2.5,
            borderRadius: 3,
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
            position: 'relative',
            overflow: 'hidden',
            '&::after': {
              content: '""',
              position: 'absolute',
              top: -30,
              right: -20,
              width: 140,
              height: 140,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(249,115,22,0.4) 0%, transparent 70%)',
              pointerEvents: 'none',
            },
          }}
        >
          <Typography variant="body2" sx={{ color: '#94a3b8', position: 'relative', zIndex: 1 }}>
            {divisionScopeSubtitle(canViewAll, activeDivision) ?? t('complaints.divisionScoped')}
          </Typography>
        </Box>
      )}

      <Grid container spacing={2} mb={2}>
        <Grid item xs={6} sm={3}>
          <KpiStatCard
            label={t('complaints.kpi.open')}
            value={summary.openComplaints ?? 0}
            tone="amber"
            icon={<ReportProblemOutlinedIcon sx={{ color: '#d97706', opacity: 0.85 }} />}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <KpiStatCard
            label={t('complaints.kpi.inProgress')}
            value={summary.inProgressComplaints ?? 0}
            tone="blue"
            icon={<PendingActionsOutlinedIcon sx={{ color: '#2563eb', opacity: 0.85 }} />}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <KpiStatCard
            label={t('complaints.kpi.closed')}
            value={summary.closedComplaints ?? 0}
            tone="teal"
            icon={<CheckCircleOutlineOutlinedIcon sx={{ color: '#0d9488', opacity: 0.85 }} />}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <KpiStatCard
            label={t('complaints.kpi.slaBreached')}
            value={summary.slaBreached ?? 0}
            tone="rose"
            icon={<WarningAmberOutlinedIcon sx={{ color: '#e11d48', opacity: 0.85 }} />}
          />
        </Grid>
      </Grid>

      <SurfaceCard
        header={(
          <Box display="flex" justifyContent="space-between" alignItems="center" width="100%" flexWrap="wrap" gap={1}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem' }}>{t('complaints.listTitle')}</Typography>
            <Box display="flex" gap={1} flexWrap="wrap" alignItems="center">
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>{t('complaints.filters.scheme')}</InputLabel>
                <Select
                  label={t('complaints.filters.scheme')}
                  value={selectedProject?.id ?? ''}
                  onChange={(e) => {
                    const p = scopedProjects.find((x) => x.id === e.target.value) ?? null;
                    setSelectedProject(p);
                  }}
                >
                  {canViewAll && <MenuItem value="">{t('complaints.filters.allSchemes')}</MenuItem>}
                  {scopedProjects.map((p) => (
                    <MenuItem key={p.id} value={p.id}>{p.projectCode} — {p.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>{t('complaints.filters.channel')}</InputLabel>
                <Select
                  label={t('complaints.filters.channel')}
                  value={channelFilter}
                  onChange={(e) => setChannelFilter(e.target.value)}
                >
                  <MenuItem value="">{t('complaints.filters.allChannels')}</MenuItem>
                  {OM_COMPLAINT_CHANNELS.map((c) => (
                    <MenuItem key={c.code} value={c.code}>{c.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>{t('complaints.filters.status')}</InputLabel>
                <Select
                  label={t('complaints.filters.status')}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                >
                  <MenuItem value="all">{t('complaints.filters.allStatus')}</MenuItem>
                  <MenuItem value="open">{t('complaints.filters.open')}</MenuItem>
                  <MenuItem value="in_progress">{t('complaints.filters.inProgress')}</MenuItem>
                  <MenuItem value="closed">{t('complaints.filters.closed')}</MenuItem>
                </Select>
              </FormControl>
              {canRegisterComplaint && (
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<AddOutlinedIcon />}
                  onClick={() => { setError(''); setCreateOpen(true); }}
                  sx={{ bgcolor: '#f97316', '&:hover': { bgcolor: '#ea580c' } }}
                >
                  {t('complaints.register')}
                </Button>
              )}
            </Box>
          </Box>
        )}
      >
        {busy && rows.length === 0 && (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress size={28} />
          </Box>
        )}

        {isMobile ? (
          <Box>
            {!busy && rows.length === 0 && (
              <Typography variant="body2" color="text.secondary" py={2} textAlign="center">
                {t('complaints.empty')}
              </Typography>
            )}
            {rows.map(renderMobileCard)}
          </Box>
        ) : (
          <TableContainer>
            <Table size="small" sx={dataTableSx}>
              <TableHead>
                <TableRow>
                  <TableCell width={40} />
                  <TableCell>{t('complaints.columns.id')}</TableCell>
                  <TableCell>{t('complaints.columns.consumer')}</TableCell>
                  <TableCell>{t('complaints.columns.type')}</TableCell>
                  <TableCell>{t('complaints.columns.status')}</TableCell>
                  <TableCell>{t('complaints.columns.division')}</TableCell>
                  <TableCell>{t('complaints.columns.date')}</TableCell>
                  <TableCell>{t('complaints.columns.assignedTo')}</TableCell>
                  <TableCell align="right">{t('complaints.columns.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.length === 0 && !busy && (
                  <TableRow>
                    <TableCell colSpan={9} align="center">
                      <Typography variant="body2" color="text.secondary" py={2}>
                        {t('complaints.empty')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((row) => {
                  const expanded = expandedId === row.id;
                  return (
                    <Fragment key={row.id}>
                      <TableRow hover sx={isSlaBreached(row) ? { bgcolor: 'rgba(225,29,72,0.04)' } : undefined}>
                        <TableCell>
                          <IconButton size="small" onClick={() => setExpandedId(expanded ? null : row.id)}>
                            {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                          </IconButton>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={700}>{row.complaintNo}</Typography>
                          {isSlaBreached(row) && (
                            <Chip size="small" color="error" label={t('complaints.slaBreached')} sx={{ mt: 0.5, height: 20, fontSize: '0.65rem' }} />
                          )}
                        </TableCell>
                        <TableCell>{consumerLabel(row)}</TableCell>
                        <TableCell>{row.complaintTypeLabel ?? row.complaintType}</TableCell>
                        <TableCell>
                          <Chip size="small" label={statusLabel(row.status)} color={statusChipColor(row.status)} />
                        </TableCell>
                        <TableCell>{row.divisionName ?? '—'}</TableCell>
                        <TableCell>{formatDate(row.createdAt)}</TableCell>
                        <TableCell>{row.assignedToName ?? '—'}</TableCell>
                        <TableCell align="right">
                          {normalizeStatus(row.status) !== 'closed' && (
                            <Button size="small" startIcon={<PlayArrowOutlinedIcon />} onClick={() => openWorkflow(row)}>
                              {t('complaints.workflow')}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={9} sx={{ py: 0, borderBottom: expanded ? undefined : 'none' }}>
                          <Collapse in={expanded}>{renderDetailPanel(row)}</Collapse>
                        </TableCell>
                      </TableRow>
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </SurfaceCard>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: omDialogPaperSx }}>
        <OmDialogHeader stage={10} title={t('complaints.registerTitle')} busy={busy} />
        <DialogContent sx={omDialogContentSx}>
          <Grid container spacing={2} mt={0.5}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>{t('complaints.form.type')}</InputLabel>
                <Select
                  label={t('complaints.form.type')}
                  value={createForm.complaintType}
                  onChange={(e) => setCreateForm({ ...createForm, complaintType: e.target.value })}
                >
                  {OM_COMPLAINT_TYPES.map((typ) => (
                    <MenuItem key={typ.code} value={typ.code}>{typ.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>{t('complaints.form.channel')}</InputLabel>
                <Select
                  label={t('complaints.form.channel')}
                  value={createForm.channel}
                  onChange={(e) => setCreateForm({ ...createForm, channel: e.target.value })}
                >
                  {OM_COMPLAINT_CHANNELS.map((c) => (
                    <MenuItem key={c.code} value={c.code}>{c.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>{t('complaints.form.linkedConsumer')}</InputLabel>
                <Select
                  label={t('complaints.form.linkedConsumer')}
                  value={createForm.omConsumerId}
                  onChange={(e) => {
                    const id = e.target.value;
                    const c = consumers.find((x) => x.id === id);
                    setCreateForm({
                      ...createForm,
                      omConsumerId: id,
                      fhtcNumber: c?.fhtcNumber ?? createForm.fhtcNumber,
                    });
                  }}
                >
                  <MenuItem value="">{t('complaints.form.noConsumer')}</MenuItem>
                  {consumers.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.consumerCode} — {c.fhtcNumber}
                      {c.consumerName ? ` (${c.consumerName})` : ''}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label={t('complaints.form.fhtc')} value={createForm.fhtcNumber} onChange={(e) => setCreateForm({ ...createForm, fhtcNumber: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label={t('complaints.form.mobile')} value={createForm.mobile} onChange={(e) => setCreateForm({ ...createForm, mobile: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label={t('complaints.form.village')} value={createForm.village} onChange={(e) => setCreateForm({ ...createForm, village: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>{t('complaints.form.priority')}</InputLabel>
                <Select label={t('complaints.form.priority')} value={createForm.priority} onChange={(e) => setCreateForm({ ...createForm, priority: e.target.value })}>
                  <MenuItem value="low">{t('complaints.priority.low')}</MenuItem>
                  <MenuItem value="medium">{t('complaints.priority.medium')}</MenuItem>
                  <MenuItem value="high">{t('complaints.priority.high')}</MenuItem>
                  <MenuItem value="critical">{t('complaints.priority.critical')}</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label={t('complaints.form.latitude')} type="number" value={createForm.latitude} onChange={(e) => setCreateForm({ ...createForm, latitude: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label={t('complaints.form.longitude')} type="number" value={createForm.longitude} onChange={(e) => setCreateForm({ ...createForm, longitude: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label={t('complaints.form.description')} multiline rows={3} value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={omDialogActionsSx}>
          <Button onClick={() => setCreateOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleCreate} disabled={busy} sx={{ bgcolor: '#f97316', '&:hover': { bgcolor: '#ea580c' } }}>
            {t('complaints.registerSubmit')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!workflowOpen} onClose={() => setWorkflowOpen(null)} maxWidth="md" fullWidth PaperProps={{ sx: omDialogPaperSx }}>
        <OmDialogHeader stage={10} title={t('complaints.workflowTitle')} subtitle={workflowOpen?.complaintNo} busy={busy} />
        <DialogContent sx={omDialogContentSx}>
          {workflowOpen && (
            <>
              <Stepper activeStep={workflowStep} alternativeLabel sx={{ mb: 3, mt: 1 }}>
                {OM_COMPLAINT_WORKFLOW.map((step) => (
                  <Step key={step.status}>
                    <StepLabel>{statusLabel(step.status)}</StepLabel>
                  </Step>
                ))}
              </Stepper>

              <Box mb={2}>
                <Typography variant="body2" color="text.secondary">
                  {workflowOpen.complaintTypeLabel} · {workflowOpen.channelLabel}
                  {workflowOpen.village ? ` · ${workflowOpen.village}` : ''}
                </Typography>
                {workflowOpen.description && (
                  <Typography variant="body2" mt={1}>{workflowOpen.description}</Typography>
                )}
                {workflowOpen.latitude != null && workflowOpen.longitude != null && (
                  <Stack direction="row" alignItems="center" spacing={0.5} mt={0.5}>
                    <LocationOnOutlinedIcon sx={{ fontSize: 16, color: '#f97316' }} />
                    <Typography variant="caption" color="text.secondary">
                      {formatCoordinatePair(workflowOpen.latitude, workflowOpen.longitude)}
                    </Typography>
                    <Link href={mapPinUrl(workflowOpen.latitude, workflowOpen.longitude)} target="_blank" rel="noopener noreferrer" variant="caption">
                      {t('complaints.viewOnMap')}
                    </Link>
                  </Stack>
                )}
              </Box>

              {currentStatus === 'ticket_generated' && (
                <FormControl fullWidth size="small" disabled={assigneesLoading}>
                  <InputLabel>{t('complaints.form.assignTo')}</InputLabel>
                  <Select
                    label={t('complaints.form.assignTo')}
                    value={advanceForm.assignedTo}
                    displayEmpty
                    onChange={(e) => setAdvanceForm({ ...advanceForm, assignedTo: e.target.value })}
                  >
                    <MenuItem value="" disabled>
                      {assigneesLoading ? t('complaints.loadingAssignees') : users.length ? t('complaints.selectAssignee') : t('complaints.selfAssign')}
                    </MenuItem>
                    {users.map((u) => (
                      <MenuItem key={u.id} value={u.id}>{userLabel(u)}</MenuItem>
                    ))}
                  </Select>
                  {assigneesLoading && (
                    <Box display="flex" alignItems="center" gap={1} mt={1}>
                      <CircularProgress size={16} />
                      <Typography variant="caption" color="text.secondary">{t('complaints.loadingStaff')}</Typography>
                    </Box>
                  )}
                </FormControl>
              )}

              {currentStatus === 'assigned' && (
                <TextField
                  fullWidth size="small" label={t('complaints.form.resolutionNotes')} multiline rows={4}
                  value={advanceForm.resolutionNotes}
                  onChange={(e) => setAdvanceForm({ ...advanceForm, resolutionNotes: e.target.value })}
                  helperText={t('complaints.form.resolutionHint')}
                />
              )}

              {currentStatus === 'resolution' && (
                <TextField
                  fullWidth size="small" label={t('complaints.form.consumerFeedback')} multiline rows={3}
                  value={advanceForm.consumerFeedback}
                  onChange={(e) => setAdvanceForm({ ...advanceForm, consumerFeedback: e.target.value })}
                  helperText={t('complaints.form.feedbackHint')}
                />
              )}

              {currentStatus === 'feedback' && (
                <Alert severity="info">{t('complaints.confirmClosure')}</Alert>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions sx={omDialogActionsSx}>
          <Button onClick={() => setWorkflowOpen(null)}>{t('common.close')}</Button>
          {currentStatus && currentStatus !== 'closed' && (
            <Button
              variant="contained"
              onClick={handleAdvance}
              disabled={busy || (currentStatus === 'ticket_generated' && assigneesLoading)}
              startIcon={<PlayArrowOutlinedIcon />}
              sx={{ bgcolor: '#f97316', '&:hover': { bgcolor: '#ea580c' } }}
            >
              {t('complaints.advanceTo', {
                status: workflowOpen?.nextStatus ? statusLabel(workflowOpen.nextStatus) : t('complaints.nextStep'),
              })}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}
