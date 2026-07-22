import { Chip, ChipProps } from '@mui/material';

export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'error' | 'primary';

const TONE_SX: Record<StatusTone, { bgcolor: string; color: string; borderColor: string }> = {
  neutral: { bgcolor: '#F1F5F9', color: '#334155', borderColor: '#E2E8F0' },
  info: { bgcolor: '#E0F2FE', color: '#075985', borderColor: '#BAE6FD' },
  success: { bgcolor: '#D1FAE5', color: '#065F46', borderColor: '#A7F3D0' },
  warning: { bgcolor: '#FEF3C7', color: '#92400E', borderColor: '#FDE68A' },
  error: { bgcolor: '#FEE2E2', color: '#991B1B', borderColor: '#FECACA' },
  primary: { bgcolor: '#E8F1F8', color: '#0F4C81', borderColor: '#B6D0E8' },
};

interface StatusBadgeProps extends Omit<ChipProps, 'color'> {
  tone?: StatusTone;
}

/** Reusable status badge for dashboards, tables, and mobile cards. */
export default function StatusBadge({ tone = 'neutral', sx, ...rest }: StatusBadgeProps) {
  const palette = TONE_SX[tone];
  return (
    <Chip
      size="small"
      variant="outlined"
      {...rest}
      sx={{
        height: 24,
        fontWeight: 700,
        fontSize: '0.6875rem',
        letterSpacing: '0.02em',
        borderRadius: 1.25,
        bgcolor: palette.bgcolor,
        color: palette.color,
        borderColor: palette.borderColor,
        ...sx,
      }}
    />
  );
}
