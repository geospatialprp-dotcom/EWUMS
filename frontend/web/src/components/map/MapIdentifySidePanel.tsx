import {
  Box, CircularProgress, Table, TableBody, TableCell, TableHead, TableRow,
  Typography,
} from '@mui/material';
import type { AttributeField, FeatureClassRecord, ProjectFeatureRecord } from '../../services/api';
import { ARCMAP } from '../gis/arcMapUi';

interface MapIdentifySidePanelProps {
  loading?: boolean;
  layerName?: string;
  featureClass?: FeatureClassRecord | null;
  feature?: ProjectFeatureRecord | null;
}

const fieldHeaderSx = {
  fontWeight: 700,
  fontSize: '0.625rem',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  color: ARCMAP.textMuted,
  bgcolor: '#f3f5f8',
  borderBottom: `1px solid ${ARCMAP.toolbarBorder}`,
  py: 0.45,
  px: 1,
  whiteSpace: 'nowrap' as const,
  lineHeight: 1.2,
};

const cellSx = {
  fontSize: '0.72rem',
  borderColor: 'divider',
  py: 0.55,
  px: 1,
  verticalAlign: 'top' as const,
  wordBreak: 'break-word' as const,
  lineHeight: 1.35,
};

function formatValue(field: AttributeField, value: unknown) {
  if (value == null || value === '') return '—';
  if (field.type === 'boolean') return value === true ? 'Yes' : 'No';
  if (field.type === 'image') return '—';
  return String(value);
}

/** Narrow Identify rail: layer name + Field | Value after map selection. */
export default function MapIdentifySidePanel({
  loading,
  layerName,
  featureClass,
  feature,
}: MapIdentifySidePanelProps) {
  const title = layerName ?? featureClass?.name ?? 'Identify';

  return (
    <Box display="flex" flexDirection="column" height="100%" minHeight={0} bgcolor="#fff">
      <Box
        sx={{
          px: 1,
          py: 0.75,
          borderBottom: `1px solid ${ARCMAP.toolbarBorder}`,
          bgcolor: '#f7f8fa',
        }}
      >
        <Typography
          noWrap
          title={title}
          sx={{
            fontWeight: 700,
            fontSize: '0.78rem',
            lineHeight: 1.25,
            color: ARCMAP.text,
            letterSpacing: '0.01em',
          }}
        >
          {title}
        </Typography>
      </Box>

      <Box flex={1} minHeight={0} overflow="auto">
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={96}>
            <CircularProgress size={22} thickness={4} />
          </Box>
        ) : !feature ? (
          <Box px={1.25} py={1.5}>
            <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', lineHeight: 1.4 }}>
              Click a feature on the map to view attributes.
            </Typography>
          </Box>
        ) : !featureClass || featureClass.attributeSchema.length === 0 ? (
          <Box px={1.25} py={1.5}>
            <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
              No attribute fields on this layer.
            </Typography>
          </Box>
        ) : (
          <Table size="small" stickyHeader sx={{ tableLayout: 'fixed', width: '100%' }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ ...fieldHeaderSx, width: '44%' }}>Field</TableCell>
                <TableCell sx={{ ...fieldHeaderSx, width: '56%' }}>Value</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {featureClass.attributeSchema
                .filter((field) => field.type !== 'image')
                .map((field) => (
                  <TableRow
                    key={field.name}
                    hover
                    sx={{ '&:last-child td': { borderBottom: 0 } }}
                  >
                    <TableCell sx={{ ...cellSx, fontWeight: 600, color: ARCMAP.text }}>
                      {field.label}
                    </TableCell>
                    <TableCell sx={{ ...cellSx, color: 'text.primary' }}>
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
