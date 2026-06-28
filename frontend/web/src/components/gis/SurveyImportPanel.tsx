import { useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Alert, Box, CircularProgress, FormControl, InputLabel, MenuItem, Select,
  Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import type { AttributeField } from '../../services/api';
import {
  SURVEY_IMPORT_FORMATS_HELP,
  listSourcePropertyKeys,
  mapPropertiesToSchema,
  parseSurveyFiles,
  summarizeGeometry,
  to2DGeometry,
  type ParsedSurveyFeature,
  type SurveyGeometryType,
} from '../../utils/geoImport';

export type SurveyImportPayload = Array<{
  geometry: object;
  attributes: Record<string, unknown>;
}>;

interface SurveyImportPanelProps {
  geometryType: SurveyGeometryType;
  attributeSchema: AttributeField[];
  featureClassName?: string;
  compact?: boolean;
  disabled?: boolean;
  active?: boolean;
  onPayloadChange?: (payload: SurveyImportPayload | null) => void;
  onError?: (message: string) => void;
}

function buildPayload(
  parsedFeatures: ParsedSurveyFeature[],
  attributeSchema: AttributeField[],
  fieldMapping: Record<string, string>,
): SurveyImportPayload {
  return parsedFeatures.map((feature, index) => ({
    geometry: to2DGeometry(feature.geometry),
    attributes: mapPropertiesToSchema(
      feature.properties,
      attributeSchema,
      fieldMapping,
      feature.label,
      index,
    ),
  }));
}

export default function SurveyImportPanel({
  geometryType,
  attributeSchema,
  featureClassName,
  compact,
  disabled,
  active = true,
  onPayloadChange,
  onError,
}: SurveyImportPanelProps) {
  const inputId = useId();
  const [parsedFeatures, setParsedFeatures] = useState<ParsedSurveyFeature[]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [parsing, setParsing] = useState(false);

  const sourceKeys = useMemo(
    () => listSourcePropertyKeys(parsedFeatures),
    [parsedFeatures],
  );

  const invalidFeatures = useMemo(
    () => parsedFeatures.filter((feature) => !summarizeGeometry(feature.geometry).valid),
    [parsedFeatures],
  );

  useEffect(() => {
    if (!active) {
      setParsedFeatures([]);
      setFieldMapping({});
      setFileName('');
      setError('');
      onPayloadChange?.(null);
    }
  }, [active, onPayloadChange]);

  useEffect(() => {
    if (!parsedFeatures.length) {
      onPayloadChange?.(null);
      return;
    }
    onPayloadChange?.(buildPayload(parsedFeatures, attributeSchema, fieldMapping));
  }, [parsedFeatures, attributeSchema, fieldMapping, onPayloadChange]);

  useEffect(() => {
    if (!parsedFeatures.length || !attributeSchema.length) return;
    const keys = listSourcePropertyKeys(parsedFeatures);
    setFieldMapping((prev) => {
      const next = { ...prev };
      attributeSchema.forEach((field) => {
        if (next[field.name]) return;
        const match = keys.find(
          (key) => key.toLowerCase() === field.name.toLowerCase()
            || key.toLowerCase() === field.label.toLowerCase(),
        );
        if (match) next[field.name] = match;
      });
      return next;
    });
  }, [attributeSchema, parsedFeatures.length]);

  const processFiles = async (files: File[]) => {
    if (!files.length || disabled) return;
    setParsing(true);
    setError('');
    try {
      const features = await parseSurveyFiles(files, geometryType);
      if (!features.length) {
        throw new Error(`No ${geometryType} features found in the selected file.`);
      }
      setParsedFeatures(features);
      setFileName(files.map((file) => file.name).join(', '));

      const autoMapping: Record<string, string> = {};
      const keys = listSourcePropertyKeys(features);
      attributeSchema.forEach((field) => {
        const match = keys.find(
          (key) => key.toLowerCase() === field.name.toLowerCase()
            || key.toLowerCase() === field.label.toLowerCase(),
        );
        if (match) autoMapping[field.name] = match;
      });
      setFieldMapping(autoMapping);
    } catch (err) {
      setParsedFeatures([]);
      setFileName('');
      const message = err instanceof Error ? err.message : 'Failed to read survey file.';
      setError(message);
      onError?.(message);
    } finally {
      setParsing(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList?.length) return;
    void processFiles(Array.from(fileList));
    event.target.value = '';
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (disabled) return;
    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length) void processFiles(files);
  };

  const geometryHint = geometryType === 'Polygon'
    ? 'Polygon boundaries appear at the exact site location on the map.'
    : geometryType === 'LineString'
      ? 'Line paths follow the same shape on the map.'
      : 'Points use exact longitude/latitude from the file.';

  const fileInput = active
    ? createPortal(
      <input
        id={inputId}
        type="file"
        multiple
        disabled={disabled || parsing}
        onChange={handleFileChange}
        style={{ position: 'fixed', top: -1000, left: -1000, width: 1, height: 1, opacity: 0 }}
      />,
      document.body,
    )
    : null;

  return (
    <>
      {fileInput}
      <Typography variant="body2" color="text.secondary" mb={1.5}>
        {featureClassName
          ? <>Upload survey data for <strong>{featureClassName}</strong> ({geometryType}). </>
          : <>Upload survey data for this <strong>{geometryType}</strong> layer. </>}
        {geometryHint} Formats: {SURVEY_IMPORT_FORMATS_HELP}. WGS 84 (EPSG:4326).
      </Typography>

      <Box
        component="label"
        htmlFor={inputId}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
        sx={{
          display: 'block',
          border: '2px dashed',
          borderColor: parsing ? 'primary.main' : 'divider',
          borderRadius: 1.5,
          p: compact ? 2 : 3,
          mb: 2,
          textAlign: 'center',
          cursor: disabled || parsing ? 'default' : 'pointer',
          bgcolor: parsing ? 'action.hover' : 'grey.50',
          opacity: disabled ? 0.6 : 1,
          '&:hover': disabled || parsing ? undefined : { bgcolor: 'action.hover', borderColor: 'primary.light' },
        }}
      >
        {parsing ? (
          <CircularProgress size={28} sx={{ mb: 1 }} />
        ) : (
          <UploadFileIcon color="primary" sx={{ fontSize: compact ? 32 : 40, mb: 1 }} />
        )}
        <Typography variant="subtitle2" gutterBottom>
          {parsing ? 'Reading file…' : 'Choose survey file'}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          or drag and drop · CSV, KML, KMZ, GeoJSON, SHP, ZIP
        </Typography>
      </Box>

      {fileName && (
        <Typography variant="caption" color="text.secondary" display="block" mb={1}>
          {fileName} · {parsedFeatures.length} feature{parsedFeatures.length === 1 ? '' : 's'} ready to import
        </Typography>
      )}

      {invalidFeatures.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {invalidFeatures.length} feature(s) have coordinates outside valid WGS 84 ranges.
        </Alert>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {parsedFeatures.length > 0 && attributeSchema.length > 0 && (
        <Box mb={2}>
          <Typography variant="subtitle2" gutterBottom>Map file fields to columns</Typography>
          {attributeSchema.map((field) => (
            <FormControl key={field.name} fullWidth size="small" sx={{ mb: 1 }}>
              <InputLabel>{field.label}</InputLabel>
              <Select
                label={field.label}
                value={fieldMapping[field.name] ?? ''}
                onChange={(e) => setFieldMapping((prev) => ({
                  ...prev,
                  [field.name]: e.target.value,
                }))}
              >
                <MenuItem value=""><em>Not mapped</em></MenuItem>
                {sourceKeys.map((key) => (
                  <MenuItem key={key} value={key}>{key}</MenuItem>
                ))}
              </Select>
            </FormControl>
          ))}
        </Box>
      )}

      {parsedFeatures.length > 0 && !compact && (
        <Box>
          <Typography variant="subtitle2" gutterBottom>Preview (first 5)</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Location</TableCell>
                <TableCell>Fields</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {parsedFeatures.slice(0, 5).map((feature, index) => {
                const info = summarizeGeometry(feature.geometry);
                return (
                  <TableRow key={`${feature.label}-${index}`}>
                    <TableCell>{feature.label}</TableCell>
                    <TableCell>
                      <Typography variant="caption" fontFamily="monospace">{info.summary}</Typography>
                    </TableCell>
                    <TableCell>{Object.keys(feature.properties).slice(0, 3).join(', ') || '—'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      )}
    </>
  );
}
