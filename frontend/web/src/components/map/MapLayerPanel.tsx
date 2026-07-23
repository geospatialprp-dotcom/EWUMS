import { useState, type MouseEvent } from 'react';
import {
  Box, Checkbox, Divider, IconButton, List, ListItemButton, ListItemIcon, ListItemText,
  Menu, MenuItem, Tooltip, Typography,
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
import CloseIcon from '@mui/icons-material/Close';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
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

type LayerContextMenuState = {
  mouseX: number;
  mouseY: number;
  groupName: string;
  layerId: string;
};

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
  onRemoveLayer?: (groupName: string, layerId: string) => void;
  onOpenAttributeTable?: (layerId: string) => void;
  onHide?: () => void;
  onConfigureOrthomosaic?: () => void;
}

const contextMenuItemSx = {
  fontSize: '0.8125rem',
  fontFamily: '"Segoe UI", Tahoma, sans-serif',
  py: 0.35,
  px: 1,
  minHeight: 24,
  gap: 0.75,
  color: '#1a1a1a',
  borderRadius: 0,
  '&:hover, &.Mui-focusVisible': {
    bgcolor: '#316ac5',
    color: '#fff',
    '& .MuiListItemIcon-root': { color: '#fff' },
  },
  '& .MuiListItemIcon-root': {
    minWidth: 22,
    color: '#333',
  },
  '& .MuiListItemText-primary': {
    fontSize: '0.8125rem',
    fontWeight: 400,
    fontFamily: '"Segoe UI", Tahoma, sans-serif',
  },
};

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
  onRemoveLayer,
  onOpenAttributeTable,
  onHide,
  onConfigureOrthomosaic,
}: MapLayerPanelProps) {
  const [contextMenu, setContextMenu] = useState<LayerContextMenuState | null>(null);
  const visibleCount = visibleLayerCount ?? Object.values(layerVisibility).filter(Boolean).length;
  const allFeatureLayers = groups
    .filter((group) => group.name !== BASEMAP_GROUP)
    .flatMap((group) => group.layers);
  const rootVisibility = getGroupVisibilityState(allFeatureLayers, layerVisibility);
  const showLayerMenu = Boolean(onRemoveLayer || onOpenAttributeTable);

  const closeContextMenu = () => setContextMenu(null);

  const openLayerContextMenu = (
    event: MouseEvent,
    groupName: string,
    layer: MapCatalogLayer,
  ) => {
    if (!showLayerMenu) return;
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      mouseX: event.clientX + 2,
      mouseY: event.clientY - 6,
      groupName,
      layerId: layer.id,
    });
  };

  return (
    <Box sx={mapLayerPanelSx()} onContextMenu={(e) => e.preventDefault()}>
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
                  const isContextTarget = contextMenu?.layerId === layer.id;

                  return (
                    <ListItemButton
                      key={layer.id}
                      selected={isHighlighted || isContextTarget}
                      onClick={() => {
                        if (isBasemap) {
                          onToggleLayer(group.name, layer.id, true);
                        } else {
                          onSelectEditLayer(layer.id);
                        }
                      }}
                      onContextMenu={(event) => {
                        if (isBasemap) return;
                        openLayerContextMenu(event, group.name, layer);
                      }}
                      sx={mapLayerItemSx(isHighlighted || isContextTarget)}
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
                          fontWeight: isHighlighted || isContextTarget ? 600 : 400,
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

      <Menu
        open={Boolean(contextMenu)}
        onClose={closeContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
        transitionDuration={0}
        slotProps={{
          paper: {
            elevation: 0,
            sx: {
              minWidth: 196,
              borderRadius: 0,
              border: '1px solid #8a8a8a',
              boxShadow: '2px 2px 5px rgba(0,0,0,0.28)',
              bgcolor: '#f0f0f0',
              py: 0,
              overflow: 'hidden',
            },
          },
        }}
        MenuListProps={{
          dense: true,
          sx: {
            py: 0.25,
            bgcolor: '#f0f0f0',
          },
        }}
      >
        {onRemoveLayer && (
          <MenuItem
            sx={contextMenuItemSx}
            onClick={() => {
              if (!contextMenu) return;
              onRemoveLayer(contextMenu.groupName, contextMenu.layerId);
              closeContextMenu();
            }}
          >
            <ListItemIcon>
              <Box
                sx={{
                  width: 16,
                  height: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: '#c62828',
                  borderRadius: '2px',
                }}
              >
                <CloseIcon sx={{ fontSize: 12, color: '#fff' }} />
              </Box>
            </ListItemIcon>
            <ListItemText primary="Remove" />
          </MenuItem>
        )}
        {onRemoveLayer && onOpenAttributeTable && (
          <Divider sx={{ my: 0.25, borderColor: '#c0c0c0' }} />
        )}
        {onOpenAttributeTable && (
          <MenuItem
            sx={contextMenuItemSx}
            onClick={() => {
              if (!contextMenu) return;
              onOpenAttributeTable(contextMenu.layerId);
              closeContextMenu();
            }}
          >
            <ListItemIcon>
              <TableChartOutlinedIcon sx={{ fontSize: 16 }} />
            </ListItemIcon>
            <ListItemText primary="Open Attribute Table" />
          </MenuItem>
        )}
      </Menu>
    </Box>
  );
}
