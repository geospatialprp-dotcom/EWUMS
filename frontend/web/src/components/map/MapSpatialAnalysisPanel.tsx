import {
  Box, Button, Divider, FormControl, IconButton, InputLabel, MenuItem,
  Select, TextField, Typography, CircularProgress, Tooltip,
} from '@mui/material';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CheckOutlinedIcon from '@mui/icons-material/CheckOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {
  SPATIAL_OPERATIONS,
  SPATIAL_SELECTION_METHODS,
  type SpatialOperation,
  type SpatialQueryMeta,
  type SpatialSelectionMethod,
} from '../../utils/spatialAnalysis';
import { mapDarkHeaderSx, mapSpatialAnalysisPanelSx, MAP_CHROME } from '../../utils/mapChromeStyles';
import { ARCMAP } from '../gis/arcMapUi';

type AnalysisLayer = {
  id: string;
  name: string;
  geometryType?: string;
};

interface MapSpatialAnalysisPanelProps {
  open: boolean;
  active?: boolean;
  layers: AnalysisLayer[];
  targetLayerId: string;
  operation: SpatialOperation;
  selectionMethod: SpatialSelectionMethod;
  bufferMeters: number;
  loading?: boolean;
  meta?: SpatialQueryMeta | null;
  hasQueryGeometry?: boolean;
  selectionCount?: number;
  onTargetLayerChange: (layerId: string) => void;
  onOperationChange: (operation: SpatialOperation) => void;
  onSelectionMethodChange: (method: SpatialSelectionMethod) => void;
  onBufferMetersChange: (meters: number) => void;
  onApply: () => void;
  onClear: () => void;
  onClose: () => void;
}

const fieldSx = {
  mb: 1.25,
  '& .MuiInputLabel-root': {
    fontSize: '0.75rem',
    color: ARCMAP.textMuted,
  },
  '& .MuiOutlinedInput-root': {
    fontSize: '0.8125rem',
    bgcolor: '#ffffff',
    '& fieldset': { borderColor: ARCMAP.toolbarBorder },
  },
  '& .MuiSelect-select': {
    py: 1,
  },
};

