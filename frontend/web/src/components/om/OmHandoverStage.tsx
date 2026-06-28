import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent,
  FormControl, FormControlLabel, Grid, InputLabel, LinearProgress, MenuItem, Select,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { omApi, projectsApi } from '../../services/api';
import SurfaceCard from '../layout/SurfaceCard';
import {
  HANDOVER_STATUS_LABELS,
  HANDOVER_VERIFICATIONS,
  OM_AGENCY_OPTIONS,
  emptyHandoverForm,
  type HandoverFormState,
} from '../../constants/omHandover';
import OmHandoverDocuments from './OmHandoverDocuments';
import { dataTableSx } from '../../utils/pagePresentationStyles';
import { OmDialogHeader, omDialogActionsSx, omDialogContentSx, omDialogPaperSx } from './omUi';

type ProjectOption = { id: string; name: string; projectCode: string };

function buildHandoverPayload(form: HandoverFormState, selectedProject: ProjectOption | null) {
  const payload: Record<string, unknown> = {
    schemeName: form.schemeName.trim(),
    omAgencyType: form.omAgencyType,
    omAgencyName: form.omAgencyName.trim(),
    completionVerified: form.completionVerified,
    commissioningVerified: form.commissioningVerified,
    asBuiltVerified: form.asBuiltVerified,
    gisMappingVerified: form.gisMappingVerified,
    assetRegisterVerified: form.assetRegisterVerified,
    fhtcVerified: form.fhtcVerified,
    omManualVerified: form.omManualVerified,
  };
  if (selectedProject) {
    if (selectedProject.id && selectedProject.id !== 'undefined') {
      payload.projectId = selectedProject.id;
    }
    payload.projectCode = selectedProject.projectCode;
  } else if (form.projectId?.trim()) {
    payload.projectId = form.projectId.trim();
  }
  return payload;
}

type HandoverRecord = Record<string, unknown> & {
  id: string;
  schemeName: string;
  status: string;
  omAgencyName?: string;
  omAgencyType?: string;
  createdAt?: string;
  verificationProgress?: { done: number; total: number; pct: number };
  outputs?: {
    handoverCertificate?: Record<string, unknown>;
    responsibilityMatrix?: Array<Record<string, unknown>>;
    assetInventoryRegister?: Array<Record<string, unknown>>;
    gisAssetRegister?: Array<Record<string, unknown>>;
    generatedAt?: string;
  };
};

function verificationLabel(h: HandoverRecord): string {
  const vp = h.verificationProgress;
  if (vp) return `${vp.done}/${vp.total}`;
  return 'In progress';
}

interface Props {
  handovers: HandoverRecord[];
  onRefresh: () => void;
}

