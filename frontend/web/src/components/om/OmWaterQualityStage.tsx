import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent,
  FormControl, Grid, InputLabel, MenuItem, Select, Step, StepLabel, Stepper,
  Tab, Tabs, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography,
} from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import axios from 'axios';
import { omApi, projectsApi } from '../../services/api';
import SurfaceCard from '../layout/SurfaceCard';
import {
  OM_WQ_PARAMETER_GROUPS,
  OM_WQ_SAMPLE_POINTS,
  OM_WQ_STATUS_LABELS,
  OM_WQ_WORKFLOW,
  complianceChip,
  normalizeWqStatus,
  type OmWqSamplePoint,
  type OmWqStatus,
} from '../../constants/omWaterQuality';
import { dataTableSx } from '../../utils/pagePresentationStyles';
import { OmDialogHeader, omDialogActionsSx, omDialogContentSx, omDialogPaperSx } from './omUi';
import { formatCoordinatePair } from '../../utils/coordinateFields';
import { useCanViewAllDivisions } from '../../utils/divisionAccess';

type WqRow = {
  id: string;
  sampleCode?: string;
  samplePoint: string;
  samplePointLabel?: string;
  sampleDate: string;
  status: string;
  isCompliant?: boolean | null;
  labName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  parameters?: Record<string, unknown>;
  nonComplianceDetails?: Array<{ key: string; label: string; value: unknown; rule: string }>;
  correctiveAction?: string | null;
  workflowStep?: number;
  alert?: boolean;
  projectCode?: string;
};

type ProjectOption = { id: string; name: string; projectCode: string };

const POINT_TABS: OmWqSamplePoint[] = ['source', 'reservoir', 'distribution_network', 'fhtc'];

function getApiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg)) return msg.join(', ');
  }
  return fallback;
}

function emptyParameters(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const g of OM_WQ_PARAMETER_GROUPS) {
    for (const p of g.parameters) out[p.key] = '';
  }
  return out;
}