export default function MapSpatialAnalysisPanel({
  open,
  active = true,
  layers,
  targetLayerId,
  operation,
  selectionMethod,
  bufferMeters,
  loading,
  meta,
  hasQueryGeometry,
  selectionCount = 0,
  onTargetLayerChange,
  onOperationChange,
  onSelectionMethodChange,
  onBufferMetersChange,
  onApply,
  onClear,
  onClose,
}: MapSpatialAnalysisPanelProps) {
  if (!open) return null;

  const opConfig = SPATIAL_OPERATIONS.find((item) => item.value === operation);
  const sourceReady = Boolean(hasQueryGeometry);
  const drawHint = operation === 'buffer'
    ? `Click the map to place a source point (search radius ${bufferMeters} m).`
    : operation === 'contains'
      ? 'Click the map to place a source point.'
      : 'Draw a source polygon on the map — double-click to finish.';

  return (
    <Box sx={mapSpatialAnalysisPanelSx(active)} role="complementary" aria-label="Select By Location">
      <Box
        sx={{
          ...mapDarkHeaderSx(),
          ...(active ? { bgcolor: '#d4e8ff', borderBottomColor: MAP_CHROME.accent } : {}),
        }}
        display="flex"
        alignItems="center"
        gap={0.75}
      >
        <PlaceOutlinedIcon sx={{ color: MAP_CHROME.accent, fontSize: 18 }} />
        <Box flex={1} minWidth={0}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ color: MAP_CHROME.text, fontSize: '0.8125rem', lineHeight: 1.2 }}>
            Select By Location
          </Typography>
          <Typography variant="caption" sx={{ color: MAP_CHROME.textMuted, fontSize: '0.68rem', lineHeight: 1.2 }}>
            Edit query — spatial selection
          </Typography>
        </Box>
        <Tooltip title="Close">
          <IconButton size="small" onClick={onClose} aria-label="Close Select By Location" sx={{ p: 0.25 }}>
            <ChevronRightIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Box>

      <Box px={1.5} py={1.25} sx={{ overflow: 'auto', flex: 1, bgcolor: ARCMAP.toolbarBg }}>
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mb: 1,
            color: ARCMAP.textMuted,
            fontSize: '0.7rem',
            lineHeight: 1.35,
          }}
        >
          Select features using a spatial relationship to geometry you draw on the map.
        </Typography>

        <FormControl fullWidth size="small" sx={fieldSx}>
          <InputLabel id="sbl-selection-method-label">Selection method</InputLabel>
          <Select
            labelId="sbl-selection-method-label"
            label="Selection method"
            value={selectionMethod}
            onChange={(event) => onSelectionMethodChange(event.target.value as SpatialSelectionMethod)}
          >
            {SPATIAL_SELECTION_METHODS.map((item) => (
              <MenuItem key={item.value} value={item.value} sx={{ fontSize: '0.8125rem' }}>
                {item.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth size="small" sx={fieldSx}>
          <InputLabel id="sbl-target-layer-label">Select features from</InputLabel>
          <Select
            labelId="sbl-target-layer-label"
            label="Select features from"
            value={targetLayerId}
            onChange={(event) => onTargetLayerChange(event.target.value)}
          >
            {layers.length === 0 && (
              <MenuItem value="" disabled>No feature layers available</MenuItem>
            )}
            {layers.map((layer) => (
              <MenuItem key={layer.id} value={layer.id} sx={{ fontSize: '0.8125rem' }}>
                {layer.name}
                {layer.geometryType ? ` (${layer.geometryType})` : ''}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth size="small" sx={fieldSx}>
          <InputLabel id="sbl-relationship-label">that</InputLabel>
          <Select
            labelId="sbl-relationship-label"
            label="that"
            value={operation}
            onChange={(event) => onOperationChange(event.target.value as SpatialOperation)}
            renderValue={(value) => {
              const item = SPATIAL_OPERATIONS.find((op) => op.value === value);
              return item?.label ?? String(value);
            }}
          >
            {SPATIAL_OPERATIONS.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                <Box>
                  <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>{item.label}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                    {item.description}
                  </Typography>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {operation === 'buffer' && (
          <TextField
            fullWidth
            size="small"
            type="number"
            label="Distance (meters)"
            value={bufferMeters}
            onChange={(event) => onBufferMetersChange(Math.max(1, Number(event.target.value) || 1))}
            sx={fieldSx}
            inputProps={{ min: 1, step: 50 }}
          />
        )}

        <Box
          sx={{
            mb: 1.25,
            px: 1,
            py: 0.85,
            bgcolor: '#ffffff',
            border: `1px solid ${ARCMAP.toolbarBorder}`,
            boxShadow: 'inset 1px 1px 0 #ffffff',
          }}
        >
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              fontWeight: 700,
              color: ARCMAP.text,
              fontSize: '0.72rem',
              mb: 0.35,
            }}
          >
            Source layer
          </Typography>
          <Typography variant="caption" sx={{ display: 'block', color: ARCMAP.text, fontSize: '0.75rem' }}>
            Features drawn on the map
          </Typography>
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              mt: 0.5,
              color: sourceReady ? ARCMAP.accent : ARCMAP.textMuted,
              fontSize: '0.68rem',
              lineHeight: 1.35,
            }}
          >
            {sourceReady
              ? 'Source geometry is ready. Click Apply to run the selection.'
              : drawHint}
          </Typography>
        </Box>

        <Box display="flex" gap={0.75} mb={1}>
          <Button
            fullWidth
            variant="contained"
            size="small"
            disableElevation
            startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <CheckOutlinedIcon sx={{ fontSize: 16 }} />}
            disabled={loading || !targetLayerId || !sourceReady}
            onClick={onApply}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.75rem',
              bgcolor: ARCMAP.accent,
              '&:hover': { bgcolor: '#2559a8' },
              '&.Mui-disabled': { bgcolor: '#c8c8c8', color: '#6a6a6a' },
            }}
          >
            Apply
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<DeleteOutlineIcon sx={{ fontSize: 16 }} />}
            disabled={loading}
            onClick={onClear}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.75rem',
              color: ARCMAP.accent,
              borderColor: ARCMAP.selectionBorder,
              bgcolor: '#ffffff',
              whiteSpace: 'nowrap',
              px: 1.25,
            }}
          >
            Clear
          </Button>
        </Box>

        {(meta || selectionCount > 0) && (
          <>
            <Divider sx={{ my: 1, borderColor: ARCMAP.toolbarBorder }} />
            <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.78rem', color: ARCMAP.text }}>
              {(meta?.count ?? selectionCount).toLocaleString()} feature
              {(meta?.count ?? selectionCount) === 1 ? '' : 's'} selected
            </Typography>
            {meta && (
              <Typography variant="caption" sx={{ display: 'block', color: ARCMAP.textMuted, fontSize: '0.68rem', mt: 0.25 }}>
                {opConfig?.label} — {meta.layerName}
              </Typography>
            )}
            <Typography variant="caption" sx={{ display: 'block', color: ARCMAP.textMuted, fontSize: '0.68rem' }}>
              Results appear in the attribute table below.
            </Typography>
          </>
        )}
      </Box>
    </Box>
  );
}
