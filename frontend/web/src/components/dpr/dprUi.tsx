export { default as BilingualRemarkField } from '../forms/BilingualRemarkField';
export { default as BilingualTextDisplay } from '../forms/BilingualTextDisplay';
import { ReactNode } from 'react';
import { Box, Chip, LinearProgress, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import { DPR_PLANNING_STAGES } from '../../constants/dprPlanningWorkflow';

export type DprPhase = 'intake' | 'review' | 'sanction';

const PHASE_COLORS: Record<DprPhase, { gradient: string; chip: string; bar: string; glow: string }> = {
  intake: {
    gradient: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 55%, #3b82f6 100%)',
    chip: '#dbeafe',
    bar: '#2563eb',
    glow: 'rgba(37, 99, 235, 0.35)',
  },
  review: {
    gradient: 'linear-gradient(135deg, #5b21b6 0%, #7c3aed 55%, #8b5cf6 100%)',
    chip: '#ede9fe',
    bar: '#7c3aed',
    glow: 'rgba(124, 58, 237, 0.35)',
  },
  sanction: {
    gradient: 'linear-gradient(135deg, #0f766e 0%, #0d9488 55%, #14b8a6 100%)',
    chip: '#ccfbf1',
    bar: '#0d9488',
    glow: 'rgba(13, 148, 136, 0.35)',
  },
};

export function getDprPhase(stage: number): DprPhase {
  if (stage <= 3) return 'intake';
  if (stage <= 7) return 'review';
  return 'sanction';
}

export const dprDialogPaperSx: SxProps<Theme> = {
  borderRadius: 3,
  overflow: 'hidden',
  border: '1px solid #e2e8f0',
  boxShadow: '0 24px 64px rgba(15, 23, 42, 0.18)',
};

export const dprDialogContentSx: SxProps<Theme> = {
  p: 2.5,
  bgcolor: '#f8fafc',
};

export const dprDialogActionsSx: SxProps<Theme> = {
  px: 2.5,
  py: 1.5,
  bgcolor: '#fff',
  borderTop: '1px solid #e2e8f0',
  gap: 1,
};

export function DprDialogHeader({
  stage,
  title,
  proposalNo,
  statusLabel,
  busy,
}: {
  stage: number;
  title: string;
  proposalNo?: string | null;
  statusLabel?: string | null;
  busy?: boolean;
}) {
  const phase = getDprPhase(stage);
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
          right: -40,
          top: -40,
          width: 140,
          height: 140,
          borderRadius: '50%',
          bgcolor: 'rgba(255,255,255,0.08)',
        },
      }}
    >
      <Box display="flex" alignItems="flex-start" justifyContent="space-between" gap={2} position="relative" zIndex={1}>
        <Box minWidth={0}>
          <Chip
            size="small"
            label={`Stage ${stage} of 10`}
            sx={{
              height: 22,
              fontWeight: 800,
              fontSize: '0.68rem',
              bgcolor: 'rgba(255,255,255,0.2)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.35)',
            }}
          />
          <Typography variant="h6" fontWeight={800} sx={{ mt: 0.75, lineHeight: 1.25, letterSpacing: '-0.02em' }}>
            {title}
          </Typography>
          {proposalNo && (
            <Typography variant="body2" sx={{ mt: 0.35, fontWeight: 600, color: 'rgba(248,250,252,0.9)' }}>
              {proposalNo}
            </Typography>
          )}
        </Box>
        {statusLabel && <DprStatusChip status={statusLabel} inverted />}
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

export function DprStatusChip({ status, inverted }: { status: string; inverted?: boolean }) {
  const lower = status.toLowerCase();
  let color: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info' = 'default';
  if (lower.includes('pending') || lower.includes('review') || lower.includes('prep')) color = 'warning';
  if (lower.includes('approv') || lower.includes('clear') || lower.includes('sanction') || lower.includes('publish')) color = 'success';
  if (lower.includes('return') || lower.includes('revision') || lower.includes('correction')) color = 'info';
  if (lower.includes('reject') || lower.includes('draft')) color = lower.includes('draft') ? 'default' : 'error';

  if (inverted) {
    return (
      <Chip
        size="small"
        label={status}
        sx={{
          fontWeight: 700,
          bgcolor: 'rgba(255,255,255,0.95)',
          color: '#0f172a',
          maxWidth: 160,
        }}
      />
    );
  }

  return <Chip size="small" color={color} label={status} variant="outlined" sx={{ fontWeight: 600 }} />;
}

export function DprStageProgress({ currentStage, maxStage = 10 }: { currentStage: number; maxStage?: number }) {
  const pct = Math.min(100, Math.max(0, (currentStage / maxStage) * 100));
  const phase = getDprPhase(currentStage);
  const bar = PHASE_COLORS[phase].bar;

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" mb={0.35}>
        <Typography variant="caption" color="text.secondary" fontWeight={600}>
          Stage {currentStage}/{maxStage}
        </Typography>
        <Typography variant="caption" sx={{ color: bar, fontWeight: 700 }}>
          {Math.round(pct)}%
        </Typography>
      </Box>
      <Box sx={{ height: 6, borderRadius: 999, bgcolor: '#e2e8f0', overflow: 'hidden' }}>
        <Box sx={{ width: `${pct}%`, height: '100%', borderRadius: 999, bgcolor: bar, transition: 'width 0.4s ease' }} />
      </Box>
    </Box>
  );
}

export function DprPipelineTracker({
  activeStage,
  compact,
}: {
  activeStage?: number;
  compact?: boolean;
}) {
  const stages = DPR_PLANNING_STAGES.filter((s) => s.stage <= 10);

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
      {stages.map((s) => {
        const phase = getDprPhase(s.stage);
        const colors = PHASE_COLORS[phase];
        const isActive = activeStage === s.stage;
        const isDone = activeStage != null && s.stage < activeStage;
        const shortName = s.name.split('(')[0].split('—')[0].trim();

        return (
          <Box
            key={s.key}
            sx={{
              flex: compact ? '0 0 88px' : '0 0 108px',
              p: compact ? 0.75 : 1,
              borderRadius: 2,
              border: '1px solid',
              borderColor: isActive ? colors.bar : isDone ? '#86efac' : '#e2e8f0',
              bgcolor: isActive ? colors.chip : isDone ? '#f0fdf4' : '#fff',
              boxShadow: isActive ? `0 4px 16px ${colors.glow}` : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            <Typography variant="caption" sx={{ color: isActive ? colors.bar : '#64748b', fontWeight: 800, fontSize: '0.62rem' }}>
              {s.stage}
            </Typography>
            <Typography
              variant="caption"
              display="block"
              sx={{
                color: '#0f172a',
                fontWeight: isActive ? 700 : 500,
                lineHeight: 1.25,
                mt: 0.25,
                fontSize: compact ? '0.62rem' : '0.68rem',
              }}
            >
              {shortName.length > 28 ? `${shortName.slice(0, 26)}…` : shortName}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

export function DprSectionCard({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Box
      sx={{
        borderRadius: 2.5,
        border: '1px solid #e2e8f0',
        bgcolor: '#fff',
        overflow: 'hidden',
        mb: 2,
      }}
    >
      <Box
        sx={{
          px: 1.75,
          py: 1.25,
          bgcolor: '#f1f5f9',
          borderBottom: '1px solid #e2e8f0',
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