export default function OmWaterQualityStage() {
  const canViewAll = useCanViewAllDivisions();
  const [tab, setTab] = useState(0);
  const [filter, setFilter] = useState<'all' | 'alerts' | 'closed'>('all');
  const [rows, setRows] = useState<WqRow[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectOption | null>(null);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [workflowOpen, setWorkflowOpen] = useState<WqRow | null>(null);

  const activePoint = POINT_TABS[tab];

  const [createForm, setCreateForm] = useState({
    sampleLabel: '',
    latitude: '',
    longitude: '',
    sampleDate: new Date().toISOString().slice(0, 16),
  });

  const [advanceForm, setAdvanceForm] = useState({
    labName: '',
    parameters: emptyParameters(),
    resultNotes: '',
    latitude: '',
    longitude: '',
    correctiveAction: '',
  });

  const load = useCallback(() => {
    setBusy(true);
    setError('');
    const params: Record<string, string | undefined> = {
      projectCode: selectedProject?.projectCode,
      samplePoint: activePoint,
    };
    if (filter === 'alerts') params.alertsOnly = 'true';
    if (filter === 'closed') params.status = 'closed';

    Promise.all([
      omApi.listWqTests(params),
      omApi.wqSummary(selectedProject?.id),
    ])
      .then(([listRes, sumRes]) => {
        setRows(listRes.data ?? []);
        setSummary(sumRes.data ?? {});
      })
      .catch((err) => setError(getApiError(err, 'Failed to load water quality tests')))
      .finally(() => setBusy(false));
  }, [selectedProject, activePoint, filter]);

  useEffect(() => {
    projectsApi.list()
      .then((res) => {
        const list = (res.data ?? []) as ProjectOption[];
        setProjects(list);
        if (list.length && !selectedProject) setSelectedProject(list[0]);
      })
      .catch(() => setError('Failed to load projects'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = () => {
    setBusy(true);
    omApi.createWqTest({
      samplePoint: activePoint,
      projectCode: selectedProject?.projectCode,
      sampleLabel: createForm.sampleLabel.trim() || undefined,
      sampleDate: createForm.sampleDate ? new Date(createForm.sampleDate).toISOString() : undefined,
      latitude: createForm.latitude ? Number(createForm.latitude) : undefined,
      longitude: createForm.longitude ? Number(createForm.longitude) : undefined,
    })
      .then(() => {
        setCreateOpen(false);
        setCreateForm({ sampleLabel: '', latitude: '', longitude: '', sampleDate: new Date().toISOString().slice(0, 16) });
        load();
      })
      .catch((err) => setError(getApiError(err, 'Failed to register sample')))
      .finally(() => setBusy(false));
  };

  const openWorkflow = (row: WqRow) => {
    setWorkflowOpen(row);
    const params = emptyParameters();
    for (const [k, v] of Object.entries(row.parameters ?? {})) {
      if (params[k] !== undefined) params[k] = String(v);
    }
    setAdvanceForm({
      labName: row.labName ?? '',
      parameters: params,
      resultNotes: '',
      latitude: row.latitude != null ? String(row.latitude) : '',
      longitude: row.longitude != null ? String(row.longitude) : '',
      correctiveAction: row.correctiveAction ?? '',
    });
  };

  const buildAdvancePayload = (status: OmWqStatus): Record<string, unknown> => {
    if (status === 'sample_collection') {
      return { labName: advanceForm.labName.trim() };
    }
    if (status === 'laboratory_testing') {
      const parameters: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(advanceForm.parameters)) {
        if (v !== '') parameters[k] = v.includes('.') ? Number(v) : (Number.isFinite(Number(v)) ? Number(v) : v);
      }
      return { parameters, resultNotes: advanceForm.resultNotes.trim() || undefined };
    }
    if (status === 'result_upload') {
      return {
        latitude: Number(advanceForm.latitude),
        longitude: Number(advanceForm.longitude),
      };
    }
    if (status === 'corrective_action') {
      return { correctiveAction: advanceForm.correctiveAction.trim() };
    }
    return {};
  };

  const handleAdvance = () => {
    if (!workflowOpen) return;
    const status = normalizeWqStatus(workflowOpen.status);
    if (status === 'sample_collection' && !advanceForm.labName.trim()) {
      setError('Laboratory name is required.');
      return;
    }
    if (status === 'laboratory_testing') {
      const hasParam = Object.values(advanceForm.parameters).some((v) => v !== '');
      if (!hasParam) {
        setError('Enter at least one test parameter.');
        return;
      }
    }
    if (status === 'result_upload' && (!advanceForm.latitude || !advanceForm.longitude)) {
      setError('GIS latitude and longitude are required.');
      return;
    }
    if (status === 'corrective_action' && !advanceForm.correctiveAction.trim()) {
      setError('Corrective action is required for non-compliant samples.');
      return;
    }
    setError('');
    setBusy(true);
    omApi.advanceWqTest(workflowOpen.id, buildAdvancePayload(status))
      .then((res) => {
        if (res.data?.status === 'closed') setWorkflowOpen(null);
        else setWorkflowOpen(res.data);
        load();
      })
      .catch((err) => setError(getApiError(err, 'Failed to advance workflow')))
      .finally(() => setBusy(false));
  };

  const currentStatus = workflowOpen ? normalizeWqStatus(workflowOpen.status) : null;
  const workflowStep = workflowOpen?.workflowStep ?? 0;

  return (
    <>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {(summary.alerts ?? 0) > 0 && (
        <Alert severity="warning" icon={<WarningAmberOutlinedIcon />} sx={{ mb: 2 }}>
          {summary.alerts} non-compliant sample{(summary.alerts ?? 0) === 1 ? '' : 's'} require attention.
        </Alert>
      )}

      <Grid container spacing={2} mb={2}>
        <Grid item xs={6} sm={3}>
          <SurfaceCard title="Total Samples">
            <Typography variant="h5" fontWeight={700}>{summary.total ?? 0}</Typography>
          </SurfaceCard>
        </Grid>
        <Grid item xs={6} sm={3}>
          <SurfaceCard title="Compliant">
            <Typography variant="h5" fontWeight={700} color="success.main">{summary.compliant ?? 0}</Typography>
          </SurfaceCard>
        </Grid>
        <Grid item xs={6} sm={3}>
          <SurfaceCard title="Non-Compliant">
            <Typography variant="h5" fontWeight={700} color="error.main">{summary.nonCompliant ?? 0}</Typography>
          </SurfaceCard>
        </Grid>
        <Grid item xs={6} sm={3}>
          <SurfaceCard title="Active Alerts">
            <Typography variant="h5" fontWeight={700} color="warning.main">{summary.alerts ?? 0}</Typography>
          </SurfaceCard>
        </Grid>
      </Grid>

      <SurfaceCard
        header={(
          <Box display="flex" justifyContent="space-between" alignItems="center" width="100%" flexWrap="wrap" gap={1}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem' }}>Water Quality Tests</Typography>
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
              <Button variant="contained" size="small" startIcon={<AddOutlinedIcon />} onClick={() => setCreateOpen(true)}>
                Collect Sample
              </Button>
            </Box>
          </Box>
        )}
      >
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          {OM_WQ_SAMPLE_POINTS.map((p) => (
            <Tab key={p.code} label={p.label} />
          ))}
        </Tabs>

        <Box display="flex" gap={0.75} mb={2} flexWrap="wrap">
          {(['all', 'alerts', 'closed'] as const).map((f) => (
            <Chip
              key={f}
              size="small"
              label={f === 'all' ? 'All' : f === 'alerts' ? 'Non-Compliant Alerts' : 'Closed'}
              color={filter === f ? 'primary' : 'default'}
              variant={filter === f ? 'filled' : 'outlined'}
              onClick={() => setFilter(f)}
            />
          ))}
        </Box>

        <Box mb={2}>
          <Typography variant="caption" color="text.secondary" display="block" mb={0.75}>Parameter groups monitored</Typography>
          <Box display="flex" gap={0.75} flexWrap="wrap">
            {OM_WQ_PARAMETER_GROUPS.map((g) => (
              <Chip key={g.group} size="small" variant="outlined" label={`${g.label}: ${g.parameters.map((p) => p.label).join(', ')}`} />
            ))}
          </Box>
        </Box>

        {rows.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No samples recorded for this monitoring point.</Typography>
        ) : (
          <TableContainer>
            <Table size="small" sx={dataTableSx()}>
              <TableHead>
                <TableRow>
                  <TableCell>Sample</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Lab</TableCell>
                  <TableCell>Compliance</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>GIS</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => {
                  const comp = complianceChip(row.isCompliant);
                  return (
                    <TableRow key={row.id} hover sx={row.alert ? { bgcolor: '#fff7ed' } : undefined}>
                      <TableCell>
                        {row.sampleCode ?? row.id.slice(0, 8)}
                        {row.alert && <WarningAmberOutlinedIcon color="warning" sx={{ ml: 0.5, fontSize: 16, verticalAlign: 'middle' }} />}
                      </TableCell>
                      <TableCell>{new Date(row.sampleDate).toLocaleDateString()}</TableCell>
                      <TableCell>{row.labName ?? '—'}</TableCell>
                      <TableCell><Chip size="small" label={comp.label} color={comp.color} /></TableCell>
                      <TableCell>{OM_WQ_STATUS_LABELS[normalizeWqStatus(row.status)]}</TableCell>
                      <TableCell>{formatCoordinatePair(row.latitude, row.longitude)}</TableCell>
                      <TableCell align="right">
                        {normalizeWqStatus(row.status) !== 'closed' && (
                          <Button size="small" startIcon={<PlayArrowOutlinedIcon />} onClick={() => openWorkflow(row)}>
                            Workflow
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </SurfaceCard>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: omDialogPaperSx }}>
        <OmDialogHeader
          stage={6}
          title={`Sample Collection — ${OM_WQ_SAMPLE_POINTS.find((p) => p.code === activePoint)?.label ?? 'Point'}`}
          busy={busy}
        />
        <DialogContent sx={omDialogContentSx}>
          <TextField
            fullWidth label="Sample Label / Location" margin="dense"
            value={createForm.sampleLabel} onChange={(e) => setCreateForm({ ...createForm, sampleLabel: e.target.value })}
          />
          <TextField
            fullWidth label="Sample Date & Time" type="datetime-local" margin="dense" InputLabelProps={{ shrink: true }}
            value={createForm.sampleDate} onChange={(e) => setCreateForm({ ...createForm, sampleDate: e.target.value })}
          />
          <Grid container spacing={1}>
            <Grid item xs={6}>
              <TextField fullWidth label="Latitude" size="small" margin="dense"
                value={createForm.latitude} onChange={(e) => setCreateForm({ ...createForm, latitude: e.target.value })} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Longitude" size="small" margin="dense"
                value={createForm.longitude} onChange={(e) => setCreateForm({ ...createForm, longitude: e.target.value })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={omDialogActionsSx}>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={busy}>Register Sample</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(workflowOpen)} onClose={() => setWorkflowOpen(null)} maxWidth="md" fullWidth PaperProps={{ sx: omDialogPaperSx }}>
        <OmDialogHeader
          stage={6}
          title={workflowOpen?.samplePointLabel ?? 'Water quality workflow'}
          subtitle={workflowOpen?.sampleCode}
          busy={busy}
        />
        <DialogContent sx={omDialogContentSx}>
          <Stepper activeStep={workflowStep} alternativeLabel sx={{ mb: 3, mt: 1 }}>
            {OM_WQ_WORKFLOW.map((s) => (
              <Step key={s.status}>
                <StepLabel>{s.label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {currentStatus === 'sample_collection' && (
            <TextField fullWidth label="Laboratory Name" margin="dense" required
              value={advanceForm.labName} onChange={(e) => setAdvanceForm({ ...advanceForm, labName: e.target.value })} />
          )}

          {currentStatus === 'laboratory_testing' && (
            <>
              {OM_WQ_PARAMETER_GROUPS.map((g) => (
                <Box key={g.group} mb={2}>
                  <Typography variant="subtitle2" fontWeight={700} mb={1}>{g.label}</Typography>
                  <Grid container spacing={1}>
                    {g.parameters.map((p) => (
                      <Grid item xs={12} sm={6} md={4} key={p.key}>
                        {p.type === 'select' ? (
                          <FormControl fullWidth size="small">
                            <InputLabel>{p.label}</InputLabel>
                            <Select
                              label={p.label}
                              value={advanceForm.parameters[p.key]}
                              onChange={(e) => setAdvanceForm({
                                ...advanceForm,
                                parameters: { ...advanceForm.parameters, [p.key]: e.target.value },
                              })}
                            >
                              <MenuItem value="">—</MenuItem>
                              {p.options?.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                            </Select>
                          </FormControl>
                        ) : (
                          <TextField
                            fullWidth size="small"
                            label={`${p.label}${p.unit ? ` (${p.unit})` : ''}`}
                            value={advanceForm.parameters[p.key]}
                            onChange={(e) => setAdvanceForm({
                              ...advanceForm,
                              parameters: { ...advanceForm.parameters, [p.key]: e.target.value },
                            })}
                            helperText={
                              p.min != null && p.max != null
                                ? `Range: ${p.min}–${p.max}`
                                : p.max != null
                                  ? `Max: ${p.max}`
                                  : undefined
                            }
                          />
                        )}
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              ))}
              <TextField fullWidth label="Result Notes" margin="dense" multiline minRows={2}
                value={advanceForm.resultNotes} onChange={(e) => setAdvanceForm({ ...advanceForm, resultNotes: e.target.value })} />
            </>
          )}

          {currentStatus === 'result_upload' && (
            <Grid container spacing={1}>
              <Grid item xs={6}>
                <TextField fullWidth label="Latitude" required margin="dense"
                  value={advanceForm.latitude} onChange={(e) => setAdvanceForm({ ...advanceForm, latitude: e.target.value })} />
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth label="Longitude" required margin="dense"
                  value={advanceForm.longitude} onChange={(e) => setAdvanceForm({ ...advanceForm, longitude: e.target.value })} />
              </Grid>
            </Grid>
          )}

          {currentStatus === 'compliance_verification' && (
            <Box>
              {workflowOpen?.isCompliant === false ? (
                <>
                  <Alert severity="error" sx={{ mb: 2 }}>Non-compliant sample — corrective action required next.</Alert>
                  <Typography variant="body2" fontWeight={600} gutterBottom>Failed parameters:</Typography>
                  <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                    {(workflowOpen.nonComplianceDetails ?? []).map((f) => (
                      <Typography component="li" variant="body2" key={f.key}>
                        {f.label}: {String(f.value)} ({f.rule})
                      </Typography>
                    ))}
                  </Box>
                </>
              ) : (
                <Alert severity="success">Sample meets compliance limits. Ready to close.</Alert>
              )}
            </Box>
          )}

          {currentStatus === 'corrective_action' && (
            <TextField fullWidth label="Corrective Action Taken" margin="dense" multiline minRows={3} required
              value={advanceForm.correctiveAction}
              onChange={(e) => setAdvanceForm({ ...advanceForm, correctiveAction: e.target.value })} />
          )}
        </DialogContent>
        <DialogActions sx={omDialogActionsSx}>
          <Button onClick={() => setWorkflowOpen(null)}>Close</Button>
          {currentStatus !== 'closed' && (
            <Button variant="contained" onClick={handleAdvance} disabled={busy}>
              {currentStatus === 'compliance_verification'
                ? (workflowOpen?.isCompliant === false ? 'Proceed to Corrective Action' : 'Close Sample')
                : currentStatus === 'corrective_action'
                  ? 'Close Sample'
                  : 'Advance to Next Step'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}
