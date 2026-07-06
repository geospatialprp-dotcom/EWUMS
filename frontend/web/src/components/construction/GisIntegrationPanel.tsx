import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, Grid, IconButton, LinearProgress, MenuItem, Paper,
  Stack, Table, TableBody, TableCell, TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import PlaceIcon from '@mui/icons-material/Place';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import EngineeringOutlinedIcon from '@mui/icons-material/EngineeringOutlined';
import { constructionApi } from '../../services/api';
import { formatApiError } from '../../utils/apiError';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import {
  GIS_ASSET_LABELS, GIS_ASSET_STATUS_LABELS, GIS_ASSET_STATUSES, GIS_ASSET_TYPES,
  STATUS_COLORS, mbWorkflowStepLabel, type GisAssetType,
} from '../../constants/construction';
import ConstructionStyledTableHead, {
  constructionSectionBarSx, constructionTableShellSx, constructionTableTheme,
} from './ConstructionStyledTableHead';
import DprPhotoGallery from './DprPhotoGallery';

type AssetRecord = Record<string, unknown>;

type AssetForm = {
  assetCode: string;
  assetType: GisAssetType;
  name: string;
  latitude: string;
  longitude: string;
  chainage: string;
  installationDate: string;
  contractorName: string;
  mbReference: string;
  status: 'planned' | 'installed' | 'commissioned';
};

const emptyForm = (): AssetForm => ({
  assetCode: '',
  assetType: 'source',
  name: '',
  latitude: '',
  longitude: '',
  chainage: '',
  installationDate: '',
  contractorName: '',
  mbReference: '',
  status: 'planned',
});

function isMapped(asset: AssetRecord): boolean {
  return asset.latitude != null && asset.longitude != null
    && String(asset.latitude) !== '' && String(asset.longitude) !== '';
}

function formatCoord(value: unknown): string {
  if (value == null || value === '') return '—';
  return Number(value).toFixed(6);
}

function hasGpsCoords(lat: string, lng: string): boolean {
  const la = Number(lat);
  const lo = Number(lng);
  return Number.isFinite(la) && Number.isFinite(lo) && la !== 0 && lo !== 0;
}

function mapsUrl(lat: string, lng: string): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function FormSection({
  title, subtitle, children,
}: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: 'grey.50' }}>
      <Typography variant="subtitle2" fontWeight={700} gutterBottom>{title}</Typography>
      {subtitle && (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
          {subtitle}
        </Typography>
      )}
      {children}
    </Paper>
  );
}

const PIPELINE_LAYERS: GisAssetType[] = ['gravity_main', 'pumping_main', 'distribution_main'];

interface Props {
  projectId: string;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete?: boolean;
  isContractorView?: boolean;
  defaultContractorName?: string;
  onRefresh: () => Promise<void>;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

export default function GisIntegrationPanel({
  projectId, canCreate, canUpdate, canDelete = true, isContractorView = false,
  defaultContractorName = '', onRefresh, onError, onSuccess,
}: Props) {
  const { isMobile } = useBreakpoint();
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [mbs, setMbs] = useState<AssetRecord[]>([]);
  const [layerFilter, setLayerFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AssetForm>(emptyForm());
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [gpsCapturing, setGpsCapturing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoDocs, setPhotoDocs] = useState<AssetRecord[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<AssetRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [assetRes, mbRes] = await Promise.all([
        constructionApi.listAssets(projectId),
        constructionApi.listMbs(projectId),
      ]);
      setAssets(assetRes.data as AssetRecord[]);
      setMbs(mbRes.data as AssetRecord[]);
    } catch (err) {
      onError(formatApiError(err, 'Failed to load GIS assets.'));
    } finally {
      setLoading(false);
    }
  }, [projectId, onError]);

  useEffect(() => { void load(); }, [load]);

  const filteredAssets = useMemo(() => (
    layerFilter === 'all'
      ? assets
      : assets.filter((a) => String(a.assetType) === layerFilter)
  ), [assets, layerFilter]);

  const mappedCount = useMemo(() => assets.filter(isMapped).length, [assets]);
  const mappingPct = assets.length > 0
    ? Math.round((mappedCount / assets.length) * 1000) / 10
    : 0;

  const layerStats = useMemo(() => GIS_ASSET_TYPES.map((type) => {
    const layerAssets = assets.filter((a) => String(a.assetType) === type);
    const mapped = layerAssets.filter(isMapped).length;
    return { type, label: GIS_ASSET_LABELS[type], total: layerAssets.length, mapped };
  }), [assets]);

  const layersRepresented = layerStats.filter((s) => s.total > 0).length;

