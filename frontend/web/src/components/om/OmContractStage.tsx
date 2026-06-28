import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent,
  FormControl, Grid, InputLabel, MenuItem, Select, Tab, Tabs,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography,
} from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import axios from 'axios';
import { omApi, projectsApi } from '../../services/api';
import SurfaceCard from '../layout/SurfaceCard';
import {
  OM_CONTRACT_KPIS,
  OM_CONTRACT_MONITORING_AREAS,
  OM_CONTRACT_REVIEW_RATINGS,
  complianceColor,
  formatMetricValue,
  type MetricResult,
} from '../../constants/omContracts';
import { dataTableSx } from '../../utils/pagePresentationStyles';
import { OmDialogHeader, omDialogActionsSx, omDialogContentSx, omDialogPaperSx } from './omUi';
import BilingualRemarkField from '../forms/BilingualRemarkField';
import { parseBilingualText, serializeBilingualText } from '../../utils/bilingualText';
import { useCanViewAllDivisions } from '../../utils/divisionAccess';

type ContractRow = {
  id: string;
  contractCode: string;
  contractorName: string;
  contractorContact?: string | null;
  projectCode?: string;
  projectName?: string;
  startDate: string;
  endDate?: string | null;
  status: string;
};

type PerformanceData = {
  overallSlaCompliancePct: number | null;
  metricsMet: number;
  metricsTotal: number;
  monitoring: Record<string, MetricResult>;
  kpis: Record<string, MetricResult>;
};

type AttendanceRow = {
  id: string;
  attendanceDate: string;
  staffRequired: number;
  staffPresent: number;
  attendancePct: number | null;
};

type KpiRow = {
  id: string;
  periodMonth: string;
  waterSupplyHoursPerDay: number | null;
  pumpAvailabilityPct: number | null;
  nrwPct: number | null;
};

