import {
  Box, Button, Card, CardContent, Chip, Grid, Stack, Tab, Tabs,
  Table, TableBody, TableCell, TableRow, Typography,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import { useState, type ReactNode } from 'react';
import { COMPONENT_LABELS, type ProjectComponent } from '../../constants/construction';
import {
  exportReconCsv, formatCurrency, formatQty, parseBoqReconciliation,
  type ReconReportTab,
} from '../../utils/boqReconciliation';
import ConstructionTableHead from './ConstructionTableHead';
import ConstructionStyledTableHead, { constructionTableShellSx } from './ConstructionStyledTableHead';

interface Props {
  reconciliation: Record<string, unknown> | null;
  projectName?: string;
}

function VarianceChip({ type }: { type: string }) {
  if (type === 'excess') return <Chip size="small" label="Excess" color="error" />;
  if (type === 'savings') return <Chip size="small" label="Savings" color="success" />;
  if (type === 'pending') return <Chip size="small" label="Pending MB" color="warning" variant="outlined" />;
  return <Chip size="small" label="—" variant="outlined" />;
}

function DeviationChip({ type }: { type: string }) {
  if (type === 'mb_higher') return <Chip size="small" label="MB > DPR" color="warning" />;
  if (type === 'dpr_higher') return <Chip size="small" label="DPR > MB" color="info" />;
  return <Chip size="small" label="—" variant="outlined" />;
}

export default function BoqReconciliationPanel({ reconciliation, projectName }: Props) {
  const [reportTab, setReportTab] = useState<ReconReportTab>('comparison');
  const { rows, totals, reports, boqSourceLabel } = parseBoqReconciliation(reconciliation);

  const compLabel = (c: string) => COMPONENT_LABELS[c as ProjectComponent] ?? c;

  const exportComparison = () => {
    exportReconCsv(
      `boq-comparison-${projectName ?? 'project'}.csv`,
      ['Code', 'Description', 'Component', 'Unit', 'Contract Qty', 'Revised Qty', 'DPR Qty', 'Executed Qty', 'MB Qty', 'Remaining Qty', 'MB Variance', 'DPR-MB Deviation'],
      rows.map((r) => [
        r.itemCode, r.description, compLabel(r.component), r.unit,
        formatQty(r.contractQty), formatQty(r.revisedQty), formatQty(r.dprQty),
        formatQty(r.executedQty), formatQty(r.mbQty), formatQty(r.remainingQty),
        formatQty(r.mbVariance), formatQty(r.dprMbDeviation),
      ]),
    );
  };

  const exportReport = (tab: ReconReportTab) => {
    if (tab === 'variance') {
      exportReconCsv(
        `quantity-variance-report.csv`,
        ['Code', 'Description', 'Component', 'Unit', 'Contract', 'Revised', 'DPR', 'Executed', 'MB', 'Remaining', 'MB Variance', 'DPR-MB Deviation', 'Type'],
        reports.quantityVarianceReport.map((r) => [
          String(r.itemCode), String(r.description), compLabel(String(r.component)), String(r.unit),
          formatQty(Number(r.contractQty)), formatQty(Number(r.revisedQty)), formatQty(Number(r.dprQty)),
          formatQty(Number(r.executedQty)), formatQty(Number(r.mbQty)), formatQty(Number(r.remainingQty)),
          formatQty(Number(r.mbVariance)), formatQty(Number(r.dprMbDeviation)), String(r.varianceType),
        ]),
      );
    } else if (tab === 'excess') {
      exportReconCsv(
        `excess-quantity-report.csv`,
        ['Code', 'Description', 'Component', 'Unit', 'Revised Qty', 'MB Qty', 'Excess Qty', 'Rate', 'Excess Value'],
        reports.excessQuantityReport.map((r) => [
          String(r.itemCode), String(r.description), compLabel(String(r.component)), String(r.unit),
          formatQty(Number(r.revisedQty)), formatQty(Number(r.mbQty)), formatQty(Number(r.excessQty)),
          formatQty(Number(r.rate), 2), formatCurrency(Number(r.excessValue)),
        ]),
      );
    } else if (tab === 'savings') {
      exportReconCsv(
        `savings-report.csv`,
        ['Code', 'Description', 'Component', 'Unit', 'Revised Qty', 'MB Qty', 'Savings Qty', 'Rate', 'Savings Value'],
        reports.savingsReport.map((r) => [
          String(r.itemCode), String(r.description), compLabel(String(r.component)), String(r.unit),
          formatQty(Number(r.revisedQty)), formatQty(Number(r.mbQty)), formatQty(Number(r.savingsQty)),
          formatQty(Number(r.rate), 2), formatCurrency(Number(r.savingsValue)),
        ]),
      );
    } else if (tab === 'pending') {
      exportReconCsv(
        `pending-measurement-report.csv`,
        ['Code', 'Description', 'Component', 'Unit', 'Revised Qty', 'MB Qty', 'Pending Qty', 'Pending Value', 'Remarks'],
        reports.pendingMeasurementReport.map((r) => [
          String(r.itemCode), String(r.description), compLabel(String(r.component)), String(r.unit),
          formatQty(Number(r.revisedQty)), formatQty(Number(r.mbQty)), formatQty(Number(r.pendingMeasurementQty)),
          formatCurrency(Number(r.pendingMeasurementValue)), String(r.remarks),
        ]),
      );
    } else if (tab === 'deviation') {
      exportReconCsv(
        `deviation-statement.csv`,
        ['Code', 'Description', 'Component', 'Unit', 'DPR Qty', 'MB Qty', 'Deviation', 'Type', 'Remarks'],
        reports.deviationStatement.map((r) => [
          String(r.itemCode), String(r.description), compLabel(String(r.component)), String(r.unit),
          formatQty(Number(r.dprQty)), formatQty(Number(r.mbQty)), formatQty(Number(r.deviation)),
          String(r.deviationType), String(r.remarks),
        ]),
      );
    }
  };

  const hasRevisedChanges = rows.some((r) => r.revisedQty !== r.contractQty);

  const summaryCards = [
    { label: 'Contract Value (Gross)', value: formatCurrency(totals.contractValue) },
    ...(hasRevisedChanges
      ? [{ label: 'Revised BOQ Value', value: formatCurrency(totals.revisedValue) }]
      : []),
    { label: 'Executed Value (DPR)', value: formatCurrency(totals.executedValue) },
    { label: 'MB Value (Verified)', value: formatCurrency(totals.mbValue) },
    { label: 'Remaining Value', value: formatCurrency(totals.remainingValue) },
    { label: 'Pending Measurement Qty', value: formatQty(totals.pendingMeasurementQty) },
    { label: 'Savings Quantity', value: formatQty(totals.savingsQty) },
    { label: 'Excess Quantity', value: formatQty(totals.excessQty) },
    { label: 'DPR–MB Deviation', value: formatQty(totals.deviationQty) },
  ];

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2} flexWrap="wrap" gap={1}>
        <Typography variant="subtitle1" fontWeight={600}>
          Stage 5: BOQ Quantity Reconciliation
        </Typography>
        <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={exportComparison}>
          Export CSV
        </Button>
      </Box>

      <Grid container spacing={2} mb={2}>
        {summaryCards.map(({ label, value }) => (
          <Grid item xs={6} sm={4} md={3} lg={2} key={label}>
            <Card variant="outlined"><CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="h6" fontSize="1rem">{value}</Typography>
              <Typography variant="caption" color="text.secondary">{label}</Typography>
            </CardContent></Card>
          </Grid>
        ))}
      </Grid>

      <Tabs value={reportTab} onChange={(_, v) => setReportTab(v)} sx={{ mb: 2 }} variant="scrollable" scrollButtons="auto">
        <Tab value="comparison" label="Quantity Comparison" />
        <Tab value="variance" label={`Variance Report (${reports.quantityVarianceReport.length})`} />
        <Tab value="excess" label={`Excess Qty (${reports.excessQuantityReport.length})`} />
        <Tab value="pending" label={`Pending MB (${reports.pendingMeasurementReport.length})`} />
        <Tab value="savings" label={`Savings (${reports.savingsReport.length})`} />
        <Tab value="deviation" label={`Deviation Statement (${reports.deviationStatement.length})`} />
      </Tabs>

      {reportTab === 'comparison' && (
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={constructionTableShellSx('reconciliation')}>
            <ConstructionTableHead
              stage="reconciliation"
              columns={[
                { label: 'Code' },
                { label: 'Description' },
                { label: 'Component' },
                { label: 'Unit' },
                { label: 'Contract BOQ', align: 'right' },
                ...(hasRevisedChanges ? [{ label: 'Revised BOQ', align: 'right' as const }] : []),
                { label: 'DPR Qty', align: 'right' },
                { label: 'Executed', align: 'right' },
                { label: 'MB Qty', align: 'right' },
                { label: 'Remaining', align: 'right' },
                { label: 'MB Variance', align: 'right' },
                { label: 'Status' },
              ]}
            />
            <TableBody>
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={hasRevisedChanges ? 12 : 11} align="center">
                  <Typography variant="body2" color="text.secondary" py={2}>
                    No BOQ items found.
                  </Typography>
                </TableCell></TableRow>
              )}
              {rows.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell>{row.itemCode}</TableCell>
                  <TableCell sx={{ maxWidth: 220 }}>{row.description}</TableCell>
                  <TableCell>{compLabel(row.component)}</TableCell>
                  <TableCell>{row.unit}</TableCell>
                  <TableCell align="right">{formatQty(row.contractQty)}</TableCell>
                  {hasRevisedChanges && (
                    <TableCell align="right">{formatQty(row.revisedQty)}</TableCell>
                  )}
                  <TableCell align="right">{formatQty(row.dprQty)}</TableCell>
                  <TableCell align="right">{formatQty(row.executedQty)}</TableCell>
                  <TableCell align="right">{formatQty(row.mbQty)}</TableCell>
                  <TableCell align="right">{formatQty(row.remainingQty)}</TableCell>
                  <TableCell align="right" sx={{
                    color: row.varianceType === 'excess' ? 'error.main'
                      : row.varianceType === 'savings' ? 'success.main'
                      : 'inherit',
                  }}>
                    {row.mbVariance > 0 ? '+' : ''}{formatQty(row.mbVariance)}
                  </TableCell>
                  <TableCell><VarianceChip type={row.varianceType} /></TableCell>
                </TableRow>
              ))}
              {rows.length > 0 && (
                <TableRow sx={{ bgcolor: 'action.hover' }}>
                  <TableCell colSpan={4}><strong>Totals</strong></TableCell>
                  <TableCell align="right"><strong>{formatQty(totals.contractQty)}</strong></TableCell>
                  {hasRevisedChanges && (
                    <TableCell align="right"><strong>{formatQty(totals.revisedQty)}</strong></TableCell>
                  )}
                  <TableCell align="right"><strong>{formatQty(totals.dprQty)}</strong></TableCell>
                  <TableCell align="right"><strong>{formatQty(totals.executedQty)}</strong></TableCell>
                  <TableCell align="right"><strong>{formatQty(totals.mbQty)}</strong></TableCell>
                  <TableCell align="right"><strong>{formatQty(totals.remainingQty)}</strong></TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Box>
      )}

      {reportTab === 'variance' && (
        <ReportSection title="Quantity Variance Report" count={reports.quantityVarianceReport.length}
          onExport={() => exportReport('variance')}>
          <Table size="small" sx={constructionTableShellSx('reconciliation')}>
            <ConstructionTableHead
              stage="reconciliation"
              columns={[
                { label: 'Code' },
                { label: 'Description' },
                { label: 'Unit' },
                { label: 'Revised', align: 'right' },
                { label: 'DPR', align: 'right' },
                { label: 'Executed', align: 'right' },
                { label: 'MB', align: 'right' },
                { label: 'Remaining', align: 'right' },
                { label: 'MB Variance', align: 'right' },
                { label: 'DPR–MB Dev.', align: 'right' },
                { label: 'Type' },
              ]}
            />
            <TableBody>
              {reports.quantityVarianceReport.map((r, i) => (
                <TableRow key={i}>
                  <TableCell>{String(r.itemCode)}</TableCell>
                  <TableCell sx={{ maxWidth: 200 }}>{String(r.description)}</TableCell>
                  <TableCell>{String(r.unit)}</TableCell>
                  <TableCell align="right">{formatQty(Number(r.revisedQty))}</TableCell>
                  <TableCell align="right">{formatQty(Number(r.dprQty))}</TableCell>
                  <TableCell align="right">{formatQty(Number(r.executedQty))}</TableCell>
                  <TableCell align="right">{formatQty(Number(r.mbQty))}</TableCell>
                  <TableCell align="right">{formatQty(Number(r.remainingQty))}</TableCell>
                  <TableCell align="right">{formatQty(Number(r.mbVariance))}</TableCell>
                  <TableCell align="right">{formatQty(Number(r.dprMbDeviation))}</TableCell>
                  <TableCell><VarianceChip type={String(r.varianceType)} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ReportSection>
      )}

      {reportTab === 'excess' && (
        <ReportSection title="Excess Quantity Report" subtitle="Items where verified MB quantity exceeds Revised BOQ"
          count={reports.excessQuantityReport.length} onExport={() => exportReport('excess')}>
          <Table size="small" sx={constructionTableShellSx('reconciliation')}>
            <ConstructionStyledTableHead stage="reconciliation">
              <TableCell>Code</TableCell><TableCell>Description</TableCell><TableCell>Unit</TableCell>
              <TableCell align="right">Revised Qty</TableCell><TableCell align="right">MB Qty</TableCell>
              <TableCell align="right">Excess Qty</TableCell><TableCell align="right">Rate</TableCell>
              <TableCell align="right">Excess Value</TableCell>
            </ConstructionStyledTableHead>
            <TableBody>
              {reports.excessQuantityReport.length === 0 && (
                <TableRow><TableCell colSpan={8} align="center">
                  <Typography variant="body2" color="text.secondary" py={2}>No excess quantities detected.</Typography>
                </TableCell></TableRow>
              )}
              {reports.excessQuantityReport.map((r, i) => (
                <TableRow key={i}>
                  <TableCell>{String(r.itemCode)}</TableCell>
                  <TableCell>{String(r.description)}</TableCell>
                  <TableCell>{String(r.unit)}</TableCell>
                  <TableCell align="right">{formatQty(Number(r.revisedQty))}</TableCell>
                  <TableCell align="right">{formatQty(Number(r.mbQty))}</TableCell>
                  <TableCell align="right" sx={{ color: 'error.main' }}>{formatQty(Number(r.excessQty))}</TableCell>
                  <TableCell align="right">{formatCurrency(Number(r.rate))}</TableCell>
                  <TableCell align="right">{formatCurrency(Number(r.excessValue))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ReportSection>
      )}

      {reportTab === 'savings' && (
        <ReportSection title="Savings Report"
          subtitle="Verified MB quantity below Revised BOQ (MB must be entered and verified)"
          count={reports.savingsReport.length} onExport={() => exportReport('savings')}>
          <Table size="small" sx={constructionTableShellSx('reconciliation')}>
            <ConstructionStyledTableHead stage="reconciliation">
              <TableCell>Code</TableCell><TableCell>Description</TableCell><TableCell>Unit</TableCell>
              <TableCell align="right">Revised Qty</TableCell><TableCell align="right">MB Qty</TableCell>
              <TableCell align="right">Savings Qty</TableCell><TableCell align="right">Rate</TableCell>
              <TableCell align="right">Savings Value</TableCell>
            </ConstructionStyledTableHead>
            <TableBody>
              {reports.savingsReport.length === 0 && (
                <TableRow><TableCell colSpan={8} align="center">
                  <Typography variant="body2" color="text.secondary" py={2}>
                    No verified savings yet — appears only when MB is recorded and below Revised BOQ.
                  </Typography>
                </TableCell></TableRow>
              )}
              {reports.savingsReport.map((r, i) => (
                <TableRow key={i}>
                  <TableCell>{String(r.itemCode)}</TableCell>
                  <TableCell>{String(r.description)}</TableCell>
                  <TableCell>{String(r.unit)}</TableCell>
                  <TableCell align="right">{formatQty(Number(r.revisedQty))}</TableCell>
                  <TableCell align="right">{formatQty(Number(r.mbQty))}</TableCell>
                  <TableCell align="right" sx={{ color: 'success.main' }}>{formatQty(Number(r.savingsQty))}</TableCell>
                  <TableCell align="right">{formatCurrency(Number(r.rate))}</TableCell>
                  <TableCell align="right">{formatCurrency(Number(r.savingsValue))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ReportSection>
      )}

      {reportTab === 'pending' && (
        <ReportSection title="Pending Measurement Report"
          subtitle="BOQ lines with no verified MB entry yet — not counted as savings"
          count={reports.pendingMeasurementReport.length} onExport={() => exportReport('pending')}>
          <Table size="small" sx={constructionTableShellSx('reconciliation')}>
            <ConstructionStyledTableHead stage="reconciliation">
              <TableCell>Code</TableCell><TableCell>Description</TableCell><TableCell>Unit</TableCell>
              <TableCell align="right">Revised Qty</TableCell><TableCell align="right">MB Qty</TableCell>
              <TableCell align="right">Pending Qty</TableCell><TableCell align="right">Pending Value</TableCell>
              <TableCell>Remarks</TableCell>
            </ConstructionStyledTableHead>
            <TableBody>
              {reports.pendingMeasurementReport.length === 0 && (
                <TableRow><TableCell colSpan={8} align="center">
                  <Typography variant="body2" color="text.secondary" py={2}>
                    All BOQ lines have at least partial verified MB entries.
                  </Typography>
                </TableCell></TableRow>
              )}
              {reports.pendingMeasurementReport.map((r, i) => (
                <TableRow key={i}>
                  <TableCell>{String(r.itemCode)}</TableCell>
                  <TableCell>{String(r.description)}</TableCell>
                  <TableCell>{String(r.unit)}</TableCell>
                  <TableCell align="right">{formatQty(Number(r.revisedQty))}</TableCell>
                  <TableCell align="right">{formatQty(Number(r.mbQty))}</TableCell>
                  <TableCell align="right" sx={{ color: 'warning.main' }}>{formatQty(Number(r.pendingMeasurementQty))}</TableCell>
                  <TableCell align="right">{formatCurrency(Number(r.pendingMeasurementValue))}</TableCell>
                  <TableCell><Typography variant="caption">{String(r.remarks)}</Typography></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ReportSection>
      )}

      {reportTab === 'deviation' && (
        <ReportSection title="Deviation Statement" subtitle="DPR reported quantity vs MB measured quantity"
          count={reports.deviationStatement.length} onExport={() => exportReport('deviation')}>
          <Table size="small" sx={constructionTableShellSx('reconciliation')}>
            <ConstructionStyledTableHead stage="reconciliation">
              <TableCell>Code</TableCell><TableCell>Description</TableCell><TableCell>Unit</TableCell>
              <TableCell align="right">DPR Qty</TableCell><TableCell align="right">MB Qty</TableCell>
              <TableCell align="right">Deviation</TableCell><TableCell>Type</TableCell><TableCell>Remarks</TableCell>
            </ConstructionStyledTableHead>
            <TableBody>
              {reports.deviationStatement.length === 0 && (
                <TableRow><TableCell colSpan={8} align="center">
                  <Typography variant="body2" color="text.secondary" py={2}>No DPR–MB deviations detected.</Typography>
                </TableCell></TableRow>
              )}
              {reports.deviationStatement.map((r, i) => (
                <TableRow key={i}>
                  <TableCell>{String(r.itemCode)}</TableCell>
                  <TableCell>{String(r.description)}</TableCell>
                  <TableCell>{String(r.unit)}</TableCell>
                  <TableCell align="right">{formatQty(Number(r.dprQty))}</TableCell>
                  <TableCell align="right">{formatQty(Number(r.mbQty))}</TableCell>
                  <TableCell align="right">{formatQty(Number(r.deviation))}</TableCell>
                  <TableCell><DeviationChip type={String(r.deviationType)} /></TableCell>
                  <TableCell><Typography variant="caption">{String(r.remarks)}</Typography></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ReportSection>
      )}
    </Box>
  );
}

function ReportSection({ title, subtitle, count, onExport, children }: {
  title: string; subtitle?: string; count: number; onExport: () => void; children: ReactNode;
}) {
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
        <Box>
          <Typography variant="subtitle2" fontWeight={700}>{title}</Typography>
          {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
          <Typography variant="caption" display="block" color="text.secondary">{count} item(s)</Typography>
        </Box>
        <Button size="small" startIcon={<DownloadIcon />} onClick={onExport}>Export CSV</Button>
      </Stack>
      <Box sx={{ overflowX: 'auto' }}>{children}</Box>
    </Box>
  );
}
