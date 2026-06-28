import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  Alert, Box, Button, Chip, FormControl, Grid, InputLabel, LinearProgress,
  MenuItem, Select, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Typography,
} from '@mui/material';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import axios from 'axios';
import { omApi, projectsApi } from '../../services/api';
import SurfaceCard from '../layout/SurfaceCard';
import {
  markerColor,
  panelStatusColor,
  statusLabel,
} from '../../constants/omDashboard';
import { dataTableSx } from '../../utils/pagePresentationStyles';
import { formatCoordinatePair } from '../../utils/coordinateFields';
import { useCanViewAllDivisions } from '../../utils/divisionAccess';

type PanelStatus = 'normal' | 'warning' | 'critical' | 'unknown';

type DashboardData = {
  generatedAt?: string;
  overallStatus?: PanelStatus;
  projectName?: string;
  projectCode?: string;
  panels?: Record<string, Record<string, unknown>>;
  scadaSites?: Array<Record<string, unknown>>;
  mapMarkers?: Array<{
    id: string;
    markerType: string;
    label: string;
    latitude: number;
    longitude: number;
    status: string;
    severity: string;
  }>;
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

function StatusChip({ status }: { status?: string }) {
  if (!status) return null;
  return (
    <Chip size="small" label={statusLabel(status)} color={panelStatusColor(status)} sx={{ fontWeight: 700 }} />
  );
}

function PanelShell({
  title,
  status,
  children,
}: {
  title: string;
  status?: string;
  children: ReactNode;
}) {
  return (
    <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', height: '100%' }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant="caption" fontWeight={700} color="text.secondary">{title}</Typography>
        <StatusChip status={status} />
      </Box>
      {children}
    </Box>
  );
}

export default function OmDashboardStage() {
  const canViewAll = useCanViewAllDivisions();
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectOption | null>(null);
  const [data, setData] = useState<DashboardData>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setBusy(true);
    setError('');
    omApi.gisDashboard(selectedProject
      ? { projectId: selectedProject.id, projectCode: selectedProject.projectCode }
      : undefined)
      .then((res) => setData(res.data ?? {}))
      .catch((err) => setError(getApiError(err, 'Failed to load GIS dashboard')))
      .finally(() => setBusy(false));
  }, [selectedProject]);

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

  const p = data.panels ?? {};
  const assetHealth = p.assetHealth ?? {};
  const breakdowns = p.activeBreakdowns ?? {};
  const waterSupply = p.waterSupply ?? {};
  const reservoir = p.reservoirLevels ?? {};
  const pump = p.pumpStatus ?? {};
  const wq = p.waterQuality ?? {};
  const energy = p.energyConsumption ?? {};
  const complaints = p.complaintStatus ?? {};
  const sla = p.slaCompliance ?? {};
  const renewal = p.assetRenewal ?? {};

  return (
    <>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <SurfaceCard
        header={(
          <Box display="flex" justifyContent="space-between" alignItems="center" width="100%" flexWrap="wrap" gap={1}>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem' }}>GIS O&M Operations Dashboard</Typography>
              <Typography variant="caption" color="text.secondary">
                {data.projectCode ? `${data.projectCode} — ${data.projectName}` : 'All schemes'}
                {data.generatedAt ? ` · Updated ${new Date(data.generatedAt).toLocaleString()}` : ''}
              </Typography>
            </Box>
            <Box display="flex" gap={1} flexWrap="wrap" alignItems="center">
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel>Scheme / Project</InputLabel>
                <Select
                  label="Scheme / Project"
                  value={selectedProject?.id ?? ''}
                  onChange={(e) => setSelectedProject(projects.find((x) => x.id === e.target.value) ?? null)}
                >
                  {canViewAll && <MenuItem value="">All schemes</MenuItem>}
                  {projects.map((pr) => (
                    <MenuItem key={pr.id} value={pr.id}>{pr.projectCode} — {pr.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <StatusChip status={data.overallStatus} />
              <Button size="small" variant="outlined" startIcon={<RefreshOutlinedIcon />} onClick={load} disabled={busy}>
                Refresh
              </Button>
            </Box>
          </Box>
        )}
      >
        {busy && <LinearProgress sx={{ mb: 2 }} />}

        <Grid container spacing={2} mb={3}>
          <Grid item xs={12} sm={6} md={4}>
            <PanelShell title="Asset Health Status" status={assetHealth.status as string}>
              <Typography variant="h5" fontWeight={700}>{assetHealth.avgHealthIndex ?? '—'}</Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                {assetHealth.trackedAssets ?? 0} assets · {assetHealth.criticalAssets ?? 0} critical/poor
              </Typography>
              {(assetHealth.byCategory as Array<{ label: string; avgHealth: number | null }> | undefined)?.slice(0, 3).map((c) => (
                <Typography key={c.label} variant="caption" display="block">{c.label}: {c.avgHealth ?? '—'}</Typography>
              ))}
            </PanelShell>
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <PanelShell title="Active Breakdowns" status={breakdowns.status as string}>
              <Typography variant="h5" fontWeight={700} color="warning.main">{breakdowns.open ?? 0}</Typography>
              <Typography variant="caption" color="text.secondary">
                Open · {breakdowns.closed ?? 0} closed · avg response {breakdowns.avgResponseTimeMins ?? '—'} min
              </Typography>
            </PanelShell>
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <PanelShell title="Water Supply Status" status={waterSupply.status as string}>
              <Typography variant="body1" fontWeight={700}>{waterSupply.label as string ?? '—'}</Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                Pump: {String(waterSupply.pumpStatus ?? '—')} · Supply complaints: {waterSupply.openSupplyComplaints ?? 0}
              </Typography>
            </PanelShell>
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <PanelShell title="Reservoir Levels" status={reservoir.status as string}>
              <Typography variant="h5" fontWeight={700}>
                {reservoir.levelPct != null ? `${reservoir.levelPct}%` : '—'}
              </Typography>
              <Typography variant="caption" color="text.secondary">{reservoir.label as string}</Typography>
            </PanelShell>
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <PanelShell title="Pump Status" status={pump.status as string}>
              <Typography variant="body1" fontWeight={700}>{pump.label as string ?? '—'}</Typography>
              <Typography variant="caption" color="text.secondary">
                State: {String(pump.pumpState ?? '—')}
                {pump.flowLps != null ? ` · Flow ${pump.flowLps} LPS` : ''}
              </Typography>
            </PanelShell>
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <PanelShell title="Water Quality Status" status={wq.status as string}>
              <Typography variant="h5" fontWeight={700}>{wq.compliancePct != null ? `${wq.compliancePct}%` : '—'}</Typography>
              <Typography variant="caption" color="text.secondary">
                {wq.compliant ?? 0}/{wq.totalTests ?? 0} compliant · {wq.alerts ?? 0} alerts
              </Typography>
            </PanelShell>
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <PanelShell title="Energy Consumption" status={energy.status as string}>
              <Typography variant="h5" fontWeight={700}>{energy.kwhPerKl != null ? energy.kwhPerKl : '—'}</Typography>
              <Typography variant="caption" color="text.secondary" display="block">kWh/KL specific energy</Typography>
              <Typography variant="caption" color="text.secondary">
                {energy.energyKwh ?? '—'} kWh · {energy.waterPumpedKl ?? '—'} KL pumped
              </Typography>
            </PanelShell>
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <PanelShell title="Complaint Status" status={complaints.status as string}>
              <Typography variant="h5" fontWeight={700}>{complaints.open ?? 0}</Typography>
              <Typography variant="caption" color="text.secondary">
                Open · {complaints.closed ?? 0} closed · avg response {complaints.avgResponseTimeMins ?? '—'} min
              </Typography>
            </PanelShell>
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <PanelShell title="SLA Compliance" status={sla.status as string}>
              <Typography variant="h5" fontWeight={700}>
                {sla.avgSlaCompliancePct != null ? `${sla.avgSlaCompliancePct}%` : '—'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {sla.activeContracts ?? 0} contracts · {sla.contractsBelowSla ?? 0} below SLA
              </Typography>
            </PanelShell>
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <PanelShell title="Asset Renewal Requirements" status={renewal.status as string}>
              <Typography variant="h5" fontWeight={700}>{renewal.replacementDue ?? 0}</Typography>
              <Typography variant="caption" color="text.secondary" display="block">Assets due replacement (≤2yr RUL)</Typography>
              <Typography variant="caption" color="text.secondary">
                Rehab {renewal.rehabilitationPlans ?? 0} · Replace {renewal.replacementPlans ?? 0} · Annual {renewal.annualPlans ?? 0}
              </Typography>
            </PanelShell>
          </Grid>
        </Grid>

        <Grid container spacing={2}>
          <Grid item xs={12} md={7}>
            <SurfaceCard title="GIS Operations Map">
              <Box
                sx={{
                  position: 'relative',
                  minHeight: 280,
                  borderRadius: 2,
                  bgcolor: '#0f172a',
                  backgroundImage: 'linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)',
                  backgroundSize: '24px 24px',
                  overflow: 'hidden',
                  p: 2,
                }}
              >
                <Box display="flex" alignItems="center" gap={0.75} mb={1.5}>
                  <MapOutlinedIcon sx={{ color: '#94a3b8', fontSize: 18 }} />
                  <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 700 }}>
                    SCHEMATIC GIS LAYER — {data.mapMarkers?.length ?? 0} geo-tagged features
                  </Typography>
                </Box>

                {(data.mapMarkers ?? []).length === 0 && (
                  <Typography variant="body2" sx={{ color: '#64748b', mt: 4, textAlign: 'center' }}>
                    No geo-tagged assets, breakdowns, or complaints for this scheme.
                    Register assets with GIS coordinates in Stage 2.
                  </Typography>
                )}

                <Box sx={{ position: 'relative', height: 220 }}>
                  {(data.mapMarkers ?? []).slice(0, 24).map((m, idx) => {
                    const col = idx % 6;
                    const row = Math.floor(idx / 6);
                    return (
                      <Box
                        key={m.id}
                        title={m.label}
                        sx={{
                          position: 'absolute',
                          left: `${12 + col * 15}%`,
                          top: `${15 + row * 22}%`,
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          bgcolor: markerColor(m.severity),
                          boxShadow: `0 0 8px ${markerColor(m.severity)}`,
                          cursor: 'default',
                        }}
                      />
                    );
                  })}
                </Box>

                <Box display="flex" gap={1} flexWrap="wrap" mt={1}>
                  <Chip size="small" label="Asset" sx={{ bgcolor: '#22c55e', color: '#fff', height: 20, fontSize: '0.65rem' }} />
                  <Chip size="small" label="Breakdown" sx={{ bgcolor: '#f59e0b', color: '#fff', height: 20, fontSize: '0.65rem' }} />
                  <Chip size="small" label="Complaint" sx={{ bgcolor: '#ef4444', color: '#fff', height: 20, fontSize: '0.65rem' }} />
                </Box>
              </Box>
            </SurfaceCard>
          </Grid>

          <Grid item xs={12} md={5}>
            <SurfaceCard title="Supply Chain Status">
              <Box display="flex" flexDirection="column" gap={1}>
                {[
                  { zone: 'Source / Intake', status: waterSupply.status, detail: 'Raw water availability' },
                  { zone: 'Reservoir / Storage', status: reservoir.status, detail: reservoir.label as string },
                  { zone: 'Pump House', status: pump.status, detail: pump.label as string },
                  { zone: 'Treatment / Chlorination', status: wq.status, detail: `${wq.compliancePct ?? '—'}% WQ compliance` },
                  { zone: 'Distribution Network', status: breakdowns.open ? 'warning' : 'normal', detail: `${breakdowns.open ?? 0} active breakdowns` },
                  { zone: 'Consumer Service', status: complaints.status, detail: `${complaints.open ?? 0} open complaints` },
                ].map((z) => (
                  <Box
                    key={z.zone}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      p: 1.25,
                      borderRadius: 1.5,
                      bgcolor: '#f1f5f9',
                      borderLeft: `4px solid ${markerColor(z.status === 'critical' ? 'critical' : z.status === 'warning' ? 'warning' : 'normal')}`,
                    }}
                  >
                    <Box>
                      <Typography variant="body2" fontWeight={600}>{z.zone}</Typography>
                      <Typography variant="caption" color="text.secondary">{z.detail}</Typography>
                    </Box>
                    <StatusChip status={z.status as string} />
                  </Box>
                ))}
              </Box>
            </SurfaceCard>
          </Grid>

          <Grid item xs={12}>
            <SurfaceCard title="Geo-Tagged Features">
              <TableContainer>
                <Table size="small" sx={dataTableSx}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Type</TableCell>
                      <TableCell>Label</TableCell>
                      <TableCell>GIS Coordinates</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(data.mapMarkers ?? []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          <Typography variant="body2" color="text.secondary" py={2}>No markers to display.</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                    {(data.mapMarkers ?? []).slice(0, 15).map((m) => (
                      <TableRow key={m.id}>
                        <TableCell sx={{ textTransform: 'capitalize' }}>{m.markerType}</TableCell>
                        <TableCell>{m.label}</TableCell>
                        <TableCell>{formatCoordinatePair(m.latitude, m.longitude)}</TableCell>
                        <TableCell>
                          <Chip size="small" label={m.status} color={panelStatusColor(m.severity === 'critical' ? 'critical' : m.severity === 'warning' ? 'warning' : 'normal')} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </SurfaceCard>
          </Grid>
        </Grid>
      </SurfaceCard>
    </>
  );
}