export default function OmHandoverStage({ handovers, onRefresh }: Props) {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectOption | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<HandoverFormState>(emptyHandoverForm());
  const [detail, setDetail] = useState<HandoverRecord | null>(null);
  const [prefillHint, setPrefillHint] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    projectsApi.list()
      .then((r) => {
        const list = Array.isArray(r.data) ? r.data : [];
        setProjects(list
          .filter((p: { id?: string; projectCode?: string }) => p.id && p.projectCode)
          .map((p: { id: string; name: string; projectCode: string }) => ({
            id: String(p.id),
            name: p.name,
            projectCode: p.projectCode,
          })));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (form.projectId && projects.length && !selectedProject) {
      const linked = projects.find((p) => p.id === form.projectId) ?? null;
      if (linked) setSelectedProject(linked);
    }
  }, [form.projectId, projects, selectedProject]);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyHandoverForm());
    setSelectedProject(null);
    setDetail(null);
    setPrefillHint('');
    setError('');
    setDialogOpen(true);
  };

  const openEdit = async (id: string) => {
    setError('');
    setBusy(true);
    try {
      const { data } = await omApi.getHandover(id);
      setEditingId(id);
      setDetail(data);
      setForm({
        schemeName: String(data.schemeName ?? ''),
        projectId: String(data.projectId ?? ''),
        omAgencyType: String(data.omAgencyType ?? 'department'),
        omAgencyName: String(data.omAgencyName ?? ''),
        completionVerified: Boolean(data.completionVerified),
        commissioningVerified: Boolean(data.commissioningVerified),
        asBuiltVerified: Boolean(data.asBuiltVerified),
        gisMappingVerified: Boolean(data.gisMappingVerified),
        assetRegisterVerified: Boolean(data.assetRegisterVerified),
        fhtcVerified: Boolean(data.fhtcVerified),
        omManualVerified: Boolean(data.omManualVerified),
      });
      const linked = projects.find((p) => p.id === String(data.projectId ?? '')) ?? null;
      setSelectedProject(linked);
      setDialogOpen(true);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to load handover');
    } finally {
      setBusy(false);
    }
  };

  const applyPrefill = useCallback(async (projectId: string) => {
    if (!projectId) return;
    try {
      const { data } = await omApi.getHandoverPrefill(projectId);
      const s = data.suggested;
      setForm((f) => ({
        ...f,
        schemeName: s.schemeName ?? f.schemeName,
        projectId,
        completionVerified: Boolean(s.completionVerified),
        commissioningVerified: Boolean(s.commissioningVerified),
        asBuiltVerified: Boolean(s.asBuiltVerified),
        gisMappingVerified: Boolean(s.gisMappingVerified),
        assetRegisterVerified: Boolean(s.assetRegisterVerified),
        fhtcVerified: Boolean(s.fhtcVerified),
        omManualVerified: Boolean(s.omManualVerified),
      }));
      setPrefillHint(
        `Prefilled from project: FHTC ${data.hints.fhtcCompletionPct}%, GIS ${data.hints.gisMappingPct}%, `
        + `${data.hints.commissionedAssetCount}/${data.hints.assetCount} assets commissioned`,
      );
    } catch {
      setPrefillHint('Could not prefill from project');
    }
  }, []);

  const verificationPct = Math.round(
    (HANDOVER_VERIFICATIONS.filter((v) => form[v.key as keyof HandoverFormState]).length
      / HANDOVER_VERIFICATIONS.length) * 100,
  );

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const payload = buildHandoverPayload(form, selectedProject);
      if (editingId) {
        await omApi.updateHandover(editingId, payload);
      } else {
        const { data } = await omApi.createHandover(payload);
        setEditingId(String(data.id));
      }
      onRefresh();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const generate = async () => {
    setBusy(true);
    setError('');
    try {
      let id = editingId;
      const payload = buildHandoverPayload(form, selectedProject);
      if (!id) {
        const { data } = await omApi.createHandover(payload);
        id = String(data.id);
        setEditingId(id);
      } else {
        await omApi.updateHandover(id, payload);
      }
      const { data } = await omApi.generateHandover(id);
      setDetail(data);
      onRefresh();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Generate failed');
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!editingId) return;
    setBusy(true);
    setError('');
    try {
      await omApi.submitHandover(editingId);
      setDialogOpen(false);
      onRefresh();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Submit failed');
    } finally {
      setBusy(false);
    }
  };

  const outputs = detail?.outputs ?? (detail?.responsibilityMatrix as { outputs?: HandoverRecord['outputs'] })?.outputs;

  const isLocked = detail?.status && !['draft', 'rejected'].includes(String(detail.status));

  return (
    <>
      <SurfaceCard
        header={(
          <Box display="flex" justifyContent="space-between" alignItems="center" width="100%">
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem' }}>Asset Handover Register</Typography>
              <Typography variant="caption" color="text.secondary">
                Post-commissioning verification, document generation & O&M agency assignment
              </Typography>
            </Box>
            <Button variant="contained" size="small" onClick={openNew}>Initiate Handover</Button>
          </Box>
        )}
      >
        {handovers.length > 0 ? (
          <TableContainer sx={{ ...dataTableSx(), maxWidth: '100%', overflowX: 'auto' }}>
            <Table
              size="small"
              stickyHeader
              sx={{
                tableLayout: 'fixed',
                minWidth: 720,
                '& .MuiTableCell-root': {
                  verticalAlign: 'middle',
                  py: 1.25,
                  px: 1.5,
                  borderColor: '#e2e8f0',
                },
                '& .MuiTableCell-head': {
                  whiteSpace: 'nowrap',
                },
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: '34%' }}>Scheme</TableCell>
                  <TableCell sx={{ width: '14%' }}>Agency</TableCell>
                  <TableCell align="center" sx={{ width: '12%' }}>Verification</TableCell>
                  <TableCell align="center" sx={{ width: '14%' }}>Status</TableCell>
                  <TableCell align="right" sx={{ width: '12%' }}>Created</TableCell>
                  <TableCell align="center" sx={{ width: '10%' }}>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {handovers.map((h) => {
                  const vp = h.verificationProgress;
                  const allVerified = vp?.pct === 100;
                  return (
                    <TableRow key={String(h.id)} hover>
                      <TableCell sx={{ wordBreak: 'break-word' }}>{String(h.schemeName)}</TableCell>
                      <TableCell>{String(h.omAgencyName ?? h.omAgencyType ?? '—')}</TableCell>
                      <TableCell align="center">
                        <Chip
                          size="small"
                          label={verificationLabel(h)}
                          color={allVerified ? 'success' : 'default'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={HANDOVER_STATUS_LABELS[String(h.status)] ?? String(h.status)}
                          size="small"
                          color={h.status === 'handed_over' ? 'success' : h.status === 'rejected' ? 'error' : 'default'}
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {h.createdAt ? new Date(String(h.createdAt)).toLocaleDateString() : '—'}
                      </TableCell>
                      <TableCell align="center">
                        <Button size="small" onClick={() => openEdit(String(h.id))}>Open</Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Typography variant="body2" color="text.secondary">No handover records yet. Initiate handover after project commissioning.</Typography>
        )}
      </SurfaceCard>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="lg" fullWidth PaperProps={{ sx: omDialogPaperSx }}>
        <OmDialogHeader
          stage={1}
          title={editingId ? 'O&M Asset Handover' : 'Initiate O&M Handover'}
          subtitle={detail?.schemeName as string | undefined}
          busy={busy}
        />
        <DialogContent dividers sx={omDialogContentSx}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Typography variant="subtitle2" fontWeight={700} gutterBottom>1. Link Commissioned Project</Typography>
          <Grid container spacing={2} mb={2}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Project (optional)</InputLabel>
                <Select
                  value={form.projectId}
                  label="Project (optional)"
                  disabled={Boolean(isLocked)}
                  onChange={(e) => {
                    const pid = String(e.target.value);
                    const proj = projects.find((p) => p.id === pid) ?? null;
                    setSelectedProject(proj);
                    setForm((f) => ({ ...f, projectId: pid }));
                    if (pid) applyPrefill(pid);
                    else setPrefillHint('');
                  }}
                >
                  <MenuItem value="">— Standalone scheme —</MenuItem>
                  {projects.map((p) => (
                    <MenuItem key={p.id} value={p.id}>{p.projectCode} — {p.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth size="small" label="Scheme Name" required
                value={form.schemeName}
                disabled={Boolean(isLocked)}
                onChange={(e) => setForm((f) => ({ ...f, schemeName: e.target.value }))}
              />
            </Grid>
          </Grid>
          {prefillHint && <Alert severity="info" sx={{ mb: 2 }}>{prefillHint}</Alert>}
          {selectedProject && (
            <Typography variant="caption" color="text.secondary" display="block" mb={2}>
              Linked project: {selectedProject.projectCode} — {selectedProject.name}
            </Typography>
          )}

          <OmHandoverDocuments
            handoverId={editingId}
            locked={Boolean(isLocked)}
            onDocumentApproved={async () => {
              if (!editingId) return;
              const { data } = await omApi.getHandover(editingId);
              setDetail(data);
              setForm((f) => ({
                ...f,
                completionVerified: Boolean(data.completionVerified),
                commissioningVerified: Boolean(data.commissioningVerified),
                asBuiltVerified: Boolean(data.asBuiltVerified),
                gisMappingVerified: Boolean(data.gisMappingVerified),
                assetRegisterVerified: Boolean(data.assetRegisterVerified),
                fhtcVerified: Boolean(data.fhtcVerified),
                omManualVerified: Boolean(data.omManualVerified),
              }));
            }}
          />

          <Typography variant="subtitle2" fontWeight={700} gutterBottom>
            2. Verify Completion Documents
          </Typography>
          <Box mb={1}>
            <LinearProgress variant="determinate" value={verificationPct} sx={{ mb: 0.5, borderRadius: 1 }} />
            <Typography variant="caption" color="text.secondary">{verificationPct}% verified</Typography>
          </Box>
          <Grid container spacing={0} mb={2}>
            {HANDOVER_VERIFICATIONS.map((v) => (
              <Grid item xs={12} sm={6} key={v.key}>
                <FormControlLabel
                  control={(
                    <Checkbox
                      checked={Boolean(form[v.key as keyof HandoverFormState])}
                      disabled={Boolean(isLocked)}
                      onChange={(e) => setForm((f) => ({ ...f, [v.key]: e.target.checked }))}
                    />
                  )}
                  label={v.label}
                />
              </Grid>
            ))}
          </Grid>

          <Typography variant="subtitle2" fontWeight={700} gutterBottom>3. Assign O&M Agency</Typography>
          <Grid container spacing={2} mb={2}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Agency Type</InputLabel>
                <Select
                  value={form.omAgencyType}
                  label="Agency Type"
                  disabled={Boolean(isLocked)}
                  onChange={(e) => setForm((f) => ({ ...f, omAgencyType: e.target.value }))}
                >
                  {OM_AGENCY_OPTIONS.map((o) => (
                    <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth size="small" label="Agency Name"
                placeholder="e.g. Uttarakhand Jal Sansthan / VWSC Name"
                value={form.omAgencyName}
                disabled={Boolean(isLocked)}
                onChange={(e) => setForm((f) => ({ ...f, omAgencyName: e.target.value }))}
              />
            </Grid>
          </Grid>

          <Typography variant="subtitle2" fontWeight={700} gutterBottom>4. Generated Outputs</Typography>
          {outputs ? (
            <Box sx={{ p: 2, bgcolor: '#f0fdf4', borderRadius: 2, border: '1px solid #bbf7d0' }}>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <CheckCircleOutlineIcon color="success" fontSize="small" />
                <Typography variant="body2" fontWeight={600}>Documents generated</Typography>
              </Box>
              <Grid container spacing={1}>
                <Grid item xs={6} sm={3}>
                  <Chip label="Handover Certificate" size="small" color="success" variant="outlined" />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Chip label="O&M Matrix" size="small" color="success" variant="outlined" />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Chip
                    label={`Asset Register (${outputs.assetInventoryRegister?.length ?? 0})`}
                    size="small" color="success" variant="outlined"
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Chip
                    label={`GIS Register (${outputs.gisAssetRegister?.length ?? 0})`}
                    size="small" color="success" variant="outlined"
                  />
                </Grid>
              </Grid>
              {outputs.handoverCertificate && (
                <Typography variant="caption" display="block" mt={1} color="text.secondary">
                  {String((outputs.handoverCertificate as { text?: string }).text ?? '')}
                </Typography>
              )}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary" mb={1}>
              Complete all verifications and assign agency, then generate certificate, O&M responsibility matrix, and asset registers.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={omDialogActionsSx}>
          <Button onClick={() => setDialogOpen(false)}>Close</Button>
          {!isLocked && (
            <>
              <Button onClick={save} disabled={busy || !form.schemeName}>Save Draft</Button>
              <Button variant="outlined" onClick={generate} disabled={busy || verificationPct < 100 || !form.omAgencyName}>
                Generate Outputs
              </Button>
              <Button variant="contained" onClick={submit} disabled={busy || !outputs || !editingId}>
                Submit for Approval
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}
