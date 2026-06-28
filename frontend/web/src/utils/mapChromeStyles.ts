/** Shared Map Explorer chrome — ArcGIS Desktop (ArcMap) theme. */

import { ARCMAP } from '../components/gis/arcMapUi';

export { ARCMAP };

export const MAP_CHROME = {
  slate: '#1a3558',
  slateMid: '#21436c',
  slateLight: '#3d6a9f',
  accent: ARCMAP.accent,
  accentDark: '#2858a8',
  accentSoft: '#6b9bd1',
  panelBg: ARCMAP.tocBg,
  pageBg: ARCMAP.workspaceBg,
  border: ARCMAP.toolbarBorder,
  textMuted: ARCMAP.textMuted,
  text: ARCMAP.text,
  gisHero: ARCMAP.titleBg,
  gisPanelHeader: ARCMAP.panelHeaderBg,
};

export function mapFloatingPanelSx(extra?: Record<string, unknown>) {
  return {
    border: `1px solid ${ARCMAP.toolbarBorder}`,
    borderRadius: 0,
    overflow: 'hidden',
    bgcolor: ARCMAP.toolbarBg,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.85)',
    fontFamily: '"Segoe UI", Tahoma, sans-serif',
    ...extra,
  };
}

export function mapDarkHeaderSx() {
  return {
    background: ARCMAP.panelHeaderBg,
    color: ARCMAP.text,
    px: 1,
    py: 0.5,
    borderBottom: `1px solid ${ARCMAP.panelHeaderBorder}`,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)',
  };
}

export function mapLayerPanelSx() {
  return {
    width: { xs: 260, md: 288 },
    flexShrink: 0,
    display: { xs: 'none', md: 'flex' },
    flexDirection: 'column',
    borderRight: `1px solid ${ARCMAP.toolbarBorder}`,
    bgcolor: ARCMAP.tocBg,
    height: '100%',
    fontFamily: '"Segoe UI", Tahoma, sans-serif',
    fontSize: '0.8125rem',
  };
}

export function mapLayerGroupLabelSx() {
  return {
    letterSpacing: '0.04em',
    color: ARCMAP.textMuted,
    lineHeight: 1.2,
    fontWeight: 700,
    fontSize: '0.7rem',
    px: 1,
    py: 0.35,
    bgcolor: '#f0f0f0',
    borderBottom: `1px solid ${ARCMAP.toolbarBorder}`,
  };
}

export function mapLayerItemSx(highlighted: boolean) {
  return {
    py: 0,
    minHeight: 22,
    borderRadius: 0,
    border: highlighted ? `1px solid ${ARCMAP.selectionBorder}` : '1px solid transparent',
    bgcolor: highlighted ? ARCMAP.selectionBg : 'transparent',
    '&:hover': { bgcolor: highlighted ? ARCMAP.selectionBg : '#f0f6fc' },
    '&.Mui-selected': {
      bgcolor: ARCMAP.selectionBg,
      '&:hover': { bgcolor: '#b8dcff' },
    },
    '&.Mui-selected .MuiListItemText-primary': {
      color: ARCMAP.text,
      fontWeight: 600,
    },
  };
}

export const MAP_TITLEBAR_BUTTON_SIZE = 24;
export const MAP_TITLEBAR_ICON_SIZE = 11;
export const MAP_ARC_TOOL_SIZE = 23;
export const MAP_ARC_TOOL_ICON_SIZE = 16;

export function mapArcDesktopToolbarSx() {
  return {
    display: 'flex',
    alignItems: 'stretch',
    gap: 0,
    flex: 1,
    minWidth: 0,
    overflowX: 'auto',
    overflowY: 'hidden',
    '&::-webkit-scrollbar': { height: 4 },
    '&::-webkit-scrollbar-thumb': { bgcolor: '#a0a0a0', borderRadius: 1 },
  };
}

export function mapArcDesktopToolGroupSx() {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 0,
    px: 0.25,
    flexShrink: 0,
  };
}

