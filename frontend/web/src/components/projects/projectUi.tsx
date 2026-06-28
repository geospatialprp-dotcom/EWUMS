import { ReactNode } from 'react';
import { Box, Chip, LinearProgress, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';

export const PROJECT_LIFECYCLE = [
  { key: 'dpr', step: 1, label: 'DPR Approval', short: 'DPR' },
  { key: 'tender', step: 2, label: 'Tender Published', short: 'Tender' },
  { key: 'setup', step: 3, label: 'Project Setup', short: 'Setup' },
  { key: 'gis', step: 4, label: 'GIS Mapping', short: 'GIS' },
  { key: 'construction', step: 5, label: 'Construction', short: 'Construction' },
  { key: 'milestones', step: 6, label: 'Milestones', short: 'Milestones' },
  { key: 'handover', step: 7, label: 'O&M Handover', short: 'Handover' },
] as const;

export type ProjectPhase = 'planning' | 'execution' | 'delivery';

const PHASE_COLORS: Record<ProjectPhase, { gradient: string; chip: string; bar: string; glow: string }> = {
  planning: {
    gradient: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 55%, #3b82f6 100%)',
    chip: '#dbeafe',
    bar: '#2563eb',
    glow: 'rgba(37, 99, 235, 0.35)',
  },
  execution: {
    gradient: 'linear-gradient(135deg, #0f172a 0%, #1e40af 55%, #3b82f6 100%)',
    chip: '#e0e7ff',
    bar: '#1e40af',
    glow: 'rgba(30, 64, 175, 0.35)',
  },
  delivery: {
    gradient: 'linear-gradient(135deg, #0f766e 0%, #0d9488 55%, #14b8a6 100%)',
    chip: '#ccfbf1',
    bar: '#0d9488',
    glow: 'rgba(13, 148, 136, 0.35)',
  },
};

export function getProjectPhase(step: number): ProjectPhase {
  if (step <= 2) return 'planning';
  if (step <= 5) return 'execution';
  return 'delivery';
}

export const projectDialogPaperSx: SxProps<Theme> = {
  borderRadius: 3,
  overflow: 'hidden',
  border: '1px solid #e2e8f0',
  boxShadow: '0 24px 64px rgba(15, 23, 42, 0.18)',
};

export const projectDialogContentSx: SxProps<Theme> = {
  p: 2.5,
  bgcolor: '#f8fafc',
};

export const projectDialogActionsSx: SxProps<Theme> = {
  px: 2.5,
  py: 1.5,
  bgcolor: '#fff',
  borderTop: '1px solid #e2e8f0',
  gap: 1,
};

export const projectToolbarSx: SxProps<Theme> = {
  mb: 2.5,
  p: 2,
  borderRadius: 3,
  bgcolor: '#fff',
  border: '1px solid #e2e8f0',
  boxShadow: '0 2px 12px rgba(15, 23, 42, 0.04)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 2,
  flexWrap: 'wrap',
};

export function ProjectDialogHeader({
  title,
  subtitle,
  badge,
  phase = 'execution',
  busy,
}: {
  title: string;
  subtitle?: string | null;
  badge?: string | null;
  phase?: ProjectPhase;
  busy?: boolean;
}) {
  const colors = PHASE_COLORS[phase];

  return (
    <Box sx={{ px: 2.5, py: 2, background: colors.gradient, color: '#fff', position: 'relative', overflow: 'hidden' }}>
      <Box display="flex" alignItems="flex-start" justifyContent="space-between" gap={2} position="relative" zIndex={1}>
        <Box minWidth={0}>
          <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.25, letterSpacing: '-0.02em' }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" sx={{ mt: 0.35, fontWeight: 600, color: 'rgba(248,250,252,0.9)' }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {badge && (
          <Chip size="small" label={badge} sx={{ fontWeight: 700, bgcolor: 'rgba(255,255,255,0.95)', color: '#0f172a' }} />
        )}
      </Box>
      {busy && (
        <LinearProgress sx={{ mt: 1.5, borderRadius: 999, bgcolor: 'rgba(255,255,255,0.2)', '& .MuiLinearProgress-bar': { bgcolor: '#fff' } }} />
      )}
    </Box>
  );
}

