import {
  Box, Grid, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography,
} from '@mui/material';
import KpiStatCard from '../layout/KpiStatCard';
import { dataTableSx } from '../../utils/pagePresentationStyles';

type CompensationRow = {
  id?: string;
  laParcelId?: string;
  circleRatePerSqm?: number;
  marketRatePerSqm?: number;
  affectedAreaSqm?: number;
  landCompensation?: number;
  marketValue?: number;
  solatiumAmount?: number;
  additionalCompensation?: number;
  treeCompensation?: number;
  cropCompensation?: number;
  structureCompensation?: number;
  structureValue?: number;
  totalCompensation?: number;
  interestAmount?: number;
  rehabilitationCost?: number;
  totalAcquisitionCost?: number;
  totalAward?: number;
  paymentStatus?: string;
};

type CompensationSummary = {
  parcelCount?: number;
  totalLandCompensation?: number;
  totalSolatium?: number;
  totalAdditionalCompensation?: number;
  totalTreeCompensation?: number;
  totalCropCompensation?: number;
  totalStructureCompensation?: number;
  totalCompensation?: number;
  totalInterest?: number;
  totalRehabilitationCost?: number;
  totalAcquisitionCost?: number;
};

function inr(v?: number) {
  return `₹ ${Number(v ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function parcelLabel(parcel: Record<string, unknown> | undefined, row: CompensationRow) {
  if (parcel?.khasraNo) return String(parcel.khasraNo);
  if (parcel?.village) return String(parcel.village);
  return String(row.laParcelId ?? '—').slice(0, 8);
}

export default function LaCompensationTable({
  compensations,
  parcels,
  summary,
}: {
  compensations: CompensationRow[];
  parcels: Array<Record<string, unknown>>;
  summary?: CompensationSummary | null;
}) {
  if (!compensations.length) {
    return (
      <Typography variant="body2" color="text.secondary" py={2}>
        Run Estimate Compensation after parcels are identified. Each parcel is auto-calculated per RFCTLARR Act 2013.
      </Typography>
    );
  }

  return (
    <Box>
      {summary && (
        <Grid container spacing={2} mb={2}>
          <Grid item xs={6} sm={4} md={3}>
            <KpiStatCard label="Total Compensation" value={inr(summary.totalCompensation)} />
          </Grid>
          <Grid item xs={6} sm={4} md={3}>
            <KpiStatCard label="Interest" value={inr(summary.totalInterest)} />
          </Grid>
          <Grid item xs={6} sm={4} md={3}>
            <KpiStatCard label="Rehabilitation" value={inr(summary.totalRehabilitationCost)} />
          </Grid>
          <Grid item xs={6} sm={4} md={3}>
            <KpiStatCard label="Total Acquisition Cost" value={inr(summary.totalAcquisitionCost)} />
          </Grid>
        </Grid>
      )}

      <TableContainer sx={{ maxHeight: 480 }}>
        <Table size="small" stickyHeader sx={dataTableSx}>
          <TableHead>
            <TableRow>
              <TableCell>Parcel</TableCell>
              <TableCell align="right">Circle Rate</TableCell>
              <TableCell align="right">Market Rate</TableCell>
              <TableCell align="right">Area (m²)</TableCell>
              <TableCell align="right">Compensation</TableCell>
              <TableCell align="right">Solatium</TableCell>
              <TableCell align="right">Additional</TableCell>
              <TableCell align="right">Trees</TableCell>
              <TableCell align="right">Crops</TableCell>
              <TableCell align="right">Structure</TableCell>
              <TableCell align="right">Total Comp.</TableCell>
              <TableCell align="right">Interest</TableCell>
              <TableCell align="right">Rehab.</TableCell>
              <TableCell align="right">Total Acq.</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {compensations.map((c) => {
              const parcel = parcels.find((p) => p.id === c.laParcelId);
              return (
                <TableRow key={String(c.id)}>
                  <TableCell>{parcelLabel(parcel, c)}</TableCell>
                  <TableCell align="right">{inr(c.circleRatePerSqm)}</TableCell>
                  <TableCell align="right">{inr(c.marketRatePerSqm)}</TableCell>
                  <TableCell align="right">{Number(c.affectedAreaSqm ?? 0).toLocaleString('en-IN')}</TableCell>
                  <TableCell align="right">{inr(c.landCompensation ?? c.marketValue)}</TableCell>
                  <TableCell align="right">{inr(c.solatiumAmount)}</TableCell>
                  <TableCell align="right">{inr(c.additionalCompensation)}</TableCell>
                  <TableCell align="right">{inr(c.treeCompensation)}</TableCell>
                  <TableCell align="right">{inr(c.cropCompensation)}</TableCell>
                  <TableCell align="right">{inr(c.structureCompensation ?? c.structureValue)}</TableCell>
                  <TableCell align="right">{inr(c.totalCompensation)}</TableCell>
                  <TableCell align="right">{inr(c.interestAmount)}</TableCell>
                  <TableCell align="right">{inr(c.rehabilitationCost)}</TableCell>
                  <TableCell align="right">{inr(c.totalAcquisitionCost ?? c.totalAward)}</TableCell>
                  <TableCell>{String(c.paymentStatus ?? 'pending')}</TableCell>
                </TableRow>
              );
            })}
            {summary && (
              <TableRow sx={{ bgcolor: 'action.hover' }}>
                <TableCell colSpan={4}><strong>Case Total ({summary.parcelCount} parcels)</strong></TableCell>
                <TableCell align="right"><strong>{inr(summary.totalLandCompensation)}</strong></TableCell>
                <TableCell align="right"><strong>{inr(summary.totalSolatium)}</strong></TableCell>
                <TableCell align="right"><strong>{inr(summary.totalAdditionalCompensation)}</strong></TableCell>
                <TableCell align="right"><strong>{inr(summary.totalTreeCompensation)}</strong></TableCell>
                <TableCell align="right"><strong>{inr(summary.totalCropCompensation)}</strong></TableCell>
                <TableCell align="right"><strong>{inr(summary.totalStructureCompensation)}</strong></TableCell>
                <TableCell align="right"><strong>{inr(summary.totalCompensation)}</strong></TableCell>
                <TableCell align="right"><strong>{inr(summary.totalInterest)}</strong></TableCell>
                <TableCell align="right"><strong>{inr(summary.totalRehabilitationCost)}</strong></TableCell>
                <TableCell align="right"><strong>{inr(summary.totalAcquisitionCost)}</strong></TableCell>
                <TableCell />
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
