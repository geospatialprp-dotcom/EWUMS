import { useMediaQuery, useTheme } from '@mui/material';
import { BREAKPOINTS } from '../constants/layout';

export function useBreakpoint() {
  const theme = useTheme();

  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.between('md', 'lg'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  const isWideDesktop = useMediaQuery(`(min-width:${BREAKPOINTS.xxl}px)`);
  const isPortrait = useMediaQuery('(orientation: portrait)');

  return {
    isMobile,
    isTablet,
    isDesktop,
    isWideDesktop,
    isPortrait,
    /** Phone — below 480px */
    isPhone: useMediaQuery(theme.breakpoints.down('sm')),
  };
}