export function mapArcDesktopToolButtonSx(selected = false, disabled = false) {
  return {
    width: MAP_ARC_TOOL_SIZE,
    height: MAP_ARC_TOOL_SIZE,
    minWidth: MAP_ARC_TOOL_SIZE,
    minHeight: MAP_ARC_TOOL_SIZE,
    borderRadius: 0,
    p: 0,
    border: selected ? `2px solid ${ARCMAP.selectionBorder}` : '1px solid transparent',
    bgcolor: selected ? ARCMAP.selectionBg : 'transparent',
    color: disabled ? 'rgba(26,26,26,0.35)' : ARCMAP.text,
    boxShadow: selected ? 'inset 0 0 0 1px rgba(255,255,255,0.65)' : 'none',
    '&:hover': {
      bgcolor: selected ? '#b8dcff' : 'rgba(49,106,197,0.08)',
      borderColor: selected ? ARCMAP.selectionBorder : ARCMAP.toolbarBorder,
    },
    '&.Mui-disabled': {
      opacity: 0.45,
      color: 'rgba(26,26,26,0.35)',
    },
  };
}

export function mapArcDesktopDividerSx() {
  return {
    alignSelf: 'stretch',
    mx: 0.15,
    my: 0.35,
    borderColor: '#9a9a9a',
  };
}

export function mapArcDesktopMeasureReadoutSx() {
  return {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    px: 0.75,
    py: 0.15,
    minWidth: 72,
    borderLeft: `1px solid ${ARCMAP.toolbarBorder}`,
    bgcolor: 'rgba(255,255,255,0.35)',
  };
}

export function mapToolbarSx(variant: 'titleBar' | 'workspace' = 'workspace') {
  if (variant === 'titleBar') {
    return {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 0.35,
      flex: 1,
      minWidth: 0,
      justifyContent: 'center',
      overflowX: 'auto',
      overflowY: 'hidden',
      '&::-webkit-scrollbar': { height: 3 },
      '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.28)', borderRadius: 2 },
    };
  }

  return {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0.75,
    px: 0.75,
    py: 0.5,
    mb: 0.5,
    width: '100%',
    flexShrink: 0,
    bgcolor: ARCMAP.toolbarBg,
    border: `1px solid ${ARCMAP.toolbarBorder}`,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.85)',
    overflowX: 'auto',
    overflowY: 'hidden',
    '&::-webkit-scrollbar': { height: 4 },
    '&::-webkit-scrollbar-thumb': { bgcolor: '#c0c0c0', borderRadius: 2 },
  };
}

export function mapToolbarGroupSx(variant: 'titleBar' | 'workspace' = 'workspace') {
  if (variant === 'titleBar') {
    return {
      display: 'flex',
      alignItems: 'center',
      gap: 0.15,
      px: 0.35,
      py: 0.1,
      flexShrink: 0,
      border: '1px solid rgba(255,255,255,0.16)',
      borderRadius: '14px',
      bgcolor: 'rgba(255,255,255,0.05)',
    };
  }

  return {
    display: 'flex',
    alignItems: 'center',
    gap: 0.5,
    px: 0.5,
    py: 0.25,
    flexShrink: 0,
    border: `1px solid ${ARCMAP.toolbarBorder}`,
    borderRadius: 0.5,
    bgcolor: ARCMAP.toolbarGroupBg,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8)',
  };
}