export function ProjectLifecycleTracker({
  activeStep,
  onStepSelect,
  compact,
}: {
  activeStep?: number;
  onStepSelect?: (step: number) => void;
  compact?: boolean;
}) {
  return (
    <Box sx={{ display: 'flex', gap: compact ? 0.5 : 0.75, overflowX: 'auto', pb: 0.5 }}>
      {PROJECT_LIFECYCLE.map((m) => {
        const phase = getProjectPhase(m.step);
        const colors = PHASE_COLORS[phase];
        const isActive = activeStep === m.step;

        return (
          <Box
            key={m.key}
            onClick={onStepSelect ? () => onStepSelect(m.step) : undefined}
            role={onStepSelect ? 'button' : undefined}
            tabIndex={onStepSelect ? 0 : undefined}
            sx={{
              flex: compact ? '0 0 88px' : '0 0 104px',
              p: compact ? 0.75 : 1,
              borderRadius: 2,
              border: '1px solid',
              borderColor: isActive ? colors.bar : 'rgba(255,255,255,0.25)',
              bgcolor: isActive ? colors.chip : 'rgba(255,255,255,0.12)',
              boxShadow: isActive ? `0 4px 16px ${colors.glow}` : 'none',
              cursor: onStepSelect ? 'pointer' : 'default',
              transition: 'all 0.2s ease',
              '&:hover': onStepSelect ? { bgcolor: isActive ? colors.chip : 'rgba(255,255,255,0.22)' } : undefined,
            }}
          >
            <Typography variant="caption" sx={{ color: isActive ? colors.bar : 'rgba(248,250,252,0.85)', fontWeight: 800, fontSize: '0.62rem' }}>
              {m.step}
            </Typography>
            <Typography
              variant="caption"
              display="block"
              sx={{
                color: isActive ? '#0f172a' : '#f8fafc',
                fontWeight: isActive ? 700 : 500,
                lineHeight: 1.25,
                mt: 0.25,
                fontSize: compact ? '0.6rem' : '0.66rem',
              }}
            >
              {m.short}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

export function ProjectSectionCard({
  title,
  phase = 'execution',
  children,
  action,
}: {
  title: string;
  phase?: ProjectPhase;
  children: ReactNode;
  action?: ReactNode;
}) {
  const colors = PHASE_COLORS[phase];

  return (
    <Box
      sx={{
        borderRadius: 3,
        border: '1px solid #e2e8f0',
        bgcolor: '#fff',
        overflow: 'hidden',
        boxShadow: '0 2px 12px rgba(15, 23, 42, 0.04)',
      }}
    >
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        px={2}
        py={1.25}
        sx={{ borderBottom: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}
      >
        <Box display="flex" alignItems="center" gap={1}>
          <Box sx={{ width: 4, height: 20, borderRadius: 999, bgcolor: colors.bar }} />
          <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#0f172a', letterSpacing: '-0.01em' }}>
            {title}
          </Typography>
        </Box>
        {action}
      </Box>
      <Box p={2}>{children}</Box>
    </Box>
  );
}

export function ProjectChipRow({ children }: { children: ReactNode }) {
  return (
    <Box display="flex" flexWrap="wrap" gap={0.75}>
      {children}
    </Box>
  );
}

export function ProjectKpiGroupLabel({ children }: { children: ReactNode }) {
  return (
    <Typography
      variant="overline"
      sx={{ display: 'block', fontWeight: 800, letterSpacing: '0.12em', color: '#64748b', mb: -0.5 }}
    >
      {children}
    </Typography>
  );
}

export function ProjectEmptyState({
  title,
  detail,
  children,
}: {
  title: string;
  detail?: string;
  children?: ReactNode;
}) {
  return (
    <Box
      sx={{
        py: 5,
        px: 3,
        textAlign: 'center',
        borderRadius: 3,
        border: '1px dashed #cbd5e1',
        bgcolor: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)',
        background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)',
      }}
    >
      <Typography color="text.secondary" fontWeight={700} gutterBottom sx={{ fontSize: '1.05rem' }}>
        {title}
      </Typography>
      {detail && (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 560, mx: 'auto', mb: 2 }}>
          {detail}
        </Typography>
      )}
      {children}
    </Box>
  );
}
