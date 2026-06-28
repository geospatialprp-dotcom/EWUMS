import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent,
  FormControl, Grid, InputLabel, MenuItem, Select,
  Tab, Tabs, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography,
} from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import axios from 'axios';
import { omApi, projectsApi } from '../../services/api';
import SurfaceCard from '../layout/SurfaceCard';
import { OM_ENERGY_METRICS, OM_ENERGY_REPORT_TYPES, fmtNum, type OmEnergyReportType } from '../../constants/omEnergy';
import { dataTableSx } from '../../utils/pagePresentationStyles';
import { OmDialogHeader, omDialogActionsSx, omDialogContentSx, omDialogPaperSx } from './omUi';
import BilingualRemarkField from '../forms/BilingualRemarkField';
import { parseBilingualText, serializeBilingualText } from '../../utils/bilingualText';
import { useCanViewAllDivisions } from '../../utils/divisionAccess';

type ReadingRow = {
  id: string;
  readingCode?: string | null;
  readingDate: string;
  pumpRunningHours?: number | null;
  energyKwh?: number | null;
  energyCost?: number | null;
  waterPumpedKl?: number | null;
  powerFactor?: number | null;
  pumpEfficiencyPct?: number | null;
  kwhPerKl?: number | null;
  assetCode?: string | null;
  notes?: string | null;
};

type ProjectOption = { id: string; name: string; projectCode: string };

function getApiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg)) return msg.join(', ');
  }
  return fallback;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function monthAgoStr() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

