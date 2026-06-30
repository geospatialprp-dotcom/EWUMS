import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent,
  Grid, MenuItem, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import LandscapeOutlinedIcon from '@mui/icons-material/LandscapeOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { landAcquisitionApi, projectsApi, dprPlanningApi } from '../services/api';
import PageShell from '../components/layout/PageShell';
import PageHeader from '../components/layout/PageHeader';
import { dataTableSx } from '../utils/pagePresentationStyles';
import KpiStatCard from '../components/layout/KpiStatCard';
import SurfaceCard from '../components/layout/SurfaceCard';
import LaGisDashboardPanel, { type LaGisDashboardData } from '../components/la/LaGisDashboardPanel';
import LaAiAlertsPanel, { type LaAiAlertsBundle } from '../components/la/LaAiAlertsPanel';
import { laStatusColor, laStatusLabel } from '../constants/laAcquisition';
import { useDivisionScopeKey } from '../context/DivisionContext';
import { useAuth } from '../context/AuthContext';
import { canPerformOperational, isSuperAdmin, SUPER_ADMIN_VIEW_ONLY_MESSAGE } from '../utils/operationalAccess';

type CaseRow = {
  id: string;
  caseNo: string;
  title: string;
  schemeType: string;
  status: string;
  statusLabel?: string;
  totalParcels: number;
  totalAreaSqm: number;
  totalCompensationEst: number;
  clearanceStatus: string;
  dprProposalId?: string | null;
  updatedAt?: string;
};

function getApiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg)) return msg.join(', ');
  }
  return fallback;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeOptionalUuid(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return UUID_RE.test(trimmed) ? trimmed : undefined;
}

