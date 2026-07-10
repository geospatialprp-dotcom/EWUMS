import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Card, CardContent, Chip,
  CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Grid, IconButton,
  LinearProgress, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableRow, TextField,
  Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import CloseIcon from '@mui/icons-material/Close';
import PlaceIcon from '@mui/icons-material/Place';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import EngineeringOutlinedIcon from '@mui/icons-material/EngineeringOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
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
import { buildConstructionAssetMapUrl, buildProjectGisMapExplorerUrl, normalizeConstructionGps, readAssetLatitude, readAssetLongitude } from '../../utils/mapExplorerLinks';
import { formatCoordinatePair, formatCoordinateString } from '../../utils/coordinateFields';

type AssetRecord = Record<string, unknown>;

type AssetForm = {
  assetCode: string;
  assetType: GisAssetType;
  name: string;
  latitude: string;
  longitude: string;
  manufacturer: string;
  capacity: string;
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
  manufacturer: '',
  capacity: '',
  chainage: '',
  installationDate: '',
  contractorName: '',
  mbReference: '',
  status: 'planned',
});

function readAssetManufacturer(asset: AssetRecord): string {
  const attrs = asset.attributes as Record<string, unknown> | undefined;
  return String(asset.manufacturer ?? attrs?.manufacturer ?? '').trim();
}

function readAssetCapacity(asset: AssetRecord): string {
  const attrs = asset.attributes as Record<string, unknown> | undefined;
  return String(asset.capacity ?? attrs?.capacity ?? '').trim();
}

function isMapped(asset: AssetRecord): boolean {
  const lat = readAssetLatitude(asset);
  const lng = readAssetLongitude(asset);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;
}

function formatCoord(value: unknown): string {
  return formatCoordinateString(value) ?? '—';
}

function hasGpsCoords(lat: string, lng: string): boolean {
  const la = Number(lat);
  const lo = Number(lng);
  return Number.isFinite(la) && Number.isFinite(lo) && la !== 0 && lo !== 0;
}

const GPS_MIN_ACCEPTABLE_ACCURACY_M = 120;
const GPS_CAPTURE_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 20000,
  maximumAge: 0,
};

function mapsUrl(lat: string, lng: string): string {
  const { lat: normLat, lng: normLng } = normalizeConstructionGps(Number(lat), Number(lng));
  return `https://www.google.com/maps?q=${normLat},${normLng}`;
}

