import { ReactNode } from 'react';
import { Box, Button, Divider, IconButton, Tooltip, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import { appMainHeightSx } from '../../utils/appShellStyles';

/** ArcGIS Desktop–inspired chrome for the Feature Class Catalog. */
export const ARCMAP = {
  titleBg: 'linear-gradient(180deg, #3d6a9f 0%, #21436c 55%, #1a3558 100%)',
  titleBorder: '#0f2744',
  toolbarBg: '#ece9d8',
  toolbarBorder: '#a0a0a0',
  toolbarGroupBg: '#f5f5f4',
  workspaceBg: '#7f9db9',
  workspaceInset: '#c0c0c0',
  panelBg: '#ffffff',
  panelHeaderBg: 'linear-gradient(180deg, #f8f8f8 0%, #e3e3e3 100%)',
  panelHeaderBorder: '#a0a0a0',
  tocBg: '#ffffff',
  selectionBg: '#cce8ff',
  selectionBorder: '#316ac5',
  statusBg: '#ece9d8',
  statusBorder: '#a0a0a0',
  text: '#1a1a1a',
  textMuted: '#4a4a4a',
  accent: '#316ac5',
};

export function arcMapShellSx(): SxProps<Theme> {
  return {
    display: 'flex',
    flexDirection: 'column',
    ...appMainHeightSx(),
    bgcolor: ARCMAP.workspaceBg,
    fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
    fontSize: { xs: '0.75rem', sm: '0.8125rem' },
  };
}

export function arcMapTitleBarSx(): SxProps<Theme> {
  return {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    px: 1.25,
    py: 0.65,
    minHeight: 52,
    background: ARCMAP.titleBg,
    borderBottom: `1px solid ${ARCMAP.titleBorder}`,
    color: '#f8fafc',
    flexShrink: 0,
  };
}

export function mapMapHeaderBarSx(): SxProps<Theme> {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    px: 1.25,
    py: 0.35,
    minHeight: 40,
    flexShrink: 0,
    background: ARCMAP.titleBg,
    borderBottom: `1px solid ${ARCMAP.titleBorder}`,
    color: '#f8fafc',
    overflowX: 'auto',
    overflowY: 'hidden',
    '&::-webkit-scrollbar': { height: 3 },
    '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.28)', borderRadius: 2 },
  };
}

export function arcMapToolbarSx(): SxProps<Theme> {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 0.5,
    px: 0.75,
    py: 0.5,
    bgcolor: ARCMAP.toolbarBg,
    borderBottom: `1px solid ${ARCMAP.toolbarBorder}`,
    flexShrink: 0,
    flexWrap: 'wrap',
  };
}

export function arcMapToolbarGroupSx(): SxProps<Theme> {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 0.25,
    px: 0.5,
    py: 0.25,
    border: `1px solid ${ARCMAP.toolbarBorder}`,
    borderRadius: 0.5,
    bgcolor: ARCMAP.toolbarGroupBg,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8)',
  };
}

export function arcMapTocColumnSx(): SxProps<Theme> {
  return {
    width: 288,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    bgcolor: ARCMAP.tocBg,
    borderRight: `1px solid ${ARCMAP.toolbarBorder}`,
    overflow: 'hidden',
  };
}

export function arcMapWorkspaceColumnSx(): SxProps<Theme> {
  return {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    p: 0.75,
    overflow: 'hidden',
  };
}

export function arcMapContentFrameSx(): SxProps<Theme> {
  return {
    flex: 1,
    minHeight: 0,
    bgcolor: ARCMAP.panelBg,
    border: `2px solid ${ARCMAP.workspaceInset}`,
    boxShadow: 'inset 1px 1px 0 #ffffff, inset -1px -1px 0 #808080',
    overflow: 'auto',
  };
}

export function arcMapPanelHeaderSx(): SxProps<Theme> {
  return {
    px: 1.25,
    py: 0.65,
    background: ARCMAP.panelHeaderBg,
    borderBottom: `1px solid ${ARCMAP.panelHeaderBorder}`,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)',
  };
}

