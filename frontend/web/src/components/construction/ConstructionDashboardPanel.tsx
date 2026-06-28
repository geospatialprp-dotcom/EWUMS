import { useCallback, useEffect, useState } from 'react';
import {
  Box, Button, Card, CardContent, Chip, Grid, LinearProgress, Table, TableBody,
  TableCell, TableRow, Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { constructionApi } from '../../services/api';
import ConstructionTableHead from './ConstructionTableHead';
import { constructionTableShellSx } from '../../utils/constructionTableStyles';
import { formatApiError } from '../../utils/apiError';
import { STATUS_COLORS } from '../../constants/construction';

type DashboardData = Record<string, unknown>;

function formatCount(n: number) {
  return Math.round(Number(n) || 0).toLocaleString();
}

function formatQty(n: number) {
  return Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatPct(n: number) {
  return Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}

function ProgressBar({ label, value, caption }: { label: string; value: number; caption?: string }) {
  const pct = Math.min(100, Math.max(0, Number(value) || 0));
  return (
    <Box sx={{ mb: 1.5 }}>
      <Box display="flex" justifyContent="space-between" mb={0.5}>
        <Typography variant="body2">{label}</Typography>
        <Typography variant="body2" fontWeight={600}>{formatPct(pct)}%</Typography>
      </Box>
      <LinearProgress variant="determinate" value={pct} sx={{ height: 8, borderRadius: 1 }} />
      {caption && <Typography variant="caption" color="text.secondary">{caption}</Typography>}
    </Box>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent sx={{ py: 1.5 }}>
        <Typography variant="h5" fontWeight={700}>{value}</Typography>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
        {sub && <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>{sub}</Typography>}
      </CardContent>
    </Card>
  );
}

interface Props {
  projectId: string;
  onError: (msg: string) => void;
}

export default function ConstructionDashboardPanel({ projectId, onError }: Props) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const { data: dash } = await constructionApi.dashboard(projectId);
      setData(dash as DashboardData);
    } catch (err) {
      onError(formatApiError(err, 'Failed to load dashboard.'));
    } finally {
      setLoading(false);
    }
  }, [projectId, onError]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <Typography color="text.secondary">Loading real-time dashboard…</Typography>;
  if (!data) return null;

  const progress = (data.progress ?? {}) as Record<string, number>;
  const summary = (data.summary ?? {}) as Record<string, number>;
  const fhtc = (data.fhtc ?? {}) as Record<string, number>;
  const componentProgress = (data.componentProgress ?? []) as Array<Record<string, unknown>>;
  const recentDprs = (data.recentDprs ?? []) as Array<Record<string, unknown>>;
  const recentMbs = (data.recentMbs ?? []) as Array<Record<string, unknown>>;

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="subtitle1" fontWeight={700}>Stage 9: Real-Time Dashboard</Typography>
        <Button size="small" startIcon={<RefreshIcon />} onClick={() => { void load(); }}>Refresh</Button>
      </Box>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={8}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>Overall Progress</Typography>
              <ProgressBar label="Physical Progress" value={progress.physicalPct ?? 0} />
              <ProgressBar
                label="Financial Progress"
                value={progress.financialPct ?? 0}
                caption={String(progress.financialBoqSourceLabel ?? 'Original / Tender BOQ')}
              />
              <ProgressBar
                label="FHTC Achievements"
                value={progress.fhtcPct ?? 0}
                caption={`${formatQty(Number(fhtc.completed))} of ${formatQty(Number(fhtc.target))} connections measured`}
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Grid container spacing={1}>
            {[
              { label: 'Pending MBs', value: formatCount(summary.pendingMbReviews ?? summary.pendingMbs ?? 0), sub: 'In verification workflow' },
              { label: 'Pending Bills', value: formatCount(summary.pendingBills ?? summary.pendingRaBills ?? 0), sub: 'RA bills awaiting release' },
              { label: 'Pending Approvals', value: formatCount(summary.pendingApprovals ?? 0), sub: 'DPR + MB + RA combined' },
              { label: 'MB Measurements Due', value: formatQty(summary.pendingMbMeasurements ?? 0), sub: 'BOQ qty not yet in MB' },
            ].map((m) => (
              <Grid item xs={6} key={m.label}>
                <MetricCard label={m.label} value={m.value} sub={m.sub} />
              </Grid>
            ))}
          </Grid>
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {[
          { label: 'Pipeline Progress', value: progress.pipelineProgressPct ?? 0 },
          { label: 'Reservoir Progress', value: progress.reservoirProgressPct ?? 0 },
          { label: 'Pump House Progress', value: progress.pumpHouseProgressPct ?? 0 },
          { label: 'GIS Asset Mapping', value: progress.gisMappingPct ?? 0 },
        ].map((item) => (
          <Grid item xs={12} sm={6} md={3} key={item.label}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                <Typography variant="h5" fontWeight={700}>{formatPct(item.value)}%</Typography>
                <LinearProgress variant="determinate" value={Math.min(100, item.value)} sx={{ mt: 1, height: 6, borderRadius: 1 }} />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>Component-wise Progress</Typography>
              {componentProgress.map((c) => (
                <ProgressBar
                  key={String(c.component)}
                  label={String(c.label)}
                  value={Number(c.pct)}
                  caption={`${formatQty(Number(c.executedQty))} / ${formatQty(Number(c.contractQty))} qty`}
                />
              ))}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>Recent DPRs</Typography>
              <Table size="small" sx={constructionTableShellSx('dpr')}>
                <ConstructionTableHead
                  stage="dpr"
                  columns={[
                    { label: 'DPR #' },
                    { label: 'Date' },
                    { label: 'Status' },
                  ]}
                />
                <TableBody>
                  {recentDprs.length === 0 && (
                    <TableRow><TableCell colSpan={3}><Typography variant="caption" color="text.secondary">No DPRs yet</Typography></TableCell></TableRow>
                  )}
                  {recentDprs.map((d) => (
                    <TableRow key={String(d.id)}>
                      <TableCell>{String(d.dprNumber)}</TableCell>
                      <TableCell>{String(d.reportDate ?? '').slice(0, 10)}</TableCell>
                      <TableCell>
                        <Chip size="small" label={String(d.status)} color={STATUS_COLORS[String(d.status)] ?? 'default'} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>Recent Measurement Books</Typography>
              <Table size="small" sx={constructionTableShellSx('mb')}>
                <ConstructionTableHead
                  stage="mb"
                  columns={[
                    { label: 'MB #' },
                    { label: 'Date' },
                    { label: 'Status' },
                  ]}
                />
                <TableBody>
                  {recentMbs.length === 0 && (
                    <TableRow><TableCell colSpan={3}><Typography variant="caption" color="text.secondary">No MBs yet</Typography></TableCell></TableRow>
                  )}
                  {recentMbs.map((m) => (
                    <TableRow key={String(m.id)}>
                      <TableCell>{String(m.mbNumber)}</TableCell>
                      <TableCell>{String(m.measurementDate ?? '').slice(0, 10)}</TableCell>
                      <TableCell>
                        <Chip size="small" label={String(m.status)} color={STATUS_COLORS[String(m.status)] ?? 'default'} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