export default function OmEnergyStage() {
  const canViewAll = useCanViewAllDivisions();
  const [tab, setTab] = useState(0);
  const [rows, setRows] = useState<ReadingRow[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectOption | null>(null);
  const [summary, setSummary] = useState<Record<string, unknown>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState<Record<string, unknown> | null>(null);
  const [period, setPeriod] = useState({ from: monthAgoStr(), to: todayStr() });

  const [form, setForm] = useState({
    readingDate: todayStr(),
    pumpRunningHours: '',
    energyKwh: '',
    energyCost: '',
    waterPumpedKl: '',
    powerFactor: '',
    pumpEfficiencyPct: '',
    notes: '',
  });

  const load = useCallback(() => {
    setBusy(true);
    setError('');
    Promise.all([
      omApi.listEnergyReadings({
        projectCode: selectedProject?.projectCode,
        from: period.from,
        to: period.to,
      }),
      omApi.energySummary(selectedProject?.id, period.from, period.to),
    ])
      .then(([listRes, sumRes]) => {
        setRows(listRes.data ?? []);
        setSummary(sumRes.data ?? {});
      })
      .catch((err) => setError(getApiError(err, 'Failed to load energy data')))
      .finally(() => setBusy(false));
  }, [selectedProject, period]);

  useEffect(() => {
    projectsApi.list()
      .then((res) => {
        const list = (res.data ?? []) as ProjectOption[];
        setProjects(list);
        if (list.length && !selectedProject) setSelectedProject(list[0]);
      })
      .catch(() => setError('Failed to load projects'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = () => {
    setBusy(true);
    omApi.createEnergyReading({
      projectCode: selectedProject?.projectCode,
      readingDate: form.readingDate,
      pumpRunningHours: form.pumpRunningHours ? Number(form.pumpRunningHours) : undefined,
      energyKwh: form.energyKwh ? Number(form.energyKwh) : undefined,
      energyCost: form.energyCost ? Number(form.energyCost) : undefined,
      waterPumpedKl: form.waterPumpedKl ? Number(form.waterPumpedKl) : undefined,
      powerFactor: form.powerFactor ? Number(form.powerFactor) : undefined,
      pumpEfficiencyPct: form.pumpEfficiencyPct ? Number(form.pumpEfficiencyPct) : undefined,
      notes: form.notes.trim() || undefined,
    })
      .then(() => {
        setCreateOpen(false);
        setForm({
          readingDate: todayStr(),
          pumpRunningHours: '', energyKwh: '', energyCost: '', waterPumpedKl: '',
          powerFactor: '', pumpEfficiencyPct: '', notes: '',
        });
        load();
      })
      .catch((err) => setError(getApiError(err, 'Failed to log reading')))
      .finally(() => setBusy(false));
  };

  const generateReport = (type: OmEnergyReportType) => {
    setBusy(true);
    omApi.generateEnergyReport(type, {
      projectCode: selectedProject?.projectCode,
      from: period.from,
      to: period.to,
    })
      .then((res) => setReportOpen(res.data))
      .catch((err) => setError(getApiError(err, 'Failed to generate report')))
      .finally(() => setBusy(false));
  };

  const renderReportTable = () => {
    if (!reportOpen) return null;
    const reportRows = (reportOpen.rows as Array<Record<string, unknown>>) ?? [];
    if (!reportRows.length) {
      return <Typography variant="body2" color="text.secondary">No data for the selected period.</Typography>;
    }
    const keys = Object.keys(reportRows[0]);
    return (
      <TableContainer>
        <Table size="small" sx={dataTableSx()}>
          <TableHead>
            <TableRow>
              {keys.map((k) => <TableCell key={k}>{k.replace(/([A-Z])/g, ' $1')}</TableCell>)}
            </TableRow>
          </TableHead>
          <TableBody>
            {reportRows.map((r, i) => (
              <TableRow key={i}>
                {keys.map((k) => (
                  <TableCell key={k}>{typeof r[k] === 'number' ? fmtNum(r[k]) : String(r[k] ?? '—')}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  return (
    <>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Grid container spacing={2} mb={2}>
        <Grid item xs={6} sm={3}>
          <SurfaceCard title="Energy (kWh)">
            <Typography variant="h5" fontWeight={700}>{fmtNum(summary.energyKwh, 1)}</Typography>
          </SurfaceCard>
        </Grid>
        <Grid item xs={6} sm={3}>
          <SurfaceCard title="Energy Cost">
            <Typography variant="h5" fontWeight={700}>₹{fmtNum(summary.energyCost)}</Typography>
          </SurfaceCard>
        </Grid>
        <Grid item xs={6} sm={3}>
          <SurfaceCard title="Avg Efficiency">
            <Typography variant="h5" fontWeight={700}>{fmtNum(summary.avgPumpEfficiencyPct)}%</Typography>
          </SurfaceCard>
        </Grid>
        <Grid item xs={6} sm={3}>
          <SurfaceCard title="kWh / KL">
            <Typography variant="h5" fontWeight={700}>{fmtNum(summary.kwhPerKl, 3)}</Typography>
          </SurfaceCard>
        </Grid>
      </Grid>

      <SurfaceCard
        header={(
          <Box display="flex" justifyContent="space-between" alignItems="center" width="100%" flexWrap="wrap" gap={1}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem' }}>Energy Management</Typography>
            <Box display="flex" gap={1} flexWrap="wrap" alignItems="center">
              <TextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }}
                value={period.from} onChange={(e) => setPeriod({ ...period, from: e.target.value })} />
              <TextField size="small" type="date" label="To" InputLabelProps={{ shrink: true }}
                value={period.to} onChange={(e) => setPeriod({ ...period, to: e.target.value })} />
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Scheme / Project</InputLabel>
                <Select label="Scheme / Project" value={selectedProject?.id ?? ''}
                  onChange={(e) => setSelectedProject(projects.find((p) => p.id === e.target.value) ?? null)}>
                  {canViewAll && <MenuItem value="">All schemes</MenuItem>}
                  {projects.map((p) => (
                    <MenuItem key={p.id} value={p.id}>{p.projectCode} — {p.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button variant="contained" size="small" startIcon={<AddOutlinedIcon />} onClick={() => setCreateOpen(true)}>
                Log Reading
              </Button>
            </Box>
          </Box>
        )}
      >
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab label="Daily Log" />
          <Tab label="Reports" />
        </Tabs>

        {tab === 0 && (
          <>
            <Box display="flex" gap={0.75} mb={2} flexWrap="wrap">
              {OM_ENERGY_METRICS.map((m) => (
                <Chip key={m.key} size="small" variant="outlined" label={`${m.label}${m.unit ? ` (${m.unit})` : ''}`} />
              ))}
            </Box>
            {rows.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No energy readings logged for this period.</Typography>
            ) : (
              <TableContainer>
                <Table size="small" sx={dataTableSx()}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Code</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Asset</TableCell>
                      <TableCell>Hours</TableCell>
                      <TableCell>kWh</TableCell>
                      <TableCell>Cost</TableCell>
                      <TableCell>Water (KL)</TableCell>
                      <TableCell>PF</TableCell>
                      <TableCell>Efficiency</TableCell>
                      <TableCell>kWh/KL</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id} hover>
                        <TableCell>{row.readingCode ?? '—'}</TableCell>
                        <TableCell>{row.readingDate}</TableCell>
                        <TableCell>{row.assetCode ?? 'Scheme'}</TableCell>
                        <TableCell>{fmtNum(row.pumpRunningHours)}</TableCell>
                        <TableCell>{fmtNum(row.energyKwh, 1)}</TableCell>
                        <TableCell>{fmtNum(row.energyCost)}</TableCell>
                        <TableCell>{fmtNum(row.waterPumpedKl, 1)}</TableCell>
                        <TableCell>{fmtNum(row.powerFactor, 3)}</TableCell>
                        <TableCell>{fmtNum(row.pumpEfficiencyPct)}%</TableCell>
                        <TableCell>{fmtNum(row.kwhPerKl, 3)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </>
        )}

        {tab === 1 && (
          <Grid container spacing={1.5}>
            {OM_ENERGY_REPORT_TYPES.map((r) => (
              <Grid item xs={12} sm={6} md={4} key={r.type}>
                <Box sx={{ p: 2, borderRadius: 2, border: '1px solid #e2e8f0', height: '100%' }}>
                  <Typography variant="subtitle2" fontWeight={700} gutterBottom>{r.label}</Typography>
                  <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>{r.description}</Typography>
                  <Button size="small" variant="outlined" startIcon={<AssessmentOutlinedIcon />}
                    disabled={busy} onClick={() => generateReport(r.type)}>
                    Generate
                  </Button>
                </Box>
              </Grid>
            ))}
          </Grid>
        )}
      </SurfaceCard>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: omDialogPaperSx }}>
        <OmDialogHeader stage={7} title="Daily Energy Log" busy={busy} />
        <DialogContent sx={omDialogContentSx}>
          <TextField fullWidth type="date" label="Reading Date" margin="dense" InputLabelProps={{ shrink: true }}
            value={form.readingDate} onChange={(e) => setForm({ ...form, readingDate: e.target.value })} />
          <Grid container spacing={1}>
            {[
              { key: 'pumpRunningHours', label: 'Pump Running Hours' },
              { key: 'energyKwh', label: 'Electricity Consumption (kWh)' },
              { key: 'energyCost', label: 'Energy Cost (INR)' },
              { key: 'waterPumpedKl', label: 'Water Pumped (KL)' },
              { key: 'powerFactor', label: 'Power Factor' },
              { key: 'pumpEfficiencyPct', label: 'Pump Efficiency (%)' },
            ].map((f) => (
              <Grid item xs={6} key={f.key}>
                <TextField fullWidth size="small" margin="dense" label={f.label}
                  value={form[f.key as keyof typeof form]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
              </Grid>
            ))}
          </Grid>
          <BilingualRemarkField
            label="Notes"
            pdfTitle="Energy Monitoring Notes"
            value={parseBilingualText(form.notes)}
            onChange={(v) => setForm({ ...form, notes: serializeBilingualText(v) })}
            minRows={2}
            margin="dense"
          />
        </DialogContent>
        <DialogActions sx={omDialogActionsSx}>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={busy}>Save Reading</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(reportOpen)} onClose={() => setReportOpen(null)} maxWidth="md" fullWidth PaperProps={{ sx: omDialogPaperSx }}>
        <OmDialogHeader stage={7} title={String(reportOpen?.title ?? 'Energy Report')} />
        <DialogContent sx={omDialogContentSx}>
          <Typography variant="caption" color="text.secondary" display="block" mb={2}>
            Period: {String((reportOpen?.period as Record<string, string>)?.from ?? '')} — {String((reportOpen?.period as Record<string, string>)?.to ?? '')}
            {reportOpen?.projectCode ? ` · ${String(reportOpen.projectCode)}` : ''}
          </Typography>
          {reportOpen?.totalCost != null && (
            <Typography variant="body2" mb={1}>Total Cost: ₹{fmtNum(reportOpen.totalCost)} · Total kWh: {fmtNum(reportOpen.totalKwh as number, 1)}</Typography>
          )}
          {reportOpen?.averageKwhPerKl != null && (
            <Typography variant="body2" mb={1}>Average kWh/KL: {fmtNum(reportOpen.averageKwhPerKl as number, 3)}</Typography>
          )}
          {reportOpen?.averageEfficiencyPct != null && (
            <Typography variant="body2" mb={1}>Average Efficiency: {fmtNum(reportOpen.averageEfficiencyPct as number)}%</Typography>
          )}
          {renderReportTable()}
        </DialogContent>
        <DialogActions sx={omDialogActionsSx}>
          <Button onClick={() => setReportOpen(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
