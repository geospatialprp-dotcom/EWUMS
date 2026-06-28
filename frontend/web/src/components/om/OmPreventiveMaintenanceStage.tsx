import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent,
  FormControl, Grid, InputLabel, MenuItem, Select, Tab, Tabs,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography,
} from '@mui/material';
import AutorenewOutlinedIcon from '@mui/icons-material/AutorenewOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import axios from 'axios';
import { omApi, projectsApi } from '../../services/api';
import SurfaceCard from '../layout/SurfaceCard';
import {
  OM_PM_CATEGORIES,
  OM_PM_FREQUENCY_LABELS,
  OM_PM_CATEGORY_LABELS,
  getPmCategoryDef,
  statusColor,
  type OmPmCategory,
  type OmPmFrequency,
} from '../../constants/omPreventiveMaintenance';
import { dataTableSx } from '../../utils/pagePresentationStyles';
import { OmDialogHeader, omDialogActionsSx, omDialogContentSx, omDialogPaperSx } from './omUi';

type ScheduleRow = {
  id: string;
  category: string;
  taskName: string;
  taskCode: string;
  frequency: string;
  periodKey: string;
  scheduledFor: string;
  dueDate: string;
  status: string;
  assetCode?: string | null;
  projectName?: string;
  projectCode?: string;
  notes?: string | null;
  completedAt?: string | null;
};

type ProjectOption = { id: string; name: string; projectCode: string };

const CATEGORY_TABS: OmPmCategory[] = OM_PM_CATEGORIES;
const FREQ_FILTERS: Array<OmPmFrequency | 'all'> = ['all', 'daily', 'monthly', 'quarterly', 'annual'];

function getApiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg)) return msg.join(', ');
  }
  return fallback;
}

