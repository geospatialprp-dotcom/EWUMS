import { Box } from '@mui/material';
import LanguageSwitcher from './LanguageSwitcher';
import HelpPanel from './HelpPanel';

export default function StandaloneChrome() {
  return (
    <Box
      sx={{
        position: 'fixed',
        top: 12,
        right: 12,
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        bgcolor: 'rgba(255,255,255,0.92)',
        borderRadius: 2,
        border: '1px solid #e2e8f0',
        px: 0.5,
        py: 0.25,
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
      }}
    >
      <HelpPanel />
      <LanguageSwitcher />
    </Box>
  );
}
