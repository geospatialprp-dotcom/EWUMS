import {
  Box, Button, Divider, FormControl, IconButton, InputLabel, MenuItem, Paper,
  Select, TextField, Typography, CircularProgress,
} from '@mui/material';
import AnalyticsOutlinedIcon from '@mui/icons-material/AnalyticsOutlined';
import CloseIcon from '@mui/icons-material/Close';
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { SPATIAL_OPERATIONS, type SpatialOperation, type SpatialQueryMeta } from '../../utils/spatialAnalysis';
import { mapAnalysisPanelSx, mapDarkHeaderSx, MAP_CHROME } from '../../utils/mapChromeStyles';

type AnalysisLayer = {
  id: string;
  name: string;
  geometryType?: string;
};

interface MapSpatialAnalysisPanelProps {
  open: boolean;
  layers: AnalysisLayer[];
  targetLayerId: string;
  operation: SpatialOperation;
  bufferMeters: number;
  loading?: boolean;
  meta?: SpatialQueryMeta | null;
  hasQueryGeometry?: boolean;
  onTargetLayerChange: (layerId: string) => void;
  onOperationChange: (operation: SpatialOperation) => void;
  onBufferMetersChange: (meters: number) => void;
  onRun: () => void;
  onClear: () => void;
  onClose: () => void;
}

export default function MapSpatialAnalysisPanel({
  open,
  layers,
  targetLayerId,
  operation,
  bufferMeters,
  loading,
  meta,
  hasQueryGeometry,
  onTargetLayerChange,
  onOperationChange,
  onBufferMetersChange,
  onRun,
  onClear,
  onClose,
}: MapSpatialAnalysisPanelProps) {
  if (!open) return null;

  const opConfig = SPATIAL_OPERATIONS.find((item) => item.value === operation);
  const drawHint = operation === 'buffer'
    ? `Draw a point on the map — finds features within ${bufferMeters} m`
    : operation === 'contains'
      ? 'Draw a point on the map — finds features that contain it'
      : 'Draw a polygon on the map — double-click to finish';

  return (
    <Paper elevation={0} sx={mapAnalysisPanelSx()}>
      <Box sx={mapDarkHeaderSx()} display="flex" alignItems="center" gap={1}>
        <AnalyticsOutlinedIcon sx={{ color: MAP_CHROME.accent, fontSize: 18 }} />
        <Box flex={1}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ color: MAP_CHROME.text, fontSize: '0.8125rem' }}>
            Spatial Analysis
          </Typography>
          <Typography variant="caption" sx={{ color: MAP_CHROME.textMuted, fontSize: '0.7rem' }}>
            Query features by location
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} aria-label="Close">
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>
      <Box px={2} py={1.5} sx={{ overflow: 'auto', flex: 1 }}>
        <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
          <InputLabel>Operation</InputLabel>
          <Select
            label="Operation"
            value={operation}
            onChange={(event) => onOperationChange(event.target.value as SpatialOperation)}
          >
            {SPATIAL_OPERATIONS.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                <Box>
                  <Typography variant="body2">{item.label}</Typography>
                  <Typography variant="caption" color="text.secondary">{item.description}</Typography>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
          <InputLabel>Target layer</InputLabel>
          <Select
            label="Target layer"
            value={targetLayerId}
            onChange={(event) => onTargetLayerChange(event.target.value)}
          >
            {layers.length === 0 && (
              <MenuItem value="" disabled>No feature layers available</MenuItem>
            )}
            {layers.map((layer) => (
              <MenuItem key={layer.id} value={layer.id}>
                {layer.name}
                {layer.geometryType ? ` (${layer.geometryType})` : ''}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {operation === 'buffer' && (
          <TextField
            fullWidth
            size="small"
            type="number"
            label="Buffer distance (meters)"
            value={bufferMeters}
            onChange={(event) => onBufferMetersChange(Math.max(1, Number(event.target.value) || 1))}
            sx={{ mb: 1.5 }}
            inputProps={{ min: 1, step: 50 }}
          />
        )}

        <Typography variant="caption" color="text.secondary" display="block" mb={1}>
          {drawHint}
        </Typography>

        <Box display="flex" gap={1} mb={1.5}>
          <Button
            fullWidth
            variant="contained"
            size="small"
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <PlayArrowOutlinedIcon />}
            disabled={loading || !targetLayerId || !hasQueryGeometry}
            onClick={onRun}
          >
            Run analysis
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<DeleteOutlineIcon />}
            disabled={loading}
            onClick={onClear}
          >
            Clear
          </Button>
        </Box>

        {meta && (
          <>
            <Divider sx={{ my: 1 }} />
            <Typography variant="body2" fontWeight={600} gutterBottom>
              {meta.count} feature{meta.count === 1 ? '' : 's'} found
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              {opConfig?.label} on {meta.layerName} — see attribute table below
            </Typography>
          </>
        )}
      </Box>
    </Paper>
  );
}
