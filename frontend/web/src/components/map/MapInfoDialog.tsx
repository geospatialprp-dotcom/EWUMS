import {
  Box, CircularProgress, Dialog, DialogContent, DialogTitle, IconButton, Table, TableBody,
  TableCell, TableHead, TableRow, Typography, Chip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import type { AttributeField, FeatureClassRecord, ProjectFeatureRecord } from '../../services/api';
import FeatureImageInput from '../shared/FeatureImageInput';
import {
  getFeatureImageUrl,
  resolveFeatureImageField,
  resolveFeatureImageFieldName,
} from '../../utils/featureImage';

interface MapInfoDialogProps {
  open: boolean;
  loading?: boolean;
  savingImage?: boolean;
  layerName?: string;
  featureClass?: FeatureClassRecord | null;
  feature?: ProjectFeatureRecord | null;
  mapSnapshot?: string | null;
  onClose: () => void;
  onImageChange?: (imageValue: string) => void;
  onImageClear?: () => void;
}

const headerCellSx = {
  fontWeight: 600,
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'text.secondary',
  bgcolor: '#f1f5f9',
  borderBottom: 1,
  borderColor: 'divider',
  py: 1,
  whiteSpace: 'nowrap',
};

function formatValue(field: AttributeField, value: unknown) {
  if (value == null || value === '') return '—';
  if (field.type === 'boolean') return value === true ? 'Yes' : 'No';
  if (field.type === 'image') return 'See preview';
  return String(value);
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
  return featureClass?.name ?? feature.properties.featureClassName ?? 'Feature';
}

export default function MapInfoDialog({
  open,
  loading,
  savingImage,
  layerName,
  featureClass,
  feature,
  mapSnapshot,
  onClose,
  onImageChange,
  onImageClear,
}: MapInfoDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 2, maxHeight: '85vh' } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1.5, pr: 1 }}>
        <InfoOutlinedIcon color="primary" fontSize="small" />
        <Box flex={1} minWidth={0}>
          <Typography variant="subtitle1" fontWeight={700} noWrap>
            {feature ? featureTitle(feature, featureClass) : (layerName ?? 'Feature info')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {loading ? 'Loading attributes…' : 'Identified feature on map'}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} aria-label="Close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: loading || !feature ? 4 : 0 }}>
        {loading || !feature ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={160}>
            <CircularProgress size={32} />
          </Box>
        ) : (
          <FeatureInfoContent
            layerName={layerName}
            featureClass={featureClass}
            feature={feature}
            mapSnapshot={mapSnapshot}
            savingImage={savingImage}
            onImageChange={onImageChange}
            onImageClear={onImageClear}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function FeatureInfoContent({
  layerName,
  featureClass,
  feature,
  mapSnapshot,
  savingImage,
  onImageChange,
  onImageClear,
}: {
  layerName?: string;
  featureClass?: FeatureClassRecord | null;
  feature: ProjectFeatureRecord;
  mapSnapshot?: string | null;
  savingImage?: boolean;
  onImageChange?: (imageValue: string) => void;
  onImageClear?: () => void;
}) {
  const imageField = resolveFeatureImageField(featureClass?.attributeSchema);
  const imageFieldName = resolveFeatureImageFieldName(featureClass?.attributeSchema);
  const featureImage = getFeatureImageUrl(feature.properties.attributes, featureClass?.attributeSchema);
  const displayImage = featureImage ?? mapSnapshot ?? null;

  return (
    <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }} minHeight={280}>
      <Box
        sx={{
          width: { xs: '100%', sm: 240 },
          flexShrink: 0,
          borderRight: { sm: 1 },
          borderBottom: { xs: 1, sm: 0 },
          borderColor: 'divider',
          bgcolor: '#f8fafc',
          p: 2,
        }}
      >
        <Typography variant="overline" color="text.secondary" display="block" mb={1}>
          Feature image
        </Typography>

        {savingImage ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={180}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <FeatureImageInput
            value={displayImage}
            saving={savingImage}
            onChange={(value) => onImageChange?.(value)}
            onClear={featureImage ? onImageClear : undefined}
          />
        )}

        {!imageField && (
          <Typography variant="caption" color="text.secondary" display="block" mt={1}>
            Tip: add an Image column in Feature Classes → Edit Fields for all features in this layer.
          </Typography>
        )}

        <Box mt={1.5} display="flex" gap={0.5} flexWrap="wrap">
          <Chip
            label={layerName ?? featureClass?.name ?? feature.properties.featureClassName}
            size="small"
            variant="outlined"
          />
          {imageField && (
            <Chip label={imageField.label} size="small" color="primary" variant="outlined" />
          )}
        </Box>
      </Box>

      <Box flex={1} sx={{ overflow: 'auto' }}>
        {!featureClass || featureClass.attributeSchema.length === 0 ? (
          <Box p={3}>
            <Typography color="text.secondary">
              No attribute fields defined for this layer.
            </Typography>
          </Box>
        ) : (
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={headerCellSx}>Field</TableCell>
                <TableCell sx={headerCellSx}>Value</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {featureClass.attributeSchema
                .filter((field) => field.type !== 'image')
                .map((field) => (
                  <TableRow key={field.name}>
                    <TableCell sx={{ fontWeight: 600, width: '42%', borderColor: 'divider' }}>
                      {field.label}
                    </TableCell>
                    <TableCell sx={{ borderColor: 'divider' }}>
                      {formatValue(field, feature.properties.attributes[field.name])}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        )}
      </Box>
    </Box>
  );
}
