import { ReactNode } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { pageShellSx } from '../../utils/pagePresentationStyles';
import AppBreadcrumbs from './AppBreadcrumbs';

interface PageShellProps {
  children?: ReactNode;
  fullHeight?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  /** Hide route breadcrumbs (e.g. immersive map). */
  hideBreadcrumbs?: boolean;
}

export default function PageShell({
  children,
  fullHeight,
  loading,
  loadingLabel,
  hideBreadcrumbs,
}: PageShellProps) {
  if (loading) {
    return (
      <Box sx={{ ...pageShellSx(fullHeight), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        <CircularProgress size={36} />
        {loadingLabel && <Typography color="text.secondary">{loadingLabel}</Typography>}
      </Box>
    );
  }

  return (
    <Box sx={pageShellSx(fullHeight)}>
      {!hideBreadcrumbs && <AppBreadcrumbs />}
      {children}
    </Box>
  );
}
