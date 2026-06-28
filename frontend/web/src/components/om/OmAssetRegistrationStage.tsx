import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent,
  FormControl, Grid, IconButton, InputLabel, MenuItem, Select, Tab, Tabs, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import QrCode2OutlinedIcon from '@mui/icons-material/QrCode2Outlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import axios from 'axios';
import { omApi, projectsApi } from '../../services/api';
import SurfaceCard from '../layout/SurfaceCard';
import { OM_ASSET_CATALOG, OM_ASSET_TYPE_ABBREV } from '../../constants/omAssets';
import { dataTableSx } from '../../utils/pagePresentationStyles';
import { OmDialogHeader, omDialogActionsSx, omDialogContentSx, omDialogPaperSx } from './omUi';
import OmAssetQrCode from './OmAssetQrCode';
import { buildOmAssetScanUrl } from '../../utils/omAssetQr';
import { formatCoordinatePair, formatCoordinateString } from '../../utils/coordinateFields';
import { useCanViewAllDivisions } from '../../utils/divisionAccess';

type AssetRow = Record<string, unknown> & {
  id: string;
  assetCode: string;
  name: string;
  assetType?: string;
  omCategory?: string;
  omSubcategory?: string;
  status: string;
  qrCode?: string;
  latitude?: number | null;
  longitude?: number | null;
  manufacturer?: string | null;
  capacity?: string | null;
  installationDate?: string | null;
  warrantyDetails?: string | null;
  designLifeYears?: number | null;
};

type AssetFormState = {
  assetCode: string;
  typeCode: string;
  name: string;
  manufacturer: string;
  capacity: string;
  installationDate: string;
  warrantyDetails: string;
  designLifeYears: string;
  latitude: string;
  longitude: string;
};

const emptyAssetForm = (): AssetFormState => ({
  assetCode: '',
  typeCode: OM_ASSET_CATALOG[0].typeCode,
  name: '',
  manufacturer: '',
  capacity: '',
  installationDate: '',
  warrantyDetails: '',
  designLifeYears: '',
  latitude: '',
  longitude: '',
});

function assetToForm(asset: AssetRow): AssetFormState {
  const typeCode = String(
    asset.assetType
    ?? OM_ASSET_CATALOG.find((c) => c.subcategory === asset.omSubcategory)?.typeCode
    ?? OM_ASSET_CATALOG[0].typeCode,
  );
  return {
    assetCode: String(asset.assetCode),
    typeCode,
    name: String(asset.name ?? ''),
    manufacturer: String(asset.manufacturer ?? ''),
    capacity: String(asset.capacity ?? ''),
    installationDate: asset.installationDate ? String(asset.installationDate).slice(0, 10) : '',
    warrantyDetails: String(asset.warrantyDetails ?? ''),
    designLifeYears: asset.designLifeYears != null ? String(asset.designLifeYears) : '',
    latitude: asset.latitude != null ? (formatCoordinateString(asset.latitude) ?? '') : '',
    longitude: asset.longitude != null ? (formatCoordinateString(asset.longitude) ?? '') : '',
  };
}

const CATEGORIES = [...new Set(OM_ASSET_CATALOG.map((c) => c.group))];

function getApiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg)) return msg.join(', ');
    if (err.message && !err.message.includes('JSON')) return err.message;
  }
  return fallback;
}

