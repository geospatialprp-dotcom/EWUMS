import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
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
    h4: { fontWeight: 600, fontSize: '1.75rem', [`@media (max-width:600px)`]: { fontSize: '1.375rem' } },
    h5: { fontWeight: 600, fontSize: '1.5rem', [`@media (max-width:600px)`]: { fontSize: '1.25rem' } },
    h6: { fontWeight: 600, fontSize: '1.125rem', [`@media (max-width:600px)`]: { fontSize: '1rem' } },
    body1: { fontSize: '0.9375rem', [`@media (max-width:600px)`]: { fontSize: '0.875rem' } },
    body2: { fontSize: '0.8125rem' },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600 },
        sizeSmall: ({ theme }) => ({
          [theme.breakpoints.down('sm')]: { minHeight: 40, padding: '8px 14px' },
        }),
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: ({ theme }) => ({
          [theme.breakpoints.down('md')]: { padding: 10 },
        }),
        sizeSmall: { padding: 8 },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: { minHeight: 44 },
      },
    },
    MuiCard: { styleOverrides: { root: { boxShadow: '0 1px 3px rgba(0,0,0,0.08)' } } },
    MuiDialog: {
      styleOverrides: {
        paper: ({ theme }) => ({
          [theme.breakpoints.down('sm')]: { margin: 12, width: 'calc(100% - 24px)', maxHeight: 'calc(100% - 24px)' },
        }),
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        body: { overflowX: 'hidden' },
        '#root': { minHeight: '100vh' },
      },
    },
  },
});