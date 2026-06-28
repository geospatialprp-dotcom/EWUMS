import {
  Box, Chip, LinearProgress, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Typography,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { LA_GIS_LAYER_CATEGORY_LABELS, layerReadinessSummary, type LaLayerReadinessRow } from '../../constants/laGisLayers';
import { dataTableSx } from '../../utils/pagePresentationStyles';

type Props = {
  layers: LaLayerReadinessRow[];
  projectId?: string | null;
};

export default function LaGisLayersPanel({ layers, projectId }: Props) {
  const summary = layerReadinessSummary(layers);
  const pct = summary.requiredTotal
    ? Math.round((summary.requiredConfigured / summary.requiredTotal) * 100)
    : 0;

  const grouped = layers.reduce<Record<string, LaLayerReadinessRow[]>>((acc, row) => {
    const key = row.category;
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});

  if (!projectId) {
    return (
      <Typography variant="body2" color="text.secondary" py={2}>
        Link a project to this LA case to configure GIS overlay layers in Feature Class Catalog.
      </Typography>
    );
  }

  return (
    <Box>
      <Box mb={2}>
        <Typography variant="body2" color="text.secondary" mb={1}>
          Automatic overlay analysis intersects the traced ROW corridor with these layers.
          Create matching feature classes in Feature Class Catalog using the suggested codes (e.g. <strong>forest_land</strong>, <strong>national_highway</strong>).
        </Typography>
        <Box display="flex" alignItems="center" gap={2} flexWrap="wrap" mb={1}>
          <Chip
            size="small"
            color={summary.requiredConfigured === summary.requiredTotal ? 'success' : 'warning'}
            icon={summary.requiredConfigured === summary.requiredTotal
              ? <CheckCircleOutlineIcon />
              : <WarningAmberOutlinedIcon />}
            label={`${summary.requiredConfigured} / ${summary.requiredTotal} required layers configured`}
          />
          <Typography variant="caption" color="text.secondary">
            {summary.configured} of {summary.total} total layers available
          </Typography>
        </Box>
        <LinearProgress variant="determinate" value={pct} sx={{ height: 6, borderRadius: 1 }} />
      </Box>

      {Object.entries(grouped).map(([category, rows]) => (
        <Box key={category} mb={3}>
          <Typography variant="subtitle2" fontWeight={700} color="primary.main" mb={1}>
            {LA_GIS_LAYER_CATEGORY_LABELS[category] ?? category}
          </Typography>
          <TableContainer>
            <Table size="small" sx={dataTableSx}>
              <TableHead>
                <TableRow>
                  <TableCell>Layer</TableCell>
                  <TableCell>Geometry</TableCell>
                  <TableCell>Suggested Code</TableCell>
                  <TableCell>Clearance</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.code}>
                    <TableCell>{row.label}</TableCell>
                    <TableCell>{row.geometryTypes.join(', ')}</TableCell>
                    <TableCell>
                      <Typography variant="caption" fontFamily="monospace">{row.suggestedCode}</Typography>
                    </TableCell>
                    <TableCell>{row.clearanceType ?? (row.analysisMode === 'informational' ? 'Info' : '—')}</TableCell>
                    <TableCell>
                      {row.configured ? (
                        <Chip size="small" color="success" variant="outlined"
                          label={row.featureClassCode ?? 'Configured'} />
                      ) : (
                        <Chip size="small" color={row.requiredForOverlay ? 'warning' : 'default'} variant="outlined"
                          label={row.requiredForOverlay ? 'Required' : 'Optional'} />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      ))}
    </Box>
  );
}
