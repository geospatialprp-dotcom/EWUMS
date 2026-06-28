import { Box, Typography } from '@mui/material';
import { parseBilingualText } from '../../utils/bilingualText';

type Props = {
  text?: string | null;
  variant?: 'body2' | 'caption' | 'body1';
};

export default function BilingualTextDisplay({ text, variant = 'body2' }: Props) {
  const { en, hi } = parseBilingualText(text ?? '');
  if (!en && !hi) {
    return <Typography variant={variant}>—</Typography>;
  }
  return (
    <Box>
      {en && (
        <Typography variant={variant} sx={{ whiteSpace: 'pre-wrap' }}>
          {en}
        </Typography>
      )}
      {hi && (
        <>
          {en && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              हिंदी
            </Typography>
          )}
          <Typography variant={variant} sx={{ whiteSpace: 'pre-wrap' }}>
            {hi}
          </Typography>
        </>
      )}
    </Box>
  );
}