export function arcMapStatusBarSx(): SxProps<Theme> {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    px: 1,
    py: 0.35,
    minHeight: 24,
    bgcolor: ARCMAP.statusBg,
    borderTop: `1px solid ${ARCMAP.statusBorder}`,
    flexShrink: 0,
    fontSize: '0.75rem',
    color: ARCMAP.textMuted,
  };
}

export function arcMapListBoxSx(): SxProps<Theme> {
  return {
    border: `1px solid ${ARCMAP.toolbarBorder}`,
    bgcolor: '#ffffff',
    boxShadow: 'inset 1px 1px 2px rgba(0,0,0,0.08)',
    maxWidth: 420,
  };
}

export function arcMapListRowSx(selected = false): SxProps<Theme> {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    px: 1.25,
    py: 0.75,
    cursor: 'pointer',
    borderBottom: `1px solid #e8e8e8`,
    bgcolor: selected ? ARCMAP.selectionBg : 'transparent',
    color: ARCMAP.text,
    '&:hover': { bgcolor: selected ? ARCMAP.selectionBg : '#f0f6fc' },
    '&:last-child': { borderBottom: 'none' },
  };
}

export function arcMapAttributeHeaderSx() {
  return {
    fontWeight: 700,
    fontSize: '0.6875rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
    color: '#1a3558',
    background: 'linear-gradient(180deg, #e8eef5 0%, #d4dce8 100%)',
    borderBottom: '1px solid #9eb3cc',
    borderRight: '1px solid #c5d0dc',
    py: 0.55,
    px: 0.75,
    whiteSpace: 'nowrap' as const,
  };
}

export function ArcMapToolbarButton({
  title,
  label,
  icon,
  onClick,
  disabled,
  primary,
}: {
  title: string;
  label?: string;
  icon: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <Tooltip title={title}>
      <span>
        <Button
          size="small"
          disabled={disabled}
          onClick={onClick}
          startIcon={icon}
          sx={{
            minWidth: label ? 72 : 32,
            px: label ? 1 : 0.75,
            py: 0.35,
            fontSize: '0.75rem',
            fontWeight: 600,
            textTransform: 'none',
            color: primary ? '#fff' : ARCMAP.text,
            bgcolor: primary ? ARCMAP.accent : 'transparent',
            borderRadius: 0.5,
            border: primary ? `1px solid ${ARCMAP.selectionBorder}` : '1px solid transparent',
            '&:hover': {
              bgcolor: primary ? '#2858a8' : 'rgba(49,106,197,0.1)',
              borderColor: ARCMAP.toolbarBorder,
            },
            '& .MuiButton-startIcon': { mr: label ? 0.5 : 0, ml: 0 },
          }}
        >
          {label}
        </Button>
      </span>
    </Tooltip>
  );
}

export function ArcMapTitleBar({
  title,
  subtitle,
  onBack,
  actions,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  actions?: ReactNode;
}) {
  return (
    <Box sx={arcMapTitleBarSx()}>
      {onBack && (
        <IconButton size="small" onClick={onBack} sx={{ color: '#e2e8f0', p: 0.5 }}>
          {/** icon passed by parent */}
        </IconButton>
      )}
      <Box flex={1} minWidth={0}>
        <Typography
          variant="caption"
          sx={{ display: 'block', opacity: 0.85, letterSpacing: '0.06em', fontSize: '0.65rem' }}
        >
          Feature Class Catalog
        </Typography>
        <Typography variant="subtitle2" fontWeight={700} noWrap sx={{ lineHeight: 1.25 }}>
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="caption" sx={{ opacity: 0.8 }} noWrap display="block">
            {subtitle}
          </Typography>
        ) : null}
      </Box>
      {actions}
    </Box>
  );
}

export function ArcMapStatusBar({ segments }: { segments: ReactNode[] }) {
  return (
    <Box sx={arcMapStatusBarSx()}>
      {segments.map((segment, index) => (
        <Box key={index} display="flex" alignItems="center" gap={1}>
          {index > 0 && (
            <Divider orientation="vertical" flexItem sx={{ borderColor: ARCMAP.toolbarBorder }} />
          )}
          {segment}
        </Box>
      ))}
    </Box>
  );
}
