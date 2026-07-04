import { Box, LinearProgress, Typography } from '@mui/material';
import { formatProgressQty, pctFromQty } from '../../utils/dprForm';

type Props = {
  plannedQty: number | null;
  cumQty: number;
  cumPct?: number | null;
};

export default function DprBoqProgressCell({ plannedQty, cumQty, cumPct }: Props) {
  if (plannedQty == null || plannedQty <= 0) {
    return <Typography variant="body2" color="text.secondary" align="right">—</Typography>;
  }
  const pct = cumPct != null && Number.isFinite(cumPct)
    ? Math.min(100, Number(cumPct))
    : pctFromQty(cumQty, plannedQty);

  return (
    <Box sx={{ minWidth: 0, maxWidth: '100%' }}>
      <Typography
        variant="body2"
        align="right"
        fontWeight={600}
        fontFamily="monospace"
        sx={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {formatProgressQty(pct)}%
      </Typography>
      <LinearProgress
        variant="determinate"
        value={Math.min(100, pct)}
        sx={{
          mt: 0.5,
          height: 5,
          borderRadius: 1,
          bgcolor: 'grey.200',
          '& .MuiLinearProgress-bar': { borderRadius: 1 },
        }}
      />
    </Box>
  );
}
