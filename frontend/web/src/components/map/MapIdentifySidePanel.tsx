import {
  Box, CircularProgress, IconButton, Table, TableBody, TableCell, TableHead, TableRow,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import type { AttributeField, FeatureClassRecord, ProjectFeatureRecord } from '../../services/api';
import { arcMapPanelHeaderSx, ARCMAP } from '../gis/arcMapUi';

interface MapIdentifySidePanelProps {
  loading?: boolean;
  layerName?: string;
  featureClass?: FeatureClassRecord | null;
  feature?: ProjectFeatureRecord | null;
  onClose?: () => void;
}

const fieldHeaderSx = {
  fontWeight: 700,
  fontSize: '0.65rem',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.04em',
  color: ARCMAP.textMuted,
  bgcolor: ARCMAP.panelHeaderBg,
  borderBottom: `1px solid ${ARCMAP.toolbarBorder}`,
  py: 0.4,
  px: 0.75,
  whiteSpace: 'nowrap' as const,
};

function formatValue(field: AttributeField, value: unknown) {
  if (value == null || value === '') return '—';
  if (field.type === 'boolean') return value === true ? 'Yes' : 'No';
  if (field.type === 'image') return '—';
  return String(value);
}

/** Narrow right-rail Identify panel: layer name + Field | Value rows after selection. */
export default function MapIdentifySidePanel({
  loading,
  layerName,
  featureClass,
  feature,
  onClose,
}: MapIdentifySidePanelProps) {
  const title = layerName ?? featureClass?.name ?? 'Identify';

  return (
    <Box display="flex" flexDirection="column" height="100%" minHeight={0} bgcolor="#fff">
      <Box sx={{ ...arcMapPanelHeaderSx(), px: 0.75, py: 0.4, minHeight: 28, gap: 0.5 }}>
        <InfoOutlinedIcon sx={{ fontSize: 15, color: ARCMAP.accent, flexShrink: 0 }} />
        <Typography
          variant="body2"
          fontWeight={700}
          noWrap
          sx={{ flex: 1, minWidth: 0, fontSize: '0.75rem', lineHeight: 1.2 }}
        >
          {title}
        </Typography>
        {onClose && (
          <IconButton size="small" onClick={onClose} aria-label="Close identify panel" sx={{ p: 0.2 }}>
            <CloseIcon sx={{ fontSize: 15 }} />
          </IconButton>
        )}
      </Box>

      <Box flex={1} minHeight={0} overflow="auto">
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={120}>
            <CircularProgress size={24} />
          </Box>
        ) : !feature ? (
          <Box p={1.5}>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
              Click a feature on the map to view attributes.
            </Typography>
          </Box>
        ) : !featureClass || featureClass.attributeSchema.length === 0 ? (
          <Box p={1.5}>
            <Typography color="text.secondary" variant="body2" sx={{ fontSize: '0.75rem' }}>
              No attribute fields defined for this layer.
            </Typography>
          </Box>
        ) : (
          <Table size="small" stickyHeader sx={{ tableLayout: 'fixed', width: '100%' }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ ...fieldHeaderSx, width: '42%' }}>Field</TableCell>
                <TableCell sx={{ ...fieldHeaderSx, width: '58%' }}>Value</TableCell>
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
                        fontSize: '0.7rem',
                        borderColor: 'divider',
                        py: 0.5,
                        px: 0.75,
                        verticalAlign: 'top',
                        wordBreak: 'break-word',
                      }}
                    >
                      {field.label}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontSize: '0.7rem',
                        borderColor: 'divider',
                        py: 0.5,
                        px: 0.75,
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
      </Box>
    </Box>
  );
}