export function mapToolbarToggleGroupSx(variant: 'titleBar' | 'workspace' = 'workspace') {
  const isTitleBar = variant === 'titleBar';
  const btnSize = isTitleBar ? MAP_TITLEBAR_BUTTON_SIZE : 30;
  return {
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: isTitleBar ? 0.15 : 0.35,
    '& .MuiToggleButtonGroup-grouped': {
      border: '0 !important',
      margin: '0 !important',
      borderRadius: '50% !important',
    },
    '& .MuiToggleButton-root': {
      border: isTitleBar
        ? '1px solid rgba(255,255,255,0.2) !important'
        : `1px solid ${ARCMAP.toolbarBorder} !important`,
      borderRadius: '50% !important',
      mx: 0,
      my: 0,
      p: '0 !important',
      minWidth: `${btnSize}px !important`,
      minHeight: `${btnSize}px !important`,
      maxHeight: `${btnSize}px !important`,
      lineHeight: 0,
      color: isTitleBar ? 'rgba(255,255,255,0.88)' : ARCMAP.textMuted,
      bgcolor: isTitleBar ? 'transparent' : ARCMAP.toolbarBg,
      boxShadow: isTitleBar ? 'none' : '0 1px 4px rgba(0,0,0,0.12)',
      transition: isTitleBar ? 'background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease' : undefined,
      '&:hover': { bgcolor: isTitleBar ? 'rgba(255,255,255,0.14)' : '#f0f6fc' },
    },
    '& .MuiToggleButton-root.Mui-selected': {
      bgcolor: isTitleBar ? 'rgba(255,255,255,0.95)' : ARCMAP.accent,
      color: isTitleBar ? ARCMAP.accent : '#ffffff',
      borderColor: isTitleBar ? 'rgba(255,255,255,0.95) !important' : `${ARCMAP.selectionBorder} !important`,
      '&:hover': { bgcolor: isTitleBar ? '#ffffff' : '#2858a8' },
    },
    '& .MuiToggleButton-root.Mui-disabled': { opacity: isTitleBar ? 0.32 : 0.38 },
  };
}

export function mapToolbarShapeToggleSx(variant: 'titleBar' | 'workspace' = 'workspace') {
  const isTitleBar = variant === 'titleBar';
  const btnSize = isTitleBar ? MAP_TITLEBAR_BUTTON_SIZE : 28;
  return {
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: isTitleBar ? 0.15 : 0.35,
    '& .MuiToggleButtonGroup-grouped': {
      border: '0 !important',
      margin: '0 !important',
      borderRadius: '50% !important',
    },
    '& .MuiToggleButton-root': {
      border: isTitleBar
        ? '1px solid rgba(255,255,255,0.2) !important'
        : `1px solid ${ARCMAP.toolbarBorder} !important`,
      borderRadius: '50% !important',
      p: '0 !important',
      minWidth: `${btnSize}px !important`,
      minHeight: `${btnSize}px !important`,
      maxHeight: `${btnSize}px !important`,
      lineHeight: 0,
      color: isTitleBar ? 'rgba(255,255,255,0.88)' : ARCMAP.textMuted,
      bgcolor: isTitleBar ? 'transparent' : ARCMAP.toolbarBg,
      boxShadow: isTitleBar ? 'none' : '0 1px 3px rgba(0,0,0,0.1)',
      transition: isTitleBar ? 'background-color 0.15s ease, color 0.15s ease' : undefined,
      '&:hover': { bgcolor: isTitleBar ? 'rgba(255,255,255,0.14)' : '#f0f6fc' },
    },
    '& .MuiToggleButton-root.Mui-selected': {
      bgcolor: isTitleBar ? 'rgba(255,255,255,0.95)' : ARCMAP.accent,
      color: isTitleBar ? ARCMAP.accent : '#ffffff',
      borderColor: isTitleBar ? 'rgba(255,255,255,0.95) !important' : `${ARCMAP.selectionBorder} !important`,
    },
  };
}

export function mapToolbarTitleBarIconButtonSx() {
  return {
    width: MAP_TITLEBAR_BUTTON_SIZE,
    height: MAP_TITLEBAR_BUTTON_SIZE,
    borderRadius: '50%',
    p: 0,
    border: '1px solid rgba(255,255,255,0.2)',
    bgcolor: 'transparent',
    color: 'rgba(255,255,255,0.88)',
    boxShadow: 'none',
    transition: 'background-color 0.15s ease, color 0.15s ease',
    '&:hover': { bgcolor: 'rgba(255,255,255,0.14)' },
  };
}

export const MAP_ROUND_CONTROL_SIZE = 32;

