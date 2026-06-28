import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent,
  FormControl, Grid, InputLabel, MenuItem, Select, Tab, Tabs,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography,
} from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import axios from 'axios';
import { omApi, projectsApi } from '../../services/api';
import SurfaceCard from '../layout/SurfaceCard';
import {
  OM_INSPECTION_ROLE_LABELS,
  OM_INSPECTION_TYPES,
  getInspectionTypeDef,
  type OmInspectionType,
} from '../../constants/omInspections';
import { dataTableSx } from '../../utils/pagePresentationStyles';
import { OmDialogHeader, omDialogActionsSx, omDialogContentSx, omDialogPaperSx } from './omUi';
import BilingualRemarkField from '../forms/BilingualRemarkField';
import { parseBilingualText, serializeBilingualText } from '../../utils/bilingualText';
import { formatCoordinatePair, formatCoordinateString } from '../../utils/coordinateFields';
import { useCanViewAllDivisions } from '../../utils/divisionAccess';

type InspectionRow = {
  id: string;
  inspectionType: string;
  performedByRole: string;
  inspectionDate: string;
  projectName?: string;
  projectCode?: string;
  assetCode?: string;
  latitude?: number | null;
  longitude?: number | null;
  checklist: Record<string, unknown>;
  photos?: Array<Record<string, unknown>>;
  notes?: string;
  status: string;
};

type ProjectOption = { id: string; name: string; projectCode: string };

const TYPE_TABS: OmInspectionType[] = ['daily', 'weekly', 'monthly'];

function getApiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg)) return msg.join(', ');
  }
  return fallback;
}

function formatChecklistSummary(row: InspectionRow): string {
  const keys = Object.keys(row.checklist ?? {}).slice(0, 2);
  if (!keys.length) return '—';
  return keys.map((k) => `${k}: ${String(row.checklist[k])}`).join(' · ');
}

