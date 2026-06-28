import { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import {
  pageEyebrowSx,
  pageHeaderSx,
  pageTitleSx,
  type PageAccent,
} from '../../utils/pagePresentationStyles';

interface PageHeaderProps {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  accent?: PageAccent;
  actions?: ReactNode;
  leading?: ReactNode;
}

export default function PageHeader({
  title,
  eyebrow,
  subtitle,
  accent = 'blue',
  actions,
  leading,
}: PageHeaderProps) {
  return (
    <Box display="flex" justifyContent="space-between" alignItems="center" gap={2} flexWrap="wrap" sx={pageHeaderSx(accent)}>
      <Box display="flex" alignItems="flex-start" gap={1.5} flex={1} minWidth={0}>
        {leading}
        <Box minWidth={0}>
          {eyebrow && (
            <Typography variant="overline" sx={pageEyebrowSx(accent)}>
              {eyebrow}
            </Typography>
          )}
          <Typography variant="h5" sx={pageTitleSx(accent)}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" mt={0.25}>
              {subtitle}
            </Typography>
          )}
        </Box>
      </Box>
      {actions && (
        <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
          {actions}
        </Box>
      )}
    </Box>
  );
}
