import type { SxProps, Theme } from '@mui/material';

/** Quiet institutional field — white surface, slate border, teal focus. */
export const loginFieldSx: SxProps<Theme> = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 1.5,
    bgcolor: '#ffffff',
    fontSize: '0.9375rem',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: '#cbd5e1',
    },
    '&:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: '#94a3b8',
    },
    '&.Mui-focused': {
      bgcolor: '#ffffff',
      '& .MuiOutlinedInput-notchedOutline': {
        borderColor: '#0F4C81',
        borderWidth: 1.5,
      },
      boxShadow: '0 0 0 3px rgba(15, 76, 129, 0.12)',
    },
  },
  '& .MuiInputLabel-root.Mui-focused': {
    color: '#0F4C81',
  },
};

export const consumerFieldSx: SxProps<Theme> = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 1.5,
    bgcolor: '#ffffff',
    fontSize: '0.9375rem',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: '#cbd5e1',
    },
    '&:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: '#7dd3fc',
    },
    '&.Mui-focused': {
      '& .MuiOutlinedInput-notchedOutline': {
        borderColor: '#0369a1',
        borderWidth: 1.5,
      },
      boxShadow: '0 0 0 3px rgba(3, 105, 161, 0.12)',
    },
  },
};

/** Staff login card — solid, calm, government-portal style. */
export const glassCardSx = (accent = '#0F4C81'): SxProps<Theme> => ({
  width: '100%',
  maxWidth: 400,
  maxHeight: 'calc(100vh - 40px)',
  borderRadius: 2,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  position: 'relative',
  bgcolor: '#ffffff',
  border: '1px solid rgba(226, 232, 240, 0.95)',
  boxShadow: '0 12px 40px rgba(15, 23, 42, 0.22), 0 2px 8px rgba(15, 23, 42, 0.08)',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    background: accent,
  },
});

export const consumerGlassCardSx: SxProps<Theme> = {
  ...glassCardSx('#0369a1'),
  boxShadow: '0 12px 36px rgba(2, 132, 199, 0.12), 0 2px 8px rgba(15, 23, 42, 0.06)',
};

export const loginPrimaryButtonSx: SxProps<Theme> = {
  mt: 2,
  py: 1.15,
  borderRadius: 1.5,
  fontWeight: 700,
  textTransform: 'none',
  fontSize: '0.9375rem',
  letterSpacing: '0.01em',
  bgcolor: '#0F4C81',
  boxShadow: '0 4px 14px rgba(15, 76, 129, 0.35)',
  transition: 'background-color 0.15s ease, box-shadow 0.15s ease',
  '&:hover': {
    bgcolor: '#0a3a63',
    boxShadow: '0 6px 18px rgba(15, 76, 129, 0.4)',
  },
  '&:active': {
    bgcolor: '#082f52',
  },
};
