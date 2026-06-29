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
        sx={{ minWidth: 0, maxWidth: { xs: 120, sm: 160, md: 180 }, flexShrink: 1, mr: { xs: 0.25, sm: 0.5 } }}
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
        minWidth: { xs: 100, sm: 140, md: 200 },
        maxWidth: { xs: 140, sm: 180, md: 220 },
        flexShrink: 1,
        mr: { xs: 0.25, sm: 0.5 },
      }}
    >
      <Select
        displayEmpty
        value={activeDivisionId ?? ''}
        onChange={(e) => setActiveDivisionId(e.target.value || null)}
        disabled={loading}
        renderValue={() => (
          <Typography
            variant="body2"
            noWrap
            sx={{ fontWeight: 600, color: '#334155', fontSize: { xs: '0.75rem', md: '0.875rem' } }}
          >
            {selectedLabel}
          </Typography>
        )}
        sx={{
          bgcolor: '#fff',
          borderRadius: 1,
          height: { xs: 36, md: 40 },
          '& .MuiSelect-select': {
            py: { xs: 0.75, md: 1 },
            pl: { xs: 1, md: 1.5 },
            pr: { xs: 3, md: 4 },
            display: 'flex',
            alignItems: 'center',
          },
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