export default function OmPreventiveMaintenanceStage() {
  const [tab, setTab] = useState(0);
  const [freqFilter, setFreqFilter] = useState<OmPmFrequency | 'all'>('all');
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectOption | null>(null);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [completeOpen, setCompleteOpen] = useState<ScheduleRow | null>(null);
  const [completeNotes, setCompleteNotes] = useState('');

  const activeCategory = CATEGORY_TABS[tab];
  const categoryDef = getPmCategoryDef(activeCategory);

  const load = useCallback(() => {
    if (!selectedProject) return;
    setBusy(true);
    setError('');
    Promise.all([
      omApi.listPmSchedules({
        projectCode: selectedProject.projectCode,
        category: activeCategory,
        frequency: freqFilter === 'all' ? undefined : freqFilter,
      }),
      omApi.pmSummary(selectedProject.id),
    ])
      .then(([schedRes, sumRes]) => {
        setRows(schedRes.data ?? []);
        setSummary(sumRes.data ?? {});
      })
      .catch((err) => setError(getApiError(err, 'Failed to load PM schedules')))
      .finally(() => setBusy(false));
  }, [selectedProject, activeCategory, freqFilter]);

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

  useEffect(() => {
    if (!selectedProject) return;
    omApi.generatePmSchedules({ projectCode: selectedProject.projectCode })
      .then((res) => {
        const created = res.data?.created ?? 0;
        if (created > 0) {
          setInfo(`Generated ${created} new schedule${created === 1 ? '' : 's'} for the current period.`);
        }
      })
      .catch((err) => setError(getApiError(err, 'Failed to generate schedules')));
  }, [selectedProject?.projectCode]);

  useEffect(() => { load(); }, [load]);

  const regenerate = () => {
    if (!selectedProject) return;
    setBusy(true);
    omApi.generatePmSchedules({ projectCode: selectedProject.projectCode })
      .then((res) => {
        const created = res.data?.created ?? 0;
        setInfo(created > 0
          ? `Generated ${created} new schedule${created === 1 ? '' : 's'} for the current period.`
          : 'Schedules are up to date for the current period.');
        load();
      })
      .catch((err) => setError(getApiError(err, 'Failed to generate schedules')))
      .finally(() => setBusy(false));
  };

  const handleComplete = () => {
    if (!completeOpen) return;
    setBusy(true);
    omApi.completePmSchedule(completeOpen.id, { notes: completeNotes.trim() || undefined })
      .then(() => {
        setCompleteOpen(null);
        setCompleteNotes('');
        load();
      })
      .catch((err) => setError(getApiError(err, 'Failed to complete task')))
      .finally(() => setBusy(false));
  };

  return (
    <>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {info && <Alert severity="info" sx={{ mb: 2 }} onClose={() => setInfo('')}>{info}</Alert>}

      <Grid container spacing={2} mb={2}>
        <Grid item xs={6} sm={3}>
          <SurfaceCard title="Scheduled">
            <Typography variant="h5" fontWeight={700}>{summary.scheduled ?? 0}</Typography>
          </SurfaceCard>
        </Grid>
        <Grid item xs={6} sm={3}>
          <SurfaceCard title="Completed">
            <Typography variant="h5" fontWeight={700} color="success.main">{summary.completed ?? 0}</Typography>
          </SurfaceCard>
        </Grid>
        <Grid item xs={6} sm={3}>
          <SurfaceCard title="Overdue">
            <Typography variant="h5" fontWeight={700} color="error.main">{summary.overdue ?? 0}</Typography>
          </SurfaceCard>
        </Grid>
        <Grid item xs={6} sm={3}>
          <SurfaceCard title="Total Tasks">
            <Typography variant="h5" fontWeight={700}>{summary.total ?? 0}</Typography>
          </SurfaceCard>
        </Grid>
      </Grid>

      <SurfaceCard
        header={(
          <Box display="flex" justifyContent="space-between" alignItems="center" width="100%" flexWrap="wrap" gap={1}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem' }}>Preventive Maintenance Schedules</Typography>
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
                  {projects.map((p) => (
                    <MenuItem key={p.id} value={p.id}>{p.projectCode} — {p.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                variant="outlined"
                size="small"
                startIcon={<AutorenewOutlinedIcon />}
                disabled={!selectedProject || busy}
                onClick={regenerate}
              >
                Regenerate
              </Button>
            </Box>
          </Box>
        )}
      >
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          {CATEGORY_TABS.map((cat) => (
            <Tab key={cat} label={OM_PM_CATEGORY_LABELS[cat]} />
          ))}
        </Tabs>

        <Box mb={2}>
          <Typography variant="caption" color="text.secondary" display="block" mb={0.75}>
            {categoryDef.label} — task catalogue for this category
          </Typography>
          <Box display="flex" gap={0.75} flexWrap="wrap" mb={1.5}>
            {categoryDef.tasks.map((t) => (
              <Chip
                key={t.code}
                size="small"
                variant="outlined"
                label={`${t.name} (${OM_PM_FREQUENCY_LABELS[t.frequency]})`}
              />
            ))}
          </Box>
          <Box display="flex" gap={0.75} flexWrap="wrap">
            {FREQ_FILTERS.map((f) => (
              <Chip
                key={f}
                size="small"
                label={f === 'all' ? 'All frequencies' : OM_PM_FREQUENCY_LABELS[f]}
                color={freqFilter === f ? 'primary' : 'default'}
                onClick={() => setFreqFilter(f)}
                variant={freqFilter === f ? 'filled' : 'outlined'}
              />
            ))}
          </Box>
        </Box>

        {!selectedProject ? (
          <Typography variant="body2" color="text.secondary">Select a scheme to view auto-generated PM schedules.</Typography>
        ) : rows.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No schedules for this filter. Click Regenerate to create tasks for the current period.
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small" sx={dataTableSx()}>
              <TableHead>
                <TableRow>
                  <TableCell>Task</TableCell>
                  <TableCell>Frequency</TableCell>
                  <TableCell>Period</TableCell>
                  <TableCell>Due Date</TableCell>
                  <TableCell>Asset</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>{row.taskName}</TableCell>
                    <TableCell>{OM_PM_FREQUENCY_LABELS[row.frequency as OmPmFrequency] ?? row.frequency}</TableCell>
                    <TableCell>{row.periodKey}</TableCell>
                    <TableCell>{row.dueDate}</TableCell>
                    <TableCell>{row.assetCode ?? 'Scheme-level'}</TableCell>
                    <TableCell>
                      <Chip size="small" label={row.status} color={statusColor(row.status)} />
                    </TableCell>
                    <TableCell align="right">
                      {row.status !== 'completed' && (
                        <Button
                          size="small"
                          startIcon={<CheckCircleOutlineIcon />}
                          onClick={() => { setCompleteOpen(row); setCompleteNotes(''); }}
                        >
                          Complete
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

      <Dialog open={Boolean(completeOpen)} onClose={() => setCompleteOpen(null)} maxWidth="sm" fullWidth PaperProps={{ sx: omDialogPaperSx }}>
        <OmDialogHeader stage={4} title="Complete Maintenance Task" subtitle={completeOpen?.taskName} busy={busy} />
        <DialogContent sx={omDialogContentSx}>
          <Typography variant="body2" mb={2}>
            Mark <strong>{completeOpen?.taskName}</strong> as completed
            {completeOpen?.assetCode ? ` for asset ${completeOpen.assetCode}` : ''}.
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={3}
            label="Completion notes (optional)"
            value={completeNotes}
            onChange={(e) => setCompleteNotes(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={omDialogActionsSx}>
          <Button onClick={() => setCompleteOpen(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleComplete} disabled={busy}>Mark Completed</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
