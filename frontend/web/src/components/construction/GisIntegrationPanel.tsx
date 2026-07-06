import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
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
import { buildConstructionAssetMapUrl, buildProjectGisMapExplorerUrl } from '../../utils/mapExplorerLinks';

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

function assetPhotoUrl(asset: AssetRecord): string {
  return String(asset.photoUrl ?? asset.photo_url ?? '').trim();
}

function assetPhotoDocId(asset: AssetRecord): string {
  return String(asset.photoDocId ?? asset.photo_doc_id ?? '').trim();
}

function assetHasPhoto(asset: AssetRecord): boolean {
  return Boolean(assetPhotoUrl(asset) || assetPhotoDocId(asset));
}

function GisAssetPhotoThumb({
  projectId, asset, onAddPhoto,
}: {
  projectId: string;
  asset: AssetRecord;
  onAddPhoto?: () => void;
}) {
  const docId = assetPhotoDocId(asset);
  const hasPhoto = assetHasPhoto(asset);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    if (!docId) {
      setThumbUrl(null);
      setFailed(false);
      return undefined;
    }
    void constructionApi.fetchDocumentFile(projectId, docId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setThumbUrl(objectUrl);
        setFailed(false);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [projectId, docId]);

  if (!hasPhoto) {
    if (onAddPhoto) {
      return (
        <Button size="small" variant="text" startIcon={<PhotoCameraIcon />} onClick={onAddPhoto} sx={{ minWidth: 0, px: 0.5 }}>
          Add photo
        </Button>
      );
    }
    return <Typography variant="caption" color="text.secondary">—</Typography>;
  }
  const directUrl = assetPhotoUrl(asset);
  if (!docId && directUrl) {
    return (
      <Tooltip title="Site photo — tap Edit to view full size">
        <Box
          component="img"
          src={directUrl}
          alt="Site"
          sx={{
            width: 44,
            height: 44,
            objectFit: 'cover',
            borderRadius: 1,
            border: 1,
            borderColor: 'success.light',
            display: 'block',
          }}
        />
      </Tooltip>
    );
  }
  if (thumbUrl) {
    return (
      <Tooltip title="Site photo — tap Edit to view full size">
        <Box
          component="img"
          src={thumbUrl}
          alt="Site"
          sx={{
            width: 44,
            height: 44,
            objectFit: 'cover',
            borderRadius: 1,
            border: 1,
            borderColor: 'success.light',
            display: 'block',
          }}
        />
      </Tooltip>
    );
  }
  if (failed) {
    return (
      <Tooltip title="Photo on file — preview unavailable">
        <PhotoCameraIcon fontSize="small" color="warning" />
      </Tooltip>
    );
  }
  return <CircularProgress size={18} />;
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
  const navigate = useNavigate();
  const { isMobile } = useBreakpoint();
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [mbs, setMbs] = useState<AssetRecord[]>([]);
  const [layerFilter, setLayerFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AssetForm>(emptyForm());
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoGeotagging, setPhotoGeotagging] = useState(false);
  const [gpsCapturing, setGpsCapturing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoDocs, setPhotoDocs] = useState<AssetRecord[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<AssetRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const saveActionsRef = useRef<HTMLDivElement>(null);
  const assetCodeInputRef = useRef<HTMLInputElement>(null);
  const photoFileRef = useRef<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);

  const scrollToSaveActions = useCallback(() => {
    requestAnimationFrame(() => {
      saveActionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
  }, []);

  const scrollToAssetCode = useCallback(() => {
    requestAnimationFrame(() => {
      assetCodeInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      assetCodeInputRef.current?.focus();
    });
  }, []);

  useEffect(() => () => {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
  }, [photoPreviewUrl]);

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
    photoFileRef.current = null;
    setPhotoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
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
    photoFileRef.current = null;
    setPhotoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
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

  const uploadPhoto = async (assetId: string, file?: File | null) => {
    const uploadFile = file ?? photoFileRef.current ?? photoFile;
    if (!uploadFile?.size) return;
    const formData = new FormData();
    formData.append('file', uploadFile, uploadFile.name || 'site-photo.jpg');
    formData.append('resourceType', 'construction_asset');
    formData.append('resourceId', assetId);
    formData.append('docType', 'site_photo');
    const { data } = await constructionApi.uploadDocumentFile(projectId, formData);
    const doc = data as Record<string, unknown>;
    const docId = String(doc.id ?? '').trim();
    const fileUrl = String(doc.fileUrl ?? doc.file_url ?? '').trim();
    if (!fileUrl && !docId) {
      throw new Error('Photo upload succeeded but no document was returned.');
    }
    // Backend sets photoUrl on construction_asset site_photo upload; update is belt-and-suspenders.
    if (fileUrl) {
      await constructionApi.updateAsset(projectId, assetId, { photoUrl: fileUrl });
    }
  };

  const setCapturedPhoto = (file: File): boolean => {
    if (!file?.size) {
      onError('Photo file is empty — retake the picture on site.');
      return false;
    }
    photoFileRef.current = file;
    setPhotoFile(file);
    setPhotoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    return true;
  };

  const captureLivePhoto = (file: File) => {
    if (!setCapturedPhoto(file)) return;
    const afterCapture = () => scrollToSaveActions();
    const tryImmediateUpload = async () => {
      if (!editingId) return;
      try {
        await uploadPhoto(editingId, file);
        onSuccess('Site photo uploaded to server.');
        await load();
      } catch (err) {
        onError(formatApiError(err, 'Photo captured but upload failed — tap Save Asset to retry.'));
      }
    };
    if (hasGpsCoords(form.latitude, form.longitude)) {
      onSuccess('Live site photo captured — linked to current GPS coordinates.');
      afterCapture();
      void tryImmediateUpload();
      return;
    }
    if (!navigator.geolocation) {
      onError('Photo captured. GPS unavailable — tap GPS to geotag this asset.');
      afterCapture();
      void tryImmediateUpload();
      return;
    }
    setPhotoGeotagging(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({
          ...prev,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }));
        setPhotoGeotagging(false);
        onSuccess('Live photo captured with GPS geotag.');
        afterCapture();
        void tryImmediateUpload();
      },
      (err) => {
        setPhotoGeotagging(false);
        onError(err.message || 'Photo captured but GPS geotag failed — use GPS button.');
        afterCapture();
        void tryImmediateUpload();
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
  const assetCodeReady = Boolean(form.assetCode.trim());
  const showChainage = PIPELINE_LAYERS.includes(form.assetType);
  const gisTheme = constructionTableTheme('gis');

  const handleSave = async () => {
    if (!form.assetCode.trim()) {
      onError('Asset ID is required — enter a code in section 1 (e.g. BFG-01).');
      scrollToAssetCode();
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
      const pendingPhoto = photoFileRef.current ?? photoFile;
      if (pendingPhoto?.size && assetId) {
        try {
          await uploadPhoto(assetId, pendingPhoto);
        } catch (photoErr) {
          onError(formatApiError(
            photoErr,
            'Asset saved but photo upload failed — open Edit, retake the live photo, and save again.',
          ));
          await load();
          await onRefresh();
          return;
        }
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
        {assets.some(isMapped) && (
          <Button
            startIcon={<MapOutlinedIcon />}
            variant="outlined"
            color="primary"
            size="small"
            onClick={() => navigate(buildProjectGisMapExplorerUrl(projectId, assets))}
          >
            Map Explorer
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
                    <GisAssetPhotoThumb
                      projectId={projectId}
                      asset={a}
                      onAddPhoto={(canUpdate || canCreate) ? () => { void openEdit(a); } : undefined}
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap', minWidth: isMobile ? 120 : 100 }}>
                    <Box display="inline-flex" alignItems="center" justifyContent="flex-end" gap={0.5} flexWrap="wrap">
                      {!mapped && (
                        <Tooltip title="GPS coordinates missing">
                          <PlaceIcon fontSize="small" color="warning" />
                        </Tooltip>
                      )}
                      {mapped ? (
                        isMobile ? (
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<MapOutlinedIcon />}
                            onClick={() => navigate(buildConstructionAssetMapUrl({
                              projectId,
                              assetCode: String(a.assetCode),
                              latitude: Number(a.latitude),
                              longitude: Number(a.longitude),
                              assetName: a.name ? String(a.name) : undefined,
                              assetType: String(a.assetType),
                            }))}
                          >
                            Map
                          </Button>
                        ) : (
                          <Tooltip title="View on map">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => navigate(buildConstructionAssetMapUrl({
                                projectId,
                                assetCode: String(a.assetCode),
                                latitude: Number(a.latitude),
                                longitude: Number(a.longitude),
                                assetName: a.name ? String(a.name) : undefined,
                                assetType: String(a.assetType),
                              }))}
                              aria-label="View on map"
                            >
                              <MapOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )
                      ) : (
                        <Tooltip title="GPS required">
                          <span>
                            <IconButton size="small" disabled aria-label="View on map (GPS required)">
                              <MapOutlinedIcon fontSize="small" />
                            </IconButton>
                          </span>
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
        PaperProps={{
          sx: {
            display: 'flex',
            flexDirection: 'column',
            maxHeight: isMobile ? '100dvh' : '92vh',
          },
        }}
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

        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2.5, pb: 1, flex: '1 1 auto', overflowY: 'auto' }}>
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
                  helperText={assetCodeReady ? 'Short code on drawings / MB' : 'Required — enter before Save (e.g. BFG-01)'}
                  error={!assetCodeReady && Boolean(photoFile)}
                  inputRef={assetCodeInputRef}
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

          <FormSection
            title="4. Site photo"
            subtitle="Take a live photo on site — camera opens on mobile; GPS geotag is applied automatically."
          >
            <Stack spacing={1.25}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Button
                  component="label"
                  variant="outlined"
                  color="primary"
                  startIcon={<PhotoCameraIcon />}
                  disabled={photoGeotagging}
                >
                  {photoGeotagging ? 'Geotagging…' : photoFile ? 'Retake live photo' : 'Capture live photo at site'}
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) captureLivePhoto(file);
                      e.target.value = '';
                    }}
                  />
                </Button>
                {photoFile && (
                  <Chip
                    size="small"
                    icon={<PhotoCameraIcon />}
                    label={`${photoFile.name} · ${(photoFile.size / 1024).toFixed(0)} KB`}
                    color="success"
                    onDelete={() => {
                      photoFileRef.current = null;
                      setPhotoFile(null);
                      setPhotoPreviewUrl((prev) => {
                        if (prev) URL.revokeObjectURL(prev);
                        return null;
                      });
                    }}
                  />
                )}
              </Stack>
              {photoPreviewUrl && (
                <Box
                  component="img"
                  src={photoPreviewUrl}
                  alt="Site preview"
                  sx={{
                    width: '100%',
                    maxHeight: 200,
                    objectFit: 'contain',
                    borderRadius: 1,
                    border: 1,
                    borderColor: 'success.light',
                    bgcolor: '#111',
                  }}
                />
              )}
              <Typography variant="caption" color="text.secondary">
                Use device camera at the installation point. Coordinates from GPS are stored with the asset record for verification.
              </Typography>
              {photoFile && !assetCodeReady && (
                <Alert severity="info" sx={{ py: 0.5 }}>
                  Photo ready — scroll up to enter <strong>Asset ID</strong> in section 1, then tap <strong>Save Asset</strong> below.
                </Alert>
              )}
              {photoFile && gpsReady && (
                <Alert severity="success" icon={<PlaceIcon />} sx={{ py: 0.5 }}>
                  Geotagged: {formatCoord(form.latitude)}, {formatCoord(form.longitude)}
                </Alert>
              )}
              {photoFile && !gpsReady && !photoGeotagging && (
                <Alert severity="warning" sx={{ py: 0.5 }}>
                  Photo captured — GPS geotag pending. Tap <strong>GPS</strong> in section 2 or retake the photo on site.
                </Alert>
              )}
            </Stack>
            {editingId && photoDocs.length > 0 && (
              <Box mt={1.5}>
                <DprPhotoGallery projectId={projectId} documents={photoDocs} />
              </Box>
            )}
          </FormSection>
        </DialogContent>

        <DialogActions
          ref={saveActionsRef}
          id="gis-asset-save-actions"
          sx={{
            px: 3,
            py: 2,
            flexShrink: 0,
            position: 'sticky',
            bottom: 0,
            zIndex: 3,
            bgcolor: 'background.paper',
            borderTop: 1,
            borderColor: 'divider',
            boxShadow: '0 -4px 16px rgba(0,0,0,0.1)',
            pb: isMobile ? 'calc(12px + env(safe-area-inset-bottom, 0px))' : 2,
            flexWrap: 'wrap',
            gap: 1,
          }}
        >
          {!assetCodeReady && photoFile && (
            <Typography variant="body2" color="warning.main" sx={{ flex: '1 1 100%', mb: 0.5 }}>
              Enter Asset ID in section 1 to enable submission.
            </Typography>
          )}
          <Box sx={{ flex: '1 1 auto' }} />
          <Button onClick={() => setDialogOpen(false)} disabled={saving || photoGeotagging}>Cancel</Button>
          <Button
            variant="contained"
            color="primary"
            size={isMobile ? 'large' : 'medium'}
            onClick={() => { void handleSave(); }}
            disabled={saving || photoGeotagging}
            startIcon={<PlaceIcon />}
            sx={isMobile ? { minWidth: 160, fontWeight: 700 } : undefined}
          >
            {saving ? 'Saving…' : photoGeotagging ? 'Geotagging…' : editingId ? 'Update Asset' : 'Save Asset'}
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
