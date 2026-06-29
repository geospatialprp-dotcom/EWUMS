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
      <Box display={{ xs: 'none', md: 'flex' }} alignItems="center" gap={0.75}>
        <BusinessOutlinedIcon fontSize="small" color="action" />
        <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 180 }} noWrap>
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
        minWidth: { md: 200, lg: 220 },
        maxWidth: { md: 240, lg: 280 },
        display: { xs: 'none', md: 'block' },
      }}
    >
      <Select
        displayEmpty
        value={activeDivisionId ?? ''}
        onChange={(e) => setActiveDivisionId(e.target.value || null)}
        disabled={loading}
        renderValue={() => (
          <Typography variant="body2" noWrap sx={{ fontWeight: 600, color: '#334155' }}>
            {selectedLabel}
          </Typography>
        )}
        sx={{
          bgcolor: '#fff',
          borderRadius: 1,
          height: 40,
          '& .MuiSelect-select': { py: 1, display: 'flex', alignItems: 'center' },
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
