import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent,
  FormControl, Grid, InputLabel, LinearProgress, MenuItem, Select, Tab, Tabs,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography,
} from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import AutoFixHighOutlinedIcon from '@mui/icons-material/AutoFixHighOutlined';
import axios from 'axios';
import { omApi, projectsApi } from '../../services/api';
import SurfaceCard from '../layout/SurfaceCard';
import {
  OM_CONDITION_GRADES,
  OM_LIFECYCLE_CATEGORIES,
  OM_RENEWAL_PLAN_TYPES,
  conditionChipColor,
  healthColor,
  planStatusColor,
} from '../../constants/omLifecycle';
import { dataTableSx } from '../../utils/pagePresentationStyles';
import { OmDialogHeader, omDialogActionsSx, omDialogContentSx, omDialogPaperSx } from './omUi';
import { useCanViewAllDivisions } from '../../utils/divisionAccess';

type AssetRow = {
  id: string;
  assetCode: string;
  name: string | null;
  typeLabel: string | null;
  lifecycleCategory: string | null;
  lifecycleCategoryLabel: string | null;
  ageYears: number | null;
  designLifeYears: number;
  healthIndex: number;
  conditionGrade: string;
  conditionGradeLabel: string;
  remainingUsefulLifeYears: number;
  recommendedAction: string | null;
  projectCode?: string | null;
};

