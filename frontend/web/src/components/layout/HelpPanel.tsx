import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from '../../context/LanguageContext';
import { appTouchIconButtonSx } from '../../utils/appShellStyles';

export default function HelpPanel() {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [open, setOpen] = useState(false);

  const guides = [
    { title: t('help.mapGuide'), key: 'map' },
    { title: t('help.omGuide'), key: 'om' },
    { title: t('help.billingGuide'), key: 'billing' },
    { title: t('help.laGuide'), key: 'la' },
  ];

  return (
    <>
      <IconButton
        onClick={() => setOpen(true)}
        aria-label={t('common.help')}
        sx={{ color: '#475569', ...appTouchIconButtonSx() }}
      >
        <HelpOutlineIcon fontSize="small" />
      </IconButton>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}>
          <Typography variant="h6" fontWeight={800}>{t('help.title')}</Typography>
          <IconButton onClick={() => setOpen(false)} aria-label={t('common.close')}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" mb={2}>
            {t('help.intro')}
          </Typography>
          <List dense disablePadding>
            {guides.map((guide) => (
              <ListItem key={guide.key} sx={{ px: 0 }}>
                <ListItemText primary={guide.title} />
              </ListItem>
            ))}
          </List>
        </DialogContent>
      </Dialog>
    </>
  );
}
