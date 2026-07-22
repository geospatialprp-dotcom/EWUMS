import { createTheme, alpha } from '@mui/material/styles';
import { BREAKPOINTS, TOUCH_TARGET_MIN } from './constants/layout';

const downSm = `@media (max-width:${BREAKPOINTS.sm - 1}px)`;

/** Premium enterprise palette — restrained slate + teal for water utilities. */
const PRIMARY = {
  main: '#0F4C81',
  dark: '#0A3559',
  light: '#3B7CB0',
  contrastText: '#FFFFFF',
};

const SECONDARY = {
  main: '#0F766E',
  dark: '#115E59',
  light: '#14B8A6',
  contrastText: '#FFFFFF',
};

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
    mode: 'light',
    primary: PRIMARY,
    secondary: SECONDARY,
    error: { main: '#B91C1C', light: '#FEE2E2', dark: '#7F1D1D' },
    warning: { main: '#B45309', light: '#FEF3C7', dark: '#78350F' },
    success: { main: '#047857', light: '#D1FAE5', dark: '#064E3B' },
    info: { main: '#0369A1', light: '#E0F2FE', dark: '#0C4A6E' },
    background: { default: '#F4F6F9', paper: '#FFFFFF' },
    text: { primary: '#0F172A', secondary: '#475569', disabled: '#94A3B8' },
    divider: '#E2E8F0',
    grey: {
      50: '#F8FAFC',
      100: '#F1F5F9',
      200: '#E2E8F0',
      300: '#CBD5E1',
      400: '#94A3B8',
      500: '#64748B',
      600: '#475569',
      700: '#334155',
      800: '#1E293B',
      900: '#0F172A',
    },
  },
  typography: {
    fontFamily:
      '"IBM Plex Sans", "Segoe UI", "Helvetica Neue", system-ui, -apple-system, sans-serif',
    htmlFontSize: 16,
    h1: { fontWeight: 700, letterSpacing: '-0.02em' },
    h2: { fontWeight: 700, letterSpacing: '-0.02em' },
    h3: { fontWeight: 700, letterSpacing: '-0.02em' },
    h4: { fontWeight: 700, fontSize: '1.625rem', letterSpacing: '-0.02em', [downSm]: { fontSize: '1.35rem' } },
    h5: { fontWeight: 700, fontSize: '1.375rem', letterSpacing: '-0.015em', [downSm]: { fontSize: '1.2rem' } },
    h6: { fontWeight: 700, fontSize: '1.0625rem', letterSpacing: '-0.01em', [downSm]: { fontSize: '1rem' } },
    subtitle1: { fontWeight: 600, fontSize: '0.9375rem' },
    subtitle2: { fontWeight: 600, fontSize: '0.8125rem' },
    body1: { fontSize: '0.9375rem', lineHeight: 1.55, [downSm]: { fontSize: '0.875rem' } },
    body2: { fontSize: '0.8125rem', lineHeight: 1.5 },
    button: { fontWeight: 600, letterSpacing: '0.01em' },
    overline: { fontWeight: 700, letterSpacing: '0.12em', fontSize: '0.6875rem' },
  },
  shape: { borderRadius: 10 },
  shadows: [
    'none',
    '0 1px 2px rgba(15, 23, 42, 0.05)',
    '0 1px 3px rgba(15, 23, 42, 0.07), 0 1px 2px rgba(15, 23, 42, 0.04)',
    '0 4px 12px rgba(15, 23, 42, 0.06)',
    '0 8px 24px rgba(15, 23, 42, 0.08)',
    '0 12px 32px rgba(15, 23, 42, 0.1)',
    '0 16px 40px rgba(15, 23, 42, 0.12)',
    '0 20px 48px rgba(15, 23, 42, 0.14)',
    '0 24px 56px rgba(15, 23, 42, 0.16)',
    '0 1px 3px rgba(15, 23, 42, 0.07)',
    '0 1px 3px rgba(15, 23, 42, 0.07)',
    '0 1px 3px rgba(15, 23, 42, 0.07)',
    '0 1px 3px rgba(15, 23, 42, 0.07)',
    '0 1px 3px rgba(15, 23, 42, 0.07)',
    '0 1px 3px rgba(15, 23, 42, 0.07)',
    '0 1px 3px rgba(15, 23, 42, 0.07)',
    '0 1px 3px rgba(15, 23, 42, 0.07)',
    '0 1px 3px rgba(15, 23, 42, 0.07)',
    '0 1px 3px rgba(15, 23, 42, 0.07)',
    '0 1px 3px rgba(15, 23, 42, 0.07)',
    '0 1px 3px rgba(15, 23, 42, 0.07)',
    '0 1px 3px rgba(15, 23, 42, 0.07)',
    '0 1px 3px rgba(15, 23, 42, 0.07)',
    '0 1px 3px rgba(15, 23, 42, 0.07)',
    '0 1px 3px rgba(15, 23, 42, 0.07)',
  ],
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: ({ theme }) => ({
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 8,
          minHeight: TOUCH_TARGET_MIN,
          [theme.breakpoints.down('sm')]: { fontSize: '0.875rem' },
        }),
        containedPrimary: {
          boxShadow: '0 1px 2px rgba(15, 76, 129, 0.2)',
          '&:hover': { boxShadow: '0 4px 12px rgba(15, 76, 129, 0.25)' },
        },
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
        root: { minHeight: TOUCH_TARGET_MIN, borderRadius: 8 },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: ({ theme }) => ({
          minHeight: TOUCH_TARGET_MIN,
          fontSize: '0.8125rem',
          fontWeight: 600,
          textTransform: 'none',
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
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600, borderRadius: 6 },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          borderRadius: 10,
          border: '1px solid #E2E8F0',
        },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { backgroundImage: 'none' },
        outlined: { borderColor: '#E2E8F0' },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          border: '1px solid #E2E8F0',
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
          borderRadius: 12,
        },
      },
    },
    MuiTextField: {
      defaultProps: { size: 'small', variant: 'outlined' },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          backgroundColor: '#FFFFFF',
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: alpha(PRIMARY.main, 0.45) },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: ({ theme }) => ({
          margin: 12,
          width: 'calc(100% - 24px)',
          maxHeight: 'calc(100% - 24px)',
          borderRadius: 14,
          [theme.breakpoints.up('sm')]: {
            margin: 24,
            width: 'calc(100% - 48px)',
          },
        }),
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: { borderRight: 'none' },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        html: { overflowX: 'hidden' },
        body: {
          overflowX: 'hidden',
          WebkitTextSizeAdjust: '100%',
          backgroundColor: '#F4F6F9',
        },
        '#root': { minHeight: '100vh', minWidth: 0 },
        img: { maxWidth: '100%', height: 'auto' },
        '::selection': { background: alpha(PRIMARY.main, 0.18) },
      },
    },
  },
});
