import { ReactNode } from 'react';
import { Box, Tooltip, Typography } from '@mui/material';
import { kpiCardSx, kpiLabelSx, kpiValueSx, type KpiTone } from '../../utils/pagePresentationStyles';

interface KpiStatCardProps {
  label: string;
  value: ReactNode;
  tone?: KpiTone;
  /** @deprecated Use `tone` — kept for older call sites. */
  accent?: string;
  footer?: ReactNode;
  icon?: ReactNode;
  /** Optional full value for tooltip when display is compacted. */
  title?: string;
}

const ACCENT_TO_TONE: Record<string, KpiTone> = {
  sky: 'blue',
  blue: 'blue',
  emerald: 'teal',
  teal: 'teal',
  amber: 'amber',
  rose: 'rose',
  violet: 'violet',
  slate: 'slate',
};

function resolveTone(tone?: KpiTone, accent?: string): KpiTone {
  if (tone) return tone;
  if (accent && ACCENT_TO_TONE[accent]) return ACCENT_TO_TONE[accent];
  return 'blue';
}

function valueLength(value: ReactNode): number {
  if (typeof value === 'number' || typeof value === 'bigint') return String(value).length;
  if (typeof value === 'string') return value.length;
  return 0;
}

/** Scale down long currency / numeric strings so they stay inside the tile. */
function valueFontSize(value: ReactNode): string {
  const len = valueLength(value);
  if (len >= 14) return '0.875rem';
  if (len >= 10) return '1rem';
  return '1.125rem';
}

export default function KpiStatCard({
  label,
  value,
  tone,
  accent,
  footer,
  icon,
  title,
}: KpiStatCardProps) {
  const resolvedTone = resolveTone(tone, accent);
  const tip = title ?? (typeof value === 'string' || typeof value === 'number' ? String(value) : undefined);
  const valueNode = (
    <Typography
      component="div"
      sx={{
        ...kpiValueSx(resolvedTone),
        fontSize: valueFontSize(value),
      }}
      title={tip}
    >
      {value}
    </Typography>
  );

  return (
    <Box sx={kpiCardSx(resolvedTone)}>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap={0.75} minWidth={0}>
        <Typography sx={{ ...kpiLabelSx(resolvedTone), flex: 1, minWidth: 0 }} title={label}>
          {label}
        </Typography>
        {icon ? (
          <Box sx={{ flexShrink: 0, opacity: 0.7, display: 'flex', '& .MuiSvgIcon-root': { fontSize: 18 } }}>
            {icon}
          </Box>
        ) : null}
      </Box>
      {tip && valueLength(value) >= 10 ? (
        <Tooltip title={tip} arrow enterTouchDelay={0}>
          <Box minWidth={0}>{valueNode}</Box>
        </Tooltip>
      ) : (
        valueNode
      )}
      {footer ? <Box sx={{ mt: 0.5, minWidth: 0 }}>{footer}</Box> : null}
    </Box>
  );
}