type PlanRow = {
  id: string;
  planNo: string;
  planType: string;
  planTypeLabel?: string;
  planYear?: number | null;
  title: string;
  lifecycleCategoryLabel?: string;
  assetCode?: string | null;
  healthIndexAtPlan?: number | null;
  remainingUsefulLifeYears?: number | null;
  estimatedCost?: number | null;
  priority: string;
  status: string;
  targetDate?: string | null;
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

export default function OmLifecycleStage() {
  const canViewAll = useCanViewAllDivisions();
  const [tab, setTab] = useState(0);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectOption | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [summary, setSummary] = useState<Record<string, number | null>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [assessOpen, setAssessOpen] = useState<AssetRow | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [annualOpen, setAnnualOpen] = useState(false);

  const [assessForm, setAssessForm] = useState({
    assessmentDate: new Date().toISOString().slice(0, 10),
    conditionGrade: 'good',
    healthIndex: '75',
    conditionNotes: '',
  });

  const [planForm, setPlanForm] = useState({
    planType: 'rehabilitation',
    lifecycleCategory: 'pumps',
    title: '',
    description: '',
    estimatedCost: '',
    priority: 'medium',
    targetDate: '',
  });

  const [annualForm, setAnnualForm] = useState({
    planYear: String(new Date().getFullYear()),
  });

  const load = useCallback(() => {
    setBusy(true);
    setError('');
    Promise.all([
      omApi.listLifecycleAssets({
        projectCode: selectedProject?.projectCode,
        lifecycleCategory: categoryFilter || undefined,
      }),
      omApi.listRenewalPlans({ projectCode: selectedProject?.projectCode }),
      omApi.lifecycleSummary(selectedProject?.id),
    ])
      .then(([assetRes, planRes, sumRes]) => {
        setAssets(assetRes.data ?? []);
        setPlans(planRes.data ?? []);
        setSummary(sumRes.data ?? {});
      })
      .catch((err) => setError(getApiError(err, 'Failed to load lifecycle data')))
      .finally(() => setBusy(false));
  }, [selectedProject, categoryFilter]);

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

  useEffect(() => { load(); }, [load]);

  const handleAssess = () => {
    if (!assessOpen) return;
    setBusy(true);
    omApi.assessLifecycleAsset(assessOpen.id, {
      assessmentDate: assessForm.assessmentDate,
      conditionGrade: assessForm.conditionGrade,
      healthIndex: Number(assessForm.healthIndex),
      conditionNotes: assessForm.conditionNotes.trim() || undefined,
    })
      .then(() => {
        setAssessOpen(null);
        load();
      })
      .catch((err) => setError(getApiError(err, 'Failed to save assessment')))
      .finally(() => setBusy(false));
  };

  const handleCreatePlan = () => {
    if (!planForm.title.trim()) {
      setError('Plan title is required');
      return;
    }
    setBusy(true);
    omApi.createRenewalPlan({
      planType: planForm.planType,
      lifecycleCategory: planForm.lifecycleCategory,
      title: planForm.title.trim(),
      description: planForm.description.trim() || undefined,
      estimatedCost: planForm.estimatedCost ? Number(planForm.estimatedCost) : undefined,
      priority: planForm.priority,
      targetDate: planForm.targetDate || undefined,
      projectCode: selectedProject?.projectCode,
    })
      .then(() => {
        setPlanOpen(false);
        setPlanForm({ planType: 'rehabilitation', lifecycleCategory: 'pumps', title: '', description: '', estimatedCost: '', priority: 'medium', targetDate: '' });
        load();
      })
      .catch((err) => setError(getApiError(err, 'Failed to create plan')))
      .finally(() => setBusy(false));
  };

  const handleGeneratePlans = () => {
    setBusy(true);
    omApi.generateRenewalPlans({
      projectCode: selectedProject?.projectCode,
      lifecycleCategory: categoryFilter || undefined,
    })
      .then((res) => {
        setError('');
        load();
        if (res.data?.generated === 0) {
          setError('No new rehabilitation or replacement plans were needed for current asset health.');
        }
      })
      .catch((err) => setError(getApiError(err, 'Failed to generate plans')))
      .finally(() => setBusy(false));
  };

  const handleAnnualPlan = () => {
    setBusy(true);
    omApi.generateAnnualRenewalPlan({
      planYear: Number(annualForm.planYear),
      projectCode: selectedProject?.projectCode,
    })
      .then(() => {
        setAnnualOpen(false);
        load();
      })
      .catch((err) => setError(getApiError(err, 'Failed to generate annual plan')))
      .finally(() => setBusy(false));
  };

  const rehabPlans = plans.filter((p) => p.planType === 'rehabilitation');
  const replacementPlans = plans.filter((p) => p.planType === 'replacement');
  const annualPlans = plans.filter((p) => p.planType === 'annual_capital');

  return (
    <>
      {error && <Alert severity={error.includes('No new') ? 'info' : 'error'} sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Grid container spacing={2} mb={2}>
        <Grid item xs={6} sm={3}>
          <SurfaceCard title="Tracked Assets">
            <Typography variant="h5" fontWeight={700}>{summary.trackedAssets ?? 0}</Typography>
          </SurfaceCard>
        </Grid>
        <Grid item xs={6} sm={3}>
          <SurfaceCard title="Avg Health Index">
            <Typography variant="h5" fontWeight={700} color="primary.main">{summary.avgHealthIndex ?? '—'}</Typography>
          </SurfaceCard>
        </Grid>
        <Grid item xs={6} sm={3}>
          <SurfaceCard title="Critical / Poor">
            <Typography variant="h5" fontWeight={700} color="error.main">{summary.criticalAssets ?? 0}</Typography>
          </SurfaceCard>
        </Grid>
        <Grid item xs={6} sm={3}>
          <SurfaceCard title="Replacement Due (≤2yr)">
            <Typography variant="h5" fontWeight={700} color="warning.main">{summary.replacementDue ?? 0}</Typography>
          </SurfaceCard>
        </Grid>
      </Grid>

      <SurfaceCard
        header={(
          <Box display="flex" justifyContent="space-between" alignItems="center" width="100%" flexWrap="wrap" gap={1}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem' }}>Asset Lifecycle Register</Typography>
            <Box display="flex" gap={1} flexWrap="wrap" alignItems="center">
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Scheme / Project</InputLabel>
                <Select
                  label="Scheme / Project"
                  value={selectedProject?.id ?? ''}
                  onChange={(e) => {
                    setSelectedProject(projects.find((x) => x.id === e.target.value) ?? null);
                  }}
                >
                  {canViewAll && <MenuItem value="">All schemes</MenuItem>}
                  {projects.map((p) => (
                    <MenuItem key={p.id} value={p.id}>{p.projectCode} — {p.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Asset Category</InputLabel>
                <Select label="Asset Category" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                  <MenuItem value="">All categories</MenuItem>
                  {OM_LIFECYCLE_CATEGORIES.map((c) => (
                    <MenuItem key={c.category} value={c.category}>{c.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button size="small" variant="outlined" startIcon={<AutoFixHighOutlinedIcon />} onClick={handleGeneratePlans} disabled={busy}>
                Auto-Generate Plans
              </Button>
              <Button size="small" variant="outlined" onClick={() => setAnnualOpen(true)} disabled={busy}>
                Annual Renewal Plan
              </Button>
              <Button size="small" variant="contained" startIcon={<AddOutlinedIcon />} onClick={() => setPlanOpen(true)}>
                New Plan
              </Button>
            </Box>
          </Box>
        )}
      >
        {busy && <LinearProgress sx={{ mb: 1 }} />}
        <TableContainer>
          <Table size="small" sx={dataTableSx}>
            <TableHead>
              <TableRow>
                <TableCell>Asset</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Age (yr)</TableCell>
                <TableCell>Health Index</TableCell>
                <TableCell>Condition</TableCell>
                <TableCell>RUL (yr)</TableCell>
                <TableCell>Recommendation</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {assets.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography variant="body2" color="text.secondary" py={2}>
                      No lifecycle-tracked assets found. Register assets in Stage 2 first.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {assets.map((a) => (
                <TableRow key={a.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{a.assetCode}</Typography>
                    <Typography variant="caption" color="text.secondary">{a.name ?? a.typeLabel}</Typography>
                  </TableCell>
                  <TableCell>{a.lifecycleCategoryLabel ?? '—'}</TableCell>
                  <TableCell>{a.ageYears ?? '—'} / {a.designLifeYears}</TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      <LinearProgress
                        variant="determinate"
                        value={a.healthIndex}
                        color={healthColor(a.healthIndex)}
                        sx={{ flex: 1, height: 6, borderRadius: 1 }}
                      />
                      <Typography variant="caption" fontWeight={700}>{a.healthIndex}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={a.conditionGradeLabel} color={conditionChipColor(a.conditionGrade)} />
                  </TableCell>
                  <TableCell>{a.remainingUsefulLifeYears}</TableCell>
                  <TableCell>
                    <Typography variant="caption">{a.recommendedAction}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => {
                      setAssessOpen(a);
                      setAssessForm({
                        assessmentDate: new Date().toISOString().slice(0, 10),
                        conditionGrade: a.conditionGrade,
                        healthIndex: String(a.healthIndex),
                        conditionNotes: '',
                      });
                    }}>
                      Assess
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </SurfaceCard>

      <Box mt={2}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab label={`Rehabilitation (${rehabPlans.length})`} />
          <Tab label={`Replacement (${replacementPlans.length})`} />
          <Tab label={`Annual Capital (${annualPlans.length})`} />
        </Tabs>

        <SurfaceCard title={tab === 0 ? 'Rehabilitation Plans' : tab === 1 ? 'Replacement Plans' : 'Annual Capital Renewal Plans'}>
          <TableContainer>
            <Table size="small" sx={dataTableSx}>
              <TableHead>
                <TableRow>
                  <TableCell>Plan No.</TableCell>
                  <TableCell>Title</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Asset</TableCell>
                  <TableCell>Health / RUL</TableCell>
                  <TableCell>Est. Cost</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(tab === 0 ? rehabPlans : tab === 1 ? replacementPlans : annualPlans).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography variant="body2" color="text.secondary" py={2}>No plans in this category yet.</Typography>
                    </TableCell>
                  </TableRow>
                )}
                {(tab === 0 ? rehabPlans : tab === 1 ? replacementPlans : annualPlans).map((p) => (
                  <TableRow key={p.id} hover>
                    <TableCell>{p.planNo}</TableCell>
                    <TableCell>{p.title}</TableCell>
                    <TableCell>{p.lifecycleCategoryLabel}</TableCell>
                    <TableCell>{p.assetCode ?? (p.planType === 'annual_capital' ? 'Programme' : '—')}</TableCell>
                    <TableCell>
                      {p.healthIndexAtPlan != null ? `HI ${p.healthIndexAtPlan}` : '—'}
                      {p.remainingUsefulLifeYears != null ? ` · ${p.remainingUsefulLifeYears}yr RUL` : ''}
                    </TableCell>
                    <TableCell>{p.estimatedCost != null ? `₹${p.estimatedCost.toLocaleString()}` : '—'}</TableCell>
                    <TableCell>
                      <Chip size="small" label={p.status} color={planStatusColor(p.status)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </SurfaceCard>
      </Box>

      <Dialog open={!!assessOpen} onClose={() => setAssessOpen(null)} maxWidth="sm" fullWidth PaperProps={{ sx: omDialogPaperSx }}>
        <OmDialogHeader stage={12} title="Assess Asset" subtitle={assessOpen?.assetCode} busy={busy} />
        <DialogContent sx={omDialogContentSx}>
          <Grid container spacing={2} mt={0.5}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Assessment Date" type="date" InputLabelProps={{ shrink: true }}
                value={assessForm.assessmentDate} onChange={(e) => setAssessForm({ ...assessForm, assessmentDate: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Condition Grade</InputLabel>
                <Select label="Condition Grade" value={assessForm.conditionGrade}
                  onChange={(e) => setAssessForm({ ...assessForm, conditionGrade: e.target.value })}>
                  {OM_CONDITION_GRADES.map((g) => (
                    <MenuItem key={g.code} value={g.code}>{g.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Health Index (0–100)" type="number"
                value={assessForm.healthIndex} onChange={(e) => setAssessForm({ ...assessForm, healthIndex: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Condition Notes" multiline rows={3}
                value={assessForm.conditionNotes} onChange={(e) => setAssessForm({ ...assessForm, conditionNotes: e.target.value })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={omDialogActionsSx}>
          <Button onClick={() => setAssessOpen(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleAssess} disabled={busy}>Save Assessment</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={planOpen} onClose={() => setPlanOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: omDialogPaperSx }}>
        <OmDialogHeader stage={12} title="Create Renewal Plan" busy={busy} />
        <DialogContent sx={omDialogContentSx}>
          <Grid container spacing={2} mt={0.5}>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Plan Type</InputLabel>
                <Select label="Plan Type" value={planForm.planType} onChange={(e) => setPlanForm({ ...planForm, planType: e.target.value })}>
                  {OM_RENEWAL_PLAN_TYPES.filter((t) => t.code !== 'annual_capital').map((t) => (
                    <MenuItem key={t.code} value={t.code}>{t.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Category</InputLabel>
                <Select label="Category" value={planForm.lifecycleCategory} onChange={(e) => setPlanForm({ ...planForm, lifecycleCategory: e.target.value })}>
                  {OM_LIFECYCLE_CATEGORIES.map((c) => (
                    <MenuItem key={c.category} value={c.category}>{c.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Title" required
                value={planForm.title} onChange={(e) => setPlanForm({ ...planForm, title: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Description" multiline rows={2}
                value={planForm.description} onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Estimated Cost (₹)" type="number"
                value={planForm.estimatedCost} onChange={(e) => setPlanForm({ ...planForm, estimatedCost: e.target.value })} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Target Date" type="date" InputLabelProps={{ shrink: true }}
                value={planForm.targetDate} onChange={(e) => setPlanForm({ ...planForm, targetDate: e.target.value })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={omDialogActionsSx}>
          <Button onClick={() => setPlanOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreatePlan} disabled={busy}>Create Plan</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={annualOpen} onClose={() => setAnnualOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: omDialogPaperSx }}>
        <OmDialogHeader stage={12} title="Generate Annual Capital Renewal Plan" busy={busy} />
        <DialogContent sx={omDialogContentSx}>
          <TextField
            fullWidth size="small" label="Plan Year" type="number" sx={{ mt: 2 }}
            value={annualForm.planYear}
            onChange={(e) => setAnnualForm({ planYear: e.target.value })}
            helperText="Consolidates all draft rehabilitation and replacement plans for the selected scheme"
          />
        </DialogContent>
        <DialogActions sx={omDialogActionsSx}>
          <Button onClick={() => setAnnualOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAnnualPlan} disabled={busy}>Generate</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
