import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent,
  FormControl, Grid, InputLabel, LinearProgress, MenuItem, Select, Tab, Tabs,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography,
} from '@mui/material';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import PostAddOutlinedIcon from '@mui/icons-material/PostAddOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import axios from 'axios';
import { omApi } from '../../services/api';
import SurfaceCard from '../layout/SurfaceCard';
import KpiStatCard from '../layout/KpiStatCard';
import ReportExportButtons from './ReportExportButtons';
import {
  OM_ACCOUNTING_AUTO_POSTING,
  OM_ACCOUNTING_REPORT_TYPES,
  OM_ACCOUNTING_ADJUSTMENT_TYPES,
  accountingPostingLabel,
  erpStatusColor,
} from '../../constants/omAccounting';
import { formatInr } from '../../constants/omBilling';
import { dataTableSx } from '../../utils/pagePresentationStyles';
import { OmDialogHeader, omDialogActionsSx, omDialogContentSx, omDialogPaperSx } from './omUi';
import BilingualRemarkField from '../forms/BilingualRemarkField';
import { parseBilingualText, serializeBilingualText } from '../../utils/bilingualText';

type ConsumerOption = { id: string; consumerCode: string; fhtcNumber?: string; consumerName?: string | null };

function getApiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg)) return msg.join(', ');
  }
  return fallback;
}

type Props = {
  consumers: ConsumerOption[];
  onRefresh?: () => void;
};

