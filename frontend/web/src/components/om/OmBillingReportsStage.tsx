import { useCallback, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, Grid, LinearProgress, List, ListItemButton, ListItemText,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined';
import axios from 'axios';
import { omApi } from '../../services/api';
import SurfaceCard from '../layout/SurfaceCard';
import KpiStatCard from '../layout/KpiStatCard';
import ReportExportButtons from './ReportExportButtons';
import { BillingKpiGroupLabel, BillingSectionCard } from './billingUi';
import {
  OM_BILLING_REPORT_GROUP_LABELS,
  OM_BILLING_REVENUE_REPORTS_1512,
  formatInr,
} from '../../constants/omBilling';
import { dataTableSx } from '../../utils/pagePresentationStyles';

type ProjectParams = { projectId?: string; projectCode?: string };

function getApiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg)) return msg.join(', ');
  }
  return fallback;
}

function flattenPreviewRows(data: Record<string, unknown>): Array<Record<string, unknown>> {
  if (Array.isArray(data.rows) && data.rows.length) {
    const first = data.rows[0] as Record<string, unknown>;
    if (first.consumer && (first.bills || first.payments)) {
      return (data.rows as Array<Record<string, unknown>>).map((row) => {
        const consumer = row.consumer as Record<string, unknown>;
        const bills = row.bills as unknown[];
        const payments = row.payments as unknown[];
        return {
          consumerCode: consumer.consumerCode,
          fhtcNumber: consumer.fhtcNumber,
          consumerName: consumer.consumerName,
          village: consumer.village,
          bills: bills?.length ?? 0,
          payments: payments?.length ?? 0,
        };
      });
    }
    return data.rows as Array<Record<string, unknown>>;
  }
  if (Array.isArray(data.arrearRows) && data.arrearRows.length) {
    return data.arrearRows as Array<Record<string, unknown>>;
  }
  if (Array.isArray(data.recentPayments) && data.recentPayments.length) {
    return data.recentPayments as Array<Record<string, unknown>>;
  }
  return [];
}

function formatCellValue(key: string, value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'number' && /amount|demand|collection|balance|arrear|total|efficiency|pct/i.test(key)) {
    return key.toLowerCase().includes('pct') ? `${value}%` : formatInr(value);
  }
  return String(value);
}

type Props = {
  projectParams: ProjectParams;
};

