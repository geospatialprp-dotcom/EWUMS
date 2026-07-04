import { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import {
  pageEyebrowSx,
  pageHeaderSx,
  pageTitleSx,
  type PageAccent,
} from '../../utils/pagePresentationStyles';
import { responsiveHeaderStackSx } from '../../utils/responsiveStyles';

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
    <Box sx={[pageHeaderSx(accent), responsiveHeaderStackSx()]}>
      <Box display="flex" alignItems="flex-start" gap={{ xs: 1, sm: 1.5 }} flex={1} minWidth={0}>
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
        <Box
          display="flex"
          alignItems="center"
          gap={1}
          flexWrap="wrap"
          sx={{ width: { xs: '100%', sm: 'auto' }, justifyContent: { xs: 'flex-start', sm: 'flex-end' } }}
        >
          {actions}
        </Box>
      )}
    </Box>
  );
}
