import { APP_TOOLBAR_MIN_HEIGHT } from '../constants/layout';
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
    /** Space for mobile bottom nav + safe area */
    pb: { xs: 'calc(80px + env(safe-area-inset-bottom))', md: 3 },
    bgcolor: '#F4F6F9',
    minWidth: 0,
    maxWidth: '100%',
    overflowX: 'hidden' as const,
    ...(fullHeight
      ? {
          minHeight: {
            xs: `calc(100vh - ${APP_TOOLBAR_MIN_HEIGHT.xs}px)`,
            sm: `calc(100vh - ${APP_TOOLBAR_MIN_HEIGHT.sm}px)`,
          },
          overflow: 'auto' as const,
        }
      : {}),
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
    background: 'linear-gradient(135deg, #0A3559 0%, #0F4C81 55%, #0F766E 100%)',
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
    maxWidth: '100%',
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

const KPI_TONES: Record<KpiTone, { accent: string; soft: string; label: string }> = {
  blue: { accent: '#0F4C81', soft: '#EFF6FF', label: '#475569' },
  teal: { accent: '#0F766E', soft: '#F0FDFA', label: '#475569' },
  amber: { accent: '#B45309', soft: '#FFFBEB', label: '#475569' },
  rose: { accent: '#BE123C', soft: '#FFF1F2', label: '#475569' },
  violet: { accent: '#5B21B6', soft: '#F5F3FF', label: '#475569' },
  slate: { accent: '#334155', soft: '#F8FAFC', label: '#475569' },
};

/** Compact enterprise KPI tile — fits long currency without overflow. */
export function kpiCardSx(tone: KpiTone = 'blue') {
  const theme = KPI_TONES[tone];
  return {
    bgcolor: '#FFFFFF',
    backgroundImage: `linear-gradient(90deg, ${theme.soft} 0%, #FFFFFF 48%)`,
    border: '1px solid #E2E8F0',
    borderLeft: `3px solid ${theme.accent}`,
    borderRadius: 1.5,
    px: 1.5,
    py: 1.25,
    minHeight: 76,
    maxWidth: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 0.5,
    overflow: 'hidden',
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
    transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
    '&:hover': {
      boxShadow: '0 4px 12px rgba(15, 23, 42, 0.06)',
      borderColor: '#CBD5E1',
    },
  };
}

export function kpiLabelSx(tone: KpiTone = 'blue') {
  return {
    fontSize: '0.625rem',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    color: KPI_TONES[tone].label,
    lineHeight: 1.25,
    mb: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    maxWidth: '100%',
  };
}

export function kpiValueSx(tone: KpiTone = 'blue') {
  return {
    fontSize: '1.125rem',
    fontWeight: 700,
    lineHeight: 1.2,
    letterSpacing: '-0.02em',
    color: KPI_TONES[tone].accent,
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    fontVariantNumeric: 'tabular-nums',
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
