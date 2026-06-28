import {
  Box, Checkbox, IconButton, List, ListItemButton, ListItemIcon, ListItemText,
  Tooltip, Typography,
} from '@mui/material';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import TimelineOutlinedIcon from '@mui/icons-material/TimelineOutlined';
import CropFreeOutlinedIcon from '@mui/icons-material/CropFreeOutlined';
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import LinkIcon from '@mui/icons-material/Link';
import FlightIcon from '@mui/icons-material/Flight';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import {
  ARCMAP,
  mapDarkHeaderSx,
  mapLayerItemSx,
  mapLayerPanelSx,
} from '../../utils/mapChromeStyles';
import { MapJurisdictionChip } from './mapUi';

type GeometryType = 'Point' | 'LineString' | 'Polygon';

export type MapCatalogLayer = {
  id: string;
  name: string;
  sourceType: string;
  sourceConfig: {
    geometryType?: GeometryType;
    featureClassId?: string;
    projectId?: string;
  };
};

export type MapLayerGroup = {
  id: string;
  name: string;
  layers: MapCatalogLayer[];
};

const BASEMAP_GROUP = 'Basemaps';

function getGroupVisibilityState(
  layers: MapCatalogLayer[],
  layerVisibility: Record<string, boolean>,
) {
  if (layers.length === 0) {
    return { allChecked: false, indeterminate: false };
  }
  const checkedCount = layers.filter((layer) => layerVisibility[layer.id] ?? false).length;
  return {
    allChecked: checkedCount === layers.length,
    indeterminate: checkedCount > 0 && checkedCount < layers.length,
  };
}

function GeometryIcon({ type }: { type?: GeometryType }) {
  const sx = { fontSize: 16, color: ARCMAP.textMuted };
  if (type === 'LineString') return <TimelineOutlinedIcon sx={sx} />;
  if (type === 'Polygon') return <CropFreeOutlinedIcon sx={sx} />;
  return <PlaceOutlinedIcon sx={sx} />;
}

interface MapLayerPanelProps {
  groups: MapLayerGroup[];
  layerVisibility: Record<string, boolean>;
  activeBasemapId: string;
  activeBasemapName?: string;
  activeEditLayerId: string;
  featureCount: number;
  visibleLayerCount?: number;
  jurisdictionLabel?: string;
  onToggleLayer: (groupName: string, layerId: string, enabled: boolean) => void;
  onToggleGroupLayers?: (groupId: string, enabled: boolean) => void;
  onToggleAllLayers?: (enabled: boolean) => void;
  onSelectEditLayer: (layerId: string) => void;
  onHide?: () => void;
  onConfigureOrthomosaic?: () => void;
}

