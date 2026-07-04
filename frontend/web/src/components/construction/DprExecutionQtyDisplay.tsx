import { Box, Typography } from '@mui/material';
import { formatProgressQty, type DprActivityBilling } from '../../utils/dprForm';

type Props = {
  billing: DprActivityBilling;
  variant: 'today' | 'cumulative';
  showPct?: boolean;
  /** List table shows unit in its own column */
  showUnit?: boolean;
};

export default function DprExecutionQtyDisplay({
  billing, variant, showPct = false, showUnit = true,
}: Props) {
  const qty = variant === 'today' ? billing.todayQty : billing.cumQty;
  const pct = variant === 'today' ? billing.todayPct : billing.cumPct;

  if (!billing.unit || billing.unit === '—') {
    return <Typography variant="body2" color="text.secondary">—</Typography>;
  }

  return (
    <Box textAlign="right">
      <Typography variant="body2" fontWeight={700} fontFamily="monospace" sx={{ fontVariantNumeric: 'tabular-nums' }}>
        {formatProgressQty(qty)}
      </Typography>
      {showUnit && (
        <Typography variant="caption" color="text.secondary" fontWeight={600}>
          {billing.unit}
        </Typography>
      )}
      {showPct && pct != null && Number.isFinite(pct) && (
        <Typography variant="caption" color="text.disabled" display="block" sx={{ fontSize: '0.65rem' }}>
          {formatProgressQty(pct)}% BOQ
        </Typography>
      )}
    </Box>
  );
}
