import { ReactNode } from 'react';
import { Box, Stack, useMediaQuery, useTheme } from '@mui/material';
import { responsiveTableScrollSx } from '../../utils/responsiveStyles';

type ResponsiveDataViewProps = {
  table: ReactNode;
  mobileCards: ReactNode;
  /** Show cards below this breakpoint (default md = 768px). Use lg for tablet card layout. */
  mobileBelow?: 'md' | 'lg';
};

export default function ResponsiveDataView({
  table,
  mobileCards,
  mobileBelow = 'md',
}: ResponsiveDataViewProps) {
  const theme = useTheme();
  const showCards = useMediaQuery(
    mobileBelow === 'lg' ? theme.breakpoints.down('lg') : theme.breakpoints.down('md'),
  );

  if (showCards) {
    return (
      <Stack spacing={1.25} sx={{ px: { xs: 1, sm: 1.5 }, py: 1.5 }}>
        {mobileCards}
      </Stack>
    );
  }

  return (
    <Box sx={responsiveTableScrollSx()}>
      {table}
    </Box>
  );
}