type ReviewRow = {
  id: string;
  reviewDate: string;
  overallRating: string;
  overallRatingLabel?: string;
  slaCompliancePct: number | null;
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

function MetricCard({ label, metric }: { label: string; metric?: MetricResult }) {
  if (!metric) return null;
  return (
    <Grid item xs={12} sm={6} md={4}>
      <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', height: '100%' }}>
        <Typography variant="caption" color="text.secondary" fontWeight={700} display="block" mb={0.5}>
          {label}
        </Typography>
        <Typography variant="h6" fontWeight={700}>
          {formatMetricValue(metric.value, metric.unit)}
        </Typography>
        <Box display="flex" gap={0.75} alignItems="center" mt={0.75} flexWrap="wrap">
          <Typography variant="caption" color="text.secondary">
            Target: {metric.lowerIsBetter ? '≤' : '≥'} {metric.target}{metric.unit === '%' ? '%' : ` ${metric.unit}`}
          </Typography>
          {metric.compliant != null && (
            <Chip size="small" label={metric.compliant ? 'Compliant' : 'Below SLA'} color={complianceColor(metric.compliant)} />
          )}
        </Box>
      </Box>
    </Grid>
  );
}

export default function OmContractStage() {
  const canViewAll = useCanViewAllDivisions();
  const [tab, setTab] = useState(0);
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [selectedContract, setSelectedContract] = useState<ContractRow | null>(null);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectOption | null>(null);
  const [summary, setSummary] = useState<Record<string, number | null>>({});
  const [performance, setPerformance] = useState<PerformanceData | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [kpiEntries, setKpiEntries] = useState<KpiRow[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [kpiOpen, setKpiOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  const [createForm, setCreateForm] = useState({
    contractorName: '',
    contractorContact: '',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
    notes: '',
  });

  const [attendanceForm, setAttendanceForm] = useState({
    attendanceDate: new Date().toISOString().slice(0, 10),
    staffRequired: '5',
    staffPresent: '5',
    notes: '',
  });

  const [kpiForm, setKpiForm] = useState({
    periodMonth: new Date().toISOString().slice(0, 7) + '-01',
    waterSupplyHoursPerDay: '20',
    pumpAvailabilityPct: '95',
    nrwPct: '18',
    notes: '',
  });

  const [reviewForm, setReviewForm] = useState({
    reviewDate: new Date().toISOString().slice(0, 10),
    overallRating: 'satisfactory',
    notes: '',
  });

  const loadContracts = useCallback(() => {
    setBusy(true);
    setError('');
    Promise.all([
      omApi.listContracts({ projectCode: selectedProject?.projectCode }),
      omApi.contractSummary(selectedProject?.id),
    ])
      .then(([listRes, sumRes]) => {
        const list = (listRes.data ?? []) as ContractRow[];
        setContracts(list);
        setSummary(sumRes.data ?? {});
        if (list.length && !selectedContract) setSelectedContract(list[0]);
        else if (selectedContract && !list.find((c) => c.id === selectedContract.id)) {
          setSelectedContract(list[0] ?? null);
        }
      })
      .catch((err) => setError(getApiError(err, 'Failed to load contracts')))
      .finally(() => setBusy(false));
  }, [selectedProject, selectedContract]);

  const loadContractDetails = useCallback(() => {
    if (!selectedContract) {
      setPerformance(null);
      setAttendance([]);
      setKpiEntries([]);
      setReviews([]);
      return;
    }
    Promise.all([
      omApi.contractPerformance(selectedContract.id),
      omApi.listContractAttendance(selectedContract.id),
      omApi.listContractKpiEntries(selectedContract.id),
      omApi.listContractReviews(selectedContract.id),
    ])
      .then(([perfRes, attRes, kpiRes, revRes]) => {
        setPerformance(perfRes.data ?? null);
        setAttendance(attRes.data ?? []);
        setKpiEntries(kpiRes.data ?? []);
        setReviews(revRes.data ?? []);
      })
      .catch((err) => setError(getApiError(err, 'Failed to load contract performance')));
  }, [selectedContract]);

  useEffect(() => {
    projectsApi.list()
      .then((res) => {
        const plist = (res.data ?? []) as ProjectOption[];
        setProjects(plist);
        if (plist.length && !selectedProject) setSelectedProject(plist[0]);
      })
      .catch(() => setError('Failed to load projects'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadContracts(); }, [loadContracts]);
  useEffect(() => { loadContractDetails(); }, [loadContractDetails]);

  const handleCreate = () => {
    if (!createForm.contractorName.trim()) {
      setError('Contractor name is required');
      return;
    }
    setBusy(true);
    omApi.createContract({
      contractorName: createForm.contractorName.trim(),
      contractorContact: createForm.contractorContact.trim() || undefined,
      projectCode: selectedProject?.projectCode,
      startDate: createForm.startDate,
      endDate: createForm.endDate || undefined,
      notes: createForm.notes.trim() || undefined,
    })
      .then(() => {
        setCreateOpen(false);
        setCreateForm({
          contractorName: '',
          contractorContact: '',
          startDate: new Date().toISOString().slice(0, 10),
          endDate: '',
          notes: '',
        });
        loadContracts();
      })
      .catch((err) => setError(getApiError(err, 'Failed to create contract')))
      .finally(() => setBusy(false));
  };

  const handleAttendance = () => {
    if (!selectedContract) return;
    setBusy(true);
    omApi.recordContractAttendance(selectedContract.id, {
      attendanceDate: attendanceForm.attendanceDate,
      staffRequired: Number(attendanceForm.staffRequired),
      staffPresent: Number(attendanceForm.staffPresent),
      notes: attendanceForm.notes.trim() || undefined,
    })
      .then(() => {
        setAttendanceOpen(false);
        loadContractDetails();
        loadContracts();
      })
      .catch((err) => setError(getApiError(err, 'Failed to record attendance')))
      .finally(() => setBusy(false));
  };

  const handleKpi = () => {
    if (!selectedContract) return;
    setBusy(true);
    omApi.recordContractKpi(selectedContract.id, {
      periodMonth: kpiForm.periodMonth,
      waterSupplyHoursPerDay: kpiForm.waterSupplyHoursPerDay ? Number(kpiForm.waterSupplyHoursPerDay) : undefined,
      pumpAvailabilityPct: kpiForm.pumpAvailabilityPct ? Number(kpiForm.pumpAvailabilityPct) : undefined,
      nrwPct: kpiForm.nrwPct ? Number(kpiForm.nrwPct) : undefined,
      notes: kpiForm.notes.trim() || undefined,
    })
      .then(() => {
        setKpiOpen(false);
        loadContractDetails();
      })
      .catch((err) => setError(getApiError(err, 'Failed to record KPI entry')))
      .finally(() => setBusy(false));
  };

  const handleReview = () => {
    if (!selectedContract) return;
    setBusy(true);
    omApi.createContractReview(selectedContract.id, {
      reviewDate: reviewForm.reviewDate,
      overallRating: reviewForm.overallRating,
      notes: reviewForm.notes.trim() || undefined,
    })
      .then(() => {
        setReviewOpen(false);
        loadContractDetails();
        loadContracts();
      })
      .catch((err) => setError(getApiError(err, 'Failed to submit performance review')))
      .finally(() => setBusy(false));
  };

  return (
    <>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Grid container spacing={2} mb={2}>
        <Grid item xs={6} sm={3}>
          <SurfaceCard title="Active Contracts">
            <Typography variant="h5" fontWeight={700} color="primary.main">{summary.activeContracts ?? 0}</Typography>
          </SurfaceCard>
        </Grid>
        <Grid item xs={6} sm={3}>
          <SurfaceCard title="Avg SLA Compliance">
            <Typography variant="h5" fontWeight={700}>
              {summary.avgSlaCompliancePct != null ? `${summary.avgSlaCompliancePct}%` : '—'}
            </Typography>
          </SurfaceCard>
        </Grid>
        <Grid item xs={6} sm={3}>
          <SurfaceCard title="Below SLA">
            <Typography variant="h5" fontWeight={700} color="error.main">{summary.contractsBelowSla ?? 0}</Typography>
          </SurfaceCard>
        </Grid>
        <Grid item xs={6} sm={3}>
          <SurfaceCard title="Under Review">
            <Typography variant="h5" fontWeight={700} color="warning.main">{summary.underReview ?? 0}</Typography>
          </SurfaceCard>
        </Grid>
      </Grid>

      <SurfaceCard
        header={(
          <Box display="flex" justifyContent="space-between" alignItems="center" width="100%" flexWrap="wrap" gap={1}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem' }}>O&M Contracts</Typography>
            <Box display="flex" gap={1} flexWrap="wrap" alignItems="center">
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Scheme / Project</InputLabel>
                <Select
                  label="Scheme / Project"
                  value={selectedProject?.id ?? ''}
                  onChange={(e) => {
                    const p = projects.find((x) => x.id === e.target.value) ?? null;
                    setSelectedProject(p);
                    setSelectedContract(null);
                  }}
                >
                  {canViewAll && <MenuItem value="">All schemes</MenuItem>}
                  {projects.map((p) => (
                    <MenuItem key={p.id} value={p.id}>{p.projectCode} — {p.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel>Contract</InputLabel>
                <Select
                  label="Contract"
                  value={selectedContract?.id ?? ''}
                  onChange={(e) => {
                    const c = contracts.find((x) => x.id === e.target.value) ?? null;
                    setSelectedContract(c);
                  }}
                >
                  {contracts.map((c) => (
                    <MenuItem key={c.id} value={c.id}>{c.contractCode} — {c.contractorName}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button variant="contained" size="small" startIcon={<AddOutlinedIcon />} onClick={() => setCreateOpen(true)}>
                New Contract
              </Button>
            </Box>
          </Box>
        )}
      >
        <TableContainer>
          <Table size="small" sx={dataTableSx}>
            <TableHead>
              <TableRow>
                <TableCell>Code</TableCell>
                <TableCell>Contractor</TableCell>
                <TableCell>Project</TableCell>
                <TableCell>Period</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {contracts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography variant="body2" color="text.secondary" py={2}>
                      {busy ? 'Loading…' : 'No O&M contracts registered yet.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {contracts.map((c) => (
                <TableRow
                  key={c.id}
                  hover
                  selected={selectedContract?.id === c.id}
                  onClick={() => setSelectedContract(c)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell>{c.contractCode}</TableCell>
                  <TableCell>{c.contractorName}</TableCell>
                  <TableCell>{c.projectCode ?? '—'}</TableCell>
                  <TableCell>{c.startDate}{c.endDate ? ` → ${c.endDate}` : ''}</TableCell>
                  <TableCell>
                    <Chip size="small" label={c.status.replace(/_/g, ' ')} color={c.status === 'active' ? 'success' : 'default'} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </SurfaceCard>

      {selectedContract && (
        <Box mt={2}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
            <Tab label="Performance Dashboard" />
            <Tab label="Attendance" />
            <Tab label="KPI Entries" />
            <Tab label="Reviews" />
          </Tabs>

          {tab === 0 && performance && (
            <SurfaceCard
              title={`Performance — ${selectedContract.contractorName}`}
              header={(
                <Box display="flex" justifyContent="space-between" alignItems="center" width="100%">
                  <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem' }}>
                    Performance — {selectedContract.contractorName}
                  </Typography>
                  <Button size="small" variant="outlined" startIcon={<AssessmentOutlinedIcon />} onClick={() => setReviewOpen(true)}>
                    Performance Review
                  </Button>
                </Box>
              )}
            >
              <Box mb={2} display="flex" gap={1} flexWrap="wrap" alignItems="center">
                <Chip
                  label={`Overall SLA: ${performance.overallSlaCompliancePct ?? '—'}%`}
                  color={performance.overallSlaCompliancePct != null && performance.overallSlaCompliancePct >= 80 ? 'success' : 'warning'}
                />
                <Typography variant="caption" color="text.secondary">
                  {performance.metricsMet}/{performance.metricsTotal} metrics meeting SLA
                </Typography>
              </Box>

              <Typography variant="subtitle2" fontWeight={700} gutterBottom>Monitoring</Typography>
              <Grid container spacing={1.5} mb={2}>
                {OM_CONTRACT_MONITORING_AREAS.map((area) => (
                  <MetricCard key={area.key} label={area.label} metric={performance.monitoring[area.key]} />
                ))}
              </Grid>

              <Typography variant="subtitle2" fontWeight={700} gutterBottom>KPIs</Typography>
              <Grid container spacing={1.5}>
                {OM_CONTRACT_KPIS.map((kpi) => (
                  <MetricCard key={kpi.key} label={kpi.label} metric={performance.kpis[kpi.key]} />
                ))}
              </Grid>
            </SurfaceCard>
          )}

          {tab === 1 && (
            <SurfaceCard
              header={(
                <Box display="flex" justifyContent="space-between" alignItems="center" width="100%">
                  <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem' }}>Daily Attendance</Typography>
                  <Button size="small" variant="contained" startIcon={<AddOutlinedIcon />} onClick={() => setAttendanceOpen(true)}>
                    Record Attendance
                  </Button>
                </Box>
              )}
            >
              <TableContainer>
                <Table size="small" sx={dataTableSx}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Required</TableCell>
                      <TableCell>Present</TableCell>
                      <TableCell>Attendance %</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {attendance.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          <Typography variant="body2" color="text.secondary" py={2}>No attendance records yet.</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                    {attendance.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>{a.attendanceDate}</TableCell>
                        <TableCell>{a.staffRequired}</TableCell>
                        <TableCell>{a.staffPresent}</TableCell>
                        <TableCell>{a.attendancePct != null ? `${a.attendancePct}%` : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </SurfaceCard>
          )}

          {tab === 2 && (
            <SurfaceCard
              header={(
                <Box display="flex" justifyContent="space-between" alignItems="center" width="100%">
                  <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem' }}>Monthly KPI Entries</Typography>
                  <Button size="small" variant="contained" startIcon={<AddOutlinedIcon />} onClick={() => setKpiOpen(true)}>
                    Record KPIs
                  </Button>
                </Box>
              )}
            >
              <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
                Enter Water Supply Hours, Pump Availability, and NRW for monthly contractor KPI tracking.
              </Typography>
              <TableContainer>
                <Table size="small" sx={dataTableSx}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Period</TableCell>
                      <TableCell>Supply Hours/Day</TableCell>
                      <TableCell>Pump Availability %</TableCell>
                      <TableCell>NRW %</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {kpiEntries.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          <Typography variant="body2" color="text.secondary" py={2}>No KPI entries yet.</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                    {kpiEntries.map((k) => (
                      <TableRow key={k.id}>
                        <TableCell>{k.periodMonth}</TableCell>
                        <TableCell>{k.waterSupplyHoursPerDay ?? '—'}</TableCell>
                        <TableCell>{k.pumpAvailabilityPct != null ? `${k.pumpAvailabilityPct}%` : '—'}</TableCell>
                        <TableCell>{k.nrwPct != null ? `${k.nrwPct}%` : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </SurfaceCard>
          )}

          {tab === 3 && (
            <SurfaceCard title="Performance Reviews">
              <TableContainer>
                <Table size="small" sx={dataTableSx}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Review Date</TableCell>
                      <TableCell>Rating</TableCell>
                      <TableCell>SLA Compliance</TableCell>
                      <TableCell>Notes</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {reviews.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          <Typography variant="body2" color="text.secondary" py={2}>No performance reviews yet.</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                    {reviews.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.reviewDate}</TableCell>
                        <TableCell>{r.overallRatingLabel ?? r.overallRating}</TableCell>
                        <TableCell>{r.slaCompliancePct != null ? `${r.slaCompliancePct}%` : '—'}</TableCell>
                        <TableCell>{r.notes ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </SurfaceCard>
          )}
        </Box>
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: omDialogPaperSx }}>
        <OmDialogHeader stage={11} title="Register O&M Contract" busy={busy} />
        <DialogContent sx={omDialogContentSx}>
          <Grid container spacing={2} mt={0.5}>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Contractor Name" required
                value={createForm.contractorName} onChange={(e) => setCreateForm({ ...createForm, contractorName: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Contact"
                value={createForm.contractorContact} onChange={(e) => setCreateForm({ ...createForm, contractorContact: e.target.value })} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Start Date" type="date" InputLabelProps={{ shrink: true }}
                value={createForm.startDate} onChange={(e) => setCreateForm({ ...createForm, startDate: e.target.value })} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="End Date" type="date" InputLabelProps={{ shrink: true }}
                value={createForm.endDate} onChange={(e) => setCreateForm({ ...createForm, endDate: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <BilingualRemarkField
                label="Notes"
                pdfTitle="O&M Contract Notes"
                value={parseBilingualText(createForm.notes)}
                onChange={(v) => setCreateForm({ ...createForm, notes: serializeBilingualText(v) })}
                minRows={2}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={omDialogActionsSx}>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={busy}>Create Contract</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={attendanceOpen} onClose={() => setAttendanceOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: omDialogPaperSx }}>
        <OmDialogHeader stage={11} title="Record Attendance" busy={busy} />
        <DialogContent sx={omDialogContentSx}>
          <Grid container spacing={2} mt={0.5}>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Date" type="date" InputLabelProps={{ shrink: true }}
                value={attendanceForm.attendanceDate} onChange={(e) => setAttendanceForm({ ...attendanceForm, attendanceDate: e.target.value })} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Staff Required" type="number"
                value={attendanceForm.staffRequired} onChange={(e) => setAttendanceForm({ ...attendanceForm, staffRequired: e.target.value })} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Staff Present" type="number"
                value={attendanceForm.staffPresent} onChange={(e) => setAttendanceForm({ ...attendanceForm, staffPresent: e.target.value })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={omDialogActionsSx}>
          <Button onClick={() => setAttendanceOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAttendance} disabled={busy}>Save</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={kpiOpen} onClose={() => setKpiOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: omDialogPaperSx }}>
        <OmDialogHeader stage={11} title="Record Monthly KPIs" busy={busy} />
        <DialogContent sx={omDialogContentSx}>
          <Grid container spacing={2} mt={0.5}>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Period (month)" type="date" InputLabelProps={{ shrink: true }}
                value={kpiForm.periodMonth} onChange={(e) => setKpiForm({ ...kpiForm, periodMonth: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" label="Water Supply Hours/Day" type="number"
                value={kpiForm.waterSupplyHoursPerDay} onChange={(e) => setKpiForm({ ...kpiForm, waterSupplyHoursPerDay: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" label="Pump Availability %" type="number"
                value={kpiForm.pumpAvailabilityPct} onChange={(e) => setKpiForm({ ...kpiForm, pumpAvailabilityPct: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" label="NRW %" type="number"
                value={kpiForm.nrwPct} onChange={(e) => setKpiForm({ ...kpiForm, nrwPct: e.target.value })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={omDialogActionsSx}>
          <Button onClick={() => setKpiOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleKpi} disabled={busy}>Save KPIs</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={reviewOpen} onClose={() => setReviewOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: omDialogPaperSx }}>
        <OmDialogHeader stage={11} title="Performance Review" busy={busy} />
        <DialogContent sx={omDialogContentSx}>
          <Grid container spacing={2} mt={0.5}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Review Date" type="date" InputLabelProps={{ shrink: true }}
                value={reviewForm.reviewDate} onChange={(e) => setReviewForm({ ...reviewForm, reviewDate: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Overall Rating</InputLabel>
                <Select label="Overall Rating" value={reviewForm.overallRating}
                  onChange={(e) => setReviewForm({ ...reviewForm, overallRating: e.target.value })}>
                  {OM_CONTRACT_REVIEW_RATINGS.map((r) => (
                    <MenuItem key={r.code} value={r.code}>{r.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Review Notes" multiline rows={3}
                value={reviewForm.notes} onChange={(e) => setReviewForm({ ...reviewForm, notes: e.target.value })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={omDialogActionsSx}>
          <Button onClick={() => setReviewOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleReview} disabled={busy}>Submit Review</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
