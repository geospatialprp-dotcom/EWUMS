import { type ReactNode } from 'react';
import {
  Box, Divider, IconButton, ToggleButton, ToggleButtonGroup, Tooltip, Typography,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import StraightenIcon from '@mui/icons-material/Straighten';
import SquareFootOutlinedIcon from '@mui/icons-material/SquareFootOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import TimelineOutlinedIcon from '@mui/icons-material/TimelineOutlined';
import PentagonOutlinedIcon from '@mui/icons-material/PentagonOutlined';
import EditLocationAltOutlinedIcon from '@mui/icons-material/EditLocationAltOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import AnalyticsOutlinedIcon from '@mui/icons-material/AnalyticsOutlined';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import MapExportMenu, { type MapExportAction } from './MapExportMenu';
import {
  MAP_ARC_TOOL_ICON_SIZE,
  MAP_CHROME,
  mapArcDesktopDividerSx,
  mapArcDesktopMeasureReadoutSx,
  mapArcDesktopToolButtonSx,
  mapArcDesktopToolGroupSx,
  mapArcDesktopToolbarSx,
  mapRoundIconButtonSx,
  mapToolbarDividerSx,
  mapToolbarIconSx,
  mapToolbarShapeToggleSx,
  mapToolbarGroupSx,
  mapToolbarSx,
  mapToolbarTitleBarIconButtonSx,
  mapToolbarToggleGroupSx,
} from '../../utils/mapChromeStyles';

type ToolbarPlacement = 'titleBar' | 'workspace' | 'arcDesktop';

type DigitizeShape = 'Point' | 'LineString' | 'Polygon';

interface MapFloatingToolbarProps {
  activeTool: string;
  onToolChange: (tool: string) => void;
  measureResult?: string;
  measureLabel?: string;
  digitizeGeometryType?: 'Point' | 'LineString' | 'Polygon';
  canDigitize?: boolean;
  canDrawPolygon?: boolean;
  canEdit?: boolean;
  canAnalyze?: boolean;
  mixedDigitize?: boolean;
  showDigitizeTool?: boolean;
  digitizeShape?: DigitizeShape;
  onDigitizeShapeChange?: (shape: DigitizeShape) => void;
  onExport?: (action: MapExportAction) => void;
  exportDisabled?: boolean;
  explorerOpen?: boolean;
  onShowExplorer?: () => void;
  selectedFeatureId?: string | null;
  canDeleteFeature?: boolean;
  deletingFeatureId?: string | null;
  onDeleteFeature?: (featureId: string) => void;
  placement?: ToolbarPlacement;
}

function ToolButton({
  value,
  title,
  disabled,
  ariaLabel,
  children,
}: {
  value: string;
  title: string;
  disabled?: boolean;
  ariaLabel: string;
  children: ReactNode;
}) {
  return (
    <ToggleButton value={value} disabled={disabled} aria-label={ariaLabel}>
      <Tooltip title={title} placement="bottom">
        <Box component="span" display="flex" alignItems="center" justifyContent="center">
          {children}
        </Box>
      </Tooltip>
    </ToggleButton>
  );
}

function ArcDesktopToolButton({
  tool,
  activeTool,
  title,
  disabled,
  ariaLabel,
  onToolChange,
  children,
}: {
  tool: string;
  activeTool: string;
  title: string;
  disabled?: boolean;
  ariaLabel: string;
  onToolChange: (tool: string) => void;
  children: ReactNode;
}) {
  const selected = activeTool === tool;
  return (
    <Tooltip title={title} placement="bottom">
      <span>
        <IconButton
          size="small"
          disabled={disabled}
          aria-label={ariaLabel}
          aria-pressed={selected}
          onClick={() => onToolChange(tool)}
          sx={mapArcDesktopToolButtonSx(selected, disabled)}
        >
          {children}
        </IconButton>
      </span>
    </Tooltip>
  );
}

function ArcDesktopDivider() {
  return <Divider orientation="vertical" flexItem sx={mapArcDesktopDividerSx()} />;
}

export default function MapFloatingToolbar({
  activeTool,
  onToolChange,
  measureResult,
  measureLabel = 'Distance',
  digitizeGeometryType,
  canDigitize,
  canDrawPolygon,
  canEdit,
  canAnalyze,
  mixedDigitize,
  showDigitizeTool = true,
  digitizeShape = 'Point',
  onDigitizeShapeChange,
  onExport,
  exportDisabled,
  explorerOpen = true,
  onShowExplorer,
  selectedFeatureId,
  canDeleteFeature,
  deletingFeatureId,
  onDeleteFeature,
  placement = 'arcDesktop',
}: MapFloatingToolbarProps) {
  const digitizeLabel = digitizeGeometryType === 'Point'
    ? 'Add Point'
    : digitizeGeometryType === 'LineString'
      ? 'Draw Line'
      : digitizeGeometryType === 'Polygon'
        ? 'Draw Polygon'
        : 'Digitize';

  const DigitizeIcon = EditLocationAltOutlinedIcon;
  const showMeasureReadout = Boolean(
    measureResult && (activeTool === 'measure' || activeTool === 'measureArea'),
  );

  const isArcDesktop = placement === 'arcDesktop';
  const isTitleBar = placement === 'titleBar';
  const arcIconSx = { fontSize: MAP_ARC_TOOL_ICON_SIZE, display: 'block' };

  if (isArcDesktop) {
    return (
      <Box sx={mapArcDesktopToolbarSx()}>
        {!explorerOpen && onShowExplorer && (
          <>
            <Box sx={mapArcDesktopToolGroupSx()}>
              <Tooltip title="Show Map Explorer" placement="bottom">
                <IconButton
                  size="small"
                  onClick={onShowExplorer}
                  aria-label="Show Map Explorer"
                  sx={mapArcDesktopToolButtonSx(false)}
                >
                  <MapOutlinedIcon sx={arcIconSx} />
                </IconButton>
              </Tooltip>
            </Box>
            <ArcDesktopDivider />
          </>
        )}

        <Box sx={mapArcDesktopToolGroupSx()}>
          <ArcDesktopToolButton tool="info" activeTool={activeTool} title="Identify features" ariaLabel="Identify" onToolChange={onToolChange}>
            <InfoOutlinedIcon sx={arcIconSx} />
          </ArcDesktopToolButton>
          <ArcDesktopToolButton tool="measure" activeTool={activeTool} title="Measure distance" ariaLabel="Measure distance" onToolChange={onToolChange}>
            <StraightenIcon sx={arcIconSx} />
          </ArcDesktopToolButton>
          <ArcDesktopToolButton tool="measureArea" activeTool={activeTool} title="Measure area — draw polygon, double-click to finish" ariaLabel="Measure area" onToolChange={onToolChange}>
            <SquareFootOutlinedIcon sx={arcIconSx} />
          </ArcDesktopToolButton>
        </Box>

        <ArcDesktopDivider />

        <Box sx={mapArcDesktopToolGroupSx()}>
          <ArcDesktopToolButton
            tool="analyze"
            activeTool={activeTool}
            title={canAnalyze ? 'Spatial query analysis' : 'Enable a feature layer to analyze'}
            disabled={!canAnalyze}
            ariaLabel="Spatial analysis"
            onToolChange={onToolChange}
          >
            <AnalyticsOutlinedIcon sx={arcIconSx} />
          </ArcDesktopToolButton>
        </Box>

        <ArcDesktopDivider />

        <Box sx={mapArcDesktopToolGroupSx()}>
          <ArcDesktopToolButton
            tool="edit"
            activeTool={activeTool}
            title={canEdit ? 'Edit shapes — select and drag vertices' : 'Turn on a feature layer to edit'}
            disabled={!canEdit}
            ariaLabel="Edit shapes"
            onToolChange={onToolChange}
          >
            <EditOutlinedIcon sx={arcIconSx} />
          </ArcDesktopToolButton>
          {showDigitizeTool && (
            <ArcDesktopToolButton
              tool="digitize"
              activeTool={activeTool}
              title={canDigitize ? digitizeLabel : 'Enable a feature layer to digitize'}
              disabled={!canDigitize}
              ariaLabel="Digitize"
              onToolChange={onToolChange}
            >
              <DigitizeIcon sx={arcIconSx} />
            </ArcDesktopToolButton>
          )}
          <ArcDesktopToolButton
            tool="polygon"
            activeTool={activeTool}
            title={canDrawPolygon ? 'Draw polygon — double-click to finish' : 'Enable a mixed geometry layer'}
            disabled={!canDrawPolygon}
            ariaLabel="Draw polygon"
            onToolChange={onToolChange}
          >
            <PentagonOutlinedIcon sx={arcIconSx} />
          </ArcDesktopToolButton>
        </Box>

        {canDeleteFeature && selectedFeatureId && onDeleteFeature && (
          <>
            <ArcDesktopDivider />
            <Box sx={mapArcDesktopToolGroupSx()}>
              <Tooltip title="Delete selected feature (Del)" placement="bottom">
                <span>
                  <IconButton
                    size="small"
                    aria-label="Delete selected feature"
                    disabled={deletingFeatureId === selectedFeatureId}
                    onClick={() => onDeleteFeature(selectedFeatureId)}
                    sx={mapArcDesktopToolButtonSx(false)}
                  >
                    <DeleteOutlineIcon sx={{ ...arcIconSx, color: '#c62828' }} />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          </>
        )}

        {onExport && (
          <>
            <ArcDesktopDivider />
            <Box sx={mapArcDesktopToolGroupSx()}>
              <MapExportMenu disabled={exportDisabled} onExport={onExport} compact arcDesktop />
            </Box>
          </>
        )}

        {activeTool === 'digitize' && canDigitize && mixedDigitize && (
          <>
            <ArcDesktopDivider />
            <Box sx={mapArcDesktopToolGroupSx()} display="flex" alignItems="center" gap={0.25}>
              <BuildOutlinedIcon sx={{ fontSize: 12, color: MAP_CHROME.textMuted, ml: 0.25 }} />
              <ToggleButtonGroup
                orientation="horizontal"
                exclusive
                size="small"
                value={digitizeShape}
                onChange={(_, value) => value && onDigitizeShapeChange?.(value as DigitizeShape)}
                sx={mapToolbarShapeToggleSx('workspace')}
              >
                <ToggleButton value="Point" aria-label="Add Point">
                  <Tooltip title="Add Point" placement="bottom"><PlaceOutlinedIcon sx={{ fontSize: 14 }} /></Tooltip>
                </ToggleButton>
                <ToggleButton value="LineString" aria-label="Draw Line">
                  <Tooltip title="Draw Line" placement="bottom"><TimelineOutlinedIcon sx={{ fontSize: 14 }} /></Tooltip>
                </ToggleButton>
                <ToggleButton value="Polygon" aria-label="Draw Polygon">
                  <Tooltip title="Draw Polygon" placement="bottom"><PentagonOutlinedIcon sx={{ fontSize: 14 }} /></Tooltip>
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </>
        )}

        {showMeasureReadout && (
          <Box sx={mapArcDesktopMeasureReadoutSx()}>
            <Typography variant="caption" display="block" fontWeight={600} fontSize="0.5625rem" color="text.secondary">
              {measureLabel}
            </Typography>
            <Typography variant="caption" fontWeight={700} display="block" fontSize="0.625rem" sx={{ whiteSpace: 'pre-line', lineHeight: 1.3, color: MAP_CHROME.accentDark }}>
              {measureResult}
            </Typography>
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box sx={mapToolbarSx(placement)}>
      <Box sx={mapToolbarGroupSx(placement)}>
        {!explorerOpen && onShowExplorer && (
          <>
            <Tooltip title="Show Map Explorer" placement="bottom">
              <IconButton
                size="small"
                onClick={onShowExplorer}
                aria-label="Show Map Explorer"
                sx={isTitleBar ? mapToolbarTitleBarIconButtonSx() : {
                  ...mapRoundIconButtonSx(32),
                  bgcolor: 'rgba(8, 145, 178, 0.1)',
                  '&:hover': { bgcolor: 'rgba(8, 145, 178, 0.18)' },
                }}
              >
                <MapOutlinedIcon sx={{ ...mapToolbarIconSx(placement), color: isTitleBar ? '#ffffff' : MAP_CHROME.accent }} />
              </IconButton>
            </Tooltip>
            <Divider orientation="vertical" flexItem sx={mapToolbarDividerSx(placement)} />
          </>
        )}

        <ToggleButtonGroup
          orientation="horizontal"
          exclusive
          size="small"
          value={activeTool}
          onChange={(_, value) => value && onToolChange(value)}
          sx={mapToolbarToggleGroupSx(placement)}
        >
        <ToolButton value="info" title="Identify features" ariaLabel="Identify">
          <InfoOutlinedIcon sx={mapToolbarIconSx(placement)} />
        </ToolButton>
        <ToolButton value="measure" title="Measure distance" ariaLabel="Measure distance">
          <StraightenIcon sx={mapToolbarIconSx(placement)} />
        </ToolButton>
        <ToolButton value="measureArea" title="Measure area — draw polygon, double-click to finish" ariaLabel="Measure area">
          <SquareFootOutlinedIcon sx={mapToolbarIconSx(placement)} />
        </ToolButton>
        <ToolButton
          value="analyze"
          title={canAnalyze ? 'Spatial query analysis' : 'Enable a feature layer to analyze'}
          disabled={!canAnalyze}
          ariaLabel="Spatial analysis"
        >
          <AnalyticsOutlinedIcon sx={mapToolbarIconSx(placement)} />
        </ToolButton>
        <ToolButton
          value="edit"
          title={canEdit ? 'Edit shapes — select and drag vertices' : 'Turn on a feature layer to edit'}
          disabled={!canEdit}
          ariaLabel="Edit shapes"
        >
          <EditOutlinedIcon sx={mapToolbarIconSx(placement)} />
        </ToolButton>
        {showDigitizeTool && (
          <ToolButton
            value="digitize"
            title={canDigitize ? digitizeLabel : 'Enable a feature layer to digitize'}
            disabled={!canDigitize}
            ariaLabel="Digitize"
          >
            <DigitizeIcon sx={mapToolbarIconSx(placement)} />
          </ToolButton>
        )}
        <ToolButton
          value="polygon"
          title={canDrawPolygon ? 'Draw polygon — double-click to finish' : 'Enable a mixed geometry layer'}
          disabled={!canDrawPolygon}
          ariaLabel="Draw polygon"
        >
          <PentagonOutlinedIcon sx={mapToolbarIconSx(placement)} />
        </ToolButton>
        </ToggleButtonGroup>
      </Box>

      {canDeleteFeature && selectedFeatureId && onDeleteFeature && (
        <Box sx={mapToolbarGroupSx(placement)}>
          <Tooltip title="Delete selected feature (Del)" placement="bottom">
            <span>
              <IconButton
                size="small"
                aria-label="Delete selected feature"
                disabled={deletingFeatureId === selectedFeatureId}
                onClick={() => onDeleteFeature(selectedFeatureId)}
                sx={isTitleBar ? {
                  ...mapToolbarTitleBarIconButtonSx(),
                  color: '#ffcdd2',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' },
                } : {
                  ...mapRoundIconButtonSx(32),
                  color: '#c62828',
                  '&:hover': { bgcolor: 'rgba(198, 40, 40, 0.08)' },
                }}
              >
                <DeleteOutlineIcon sx={mapToolbarIconSx(placement)} />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      )}

      {onExport && (
        <Box sx={mapToolbarGroupSx(placement)}>
          <MapExportMenu disabled={exportDisabled} onExport={onExport} compact titleBar={isTitleBar} />
        </Box>
      )}

      {activeTool === 'digitize' && canDigitize && mixedDigitize && (
        <Box sx={mapToolbarGroupSx(placement)} display="flex" alignItems="center" gap={0.5}>
            <BuildOutlinedIcon sx={{ fontSize: 10, color: isTitleBar ? 'rgba(255,255,255,0.75)' : MAP_CHROME.textMuted }} />
            <ToggleButtonGroup
              orientation="horizontal"
              exclusive
              size="small"
              value={digitizeShape}
              onChange={(_, value) => value && onDigitizeShapeChange?.(value as DigitizeShape)}
              sx={mapToolbarShapeToggleSx(placement)}
            >
              <ToggleButton value="Point">
                <Tooltip title="Add Point" placement="bottom"><PlaceOutlinedIcon sx={mapToolbarIconSx(placement)} /></Tooltip>
              </ToggleButton>
              <ToggleButton value="LineString">
                <Tooltip title="Draw Line" placement="bottom"><TimelineOutlinedIcon sx={mapToolbarIconSx(placement)} /></Tooltip>
              </ToggleButton>
              <ToggleButton value="Polygon">
                <Tooltip title="Draw Polygon" placement="bottom"><PentagonOutlinedIcon sx={mapToolbarIconSx(placement)} /></Tooltip>
              </ToggleButton>
            </ToggleButtonGroup>
        </Box>
      )}

      {showMeasureReadout && (
        <Box
          sx={{
            ...mapToolbarGroupSx(placement),
            px: 0.75,
            py: 0.2,
            minWidth: 72,
          }}
        >
            <Typography
              variant="caption"
              display="block"
              fontWeight={600}
              fontSize="0.5rem"
              sx={{ color: isTitleBar ? 'rgba(255,255,255,0.65)' : 'text.secondary' }}
            >
              {measureLabel}
            </Typography>
            <Typography
              variant="caption"
              fontWeight={700}
              display="block"
              fontSize="0.625rem"
              sx={{
                whiteSpace: 'pre-line',
                lineHeight: 1.3,
                color: isTitleBar ? '#ffffff' : MAP_CHROME.accentDark,
              }}
            >
              {measureResult}
            </Typography>
          </Box>
      )}
    </Box>
  );
}