export default function MapLayerPanel({
  groups,
  layerVisibility,
  activeBasemapId,
  activeBasemapName,
  activeEditLayerId,
  featureCount,
  visibleLayerCount,
  jurisdictionLabel,
  onToggleLayer,
  onToggleGroupLayers,
  onToggleAllLayers,
  onSelectEditLayer,
  onHide,
  onConfigureOrthomosaic,
}: MapLayerPanelProps) {
  const visibleCount = visibleLayerCount ?? Object.values(layerVisibility).filter(Boolean).length;
  const allFeatureLayers = groups
    .filter((group) => group.name !== BASEMAP_GROUP)
    .flatMap((group) => group.layers);
  const rootVisibility = getGroupVisibilityState(allFeatureLayers, layerVisibility);

  return (
    <Box sx={mapLayerPanelSx()}>
      <Box sx={mapDarkHeaderSx()} display="flex" alignItems="center" justifyContent="space-between">
        <Box display="flex" alignItems="center" gap={0.5} flex={1} minWidth={0}>
          {onToggleAllLayers && allFeatureLayers.length > 0 ? (
            <Tooltip title={rootVisibility.allChecked ? 'Uncheck all layers' : 'Check all layers'}>
              <Checkbox
                size="small"
                checked={rootVisibility.allChecked}
                indeterminate={rootVisibility.indeterminate}
                onChange={(e) => onToggleAllLayers(e.target.checked)}
                inputProps={{ 'aria-label': 'Toggle all layers' }}
                sx={{ p: 0, '& .MuiSvgIcon-root': { fontSize: 16 } }}
              />
            </Tooltip>
          ) : null}
          <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.7rem', color: ARCMAP.text }}>
            List By Drawing Order
          </Typography>
        </Box>
        {onHide && (
          <Tooltip title="Collapse Table of Contents">
            <IconButton size="small" onClick={onHide} aria-label="Hide TOC" sx={{ p: 0.25 }}>
              <ChevronLeftIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {jurisdictionLabel ? (
        <Box px={1} py={0.35} borderBottom={`1px solid ${ARCMAP.toolbarBorder}`} bgcolor="#fafafa">
          <MapJurisdictionChip label={jurisdictionLabel} />
        </Box>
      ) : null}

      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {groups.map((group) => {
          const isBasemap = group.name === BASEMAP_GROUP;
          const groupVisibility = getGroupVisibilityState(group.layers, layerVisibility);
          return (
            <Box key={group.id}>
              <Box sx={{
                fontSize: '0.7rem',
                fontWeight: 700,
                color: ARCMAP.textMuted,
                px: 1,
                py: 0.35,
                bgcolor: '#f0f0f0',
                borderBottom: `1px solid ${ARCMAP.toolbarBorder}`,
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
              }}
              >
                {!isBasemap && onToggleGroupLayers && group.layers.length > 0 ? (
                  <Tooltip title={groupVisibility.allChecked ? 'Uncheck all in group' : 'Check all in group'}>
                    <Checkbox
                      size="small"
                      checked={groupVisibility.allChecked}
                      indeterminate={groupVisibility.indeterminate}
                      onChange={(e) => onToggleGroupLayers(group.id, e.target.checked)}
                      inputProps={{ 'aria-label': `Toggle all layers in ${group.name}` }}
                      sx={{ p: 0, '& .MuiSvgIcon-root': { fontSize: 16 } }}
                    />
                  </Tooltip>
                ) : null}
                {isBasemap ? <LayersOutlinedIcon sx={{ fontSize: 14 }} /> : null}
                <Typography component="span" sx={{ fontSize: '0.7rem', fontWeight: 700, color: ARCMAP.textMuted }}>
                  {group.name} ({group.layers.length})
                </Typography>
              </Box>

              <List dense disablePadding>
                {group.layers.length === 0 ? (
                  <Typography variant="caption" color="text.secondary" px={1} py={0.5} display="block" fontSize="0.7rem">
                    No layers
                  </Typography>
                ) : group.layers.map((layer) => {
                  const visible = layerVisibility[layer.id] ?? false;
                  const isOrthoBasemap = isBasemap && layer.id.startsWith('ortho-');
                  const isActive = !isBasemap && activeEditLayerId === layer.id;
                  const isBasemapActive = isBasemap && activeBasemapId === layer.id;
                  const isHighlighted = isBasemapActive || isActive;

                      return (
                        <ListItemButton
                          key={layer.id}
                          selected={isHighlighted}
                          onClick={() => {
                            if (isBasemap) {
                              onToggleLayer(group.name, layer.id, true);
                            } else {
                              onSelectEditLayer(layer.id);
                            }
                          }}
                          sx={mapLayerItemSx(isHighlighted)}
                        >
                          {isBasemap ? (
                            <ListItemIcon sx={{ minWidth: 20, mr: 0.5 }}>
                              {isOrthoBasemap ? (
                                <FlightIcon sx={{ fontSize: 16, color: isBasemapActive ? ARCMAP.accent : ARCMAP.textMuted }} />
                              ) : isBasemapActive ? (
                                <RadioButtonCheckedIcon sx={{ fontSize: 16, color: ARCMAP.accent }} />
                              ) : (
                                <RadioButtonUncheckedIcon sx={{ fontSize: 16, color: '#a0a0a0' }} />
                              )}
                            </ListItemIcon>
                          ) : (
                            <>
                              <Checkbox
                                size="small"
                                checked={visible}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => onToggleLayer(group.name, layer.id, e.target.checked)}
                                sx={{ p: 0, mr: 0.5, '& .MuiSvgIcon-root': { fontSize: 16 } }}
                              />
                              <ListItemIcon sx={{ minWidth: 20 }}>
                                <GeometryIcon type={layer.sourceConfig.geometryType} />
                              </ListItemIcon>
                            </>
                          )}
                          <ListItemText
                        primary={layer.name}
                        primaryTypographyProps={{
                          variant: 'body2',
                          fontSize: '0.75rem',
                          fontWeight: isHighlighted ? 600 : 400,
                          noWrap: true,
                        }}
                      />
                    </ListItemButton>
                  );
                })}
              </List>

              {isBasemap && onConfigureOrthomosaic && (
                <ListItemButton
                  onClick={onConfigureOrthomosaic}
                  sx={{ py: 0.5, minHeight: 22, borderTop: `1px dashed ${ARCMAP.toolbarBorder}` }}
                >
                  <ListItemIcon sx={{ minWidth: 20 }}>
                    <LinkIcon sx={{ fontSize: 16, color: ARCMAP.accent }} />
                  </ListItemIcon>
                  <ListItemText
                    primary="Orthomosaic Imagery"
                    primaryTypographyProps={{ variant: 'caption', fontSize: '0.7rem' }}
                  />
                </ListItemButton>
              )}
            </Box>
          );
        })}
      </Box>

      <Box
        px={1}
        py={0.5}
        borderTop={`1px solid ${ARCMAP.toolbarBorder}`}
        bgcolor={ARCMAP.statusBg}
      >
        <Typography variant="caption" sx={{ fontSize: '0.65rem', color: ARCMAP.textMuted }}>
          {visibleCount} visible · {featureCount} features
          {activeBasemapName ? ` · ${activeBasemapName}` : ''}
        </Typography>
      </Box>
    </Box>
  );
}
