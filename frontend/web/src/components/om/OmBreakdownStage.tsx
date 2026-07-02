import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent,
  FormControl, Grid, IconButton, InputLabel, MenuItem, Select, Step, StepLabel, Stepper,
  Tab, Tabs, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography,
} from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined';
import axios from 'axios';
import { omApi, projectsApi, usersApi } from '../../services/api';
import SurfaceCard from '../layout/SurfaceCard';
import {
  OM_BREAKDOWN_CATALOG,
  OM_BREAKDOWN_STATUS_LABELS,
  OM_BREAKDOWN_WORKFLOW,
  statusChipColor,
  normalizeStatus,
  type OmBreakdownGroup,
  type OmBreakdownStatus,
} from '../../constants/omBreakdown';
import { dataTableSx } from '../../utils/pagePresentationStyles';
import { OmDialogHeader, omDialogActionsSx, omDialogContentSx, omDialogPaperSx } from './omUi';
import { useCanViewAllDivisions } from '../../utils/divisionAccess';
import { formatCoordinatePair } from '../../utils/coordinateFields';

type TicketRow = {
  id: string;
  ticketNo: string;
  title: string;
  category: string;
  categoryGroup?: string;
  complaintLabel?: string;
  status: string;
  workflowStep?: number;
  nextStatus?: string | null;
  priority: string;
  latitude?: number | null;
  longitude?: number | null;
  responseTimeMins?: number | null;
  repairDetails?: string | null;
  materialsUsed?: Array<{ item: string; quantity: string; unit?: string }>;
  labourUsed?: Array<{ role: string; hours: number; name?: string }>;
  beforePhotos?: Array<Record<string, unknown>>;
  afterPhotos?: Array<Record<string, unknown>>;
  assignedToName?: string | null;
  projectCode?: string;
  assetCode?: string | null;
  description?: string | null;
  createdAt?: string;
};

type ProjectOption = { id: string; name: string; projectCode: string };
type UserOption = { id: string; email: string; firstName?: string; lastName?: string };

const GROUP_TABS: OmBreakdownGroup[] = ['mechanical', 'electrical', 'pipeline', 'consumer_service'];

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

