import { Box, Chip, Tooltip, Typography } from '@mui/material';

type Props = {
  itemCode?: string | null;
  description: string;
  /** Additional MB/DPR line items beyond the first (shown as "+N more"). */
  extraLineCount?: number;
  /** Max description lines before ellipsis (default 2). */
  lineClamp?: number;
};

export default function DprWorkItemCell({
  itemCode,
  description,
  extraLineCount = 0,
  lineClamp = 2,
}: Props) {
  const code = itemCode?.trim();
  const desc = description.trim() || '—';
  const tooltip = extraLineCount > 0 ? `${desc}\n(+${extraLineCount} more line item${extraLineCount > 1 ? 's' : ''})` : desc;

  return (
    <Tooltip
      title={tooltip}
      placement="top-start"
      enterDelay={500}
      slotProps={{
        tooltip: {
          sx: { maxWidth: 360, whiteSpace: 'pre-wrap', fontSize: '0.75rem', lineHeight: 1.4 },
        },
      }}
    >
      <Box sx={{ maxWidth: '100%', overflow: 'hidden', cursor: 'help' }}>
        {code && (
          <Typography variant="caption" color="primary.main" fontWeight={700} display="block" noWrap>
            {code}
          </Typography>
        )}
        <Typography
          variant="body2"
          fontWeight={code ? 500 : 600}
          sx={{
            display: '-webkit-box',
            WebkitLineClamp: lineClamp,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            lineHeight: 1.35,
            wordBreak: 'break-word',
          }}
        >
          {desc}
        </Typography>
        {extraLineCount > 0 && (
          <Chip
            size="small"
            label={`+${extraLineCount} more`}
            variant="outlined"
            sx={{ mt: 0.35, height: 18, fontSize: '0.65rem', maxWidth: '100%' }}
          />
        )}
      </Box>
    </Tooltip>
  );
}
