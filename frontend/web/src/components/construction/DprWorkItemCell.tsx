import { Box, Typography } from '@mui/material';

type Props = {
  itemCode?: string | null;
  description: string;
};

export default function DprWorkItemCell({ itemCode, description }: Props) {
  const code = itemCode?.trim();
  const desc = description.trim() || '—';
  return (
    <Box sx={{ maxWidth: '100%', overflow: 'hidden' }}>
      {code && (
        <Typography variant="caption" color="primary.main" fontWeight={700} display="block">
          {code}
        </Typography>
      )}
      <Typography
        variant="body2"
        fontWeight={code ? 500 : 600}
        sx={{
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          lineHeight: 1.35,
        }}
        title={desc}
      >
        {desc}
      </Typography>
    </Box>
  );
}