export default function OmInspectionStage() {
  const canViewAll = useCanViewAllDivisions();
  const [tab, setTab] = useState(0);
  const [rows, setRows] = useState<InspectionRow[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectOption | null>(null);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState<InspectionRow | null>(null);

  const activeType = TYPE_TABS[tab];
  const typeDef = getInspectionTypeDef(activeType);

  const [form, setForm] = useState({
    performedByRole: typeDef.roles[0].code,
    checklist: {} as Record<string, string>,
    notes: '',
    latitude: '',
    longitude: '',
    photoCaption: '',
  });

  const load = useCallback(() => {
    Promise.all([
      omApi.listInspections({
        projectId: selectedProject?.id,
        projectCode: selectedProject?.projectCode,
        inspectionType: activeType,
      }),
      omApi.inspectionSummary(selectedProject?.id),
    ])
      .then(([listRes, sumRes]) => {
        setRows(listRes.data);
        setSummary(sumRes.data);
        setError('');
      })
      .catch((err) => setError(getApiError(err, 'Failed to load inspections')));
  }, [selectedProject, activeType]);

  useEffect(() => {
    projectsApi.list().then((r) => {
      const list = Array.isArray(r.data) ? r.data : [];
      setProjects(list.map((p: ProjectOption) => p));
    }).catch(() => undefined);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const def = getInspectionTypeDef(activeType);
    setForm((f) => ({
      ...f,
      performedByRole: def.roles[0].code,
      checklist: {},
    }));
  }, [activeType]);

  const openNew = () => {
    const def = getInspectionTypeDef(activeType);
    setForm({
      performedByRole: def.roles[0].code,
      checklist: {},
      notes: '',
      latitude: '',
      longitude: '',
      photoCaption: '',
    });
    setDialogOpen(true);
  };

  const submit = async () => {
    if (!selectedProject) {
      setError('Select a scheme / project before submitting an inspection');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const checklist: Record<string, unknown> = {};
      for (const field of typeDef.fields) {
        const raw = form.checklist[field.key];
        if (raw === undefined || raw === '') continue;
        checklist[field.key] = field.type === 'number' ? Number(raw) : raw;
      }
      const photos = form.latitude && form.longitude && form.photoCaption
        ? [{
          caption: form.photoCaption,
          latitude: Number(form.latitude),
          longitude: Number(form.longitude),
          takenAt: new Date().toISOString(),
        }]
        : [];

      await omApi.createInspection({
        inspectionType: activeType,
        performedByRole: form.performedByRole,
        projectId: selectedProject.id,
        projectCode: selectedProject.projectCode,
        checklist,
        notes: form.notes || undefined,
        latitude: form.latitude ? Number(form.latitude) : undefined,
        longitude: form.longitude ? Number(form.longitude) : undefined,
        photos,
      });
      setDialogOpen(false);
      load();
    } catch (err: unknown) {
      setError(getApiError(err, 'Failed to submit inspection'));
    } finally {
      setBusy(false);
    }
  };

  const renderField = (field: typeof typeDef.fields[number]) => {
    const value = form.checklist[field.key] ?? '';
    const label = field.unit ? `${field.label} (${field.unit})` : field.label;

    if (field.type === 'select' || field.type === 'rating') {
      return (
        <FormControl fullWidth size="small" key={field.key} required={field.required}>
          <InputLabel>{label}</InputLabel>
          <Select
            value={value}
            label={label}
            onChange={(e) => setForm((f) => ({
              ...f,
              checklist: { ...f.checklist, [field.key]: e.target.value },
            }))}
          >
            {(field.options ?? []).map((opt) => (
              <MenuItem key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</MenuItem>
            ))}
          </Select>
        </FormControl>
      );
    }

    if (field.type === 'text') {
      return (
        <TextField
          key={field.key}
          fullWidth
          size="small"
          label={label}
          multiline={field.key.includes('leakage') || field.key.includes('Observation')}
          rows={field.key.includes('leakage') ? 2 : 1}
          required={field.required}
          value={value}
          onChange={(e) => setForm((f) => ({
            ...f,
            checklist: { ...f.checklist, [field.key]: e.target.value },
          }))}
        />
      );
    }

    return (
      <TextField
        key={field.key}
        fullWidth
        size="small"
        type="number"
        label={label}
        required={field.required}
        value={value}
        onChange={(e) => setForm((f) => ({
          ...f,
          checklist: { ...f.checklist, [field.key]: e.target.value },
        }))}
      />
    );
  };

  return (
    <>
      <SurfaceCard
        header={(
          <Box display="flex" justifyContent="space-between" alignItems="center" width="100%" flexWrap="wrap" gap={1}>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem' }}>Routine Inspection Register</Typography>
              <Typography variant="caption" color="text.secondary">
                Daily operator checks · Weekly JE · Monthly AE · Geo-tagged evidence
              </Typography>
            </Box>
            <Box display="flex" gap={1} flexWrap="wrap" alignItems="center">
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel>Scheme / Project</InputLabel>
                <Select
                  value={selectedProject?.id ?? ''}
                  label="Scheme / Project"
                  onChange={(e) => {
                    const pid = String(e.target.value);
                    setSelectedProject(projects.find((p) => p.id === pid) ?? null);
                  }}
                >
                  {canViewAll && <MenuItem value="">All schemes</MenuItem>}
                  {projects.map((p) => (
                    <MenuItem key={p.id} value={p.id}>{p.projectCode} — {p.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button size="small" variant="contained" startIcon={<AddOutlinedIcon />} onClick={openNew}>
                New {typeDef.label}
              </Button>
            </Box>
          </Box>
        )}
      >
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

        <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
          <Chip label={`Daily today: ${summary.dailyToday ?? 0}`} size="small" color="primary" variant="outlined" />
          <Chip label={`Weekly this week: ${summary.weeklyThisWeek ?? 0}`} size="small" variant="outlined" />
          <Chip label={`Monthly this month: ${summary.monthlyThisMonth ?? 0}`} size="small" variant="outlined" />
          <Chip label={`Total: ${summary.total ?? 0}`} size="small" variant="outlined" />
        </Box>

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
          {OM_INSPECTION_TYPES.map((t, i) => (
            <Tab key={t.type} label={t.label.replace(' Inspection', '')} value={i} />
          ))}
        </Tabs>

        {rows.length > 0 ? (
          <TableContainer sx={{ ...dataTableSx(), overflowX: 'auto' }}>
            <Table size="small" sx={{ minWidth: 760, tableLayout: 'fixed' }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: '14%' }}>Date</TableCell>
                  <TableCell sx={{ width: '18%' }}>Scheme</TableCell>
                  <TableCell sx={{ width: '14%' }}>Role</TableCell>
                  <TableCell sx={{ width: '28%' }}>Key readings</TableCell>
                  <TableCell align="center" sx={{ width: '10%' }}>GIS</TableCell>
                  <TableCell align="center" sx={{ width: '8%' }}>Photos</TableCell>
                  <TableCell align="center" sx={{ width: '8%' }}>View</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {new Date(r.inspectionDate).toLocaleString()}
                    </TableCell>
                    <TableCell>{r.projectCode ?? r.projectName ?? '—'}</TableCell>
                    <TableCell>{OM_INSPECTION_ROLE_LABELS[r.performedByRole] ?? r.performedByRole}</TableCell>
                    <TableCell sx={{ fontSize: '0.8125rem' }}>{formatChecklistSummary(r)}</TableCell>
                    <TableCell align="center">
                      {r.latitude != null && r.longitude != null ? (
                        <Chip size="small" label="GPS" variant="outlined" />
                      ) : '—'}
                    </TableCell>
                    <TableCell align="center">
                      {(r.photos?.length ?? 0) > 0 ? (
                        <Chip icon={<PhotoCameraOutlinedIcon />} size="small" label={String(r.photos?.length)} />
                      ) : '—'}
                    </TableCell>
                    <TableCell align="center">
                      <Button size="small" onClick={() => setDetailOpen(r)}>Open</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No {typeDef.label.toLowerCase()} records yet. Click &quot;New {typeDef.label}&quot; to submit.
          </Typography>
        )}
      </SurfaceCard>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: omDialogPaperSx }}>
        <OmDialogHeader stage={3} title={typeDef.label} busy={busy} />
        <DialogContent dividers sx={omDialogContentSx}>
          {!selectedProject && (
            <Alert severity="warning" sx={{ mb: 2 }}>Select a scheme / project first.</Alert>
          )}
          <Grid container spacing={2} mt={0}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small" required>
                <InputLabel>Performed By</InputLabel>
                <Select
                  value={form.performedByRole}
                  label="Performed By"
                  onChange={(e) => setForm((f) => ({ ...f, performedByRole: e.target.value }))}
                >
                  {typeDef.roles.map((r) => (
                    <MenuItem key={r.code} value={r.code}>{r.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            {typeDef.fields.map((field) => (
              <Grid item xs={12} sm={field.type === 'text' && field.key.includes('leakage') ? 12 : 6} key={field.key}>
                {renderField(field)}
              </Grid>
            ))}
            <Grid item xs={12}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>Geo-tagged photo (optional)</Typography>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" label="Latitude (°N)" value={form.latitude} onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" label="Longitude (°E)" value={form.longitude} onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" label="Photo caption" value={form.photoCaption} onChange={(e) => setForm((f) => ({ ...f, photoCaption: e.target.value }))} />
            </Grid>
            {form.latitude && form.longitude && (
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">
                  GIS: {formatCoordinatePair(form.latitude, form.longitude)}
                </Typography>
              </Grid>
            )}
            <Grid item xs={12}>
              <BilingualRemarkField
                label="Notes"
                pdfTitle="Inspection Notes"
                value={parseBilingualText(form.notes)}
                onChange={(v) => setForm((f) => ({ ...f, notes: serializeBilingualText(v) }))}
                minRows={2}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={omDialogActionsSx}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={busy || !selectedProject} onClick={submit}>Submit Inspection</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(detailOpen)} onClose={() => setDetailOpen(null)} maxWidth="sm" fullWidth PaperProps={{ sx: omDialogPaperSx }}>
        <OmDialogHeader stage={3} title="Inspection Detail" subtitle={detailOpen?.inspectionNo} />
        <DialogContent dividers sx={omDialogContentSx}>
          {detailOpen && (
            <Box>
              <Typography variant="body2" mb={1}>
                <strong>Type:</strong> {getInspectionTypeDef(detailOpen.inspectionType as OmInspectionType).label}
              </Typography>
              <Typography variant="body2" mb={1}>
                <strong>Role:</strong> {OM_INSPECTION_ROLE_LABELS[detailOpen.performedByRole] ?? detailOpen.performedByRole}
              </Typography>
              <Typography variant="body2" mb={2}>
                <strong>Date:</strong> {new Date(detailOpen.inspectionDate).toLocaleString()}
              </Typography>
              {Object.entries(detailOpen.checklist ?? {}).map(([k, v]) => (
                <Typography key={k} variant="body2" sx={{ mb: 0.5 }}>
                  <strong>{k}:</strong> {String(v)}
                </Typography>
              ))}
              {detailOpen.latitude != null && detailOpen.longitude != null && (
                <Typography variant="caption" display="block" mt={1} color="text.secondary">
                  {formatCoordinatePair(detailOpen.latitude, detailOpen.longitude)}
                </Typography>
              )}
              {detailOpen.notes && (
                <Typography variant="body2" mt={2}><strong>Notes:</strong> {detailOpen.notes}</Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={omDialogActionsSx}>
          <Button onClick={() => setDetailOpen(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