export default function OmBillingReportsStage({ projectParams }: Props) {
  const [reportType, setReportType] = useState<string>(OM_BILLING_REVENUE_REPORTS_1512[0].type);
  const [period, setPeriod] = useState({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reportData, setReportData] = useState<Record<string, unknown> | null>(null);

  const selectedReport = OM_BILLING_REVENUE_REPORTS_1512.find((r) => r.type === reportType)
    ?? OM_BILLING_REVENUE_REPORTS_1512[0];

  const groupedReports = useMemo(() => {
    const groups = new Map<string, typeof OM_BILLING_REVENUE_REPORTS_1512[number][]>();
    for (const report of OM_BILLING_REVENUE_REPORTS_1512) {
      const list = groups.get(report.group) ?? [];
      list.push(report);
      groups.set(report.group, list);
    }
    return [...groups.entries()];
  }, []);

  const previewRows = useMemo(
    () => (reportData ? flattenPreviewRows(reportData) : []),
    [reportData],
  );

  const summary = reportData?.summary as Record<string, unknown> | undefined;
  const auditSnapshot = reportData?.auditSnapshot as Record<string, unknown> | undefined;

  const runReport = useCallback(() => {
    setBusy(true);
    setError('');
    omApi.generateBillingReport(reportType, { ...projectParams, from: period.from, to: period.to })
      .then((res) => setReportData(res.data as Record<string, unknown>))
      .catch((err) => setError(getApiError(err, 'Failed to generate report')))
      .finally(() => setBusy(false));
  }, [reportType, projectParams, period.from, period.to]);

  const exportBaseName = `${reportType}-${new Date().toISOString().slice(0, 10)}`;

  return (
    <Box>
      <BillingSectionCard title="Revenue reports (Stage 15.12)" phase="analytics">
        <Typography variant="body2" color="text.secondary">
          Generate registers, revenue analytics, consumer ledger, receipt register and financial audit reports.
        </Typography>
      </BillingSectionCard>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {busy && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <SurfaceCard title="Report Catalog">
            {groupedReports.map(([group, reports]) => (
              <Box key={group} sx={{ mb: 2 }}>
                <BillingKpiGroupLabel>{OM_BILLING_REPORT_GROUP_LABELS[group] ?? group}</BillingKpiGroupLabel>
                <List dense disablePadding>
                  {reports.map((r) => (
                    <ListItemButton
                      key={r.type}
                      selected={reportType === r.type}
                      onClick={() => { setReportType(r.type); setReportData(null); }}
                      sx={{ borderRadius: 1, mb: 0.5 }}
                    >
                      <ListItemText
                        primary={r.label}
                        secondary={r.description}
                        primaryTypographyProps={{ variant: 'body2', fontWeight: reportType === r.type ? 600 : 400 }}
                        secondaryTypographyProps={{ variant: 'caption', sx: { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } }}
                      />
                    </ListItemButton>
                  ))}
                </List>
              </Box>
            ))}
          </SurfaceCard>
        </Grid>

        <Grid item xs={12} md={8}>
          <SurfaceCard title={selectedReport.label}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {selectedReport.description}
            </Typography>

            <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
              <Grid item xs={12} sm={4}>
                <TextField fullWidth size="small" type="date" label="Period From" InputLabelProps={{ shrink: true }}
                  value={period.from} onChange={(e) => setPeriod({ ...period, from: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField fullWidth size="small" type="date" label="Period To" InputLabelProps={{ shrink: true }}
                  value={period.to} onChange={(e) => setPeriod({ ...period, to: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Button fullWidth variant="contained" startIcon={<PlayArrowOutlinedIcon />}
                  onClick={runReport} disabled={busy}>
                  Generate Report
                </Button>
              </Grid>
              <Grid item xs={12}>
                <Chip size="small" label={`Type: ${reportType}`} sx={{ mr: 1 }} />
                {projectParams.projectCode && (
                  <Chip size="small" label={`Scheme: ${projectParams.projectCode}`} color="primary" variant="outlined" />
                )}
                {reportData && (
                  <ReportExportButtons
                    report={reportData}
                    baseName={exportBaseName}
                    title={selectedReport.label}
                  />
                )}
              </Grid>
            </Grid>

            {summary && (
              <Grid container spacing={2} sx={{ mb: 2 }}>
                {Object.entries(summary).map(([key, value]) => (
                  typeof value === 'number' || typeof value === 'string' ? (
                    <Grid item xs={6} sm={4} md={3} key={key}>
                      <KpiStatCard
                        label={key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
                        value={typeof value === 'number' && !key.toLowerCase().includes('pct') ? formatInr(value) : String(value)}
                      />
                    </Grid>
                  ) : null
                ))}
              </Grid>
            )}

            {auditSnapshot && (
              <Box sx={{ mb: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom>Financial Audit Snapshot</Typography>
                <Box component="pre" sx={{ m: 0, fontSize: 12, overflow: 'auto' }}>
                  {JSON.stringify(auditSnapshot, null, 2)}
                </Box>
              </Box>
            )}

            {previewRows.length > 0 && (
              <TableContainer>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                  Showing {Math.min(previewRows.length, 50)} of {previewRows.length} row(s). Use Export CSV or Export PDF for full data.
                </Typography>
                <Table size="small" sx={dataTableSx}>
                  <TableHead>
                    <TableRow>
                      {Object.keys(previewRows[0]).map((k) => (
                        <TableCell key={k}>{k.replace(/([A-Z])/g, ' $1')}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {previewRows.slice(0, 50).map((row, idx) => (
                      <TableRow key={idx}>
                        {Object.entries(row).map(([k, v]) => (
                          <TableCell key={k}>{formatCellValue(k, v)}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {reportData && !previewRows.length && !summary && !auditSnapshot && (
              <Box component="pre" sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1, overflow: 'auto', fontSize: 12 }}>
                {JSON.stringify(reportData, null, 2)}
              </Box>
            )}

            {!reportData && !busy && (
              <Typography variant="body2" color="text.secondary">
                Select a report, set the period if needed, and click Generate Report.
              </Typography>
            )}
          </SurfaceCard>
        </Grid>
      </Grid>
    </Box>
  );
}