export default function LandAcquisitionPage() {
  const navigate = useNavigate();
  const { user, hasPermission, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const createFor = searchParams.get('createFor');
  const prefilledTitle = searchParams.get('title') ?? '';
  const linkedProposalId = normalizeOptionalUuid(createFor ?? '');
  const canCreateLaCase = canPerformOperational(user?.roles, hasPermission, 'la_case:create');

  const [dashboard, setDashboard] = useState<Record<string, unknown>>({});
  const [gis, setGis] = useState<LaGisDashboardData>({});
  const [aiAlerts, setAiAlerts] = useState<LaAiAlertsBundle | null>(null);
  const [rows, setRows] = useState<CaseRow[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    title: prefilledTitle,
    schemeType: 'gravity',
    dprProposalId: '',
    projectId: '',
  });
  const [linkedProposal, setLinkedProposal] = useState<{ title: string; proposalNo: string } | null>(null);
  const [projects, setProjects] = useState<Array<{ id: string; name: string; code?: string }>>([]);

  useEffect(() => {
    if (!linkedProposalId) {
      projectsApi.list()
        .then((res) => {
          const list = Array.isArray(res.data) ? res.data : [];
          setProjects(list.map((p: { id: string; name: string; code?: string }) => p));
        })
        .catch(() => setProjects([]));
      return;
    }
    dprPlanningApi.getProposal(linkedProposalId)
      .then((res) => {
        const p = res.data as { title?: string; proposalNo?: string };
        const title = p.title?.trim() ?? '';
        const proposalNo = p.proposalNo?.trim() ?? '';
        setLinkedProposal(title || proposalNo ? { title, proposalNo } : null);
        if (title) {
          setForm((f) => ({ ...f, title: f.title.trim() ? f.title : title }));
        }
      })
      .catch(() => setLinkedProposal(null));
  }, [linkedProposalId]);

  useEffect(() => {
    if (authLoading) return;
    if (createFor && canCreateLaCase) setCreateOpen(true);
    if (prefilledTitle) {
      setForm((f) => ({ ...f, title: prefilledTitle }));
    }
  }, [createFor, prefilledTitle, canCreateLaCase, authLoading]);

  const divisionScopeKey = useDivisionScopeKey();

  const load = useCallback(() => {
    setBusy(true);
    setError('');
    Promise.allSettled([landAcquisitionApi.dashboard(), landAcquisitionApi.listCases(), landAcquisitionApi.aiAlerts()])
      .then((results) => {
        const [dashRes, listRes, alertsRes] = results;
        const failures = results
          .map((r, i) => (r.status === 'rejected' ? ['dashboard', 'cases', 'alerts'][i] : null))
          .filter(Boolean);
        if (failures.length === results.length) {
          const firstErr = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
          throw firstErr.reason;
        }
        if (dashRes.status === 'fulfilled') {
          const dash = (dashRes.value.data ?? {}) as Record<string, unknown>;
          setDashboard(dash);
          setGis((dash.gis ?? {}) as LaGisDashboardData);
        }
        if (listRes.status === 'fulfilled') {
          setRows(listRes.value.data ?? []);
        }
        if (alertsRes.status === 'fulfilled') {
          setAiAlerts((alertsRes.value.data ?? null) as LaAiAlertsBundle | null);
        }
      })
      .catch((err) => setError(getApiError(err, 'Failed to load land acquisition cases')))
      .finally(() => setBusy(false));
  }, [divisionScopeKey]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = () => {
    if (!form.title.trim()) {
      setError('Case title is required');
      return;
    }
    const manualProposalId = normalizeOptionalUuid(form.dprProposalId.trim());
    const proposalId = linkedProposalId ?? manualProposalId;
    setBusy(true);
    setError('');
    landAcquisitionApi.createCase({
      title: form.title.trim(),
      schemeType: form.schemeType,
      ...(proposalId ? { dprProposalId: proposalId } : {}),
      ...(!proposalId && form.projectId ? { projectId: form.projectId } : {}),
    })
      .then((res) => {
        const created = res.data as CaseRow;
        setCreateOpen(false);
        const params = proposalId ? '?workspaceLinked=1' : '';
        navigate(`/land-acquisition/${created.id}${params}`);
      })
      .catch((err) => setError(getApiError(err, 'Failed to create LA case')))
      .finally(() => setBusy(false));
  };

  return (
    <PageShell>
      <PageHeader
        title="Land Acquisition Management"
        subtitle="GIS-integrated parcel identification, clearances, compensation, and possession tracking for water supply schemes"
        leading={<LandscapeOutlinedIcon color="primary" sx={{ fontSize: 32, mt: 0.5 }} />}
        actions={canCreateLaCase ? (
          <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={() => setCreateOpen(true)}>
            New LA Case
          </Button>
        ) : undefined}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {!authLoading && createFor && !canCreateLaCase && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {isSuperAdmin(user?.roles)
            ? SUPER_ADMIN_VIEW_ONLY_MESSAGE
            : 'You do not have permission to create land acquisition cases. Log in as an EE or division engineer (e.g. ee.kpg@egip.local) with la_case:create access.'}
        </Alert>
      )}

      <SurfaceCard title="GIS Dashboard — Land Acquisition Overview" sx={{ mb: 2.5 }}>
        <LaGisDashboardPanel data={gis} title="" />
      </SurfaceCard>

      <SurfaceCard title="AI Alerts — Land Acquisition" sx={{ mb: 2.5 }}>
        <LaAiAlertsPanel data={aiAlerts} showCaseRef />
      </SurfaceCard>

      <Grid container spacing={2} mb={2.5}>
        <Grid item xs={6} sm={3}><KpiStatCard label="Total Cases" value={Number(dashboard.total ?? 0)} /></Grid>
        <Grid item xs={6} sm={3}><KpiStatCard label="In Progress" value={Number(dashboard.inProgress ?? 0)} /></Grid>
        <Grid item xs={6} sm={3}><KpiStatCard label="Possession Complete" value={Number(dashboard.possessionComplete ?? 0)} /></Grid>
        <Grid item xs={6} sm={3}>
          <KpiStatCard
            label="Est. Compensation"
            value={gis.totalCompensationInr != null
              ? `₹ ${Number(gis.totalCompensationInr).toLocaleString('en-IN')}`
              : '—'}
          />
        </Grid>
      </Grid>

      <SurfaceCard title="Acquisition Cases">
        <TableContainer>
          <Table size="small" sx={dataTableSx()}>
            <TableHead>
              <TableRow>
                <TableCell>Case No.</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Scheme</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Parcels</TableCell>
                <TableCell align="right">Area (m²)</TableCell>
                <TableCell align="right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell>{row.caseNo}</TableCell>
                  <TableCell>{row.title}</TableCell>
                  <TableCell>{row.schemeType}</TableCell>
                  <TableCell>
                    <Chip size="small" color={laStatusColor(row.status)} label={row.statusLabel ?? laStatusLabel(row.status)} />
                  </TableCell>
                  <TableCell align="right">{row.totalParcels}</TableCell>
                  <TableCell align="right">{Number(row.totalAreaSqm ?? 0).toLocaleString('en-IN')}</TableCell>
                  <TableCell align="right">
                    <Button size="small" component={RouterLink} to={`/land-acquisition/${row.id}`}
                      startIcon={<OpenInNewOutlinedIcon />}>
                      Open
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!rows.length && !busy && (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography variant="body2" color="text.secondary" py={3}>
                      No land acquisition cases yet. Create one from a DPR proposal or start a new case.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </SurfaceCard>

      <Dialog open={createOpen && canCreateLaCase} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="h6" gutterBottom>New Land Acquisition Case</Typography>
          {linkedProposalId ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Creating LA from DPR proposal
                {linkedProposal?.proposalNo ? ` ${linkedProposal.proposalNo}` : ''}
              </Typography>
              <Typography variant="body2">
                A DPR GIS workspace will be created and linked automatically. LA layers are scaffolded so you can
                import pipeline SHP and run Auto Trace without a full feature catalog.
              </Typography>
              {(linkedProposal?.title || prefilledTitle) && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                  Scheme: {linkedProposal?.title || prefilledTitle}
                </Typography>
              )}
            </Alert>
          ) : createFor ? (
            <Alert severity="warning" sx={{ mb: 2 }}>
              The DPR link in the URL is not a valid proposal UUID. You can still create a standalone LA case.
            </Alert>
          ) : null}
          <TextField fullWidth size="small" label="Case Title" required sx={{ mb: 2, mt: 1 }}
            value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <TextField select fullWidth size="small" label="Scheme Type" sx={{ mb: 2 }}
            value={form.schemeType} onChange={(e) => setForm({ ...form, schemeType: e.target.value })}>
            <MenuItem value="gravity">Gravity Water Supply</MenuItem>
            <MenuItem value="pumping">Pumping Water Supply</MenuItem>
            <MenuItem value="sewer">Sewerage Project</MenuItem>
            <MenuItem value="transmission">Transmission Main</MenuItem>
            <MenuItem value="distribution">Distribution Network</MenuItem>
            <MenuItem value="combined">Combined Infrastructure</MenuItem>
          </TextField>
          {!linkedProposalId && (
            <>
              <TextField select fullWidth size="small" label="Link GIS Project (recommended)" sx={{ mb: 2 }}
                value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}
                helperText="Required for auto-routing, parcel identification, and GIS overlay analysis">
                <MenuItem value="">None — link later in case workspace</MenuItem>
                {projects.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name}{p.code ? ` (${p.code})` : ''}
                  </MenuItem>
                ))}
              </TextField>
              <TextField fullWidth size="small" label="Link DPR Proposal ID (optional)" sx={{ mb: 1 }}
                value={form.dprProposalId} onChange={(e) => setForm({ ...form, dprProposalId: e.target.value })}
                placeholder="e.g. d1000000-0000-0000-0000-000000000003"
                helperText="Paste the DPR proposal UUID from DPR Planning, or leave blank for a standalone case" />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={busy}>Create Case</Button>
        </DialogActions>
      </Dialog>
    </PageShell>
  );
}
