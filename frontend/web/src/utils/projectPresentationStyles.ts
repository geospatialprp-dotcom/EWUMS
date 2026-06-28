export type ProjectKpiKind = 'physical' | 'financial';

const KPI_THEMES: Record<ProjectKpiKind, { accent: string; bg: string; bar: string; label: string }> = {
  physical: {
    accent: '#1e40af',
    bg: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
    bar: '#2563eb',
    label: '#1e3a8a',
  },
  financial: {
    accent: '#0f766e',
    bg: 'linear-gradient(135deg, #ecfdf5 0%, #ccfbf1 100%)',
    bar: '#0d9488',
    label: '#134e4a',
  },
};

export function projectPageHeaderSx() {
  return {
    borderLeft: '4px solid #1e40af',
    background: 'linear-gradient(90deg, #f8fafc 0%, #ffffff 72%)',
    borderRadius: 2,
    px: 2.5,
    py: 1.75,
    mb: 3,
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
  };
}

export function projectCardSx() {
  return {
    borderRadius: 2.5,
    overflow: 'hidden',
    border: '1px solid #e2e8f0',
    boxShadow: '0 4px 24px rgba(15, 23, 42, 0.06)',
    transition: 'box-shadow 0.2s ease',
    '&:hover': {
      boxShadow: '0 8px 32px rgba(15, 23, 42, 0.1)',
    },
  };
}

export function projectCardHeaderSx() {
  return {
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #334155 100%)',
    color: '#f8fafc',
    px: 3,
    py: 2.25,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 2,
    flexWrap: 'wrap',
  };
}

export function projectKpiPanelSx(kind: ProjectKpiKind) {
  const theme = KPI_THEMES[kind];
  return {
    background: theme.bg,
    border: `1px solid ${theme.accent}22`,
    borderRadius: 2,
    p: 2,
    height: '100%',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8)',
  };
}

export function projectKpiValueSx(kind: ProjectKpiKind) {
  return {
    fontSize: '2rem',
    fontWeight: 800,
    lineHeight: 1.1,
    letterSpacing: '-0.02em',
    color: KPI_THEMES[kind].accent,
  };
}

export function projectKpiLabelSx(kind: ProjectKpiKind) {
  return {
    fontSize: '0.6875rem',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    color: KPI_THEMES[kind].label,
    mb: 0.5,
  };
}

export function projectKpiProgressSx(kind: ProjectKpiKind) {
  const theme = KPI_THEMES[kind];
  return {
    mt: 1.25,
    height: 10,
    borderRadius: 5,
    bgcolor: `${theme.accent}18`,
    '& .MuiLinearProgress-bar': {
      borderRadius: 5,
      background: `linear-gradient(90deg, ${theme.bar} 0%, ${theme.accent} 100%)`,
    },
  };
}

export function projectMilestoneSectionSx() {
  return {
    mt: 2.5,
    pt: 2,
    borderTop: '1px solid #e2e8f0',
  };
}

export function projectMilestoneTableSx() {
  return {
    border: '1px solid #e2e8f0',
    borderRadius: 2,
    overflow: 'hidden',
    bgcolor: '#ffffff',
    '& .MuiTableHead-root .MuiTableCell-root': {
      background: 'linear-gradient(180deg, #f1f5f9 0%, #e2e8f0 100%)',
      color: '#334155',
      fontWeight: 700,
      fontSize: '0.6875rem',
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      borderBottom: '2px solid #94a3b8',
      py: 1.25,
    },
    '& .MuiTableBody-root .MuiTableRow-root:nth-of-type(even)': {
      bgcolor: '#f8fafc',
    },
    '& .MuiTableBody-root .MuiTableRow-root:hover': {
      bgcolor: '#eff6ff',
    },
  };
}

export function projectStatusChipSx(status: string) {
  const map: Record<string, { bg: string; color: string; border: string }> = {
    active: { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' },
    inactive: { bg: '#e2e8f0', color: '#64748b', border: '#94a3b8' },
    planning: { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
    on_hold: { bg: '#ffedd5', color: '#9a3412', border: '#fdba74' },
    completed: { bg: '#dcfce7', color: '#166534', border: '#86efac' },
  };
  const theme = map[status] ?? { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' };
  return {
    bgcolor: theme.bg,
    color: theme.color,
    border: `1px solid ${theme.border}`,
    fontWeight: 700,
    textTransform: 'capitalize' as const,
    letterSpacing: '0.03em',
  };
}
