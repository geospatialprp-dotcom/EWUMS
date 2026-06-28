import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Chip, Grid, LinearProgress, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Typography,
} from '@mui/material';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import axios from 'axios';
import { omApi } from '../../services/api';
import SurfaceCard from '../layout/SurfaceCard';
import KpiStatCard from '../layout/KpiStatCard';
import { dataTableSx } from '../../utils/pagePresentationStyles';

type AnalyticsData = {
  generatedAt?: string;
  totalSessions?: number;
  sessionsToday?: number;
  escalatedSessions?: number;
  escalationRate?: number;
  totalMessages?: number;
  avgMessagesPerSession?: number;
  ragReplies?: number;
  aiAccuracyEstimate?: number | null;
  llmEnabled?: boolean;
  languageBreakdown?: Array<{ language: string; sessions: number }>;
  channelBreakdown?: Array<{ channel: string; sessions: number }>;
  topIntents?: Array<{ intent: string; count: number }>;
};

const LANG_COLORS = ['#0284c7', '#16a34a', '#d97706', '#7c3aed', '#dc2626'];

function getApiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg)) return msg.join(', ');
  }
  return fallback;
}

export default function OmJalMitraAnalyticsStage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: res } = await omApi.jalMitraAnalytics();
      setData(res);
    } catch (err) {
      setError(getApiError(err, 'Could not load Jal Mitra analytics'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const langChart = (data?.languageBreakdown ?? []).map((r) => ({
    name: r.language,
    value: r.sessions,
  }));

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box display="flex" alignItems="center" gap={1}>
          <SmartToyOutlinedIcon color="primary" />
          <Typography variant="subtitle1" fontWeight={800}>Jal Mitra — Consumer AI Analytics</Typography>
          {data?.llmEnabled && <Chip size="small" color="success" label="LLM live" />}
          {!data?.llmEnabled && <Chip size="small" label="RAG templates" variant="outlined" />}
        </Box>
        <Chip
          icon={<RefreshOutlinedIcon />}
          label="Refresh"
          onClick={load}
          clickable
          disabled={loading}
        />
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={2} mb={2}>
        <Grid item xs={6} md={3}>
          <KpiStatCard label="Total sessions" value={data?.totalSessions ?? '—'} accent="sky" />
        </Grid>
        <Grid item xs={6} md={3}>
          <KpiStatCard label="Today" value={data?.sessionsToday ?? '—'} accent="emerald" />
        </Grid>
        <Grid item xs={6} md={3}>
          <KpiStatCard label="Escalation rate" value={data?.escalationRate != null ? `${data.escalationRate}%` : '—'} accent="amber" />
        </Grid>
        <Grid item xs={6} md={3}>
          <KpiStatCard label="RAG / AI replies" value={data?.ragReplies ?? '—'} accent="violet" />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <SurfaceCard title="Language usage">
            {langChart.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={langChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {langChart.map((_, i) => (
                      <Cell key={i} fill={LANG_COLORS[i % LANG_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Typography variant="body2" color="text.secondary">No sessions yet.</Typography>
            )}
          </SurfaceCard>
        </Grid>

        <Grid item xs={12} md={6}>
          <SurfaceCard title="Top intents">
            {(data?.topIntents ?? []).length ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data?.topIntents ?? []} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="intent" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0284c7" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Typography variant="body2" color="text.secondary">No intent data yet.</Typography>
            )}
          </SurfaceCard>
        </Grid>

        <Grid item xs={12}>
          <SurfaceCard title="Channel breakdown">
            <TableContainer>
              <Table size="small" sx={dataTableSx}>
                <TableHead>
                  <TableRow>
                    <TableCell>Channel</TableCell>
                    <TableCell align="right">Sessions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(data?.channelBreakdown ?? []).map((r) => (
                    <TableRow key={r.channel}>
                      <TableCell>{r.channel}</TableCell>
                      <TableCell align="right">{r.sessions}</TableCell>
                    </TableRow>
                  ))}
                  {!data?.channelBreakdown?.length && (
                    <TableRow>
                      <TableCell colSpan={2}>
                        <Typography variant="body2" color="text.secondary">No channel data yet.</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </SurfaceCard>
        </Grid>
      </Grid>

      {data?.generatedAt && (
        <Typography variant="caption" color="text.secondary" display="block" mt={2}>
          Generated {new Date(data.generatedAt).toLocaleString()}
          {data.avgMessagesPerSession != null && ` · Avg ${data.avgMessagesPerSession} messages/session`}
        </Typography>
      )}
    </Box>
  );
}