function gpsFormValues(lat: number, lng: number): Pick<AssetForm, 'latitude' | 'longitude'> {
  const { lat: normLat, lng: normLng } = normalizeConstructionGps(lat, lng);
  return {
    latitude: normLat.toFixed(6),
    longitude: normLng.toFixed(6),
  };
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

const GIS_PHOTO_THUMB_SX = {
  width: 44,
  height: 44,
  objectFit: 'cover' as const,
  borderRadius: 1,
  border: 1,
  borderColor: 'success.light',
  display: 'block',
};

function GisSitePhotoViewer({
  open, onClose, imageUrl, title, subtitle, isMobile,
}: {
  open: boolean;
  onClose: () => void;
  imageUrl: string | null;
  title: string;
  subtitle?: string;
  isMobile: boolean;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isMobile}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: isMobile ? undefined : { maxHeight: '92vh' } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, py: 1.5 }}>
        <Box minWidth={0}>
          <Typography variant="subtitle1" fontWeight={700} noWrap>{title}</Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary" display="block">
              {subtitle}
            </Typography>
          )}
        </Box>
        <IconButton onClick={onClose} aria-label="Close photo" edge="end" sx={{ mt: -0.5 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent
        sx={{
          p: 0,
          bgcolor: '#111',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: isMobile ? 'calc(100dvh - 96px)' : 360,
        }}
      >
        {imageUrl ? (
          <Box
            component="img"
            src={imageUrl}
            alt={title}
            sx={{
              maxWidth: '100%',
              maxHeight: isMobile ? 'calc(100dvh - 120px)' : '72vh',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        ) : (
          <CircularProgress color="inherit" sx={{ color: 'grey.400' }} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function GisAssetPhotoThumb({
  projectId, asset, onAddPhoto, isMobile,
}: {
  projectId: string;
  asset: AssetRecord;
  onAddPhoto?: () => void;
  isMobile: boolean;
}) {
  const docId = assetPhotoDocId(asset);
  const directUrl = assetPhotoUrl(asset);
  const hasPhoto = assetHasPhoto(asset);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    const applyUrl = (url: string) => {
      if (!cancelled) {
        setThumbUrl(url);
        setViewerUrl(url);
        setFailed(false);
      }
    };

    if (directUrl) {
      applyUrl(directUrl);
      return () => { cancelled = true; };
    }

    if (!docId) {
      setThumbUrl(null);
      setViewerUrl(null);
      setFailed(false);
      return undefined;
    }

    void constructionApi.fetchDocumentFile(projectId, docId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        applyUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [projectId, docId, directUrl]);

  const assetCode = String(asset.assetCode ?? 'Asset');
  const geoSubtitle = isMapped(asset)
    ? `Geotagged · ${formatCoord(asset.latitude)}, ${formatCoord(asset.longitude)}`
    : 'Site photo';

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

  if (failed) {
    return (
      <Tooltip title="Photo on file — tap to retake">
        <IconButton size="small" color="warning" onClick={onAddPhoto} aria-label="Retake site photo">
          <PhotoCameraIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    );
  }

  if (!thumbUrl) {
    return <CircularProgress size={18} />;
  }

  return (
    <>
      <Tooltip title="Tap to view full-size geotagged photo">
        <IconButton
          onClick={() => setViewerOpen(true)}
          aria-label={`View site photo for ${assetCode}`}
          sx={{ p: 0, borderRadius: 1, '&:hover': { opacity: 0.92 } }}
        >
          <Box component="img" src={thumbUrl} alt={`Site photo ${assetCode}`} sx={GIS_PHOTO_THUMB_SX} />
        </IconButton>
      </Tooltip>
      <GisSitePhotoViewer
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
        imageUrl={viewerUrl}
        title={`${assetCode} — site photo`}
        subtitle={geoSubtitle}
        isMobile={isMobile}
      />
    </>
  );
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
  const [capturePreviewOpen, setCapturePreviewOpen] = useState(false);
  const [gpsAccuracyM, setGpsAccuracyM] = useState<number | null>(null);

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
    setGpsAccuracyM(null);
    setDialogOpen(true);
  };

  const openEdit = async (asset: AssetRecord) => {
    setEditingId(String(asset.id));
    setForm({
      assetCode: String(asset.assetCode ?? ''),
      assetType: String(asset.assetType ?? 'source') as GisAssetType,
      name: String(asset.name ?? ''),
      latitude: formatCoordinateString(asset.latitude) ?? '',
      longitude: formatCoordinateString(asset.longitude) ?? '',
      manufacturer: readAssetManufacturer(asset),
      capacity: readAssetCapacity(asset),
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
    setGpsAccuracyM(null);
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

  const captureValidatedGps = (
    onReliableFix: (coords: GeolocationCoordinates) => void,
    onWeakFix?: (coords: GeolocationCoordinates) => void,
    onFailure?: () => void,
  ) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const accuracy = Number(pos.coords.accuracy);
        if (Number.isFinite(accuracy)) {
          setGpsAccuracyM(accuracy);
        }
        if (Number.isFinite(accuracy) && accuracy > GPS_MIN_ACCEPTABLE_ACCURACY_M) {
          onWeakFix?.(pos.coords);
          onError(
            `GPS signal is weak (±${Math.round(accuracy)} m). Move outside, enable precise location, then retake GPS/photo.`,
          );
          return;
        }
        onReliableFix(pos.coords);
      },
      (err) => {
        onFailure?.();
        onError(err.message || 'Failed to capture GPS coordinates.');
      },
      GPS_CAPTURE_OPTIONS,
    );
  };

  const captureGps = () => {
    if (!navigator.geolocation) {
      onError('GPS is not available in this browser.');
      return;
    }
    setGpsCapturing(true);
    captureValidatedGps(
      (coords) => {
        setForm((prev) => ({
          ...prev,
          ...gpsFormValues(coords.latitude, coords.longitude),
        }));
        setGpsCapturing(false);
        const acc = Number.isFinite(coords.accuracy) ? ` (±${Math.round(coords.accuracy)} m)` : '';
        onSuccess(`GPS coordinates captured${acc}.`);
      },
      () => {
        setGpsCapturing(false);
      },
      () => {
        setGpsCapturing(false);
      },
    );
  };

  const uploadPhoto = async (assetId: string, file?: File | null): Promise<{ docId: string; fileUrl: string } | null> => {
    const uploadFile = file ?? photoFileRef.current ?? photoFile;
    if (!uploadFile?.size) return null;
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
    if (fileUrl) {
      await constructionApi.updateAsset(projectId, assetId, { photoUrl: fileUrl });
    }
    return { docId, fileUrl };
  };

  const patchAssetPhoto = (assetId: string, fileUrl: string, photoDocId?: string) => {
    setAssets((prev) => prev.map((a) => (
      String(a.id) === assetId
        ? { ...a, photoUrl: fileUrl, photoDocId: photoDocId ?? a.photoDocId }
        : a
    )));
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
        const uploaded = await uploadPhoto(editingId, file);
        if (uploaded?.fileUrl) {
          patchAssetPhoto(editingId, uploaded.fileUrl, uploaded.docId || undefined);
        }
        onSuccess('Site photo uploaded — tap the thumbnail in the table to view full size.');
        await load();
      } catch (err) {
        onError(formatApiError(err, 'Photo captured but upload failed — tap Save Asset to retry.'));
      }
    };
    if (!navigator.geolocation) {
      onError('Photo captured. GPS unavailable — tap GPS to geotag this asset.');
      afterCapture();
      void tryImmediateUpload();
      return;
    }
    setPhotoGeotagging(true);
    captureValidatedGps(
      (coords) => {
        const hadExistingCoords = hasGpsCoords(form.latitude, form.longitude);
        setForm((prev) => ({
          ...prev,
          ...gpsFormValues(coords.latitude, coords.longitude),
        }));
        setPhotoGeotagging(false);
        const acc = Number.isFinite(coords.accuracy) ? ` (±${Math.round(coords.accuracy)} m)` : '';
        onSuccess(
          hadExistingCoords
            ? `Live photo recaptured with fresh GPS geotag${acc}.`
            : `Live photo captured with GPS geotag${acc}.`,
        );
        afterCapture();
        void tryImmediateUpload();
      },
      () => {
        setPhotoGeotagging(false);
        onError('Photo captured but GPS fix is weak — move outside and retake for accurate geotag.');
        afterCapture();
      },
      () => {
        setPhotoGeotagging(false);
        onError('Photo captured but GPS geotag failed — use GPS button.');
        afterCapture();
      },
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
      const latNum = form.latitude ? Number(form.latitude) : undefined;
      const lngNum = form.longitude ? Number(form.longitude) : undefined;
      const normalizedGps = latNum != null && lngNum != null
        ? normalizeConstructionGps(latNum, lngNum)
        : null;
      const payload = {
        assetCode: form.assetCode.trim(),
        assetType: form.assetType,
        name: form.name.trim() || undefined,
        latitude: normalizedGps?.lat ?? latNum,
        longitude: normalizedGps?.lng ?? lngNum,
        manufacturer: form.manufacturer.trim() || undefined,
        capacity: form.capacity.trim() || undefined,
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
      let photoUploaded = false;
      if (pendingPhoto?.size && assetId) {
        try {
          const uploaded = await uploadPhoto(assetId, pendingPhoto);
          if (uploaded?.fileUrl) {
            patchAssetPhoto(assetId, uploaded.fileUrl, uploaded.docId || undefined);
            photoUploaded = true;
          }
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
      if (photoUploaded) {
        onSuccess(editingId ? 'GIS asset updated with geotagged site photo.' : 'GIS asset registered with geotagged site photo.');
      } else {
        onSuccess(editingId ? 'GIS asset updated.' : 'GIS asset registered.');
      }
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
            <TableCell>Name</TableCell>
            <TableCell>Type</TableCell>
            <TableCell>Manufacturer</TableCell>
            <TableCell>Capacity</TableCell>
            <TableCell align="right">Latitude</TableCell>
            <TableCell align="right">Longitude</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Photo</TableCell>
            <TableCell>MB Reference</TableCell>
            <TableCell align="right">Actions</TableCell>
          </ConstructionStyledTableHead>
          <TableBody>
            {filteredAssets.map((a) => {
              const mapped = isMapped(a);
              const status = String(a.status ?? 'planned');
              return (
                <TableRow key={String(a.id)} sx={{ bgcolor: mapped ? undefined : 'warning.50' }}>
                  <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{String(a.assetCode)}</TableCell>
                  <TableCell>{String(a.name ?? '—')}</TableCell>
                  <TableCell>{GIS_ASSET_LABELS[String(a.assetType) as GisAssetType] ?? String(a.assetType)}</TableCell>
                  <TableCell>{readAssetManufacturer(a) || '—'}</TableCell>
                  <TableCell>{readAssetCapacity(a) || '—'}</TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatCoordinateString(readAssetLatitude(a)) ?? '—'}
                  </TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatCoordinateString(readAssetLongitude(a)) ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={GIS_ASSET_STATUS_LABELS[status as keyof typeof GIS_ASSET_STATUS_LABELS] ?? status}
                      color={STATUS_COLORS[status] ?? 'default'}
                    />
                  </TableCell>
                  <TableCell align="center" sx={{ width: 56, p: 0.75 }}>
                    <GisAssetPhotoThumb
                      projectId={projectId}
                      asset={a}
                      isMobile={isMobile}
                      onAddPhoto={(canUpdate || canCreate) ? () => { void openEdit(a); } : undefined}
                    />
                  </TableCell>
                  <TableCell>{String(a.mbReference ?? '—')}</TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      whiteSpace: 'nowrap',
                      width: 112,
                      minWidth: 112,
                      p: 0.75,
                      verticalAlign: 'middle',
                    }}
                  >
                    <Stack
                      direction="row"
                      spacing={0}
                      alignItems="center"
                      justifyContent="flex-end"
                      flexWrap="nowrap"
                    >
                      {!mapped && (
                        <Tooltip title="GPS coordinates missing">
                          <PlaceIcon fontSize="small" color="warning" sx={{ mr: 0.25 }} />
                        </Tooltip>
                      )}
                      <Tooltip title={mapped ? 'View on map' : 'GPS required'}>
                        <span>
                          <IconButton
                            size="small"
                            color="primary"
                            disabled={!mapped}
                            onClick={() => {
                              if (!mapped) return;
                              navigate(buildConstructionAssetMapUrl({
                                projectId,
                                assetCode: String(a.assetCode),
                                latitude: readAssetLatitude(a),
                                longitude: readAssetLongitude(a),
                                assetName: a.name ? String(a.name) : undefined,
                                assetType: String(a.assetType),
                              }));
                            }}
                            aria-label="View on map"
                          >
                            <MapOutlinedIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
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
                    </Stack>
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
            title="Asset details"
            subtitle="Primary fields aligned with O&M asset register."
          >
            <Grid container spacing={1.5}>
              <Grid item xs={12}>
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
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Asset Name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Boulder filled gallery — intake chamber"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  select
                  fullWidth
                  label="Type"
                  value={form.assetType}
                  onChange={(e) => setForm({ ...form, assetType: e.target.value as GisAssetType })}
                >
                  {GIS_ASSET_TYPES.map((t) => (
                    <MenuItem key={t} value={t}>{GIS_ASSET_LABELS[t]}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={5}>
                <TextField
                  fullWidth
                  label="Latitude (°N)"
                  value={form.latitude}
                  onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                  placeholder="30.286540"
                  inputProps={{ inputMode: 'decimal' }}
                  helperText="Decimal degrees, 6 places"
                />
              </Grid>
              <Grid item xs={12} sm={5}>
                <TextField
                  fullWidth
                  label="Longitude (°E)"
                  value={form.longitude}
                  onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                  placeholder="79.155918"
                  inputProps={{ inputMode: 'decimal' }}
                  helperText="Decimal degrees, 6 places"
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
                    GIS preview: {formatCoordinatePair(form.latitude, form.longitude)}
                  </Alert>
                </Grid>
              )}
              {gpsAccuracyM != null && (
                <Grid item xs={12}>
                  <Typography variant="caption" color={gpsAccuracyM <= GPS_MIN_ACCEPTABLE_ACCURACY_M ? 'success.main' : 'warning.main'}>
                    GPS accuracy: ±{Math.round(gpsAccuracyM)} m (target: {'<='} {GPS_MIN_ACCEPTABLE_ACCURACY_M} m)
                  </Typography>
                </Grid>
              )}
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" sx={{ mb: 0.75 }}>
                  Status
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
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Manufacturer"
                  value={form.manufacturer}
                  onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Capacity"
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <Accordion disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, '&:before': { display: 'none' } }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="body2" fontWeight={600}>Additional / site details</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
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
                  </AccordionDetails>
                </Accordion>
              </Grid>
            </Grid>
          </FormSection>

          <FormSection
            title="Site photo"
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
                <>
                  <Tooltip title="Tap to view full-size preview">
                    <IconButton
                      onClick={() => setCapturePreviewOpen(true)}
                      aria-label="View captured photo full size"
                      sx={{ p: 0, width: '100%', borderRadius: 1, display: 'block' }}
                    >
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
                    </IconButton>
                  </Tooltip>
                  <GisSitePhotoViewer
                    open={capturePreviewOpen}
                    onClose={() => setCapturePreviewOpen(false)}
                    imageUrl={photoPreviewUrl}
                    title={`${form.assetCode.trim() || 'New asset'} — captured photo`}
                    subtitle={gpsReady ? `Geotagged · ${formatCoord(form.latitude)}, ${formatCoord(form.longitude)}` : 'Site photo preview'}
                    isMobile={isMobile}
                  />
                </>
              )}
              <Typography variant="caption" color="text.secondary">
                Use device camera at the installation point. Coordinates from GPS are stored with the asset record for verification.
              </Typography>
              {photoFile && !assetCodeReady && (
                <Alert severity="info" sx={{ py: 0.5 }}>
                  Photo ready — scroll up to enter <strong>Asset ID</strong>, then tap <strong>Save Asset</strong> below.
                </Alert>
              )}
              {photoFile && gpsReady && (
                <Alert severity="success" icon={<PlaceIcon />} sx={{ py: 0.5 }}>
                  Geotagged: {formatCoordinatePair(form.latitude, form.longitude)}
                </Alert>
              )}
              {photoFile && !gpsReady && !photoGeotagging && (
                <Alert severity="warning" sx={{ py: 0.5 }}>
                  Photo captured — GPS geotag pending. Tap <strong>GPS</strong> above or retake the photo on site.
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
