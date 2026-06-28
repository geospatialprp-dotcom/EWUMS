import { ReactNode } from 'react';
import { Box, Chip, LinearProgress, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import { OM_WORKFLOW_STAGES } from '../../constants/omWorkflow';

export type OmPhase = 'foundation' | 'operations' | 'service' | 'insights';

const PHASE_COLORS: Record<OmPhase, { gradient: string; chip: string; bar: string; glow: string }> = {
  foundation: {
    gradient: 'linear-gradient(135deg, #0f766e 0%, #0d9488 55%, #14b8a6 100%)',
    chip: '#ccfbf1',
    bar: '#0d9488',
    glow: 'rgba(13, 148, 136, 0.35)',
  },
  operations: {
    gradient: 'linear-gradient(135deg, #0369a1 0%, #0284c7 55%, #38bdf8 100%)',
    chip: '#e0f2fe',
    bar: '#0284c7',
    glow: 'rgba(2, 132, 199, 0.35)',
  },
  service: {
    gradient: 'linear-gradient(135deg, #5b21b6 0%, #7c3aed 55%, #a78bfa 100%)',
    chip: '#ede9fe',
    bar: '#7c3aed',
    glow: 'rgba(124, 58, 237, 0.35)',
  },
  insights: {
    gradient: 'linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #334155 100%)',
    chip: '#f1f5f9',
    bar: '#475569',
    glow: 'rgba(71, 85, 105, 0.35)',
  },
};

export function getOmPhase(stage: number): OmPhase {
  if (stage <= 2) return 'foundation';
  if (stage <= 8) return 'operations';
  if (stage <= 12) return 'service';
  return 'insights';
}

export const omDialogPaperSx: SxProps<Theme> = {
  borderRadius: 3,
  overflow: 'hidden',
  border: '1px solid #e2e8f0',
  boxShadow: '0 24px 64px rgba(15, 23, 42, 0.18)',
};

export const omDialogContentSx: SxProps<Theme> = {
  p: 2.5,
  bgcolor: '#f8fafc',
};

export const omDialogActionsSx: SxProps<Theme> = {
  px: 2.5,
  py: 1.5,
  bgcolor: '#fff',
  borderTop: '1px solid #e2e8f0',
  gap: 1,
};

export const omTabsSx: SxProps<Theme> = {
  minHeight: 48,
  '& .MuiTab-root': {
    minHeight: 48,
    fontWeight: 600,
    fontSize: '0.78rem',
    textTransform: 'none',
    borderRadius: '10px 10px 0 0',
    mx: 0.25,
    color: '#64748b',
    '&.Mui-selected': { color: '#0f766e', fontWeight: 800 },
  },
  '& .MuiTabs-indicator': {
    height: 3,
    borderRadius: '3px 3px 0 0',
    bgcolor: '#0d9488',
  },
};

export function OmDialogHeader({
  stage,
  title,
  subtitle,
  badge,
  busy,
}: {
  stage?: number;
  title: string;
  subtitle?: string | null;
  badge?: string | null;
  busy?: boolean;
}) {
  const phase = stage != null ? getOmPhase(stage) : 'foundation';
  const colors = PHASE_COLORS[phase];

  return (
    <Box
      sx={{
        px: 2.5,
        py: 2,
        background: colors.gradient,
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
        '&::after': {
          content: '""',
          position: 'absolute',
          right: -48,
          top: -48,
          width: 160,
          height: 160,
          borderRadius: '50%',
          bgcolor: 'rgba(255,255,255,0.07)',
        },
      }}
    >
      <Box display="flex" alignItems="flex-start" justifyContent="space-between" gap={2} position="relative" zIndex={1}>
        <Box minWidth={0}>
          {stage != null && (
            <Chip
              size="small"
              label={`Stage ${stage} of 15`}
              sx={{
                height: 22,
                fontWeight: 800,
                fontSize: '0.68rem',
                bgcolor: 'rgba(255,255,255,0.2)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.35)',
              }}
            />
          )}
          <Typography variant="h6" fontWeight={800} sx={{ mt: stage != null ? 0.75 : 0, lineHeight: 1.25, letterSpacing: '-0.02em' }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" sx={{ mt: 0.35, fontWeight: 600, color: 'rgba(248,250,252,0.9)' }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {badge && (
          <Chip
            size="small"
            label={badge}
            sx={{ fontWeight: 700, bgcolor: 'rgba(255,255,255,0.95)', color: '#0f172a', maxWidth: 180 }}
          />
        )}
      </Box>
      {busy && (
        <LinearProgress
          sx={{
            mt: 1.5,
            borderRadius: 999,
            bgcolor: 'rgba(255,255,255,0.2)',
            '& .MuiLinearProgress-bar': { bgcolor: '#fff' },
          }}
        />
      )}
    </Box>
  );
}

