import {
  Box, FormControl, InputLabel, MenuItem, Select, Typography,
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
      <Box display="flex" alignItems="center" gap={0.75} mr={1}>
        <BusinessOutlinedIcon fontSize="small" color="action" />
        <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 180 }} noWrap>
          {user.divisionName}
        </Typography>
      </Box>
    );
  }

  return (
    <FormControl size="small" sx={{ minWidth: 200, mr: 1 }}>
      <InputLabel id="division-switcher-label">{t('division.label')}</InputLabel>
      <Select
        labelId="division-switcher-label"
        label={t('division.label')}
        value={activeDivisionId ?? ''}
        onChange={(e) => setActiveDivisionId(e.target.value || null)}
        disabled={loading}
        sx={{ bgcolor: '#fff', borderRadius: 1 }}
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
