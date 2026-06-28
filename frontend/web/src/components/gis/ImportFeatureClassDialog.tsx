import { useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  TextField, Typography,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { formatApiError } from '../../utils/apiError';
import {
  geometryWithinDistrictBoundaries,
  jurisdictionRestrictedForAccess,
  OUTSIDE_DISTRICT_LAYER_MESSAGE,
} from '../../utils/jurisdictionGeometry';
import { prepareAttributeSchema, toSnakeCaseIdentifier } from '../../utils/fieldName';
import {
  SURVEY_IMPORT_FORMATS_HELP,
  autoFieldMapping,
  inferAttributeSchemaFromFeatures,
  listSourcePropertyKeys,
  mapPropertiesToSchema,
  parseSurveyFiles,
  summarizeGeometry,
  to2DGeometry,
  type ParsedSurveyFeature,
  type SurveyGeometryType,
} from '../../utils/geoImport';
import { featureClassesApi, gisApi } from '../../services/api';
import { importFeaturesInBatches, summarizeImportFailures } from '../../utils/featureImport';

interface ImportFeatureClassDialogProps {
  open: boolean;
  projectId: string;
  geometryType: SurveyGeometryType;
  geometryLabel: string;
  onClose: () => void;
  onCreated: (classId: string, geometryType: SurveyGeometryType) => void;
  onNavigateMap: (layerId: string, geometryType: SurveyGeometryType) => void;
}

function geometryNoun(geometryType: SurveyGeometryType): string {
  return geometryType === 'Any' ? 'point, line & polygon' : geometryType;
}

function defaultLayerName(fileName: string) {
  return fileName
    .replace(/\.(zip|kml|kmz|csv|shp|geojson|json|txt)$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim();
}

export default function ImportFeatureClassDialog({
  open,
  projectId,
  geometryType,
  geometryLabel,
  onClose,
  onCreated,
  onNavigateMap,
}: ImportFeatureClassDialogProps) {
  const inputId = useId();
  const [parsedFeatures, setParsedFeatures] = useState<ParsedSurveyFeature[]>([]);
  const [fileName, setFileName] = useState('');
  const [layerName, setLayerName] = useState('');
  const [error, setError] = useState('');
  const [importWarning, setImportWarning] = useState('');
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);

  const sourceKeys = useMemo(
    () => listSourcePropertyKeys(parsedFeatures),
    [parsedFeatures],
  );

  const inferredSchema = useMemo(
    () => inferAttributeSchemaFromFeatures(parsedFeatures, toSnakeCaseIdentifier),
    [parsedFeatures],
  );

  const reset = () => {
    setParsedFeatures([]);
    setFileName('');
    setLayerName('');
    setError('');
    setImportWarning('');
    setParsing(false);
    setImporting(false);
  };

  useEffect(() => {
    if (!open) reset();
  }, [open]);

  const processFiles = async (files: File[]) => {
    if (!files.length) return;
    setParsing(true);
    setError('');
    setImportWarning('');
    try {
      const features = await parseSurveyFiles(files, geometryType);
      if (!features.length) {
        throw new Error(`No ${geometryNoun(geometryType)} features found in the selected file.`);
      }
      const label = files[0]?.name ?? 'Imported layer';
      setParsedFeatures(features);
      setFileName(files.map((file) => file.name).join(', '));
      setLayerName((prev) => prev.trim() || defaultLayerName(label));
    } catch (err) {
      setParsedFeatures([]);
      setFileName('');
      setError(err instanceof Error ? err.message : 'Failed to read survey file.');
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (!parsedFeatures.length || !layerName.trim()) return;
    setImporting(true);
    setError('');
    setImportWarning('');
    let createdClassId: string | null = null;
    try {
      const features = parsedFeatures.map((feature, index) => ({
        geometry: to2DGeometry(feature.geometry),
        attributes: mapPropertiesToSchema(
          feature.properties,
          inferredSchema,
          autoFieldMapping(inferredSchema, sourceKeys),
          feature.label,
          index,
        ),
      }));

      let mapAccess: Awaited<ReturnType<typeof gisApi.mapAccess>>['data'] | null = null;
      try {
        const accessRes = await gisApi.mapAccess();
        mapAccess = accessRes.data;
      } catch {
        mapAccess = null;
      }

      if (jurisdictionRestrictedForAccess(mapAccess)) {
        const inDistrict = features.filter((feature) => (
          geometryWithinDistrictBoundaries(
            feature.geometry as { type: string; coordinates: unknown },
            mapAccess?.districtBoundaries,
          )
        ));
        if (!inDistrict.length) {
          setError(
            mapAccess?.activeDistrictName
              ? `All ${features.length} features are outside ${mapAccess.activeDistrictName} district boundary. Import is not allowed.`
              : OUTSIDE_DISTRICT_LAYER_MESSAGE,
          );
          return;
        }
        if (inDistrict.length < features.length) {
          setImportWarning(
            `${features.length - inDistrict.length} feature(s) outside ${mapAccess?.activeDistrictName ?? 'your district'} will be skipped. Only ${inDistrict.length} will be imported.`,
          );
        }
      }

      const attributeSchema = prepareAttributeSchema(inferredSchema);
      const fieldMapping = autoFieldMapping(attributeSchema, sourceKeys);
      const created = await featureClassesApi.create(projectId, {
        code: toSnakeCaseIdentifier(layerName, 'layer'),
        name: layerName.trim(),
        geometryType,
        attributeSchema,
      });
      createdClassId = created.data.id;

      const importPayload = jurisdictionRestrictedForAccess(mapAccess)
        ? features.filter((feature) => (
          geometryWithinDistrictBoundaries(
            feature.geometry as { type: string; coordinates: unknown },
            mapAccess?.districtBoundaries,
          )
        ))
        : features;

      const result = await importFeaturesInBatches(
        projectId,
        created.data.id,
        importPayload,
        geometryType === 'Polygon' || geometryType === 'Any' ? 1 : 10,
      );

      onCreated(created.data.id, geometryType);

      const layersRes = await gisApi.layers();
      const catalog = layersRes.data as Array<{ layers: Array<{ id: string; sourceType: string; sourceConfig?: { featureClassId?: string } }> }>;
      const mapLayer = catalog
        .flatMap((group) => group.layers)
        .find(
          (layer) => layer.sourceType === 'project_feature_class'
            && layer.sourceConfig?.featureClassId === created.data.id,
        );

      if (mapLayer) {
        const access = await gisApi.checkLayerJurisdiction(mapLayer.id);
        if (!access.allowed) {
          setError(access.message ?? OUTSIDE_DISTRICT_LAYER_MESSAGE);
          return;
        }
        onNavigateMap(mapLayer.id, geometryType);
      }

      if (result.failed.length) {
        const detail = summarizeImportFailures(result.failed);
        setImportWarning(
          `Imported ${result.imported} of ${result.total}. ${result.failed.length} skipped${detail ? `: ${detail}` : ''}.`,
        );
      } else {
        onClose();
      }
    } catch (err) {
      if (createdClassId) {
        try {
          await featureClassesApi.remove(projectId, createdClassId);
        } catch {
          // Keep the primary import error visible if rollback fails.
        }
      }
      setError(formatApiError(err, 'Failed to import survey file.'));
    } finally {
      setImporting(false);
    }
  };

  const fileInput = open
    ? createPortal(
      <input
        id={inputId}
        type="file"
        multiple
        onChange={(event) => {
          const list = event.target.files;
          if (list?.length) void processFiles(Array.from(list));
          event.target.value = '';
        }}
        style={{ position: 'fixed', top: -1000, left: -1000, width: 1, height: 1, opacity: 0 }}
      />,
      document.body,
    )
    : null;

  return (
    <>
      {fileInput}
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="sm"
        fullWidth
        disableEnforceFocus
        disableRestoreFocus
      >
        <DialogTitle>Import {geometryLabel}</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Upload a survey file that already contains {geometryNoun(geometryType)} geometry and attributes.
            {geometryType === 'Any' && ' Point, line and polygon features are all imported into one mixed layer.'}
            {' '}A new layer will be created automatically. Formats: {SURVEY_IMPORT_FORMATS_HELP}
          </Typography>

          <Box
            component="label"
            htmlFor={inputId}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const files = Array.from(event.dataTransfer.files ?? []);
              if (files.length) void processFiles(files);
            }}
            sx={{
              display: 'block',
              border: '2px dashed',
              borderColor: parsing ? 'primary.main' : 'divider',
              borderRadius: 1.5,
              p: 3,
              mb: 2,
              textAlign: 'center',
              cursor: parsing || importing ? 'default' : 'pointer',
              bgcolor: 'grey.50',
              '&:hover': parsing || importing ? undefined : { bgcolor: 'action.hover', borderColor: 'primary.light' },
            }}
          >
            {parsing ? (
              <CircularProgress size={28} sx={{ mb: 1 }} />
            ) : (
              <UploadFileIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
            )}
            <Typography variant="subtitle2">
              {parsing ? 'Reading file…' : 'Choose CSV, KML, KMZ, GeoJSON, or Shapefile'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              or drag and drop here
            </Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {importWarning && <Alert severity="warning" sx={{ mb: 2 }}>{importWarning}</Alert>}

          {parsedFeatures.length > 0 && (
            <>
              <TextField
                fullWidth
                required
                label="Layer name"
                value={layerName}
                onChange={(e) => setLayerName(e.target.value)}
                sx={{ mb: 2 }}
              />
              <Alert severity="success" sx={{ mb: 1 }}>
                {parsedFeatures.length} {geometryNoun(geometryType)} feature{parsedFeatures.length === 1 ? '' : 's'} found
                {inferredSchema.length > 0
                  ? ` · ${inferredSchema.length} attribute column${inferredSchema.length === 1 ? '' : 's'} detected`
                  : ' · geometry only (no attribute columns in file)'}
              </Alert>
              {inferredSchema.length > 0 && (
                <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                  Columns: {inferredSchema.map((field) => field.label).join(', ')}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary">
                Sample: {summarizeGeometry(parsedFeatures[0].geometry).summary}
              </Typography>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={importing}>{importWarning ? 'Close' : 'Cancel'}</Button>
          <Button
            variant="contained"
            disabled={!parsedFeatures.length || !layerName.trim() || importing || parsing}
            onClick={handleImport}
          >
            {importing ? 'Importing…' : `Import & Create Layer (${parsedFeatures.length || 0})`}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