export function OmStatusChip({ status }: { status: string }) {
  const lower = status.toLowerCase();
  let color: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info' = 'default';
  if (lower.includes('open') || lower.includes('pending') || lower.includes('due') || lower.includes('overdue')) color = 'warning';
  if (lower.includes('closed') || lower.includes('complete') || lower.includes('verified') || lower.includes('compliant')) color = 'success';
  if (lower.includes('critical') || lower.includes('alert') || lower.includes('fail')) color = 'error';
  if (lower.includes('progress') || lower.includes('active')) color = 'info';
  if (lower.includes('draft')) color = 'default';

  return <Chip size="small" color={color} label={status} variant="outlined" sx={{ fontWeight: 600 }} />;
}

export function OmPipelineTracker({
  activeStage,
  onStageSelect,
  compact,
}: {
  activeStage?: number;
  onStageSelect?: (stage: number) => void;
  compact?: boolean;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        gap: compact ? 0.5 : 0.75,
        overflowX: 'auto',
        pb: 0.5,
        '&::-webkit-scrollbar': { height: 6 },
        '&::-webkit-scrollbar-thumb': { bgcolor: '#cbd5e1', borderRadius: 999 },
      }}
    >
      {OM_WORKFLOW_STAGES.map((s) => {
        const phase = getOmPhase(s.stage);
        const colors = PHASE_COLORS[phase];
        const isActive = activeStage === s.stage;
        const isDone = activeStage != null && s.stage < activeStage;
        const shortName = s.name.split('(')[0].split('—')[0].trim();

        return (
          <Box
            key={s.key}
            onClick={onStageSelect ? () => onStageSelect(s.stage) : undefined}
            role={onStageSelect ? 'button' : undefined}
            tabIndex={onStageSelect ? 0 : undefined}
            onKeyDown={onStageSelect ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onStageSelect(s.stage);
              }
            } : undefined}
            sx={{
              flex: compact ? '0 0 84px' : '0 0 100px',
              p: compact ? 0.75 : 1,
              borderRadius: 2,
              border: '1px solid',
              borderColor: isActive ? colors.bar : isDone ? '#86efac' : 'rgba(255,255,255,0.25)',
              bgcolor: isActive ? colors.chip : isDone ? 'rgba(240,253,244,0.95)' : 'rgba(255,255,255,0.12)',
              boxShadow: isActive ? `0 4px 16px ${colors.glow}` : 'none',
              transition: 'all 0.2s ease',
              cursor: onStageSelect ? 'pointer' : 'default',
              '&:hover': onStageSelect ? { bgcolor: isActive ? colors.chip : 'rgba(255,255,255,0.22)' } : undefined,
            }}
          >
            <Typography
              variant="caption"
              sx={{
                color: isActive ? colors.bar : isDone ? '#15803d' : 'rgba(248,250,252,0.85)',
                fontWeight: 800,
                fontSize: '0.62rem',
              }}
            >
              {s.stage}
            </Typography>
            <Typography
              variant="caption"
              display="block"
              sx={{
                color: isActive ? '#0f172a' : isDone ? '#14532d' : '#f8fafc',
                fontWeight: isActive ? 700 : 500,
                lineHeight: 1.25,
                mt: 0.25,
                fontSize: compact ? '0.6rem' : '0.66rem',
              }}
            >
              {shortName.length > 24 ? `${shortName.slice(0, 22)}…` : shortName}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

export function OmSectionCard({
  title,
  children,
  action,
  accent,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  accent?: OmPhase;
}) {
  const bar = accent ? PHASE_COLORS[accent].bar : '#0d9488';

  return (
    <Box
      sx={{
        borderRadius: 2.5,
        border: '1px solid #e2e8f0',
        bgcolor: '#fff',
        overflow: 'hidden',
        mb: 2,
        boxShadow: '0 2px 12px rgba(15, 23, 42, 0.04)',
      }}
    >
      <Box
        sx={{
          px: 1.75,
          py: 1.25,
          bgcolor: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          borderLeft: `4px solid ${bar}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <Typography variant="subtitle2" fontWeight={700} color="#0f172a">
          {title}
        </Typography>
        {action}
      </Box>
      <Box sx={{ p: 1.75 }}>{children}</Box>
    </Box>
  );
}

export function OmKpiGroupLabel({ children }: { children: ReactNode }) {
  return (
    <Typography
      variant="caption"
      color="text.secondary"
      fontWeight={700}
      sx={{ letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', mt: 0.5 }}
    >
      {children}
    </Typography>
  );
}

export function OmInfoTile({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 2,
        bgcolor: '#f8fafc',
        border: '1px solid #e2e8f0',
        height: '100%',
        transition: 'box-shadow 0.2s ease',
        '&:hover': { boxShadow: '0 4px 16px rgba(15, 23, 42, 0.06)' },
      }}
    >
      <Typography variant="caption" fontWeight={700} display="block" mb={0.5} color="#0f172a">
        {title}
      </Typography>
      {children}
    </Box>
  );
}

export function OmChipRow({ children }: { children: ReactNode }) {
  return (
    <Box display="flex" gap={0.75} flexWrap="wrap">
      {children}
    </Box>
  );
}
