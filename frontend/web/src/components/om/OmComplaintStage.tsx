import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  FormControl, Grid, InputLabel, MenuItem, Select, Step, StepLabel, Stepper,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography,
} from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined';
import axios from 'axios';
import { omApi, projectsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import SurfaceCard from '../layout/SurfaceCard';
import {
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
import { useCanViewAllDivisions } from '../../utils/divisionAccess';

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
  createdAt?: string;
};

type ProjectOption = { id: string; name: string; projectCode: string };
type UserOption = { id: string; email: string; firstName?: string; lastName?: string };
type ConsumerOption = { id: string; consumerCode: string; fhtcNumber: string; consumerName?: string | null };

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
  return [
    {
      id: current.id,
      email: current.email,
      firstName: current.firstName,
      lastName: current.lastName,
    },
    ...assignees,
  ];
}

function resolveAssignee(assignedTo: string, currentUserId?: string | null): string {
  if (isUuid(assignedTo)) return assignedTo;
  if (currentUserId && isUuid(currentUserId)) return currentUserId;
  return '';
}

export default function OmComplaintStage() {
  const canViewAll = useCanViewAllDivisions();
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [channelFilter, setChannelFilter] = useState('');
  const [rows, setRows] = useState<ComplaintRow[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [consumers, setConsumers] = useState<ConsumerOption[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectOption | null>(null);
  const [summary, setSummary] = useState<Record<string, number | null>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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

  const load = useCallback(() => {
    setBusy(true);
    setError('');
    Promise.all([
      omApi.listComplaints({
        projectCode: selectedProject?.projectCode,
        channel: channelFilter || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
      }),
      omApi.complaintSummary(selectedProject?.id),
    ])
      .then(([listRes, sumRes]) => {
        setRows(listRes.data ?? []);
        setSummary(sumRes.data ?? {});
      })
      .catch((err) => setError(getApiError(err, 'Failed to load complaints')))
      .finally(() => setBusy(false));
  }, [selectedProject, statusFilter, channelFilter]);

  useEffect(() => {
    projectsApi.list()
      .then((pRes) => {
        const plist = (pRes.data ?? []) as ProjectOption[];
        setProjects(plist);
        if (plist.length && !selectedProject) setSelectedProject(plist[0]);
      })
      .catch(() => setError('Failed to load reference data'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      .catch((err) => setError(getApiError(err, 'Failed to register complaint')))
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
      // Omit assignedTo when self-assigning — backend defaults to the logged-in user.
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
      setError('Please select an assignee before advancing.');
      return;
    }
    if (status === 'assigned' && !advanceForm.resolutionNotes.trim()) {
      setError('Resolution notes are required before advancing.');
      return;
    }
    if (status === 'resolution' && !advanceForm.consumerFeedback.trim()) {
      setError('Consumer feedback is required before advancing.');
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
      .catch((err) => setError(getApiError(err, 'Failed to advance workflow')))
      .finally(() => setBusy(false));
  };

  const currentStatus = workflowOpen ? normalizeStatus(workflowOpen.status) : null;
  const workflowStep = workflowOpen?.workflowStep ?? 0;

  return (
    <>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Grid container spacing={2} mb={2}>
        <Grid item xs={6} sm={3}>
          <SurfaceCard title="Open Complaints">
            <Typography variant="h5" fontWeight={700} color="warning.main">{summary.openComplaints ?? 0}</Typography>
          </SurfaceCard>
        </Grid>
        <Grid item xs={6} sm={3}>
          <SurfaceCard title="Closed">
            <Typography variant="h5" fontWeight={700} color="success.main">{summary.closedComplaints ?? 0}</Typography>
          </SurfaceCard>
        </Grid>
        <Grid item xs={6} sm={3}>
          <SurfaceCard title="Total">
            <Typography variant="h5" fontWeight={700}>{summary.total ?? 0}</Typography>
          </SurfaceCard>
        </Grid>
        <Grid item xs={6} sm={3}>
          <SurfaceCard title="Avg Response (mins)">
            <Typography variant="h5" fontWeight={700}>{summary.avgResponseTimeMins ?? '—'}</Typography>
          </SurfaceCard>
        </Grid>
      </Grid>

      <SurfaceCard
        header={(
          <Box display="flex" justifyContent="space-between" alignItems="center" width="100%" flexWrap="wrap" gap={1}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem' }}>Consumer Complaints</Typography>
            <Box display="flex" gap={1} flexWrap="wrap" alignItems="center">
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Scheme / Project</InputLabel>
                <Select
                  label="Scheme / Project"
                  value={selectedProject?.id ?? ''}
                  onChange={(e) => {
                    const p = projects.find((x) => x.id === e.target.value) ?? null;
                    setSelectedProject(p);
                  }}
                >
                  {canViewAll && <MenuItem value="">All schemes</MenuItem>}
                  {projects.map((p) => (
                    <MenuItem key={p.id} value={p.id}>{p.projectCode} — {p.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Channel</InputLabel>
                <Select
                  label="Channel"
                  value={channelFilter}
                  onChange={(e) => setChannelFilter(e.target.value)}
                >
                  <MenuItem value="">All channels</MenuItem>
                  {OM_COMPLAINT_CHANNELS.map((c) => (
                    <MenuItem key={c.code} value={c.code}>{c.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  label="Status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'all' | 'open' | 'closed')}
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="open">Open</MenuItem>
                  <MenuItem value="closed">Closed</MenuItem>
                </Select>
              </FormControl>
              <Button
                variant="contained"
                size="small"
                startIcon={<AddOutlinedIcon />}
                onClick={() => setCreateOpen(true)}
              >
                Register Complaint
              </Button>
            </Box>
          </Box>
        )}
      >
        <TableContainer>
          <Table size="small" sx={dataTableSx}>
            <TableHead>
              <TableRow>
                <TableCell>Ticket No.</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Channel</TableCell>
                <TableCell>FHTC / Mobile</TableCell>
                <TableCell>Village</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Assignee</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <Typography variant="body2" color="text.secondary" py={2}>
                      {busy ? 'Loading…' : 'No complaints registered yet.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {rows.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell>{row.complaintNo}</TableCell>
                  <TableCell>{row.complaintTypeLabel ?? row.complaintType}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={row.channelLabel ?? row.channel}
                      color={channelChipColor(row.channel)}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    {[row.fhtcNumber, row.mobile].filter(Boolean).join(' · ') || '—'}
                  </TableCell>
                  <TableCell>{row.village ?? '—'}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={OM_COMPLAINT_STATUS_LABELS[normalizeStatus(row.status)]}
                      color={statusChipColor(row.status)}
                    />
                  </TableCell>
                  <TableCell>{row.priority}</TableCell>
                  <TableCell>{row.assignedToName ?? '—'}</TableCell>
                  <TableCell align="right">
                    {normalizeStatus(row.status) !== 'closed' && (
                      <Button
                        size="small"
                        startIcon={<PlayArrowOutlinedIcon />}
                        onClick={() => openWorkflow(row)}
                      >
                        Workflow
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </SurfaceCard>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: omDialogPaperSx }}>
        <OmDialogHeader stage={10} title="Register Consumer Complaint" busy={busy} />
        <DialogContent sx={omDialogContentSx}>
          <Grid container spacing={2} mt={0.5}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Complaint Type</InputLabel>
                <Select
                  label="Complaint Type"
                  value={createForm.complaintType}
                  onChange={(e) => setCreateForm({ ...createForm, complaintType: e.target.value })}
                >
                  {OM_COMPLAINT_TYPES.map((t) => (
                    <MenuItem key={t.code} value={t.code}>{t.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Channel</InputLabel>
                <Select
                  label="Channel"
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
                <InputLabel>Linked Consumer (optional)</InputLabel>
                <Select
                  label="Linked Consumer (optional)"
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
                  <MenuItem value="">None — enter details manually</MenuItem>
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
              <TextField
                fullWidth size="small" label="FHTC Number"
                value={createForm.fhtcNumber}
                onChange={(e) => setCreateForm({ ...createForm, fhtcNumber: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth size="small" label="Mobile"
                value={createForm.mobile}
                onChange={(e) => setCreateForm({ ...createForm, mobile: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth size="small" label="Village"
                value={createForm.village}
                onChange={(e) => setCreateForm({ ...createForm, village: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Priority</InputLabel>
                <Select
                  label="Priority"
                  value={createForm.priority}
                  onChange={(e) => setCreateForm({ ...createForm, priority: e.target.value })}
                >
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="critical">Critical</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth size="small" label="Latitude" type="number"
                value={createForm.latitude}
                onChange={(e) => setCreateForm({ ...createForm, latitude: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth size="small" label="Longitude" type="number"
                value={createForm.longitude}
                onChange={(e) => setCreateForm({ ...createForm, longitude: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth size="small" label="Description" multiline rows={3}
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={omDialogActionsSx}>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={busy}>Register &amp; Generate Ticket</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!workflowOpen} onClose={() => setWorkflowOpen(null)} maxWidth="md" fullWidth PaperProps={{ sx: omDialogPaperSx }}>
        <OmDialogHeader stage={10} title="Complaint Workflow" subtitle={workflowOpen?.complaintNo} busy={busy} />
        <DialogContent sx={omDialogContentSx}>
          {workflowOpen && (
            <>
              <Stepper activeStep={workflowStep} alternativeLabel sx={{ mb: 3, mt: 1 }}>
                {OM_COMPLAINT_WORKFLOW.map((step) => (
                  <Step key={step.status}>
                    <StepLabel>{step.label}</StepLabel>
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
                  <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                    GIS: {formatCoordinatePair(workflowOpen.latitude, workflowOpen.longitude)}
                  </Typography>
                )}
              </Box>

              {currentStatus === 'ticket_generated' && (
                <FormControl fullWidth size="small" disabled={assigneesLoading}>
                  <InputLabel>Assign To</InputLabel>
                  <Select
                    label="Assign To"
                    value={advanceForm.assignedTo}
                    displayEmpty
                    onChange={(e) => setAdvanceForm({ ...advanceForm, assignedTo: e.target.value })}
                  >
                    <MenuItem value="" disabled>
                      {assigneesLoading
                        ? 'Loading assignees…'
                        : users.length
                          ? 'Select assignee…'
                          : 'Assign to yourself (no other staff listed)'}
                    </MenuItem>
                    {users.map((u) => (
                      <MenuItem key={u.id} value={u.id}>{userLabel(u)}</MenuItem>
                    ))}
                  </Select>
                  {assigneesLoading && (
                    <Box display="flex" alignItems="center" gap={1} mt={1}>
                      <CircularProgress size={16} />
                      <Typography variant="caption" color="text.secondary">Loading staff list…</Typography>
                    </Box>
                  )}
                </FormControl>
              )}

              {currentStatus === 'assigned' && (
                <TextField
                  fullWidth size="small" label="Resolution Notes" multiline rows={4}
                  value={advanceForm.resolutionNotes}
                  onChange={(e) => setAdvanceForm({ ...advanceForm, resolutionNotes: e.target.value })}
                  helperText="Describe the resolution action taken in the field"
                />
              )}

              {currentStatus === 'resolution' && (
                <TextField
                  fullWidth size="small" label="Consumer Feedback" multiline rows={3}
                  value={advanceForm.consumerFeedback}
                  onChange={(e) => setAdvanceForm({ ...advanceForm, consumerFeedback: e.target.value })}
                  helperText="Record consumer satisfaction or feedback after resolution"
                />
              )}

              {currentStatus === 'feedback' && (
                <Alert severity="info">Confirm closure — consumer feedback has been recorded.</Alert>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions sx={omDialogActionsSx}>
          <Button onClick={() => setWorkflowOpen(null)}>Close</Button>
          {currentStatus && currentStatus !== 'closed' && (
            <Button
              variant="contained"
              onClick={handleAdvance}
              disabled={busy || (currentStatus === 'ticket_generated' && assigneesLoading)}
              startIcon={<PlayArrowOutlinedIcon />}
            >
              Advance to {workflowOpen?.nextStatus ? OM_COMPLAINT_STATUS_LABELS[normalizeStatus(workflowOpen.nextStatus)] : 'Next'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}
