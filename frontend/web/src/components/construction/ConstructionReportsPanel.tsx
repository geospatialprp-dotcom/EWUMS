import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, Grid, LinearProgress, Tab, Tabs,
  Table, TableBody, TableCell, TableRow, Typography,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import { constructionApi } from '../../services/api';
import { formatApiError } from '../../utils/apiError';
import { GIS_ASSET_LABELS, STATUS_COLORS, type GisAssetType } from '../../constants/construction';
import ConstructionStyledTableHead, {
  constructionSectionBarSx, constructionTableShellSx, constructionTableTheme,
} from './ConstructionStyledTableHead';
import type { ConstructionTableStage } from '../../utils/constructionTableStyles';

type ReportData = Record<string, unknown>;
type ReportTab = 'daily' | 'weekly' | 'monthly' | 'mb' | 'contractor' | 'financial' | 'gis' | 'fhtc';

function formatMoney(n: number) {
  return `₹${Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatQty(n: number) {
  return Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function exportCsv(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ProgressBar({ label, value }: { label: string; value: number }) {
  const pct = Math.min(100, Math.max(0, Number(value) || 0));
  return (
    <Box sx={{ mb: 1.5 }}>
      <Box display="flex" justifyContent="space-between" mb={0.5}>
        <Typography variant="body2">{label}</Typography>
        <Typography variant="body2" fontWeight={600}>{pct}%</Typography>
      </Box>
      <LinearProgress variant="determinate" value={pct} sx={{ height: 8, borderRadius: 1 }} />
    </Box>
  );
}

interface Props {
  projectId: string;
  onError: (msg: string) => void;
}

export default function ConstructionReportsPanel({ projectId, onError }: Props) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [data, setData] = useState<ReportData | null>(null);
  const [tab, setTab] = useState<ReportTab>('daily');

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setLoadError('');
    try {
      const { data: reports } = await constructionApi.reports(projectId);
      setData(reports as ReportData);
    } catch (err) {
      const msg = formatApiError(err, 'Failed to load reports.');
      setLoadError(msg);
      onError(msg);
    } finally {
      setLoading(false);
    }
  }, [projectId, onError]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <Typography color="text.secondary">Loading reports…</Typography>;
  if (loadError) return <Alert severity="warning">{loadError}</Alert>;
  if (!data) return null;

  const periodRows = (key: string) => (data[key] ?? []) as Array<Record<string, unknown>>;
  const mbRegister = (data.mbRegister ?? []) as Array<Record<string, unknown>>;
  const contractorReport = (data.contractorPerformanceReport ?? []) as Array<Record<string, unknown>>;
  const financial = (data.financialProgressReport ?? {}) as Record<string, unknown>;
  const gisReport = (data.gisAssetReport ?? {}) as Record<string, unknown>;
  const fhtcReport = (data.fhtcCompletionReport ?? data.fhtcReport ?? {}) as Record<string, unknown>;
  const fhtcRows = (fhtcReport.rows ?? []) as Array<Record<string, unknown>>;
  const gisLayers = (gisReport.byLayer ?? []) as Array<Record<string, unknown>>;
  const gisAssets = (gisReport.assets ?? data.gisAssetRegister ?? []) as Array<Record<string, unknown>>;
  const byComponent = (financial.byComponent ?? []) as Array<Record<string, unknown>>;

  const exportPeriod = (key: string, filename: string) => {
    const rows = periodRows(key);
    exportCsv(filename, ['Period', 'DPR Count', 'Total Qty', 'Manpower', 'Contractors'],
      rows.map((r) => [
        String(r.period), String(r.dprCount), String(r.totalQty), String(r.manpower), String((r.contractors as string[])?.join('; ') ?? ''),
      ]));
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} sx={constructionSectionBarSx('reports')}>
        <Typography variant="subtitle1" fontWeight={700} color={constructionTableTheme('reports').headerColor}>
          Stage 9: Reports & Analytics
        </Typography>
        <Button size="small" startIcon={<RefreshIcon />} onClick={() => { void load(); }}>Refresh</Button>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto" sx={{ mb: 2 }}>
        <Tab value="daily" label="Daily Progress" />
        <Tab value="weekly" label="Weekly Progress" />
        <Tab value="monthly" label="Monthly Progress" />
        <Tab value="mb" label="MB Register" />
        <Tab value="contractor" label="Contractor Performance" />
        <Tab value="financial" label="Financial Progress" />
        <Tab value="gis" label="GIS Asset Report" />
        <Tab value="fhtc" label="FHTC Completion" />
      </Tabs>

      {tab === 'daily' && (
        <Card variant="outlined">
          <CardContent>
            <Box display="flex" justifyContent="space-between" mb={1}>
              <Typography variant="subtitle2" fontWeight={700}>Daily Progress Report</Typography>
              <Button size="small" startIcon={<DownloadIcon />} onClick={() => exportPeriod('dailyProgressReport', 'daily-progress.csv')}>Export CSV</Button>
            </Box>
            <PeriodTable rows={periodRows('dailyProgressReport')} />
          </CardContent>
        </Card>
      )}

      {tab === 'weekly' && (
        <Card variant="outlined">
          <CardContent>
            <Box display="flex" justifyContent="space-between" mb={1}>
              <Typography variant="subtitle2" fontWeight={700}>Weekly Progress Report</Typography>
              <Button size="small" startIcon={<DownloadIcon />} onClick={() => exportPeriod('weeklyProgressReport', 'weekly-progress.csv')}>Export CSV</Button>
            </Box>
            <PeriodTable rows={periodRows('weeklyProgressReport')} />
          </CardContent>
        </Card>
      )}

      {tab === 'monthly' && (
        <Card variant="outlined">
          <CardContent>
            <Box display="flex" justifyContent="space-between" mb={1}>
              <Typography variant="subtitle2" fontWeight={700}>Monthly Progress Report</Typography>
              <Button size="small" startIcon={<DownloadIcon />} onClick={() => exportPeriod('monthlyProgressReport', 'monthly-progress.csv')}>Export CSV</Button>
            </Box>
            <PeriodTable rows={periodRows('monthlyProgressReport')} />
          </CardContent>
        </Card>
      )}

      {tab === 'mb' && (
        <Card variant="outlined">
          <CardContent>
            <Box display="flex" justifyContent="space-between" mb={1}>
              <Typography variant="subtitle2" fontWeight={700}>MB Register</Typography>
              <Button size="small" startIcon={<DownloadIcon />} onClick={() => exportCsv('mb-register.csv',
                ['MB #', 'Date', 'Scheme', 'Contractor', 'Entries', 'Total Qty', 'Status'],
                mbRegister.map((m) => [
                  String(m.mbNumber), String(m.date), String(m.scheme ?? ''), String(m.contractor ?? ''),
                  String(m.entryCount), String(m.totalQty), String(m.status),
                ]),
              )}>Export CSV</Button>
            </Box>
            <Table size="small" sx={constructionTableShellSx('mb')}>
              <ConstructionStyledTableHead stage="mb">
                <TableCell>MB #</TableCell><TableCell>Date</TableCell><TableCell>Scheme</TableCell>
                <TableCell>Contractor</TableCell><TableCell>Entries</TableCell><TableCell>Qty</TableCell><TableCell>Status</TableCell>
              </ConstructionStyledTableHead>
              <TableBody>
                {mbRegister.map((m, i) => (
                  <TableRow key={i}>
                    <TableCell>{String(m.mbNumber)}</TableCell>
                    <TableCell>{String(m.date ?? '').slice(0, 10)}</TableCell>
                    <TableCell>{String(m.scheme ?? '—')}</TableCell>
                    <TableCell>{String(m.contractor ?? '—')}</TableCell>
                    <TableCell>{String(m.entryCount)}</TableCell>
                    <TableCell>{Number(m.totalQty).toLocaleString()}</TableCell>
                    <TableCell><Chip size="small" label={String(m.status)} color={STATUS_COLORS[String(m.status)] ?? 'default'} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {tab === 'contractor' && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle2" fontWeight={700} gutterBottom>Contractor Performance Report</Typography>
            <Table size="small" sx={constructionTableShellSx('reports')}>
              <ConstructionStyledTableHead stage="reports">
                <TableCell>Contractor</TableCell><TableCell>DPRs</TableCell><TableCell>MBs</TableCell>
                <TableCell>DPR Qty</TableCell><TableCell>MB Qty</TableCell><TableCell>Work Packages</TableCell>
              </ConstructionStyledTableHead>
              <TableBody>
                {contractorReport.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell>{String(c.contractor)}</TableCell>
                    <TableCell>{String(c.dprCount)}</TableCell>
                    <TableCell>{String(c.mbCount)}</TableCell>
                    <TableCell>{Number(c.dprQty).toLocaleString()}</TableCell>
                    <TableCell>{Number(c.mbQty).toLocaleString()}</TableCell>
                    <TableCell>{((c.workPackages as string[]) ?? []).join(', ') || '—'}</TableCell>
                  </TableRow>
                ))}
                {contractorReport.length === 0 && (
                  <TableRow><TableCell colSpan={6}><Typography variant="caption" color="text.secondary">No contractor data yet</Typography></TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {tab === 'financial' && (
        <Grid container spacing={2}>
          <Grid item xs={12} md={5}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" fontWeight={700} gutterBottom>Financial Progress Report</Typography>
                <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                  Based on {String(financial.boqSourceLabel ?? 'Original / Tender BOQ')}
                </Typography>
                <Typography variant="body2">Contract Value: {formatMoney(Number(financial.contractValue))}</Typography>
                <Typography variant="body2">Executed Value: {formatMoney(Number(financial.executedValue))}</Typography>
                <Typography variant="body2">MB Value: {formatMoney(Number(financial.mbValue))}</Typography>
                <Typography variant="body2">Released (RA): {formatMoney(Number(financial.releasedValue))}</Typography>
                <Typography variant="body2">Pending Payment: {formatMoney(Number(financial.pendingPayment))}</Typography>
                <Box mt={2}>
                  <ProgressBar label="Physical %" value={Number(financial.physicalPct)} />
                  <ProgressBar label="Financial %" value={Number(financial.financialPct)} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={7}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" fontWeight={700} gutterBottom>By Component</Typography>
                {byComponent.map((c) => (
                  <ProgressBar key={String(c.component)} label={String(c.label)} value={Number(c.pct)} />
                ))}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {tab === 'gis' && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle2" fontWeight={700} gutterBottom>GIS Asset Report</Typography>
            <Typography variant="body2" mb={2}>
              {Number(gisReport.mappedAssets ?? 0)} of {Number(gisReport.totalAssets ?? 0)} assets mapped ({Number(gisReport.mappingPct ?? 0)}%)
            </Typography>
            <Table size="small" sx={{ mb: 2, ...constructionTableShellSx('gis') }}>
              <ConstructionStyledTableHead stage="gis">
                <TableCell>Layer</TableCell><TableCell>Total</TableCell><TableCell>Mapped</TableCell>
              </ConstructionStyledTableHead>
              <TableBody>
                {gisLayers.map((l, i) => (
                  <TableRow key={i}>
                    <TableCell>{String(l.label)}</TableCell>
                    <TableCell>{String(l.count)}</TableCell>
                    <TableCell>{String(l.mapped)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Table size="small" sx={constructionTableShellSx('gis')}>
              <ConstructionStyledTableHead stage="gis">
                <TableCell>Asset ID</TableCell><TableCell>Layer</TableCell><TableCell>Lat</TableCell><TableCell>Lon</TableCell><TableCell>Status</TableCell><TableCell>MB Ref</TableCell>
              </ConstructionStyledTableHead>
              <TableBody>
                {gisAssets.map((a, i) => (
                  <TableRow key={i}>
                    <TableCell>{String(a.assetCode)}</TableCell>
                    <TableCell>{GIS_ASSET_LABELS[String(a.assetType ?? a.label) as GisAssetType] ?? String(a.label ?? a.assetType)}</TableCell>
                    <TableCell>{a.latitude != null ? Number(a.latitude).toFixed(6) : '—'}</TableCell>
                    <TableCell>{a.longitude != null ? Number(a.longitude).toFixed(6) : '—'}</TableCell>
                    <TableCell>{String(a.status ?? '—')}</TableCell>
                    <TableCell>{String(a.mbReference ?? '—')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {tab === 'fhtc' && (
        <Card variant="outlined">
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1} gap={2} flexWrap="wrap">
              <Box>
                <Typography variant="subtitle2" fontWeight={700} gutterBottom>FHTC Completion Report</Typography>
                <Typography variant="caption" color="text.secondary">
                  {fhtcReport.source === 'connection_charges'
                    ? 'Generated from BOQ item: Connection Charges'
                    : 'Generated from FHTC-tagged BOQ items (import Connection Charges line for accurate FHTC count)'}
                </Typography>
              </Box>
              {fhtcRows.length > 0 && (
                <Button
                  size="small"
                  startIcon={<DownloadIcon />}
                  onClick={() => exportCsv('fhtc-completion.csv',
                    ['Item', 'Description', 'Contract Qty', 'Unit', 'Rate', 'Contract Value', 'MB Qty', 'Remaining'],
                    fhtcRows.map((r) => [
                      String(r.itemCode ?? ''),
                      String(r.description ?? ''),
                      String(r.revisedQty ?? r.contractQty ?? 0),
                      String(r.unit ?? 'Nos'),
                      String(r.rate ?? 0),
                      String(r.revisedValue ?? r.contractValue ?? 0),
                      String(r.mbQty ?? 0),
                      String(r.remainingQty ?? 0),
                    ]),
                  )}
                >
                  Export CSV
                </Button>
              )}
            </Box>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={6} sm={3}>
                <Typography variant="caption" color="text.secondary">Target Connections</Typography>
                <Typography variant="h6" fontWeight={700}>{formatQty(Number(fhtcReport.targetConnections ?? 0))}</Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="caption" color="text.secondary">Completed (MB)</Typography>
                <Typography variant="h6" fontWeight={700}>{formatQty(Number(fhtcReport.completedConnections ?? 0))}</Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="caption" color="text.secondary">Unit Rate</Typography>
                <Typography variant="h6" fontWeight={700}>
                  {fhtcReport.rate != null ? formatMoney(Number(fhtcReport.rate)) : '—'}
                </Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="caption" color="text.secondary">Contract Value</Typography>
                <Typography variant="h6" fontWeight={700}>{formatMoney(Number(fhtcReport.contractValue ?? 0))}</Typography>
              </Grid>
            </Grid>
            <ProgressBar label="FHTC Completion" value={Number(fhtcReport.completionPct ?? 0)} />
            <Table size="small" sx={{ mt: 2, ...constructionTableShellSx('boq') }}>
              <ConstructionStyledTableHead stage="boq">
                <TableCell>Item</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="right">Qty</TableCell>
                <TableCell>Unit</TableCell>
                <TableCell align="right">Rate</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell align="right">MB Qty</TableCell>
                <TableCell align="right">Remaining</TableCell>
              </ConstructionStyledTableHead>
              <TableBody>
                {fhtcRows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{String(r.itemCode ?? '—')}</TableCell>
                    <TableCell>{String(r.description ?? '—')}</TableCell>
                    <TableCell align="right">{formatQty(Number(r.revisedQty ?? r.contractQty ?? 0))}</TableCell>
                    <TableCell>{String(r.unit ?? 'Nos')}</TableCell>
                    <TableCell align="right">{formatMoney(Number(r.rate ?? 0))}</TableCell>
                    <TableCell align="right">{formatMoney(Number(r.revisedValue ?? r.contractValue ?? 0))}</TableCell>
                    <TableCell align="right">{formatQty(Number(r.mbQty ?? 0))}</TableCell>
                    <TableCell align="right">{formatQty(Number(r.remainingQty ?? 0))}</TableCell>
                  </TableRow>
                ))}
                {fhtcRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <Typography variant="caption" color="text.secondary">
                        No Connection Charges BOQ item found. Re-import BOQ Excel with item 1.44 Connection Charges (119 Nos).
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

function PeriodTable({ rows, stage = 'dpr' }: { rows: Array<Record<string, unknown>>; stage?: ConstructionTableStage }) {
  if (!rows.length) {
    return <Typography variant="caption" color="text.secondary">No approved DPR data for this period.</Typography>;
  }
  return (
    <Table size="small" sx={constructionTableShellSx(stage)}>
      <ConstructionStyledTableHead stage={stage}>
        <TableCell>Period</TableCell><TableCell>DPRs</TableCell><TableCell>Total Qty</TableCell>
        <TableCell>Manpower</TableCell><TableCell>Contractors</TableCell>
      </ConstructionStyledTableHead>
      <TableBody>
        {rows.map((r, i) => (
          <TableRow key={i}>
            <TableCell>{String(r.period)}</TableCell>
            <TableCell>{String(r.dprCount)}</TableCell>
            <TableCell>{Number(r.totalQty).toLocaleString()}</TableCell>
            <TableCell>{String(r.manpower)}</TableCell>
            <TableCell>{((r.contractors as string[]) ?? []).join(', ') || '—'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
