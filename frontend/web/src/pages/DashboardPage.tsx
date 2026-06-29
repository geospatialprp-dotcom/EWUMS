import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Grid,
  LinearProgress,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import AssignmentIcon from '@mui/icons-material/Assignment';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import MonetizationOnOutlinedIcon from '@mui/icons-material/MonetizationOnOutlined';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import DashboardCustomizeOutlinedIcon from '@mui/icons-material/DashboardCustomizeOutlined';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import WaterDropOutlinedIcon from '@mui/icons-material/WaterDropOutlined';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { dashboardApi } from '../services/api';
import { formatApiError } from '../utils/apiError';
import { useDivisionScope, useDivisionScopeKey } from '../context/DivisionContext';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { divisionScopeSubtitle } from '../utils/divisionAccess';
import PageShell from '../components/layout/PageShell';
import KpiStatCard from '../components/layout/KpiStatCard';
import SurfaceCard from '../components/layout/SurfaceCard';
import { dataTableSx, type KpiTone } from '../utils/pagePresentationStyles';

interface KpiItem {
  id: string;
  label: string;
  value: string | number;
  trend: string | null;
  status: string;
}

interface DivisionSummary {
  id: string;
  code: string;
  name: string;
  project_count: number;
  avg_progress: number;
  asset_count: number;
  open_complaints: number;
  collection_pct: number | null;
}

interface SchemeSummary {
  id: string;
  project_code: string;
  name: string;
  status: string;
  physical_progress: number;
  financial_progress: number;
  asset_count: number;
}

interface ActivityItem {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  created_at: string;
  severity?: string;
}

interface PendingTask {
  id: string;
  title: string;
  step_name: string;
  assigned_role: string;
  created_at: string;
}

interface DashboardData {
  scope: 'statewide' | 'division';
  kpis: KpiItem[];
  divisionSummaries: DivisionSummary[] | null;
  schemeSummaries: SchemeSummary[] | null;
  criticalAssets: Array<{ id: string; asset_code: string; name: string; status: string; health_score: number; asset_type: string }>;
  recentAlerts: Array<{ id: string; severity: string; message: string; device_name: string; created_at: string }>;
  recentActivity: ActivityItem[];
  pendingTasks: PendingTask[];
  charts: {
    assetByStatus: Array<{ status: string; count: number }>;
    projectProgress: Array<{ name: string; physical_progress: number; financial_progress: number }>;
    projectStatus: Array<{ status: string; count: number }>;
    collectionTrend: Array<{ month: string; collection: number }>;
  };
}

const PIE_COLORS = ['#2563eb', '#f97316', '#0d9488', '#7c3aed', '#64748b', '#e11d48'];
const KPI_CONFIG: Record<string, { tone: KpiTone; icon: React.ReactNode }> = {
  active_projects: { tone: 'blue', icon: <AssignmentIcon sx={{ color: '#2563eb', opacity: 0.85 }} /> },
  total_assets: { tone: 'teal', icon: <Inventory2OutlinedIcon sx={{ color: '#0d9488', opacity: 0.85 }} /> },
  pending_approvals: { tone: 'amber', icon: <PendingActionsIcon sx={{ color: '#d97706', opacity: 0.85 }} /> },
  collection: { tone: 'violet', icon: <MonetizationOnOutlinedIcon sx={{ color: '#7c3aed', opacity: 0.85 }} /> },
  open_complaints: { tone: 'rose', icon: <ReportProblemOutlinedIcon sx={{ color: '#e11d48', opacity: 0.85 }} /> },
};

const QUICK_ACTION_KEYS = [
  { labelKey: 'commandCenter.quickActions.map', to: '/map', icon: <MapOutlinedIcon fontSize="small" /> },
  { labelKey: 'commandCenter.quickActions.workflows', to: '/workflows', icon: <InboxOutlinedIcon fontSize="small" /> },
  { labelKey: 'commandCenter.quickActions.billing', to: '/billing', icon: <ReceiptLongOutlinedIcon fontSize="small" /> },
  { labelKey: 'commandCenter.quickActions.audit', to: '/admin/audit', icon: <HistoryOutlinedIcon fontSize="small" /> },
] as const;

