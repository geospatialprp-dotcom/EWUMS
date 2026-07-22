import {
  Box, FormControl, MenuItem, Select, Typography,
} from '@mui/material';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import { useDivisionScope } from '../../context/DivisionContext';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../context/LanguageContext';

export default function DivisionSwitcher() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const {
    divisions, activeDivisionId, setActiveDivisionId, canSwitchDivision, loading,
  } = useDivisionScope();

  if (!user) return null;

  if (!canSwitchDivision) {
    if (!user.divisionName) return null;
    return (
      <Box
        display="flex"
        alignItems="center"
        gap={0.5}
        sx={{
          minWidth: { xs: 88, sm: 100 },
          maxWidth: { xs: 100, sm: 130, md: 148 },
          flexShrink: 0,
          mr: { xs: 0.25, sm: 0.5 },
        }}
      >
        <BusinessOutlinedIcon fontSize="small" color="action" sx={{ flexShrink: 0 }} />
        <Typography
          variant="caption"
          color="text.secondary"
          noWrap
          sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}
        >
          {user.divisionName}
        </Typography>
      </Box>
    );
  }

  const selectedLabel = activeDivisionId
    ? divisions.find((d) => d.id === activeDivisionId)?.name ?? t('division.label')
    : t('division.allOverview');

  return (
    <FormControl
      size="small"
      sx={{
        minWidth: { xs: 88, sm: 110, md: 140 },
        maxWidth: { xs: 110, sm: 150, md: 168 },
        flexShrink: 0,
        mr: { xs: 0.25, sm: 0.5 },
      }}
    >
      <Select
        displayEmpty
        value={activeDivisionId ?? ''}
        onChange={(e) => setActiveDivisionId(e.target.value || null)}
        disabled={loading}
        renderValue={() => (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0, overflow: 'hidden' }}>
            <BusinessOutlinedIcon fontSize="small" color="action" sx={{ flexShrink: 0, display: { xs: 'inline-flex', sm: 'none' } }} />
            <Typography
              variant="body2"
              noWrap
              sx={{ fontWeight: 600, color: '#334155', fontSize: { xs: '0.6875rem', sm: '0.75rem', md: '0.75rem' }, lineHeight: 1.2 }}
            >
              {selectedLabel}
            </Typography>
          </Box>
        )}
        sx={{
          bgcolor: '#fff',
          borderRadius: 1,
          border: '1px solid #e2e8f0',
          height: { xs: 28, md: 30 },
          minHeight: { xs: 28, md: 30 },
          '& .MuiSelect-select': {
            py: 0,
            pl: { xs: 0.75, md: 1 },
            pr: { xs: 2.25, md: 3 },
            display: 'flex',
            alignItems: 'center',
            minHeight: '28px !important',
            boxSizing: 'border-box',
          },
          '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
          '& .MuiSvgIcon-root': { fontSize: 18, right: 4 },
        }}
        aria-label={t('division.label')}
      >
        <MenuItem value="">
          <em>{t('division.allOverview')}</em>
        </MenuItem>
        {divisions.map((d) => (
          <MenuItem key={d.id} value={d.id}>
            {d.name}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
