export type PageAccent =
  | 'blue'
  | 'teal'
  | 'indigo'
  | 'violet'
  | 'rose'
  | 'slate'
  | 'amber';

const ACCENTS: Record<PageAccent, { bar: string; label: string; title: string }> = {
  blue: { bar: '#2563eb', label: '#64748b', title: '#0f172a' },
  teal: { bar: '#0d9488', label: '#64748b', title: '#0f172a' },
  indigo: { bar: '#4f46e5', label: '#64748b', title: '#0f172a' },
  violet: { bar: '#7c3aed', label: '#64748b', title: '#0f172a' },
  rose: { bar: '#e11d48', label: '#64748b', title: '#0f172a' },
  slate: { bar: '#475569', label: '#64748b', title: '#0f172a' },
  amber: { bar: '#d97706', label: '#64748b', title: '#0f172a' },
};

export function pageShellSx(fullHeight = false) {
  return {
    p: { xs: 1.5, sm: 2, md: 3 },
    bgcolor: '#f1f5f9',
    minWidth: 0,
    minHeight: fullHeight ? { xs: 'calc(100vh - 56px)', sm: 'calc(100vh - 68px)' } : undefined,
    overflow: fullHeight ? 'auto' : undefined,
  };
}

export function pageHeaderSx(accent: PageAccent = 'blue') {
  const theme = ACCENTS[accent];
  return {
    borderLeft: `4px solid ${theme.bar}`,
    background: 'linear-gradient(90deg, #f8fafc 0%, #ffffff 72%)',
    borderRadius: 2,
    px: { xs: 1.5, sm: 2, md: 2.5 },
    py: { xs: 1.25, sm: 1.75 },
    mb: { xs: 2, md: 3 },
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
  };
}

export function pageEyebrowSx(accent: PageAccent = 'blue') {
  return {
    color: ACCENTS[accent].label,
    letterSpacing: '0.12em',
    fontWeight: 700,
    display: 'block',
    lineHeight: 1.2,
  };
}

export function pageTitleSx(accent: PageAccent = 'blue') {
  return {
    color: ACCENTS[accent].title,
    fontWeight: 800,
    letterSpacing: '-0.02em',
    fontSize: { xs: '1.25rem', sm: '1.375rem', md: '1.5rem' },
  };
}

export function surfaceCardSx() {
  return {
    borderRadius: 2.5,
    overflow: 'hidden',
    border: '1px solid #e2e8f0',
    boxShadow: '0 4px 24px rgba(15, 23, 42, 0.06)',
    bgcolor: '#ffffff',
  };
}

export function surfaceCardHeaderSx() {
  return {
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #334155 100%)',
    color: '#f8fafc',
    px: 2.5,
    py: 1.75,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 2,
    flexWrap: 'wrap',
  };
}

export function dataTableSx() {
  return {
    border: '1px solid #e2e8f0',
    borderRadius: 2,
    overflow: 'auto',
    bgcolor: '#ffffff',
    WebkitOverflowScrolling: 'touch',
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

export type KpiTone = 'blue' | 'teal' | 'amber' | 'rose' | 'violet' | 'slate';

const KPI_TONES: Record<KpiTone, { accent: string; bg: string; bar: string; label: string }> = {
  blue: { accent: '#1e40af', bg: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', bar: '#2563eb', label: '#1e3a8a' },
  teal: { accent: '#0f766e', bg: 'linear-gradient(135deg, #ecfdf5 0%, #ccfbf1 100%)', bar: '#0d9488', label: '#134e4a' },
  amber: { accent: '#b45309', bg: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', bar: '#d97706', label: '#92400e' },
  rose: { accent: '#be123c', bg: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)', bar: '#e11d48', label: '#9f1239' },
  violet: { accent: '#6d28d9', bg: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)', bar: '#7c3aed', label: '#5b21b6' },
  slate: { accent: '#334155', bg: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)', bar: '#475569', label: '#334155' },
};

export function kpiCardSx(tone: KpiTone = 'blue') {
  const theme = KPI_TONES[tone];
  return {
    background: theme.bg,
    border: `1px solid ${theme.accent}22`,
    borderRadius: 2,
    p: 2,
    height: '100%',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8)',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: `0 8px 24px ${theme.accent}18`,
    },
  };
}

export function kpiLabelSx(tone: KpiTone = 'blue') {
  const theme = KPI_TONES[tone];
  return {
    fontSize: '0.6875rem',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    color: theme.label,
    mb: 0.5,
  };
}

export function kpiValueSx(tone: KpiTone = 'blue') {
  return {
    fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2rem' },
    fontWeight: 800,
    lineHeight: 1.1,
    letterSpacing: '-0.02em',
    color: KPI_TONES[tone].accent,
  };
}

export function sectionTitleSx() {
  return {
    fontWeight: 800,
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    fontSize: '0.75rem',
  };
}

export function styledTabsSx() {
  return {
    mb: 2,
    minHeight: 42,
    overflowX: 'auto',
    '& .MuiTabs-scroller': { overflowX: 'auto !important' },
    '& .MuiTab-root': {
      fontWeight: 600,
      fontSize: { xs: '0.75rem', sm: '0.8125rem' },
      textTransform: 'none',
      minHeight: 44,
      minWidth: 'auto',
      px: { xs: 1.25, sm: 2 },
    },
    '& .Mui-selected': { color: '#1e40af !important' },
    '& .MuiTabs-indicator': {
      height: 3,
      borderRadius: '3px 3px 0 0',
      background: 'linear-gradient(90deg, #2563eb, #4f46e5)',
    },
  };
}

export function subPageHeaderSx() {
  return {
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #334155 100%)',
    color: '#f8fafc',
    px: 2.5,
    py: 1.75,
    display: 'flex',
    alignItems: 'center',
    gap: 1.5,
    borderBottom: '1px solid #334155',
  };
}

export function loginShellSx() {
  return {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 40%, #2563eb 100%)',
  };
}

export function loginCardSx() {
  return {
    borderRadius: 3,
    overflow: 'hidden',
    boxShadow: '0 24px 64px rgba(15, 23, 42, 0.35)',
    border: '1px solid rgba(255,255,255,0.12)',
  };
}

// Re-export project-specific aliases for backward compatibility
export {
  projectCardSx,
  projectCardHeaderSx,
  projectKpiPanelSx,
  projectKpiValueSx,
  projectKpiLabelSx,
  projectKpiProgressSx,
  projectMilestoneSectionSx,
  projectMilestoneTableSx,
  projectStatusChipSx,
  projectPageHeaderSx,
} from './projectPresentationStyles';
