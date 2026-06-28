import { Grid, Typography } from '@mui/material';
import KpiStatCard from '../layout/KpiStatCard';

export type LaGisDashboardData = {
  totalAffectedVillages?: number;
  totalParcels?: number;
  governmentLandSqm?: number;
  privateLandSqm?: number;
  forestLandSqm?: number;
  totalAcquisitionAreaSqm?: number;
  totalCompensationInr?: number;
  pendingApprovals?: number;
  approvedParcels?: number;
  rejectedProposals?: number;
  litigationCases?: number;
  possessionCompleted?: number;
  mutationCompleted?: number;
};

function area(v?: number) {
  return Number(v ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function inr(v?: number) {
  return `₹ ${Number(v ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export default function LaGisDashboardPanel({
  data,
  title = 'GIS Dashboard',
}: {
  data: LaGisDashboardData;
  title?: string;
}) {
  return (
    <>
      <Typography variant="subtitle1" fontWeight={700} mb={1.5}>{title}</Typography>
      <Grid container spacing={2}>
        <Grid item xs={6} sm={4} md={3} lg={2}>
          <KpiStatCard label="Affected Villages" value={data.totalAffectedVillages ?? 0} tone="blue" />
        </Grid>
        <Grid item xs={6} sm={4} md={3} lg={2}>
          <KpiStatCard label="Total Parcels" value={data.totalParcels ?? 0} tone="blue" />
        </Grid>
        <Grid item xs={6} sm={4} md={3} lg={2}>
          <KpiStatCard label="Government Land (m²)" value={area(data.governmentLandSqm)} tone="teal" />
        </Grid>
        <Grid item xs={6} sm={4} md={3} lg={2}>
          <KpiStatCard label="Private Land (m²)" value={area(data.privateLandSqm)} tone="amber" />
        </Grid>
        <Grid item xs={6} sm={4} md={3} lg={2}>
          <KpiStatCard label="Forest Land (m²)" value={area(data.forestLandSqm)} tone="violet" />
        </Grid>
        <Grid item xs={6} sm={4} md={3} lg={2}>
          <KpiStatCard label="Acquisition Area (m²)" value={area(data.totalAcquisitionAreaSqm)} tone="blue" />
        </Grid>
        <Grid item xs={6} sm={4} md={3} lg={2}>
          <KpiStatCard label="Total Compensation" value={inr(data.totalCompensationInr)} tone="rose" />
        </Grid>
        <Grid item xs={6} sm={4} md={3} lg={2}>
          <KpiStatCard label="Pending Approvals" value={data.pendingApprovals ?? 0} tone="amber" />
        </Grid>
        <Grid item xs={6} sm={4} md={3} lg={2}>
          <KpiStatCard label="Approved Parcels" value={data.approvedParcels ?? 0} tone="teal" />
        </Grid>
        <Grid item xs={6} sm={4} md={3} lg={2}>
          <KpiStatCard label="Rejected Proposals" value={data.rejectedProposals ?? 0} tone="rose" />
        </Grid>
        <Grid item xs={6} sm={4} md={3} lg={2}>
          <KpiStatCard label="Litigation Cases" value={data.litigationCases ?? 0} tone="rose" />
        </Grid>
        <Grid item xs={6} sm={4} md={3} lg={2}>
          <KpiStatCard label="Possession Completed" value={data.possessionCompleted ?? 0} tone="teal" />
        </Grid>
        <Grid item xs={6} sm={4} md={3} lg={2}>
          <KpiStatCard label="Mutation Completed" value={data.mutationCompleted ?? 0} tone="teal" />
        </Grid>
      </Grid>
    </>
  );
}
