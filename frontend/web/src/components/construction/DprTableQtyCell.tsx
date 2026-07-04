import { Typography } from '@mui/material';
import { formatProgressQty } from '../../utils/dprForm';

type Props = {
  value: number | null | undefined;
  /** Highlight balance / remaining */
  variant?: 'default' | 'balance' | 'today';
};

export default function DprTableQtyCell({ value, variant = 'default' }: Props) {
  if (value == null || !Number.isFinite(Number(value))) {
    return <Typography variant="body2" color="text.secondary" align="right">—</Typography>;
  }
  const color = variant === 'balance' ? 'warning.dark' : 'text.primary';
  const weight = variant === 'today' || variant === 'balance' ? 700 : 500;
  return (
    <Typography
      variant="body2"
      align="right"
      fontWeight={weight}
      fontFamily="monospace"
      color={color}
      sx={{ fontVariantNumeric: 'tabular-nums' }}
    >
      {formatProgressQty(Number(value))}
    </Typography>
  );
}