function suggestAssetCode(
  projectCode: string | undefined,
  typeCode: string,
  assets: AssetRow[],
): string {
  const abbrev = OM_ASSET_TYPE_ABBREV[typeCode] ?? typeCode.replace(/_/g, '').slice(0, 3).toUpperCase();
  const scheme = projectCode?.trim() || 'GEN';
  const prefix = `OM-${scheme}-${abbrev}-`;
  const seq = assets.filter((a) => String(a.assetCode).startsWith(prefix)).length + 1;
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

function formatStatusLabel(status: string): string {
  if (!status) return '—';
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
}

type ProjectOption = { id: string; name: string; projectCode: string };

export default function OmAssetRegistrationStage() {
  const canViewAll = useCanViewAllDivisions();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(0);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectOption | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<AssetRow | null>(null);
  const [editInitial, setEditInitial] = useState<AssetFormState | null>(null);
  const [editError, setEditError] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [qrOpen, setQrOpen] = useState<AssetRow | null>(null);
  const [form, setForm] = useState<AssetFormState>(emptyAssetForm);

  const activeCategory = CATEGORIES[tab] ?? '';

  const suggestedAssetCode = useMemo(
    () => suggestAssetCode(selectedProject?.projectCode, form.typeCode, assets),
    [selectedProject?.projectCode, form.typeCode, assets],
  );

  const load = useCallback(() => {
    omApi.listSchemeAssets({
      projectId: selectedProject?.id,
      projectCode: selectedProject?.projectCode,
      category: activeCategory || undefined,
    })
      .then((r) => setAssets(r.data))
      .catch((err) => setError(getApiError(err, 'Failed to load assets')));
  }, [selectedProject, activeCategory]);

  useEffect(() => {
    projectsApi.list().then((r) => {
      const list = Array.isArray(r.data) ? r.data : [];
      setProjects(list.map((p: { id: string; name: string; projectCode: string }) => p));
    }).catch(() => undefined);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const assetId = searchParams.get('asset');
    const assetCode = searchParams.get('code');
    if (!assets.length || (!assetId && !assetCode)) return;

    const match = assets.find((a) => a.id === assetId || a.assetCode === assetCode);
    if (!match) return;

    setQrOpen(match);
    const next = new URLSearchParams(searchParams);
    next.delete('asset');
    next.delete('code');
    setSearchParams(next, { replace: true });
  }, [assets, searchParams, setSearchParams]);

  const importFromConstruction = async () => {
    if (!selectedProject) {
      setError('Select a project to import construction assets');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { data } = await omApi.importConstructionAssets({
        projectId: selectedProject.id,
        projectCode: selectedProject.projectCode,
      });
      if (data.imported === 0) {
        setError(data.message ?? 'No construction assets to import for this project');
      } else {
        setError('');
      }
      alert(`Imported ${data.imported} assets${data.skipped?.length ? ` (${data.skipped.length} skipped)` : ''}`);
      load();
    } catch (err: unknown) {
      setError(getApiError(err, 'Import failed'));
    } finally {
      setBusy(false);
    }
  };

  const register = async () => {
    if (!selectedProject) {
      setError('Select a scheme / project before registering an asset');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await omApi.registerAsset({
        typeCode: form.typeCode,
        name: form.name,
        projectId: selectedProject.id,
        projectCode: selectedProject.projectCode,
        manufacturer: form.manufacturer || undefined,
        capacity: form.capacity || undefined,
        installationDate: form.installationDate || undefined,
        warrantyDetails: form.warrantyDetails || undefined,
        designLifeYears: form.designLifeYears ? Number(form.designLifeYears) : undefined,
        latitude: form.latitude ? Number(form.latitude) : undefined,
        longitude: form.longitude ? Number(form.longitude) : undefined,
      });
      setRegisterOpen(false);
      setForm(emptyAssetForm());
      load();
    } catch (err: unknown) {
      setError(getApiError(err, 'Registration failed'));
    } finally {
      setBusy(false);
    }
  };

  const openEdit = async (asset: AssetRow) => {
    setEditError('');
    setEditLoading(true);
    setEditingAsset(asset);
    try {
      const { data } = await omApi.getSchemeAsset(asset.id);
      const row = data as AssetRow;
      const initial = assetToForm(row);
      setEditingAsset(row);
      setEditInitial(initial);
      setForm(initial);
    } catch (err: unknown) {
      const initial = assetToForm(asset);
      setEditInitial(initial);
      setForm(initial);
      setEditError(getApiError(err, 'Could not load full asset details — showing cached row.'));
    } finally {
      setEditLoading(false);
    }
  };

  const closeEdit = () => {
    setEditingAsset(null);
    setEditInitial(null);
    setEditError('');
    setForm(emptyAssetForm());
  };

  const saveEdit = async () => {
    if (!editingAsset) return;
    const hasLat = Boolean(form.latitude.trim());
    const hasLon = Boolean(form.longitude.trim());
    if (hasLat !== hasLon) {
      setEditError('Provide both latitude and longitude, or clear both to remove GIS.');
      return;
    }
    const hadGisInitially = Boolean(editInitial?.latitude.trim() && editInitial?.longitude.trim());
    setBusy(true);
    setEditError('');
    try {
      const payload: Record<string, unknown> = {
        assetCode: form.assetCode.trim(),
        typeCode: form.typeCode,
        name: form.name,
        manufacturer: form.manufacturer || undefined,
        capacity: form.capacity || undefined,
        installationDate: form.installationDate || undefined,
        warrantyDetails: form.warrantyDetails || undefined,
        designLifeYears: form.designLifeYears ? Number(form.designLifeYears) : undefined,
      };
      if (hasLat && hasLon) {
        payload.latitude = Number(form.latitude);
        payload.longitude = Number(form.longitude);
      } else if (hadGisInitially) {
        payload.clearGis = true;
      }
      await omApi.updateSchemeAsset(editingAsset.id, payload);
      closeEdit();
      load();
    } catch (err: unknown) {
      setEditError(getApiError(err, 'Update failed'));
    } finally {
      setBusy(false);
    }
  };

  const renderAssetFormFields = (mode: 'register' | 'edit') => (
    <Grid container spacing={2} mt={0}>
      <Grid item xs={12}>
        <TextField
          fullWidth
          size="small"
          label={mode === 'register' ? 'Asset ID (auto-generated)' : 'Asset ID'}
          value={mode === 'register' ? suggestedAssetCode : form.assetCode}
          onChange={mode === 'edit' ? (e) => setForm((f) => ({ ...f, assetCode: e.target.value })) : undefined}
          InputProps={{ readOnly: mode === 'register' }}
          helperText="Format: OM-PRJ-2026-001-GDS-001"
        />
      </Grid>
      <Grid item xs={12} sm={6}>
        <FormControl fullWidth size="small">
          <InputLabel>Asset Type</InputLabel>
          <Select value={form.typeCode} label="Asset Type" onChange={(e) => setForm((f) => ({ ...f, typeCode: e.target.value }))}>
            {OM_ASSET_CATALOG.map((c) => (
              <MenuItem key={c.typeCode} value={c.typeCode}>{c.subcategory}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField fullWidth size="small" label="Asset Name" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField fullWidth size="small" label="Manufacturer" value={form.manufacturer} onChange={(e) => setForm((f) => ({ ...f, manufacturer: e.target.value }))} />
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField fullWidth size="small" label="Capacity" value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))} />
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField fullWidth size="small" type="date" label="Installation Date" InputLabelProps={{ shrink: true }} value={form.installationDate} onChange={(e) => setForm((f) => ({ ...f, installationDate: e.target.value }))} />
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField fullWidth size="small" label="Design Life (years)" value={form.designLifeYears} onChange={(e) => setForm((f) => ({ ...f, designLifeYears: e.target.value }))} />
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          size="small"
          label="Latitude (°N)"
          placeholder="29.589123"
          value={form.latitude}
          onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
          helperText="Decimal degrees, 6 places"
        />
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          size="small"
          label="Longitude (°E)"
          placeholder="79.330456"
          value={form.longitude}
          onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
          helperText="Decimal degrees, 6 places"
        />
      </Grid>
      {form.latitude && form.longitude && (
        <Grid item xs={12}>
          <Typography variant="caption" color="text.secondary">
            GIS preview: {formatCoordinatePair(form.latitude, form.longitude)}
          </Typography>
        </Grid>
      )}
      {mode === 'edit' && !form.latitude && !form.longitude && (
        <Grid item xs={12}>
          <Typography variant="caption" color="text.secondary">
            Leave coordinates empty to remove GIS mapping from this asset.
          </Typography>
        </Grid>
      )}
      <Grid item xs={12}>
        <TextField fullWidth size="small" label="Warranty Details" multiline rows={2} value={form.warrantyDetails} onChange={(e) => setForm((f) => ({ ...f, warrantyDetails: e.target.value }))} />
      </Grid>
    </Grid>
  );

  const categoryAssets = assets.filter((a) => !activeCategory || a.omCategory === activeCategory);

  return (
    <>
      <SurfaceCard
        header={(
          <Box display="flex" justifyContent="space-between" alignItems="center" width="100%" flexWrap="wrap" gap={1}>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem' }}>O&M Asset Register & GIS</Typography>
              <Typography variant="caption" color="text.secondary">
                Unique Asset IDs · QR codes · GIS coordinates · {assets.length} registered
              </Typography>
            </Box>
            <Box display="flex" gap={1} flexWrap="wrap">
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
              <Button size="small" variant="outlined" startIcon={<FileDownloadOutlinedIcon />} disabled={busy || !selectedProject} onClick={importFromConstruction}>
                Import from Construction
              </Button>
              <Button size="small" variant="contained" onClick={() => { setForm(emptyAssetForm()); setRegisterOpen(true); }}>Register Asset</Button>
            </Box>
          </Box>
        )}
      >
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto" sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
          {CATEGORIES.map((cat) => (
            <Tab key={cat} label={cat.replace(' Infrastructure', '')} />
          ))}
        </Tabs>

        {categoryAssets.length > 0 ? (
          <TableContainer sx={{ ...dataTableSx(), maxWidth: '100%', overflowX: 'auto' }}>
            <Table
              size="small"
              stickyHeader
              sx={{
                tableLayout: 'fixed',
                minWidth: 980,
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
                  <TableCell sx={{ width: '20%' }}>Asset ID</TableCell>
                  <TableCell sx={{ width: '12%' }}>Name</TableCell>
                  <TableCell sx={{ width: '14%' }}>Type</TableCell>
                  <TableCell align="right" sx={{ width: '11%' }}>Latitude</TableCell>
                  <TableCell align="right" sx={{ width: '11%' }}>Longitude</TableCell>
                  <TableCell align="center" sx={{ width: '8%' }}>Status</TableCell>
                  <TableCell align="center" sx={{ width: '7%' }}>QR</TableCell>
                  <TableCell align="center" sx={{ width: '6%' }}>BD</TableCell>
                  <TableCell align="center" sx={{ width: '6%' }}>Edit</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {categoryAssets.map((a) => (
                  <TableRow key={a.id} hover>
                    <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600, wordBreak: 'break-all' }}>
                      {a.assetCode}
                    </TableCell>
                    <TableCell>{a.name}</TableCell>
                    <TableCell>{a.omSubcategory}</TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatCoordinateString(a.latitude) ?? '—'}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatCoordinateString(a.longitude) ?? '—'}
                    </TableCell>
                    <TableCell align="center">
                      <Chip label={formatStatusLabel(String(a.status))} size="small" />
                    </TableCell>
                    <TableCell align="center">
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<QrCode2OutlinedIcon />}
                        onClick={() => setQrOpen(a)}
                        sx={{ minWidth: 72 }}
                      >
                        View
                      </Button>
                    </TableCell>
                    <TableCell align="center">
                      <Chip label={String(a.breakdownHistoryCount ?? 0)} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Edit asset">
                        <IconButton size="small" onClick={() => openEdit(a)} aria-label="Edit asset">
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No assets in {activeCategory} yet. Import from construction or register manually.
          </Typography>
        )}
      </SurfaceCard>

      <Dialog open={registerOpen} onClose={() => setRegisterOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: omDialogPaperSx }}>
        <OmDialogHeader stage={2} title="Register O&M Asset" busy={busy} />
        <DialogContent dividers sx={omDialogContentSx}>
          {!selectedProject && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Select a scheme / project first — asset IDs follow the format OM-{'{scheme}'}-{'{type}'}-{'{seq}'}.
            </Alert>
          )}
          {renderAssetFormFields('register')}
        </DialogContent>
        <DialogActions sx={omDialogActionsSx}>
          <Button onClick={() => setRegisterOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={busy || !form.name || !selectedProject} onClick={register}>Register & Generate QR</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(editingAsset)} onClose={closeEdit} maxWidth="sm" fullWidth PaperProps={{ sx: omDialogPaperSx }}>
        <OmDialogHeader stage={2} title="Edit O&M Asset" subtitle={editingAsset?.assetCode} busy={busy} />
        <DialogContent dividers sx={omDialogContentSx}>
          {editError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setEditError('')}>{editError}</Alert>}
          {editLoading ? (
            <Typography variant="body2" color="text.secondary" py={2}>Loading asset details…</Typography>
          ) : (
            renderAssetFormFields('edit')
          )}
        </DialogContent>
        <DialogActions sx={omDialogActionsSx}>
          <Button onClick={closeEdit}>Cancel</Button>
          <Button
            variant="contained"
            disabled={busy || editLoading || !form.name || !form.assetCode.trim()}
            onClick={saveEdit}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(qrOpen)} onClose={() => setQrOpen(null)} maxWidth="xs" fullWidth PaperProps={{ sx: omDialogPaperSx }}>
        <OmDialogHeader stage={2} title="Asset QR Code" subtitle={qrOpen?.assetCode} />
        <DialogContent sx={omDialogContentSx}>
          {qrOpen && (
            <Box textAlign="center" py={1}>
              <OmAssetQrCode asset={qrOpen} size={240} />
              <Typography variant="h6" fontWeight={700} sx={{ fontFamily: 'monospace', mt: 2 }}>{qrOpen.assetCode}</Typography>
              <Typography variant="body2" color="text.secondary" mb={1}>{qrOpen.name}</Typography>
              {qrOpen.latitude != null && qrOpen.longitude != null && (
                <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                  {formatCoordinatePair(qrOpen.latitude, qrOpen.longitude)}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary" display="block" mt={1} mb={0.5}>
                Point your phone camera at the QR above — it opens this asset in EGIP after login.
              </Typography>
              <Typography variant="caption" display="block" sx={{ wordBreak: 'break-all', bgcolor: '#f8fafc', p: 1, borderRadius: 1, textAlign: 'left' }}>
                {buildOmAssetScanUrl(qrOpen)}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={omDialogActionsSx}>
          <Button onClick={() => setQrOpen(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
