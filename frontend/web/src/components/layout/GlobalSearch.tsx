import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Autocomplete,
  Box,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../context/LanguageContext';
import { isSecretariatScopedUser } from '../../utils/roleNavigation';
import { isContractorUser } from '../../utils/operationalAccess';

type SearchItem = {
  path: string;
  labelKey: string;
  group: string;
  permission?: string;
};

const SEARCH_ITEMS: SearchItem[] = [
  { path: '/dashboard', labelKey: 'nav.executiveDashboard', group: 'Main', permission: 'dashboard:read' },
  { path: '/platform', labelKey: 'nav.platformModules', group: 'Main', permission: 'project:read' },
  { path: '/map', labelKey: 'nav.mapExplorer', group: 'Main', permission: 'project:read' },
  { path: '/assets', labelKey: 'nav.assetRegistry', group: 'Main', permission: 'asset:read' },
  { path: '/workflows', labelKey: 'nav.workflowCenter', group: 'Main', permission: 'project:read' },
  { path: '/dpr-planning', labelKey: 'nav.dprApprovalPipeline', group: 'Management', permission: 'dpr_proposal:read' },
  { path: '/land-acquisition', labelKey: 'nav.landAcquisition', group: 'Management', permission: 'la_case:read' },
  { path: '/projects', labelKey: 'nav.projectManagement', group: 'Management', permission: 'project:read' },
  { path: '/om', labelKey: 'nav.omManagement', group: 'Management', permission: 'om:read' },
  { path: '/complaints', labelKey: 'nav.consumerComplaints', group: 'Management', permission: 'om:read' },
  { path: '/billing', labelKey: 'nav.billingRevenue', group: 'Management', permission: 'om:read' },
  { path: '/admin/users', labelKey: 'nav.userManagement', group: 'Admin', permission: 'user:read' },
  { path: '/admin/roles', labelKey: 'nav.rolesPermissions', group: 'Admin', permission: 'user:read' },
  { path: '/admin/audit', labelKey: 'nav.auditTrail', group: 'Admin', permission: 'audit:read' },
];

/** Desktop global module search — navigation only (no API change). */
export default function GlobalSearch() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { hasPermission, user } = useAuth();
  const [open, setOpen] = useState(false);

  const secretariatScoped = isSecretariatScopedUser(user?.roles);
  const contractorScoped = isContractorUser(user?.roles);

  const options = useMemo(() => {
    let items = SEARCH_ITEMS.filter((item) => !item.permission || hasPermission(item.permission));
    if (secretariatScoped) {
      items = items.filter((item) => item.path === '/dpr-planning');
    }
    if (contractorScoped) {
      items = items.filter((item) => ['/projects', '/om', '/map', '/platform'].includes(item.path));
    }
    return items.map((item) => ({
      ...item,
      label: t(item.labelKey),
    }));
  }, [hasPermission, secretariatScoped, contractorScoped, t]);

  return (
    <Box sx={{ display: { xs: 'none', md: 'block' }, flex: 1, maxWidth: 420, minWidth: 180, mx: 2 }}>
      <Autocomplete
        open={open}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        options={options}
        groupBy={(option) => option.group}
        getOptionLabel={(option) => option.label}
        noOptionsText="No modules found"
        onChange={(_e, value) => {
          if (value) navigate(value.path);
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder="Search modules…"
            size="small"
            InputProps={{
              ...params.InputProps,
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: 'grey.50',
                borderRadius: 2,
                '& fieldset': { borderColor: 'divider' },
              },
            }}
          />
        )}
        renderOption={(props, option) => (
          <li {...props} key={option.path}>
            <Typography variant="body2" fontWeight={600}>
              {option.label}
            </Typography>
          </li>
        )}
      />
    </Box>
  );
}