export default function OmBreakdownStage() {
  const canViewAll = useCanViewAllDivisions();
  const [tab, setTab] = useState(0);
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [rows, setRows] = useState<TicketRow[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectOption | null>(null);
  const [summary, setSummary] = useState<Record<string, number | null>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [workflowOpen, setWorkflowOpen] = useState<TicketRow | null>(null);

  const activeGroup = GROUP_TABS[tab];

  const [createForm, setCreateForm] = useState({
    title: '',
    category: OM_BREAKDOWN_CATALOG[0].complaints[0].code,
    description: '',
    priority: 'medium',
    latitude: '',
    longitude: '',
  });

  const [advanceForm, setAdvanceForm] = useState({
    assignedTo: '',
    inspectionNotes: '',
    latitude: '',
    longitude: '',
    beforePhotoCaption: '',
    repairDetails: '',
    materials: [{ item: '', quantity: '', unit: '' }],
    labour: [{ role: '', hours: '', name: '' }],
    verificationNotes: '',
    afterPhotoCaption: '',
  });

  const load = useCallback(() => {
    setBusy(true);
    setError('');
    Promise.all([
      omApi.listBreakdowns({
        projectCode: selectedProject?.projectCode,
        categoryGroup: activeGroup,
        status: statusFilter === 'all' ? undefined : statusFilter,
      }),
      omApi.breakdownSummary(selectedProject?.id),
    ])
      .then(([listRes, sumRes]) => {
        setRows(listRes.data ?? []);
        setSummary(sumRes.data ?? {});
      })
      .catch((err) => setError(getApiError(err, 'Failed to load breakdown tickets')))
      .finally(() => setBusy(false));
  }, [selectedProject, activeGroup, statusFilter]);

  useEffect(() => {
    Promise.all([projectsApi.list(), usersApi.list()])
      .then(([pRes, uRes]) => {
        const plist = (pRes.data ?? []) as ProjectOption[];
        setProjects(plist);
        if (plist.length && !selectedProject) setSelectedProject(plist[0]);
        setUsers(uRes.data?.users ?? []);
      })
      .catch(() => setError('Failed to load reference data'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  const resetCreateForm = () => {
    const groupDef = OM_BREAKDOWN_CATALOG.find((g) => g.group === activeGroup)!;
    setCreateForm({
      title: '',
      category: groupDef.complaints[0].code,
      description: '',
      priority: 'medium',
      latitude: '',
      longitude: '',
    });
  };

  const handleCreate = () => {
    if (!createForm.title.trim()) {
      setError('Title is required');
      return;
    }
    setBusy(true);
    omApi.createBreakdown({
      title: createForm.title.trim(),
      category: createForm.category,
      description: createForm.description.trim() || undefined,
      projectCode: selectedProject?.projectCode,
      priority: createForm.priority,
      latitude: createForm.latitude ? Number(createForm.latitude) : undefined,
      longitude: createForm.longitude ? Number(createForm.longitude) : undefined,
    })
      .then(() => {
        setCreateOpen(false);
        resetCreateForm();
        load();
      })
      .catch((err) => setError(getApiError(err, 'Failed to raise ticket')))
      .finally(() => setBusy(false));
  };

  const openWorkflow = (row: TicketRow) => {
    setWorkflowOpen(row);
    setAdvanceForm({
      assignedTo: '',
      inspectionNotes: '',
      latitude: row.latitude != null ? String(row.latitude) : '',
      longitude: row.longitude != null ? String(row.longitude) : '',
      beforePhotoCaption: '',
      repairDetails: row.repairDetails ?? '',
      materials: [{ item: '', quantity: '', unit: '' }],
      labour: [{ role: '', hours: '', name: '' }],
      verificationNotes: '',
      afterPhotoCaption: '',
    });
  };

  const buildAdvancePayload = (status: OmBreakdownStatus): Record<string, unknown> => {
    if (status === 'ticket_generated') {
      return advanceForm.assignedTo ? { assignedTo: advanceForm.assignedTo } : {};
    }
    if (status === 'assigned') {
      const payload: Record<string, unknown> = {};
      if (advanceForm.inspectionNotes.trim()) payload.inspectionNotes = advanceForm.inspectionNotes.trim();
      if (advanceForm.latitude && advanceForm.longitude) {
        payload.latitude = Number(advanceForm.latitude);
        payload.longitude = Number(advanceForm.longitude);
      }
      if (advanceForm.beforePhotoCaption.trim()) {
        payload.beforePhotos = [{
          caption: advanceForm.beforePhotoCaption.trim(),
          latitude: advanceForm.latitude ? Number(advanceForm.latitude) : undefined,
          longitude: advanceForm.longitude ? Number(advanceForm.longitude) : undefined,
        }];
      }
      return payload;
    }
    if (status === 'site_inspection') {
      return {
        repairDetails: advanceForm.repairDetails.trim(),
        materialsUsed: advanceForm.materials.filter((m) => m.item.trim()).map((m) => ({
          item: m.item.trim(),
          quantity: m.quantity.trim(),
          unit: m.unit?.trim() || undefined,
        })),
        labourUsed: advanceForm.labour.filter((l) => l.role.trim()).map((l) => ({
          role: l.role.trim(),
          hours: Number(l.hours) || 0,
          name: l.name?.trim() || undefined,
        })),
      };
    }
    if (status === 'repair_work') {
      const payload: Record<string, unknown> = {};
      if (advanceForm.verificationNotes.trim()) payload.verificationNotes = advanceForm.verificationNotes.trim();
      if (advanceForm.afterPhotoCaption.trim()) {
        payload.afterPhotos = [{ caption: advanceForm.afterPhotoCaption.trim() }];
      }
      return payload;
    }
    return {};
  };

  const handleAdvance = () => {
    if (!workflowOpen) return;
    const status = normalizeStatus(workflowOpen.status);
    if (status === 'ticket_generated' && !advanceForm.assignedTo) {
      setError('Please select an assignee before advancing.');
      return;
    }
    if (status === 'site_inspection' && !advanceForm.repairDetails.trim()) {
      setError('Repair details are required before advancing.');
      return;
    }
    setError('');
    setBusy(true);
    omApi.advanceBreakdown(workflowOpen.id, buildAdvancePayload(status))
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
          <SurfaceCard title="Open Tickets">
            <Typography variant="h5" fontWeight={700} color="warning.main">{summary.openBreakdowns ?? 0}</Typography>
          </SurfaceCard>
        </Grid>
        <Grid item xs={6} sm={3}>
          <SurfaceCard title="Closed">
            <Typography variant="h5" fontWeight={700} color="success.main">{summary.closedBreakdowns ?? 0}</Typography>
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
            <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem' }}>Breakdown Tickets</Typography>
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
              <Button
                variant="contained"
                size="small"
                startIcon={<AddOutlinedIcon />}
                onClick={() => { resetCreateForm(); setCreateOpen(true); }}
              >
                Raise Complaint
              </Button>
            </Box>
          </Box>
        )}
      >
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          {OM_BREAKDOWN_CATALOG.map((g) => (
            <Tab key={g.group} label={g.label} />
          ))}
        </Tabs>

        <Box display="flex" gap={0.75} mb={2} flexWrap="wrap">
          {(['all', 'open', 'closed'] as const).map((f) => (
            <Chip
              key={f}
              size="small"
              label={f === 'all' ? 'All' : f === 'open' ? 'Open' : 'Closed'}
              color={statusFilter === f ? 'primary' : 'default'}
              variant={statusFilter === f ? 'filled' : 'outlined'}
              onClick={() => setStatusFilter(f)}
            />
          ))}
        </Box>

        {rows.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No breakdown tickets in this category. Raise a complaint to generate a ticket.
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small" sx={dataTableSx()}>
              <TableHead>
                <TableRow>
                  <TableCell>Ticket</TableCell>
                  <TableCell>Title</TableCell>
                  <TableCell>Complaint</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Priority</TableCell>
                  <TableCell>Response</TableCell>
                  <TableCell>GIS</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>{row.ticketNo}</TableCell>
                    <TableCell>{row.title}</TableCell>
                    <TableCell>{row.complaintLabel ?? row.category}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={OM_BREAKDOWN_STATUS_LABELS[normalizeStatus(row.status)]}
                        color={statusChipColor(normalizeStatus(row.status))}
                      />
                    </TableCell>
                    <TableCell>{row.priority}</TableCell>
                    <TableCell>{row.responseTimeMins != null ? `${row.responseTimeMins} min` : '—'}</TableCell>
                    <TableCell>{formatCoordinatePair(row.latitude, row.longitude)}</TableCell>
                    <TableCell align="right">
                      {normalizeStatus(row.status) !== 'closed' && (
                        <Button size="small" startIcon={<PlayArrowOutlinedIcon />} onClick={() => openWorkflow(row)}>
                          Workflow
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </SurfaceCard>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: omDialogPaperSx }}>
        <OmDialogHeader stage={5} title="Raise Breakdown Complaint" busy={busy} />
        <DialogContent sx={omDialogContentSx}>
          <TextField
            fullWidth label="Title / Summary" margin="dense" required
            value={createForm.title} onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
          />
          <FormControl fullWidth margin="dense">
            <InputLabel>Complaint Type</InputLabel>
            <Select
              label="Complaint Type"
              value={createForm.category}
              onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
            >
              {OM_BREAKDOWN_CATALOG.find((g) => g.group === activeGroup)?.complaints.map((c) => (
                <MenuItem key={c.code} value={c.code}>{c.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth margin="dense">
            <InputLabel>Priority</InputLabel>
            <Select
              label="Priority"
              value={createForm.priority}
              onChange={(e) => setCreateForm({ ...createForm, priority: e.target.value })}
            >
              {['low', 'medium', 'high', 'critical'].map((p) => (
                <MenuItem key={p} value={p}>{p}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth label="Description" margin="dense" multiline minRows={2}
            value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
          />
          <Grid container spacing={1} mt={0.5}>
            <Grid item xs={6}>
              <TextField
                fullWidth label="Latitude" size="small"
                value={createForm.latitude} onChange={(e) => setCreateForm({ ...createForm, latitude: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth label="Longitude" size="small"
                value={createForm.longitude} onChange={(e) => setCreateForm({ ...createForm, longitude: e.target.value })}
              />
            </Grid>
          </Grid>
          <Typography variant="caption" color="text.secondary" display="block" mt={1}>
            A ticket number is generated automatically when the complaint is submitted.
          </Typography>
        </DialogContent>
        <DialogActions sx={omDialogActionsSx}>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={busy}>Submit Complaint</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(workflowOpen)} onClose={() => setWorkflowOpen(null)} maxWidth="md" fullWidth PaperProps={{ sx: omDialogPaperSx }}>
        <OmDialogHeader
          stage={5}
          title={workflowOpen?.title ?? 'Breakdown workflow'}
          subtitle={workflowOpen?.ticketNo}
          badge={workflowOpen?.status ? OM_BREAKDOWN_STATUS_LABELS[normalizeStatus(workflowOpen.status)] ?? workflowOpen.status : undefined}
          busy={busy}
        />
        <DialogContent sx={omDialogContentSx}>
          <Stepper activeStep={workflowStep} alternativeLabel sx={{ mb: 3, mt: 1 }}>
            {OM_BREAKDOWN_WORKFLOW.map((s) => (
              <Step key={s.status} completed={workflowStep > OM_BREAKDOWN_WORKFLOW.findIndex((w) => w.status === s.status)}>
                <StepLabel>{s.label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {currentStatus === 'ticket_generated' && (
            <FormControl fullWidth margin="dense" required>
              <InputLabel>Assign To</InputLabel>
              <Select
                label="Assign To"
                value={advanceForm.assignedTo}
                onChange={(e) => setAdvanceForm({ ...advanceForm, assignedTo: e.target.value })}
              >
                {users.length === 0 ? (
                  <MenuItem disabled value="">No users available</MenuItem>
                ) : (
                  users.map((u) => (
                    <MenuItem key={u.id} value={u.id}>{userLabel(u)}</MenuItem>
                  ))
                )}
              </Select>
            </FormControl>
          )}

          {currentStatus === 'assigned' && (
            <>
              <TextField
                fullWidth label="Site Inspection Notes" margin="dense" multiline minRows={2}
                value={advanceForm.inspectionNotes}
                onChange={(e) => setAdvanceForm({ ...advanceForm, inspectionNotes: e.target.value })}
              />
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <TextField fullWidth label="Latitude" size="small" margin="dense"
                    value={advanceForm.latitude} onChange={(e) => setAdvanceForm({ ...advanceForm, latitude: e.target.value })} />
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth label="Longitude" size="small" margin="dense"
                    value={advanceForm.longitude} onChange={(e) => setAdvanceForm({ ...advanceForm, longitude: e.target.value })} />
                </Grid>
              </Grid>
              <TextField
                fullWidth label="Before Photo Caption" margin="dense"
                value={advanceForm.beforePhotoCaption}
                onChange={(e) => setAdvanceForm({ ...advanceForm, beforePhotoCaption: e.target.value })}
              />
            </>
          )}

          {currentStatus === 'site_inspection' && (
            <>
              <TextField
                fullWidth label="Repair Details" margin="dense" multiline minRows={3} required
                value={advanceForm.repairDetails}
                onChange={(e) => setAdvanceForm({ ...advanceForm, repairDetails: e.target.value })}
              />
              <Typography variant="subtitle2" fontWeight={700} mt={2} mb={1}>Materials Used</Typography>
              {advanceForm.materials.map((m, i) => (
                <Grid container spacing={1} key={i} mb={1} alignItems="center">
                  <Grid item xs={5}>
                    <TextField fullWidth size="small" label="Item" value={m.item}
                      onChange={(e) => {
                        const materials = [...advanceForm.materials];
                        materials[i] = { ...materials[i], item: e.target.value };
                        setAdvanceForm({ ...advanceForm, materials });
                      }} />
                  </Grid>
                  <Grid item xs={3}>
                    <TextField fullWidth size="small" label="Qty" value={m.quantity}
                      onChange={(e) => {
                        const materials = [...advanceForm.materials];
                        materials[i] = { ...materials[i], quantity: e.target.value };
                        setAdvanceForm({ ...advanceForm, materials });
                      }} />
                  </Grid>
                  <Grid item xs={3}>
                    <TextField fullWidth size="small" label="Unit" value={m.unit}
                      onChange={(e) => {
                        const materials = [...advanceForm.materials];
                        materials[i] = { ...materials[i], unit: e.target.value };
                        setAdvanceForm({ ...advanceForm, materials });
                      }} />
                  </Grid>
                  <Grid item xs={1}>
                    {advanceForm.materials.length > 1 && (
                      <IconButton size="small" onClick={() => {
                        setAdvanceForm({ ...advanceForm, materials: advanceForm.materials.filter((_, j) => j !== i) });
                      }}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Grid>
                </Grid>
              ))}
              <Button size="small" onClick={() => setAdvanceForm({
                ...advanceForm,
                materials: [...advanceForm.materials, { item: '', quantity: '', unit: '' }],
              })}>Add Material</Button>

              <Typography variant="subtitle2" fontWeight={700} mt={2} mb={1}>Labour Used</Typography>
              {advanceForm.labour.map((l, i) => (
                <Grid container spacing={1} key={i} mb={1} alignItems="center">
                  <Grid item xs={4}>
                    <TextField fullWidth size="small" label="Role" value={l.role}
                      onChange={(e) => {
                        const labour = [...advanceForm.labour];
                        labour[i] = { ...labour[i], role: e.target.value };
                        setAdvanceForm({ ...advanceForm, labour });
                      }} />
                  </Grid>
                  <Grid item xs={3}>
                    <TextField fullWidth size="small" label="Hours" value={l.hours}
                      onChange={(e) => {
                        const labour = [...advanceForm.labour];
                        labour[i] = { ...labour[i], hours: e.target.value };
                        setAdvanceForm({ ...advanceForm, labour });
                      }} />
                  </Grid>
                  <Grid item xs={4}>
                    <TextField fullWidth size="small" label="Name" value={l.name}
                      onChange={(e) => {
                        const labour = [...advanceForm.labour];
                        labour[i] = { ...labour[i], name: e.target.value };
                        setAdvanceForm({ ...advanceForm, labour });
                      }} />
                  </Grid>
                  <Grid item xs={1}>
                    {advanceForm.labour.length > 1 && (
                      <IconButton size="small" onClick={() => {
                        setAdvanceForm({ ...advanceForm, labour: advanceForm.labour.filter((_, j) => j !== i) });
                      }}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Grid>
                </Grid>
              ))}
              <Button size="small" onClick={() => setAdvanceForm({
                ...advanceForm,
                labour: [...advanceForm.labour, { role: '', hours: '', name: '' }],
              })}>Add Labour</Button>
            </>
          )}

          {currentStatus === 'repair_work' && (
            <>
              <TextField
                fullWidth label="Verification Notes" margin="dense" multiline minRows={2}
                value={advanceForm.verificationNotes}
                onChange={(e) => setAdvanceForm({ ...advanceForm, verificationNotes: e.target.value })}
              />
              <TextField
                fullWidth label="After Photo Caption" margin="dense"
                value={advanceForm.afterPhotoCaption}
                onChange={(e) => setAdvanceForm({ ...advanceForm, afterPhotoCaption: e.target.value })}
              />
            </>
          )}

          {currentStatus === 'verification' && (
            <Typography variant="body2" color="text.secondary">
              Confirm verification is complete to close this ticket.
            </Typography>
          )}

          {workflowOpen?.responseTimeMins != null && (
            <Typography variant="caption" color="text.secondary" display="block" mt={2}>
              Response time: {workflowOpen.responseTimeMins} minutes
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={omDialogActionsSx}>
          <Button onClick={() => setWorkflowOpen(null)}>Close</Button>
          {currentStatus !== 'closed' && (
            <Button variant="contained" onClick={handleAdvance} disabled={busy}>
              {currentStatus === 'verification' ? 'Close Ticket' : 'Advance to Next Step'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}
