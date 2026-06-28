import type { SxProps, Theme } from '@mui/material';

export const loginFieldSx: SxProps<Theme> = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 2.5,
    bgcolor: 'rgba(248, 250, 252, 0.9)',
    transition: 'box-shadow 0.25s ease, border-color 0.25s ease, transform 0.2s ease',
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#93c5fd' },
    '&.Mui-focused': {
      transform: 'translateY(-1px)',
      boxShadow: '0 0 0 4px rgba(37, 99, 235, 0.1)',
      '& .MuiOutlinedInput-notchedOutline': { borderColor: '#2563eb', borderWidth: 1.5 },
    },
  },
};

export const consumerFieldSx: SxProps<Theme> = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 2.5,
    bgcolor: 'rgba(248, 250, 252, 0.95)',
    transition: 'box-shadow 0.25s ease, border-color 0.25s ease, transform 0.2s ease',
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#7dd3fc' },
    '&.Mui-focused': {
      transform: 'translateY(-1px)',
      boxShadow: '0 0 0 4px rgba(2, 132, 199, 0.1)',
      '& .MuiOutlinedInput-notchedOutline': { borderColor: '#0284c7', borderWidth: 1.5 },
    },
  },
};

export const glassCardSx = (accent = '#2563eb'): SxProps<Theme> => ({
  width: '100%',
  maxWidth: 420,
  maxHeight: 'calc(100vh - 32px)',
  borderRadius: 3,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  position: 'relative',
  bgcolor: 'rgba(255, 255, 255, 0.98)',
  border: '1px solid rgba(226, 232, 240, 0.9)',
  boxShadow: '0 20px 48px rgba(0, 0, 0, 0.28)',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    background: `linear-gradient(90deg, ${accent}, #0d9488, #4f46e5)`,
  },
});

export const consumerGlassCardSx: SxProps<Theme> = {
  ...glassCardSx('#0284c7'),
  boxShadow: '0 20px 48px rgba(2, 132, 199, 0.14)',
};
