import { useMemo } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { Breadcrumbs, Link, Typography } from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { useTranslation } from '../../context/LanguageContext';

const PATH_LABEL_KEYS: Record<string, string> = {
  platform: 'nav.platformModules',
  dashboard: 'nav.executiveDashboard',
  map: 'nav.mapExplorer',
  assets: 'nav.assetRegistry',
  workflows: 'nav.workflowCenter',
  'dpr-planning': 'nav.dprApprovalPipeline',
  'land-acquisition': 'nav.landAcquisition',
  projects: 'nav.projectManagement',
  om: 'nav.omManagement',
  complaints: 'nav.consumerComplaints',
  billing: 'nav.billingRevenue',
  'mobile-billing': 'nav.mobileBilling',
  admin: 'nav.sectionAdministration',
  users: 'nav.userManagement',
  roles: 'nav.rolesPermissions',
  audit: 'nav.auditTrail',
  notifications: 'nav.notificationSettings',
};

function titleCase(segment: string) {
  return segment
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** Lightweight breadcrumb trail derived from the current route. */
export default function AppBreadcrumbs() {
  const location = useLocation();
  const { t } = useTranslation();

  const crumbs = useMemo(() => {
    const parts = location.pathname.split('/').filter(Boolean);
    if (parts.length === 0) return [];
    return parts.map((part, index) => {
      const path = `/${parts.slice(0, index + 1).join('/')}`;
      const key = PATH_LABEL_KEYS[part];
      const label = key ? t(key) : titleCase(part);
      return { path, label, last: index === parts.length - 1 };
    });
  }, [location.pathname, t]);

  if (crumbs.length === 0) return null;

  return (
    <Breadcrumbs
      separator={<NavigateNextIcon fontSize="small" sx={{ color: 'text.disabled' }} />}
      aria-label="Breadcrumb"
      sx={{
        display: { xs: 'flex', sm: 'flex' },
        mb: { xs: 1, sm: 1.5 },
        '& .MuiBreadcrumbs-ol': { flexWrap: 'nowrap' },
        '& .MuiBreadcrumbs-li': { minWidth: 0 },
        '& .MuiBreadcrumbs-separator': { mx: 0.5 },
      }}
    >
      <Link component={RouterLink} to="/dashboard" underline="hover" color="text.secondary" variant="caption" fontWeight={600}>
        {t('nav.home')}
      </Link>
      {crumbs.map((crumb) =>
        crumb.last ? (
          <Typography key={crumb.path} variant="caption" fontWeight={700} color="text.primary" noWrap>
            {crumb.label}
          </Typography>
        ) : (
          <Link
            key={crumb.path}
            component={RouterLink}
            to={crumb.path}
            underline="hover"
            color="text.secondary"
            variant="caption"
            fontWeight={600}
            noWrap
          >
            {crumb.label}
          </Link>
        ),
      )}
    </Breadcrumbs>
  );
}