export default function OmAccountingStage({ consumers, onRefresh }: Props) {
  const [subTab, setSubTab] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [catalog, setCatalog] = useState<Record<string, unknown> | null>(null);
  const [summary, setSummary] = useState<Record<string, number | string>>({});
  const [accounts, setAccounts] = useState<Array<Record<string, unknown>>>([]);
  const [postings, setPostings] = useState<Array<Record<string, unknown>>>([]);
  const [journalEntries, setJournalEntries] = useState<Array<Record<string, unknown>>>([]);
  const [reportType, setReportType] = useState(OM_ACCOUNTING_REPORT_TYPES[0].type);
  const [reportData, setReportData] = useState<Record<string, unknown> | null>(null);
  const [period, setPeriod] = useState({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10),
  });

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustForm, setAdjustForm] = useState({
    consumerId: '',
    billId: '',
    amount: '',
    entryDate: new Date().toISOString().slice(0, 10),
    narration: '',
    adjustmentType: 'correction',
  });

  const load = useCallback(() => {
    if (typeof omApi.getAccountingCatalog !== 'function') {
      setError('Accounting API is not available. Restart the frontend dev server (npm run dev).');
      setLoaded(true);
      return;
    }

    setBusy(true);
    setError('');
    Promise.allSettled([
      omApi.getAccountingCatalog(),
      omApi.getAccountingSummary(),
      omApi.listChartOfAccounts(),
      omApi.listAccountingPostings({ limit: 100 }),
      omApi.listJournalEntries({ from: period.from, to: period.to, limit: 100 }),
    ])
      .then(([catRes, sumRes, coaRes, postRes, jeRes]) => {
        if (catRes.status === 'fulfilled') setCatalog((catRes.value.data ?? null) as Record<string, unknown> | null);
        if (sumRes.status === 'fulfilled') setSummary((sumRes.value.data ?? {}) as Record<string, number | string>);
        if (coaRes.status === 'fulfilled') {
          const data = coaRes.value.data;
          setAccounts(Array.isArray(data) ? data : []);
        }
        if (postRes.status === 'fulfilled') {
          const data = postRes.value.data;
          setPostings(Array.isArray(data) ? data : []);
        }
        if (jeRes.status === 'fulfilled') {
          const data = jeRes.value.data;
          setJournalEntries(Array.isArray(data) ? data : []);
        }

        const failures = [catRes, sumRes, coaRes, postRes, jeRes].filter((r) => r.status === 'rejected');
        if (failures.length === 5) {
          setError('Accounting API unavailable. Ensure backend is running and migration 044 is applied.');
        } else if (failures.length > 0) {
          setError('Some accounting data could not be loaded. Restart backend if you recently updated the code.');
        }
      })
      .catch((err) => setError(getApiError(err, 'Failed to load accounting data')))
      .finally(() => {
        setBusy(false);
        setLoaded(true);
      });
  }, [period.from, period.to]);

  useEffect(() => { load(); }, [load]);

  const runReport = () => {
    setBusy(true);
    setError('');
    omApi.generateAccountingReport(reportType, { from: period.from, to: period.to })
      .then((res) => setReportData((res.data ?? null) as Record<string, unknown> | null))
      .catch((err) => setError(getApiError(err, 'Failed to generate report')))
      .finally(() => setBusy(false));
  };

  const submitAdjustment = () => {
    if (!adjustForm.consumerId || !adjustForm.amount) {
      setError('Consumer and amount are required');
      return;
    }
    setBusy(true);
    setError('');
    omApi.createAccountingAdjustment({
      consumerId: adjustForm.consumerId,
      billId: adjustForm.billId || undefined,
      amount: Number(adjustForm.amount),
      entryDate: adjustForm.entryDate,
      narration: adjustForm.narration || undefined,
      adjustmentType: adjustForm.adjustmentType,
    })
      .then(() => {
        setSuccess('Adjustment posted to journal entries');
        setAdjustOpen(false);
        setAdjustForm({
          consumerId: '',
          billId: '',
          amount: '',
          entryDate: new Date().toISOString().slice(0, 10),
          narration: '',
          adjustmentType: 'correction',
        });
        load();
        onRefresh?.();
      })
      .catch((err) => setError(getApiError(err, 'Failed to post adjustment')))
      .finally(() => setBusy(false));
  };

  const erpIntegration = (catalog?.erpIntegration ?? {}) as Record<string, unknown>;

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6" fontWeight={700}>Financial Accounting Integration (15.10)</Typography>
        <Button size="small" variant="outlined" startIcon={<RefreshOutlinedIcon />} onClick={load} disabled={busy}>
          Refresh
        </Button>
      </Box>

      {busy && <LinearProgress sx={{ mb: 2 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      {!loaded && !error && (
        <Alert severity="info" sx={{ mb: 2 }}>Loading financial accounting data…</Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <KpiStatCard label="Chart Accounts" value={String(summary.chartAccounts ?? accounts.length ?? 0)} icon={<AccountBalanceOutlinedIcon />} tone="teal" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiStatCard label="Journal Entries" value={String(summary.journalEntries ?? journalEntries.length ?? 0)} tone="blue" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiStatCard label="Demand Posted" value={formatInr(Number(summary.demandPosted ?? 0))} tone="violet" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiStatCard label="Collection Posted" value={formatInr(Number(summary.collectionPosted ?? 0))} tone="amber" />
        </Grid>
      </Grid>

      <SurfaceCard title="ERP Accounting Integration">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Auto-posting from billing workflows to general ledger
        </Typography>
        <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <Grid item xs={12} md={8}>
            <Typography variant="body2" color="text.secondary">
              Mode: <strong>{String(erpIntegration.mode ?? summary.erpMode ?? 'internal')}</strong>
              {' · '}
              ERP endpoint: {erpIntegration.enabled ? String(erpIntegration.endpoint) : 'Internal GL only (set ERP_ACCOUNTING_URL to sync)'}
            </Typography>
          </Grid>
          <Grid item xs={12} md={4}>
            <Button fullWidth variant="outlined" startIcon={<PostAddOutlinedIcon />} onClick={() => setAdjustOpen(true)}>
              Post Adjustment
            </Button>
          </Grid>
        </Grid>

        <Grid container spacing={2}>
          {OM_ACCOUNTING_AUTO_POSTING.map((rule) => (
            <Grid item xs={12} md={4} key={rule.code}>
              <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, height: '100%' }}>
                <Typography variant="subtitle2" gutterBottom>{rule.label}</Typography>
                <Typography variant="body2" color="text.secondary">{rule.description}</Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </SurfaceCard>

      <Box sx={{ mt: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={subTab} onChange={(_, v) => setSubTab(v)} variant="scrollable" scrollButtons="auto">
          <Tab label={`Chart of Accounts (${accounts.length})`} />
          <Tab label={`Auto Postings (${postings.length})`} />
          <Tab label={`Journal Entries (${journalEntries.length})`} />
          <Tab label="Accounting Reports" />
        </Tabs>
      </Box>

      {subTab === 0 && (
        <Box sx={{ mt: 2 }}>
          <SurfaceCard title="Chart of Accounts">
            <TableContainer>
              <Table size="small" sx={dataTableSx}>
                <TableHead>
                  <TableRow>
                    <TableCell>Code</TableCell>
                    <TableCell>Account Name</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Flags</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {accounts.map((a) => (
                    <TableRow key={String(a.id)}>
                      <TableCell>{String(a.accountCode)}</TableCell>
                      <TableCell>{String(a.accountName)}</TableCell>
                      <TableCell>{String(a.accountType)}</TableCell>
                      <TableCell>
                        {a.isCash ? <Chip size="small" label="Cash" sx={{ mr: 0.5 }} /> : null}
                        {a.isBank ? <Chip size="small" label="Bank" sx={{ mr: 0.5 }} /> : null}
                        {a.isSystem ? <Chip size="small" label="System" variant="outlined" /> : null}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!accounts.length && loaded && (
                    <TableRow>
                      <TableCell colSpan={4} align="center">No chart of accounts loaded. Check backend connection.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </SurfaceCard>
        </Box>
      )}

      {subTab === 1 && (
        <Box sx={{ mt: 2 }}>
          <SurfaceCard title="Auto Postings">
            <TableContainer>
              <Table size="small" sx={dataTableSx}>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Source</TableCell>
                    <TableCell>Reference</TableCell>
                    <TableCell>Posting Type</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>JE No</TableCell>
                    <TableCell>ERP</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {postings.map((p) => (
                    <TableRow key={String(p.id)}>
                      <TableCell>{String(p.createdAt ?? '').slice(0, 10)}</TableCell>
                      <TableCell>{String(p.sourceType)}</TableCell>
                      <TableCell>{String(p.sourceRef ?? '')}</TableCell>
                      <TableCell>{accountingPostingLabel(String(p.postingType))}</TableCell>
                      <TableCell align="right">{formatInr(Number(p.amount ?? 0))}</TableCell>
                      <TableCell>{String(p.entryNo ?? '—')}</TableCell>
                      <TableCell>
                        <Chip size="small" label={String(p.erpStatus ?? 'posted')} color={erpStatusColor(String(p.erpStatus ?? 'posted'))} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {!postings.length && loaded && (
                    <TableRow>
                      <TableCell colSpan={7} align="center">No postings yet — issue bills or record payments to auto-post.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </SurfaceCard>
        </Box>
      )}

      {subTab === 2 && (
        <Box sx={{ mt: 2 }}>
          <SurfaceCard title="Journal Entries">
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} sm={4}>
                <TextField fullWidth size="small" type="date" label="From" InputLabelProps={{ shrink: true }}
                  value={period.from} onChange={(e) => setPeriod({ ...period, from: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField fullWidth size="small" type="date" label="To" InputLabelProps={{ shrink: true }}
                  value={period.to} onChange={(e) => setPeriod({ ...period, to: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Button fullWidth variant="outlined" onClick={load} disabled={busy}>Refresh</Button>
              </Grid>
            </Grid>
            {journalEntries.map((entry) => {
              const lines = (entry.lines ?? []) as Array<Record<string, unknown>>;
              return (
                <Box key={String(entry.id)} sx={{ mb: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  <Typography variant="subtitle2">
                    {String(entry.entryNo)} · {String(entry.entryDate)} · {String(entry.sourceType)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{String(entry.narration ?? '')}</Typography>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Account</TableCell>
                        <TableCell align="right">Debit</TableCell>
                        <TableCell align="right">Credit</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {lines.map((l, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{String(l.accountCode)} — {String(l.accountName)}</TableCell>
                          <TableCell align="right">{Number(l.debit) ? formatInr(Number(l.debit)) : '—'}</TableCell>
                          <TableCell align="right">{Number(l.credit) ? formatInr(Number(l.credit)) : '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              );
            })}
            {!journalEntries.length && loaded && (
              <Typography variant="body2" color="text.secondary">No journal entries in selected period.</Typography>
            )}
          </SurfaceCard>
        </Box>
      )}

      {subTab === 3 && (
        <Box sx={{ mt: 2 }}>
          <SurfaceCard title="Accounting Reports">
            <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Report Type</InputLabel>
                  <Select label="Report Type" value={reportType} onChange={(e) => setReportType(e.target.value)}>
                    {OM_ACCOUNTING_REPORT_TYPES.map((r) => (
                      <MenuItem key={r.type} value={r.type}>{r.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField fullWidth size="small" type="date" label="From" InputLabelProps={{ shrink: true }}
                  value={period.from} onChange={(e) => setPeriod({ ...period, from: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField fullWidth size="small" type="date" label="To" InputLabelProps={{ shrink: true }}
                  value={period.to} onChange={(e) => setPeriod({ ...period, to: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={2}>
                <Button fullWidth variant="contained" onClick={runReport} disabled={busy}>Run</Button>
              </Grid>
              <Grid item xs={12}>
                {reportData && (
                  <ReportExportButtons
                    report={reportData}
                    baseName={`accounting-${reportType}-${period.from}-${period.to}`}
                    title={String(reportData.title ?? reportType)}
                  />
                )}
              </Grid>
            </Grid>

            {reportData && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>{String(reportData.title ?? reportType)}</Typography>
                {'summary' in reportData && reportData.summary != null && (
                  <Box component="pre" sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1, overflow: 'auto', fontSize: 12 }}>
                    {JSON.stringify(reportData.summary, null, 2)}
                  </Box>
                )}
                {'rows' in reportData && Array.isArray(reportData.rows) && (
                  <TableContainer sx={{ mt: 2 }}>
                    <Table size="small" sx={dataTableSx}>
                      <TableHead>
                        <TableRow>
                          {Object.keys((reportData.rows[0] ?? {}) as object).map((k) => (
                            <TableCell key={k}>{k}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(reportData.rows as Array<Record<string, unknown>>).slice(0, 50).map((row, idx) => (
                          <TableRow key={idx}>
                            {Object.values(row).map((v, ci) => (
                              <TableCell key={ci}>{typeof v === 'number' ? formatInr(v) : String(v ?? '')}</TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Box>
            )}
          </SurfaceCard>
        </Box>
      )}

      <Dialog open={adjustOpen} onClose={() => setAdjustOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: omDialogPaperSx }}>
        <OmDialogHeader title="Post Manual Adjustment" busy={busy} />
        <DialogContent sx={omDialogContentSx}>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Consumer</InputLabel>
                <Select label="Consumer" value={adjustForm.consumerId}
                  onChange={(e) => setAdjustForm({ ...adjustForm, consumerId: e.target.value })}>
                  {consumers.map((c) => (
                    <MenuItem key={c.id} value={c.id}>{c.consumerCode} — {c.fhtcNumber ?? c.consumerName}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Amount (₹)" value={adjustForm.amount}
                onChange={(e) => setAdjustForm({ ...adjustForm, amount: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" type="date" label="Entry Date" InputLabelProps={{ shrink: true }}
                value={adjustForm.entryDate} onChange={(e) => setAdjustForm({ ...adjustForm, entryDate: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Adjustment Type</InputLabel>
                <Select label="Adjustment Type" value={adjustForm.adjustmentType}
                  onChange={(e) => setAdjustForm({ ...adjustForm, adjustmentType: e.target.value })}>
                  {OM_ACCOUNTING_ADJUSTMENT_TYPES.map((t) => (
                    <MenuItem key={t.code} value={t.code}>{t.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <BilingualRemarkField
                label="Narration"
                pdfTitle="Accounting Adjustment Narration"
                value={parseBilingualText(adjustForm.narration)}
                onChange={(v) => setAdjustForm({ ...adjustForm, narration: serializeBilingualText(v) })}
                minRows={2}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={omDialogActionsSx}>
          <Button onClick={() => setAdjustOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={submitAdjustment} disabled={busy}>Post to GL</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
