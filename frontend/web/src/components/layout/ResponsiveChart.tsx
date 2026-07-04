import { ReactNode } from 'react';
import { Box } from '@mui/material';
import { ResponsiveContainer } from 'recharts';
import { responsiveChartContainerSx } from '../../utils/responsiveStyles';

type ResponsiveChartProps = {
  height?: number;
  children: ReactNode;
};

export default function ResponsiveChart({ height = 240, children }: ResponsiveChartProps) {
  return (
    <Box sx={responsiveChartContainerSx(height)}>
      <ResponsiveContainer width="100%" height={height}>
        {children}
      </ResponsiveContainer>
    </Box>
  );
}