function greetingKeyForHour(hour: number): string {
  if (hour < 12) return 'commandCenter.greetingMorning';
  if (hour < 17) return 'commandCenter.greetingAfternoon';
  return 'commandCenter.greetingEvening';
}

function formatRelativeTime(iso: string, t: (key: string, params?: Record<string, string | number>) => string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('commandCenter.time.justNow');
  if (mins < 60) return t('commandCenter.time.minutesAgo', { mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('commandCenter.time.hoursAgo', { hrs });
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function formatInrCompact(value: number): string {
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(0)}K`;
  return `₹${value}`;
}

function KpiTrendFooter({ kpi }: { kpi: KpiItem }) {
  if (!kpi.trend) return null;
  return (
    <Box display="flex" alignItems="center" gap={0.5} mt={0.75}>
      {kpi.status === 'up' && <TrendingUpIcon fontSize="small" sx={{ color: '#16a34a' }} />}
      {kpi.status === 'down' && <TrendingDownIcon fontSize="small" sx={{ color: '#dc2626' }} />}
      {(kpi.status === 'warning' || kpi.status === 'neutral') && (
        <WarningAmberIcon fontSize="small" sx={{ color: kpi.status === 'warning' ? '#d97706' : '#64748b' }} />
      )}
      <Typography variant="caption" color="text.secondary">{kpi.trend}</Typography>
    </Box>
  );
}

function DashboardSkeleton() {
  return (
    <Box>
      <Skeleton variant="rounded" height={120} sx={{ mb: 3, borderRadius: 3 }} />
      <Grid container spacing={2} mb={3}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Grid item xs={12} sm={6} md={2.4} key={i}>
            <Skeleton variant="rounded" height={110} sx={{ borderRadius: 2 }} />
          </Grid>
        ))}
      </Grid>
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} md={8}>
          <Skeleton variant="rounded" height={280} sx={{ borderRadius: 2.5 }} />
        </Grid>
        <Grid item xs={12} md={4}>
          <Skeleton variant="rounded" height={280} sx={{ borderRadius: 2.5 }} />
        </Grid>
      </Grid>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Skeleton variant="rounded" height={240} sx={{ borderRadius: 2.5 }} />
        </Grid>
        <Grid item xs={12} md={6}>
          <Skeleton variant="rounded" height={240} sx={{ borderRadius: 2.5 }} />
        </Grid>
      </Grid>
    </Box>
  );
}

function CommandCenterHero({
  greeting,
  userName,
  divisionLabel,
  dateLabel,
  eyebrow,
  modulesChip,
}: {
  greeting: string;
  userName: string;
  divisionLabel: string;
  dateLabel: string;
  eyebrow: string;
  modulesChip: string;
}) {
  return (
    <Box
      sx={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 45%, #334155 100%)',
        borderRadius: 3,
        p: { xs: 2, sm: 2.5, md: 3 },
        mb: 3,
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 12px 40px rgba(15, 23, 42, 0.25)',
        '&::after': {
          content: '""',
          position: 'absolute',
          top: -40,
          right: -20,
          width: 180,
          height: 180,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(249,115,22,0.35) 0%, transparent 70%)',
          pointerEvents: 'none',
        },
      }}
    >
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={2} position="relative" zIndex={1}>
        <Box>
          <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
            <DashboardCustomizeOutlinedIcon sx={{ color: '#f97316', fontSize: 20 }} />
            <Typography variant="overline" sx={{ color: '#94a3b8', letterSpacing: '0.14em', fontWeight: 700 }}>
              {eyebrow}
            </Typography>
          </Stack>
          <Typography variant="h4" sx={{ color: '#f8fafc', fontWeight: 800, letterSpacing: '-0.02em', fontSize: { xs: '1.35rem', md: '1.75rem' } }}>
            {greeting}, {userName}
          </Typography>
          <Typography variant="body2" sx={{ color: '#cbd5e1', mt: 0.75 }}>
            {divisionLabel}
          </Typography>
        </Box>
        <Box textAlign={{ xs: 'left', sm: 'right' }}>
          <Typography variant="body2" sx={{ color: '#f97316', fontWeight: 700 }}>
            {dateLabel}
          </Typography>
          <Chip
            component={RouterLink}
            to="/platform"
            clickable
            size="small"
            label={modulesChip}
            sx={{
              mt: 1,
              bgcolor: 'rgba(249,115,22,0.15)',
              color: '#fdba74',
              border: '1px solid rgba(249,115,22,0.35)',
              '&:hover': { bgcolor: 'rgba(249,115,22,0.25)' },
            }}
          />
        </Box>
      </Box>
    </Box>
  );
}

function DivisionSummaryCard({ division }: { division: DivisionSummary }) {
  const { t } = useTranslation();
  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        border: '1px solid #e2e8f0',
        bgcolor: '#ffffff',
        height: '100%',
        transition: 'box-shadow 0.15s ease, transform 0.15s ease',
        '&:hover': { boxShadow: '0 8px 24px rgba(15,23,42,0.08)', transform: 'translateY(-2px)' },
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} mb={1}>
        <BusinessOutlinedIcon sx={{ color: '#2563eb', fontSize: 18 }} />
        <Typography variant="subtitle2" fontWeight={700} color="#0f172a" noWrap>
          {division.name}
        </Typography>
      </Stack>
      <Chip label={division.code} size="small" variant="outlined" sx={{ mb: 1.5, fontSize: '0.65rem' }} />
      <Grid container spacing={1}>
        <Grid item xs={6}>
          <Typography variant="caption" color="text.secondary">{t('commandCenter.schemes')}</Typography>
          <Typography variant="body2" fontWeight={700}>{division.project_count}</Typography>
        </Grid>
        <Grid item xs={6}>
          <Typography variant="caption" color="text.secondary">{t('commandCenter.progress')}</Typography>
          <Typography variant="body2" fontWeight={700}>{division.avg_progress}%</Typography>
        </Grid>
        <Grid item xs={6}>
          <Typography variant="caption" color="text.secondary">{t('commandCenter.assets')}</Typography>
          <Typography variant="body2" fontWeight={700}>{division.asset_count}</Typography>
        </Grid>
        <Grid item xs={6}>
          <Typography variant="caption" color="text.secondary">{t('commandCenter.collection')}</Typography>
          <Typography variant="body2" fontWeight={700} color={division.collection_pct != null && division.collection_pct >= 90 ? '#16a34a' : '#334155'}>
            {division.collection_pct != null ? `${division.collection_pct}%` : '—'}
          </Typography>
        </Grid>
      </Grid>
      {division.open_complaints > 0 && (
        <Chip
          label={t(
            division.open_complaints > 1 ? 'commandCenter.openComplaintsMany' : 'commandCenter.openComplaintsOne',
            { count: division.open_complaints },
          )}
          size="small"
          color="warning"
          sx={{ mt: 1.5, fontSize: '0.65rem' }}
        />
      )}
    </Box>
  );
}

function SchemeSummaryCard({ scheme }: { scheme: SchemeSummary }) {
  const { t } = useTranslation();
  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        border: '1px solid #e2e8f0',
        bgcolor: '#ffffff',
        height: '100%',
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
        <WaterDropOutlinedIcon sx={{ color: '#0d9488', fontSize: 18 }} />
        <Typography variant="subtitle2" fontWeight={700} color="#0f172a" noWrap title={scheme.name}>
          {scheme.name}
        </Typography>
      </Stack>
      <Chip label={scheme.project_code} size="small" variant="outlined" sx={{ mb: 1.5, fontSize: '0.65rem' }} />
      <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
        {t('commandCenter.physicalProgress')}
      </Typography>
      <LinearProgress
        variant="determinate"
        value={scheme.physical_progress}
        sx={{
          height: 8,
          borderRadius: 4,
          mb: 1,
          bgcolor: '#e2e8f0',
          '& .MuiLinearProgress-bar': { bgcolor: '#2563eb', borderRadius: 4 },
        }}
      />
      <Box display="flex" justifyContent="space-between">
        <Typography variant="caption" color="text.secondary">
          {t('commandCenter.physicalPct', { pct: scheme.physical_progress })}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t('commandCenter.assetCount', { count: scheme.asset_count })}
        </Typography>
      </Box>
    </Box>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { t, locale } = useTranslation();
  const { activeDivision } = useDivisionScope();
  const divisionScopeKey = useDivisionScopeKey();
  const canViewAllDivisions = user?.canViewAllDivisions ?? false;
  const scopeSubtitle = divisionScopeSubtitle(canViewAllDivisions, activeDivision);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);

  const now = useMemo(() => new Date(), []);
  const greeting = t(greetingKeyForHour(now.getHours()));
  const dateLocale = locale === 'hi' ? 'hi-IN' : 'en-IN';
  const dateLabel = now.toLocaleDateString(dateLocale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const userName = user?.firstName ?? t('commandCenter.defaultOfficer');
  const divisionLabel = scopeSubtitle
    ?? activeDivision?.name
    ?? user?.divisionName
    ?? t('commandCenter.defaultDivisionLabel');
  const noDataLabel = t('commandCenter.charts.noData');

  useEffect(() => {
    setData(null);
    setLoadError('');
    setLoading(true);
    dashboardApi.executive()
      .then((res) => {
        const payload = res.data;
        if (!payload || typeof payload !== 'object' || !Array.isArray((payload as DashboardData).kpis)) {
          throw new Error('Invalid dashboard response');
        }
        setData(payload as DashboardData);
      })
      .catch((err) => {
        setLoadError(formatApiError(err, t('commandCenter.loadError')));
      })
      .finally(() => setLoading(false));
  }, [divisionScopeKey, t]);

  return (
    <PageShell fullHeight>
      {loading && <DashboardSkeleton />}

      {!loading && loadError && (
        <Alert
          severity="warning"
          sx={{ mb: 2, borderRadius: 2 }}
          action={(
            <Button color="inherit" size="small" onClick={() => window.location.reload()}>
              {t('commandCenter.retry')}
            </Button>
          )}
        >
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>
            {t('commandCenter.unavailable')}
          </Typography>
          {loadError}
        </Alert>
      )}

      {!loading && data && (
        <>
          <CommandCenterHero
            greeting={greeting}
            userName={userName}
            divisionLabel={divisionLabel}
            dateLabel={dateLabel}
            eyebrow={t('commandCenter.eyebrow')}
            modulesChip={t('commandCenter.modulesChip')}
          />

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 3 }}>
            {QUICK_ACTION_KEYS.map((action) => (
              <Button
                key={action.to}
                component={RouterLink}
                to={action.to}
                variant="outlined"
                size="small"
                startIcon={action.icon}
                sx={{
                  borderColor: '#cbd5e1',
                  color: '#334155',
                  bgcolor: '#ffffff',
                  fontWeight: 600,
                  textTransform: 'none',
                  '&:hover': { borderColor: '#f97316', color: '#0f172a', bgcolor: '#fff7ed' },
                }}
              >
                {t(action.labelKey)}
              </Button>
            ))}
          </Stack>

          <Grid container spacing={2} mb={3}>
            {data.kpis.map((kpi) => {
              const cfg = KPI_CONFIG[kpi.id] ?? { tone: 'blue' as KpiTone, icon: null };
              const labelKey = `commandCenter.kpi.${kpi.id}` as const;
              const label = t(labelKey) !== labelKey ? t(labelKey) : kpi.label;
              return (
                <Grid item xs={12} sm={6} md={2.4} key={kpi.id}>
                  <KpiStatCard
                    label={label}
                    value={kpi.value}
                    tone={cfg.tone}
                    icon={cfg.icon}
                    footer={<KpiTrendFooter kpi={kpi} />}
                  />
                </Grid>
              );
            })}
          </Grid>

          {data.divisionSummaries && data.divisionSummaries.length > 0 && (
            <Box mb={3}>
              <Typography sx={{ fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.75rem', mb: 1.5 }}>
                {t('commandCenter.divisionOverview')}
              </Typography>
              <Grid container spacing={2}>
                {data.divisionSummaries.map((d) => (
                  <Grid item xs={12} sm={6} md={4} lg={2.4} key={d.id}>
                    <DivisionSummaryCard division={d} />
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          {data.schemeSummaries && data.schemeSummaries.length > 0 && (
            <Box mb={3}>
              <Typography sx={{ fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.75rem', mb: 1.5 }}>
                {t('commandCenter.schemeSummary')}
              </Typography>
              <Grid container spacing={2}>
                {data.schemeSummaries.map((s) => (
                  <Grid item xs={12} sm={6} md={4} key={s.id}>
                    <SchemeSummaryCard scheme={s} />
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          <Grid container spacing={2} mb={3}>
            <Grid item xs={12} md={4}>
              <SurfaceCard title={t('commandCenter.charts.projectStatus')} darkHeader>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={data.charts.projectStatus.length ? data.charts.projectStatus : [{ status: noDataLabel, count: 1 }]}
                      dataKey="count"
                      nameKey="status"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={85}
                      paddingAngle={2}
                    >
                      {(data.charts.projectStatus.length ? data.charts.projectStatus : [{ status: noDataLabel, count: 1 }]).map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </SurfaceCard>
            </Grid>
            <Grid item xs={12} md={4}>
              <SurfaceCard title={t('commandCenter.charts.assetsByStatus')} darkHeader>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={data.charts.assetByStatus.length ? data.charts.assetByStatus : [{ status: noDataLabel, count: 1 }]}
                      dataKey="count"
                      nameKey="status"
                      cx="50%"
                      cy="50%"
                      outerRadius={85}
                      label={({ status, count }) => `${status}: ${count}`}
                    >
                      {(data.charts.assetByStatus.length ? data.charts.assetByStatus : [{ status: noDataLabel, count: 1 }]).map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </SurfaceCard>
            </Grid>
            <Grid item xs={12} md={4}>
              <SurfaceCard title={t('commandCenter.charts.collectionTrend')} darkHeader>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={data.charts.collectionTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => formatInrCompact(v)} />
                    <Tooltip formatter={(v: number) => formatInrCompact(v)} />
                    <Line type="monotone" dataKey="collection" name={t('commandCenter.charts.collection')} stroke="#f97316" strokeWidth={2.5} dot={{ fill: '#f97316', r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </SurfaceCard>
            </Grid>
          </Grid>

          <Grid container spacing={2} mb={3}>
            <Grid item xs={12} md={8}>
              <SurfaceCard title={t('commandCenter.charts.projectProgress')}>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={data.charts.projectProgress.length ? data.charts.projectProgress : [{ name: '—', physical_progress: 0, financial_progress: 0 }]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} interval={0} angle={-12} textAnchor="end" height={60} />
                    <YAxis tick={{ fill: '#64748b' }} domain={[0, 100]} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="physical_progress" name={t('commandCenter.charts.physical')} fill="#2563eb" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="financial_progress" name={t('commandCenter.charts.financial')} fill="#0d9488" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </SurfaceCard>
            </Grid>
            <Grid item xs={12} md={4}>
              <SurfaceCard title={t('commandCenter.pendingTasks')} flush contentSx={{ p: 0 }}>
                {data.pendingTasks.length === 0 ? (
                  <Box p={2.5}>
                    <Typography variant="body2" color="text.secondary">{t('commandCenter.noPendingTasks')}</Typography>
                  </Box>
                ) : (
                  <Stack divider={<Box sx={{ borderBottom: '1px solid #e2e8f0' }} />}>
                    {data.pendingTasks.map((task) => (
                      <Box key={task.id} px={2} py={1.25}>
                        <Typography variant="body2" fontWeight={600} noWrap title={task.title}>
                          {task.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {task.step_name} · {task.assigned_role.toUpperCase()} · {formatRelativeTime(task.created_at, t)}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                )}
                <Box px={2} py={1.5} bgcolor="#f8fafc" borderTop="1px solid #e2e8f0">
                  <Button component={RouterLink} to="/workflows" size="small" sx={{ textTransform: 'none', fontWeight: 600 }}>
                    {t('commandCenter.openWorkflowInbox')}
                  </Button>
                </Box>
              </SurfaceCard>
            </Grid>
          </Grid>

          <SurfaceCard title={t('commandCenter.recentActivity')} flush contentSx={{ p: 0 }} cardSx={{ mb: 3 }}>
            {data.recentActivity.length === 0 ? (
              <Box p={2.5}>
                <Typography variant="body2" color="text.secondary">{t('commandCenter.noRecentActivity')}</Typography>
              </Box>
            ) : (
              <Stack direction="row" sx={{ overflowX: 'auto', p: 1.5, gap: 1.5 }}>
                {data.recentActivity.map((item) => (
                  <Box
                    key={item.id}
                    sx={{
                      minWidth: 220,
                      maxWidth: 280,
                      p: 1.5,
                      borderRadius: 2,
                      border: '1px solid #e2e8f0',
                      bgcolor: item.type === 'alert' ? '#fff7ed' : '#f8fafc',
                      flexShrink: 0,
                    }}
                  >
                    <Chip
                      label={item.type === 'alert' ? item.severity ?? 'alert' : item.subtitle}
                      size="small"
                      color={item.severity === 'critical' ? 'error' : item.type === 'alert' ? 'warning' : 'default'}
                      sx={{ mb: 0.75, fontSize: '0.65rem', textTransform: 'capitalize' }}
                    />
                    <Typography variant="body2" fontWeight={600} sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {item.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">{formatRelativeTime(item.created_at, t)}</Typography>
                  </Box>
                ))}
              </Stack>
            )}
          </SurfaceCard>

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <SurfaceCard title={t('commandCenter.criticalAssets')} flush>
                {data.criticalAssets.length === 0 ? (
                  <Box p={2.5}>
                    <Typography variant="body2" color="text.secondary">{t('commandCenter.noCriticalAssets')}</Typography>
                  </Box>
                ) : (
                  <Table size="small" sx={dataTableSx()}>
                    <TableHead>
                      <TableRow>
                        <TableCell>{t('commandCenter.table.code')}</TableCell>
                        <TableCell>{t('commandCenter.table.name')}</TableCell>
                        <TableCell>{t('commandCenter.table.type')}</TableCell>
                        <TableCell>{t('commandCenter.table.health')}</TableCell>
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
                )}
              </SurfaceCard>
            </Grid>
            <Grid item xs={12} md={6}>
              <SurfaceCard title={t('commandCenter.iotAlerts')} flush>
                {data.recentAlerts.length === 0 ? (
                  <Box p={2.5}>
                    <Typography variant="body2" color="text.secondary">{t('commandCenter.noIotAlerts')}</Typography>
                  </Box>
                ) : (
                  <Table size="small" sx={dataTableSx()}>
                    <TableHead>
                      <TableRow>
                        <TableCell>{t('commandCenter.table.severity')}</TableCell>
                        <TableCell>{t('commandCenter.table.device')}</TableCell>
                        <TableCell>{t('commandCenter.table.message')}</TableCell>
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
                )}
              </SurfaceCard>
            </Grid>
          </Grid>
        </>
      )}
    </PageShell>
  );
}
