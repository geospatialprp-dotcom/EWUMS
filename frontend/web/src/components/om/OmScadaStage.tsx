import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, Grid, Tab, Tabs,
  FormControl, InputLabel, MenuItem, Select,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Typography,
} from '@mui/material';
import SensorsOutlinedIcon from '@mui/icons-material/SensorsOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import axios from 'axios';
import { omApi, projectsApi } from '../../services/api';
import SurfaceCard from '../layout/SurfaceCard';
import { OM_SCADA_ALERT_TYPES, OM_SCADA_SITES, severityColor, statusColor } from '../../constants/omScada';
import { dataTableSx } from '../../utils/pagePresentationStyles';
import { useCanViewAllDivisions } from '../../utils/divisionAccess';

type LiveCategory = {
  category: string;
  label: string;
  metrics: Array<{
    key: string;
    label: string;
    unit?: string;
    latest: string | null;
    recordedAt?: string | null;
  }>;
};

type AlertRow = {
  id: string;
  alertType: string;
  alertLabel?: string;
  severity: string;
  message: string;
  status: string;
  createdAt: string;
};

type ProjectOption = { id: string; name: string; projectCode: string };

function getApiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg)) return msg.join(', ');
  }
  return fallback;
}

export default function OmScadaStage() {
  const canViewAll = useCanViewAllDivisions();
  const [tab, setTab] = useState(0);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectOption | null>(null);
  const [live, setLive] = useState<{ categories?: LiveCategory[]; openAlerts?: number; criticalAlerts?: number }>({});
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [readings, setReadings] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const activeCategory = OM_SCADA_SITES[tab]?.category;

  const load = useCallback(() => {
    setBusy(true);
    setError('');
    Promise.all([
      omApi.scadaDashboard(selectedProject
        ? { projectId: selectedProject.id, projectCode: selectedProject.projectCode }
        : undefined),
      omApi.listScadaAlerts(selectedProject
        ? { projectId: selectedProject.id, projectCode: selectedProject.projectCode }
        : undefined),
      tab < OM_SCADA_SITES.length
        ? omApi.listScadaReadings({
          projectId: selectedProject?.id,
          projectCode: selectedProject?.projectCode,
          siteCategory: activeCategory,
        })
        : Promise.resolve({ data: [] }),
    ])
      .then(([dashRes, alertRes, readRes]) => {
        setLive(dashRes.data ?? {});
        if (tab === OM_SCADA_SITES.length) {
          setAlerts(alertRes.data ?? []);
        } else {
          setReadings(readRes.data ?? []);
        }
      })
      .catch((err) => setError(getApiError(err, 'Failed to load SCADA data')))
      .finally(() => setBusy(false));
  }, [selectedProject, tab, activeCategory]);

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

  const simulate = () => {
    setBusy(true);
    omApi.simulateScada(selectedProject
      ? { projectId: selectedProject.id, projectCode: selectedProject.projectCode }
      : undefined)
      .then((res) => {
        const alertsCount = (res.data?.results as Array<{ alertsGenerated: number }> ?? [])
          .reduce((s, r) => s + (r.alertsGenerated ?? 0), 0);
        setInfo(`SCADA snapshot ingested. ${alertsCount} alert(s) generated.`);
        load();
      })
      .catch((err) => setError(getApiError(err, 'Simulation failed')))
      .finally(() => setBusy(false));
  };

  const acknowledge = (id: string) => {
    omApi.acknowledgeScadaAlert(id).then(load).catch((err) => setError(getApiError(err, 'Failed to acknowledge')));
  };

  const resolve = (id: string) => {
    omApi.resolveScadaAlert(id).then(load).catch((err) => setError(getApiError(err, 'Failed to resolve')));
  };

  return (
    <>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {info && <Alert severity="info" sx={{ mb: 2 }} onClose={() => setInfo('')}>{info}</Alert>}
      {(live.openAlerts ?? 0) > 0 && (
        <Alert severity="warning" icon={<WarningAmberOutlinedIcon />} sx={{ mb: 2 }}>
          {live.openAlerts} open SCADA alert{(live.openAlerts ?? 0) === 1 ? '' : 's'}
          {(live.criticalAlerts ?? 0) > 0 ? ` (${live.criticalAlerts} critical)` : ''}.
        </Alert>
      )}

      <Grid container spacing={2} mb={2}>
        {live.categories?.map((cat) => (
          <Grid item xs={12} sm={6} md={3} key={cat.category}>
            <SurfaceCard title={cat.label}>
              {cat.metrics.map((m) => (
                <Box key={m.key} display="flex" justifyContent="space-between" mb={0.5}>
                  <Typography variant="caption" color="text.secondary">{m.label}</Typography>
                  <Typography variant="caption" fontWeight={700}>{m.latest ?? '—'}</Typography>
                </Box>
              ))}
            </SurfaceCard>
          </Grid>
        ))}
      </Grid>

      <SurfaceCard
        header={(
          <Box display="flex" justifyContent="space-between" alignItems="center" width="100%" flexWrap="wrap" gap={1}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem' }}>SCADA & IoT Monitoring</Typography>
            <Box display="flex" gap={1} flexWrap="wrap" alignItems="center">
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Scheme / Project</InputLabel>
                <Select label="Scheme / Project" value={selectedProject?.id ?? ''}
                  onChange={(e) => setSelectedProject(projects.find((p) => p.id === e.target.value) ?? null)}>
                  {canViewAll && <MenuItem value="">All schemes</MenuItem>}
                  {projects.map((p) => (
                    <MenuItem key={p.id} value={p.id}>{p.projectCode} — {p.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button size="small" variant="outlined" startIcon={<RefreshOutlinedIcon />} disabled={busy} onClick={load}>
                Refresh
              </Button>
              <Button size="small" variant="contained" startIcon={<SensorsOutlinedIcon />} disabled={busy} onClick={simulate}>
                Simulate SCADA Snapshot
              </Button>
            </Box>
          </Box>
        )}
      >
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }} variant="scrollable" scrollButtons="auto">
          {OM_SCADA_SITES.map((s) => <Tab key={s.category} label={s.label} />)}
          <Tab label="Automated Alerts" />
        </Tabs>

        {tab < OM_SCADA_SITES.length && (
          <>
            <Box display="flex" gap={0.75} mb={2} flexWrap="wrap">
              {OM_SCADA_SITES[tab].metrics.map((m) => (
                <Chip key={m.key} size="small" variant="outlined" label={`${m.label}${m.unit ? ` (${m.unit})` : ''}`} />
              ))}
            </Box>
            {readings.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No telemetry yet. Click Simulate SCADA Snapshot to ingest demo readings.
              </Typography>
            ) : (
              <TableContainer>
                <Table size="small" sx={dataTableSx()}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Metric</TableCell>
                      <TableCell>Value</TableCell>
                      <TableCell>Source</TableCell>
                      <TableCell>Recorded</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {readings.map((r) => (
                      <TableRow key={String(r.id)} hover>
                        <TableCell>{String(r.metricKey)}</TableCell>
                        <TableCell>{String(r.value ?? '—')}</TableCell>
                        <TableCell>{String(r.source ?? 'scada')}</TableCell>
                        <TableCell>{r.recordedAt ? new Date(String(r.recordedAt)).toLocaleString() : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </>
        )}

        {tab === OM_SCADA_SITES.length && (
          <>
            <Box display="flex" gap={0.75} mb={2} flexWrap="wrap">
              {OM_SCADA_ALERT_TYPES.map((a) => (
                <Chip key={a.type} size="small" variant="outlined" label={a.label} color={severityColor(a.severity)} />
              ))}
            </Box>
            {alerts.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No open alerts.</Typography>
            ) : (
              <TableContainer>
                <Table size="small" sx={dataTableSx()}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Type</TableCell>
                      <TableCell>Severity</TableCell>
                      <TableCell>Message</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Time</TableCell>
                      <TableCell align="right">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {alerts.map((a) => (
                      <TableRow key={a.id} hover>
                        <TableCell>{a.alertLabel ?? a.alertType}</TableCell>
                        <TableCell><Chip size="small" label={a.severity} color={severityColor(a.severity)} /></TableCell>
                        <TableCell>{a.message}</TableCell>
                        <TableCell><Chip size="small" label={a.status} color={statusColor(a.status)} /></TableCell>
                        <TableCell>{new Date(a.createdAt).toLocaleString()}</TableCell>
                        <TableCell align="right">
                          {a.status === 'open' && (
                            <Button size="small" onClick={() => acknowledge(a.id)} sx={{ mr: 0.5 }}>Ack</Button>
                          )}
                          {a.status !== 'resolved' && (
                            <Button size="small" onClick={() => resolve(a.id)}>Resolve</Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </>
        )}
      </SurfaceCard>
    </>
  );
}
