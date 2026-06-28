export type ConstructionTableStage =
  | 'planning'
  | 'dpr'
  | 'mb'
  | 'boq'
  | 'reconciliation'
  | 'ra-bill'
  | 'final'
  | 'dashboard'
  | 'reports'
  | 'gis'
  | 'default';

export type ConstructionTableTheme = {
  headerBg: string;
  headerColor: string;
  headerBorder: string;
  accent: string;
  panelBg: string;
  panelBorder: string;
};

export function constructionTableTheme(stage: ConstructionTableStage): ConstructionTableTheme {
  switch (stage) {
    case 'planning':
      return {
        headerBg: 'linear-gradient(180deg, #eef2ff 0%, #e0e7ff 100%)',
        headerColor: '#312e81',
        headerBorder: '#818cf8',
        accent: '#4f46e5',
        panelBg: 'linear-gradient(90deg, #eef2ff 0%, #ffffff 55%)',
        panelBorder: '#a5b4fc',
      };
    case 'dpr':
      return {
        headerBg: 'linear-gradient(180deg, #fff7ed 0%, #ffedd5 100%)',
        headerColor: '#9a3412',
        headerBorder: '#fb923c',
        accent: '#ea580c',
        panelBg: 'linear-gradient(90deg, #fff7ed 0%, #ffffff 55%)',
        panelBorder: '#fdba74',
      };
    case 'mb':
      return {
        headerBg: 'linear-gradient(180deg, #ecfdf5 0%, #d1fae5 100%)',
        headerColor: '#065f46',
        headerBorder: '#34d399',
        accent: '#059669',
        panelBg: 'linear-gradient(90deg, #ecfdf5 0%, #ffffff 55%)',
        panelBorder: '#6ee7b7',
      };
    case 'boq':
      return {
        headerBg: 'linear-gradient(180deg, #f5f3ff 0%, #ede9fe 100%)',
        headerColor: '#5b21b6',
        headerBorder: '#a78bfa',
        accent: '#7c3aed',
        panelBg: 'linear-gradient(90deg, #f5f3ff 0%, #ffffff 55%)',
        panelBorder: '#c4b5fd',
      };
    case 'reconciliation':
      return {
        headerBg: 'linear-gradient(180deg, #fff1f2 0%, #ffe4e6 100%)',
        headerColor: '#9f1239',
        headerBorder: '#fb7185',
        accent: '#e11d48',
        panelBg: 'linear-gradient(90deg, #fff1f2 0%, #ffffff 55%)',
        panelBorder: '#fda4af',
      };
    case 'ra-bill':
      return {
        headerBg: 'linear-gradient(180deg, #ecfeff 0%, #cffafe 100%)',
        headerColor: '#155e75',
        headerBorder: '#22d3ee',
        accent: '#0891b2',
        panelBg: 'linear-gradient(90deg, #ecfeff 0%, #ffffff 55%)',
        panelBorder: '#67e8f9',
      };
    case 'final':
      return {
        headerBg: 'linear-gradient(180deg, #fdf4ff 0%, #fae8ff 100%)',
        headerColor: '#86198f',
        headerBorder: '#e879f9',
        accent: '#c026d3',
        panelBg: 'linear-gradient(90deg, #fdf4ff 0%, #ffffff 55%)',
        panelBorder: '#f0abfc',
      };
    case 'gis':
      return {
        headerBg: 'linear-gradient(180deg, #f0fdf4 0%, #dcfce7 100%)',
        headerColor: '#166534',
        headerBorder: '#4ade80',
        accent: '#16a34a',
        panelBg: 'linear-gradient(90deg, #f0fdf4 0%, #ffffff 55%)',
        panelBorder: '#86efac',
      };
    case 'dashboard':
      return {
        headerBg: 'linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%)',
        headerColor: '#1e3a8a',
        headerBorder: '#60a5fa',
        accent: '#2563eb',
        panelBg: 'linear-gradient(90deg, #eff6ff 0%, #ffffff 55%)',
        panelBorder: '#93c5fd',
      };
    case 'reports':
      return {
        headerBg: 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)',
        headerColor: '#334155',
        headerBorder: '#94a3b8',
        accent: '#475569',
        panelBg: 'linear-gradient(90deg, #f8fafc 0%, #ffffff 55%)',
        panelBorder: '#cbd5e1',
      };
    default:
      return {
        headerBg: 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)',
        headerColor: '#334155',
        headerBorder: '#94a3b8',
        accent: '#64748b',
        panelBg: '#fafbfc',
        panelBorder: '#cbd5e1',
      };
  }
}

export function constructionHeaderCellSx(
  stage: ConstructionTableStage,
  extra?: Record<string, unknown>,
) {
  const theme = constructionTableTheme(stage);
  return {
    fontWeight: 700,
    fontSize: '0.6875rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.055em',
    color: theme.headerColor,
    background: theme.headerBg,
    borderBottom: `2px solid ${theme.headerBorder}`,
    py: 1,
    px: 1.25,
    whiteSpace: 'nowrap' as const,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.65)',
    ...extra,
  };
}

export function constructionSectionBarSx(stage: ConstructionTableStage) {
  const theme = constructionTableTheme(stage);
  return {
    borderLeft: `4px solid ${theme.accent}`,
    background: theme.panelBg,
    borderRadius: 1,
    px: 2,
    py: 1.25,
    mb: 1.5,
    boxShadow: `inset 0 -1px 0 ${theme.panelBorder}44`,
  };
}

export function constructionTableShellSx(stage: ConstructionTableStage) {
  const theme = constructionTableTheme(stage);
  return {
    border: 1,
    borderColor: `${theme.panelBorder}88`,
    borderRadius: 1.5,
    overflow: 'hidden',
    bgcolor: '#ffffff',
    '& .MuiTableHead-root .MuiTableCell-root': {
      position: 'sticky',
      top: 0,
      zIndex: 1,
    },
    '& .MuiTableBody-root .MuiTableRow-root:nth-of-type(even)': {
      bgcolor: '#fafbfc',
    },
    '& .MuiTableBody-root .MuiTableRow-root:hover': {
      bgcolor: `${theme.accent}0d`,
    },
  };
}

export function constructionWorkflowChipSx(stage: ConstructionTableStage, active = false) {
  const theme = constructionTableTheme(stage);
  return active
    ? { bgcolor: `${theme.accent}18`, color: theme.headerColor, borderColor: theme.accent, fontWeight: 700 }
    : { borderColor: `${theme.panelBorder}`, color: theme.headerColor, fontWeight: 500 };
}
