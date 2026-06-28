import { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import { kpiCardSx, kpiLabelSx, kpiValueSx, type KpiTone } from '../../utils/pagePresentationStyles';

interface KpiStatCardProps {
  label: string;
  value: ReactNode;
  tone?: KpiTone;
  footer?: ReactNode;
  icon?: ReactNode;
}

export default function KpiStatCard({ label, value, tone = 'blue', footer, icon }: KpiStatCardProps) {
  return (
    <Box sx={kpiCardSx(tone)}>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap={1}>
        <Typography sx={kpiLabelSx(tone)}>{label}</Typography>
        {icon}
      </Box>
      <Typography sx={kpiValueSx(tone)}>{value}</Typography>
      {footer}
    </Box>
  );
}