export function mapRoundIconButtonSx(size = MAP_ROUND_CONTROL_SIZE) {
  return {
    width: size,
    height: size,
    borderRadius: '50%',
    p: 0,
    border: `1px solid ${ARCMAP.toolbarBorder}`,
    bgcolor: ARCMAP.toolbarBg,
    boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
    color: ARCMAP.textMuted,
    '&:hover': { bgcolor: '#f0f6fc' },
  };
}

export function mapToolbarIconSx(variant: 'titleBar' | 'workspace' = 'workspace') {
  return {
    fontSize: variant === 'titleBar' ? MAP_TITLEBAR_ICON_SIZE : 14,
    display: 'block',
  };
}

export function mapToolbarDividerSx(variant: 'titleBar' | 'workspace' = 'workspace') {
  return {
    alignSelf: 'stretch',
    mx: 0.25,
    borderColor: variant === 'titleBar' ? 'rgba(255,255,255,0.28)' : ARCMAP.toolbarBorder,
  };
}

export function mapZoomControlsSx() {
  return {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 0.35,
    bgcolor: 'transparent',
  };
}

export function mapMapOverlayIconButtonSx(size = 26) {
  return {
    width: size,
    height: size,
    borderRadius: '50%',
    p: 0,
    border: 'none',
    bgcolor: 'transparent',
    color: MAP_CHROME.accent,
    boxShadow: 'none',
    transition: 'opacity 0.15s ease',
    '&:hover': { bgcolor: 'transparent', opacity: 0.72 },
  };
}

export function mapZoomIconSx() {
  return {
    fontSize: 18,
    display: 'block',
    filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.95)) drop-shadow(0 1px 2px rgba(255,255,255,0.85))',
  };
}

export function mapSearchBarSx(placement: 'titleBar' | 'map' = 'map') {
  if (placement === 'titleBar') {
    return {
      flexShrink: 0,
      width: { xs: 150, sm: 200 },
      maxWidth: 220,
      border: '1px solid rgba(255,255,255,0.35)',
      borderRadius: 0,
      bgcolor: '#ffffff',
      boxShadow: 'none',
      overflow: 'hidden',
    };
  }

  return mapFloatingPanelSx({
    position: 'absolute',
    top: 8,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 19,
    width: { xs: 'calc(100% - 120px)', sm: 380 },
    maxWidth: 420,
  });
}

export function mapCompassCardSx() {
  return {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 20,
    pointerEvents: 'auto',
    userSelect: 'none',
    bgcolor: 'transparent',
    background: 'none',
    border: 'none',
    boxShadow: 'none',
  };
}

export function mapAnalysisPanelSx() {
  return mapFloatingPanelSx({
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 20,
    width: 320,
    maxHeight: 'calc(100% - 56px)',
    display: 'flex',
    flexDirection: 'column',
  });
}

export function mapAttributeBookSx() {
  return {
    bgcolor: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    position: 'relative',
    zIndex: 5,
    mx: 0.75,
    mb: 0.75,
    border: `2px solid ${ARCMAP.workspaceInset}`,
    boxShadow: 'inset 1px 1px 0 #ffffff, inset -1px -1px 0 #808080',
    fontFamily: '"Segoe UI", Tahoma, sans-serif',
  };
}

export function mapSheetTabRailSx() {
  return {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 0,
    px: 0.5,
    pt: 0.25,
    pb: 0,
    background: ARCMAP.panelHeaderBg,
    borderTop: `1px solid ${ARCMAP.toolbarBorder}`,
    overflowX: 'auto',
    overflowY: 'hidden',
    flexShrink: 0,
    '&::-webkit-scrollbar': { height: 5 },
    '&::-webkit-scrollbar-thumb': { bgcolor: '#a0a0a0' },
  };
}

export function mapMapFrameSx(hasAttributeDock = false) {
  return {
    flex: 1,
    minHeight: 0,
    position: 'relative',
    m: 0.75,
    mb: hasAttributeDock ? 0 : 0.75,
    border: `2px solid ${ARCMAP.workspaceInset}`,
    boxShadow: 'inset 1px 1px 0 #ffffff, inset -1px -1px 0 #808080',
    bgcolor: '#000',
    overflow: 'hidden',
  };
}
