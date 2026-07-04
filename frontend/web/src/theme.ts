import { createTheme } from '@mui/material/styles';
import { BREAKPOINTS, TOUCH_TARGET_MIN } from './constants/layout';

const downSm = `@media (max-width:${BREAKPOINTS.sm - 1}px)`;

export const theme = createTheme({
  breakpoints: {
    values: {
      xs: BREAKPOINTS.xs,
      sm: BREAKPOINTS.sm,
      md: BREAKPOINTS.md,
      lg: BREAKPOINTS.lg,
      xl: BREAKPOINTS.xl,
    },
  },
  palette: {
    primary: { main: '#1565C0', dark: '#0D47A1', light: '#42A5F5' },
    secondary: { main: '#00897B', dark: '#00695C', light: '#4DB6AC' },
    error: { main: '#C62828' },
    warning: { main: '#F57F17' },
    background: { default: '#F5F7FA', paper: '#FFFFFF' },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    htmlFontSize: 16,
    h4: { fontWeight: 600, fontSize: '1.75rem', [downSm]: { fontSize: '1.375rem' } },
    h5: { fontWeight: 600, fontSize: '1.5rem', [downSm]: { fontSize: '1.25rem' } },
    h6: { fontWeight: 600, fontSize: '1.125rem', [downSm]: { fontSize: '1rem' } },
    body1: { fontSize: '0.9375rem', [downSm]: { fontSize: '0.875rem' } },
    body2: { fontSize: '0.8125rem' },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: ({ theme }) => ({
          textTransform: 'none',
          fontWeight: 600,
          minHeight: TOUCH_TARGET_MIN,
          [theme.breakpoints.down('sm')]: { fontSize: '0.875rem' },
        }),
        sizeSmall: ({ theme }) => ({
          minHeight: 40,
          [theme.breakpoints.down('sm')]: { padding: '8px 14px' },
        }),
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: ({ theme }) => ({
          minWidth: TOUCH_TARGET_MIN,
          minHeight: TOUCH_TARGET_MIN,
          [theme.breakpoints.down('md')]: { padding: 10 },
        }),
        sizeSmall: { padding: 8, minWidth: 40, minHeight: 40 },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: { minHeight: TOUCH_TARGET_MIN },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: ({ theme }) => ({
          minHeight: TOUCH_TARGET_MIN,
          fontSize: '0.8125rem',
          [theme.breakpoints.down('sm')]: { minWidth: 'auto', px: 1.25 },
        }),
      },
    },
    MuiTabs: {
      defaultProps: {
        variant: 'scrollable',
        allowScrollButtonsMobile: true,
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: { boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: ({ theme }) => ({
          margin: 12,
          width: 'calc(100% - 24px)',
          maxHeight: 'calc(100% - 24px)',
          [theme.breakpoints.up('sm')]: {
            margin: 24,
            width: 'calc(100% - 48px)',
          },
        }),
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        html: { overflowX: 'hidden' },
        body: { overflowX: 'hidden', WebkitTextSizeAdjust: '100%' },
        '#root': { minHeight: '100vh', minWidth: 0 },
        img: { maxWidth: '100%', height: 'auto' },
      },
    },
  },
});
