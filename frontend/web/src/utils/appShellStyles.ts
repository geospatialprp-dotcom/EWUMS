export const DRAWER_WIDTH = 260;
export const DRAWER_WIDTH_MINI = 72;

/** App bar + main content vertical offset (matches AppLayout Toolbar minHeight). */
export function appMainTopOffsetSx() {
  return { mt: { xs: '64px', sm: '68px' } };
}

/** Full-height page content below the app bar. */
export function appMainHeightSx() {
  return { height: { xs: 'calc(100vh - 64px)', sm: 'calc(100vh - 68px)' } };
}

export function appDrawerPaperSx(width: number = DRAWER_WIDTH) {
  return {
    width,
    boxSizing: 'border-box',
    background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 48%, #0f172a 100%)',
    color: '#e2e8f0',
    borderRight: '1px solid #334155',
    transition: 'width 0.2s ease',
    overflowX: 'hidden',
  };
}

export function appDrawerBrandSx() {
  return {
    px: 2,
    py: 1.5,
    minHeight: 88,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #334155 100%)',
  };
}

export function appDrawerEyebrowSx() {
  return {
    color: '#64748b',
    letterSpacing: '0.12em',
    fontWeight: 700,
    display: 'block',
    lineHeight: 1.2,
    fontSize: '0.625rem',
    textTransform: 'uppercase' as const,
  };
}

export function appDrawerNameSx() {
  return {
    color: '#f8fafc',
    fontWeight: 800,
    letterSpacing: '-0.02em',
    fontSize: '1.125rem',
    lineHeight: 1.3,
  };
}

export function appNavItemSx(selected: boolean, collapsed = false) {
  return {
    mx: collapsed ? 0.75 : 1.25,
    mb: 0.35,
    minHeight: 44,
    borderRadius: 1.5,
    color: selected ? '#f8fafc' : '#cbd5e1',
    bgcolor: selected ? 'rgba(37, 99, 235, 0.22)' : 'transparent',
    borderLeft: selected ? '3px solid #60a5fa' : '3px solid transparent',
    transition: 'background-color 0.15s ease, color 0.15s ease',
    justifyContent: collapsed ? 'center' : undefined,
    px: collapsed ? 1 : undefined,
    '&.Mui-selected': {
      bgcolor: 'rgba(37, 99, 235, 0.22)',
      color: '#f8fafc',
      '&:hover': { bgcolor: 'rgba(37, 99, 235, 0.28)' },
    },
    '&:hover': {
      bgcolor: selected ? 'rgba(37, 99, 235, 0.28)' : 'rgba(255, 255, 255, 0.06)',
      color: '#f8fafc',
    },
    '& .MuiListItemIcon-root': {
      color: selected ? '#93c5fd' : '#94a3b8',
      minWidth: collapsed ? 0 : 40,
      justifyContent: 'center',
    },
    '& .MuiListItemText-root': collapsed ? { display: 'none' } : undefined,
    '& .MuiListItemText-primary': {
      fontSize: '0.875rem',
      fontWeight: selected ? 700 : 500,
      letterSpacing: '0.01em',
    },
  };
}

export function appNavSectionLabelSx(collapsed = false) {
  return {
    px: collapsed ? 0 : 2.5,
    pt: 1.5,
    pb: 0.75,
    fontSize: '0.625rem',
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase' as const,
    color: '#64748b',
    display: collapsed ? 'none' : 'block',
  };
}

export function appTouchIconButtonSx() {
  return {
    minWidth: 44,
    minHeight: 44,
  };
}

export function appBarSx() {
  return {
    bgcolor: '#ffffff',
    color: '#0f172a',
    boxShadow: '0 1px 0 #e2e8f0, 0 4px 16px rgba(15, 23, 42, 0.04)',
  };
}

export function appBarBrandRowSx() {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: { xs: 0.75, sm: 1.5, md: 2 },
    minWidth: 0,
    overflow: 'hidden',
  };
}

export function appBarTitleSx() {
  return {
    fontWeight: 700,
    letterSpacing: '-0.01em',
    color: '#0f172a',
    fontSize: { xs: '0.72rem', sm: '0.95rem', md: '1.125rem' },
    lineHeight: { xs: 1.2, sm: 1.25 },
    minWidth: 0,
  };
}

export function appBarRoleSx() {
  return {
    color: '#64748b',
    fontWeight: 600,
    letterSpacing: '0.02em',
  };
}

export function appBarUserBlockSx() {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: { xs: 1, md: 1.25 },
    flexShrink: 0,
  };
}

export function appBarUserNameSx() {
  return {
    display: { xs: 'none', md: 'block' },
    textAlign: 'right',
    minWidth: 0,
    maxWidth: 220,
    px: 1.25,
    py: 0.25,
    borderRight: '1px solid',
    borderColor: '#e2e8f0',
    mr: { md: 0.25 },
  };
}

export function appUserAvatarSx() {
  return {
    width: 34,
    height: 34,
    fontSize: 13,
    fontWeight: 700,
    bgcolor: '#2563eb',
    color: '#fff',
    boxShadow: '0 2px 8px rgba(37, 99, 235, 0.35)',
  };
}

export function appDepartmentSwitcherSx(open: boolean) {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 1.25,
    pl: 0.75,
    pr: 1.25,
    py: 0.75,
    borderRadius: 999,
    border: '1px solid',
    borderColor: open ? '#93c5fd' : '#e2e8f0',
    bgcolor: open ? '#eff6ff' : '#f8fafc',
    cursor: 'pointer',
    transition: 'all 0.18s ease',
    boxShadow: open
      ? '0 0 0 3px rgba(37, 99, 235, 0.12)'
      : '0 2px 8px rgba(15, 23, 42, 0.06)',
    '&:hover': {
      bgcolor: '#eff6ff',
      borderColor: '#93c5fd',
      boxShadow: '0 4px 14px rgba(37, 99, 235, 0.12)',
    },
  };
}

export function appDepartmentMenuPaperSx() {
  return {
    minWidth: { xs: 'calc(100vw - 32px)', sm: 320 },
    maxWidth: 'calc(100vw - 16px)',
    mt: 1,
    borderRadius: 2.5,
    overflow: 'hidden',
    border: '1px solid #e2e8f0',
    boxShadow: '0 16px 48px rgba(15, 23, 42, 0.14)',
  };
}

export function appDepartmentMenuHeroSx() {
  return {
    px: 2.5,
    py: 2,
    background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 55%, #1d4ed8 100%)',
    color: '#f8fafc',
  };
}