  const openCreate = () => {
    setEditingId(null);
    setForm({
      ...emptyForm(),
      contractorName: defaultContractorName,
      status: isContractorView ? 'installed' : 'planned',
    });
    setPhotoFile(null);
    setPhotoDocs([]);
    setDialogOpen(true);
  };

  const openEdit = async (asset: AssetRecord) => {
    setEditingId(String(asset.id));
    setForm({
      assetCode: String(asset.assetCode ?? ''),
      assetType: String(asset.assetType ?? 'source') as GisAssetType,
      name: String(asset.name ?? ''),
      latitude: asset.latitude != null ? Number(asset.latitude).toFixed(6) : '',
      longitude: asset.longitude != null ? Number(asset.longitude).toFixed(6) : '',
      chainage: String(asset.chainage ?? ''),
      installationDate: asset.installationDate ? String(asset.installationDate).slice(0, 10) : '',
      contractorName: String(asset.contractorName ?? ''),
      mbReference: String(asset.mbReference ?? ''),
      status: (String(asset.status ?? 'planned') as AssetForm['status']),
    });
    setPhotoFile(null);
    setDialogOpen(true);
    try {
      const { data } = await constructionApi.listDocuments(projectId, {
        resourceType: 'construction_asset',
        resourceId: String(asset.id),
      });
      setPhotoDocs(data as AssetRecord[]);
    } catch {
      setPhotoDocs([]);
    }
  };

