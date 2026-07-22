import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Autocomplete,
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../context/LanguageContext';
import { isSecretariatScopedUser } from '../../utils/roleNavigation';
import { isContractorUser } from '../../utils/operationalAccess';
import { appTouchIconButtonSx } from '../../utils/appShellStyles';

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

function SearchAutocomplete({
  autoFocus = false,
  onNavigate,
}: {
  autoFocus?: boolean;
  onNavigate?: () => void;
}) {
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
    <Autocomplete
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      options={options}
      groupBy={(option) => option.group}
      getOptionLabel={(option) => option.label}
      noOptionsText={t('common.noResults')}
      onChange={(_e, value) => {
        if (value) {
          navigate(value.path);
          onNavigate?.();
        }
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          autoFocus={autoFocus}
          placeholder={t('common.searchModules')}
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
              minHeight: 44,
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
  );
}

/** Global module search — desktop inline field; mobile opens a full-screen dialog. */
export default function GlobalSearch() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { t } = useTranslation();
  const [dialogOpen, setDialogOpen] = useState(false);

  if (isMobile) {
    return (
      <>
        <IconButton
          aria-label={t('common.search')}
          onClick={() => setDialogOpen(true)}
          sx={{
            ...appTouchIconButtonSx(),
            color: '#334155',
            flexShrink: 0,
            display: { xs: 'inline-flex', md: 'none' },
          }}
        >
          <SearchIcon />
        </IconButton>
        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          fullScreen
          PaperProps={{ sx: { bgcolor: 'background.default' } }}
        >
          <DialogTitle
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              py: 1.5,
              px: 2,
              borderBottom: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
            }}
          >
            <Typography variant="subtitle1" fontWeight={700}>
              {t('common.search')}
            </Typography>
            <IconButton
              aria-label={t('common.close')}
              onClick={() => setDialogOpen(false)}
              sx={appTouchIconButtonSx()}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ pt: 2, px: 2 }}>
            <SearchAutocomplete autoFocus onNavigate={() => setDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <Box sx={{ display: { xs: 'none', md: 'block' }, flex: 1, maxWidth: 420, minWidth: 180, mx: 2 }}>
      <SearchAutocomplete />
    </Box>
  );
}
