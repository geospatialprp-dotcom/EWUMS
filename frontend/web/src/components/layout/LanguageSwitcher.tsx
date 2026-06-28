import { useState } from 'react';
import {
  Box,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from '@mui/material';
import LanguageIcon from '@mui/icons-material/Language';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import { useTranslation } from '../../context/LanguageContext';
import type { AppLocale } from '../../i18n';

const OPTIONS: Array<{ id: AppLocale; labelKey: string }> = [
  { id: 'en', labelKey: 'language.english' },
  { id: 'hi', labelKey: 'language.hindi' },
];

type LanguageSwitcherProps = {
  variant?: 'icon' | 'full';
};

export default function LanguageSwitcher({ variant = 'icon' }: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useTranslation();
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const open = Boolean(anchor);

  const handleSelect = (next: AppLocale) => {
    if (next !== locale) setLocale(next);
    setAnchor(null);
  };

  const trigger = variant === 'full' ? (
    <Box
      component="button"
      type="button"
      onClick={(e) => setAnchor(e.currentTarget)}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.75,
        border: '1px solid #e2e8f0',
        borderRadius: 1.5,
        bgcolor: '#fff',
        px: 1.25,
        py: 0.75,
        cursor: 'pointer',
        color: '#334155',
        font: 'inherit',
      }}
    >
      <LanguageIcon fontSize="small" />
      <Typography variant="body2" fontWeight={600}>
        {t('language.title')}
      </Typography>
    </Box>
  ) : (
    <Tooltip title={t('language.title')}>
      <IconButton
        size="small"
        onClick={(e) => setAnchor(e.currentTarget)}
        aria-label={t('language.title')}
        sx={{ color: '#475569' }}
      >
        <LanguageIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );

  return (
    <>
      {trigger}
      <Menu
        anchorEl={anchor}
        open={open}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 220, mt: 0.5 } } }}
      >
        <Box px={2} py={1}>
          <Typography variant="caption" color="text.secondary" fontWeight={700}>
            🌐 {t('language.title')}
          </Typography>
        </Box>
        {OPTIONS.map((option) => {
          const selected = locale === option.id;
          return (
            <MenuItem key={option.id} onClick={() => handleSelect(option.id)} dense>
              <ListItemIcon sx={{ minWidth: 32 }}>
                {selected ? (
                  <CheckBoxIcon fontSize="small" color="primary" />
                ) : (
                  <CheckBoxOutlineBlankIcon fontSize="small" />
                )}
              </ListItemIcon>
              <ListItemText primary={t(option.labelKey)} />
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}
