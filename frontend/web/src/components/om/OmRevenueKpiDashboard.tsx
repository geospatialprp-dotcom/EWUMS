import { Box, Chip, Grid, LinearProgress, Typography } from '@mui/material';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import SurfaceCard from '../layout/SurfaceCard';
import KpiStatCard from '../layout/KpiStatCard';
import {
  OM_NRW_EFFICIENCY_THRESHOLD_PCT,
  OM_REVENUE_KPI_DEFINITIONS,
  OM_REVENUE_KPI_GROUPS,
  formatInr,
  formatRevenueKpiValue,
  nrwStatusColor,
} from '../../constants/omBilling';
import type { KpiTone } from '../../utils/pagePresentationStyles';
import { BillingKpiGroupLabel } from './billingUi';

type Props = {
  summary: Record<string, unknown>;
  projectCode?: string | null;
};

export default function OmRevenueKpiDashboard({ summary, projectCode }: Props) {
  const omCostVsRevenue = summary.omCostVsRevenue as {
    omCost?: number;
    revenue?: number;
    surplus?: number;
    revenueCoversOmCost?: boolean | null;
  } | undefined;

  const period = summary.period as { from?: string; to?: string } | undefined;
  const nrwPct = summary.nrwPct as number | null | undefined;
  const collectionEfficiency = summary.collectionEfficiencyPct as number | null | undefined;
  const costRecovery = summary.costRecoveryRatioPct as number | null | undefined;

  const omCost = omCostVsRevenue?.omCost ?? 0;
  const revenue = omCostVsRevenue?.revenue ?? 0;
  const maxBar = Math.max(omCost, revenue, 1);
  const omCostBar = Math.round((omCost / maxBar) * 100);
  const revenueBar = Math.round((revenue / maxBar) * 100);

  return (
    <SurfaceCard
      header={(
        <Box display="flex" justifyContent="space-between" alignItems="center" width="100%" flexWrap="wrap" gap={1}>
          <Box display="flex" alignItems="center" gap={1}>
            <InsightsOutlinedIcon color="primary" fontSize="small" />
            <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem' }}>Revenue KPIs Dashboard</Typography>
          </Box>
          <Box display="flex" gap={0.75} flexWrap="wrap">
            {projectCode && <Chip size="small" label={projectCode} color="primary" variant="outlined" />}
            {period?.from && period?.to && (
              <Chip size="small" variant="outlined" label={`${period.from} → ${period.to}`} />
            )}
            <Chip
              size="small"
              color={nrwStatusColor(nrwPct)}
              variant="outlined"
              label={collectionEfficiency != null ? `Collection ${collectionEfficiency}%` : 'Collection —'}
            />
          </Box>
        </Box>
      )}
    >
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Monitor consumer connections, monthly demand and collection, arrears, NRW, and O&M cost recovery.
      </Typography>

      {OM_REVENUE_KPI_GROUPS.map((group) => (
        <Box key={group.key} sx={{ mb: 2.5 }}>
          <BillingKpiGroupLabel>{group.label}</BillingKpiGroupLabel>
          <Grid container spacing={2}>
            {OM_REVENUE_KPI_DEFINITIONS.filter((kpi) => kpi.group === group.key).map((kpi) => (
              <Grid item xs={6} sm={4} md={3} key={kpi.key}>
                <KpiStatCard
                  label={kpi.label}
                  value={formatRevenueKpiValue(kpi.key, kpi.format, summary)}
                  tone={kpi.tone as KpiTone}
                />
              </Grid>
            ))}
          </Grid>
        </Box>
      ))}

      <Box sx={{ mt: 1, p: 2, borderRadius: 1, bgcolor: 'action.hover' }}>
        <Typography variant="subtitle2" fontWeight={700} gutterBottom>
          O&M Cost vs Revenue
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
          Monthly energy O&M cost compared with billing collections. Cost recovery ratio = collection ÷ O&M cost.
        </Typography>

        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" color="text.secondary">O&M Cost</Typography>
            <Typography variant="h6" fontWeight={700}>{formatInr(omCost)}</Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" color="text.secondary">Revenue (Collection)</Typography>
            <Typography variant="h6" fontWeight={700}>{formatInr(revenue)}</Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" color="text.secondary">Surplus / Deficit</Typography>
            <Typography
              variant="h6"
              fontWeight={700}
              color={(omCostVsRevenue?.surplus ?? 0) >= 0 ? 'success.main' : 'error.main'}
            >
              {formatInr(omCostVsRevenue?.surplus ?? 0)}
            </Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" color="text.secondary">Cost Recovery</Typography>
            <Typography variant="h6" fontWeight={700}>
              {costRecovery != null ? `${costRecovery}%` : '—'}
            </Typography>
          </Grid>
        </Grid>

        <Box sx={{ mb: 1 }}>
          <Box display="flex" justifyContent="space-between" mb={0.5}>
            <Typography variant="caption">O&M Cost</Typography>
            <Typography variant="caption">{formatInr(omCost)}</Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={omCostBar}
            sx={{ height: 8, borderRadius: 1, mb: 1.5, bgcolor: 'action.selected' }}
            color="warning"
          />
          <Box display="flex" justifyContent="space-between" mb={0.5}>
            <Typography variant="caption">Revenue</Typography>
            <Typography variant="caption">{formatInr(revenue)}</Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={revenueBar}
            sx={{ height: 8, borderRadius: 1, bgcolor: 'action.selected' }}
            color={omCostVsRevenue?.revenueCoversOmCost ? 'success' : 'error'}
          />
        </Box>

        {nrwPct != null && nrwPct > (100 - OM_NRW_EFFICIENCY_THRESHOLD_PCT) && (
          <Chip
            size="small"
            color="warning"
            label={`NRW ${nrwPct}% exceeds threshold (efficiency below ${OM_NRW_EFFICIENCY_THRESHOLD_PCT}%)`}
            sx={{ mt: 1 }}
          />
        )}
      </Box>
    </SurfaceCard>
  );
}
