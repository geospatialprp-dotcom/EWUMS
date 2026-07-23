import {
  Box, Chip, CircularProgress, IconButton, Stack, Table, TableBody, TableCell, TableHead, TableRow,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CropFreeOutlinedIcon from '@mui/icons-material/CropFreeOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import TimelineOutlinedIcon from '@mui/icons-material/TimelineOutlined';
import type { AttributeField, FeatureClassRecord, ProjectFeatureRecord } from '../../services/api';
import FeatureImageInput from '../shared/FeatureImageInput';
import {
  getFeatureImageUrl,
  resolveFeatureImageField,
} from '../../utils/featureImage';
import { arcMapPanelHeaderSx, ARCMAP } from '../gis/arcMapUi';

export type IdentifyLayerOption = {
  id: string;
  name: string;
  geometryType?: string;
};

interface MapIdentifySidePanelProps {
  loading?: boolean;
  savingImage?: boolean;
  layerName?: string;
  featureClass?: FeatureClassRecord | null;
  feature?: ProjectFeatureRecord | null;
  mapSnapshot?: string | null;
  layers: IdentifyLayerOption[];
  activeLayerId?: string;
  onSelectLayer?: (layerId: string) => void;
  onClose?: () => void;
  onImageChange?: (imageValue: string) => void;
  onImageClear?: () => void;
}

const fieldHeaderSx = {
  fontWeight: 700,
  fontSize: '0.6875rem',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.04em',
  color: ARCMAP.textMuted,
  bgcolor: ARCMAP.panelHeaderBg,
  borderBottom: `1px solid ${ARCMAP.toolbarBorder}`,
  py: 0.5,
  px: 1,
  whiteSpace: 'nowrap' as const,
};

function formatValue(field: AttributeField, value: unknown) {
  if (value == null || value === '') return '—';
  if (field.type === 'boolean') return value === true ? 'Yes' : 'No';
  if (field.type === 'image') return 'See preview';
  return String(value);
}

function geometryIcon(type?: string) {
  if (type === 'LineString') return <TimelineOutlinedIcon sx={{ fontSize: 14 }} />;
  if (type === 'Polygon') return <CropFreeOutlinedIcon sx={{ fontSize: 14 }} />;
  return <PlaceOutlinedIcon sx={{ fontSize: 14 }} />;
}

function featureTitle(
  feature: ProjectFeatureRecord,
  featureClass?: FeatureClassRecord | null,
) {
  const titleField = featureClass?.attributeSchema.find((field) => field.type !== 'image');
  if (titleField) {
    const value = feature.properties.attributes[titleField.name];
    if (value != null && String(value).trim()) return String(value);
  }
  return featureClass?.name ?? feature.properties.featureClassName ?? feature.properties.name ?? 'Selected feature';
}

/** Right-rail Identify panel: Field | Value rows (narrow width for point/line/polygon). */
export default function MapIdentifySidePanel({
  loading,
  savingImage,
  layerName,
  featureClass,
  feature,
  mapSnapshot,
  layers,
  activeLayerId,
  onSelectLayer,
  onClose,
  onImageChange,
  onImageClear,
}: MapIdentifySidePanelProps) {
  const imageField = resolveFeatureImageField(featureClass?.attributeSchema);
  const featureImage = feature
    ? getFeatureImageUrl(feature.properties.attributes, featureClass?.attributeSchema)
    : null;
  const displayImage = featureImage ?? mapSnapshot ?? null;

  return (
    <Box display="flex" flexDirection="column" height="100%" minHeight={0} bgcolor="#fff">
      <Box sx={{ ...arcMapPanelHeaderSx(), px: 1, py: 0.5, minHeight: 32, gap: 0.5 }}>
        <InfoOutlinedIcon sx={{ fontSize: 16, color: ARCMAP.accent, flexShrink: 0 }} />
        <Box flex={1} minWidth={0}>
          <Typography variant="body2" fontWeight={700} noWrap sx={{ fontSize: '0.75rem', lineHeight: 1.2 }}>
            {feature ? featureTitle(feature, featureClass) : 'Identify'}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: '0.625rem' }}>
            {loading
              ? 'Loading…'
              : feature
                ? (layerName ?? featureClass?.name ?? 'Feature')
                : 'Click a point, line, or polygon on the map'}
          </Typography>
        </Box>
        {onClose && (
          <IconButton size="small" onClick={onClose} aria-label="Close identify panel" sx={{ p: 0.25 }}>
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        )}
      </Box>

      {layers.length > 0 && (
        <Stack
          direction="row"
          flexWrap="wrap"
          gap={0.5}
          sx={{ px: 1, py: 0.75, borderBottom: `1px solid ${ARCMAP.toolbarBorder}`, bgcolor: ARCMAP.tocBg }}
        >
          {layers.map((layer) => (
            <Chip
              key={layer.id}
              size="small"
              icon={geometryIcon(layer.geometryType)}
              label={layer.name}
              color={layer.id === activeLayerId ? 'primary' : 'default'}
              variant={layer.id === activeLayerId ? 'filled' : 'outlined'}
              onClick={() => onSelectLayer?.(layer.id)}
              sx={{
                height: 24,
                maxWidth: '100%',
                fontSize: '0.65rem',
                fontWeight: layer.id === activeLayerId ? 700 : 500,
                '& .MuiChip-label': { px: 0.75, overflow: 'hidden', textOverflow: 'ellipsis' },
                '& .MuiChip-icon': { ml: 0.5, mr: -0.25 },
              }}
            />
          ))}
        </Stack>
      )}

      <Box flex={1} minHeight={0} overflow="auto">
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={160}>
            <CircularProgress size={28} />
          </Box>
        ) : !feature ? (
          <Box p={2}>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem', mb: 1.5 }}>
              Select a layer chip if needed, then click any visible point, line, or polygon on the map.
              Attributes open here as Field / Value rows.
            </Typography>
          </Box>
        ) : (
          <>
            <Box sx={{ px: 1.25, pt: 1.25, pb: 1, borderBottom: `1px solid ${ARCMAP.toolbarBorder}` }}>
              <Typography variant="overline" color="text.secondary" display="block" sx={{ fontSize: '0.6rem', mb: 0.75 }}>
                Feature image
              </Typography>
              {savingImage ? (
                <Box display="flex" justifyContent="center" py={2}>
                  <CircularProgress size={22} />
                </Box>
              ) : (
                <FeatureImageInput
                  compact
                  value={displayImage}
                  saving={savingImage}
                  onChange={(value) => onImageChange?.(value)}
                  onClear={featureImage ? onImageClear : undefined}
                />
              )}
              {!imageField && (
                <Typography variant="caption" color="text.secondary" display="block" mt={0.75} sx={{ fontSize: '0.65rem' }}>
                  Tip: add an Image field on this layer to store photos on every feature.
                </Typography>
              )}
              {imageField && (
                <Chip label={imageField.label} size="small" color="primary" variant="outlined" sx={{ mt: 0.75, height: 22, fontSize: '0.65rem' }} />
              )}
            </Box>

            {!featureClass || featureClass.attributeSchema.length === 0 ? (
              <Box p={2}>
                <Typography color="text.secondary" variant="body2">
                  No attribute fields defined for this layer.
                </Typography>
              </Box>
            ) : (
              <Table size="small" stickyHeader sx={{ tableLayout: 'fixed', width: '100%' }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ ...fieldHeaderSx, width: '40%' }}>Field</TableCell>
                    <TableCell sx={{ ...fieldHeaderSx, width: '60%' }}>Value</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {featureClass.attributeSchema
                    .filter((field) => field.type !== 'image')
                    .map((field) => (
                      <TableRow key={field.name} hover>
                        <TableCell
                          sx={{
                            fontWeight: 600,
                            fontSize: '0.75rem',
                            borderColor: 'divider',
                            py: 0.65,
                            px: 1,
                            verticalAlign: 'top',
                            wordBreak: 'break-word',
                          }}
                        >
                          {field.label}
                        </TableCell>
                        <TableCell
                          sx={{
                            fontSize: '0.75rem',
                            borderColor: 'divider',
                            py: 0.65,
                            px: 1,
                            verticalAlign: 'top',
                            wordBreak: 'break-word',
                          }}
                        >
                          {formatValue(field, feature.properties.attributes[field.name])}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}
          </>
        )}
      </Box>
    </Box>
  );
}
