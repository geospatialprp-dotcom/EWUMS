import { useEffect, useState } from 'react';
import {
  Box, Chip, Grid, Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import WarningIcon from '@mui/icons-material/Warning';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { dashboardApi } from '../services/api';
import { useDivisionScope, useDivisionScopeKey } from '../context/DivisionContext';
import { useAuth } from '../context/AuthContext';
import { divisionScopeSubtitle } from '../utils/divisionAccess';
import PageShell from '../components/layout/PageShell';
import PageHeader from '../components/layout/PageHeader';
import KpiStatCard from '../components/layout/KpiStatCard';
import SurfaceCard from '../components/layout/SurfaceCard';
import { dataTableSx } from '../utils/pagePresentationStyles';

interface DashboardData {
  kpis: Array<{ id: string; label: string; value: string | number; trend: string | null; status: string }>;
  criticalAssets: Array<{ id: string; asset_code: string; name: string; status: string; health_score: number; asset_type: string }>;
  recentAlerts: Array<{ id: string; severity: string; message: string; device_name: string; created_at: string }>;
  charts: {
    assetByStatus: Array<{ status: string; count: number }>;
    projectProgress: Array<{ name: string; physical_progress: number; financial_progress: number }>;
  };
}

const PIE_COLORS = ['#2563eb', '#0d9488', '#d97706', '#e11d48', '#64748b'];
const KPI_TONES = ['blue', 'teal', 'violet', 'amber', 'slate'] as const;

export default function DashboardPage() {
  const { user } = useAuth();
  const { activeDivision } = useDivisionScope();
  const divisionScopeKey = useDivisionScopeKey();
  const canViewAllDivisions = user?.canViewAllDivisions ?? false;
  const scopeSubtitle = divisionScopeSubtitle(canViewAllDivisions, activeDivision);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    setData(null);
    setLoadError('');
    dashboardApi.executive()
      .then((res) => {
        const payload = res.data;
        if (!payload || typeof payload !== 'object' || !Array.isArray((payload as DashboardData).kpis)) {
          throw new Error('Invalid dashboard response');
        }
        setData(payload as DashboardData);
      })
      .catch(() => {
        setLoadError('Could not load dashboard data. Restart the API: cd backend/api && npm run dev:mock');
      });
  }, [divisionScopeKey]);

  return (
    <PageShell fullHeight loading={!data && !loadError} loadingLabel="Loading executive dashboard…">
      {loadError && (
        <Typography color="error" sx={{ p: 2 }}>{loadError}</Typography>
      )}
      {data && (
        <>
          <PageHeader
            eyebrow="Executive Overview"
            title="Command Center"
            subtitle={scopeSubtitle}
            accent="indigo"
          />

          <Box mb={2}>
            <Chip
              component={RouterLink}
              to="/platform"
              clickable
              color="primary"
              variant="outlined"
              label="View all 20 integrated platform modules →"
            />
          </Box>

          <Grid container spacing={2} mb={3}>
            {data.kpis.map((kpi, i) => (
              <Grid item xs={12} sm={6} md={2.4} key={kpi.id}>
                <KpiStatCard
                  label={kpi.label}
                  value={kpi.value}
                  tone={KPI_TONES[i % KPI_TONES.length]}
                  footer={kpi.trend ? (
                    <Box display="flex" alignItems="center" gap={0.5} mt={0.75}>
                      {kpi.status === 'up' && <TrendingUpIcon fontSize="small" color="success" />}
                      {kpi.status === 'down' && <TrendingDownIcon fontSize="small" color="error" />}
                      {kpi.status === 'warning' && <WarningIcon fontSize="small" color="warning" />}
                      <Typography variant="caption" color="text.secondary">{kpi.trend}</Typography>
                    </Box>
                  ) : undefined}
                />
              </Grid>
            ))}
          </Grid>

          <Grid container spacing={2} mb={3}>
            <Grid item xs={12} md={6}>
              <SurfaceCard title="Project Progress">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={data.charts.projectProgress}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fill: '#64748b' }} />
                    <Tooltip />
                    <Bar dataKey="physical_progress" name="Physical %" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="financial_progress" name="Financial %" fill="#0d9488" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </SurfaceCard>
            </Grid>
            <Grid item xs={12} md={6}>
              <SurfaceCard title="Assets by Status">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={data.charts.assetByStatus}
                      dataKey="count"
                      nameKey="status"
                      cx="50%" cy="50%"
                      outerRadius={90}
                      label={({ status, count }) => `${status}: ${count}`}
                    >
                      {data.charts.assetByStatus.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </SurfaceCard>
            </Grid>
          </Grid>

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <SurfaceCard title="Critical Assets" flush>
                <Table size="small" sx={dataTableSx()}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Code</TableCell>
                      <TableCell>Name</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Health</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.criticalAssets.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>{a.asset_code}</TableCell>
                        <TableCell>{a.name}</TableCell>
                        <TableCell>{a.asset_type}</TableCell>
                        <TableCell>
                          <Chip label={`${a.health_score}%`} size="small" color="error" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </SurfaceCard>
            </Grid>
            <Grid item xs={12} md={6}>
              <SurfaceCard title="Recent IoT Alerts" flush>
                <Table size="small" sx={dataTableSx()}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Severity</TableCell>
                      <TableCell>Device</TableCell>
                      <TableCell>Message</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.recentAlerts.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          <Chip label={a.severity} size="small" color={a.severity === 'critical' ? 'error' : 'warning'} />
                        </TableCell>
                        <TableCell>{a.device_name}</TableCell>
                        <TableCell>{a.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </SurfaceCard>
            </Grid>
          </Grid>
        </>
      )}
    </PageShell>
  );
}