  const captureGps = () => {
    if (!navigator.geolocation) {
      onError('GPS is not available in this browser.');
      return;
    }
    setGpsCapturing(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({
          ...prev,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }));
        setGpsCapturing(false);
        onSuccess('GPS coordinates captured.');
      },
      (err) => {
        setGpsCapturing(false);
        onError(err.message || 'Failed to capture GPS coordinates.');
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const applyMbReference = (mbNumber: string) => {
    if (!mbNumber) {
      setForm((prev) => ({ ...prev, mbReference: '' }));
      return;
    }
    const mb = mbs.find((m) => String(m.mbNumber) === mbNumber);
    if (!mb) {
      setForm((prev) => ({ ...prev, mbReference: mbNumber }));
      return;
    }
    const entries = (mb.entries as Array<Record<string, unknown>>) ?? [];
    const first = entries[0];
    const chainage = first
      ? [first.chainageFrom, first.chainageTo].filter(Boolean).join(' → ')
      : '';
    setForm((prev) => ({
      ...prev,
      mbReference: mbNumber,
      latitude: first?.latitude != null ? Number(first.latitude).toFixed(6) : prev.latitude,
      longitude: first?.longitude != null ? Number(first.longitude).toFixed(6) : prev.longitude,
      chainage: chainage || prev.chainage,
      name: prev.name.trim() || String(first?.description ?? '').slice(0, 200),
      installationDate: prev.installationDate
        || (mb.measurementDate ? String(mb.measurementDate).slice(0, 10) : ''),
    }));
    if (first?.latitude != null && first?.longitude != null) {
      onSuccess('GPS and chainage prefilled from selected MB.');
    }
  };

  const gpsReady = hasGpsCoords(form.latitude, form.longitude);
  const showChainage = PIPELINE_LAYERS.includes(form.assetType);
  const gisTheme = constructionTableTheme('gis');

  const uploadPhoto = async (assetId: string) => {
    if (!photoFile) return;
    const formData = new FormData();
    formData.append('file', photoFile);
    formData.append('resourceType', 'construction_asset');
    formData.append('resourceId', assetId);
    formData.append('docType', 'site_photo');
    const { data } = await constructionApi.uploadDocumentFile(projectId, formData);
    const fileUrl = String((data as Record<string, unknown>).fileUrl ?? '');
    if (fileUrl) {
      await constructionApi.updateAsset(projectId, assetId, { photoUrl: fileUrl });
    }
  };

  const handleSave = async () => {
    if (!form.assetCode.trim()) {
      onError('Asset ID is required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        assetCode: form.assetCode.trim(),
        assetType: form.assetType,
        name: form.name.trim() || undefined,
        latitude: form.latitude ? Number(form.latitude) : undefined,
        longitude: form.longitude ? Number(form.longitude) : undefined,
        chainage: form.chainage.trim() || undefined,
        installationDate: form.installationDate || undefined,
        contractorName: form.contractorName.trim() || undefined,
        mbReference: form.mbReference.trim() || undefined,
        status: form.status,
      };
      let assetId = editingId;
      if (editingId) {
        await constructionApi.updateAsset(projectId, editingId, payload);
      } else {
        const { data } = await constructionApi.createAsset(projectId, payload);
        assetId = String((data as Record<string, unknown>).id);
      }
      if (photoFile && assetId) {
        await uploadPhoto(assetId);
      }
      setDialogOpen(false);
      onSuccess(editingId ? 'GIS asset updated.' : 'GIS asset registered.');
      await load();
      await onRefresh();
    } catch (err) {
      onError(formatApiError(err, 'Failed to save GIS asset.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await constructionApi.deleteAsset(projectId, String(deleteTarget.id));
      setDeleteTarget(null);
      onSuccess(`Asset ${String(deleteTarget.assetCode)} deleted.`);
      await load();
      await onRefresh();
    } catch (err) {
      onError(formatApiError(err, 'Failed to delete GIS asset.'));
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <Typography color="text.secondary">Loading GIS assets…</Typography>;
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} gap={2} flexWrap="wrap" sx={constructionSectionBarSx('gis')}>
        <Box>
          <Typography variant="subtitle1" fontWeight={700} color={constructionTableTheme('gis').headerColor}>
            {isContractorView
              ? 'GIS Asset Registration — Contractor'
              : 'Stage 8: GIS Integration — Asset Mapping'}
          </Typography>
          {isContractorView && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              Register valves, pipes, and structures as installed — capture GPS, photo, and MB reference on site.
            </Typography>
          )}
        </Box>
        {canCreate && (
          <Button startIcon={<AddIcon />} variant="contained" size="small" onClick={openCreate}>
            Register Asset
          </Button>
        )}
      </Box>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={4}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="caption" color="text.secondary">GPS Mapping Progress</Typography>
              <Typography variant="h5" fontWeight={700} sx={{ my: 0.5 }}>
                {mappingPct}%
              </Typography>
              <LinearProgress variant="determinate" value={Math.min(100, mappingPct)} sx={{ mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                {mappedCount} of {assets.length} assets mapped
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="caption" color="text.secondary">GIS Layers Represented</Typography>
              <Typography variant="h5" fontWeight={700} sx={{ my: 0.5 }}>
                {layersRepresented} / {GIS_ASSET_TYPES.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="caption" color="text.secondary">Total Registered Assets</Typography>
              <Typography variant="h5" fontWeight={700} sx={{ my: 0.5 }}>
                {assets.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Chip
          label="All Layers"
          size="small"
          color={layerFilter === 'all' ? 'primary' : 'default'}
          onClick={() => setLayerFilter('all')}
          variant={layerFilter === 'all' ? 'filled' : 'outlined'}
        />
        {layerStats.filter((s) => s.total > 0).map((s) => (
          <Chip
            key={s.type}
            label={`${s.label} (${s.mapped}/${s.total})`}
            size="small"
            color={layerFilter === s.type ? 'primary' : 'default'}
            onClick={() => setLayerFilter(s.type)}
            variant={layerFilter === s.type ? 'filled' : 'outlined'}
          />
        ))}
      </Box>

      {assets.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          No GIS assets yet.
        </Typography>
      )}

      <Box sx={{ overflowX: 'auto' }}>
        <Table size="small" sx={constructionTableShellSx('gis')}>
          <ConstructionStyledTableHead stage="gis">
            <TableCell>Asset ID</TableCell>
            <TableCell>GIS Layer</TableCell>
            <TableCell>Name</TableCell>
            <TableCell>Latitude</TableCell>
            <TableCell>Longitude</TableCell>
            <TableCell>Installation Date</TableCell>
            <TableCell>Contractor</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>MB Reference</TableCell>
            <TableCell>Photo</TableCell>
            <TableCell align="right">Actions</TableCell>
          </ConstructionStyledTableHead>
          <TableBody>
            {filteredAssets.map((a) => {
              const mapped = isMapped(a);
              const status = String(a.status ?? 'planned');
              return (
                <TableRow key={String(a.id)} sx={{ bgcolor: mapped ? undefined : 'warning.50' }}>
                  <TableCell>{String(a.assetCode)}</TableCell>
                  <TableCell>{GIS_ASSET_LABELS[String(a.assetType) as GisAssetType] ?? String(a.assetType)}</TableCell>
                  <TableCell>{String(a.name ?? '—')}</TableCell>
                  <TableCell>{formatCoord(a.latitude)}</TableCell>
                  <TableCell>{formatCoord(a.longitude)}</TableCell>
                  <TableCell>{a.installationDate ? String(a.installationDate).slice(0, 10) : '—'}</TableCell>
                  <TableCell>{String(a.contractorName ?? '—')}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={GIS_ASSET_STATUS_LABELS[status as keyof typeof GIS_ASSET_STATUS_LABELS] ?? status}
                      color={STATUS_COLORS[status] ?? 'default'}
                    />
                  </TableCell>
                  <TableCell>{String(a.mbReference ?? '—')}</TableCell>
                  <TableCell>
                    {a.photoUrl ? (
                      <Tooltip title="Photo attached">
                        <PhotoCameraIcon fontSize="small" color="success" />
                      </Tooltip>
                    ) : (
                      <Typography variant="caption" color="text.secondary">—</Typography>
                    )}
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    <Box display="inline-flex" alignItems="center" justifyContent="flex-end" gap={0.25}>
                      {!mapped && (
                        <Tooltip title="GPS coordinates missing">
                          <PlaceIcon fontSize="small" color="warning" />
                        </Tooltip>
                      )}
                      {(canUpdate || canCreate) && (
                        <Tooltip title="Edit asset">
                          <IconButton size="small" onClick={() => { void openEdit(a); }} aria-label="Edit asset">
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {canDelete && (canUpdate || canCreate) && (
                        <Tooltip title="Delete asset">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setDeleteTarget(a)}
                            aria-label="Delete asset"
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
            {filteredAssets.length === 0 && assets.length > 0 && (
              <TableRow>
                <TableCell colSpan={11} align="center">
                  <Typography color="text.secondary" py={2}>No assets in this layer.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Box>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
        scroll="paper"
      >
        <Box sx={{ px: 3, py: 2, background: gisTheme.panelBg, borderBottom: `2px solid ${gisTheme.panelBorder}` }}>
          <Typography variant="overline" color={gisTheme.headerColor} fontWeight={700} letterSpacing={1}>
            Stage 8 · GIS Asset Mapping
          </Typography>
          <Typography variant="h6" fontWeight={700} color={gisTheme.headerColor}>
            {editingId ? 'Edit GIS Asset' : 'Register GIS Asset'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Link field assets to GPS coordinates, measurement book, and site photos for as-built records.
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.25 }}>
            <Chip
              size="small"
              icon={<PlaceIcon />}
              label={gpsReady ? 'GPS captured' : 'GPS pending'}
              color={gpsReady ? 'success' : 'warning'}
              variant={gpsReady ? 'filled' : 'outlined'}
            />
            {form.mbReference && (
              <Chip size="small" icon={<LinkOutlinedIcon />} label={`MB ${form.mbReference}`} variant="outlined" />
            )}
            <Chip
              size="small"
              label={GIS_ASSET_STATUS_LABELS[form.status]}
              color={STATUS_COLORS[form.status] ?? 'default'}
            />
          </Stack>
        </Box>

        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2.5, pb: 1 }}>
          <FormSection
            title="1. Asset identity"
            subtitle="Unique ID and GIS layer for map symbology."
          >
            <Grid container spacing={1.5}>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Asset ID"
                  value={form.assetCode}
                  onChange={(e) => setForm({ ...form, assetCode: e.target.value.toUpperCase() })}
                  required
                  placeholder="BFG-01"
                  helperText="Short code on drawings / MB"
                  InputProps={{ startAdornment: <BadgeOutlinedIcon fontSize="small" color="action" sx={{ mr: 1 }} /> }}
                />
              </Grid>
              <Grid item xs={12} sm={8}>
                <TextField
                  select
                  fullWidth
                  label="GIS Layer"
                  value={form.assetType}
                  onChange={(e) => setForm({ ...form, assetType: e.target.value as GisAssetType })}
                >
                  {GIS_ASSET_TYPES.map((t) => (
                    <MenuItem key={t} value={t}>{GIS_ASSET_LABELS[t]}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Name / Description"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Boulder filled gallery — intake chamber"
                  multiline
                  minRows={2}
                />
              </Grid>
            </Grid>
          </FormSection>

          <FormSection
            title="2. Location & chainage"
            subtitle="Capture GPS on site or copy from linked measurement book."
          >
            <Grid container spacing={1.5} alignItems="flex-start">
              <Grid item xs={12} sm={5}>
                <TextField
                  fullWidth
                  label="Latitude"
                  value={form.latitude}
                  onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                  placeholder="30.286540"
                  inputProps={{ inputMode: 'decimal' }}
                />
              </Grid>
              <Grid item xs={12} sm={5}>
                <TextField
                  fullWidth
                  label="Longitude"
                  value={form.longitude}
                  onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                  placeholder="79.155918"
                  inputProps={{ inputMode: 'decimal' }}
                />
              </Grid>
              <Grid item xs={12} sm={2}>
                <Button
                  fullWidth
                  variant="contained"
                  color="success"
                  startIcon={<MyLocationIcon />}
                  onClick={captureGps}
                  disabled={gpsCapturing}
                  sx={{ height: 56, whiteSpace: 'nowrap' }}
                >
                  {gpsCapturing ? '…' : 'GPS'}
                </Button>
              </Grid>
              {gpsReady && (
                <Grid item xs={12}>
                  <Alert
                    severity="success"
                    icon={<MapOutlinedIcon />}
                    sx={{ py: 0.5, alignItems: 'center' }}
                    action={(
                      <Button
                        size="small"
                        href={mapsUrl(form.latitude, form.longitude)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open map
                      </Button>
                    )}
                  >
                    {form.latitude}, {form.longitude}
                  </Alert>
                </Grid>
              )}
              {showChainage && (
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Chainage"
                    value={form.chainage}
                    onChange={(e) => setForm({ ...form, chainage: e.target.value })}
                    placeholder="0+000 → 0+050"
                    helperText="Pipeline / gallery chainage"
                  />
                </Grid>
              )}
            </Grid>
          </FormSection>

          <FormSection
            title="3. Work linkage"
            subtitle="Tie asset to contractor, installation date, and verified MB."
          >
            <Grid container spacing={1.5}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="date"
                  label="Installation Date"
                  value={form.installationDate}
                  onChange={(e) => setForm({ ...form, installationDate: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Contractor"
                  value={form.contractorName}
                  onChange={(e) => setForm({ ...form, contractorName: e.target.value })}
                  placeholder="Negi and Sons"
                  InputProps={{ startAdornment: <EngineeringOutlinedIcon fontSize="small" color="action" sx={{ mr: 1 }} /> }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  select
                  fullWidth
                  label="MB Reference"
                  value={form.mbReference}
                  onChange={(e) => applyMbReference(e.target.value)}
                  helperText="Selecting an MB prefills GPS, chainage, and work description"
                >
                  <MenuItem value="">— None —</MenuItem>
                  {mbs.map((mb) => {
                    const entries = (mb.entries as Array<Record<string, unknown>>) ?? [];
                    const first = entries[0];
                    const hasGps = first?.latitude != null && first?.longitude != null;
                    return (
                      <MenuItem key={String(mb.id)} value={String(mb.mbNumber)}>
                        MB {String(mb.mbNumber)} · {String(mb.measurementDate ?? '').slice(0, 10)}
                        {hasGps ? ' · GPS ✓' : ''}
                        {' · '}{mbWorkflowStepLabel(String(mb.status))}
                      </MenuItem>
                    );
                  })}
                </TextField>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" sx={{ mb: 0.75 }}>
                  Installation status
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {GIS_ASSET_STATUSES.map((s) => (
                    <Chip
                      key={s}
                      label={GIS_ASSET_STATUS_LABELS[s]}
                      clickable
                      color={form.status === s ? 'primary' : 'default'}
                      variant={form.status === s ? 'filled' : 'outlined'}
                      onClick={() => setForm({ ...form, status: s })}
                    />
                  ))}
                </Stack>
              </Grid>
            </Grid>
          </FormSection>

          <FormSection title="4. Site photo" subtitle="Optional geotagged photo for verification.">
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Button component="label" variant="outlined" startIcon={<PhotoCameraIcon />}>
                {photoFile ? photoFile.name : 'Upload photo'}
                <input
                  type="file"
                  hidden
                  accept="image/*"
                  onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                />
              </Button>
              {photoFile && (
                <Chip size="small" label={`${(photoFile.size / 1024).toFixed(0)} KB`} onDelete={() => setPhotoFile(null)} />
              )}
            </Stack>
            {editingId && photoDocs.length > 0 && (
              <Box mt={1.5}>
                <DprPhotoGallery projectId={projectId} documents={photoDocs} />
              </Box>
            )}
          </FormSection>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, borderTop: 1, borderColor: 'divider' }}>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => { void handleSave(); }}
            disabled={saving || !form.assetCode.trim()}
            startIcon={<PlaceIcon />}
          >
            {saving ? 'Saving…' : editingId ? 'Update Asset' : 'Save Asset'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete GIS Asset?</DialogTitle>
        <DialogContent>
          <Typography>
            Remove asset <strong>{String(deleteTarget?.assetCode ?? '')}</strong>
            {deleteTarget?.name ? ` (${String(deleteTarget.name)})` : ''}? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => { void handleDelete(); }} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
