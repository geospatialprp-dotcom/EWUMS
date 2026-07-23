import { ReactNode } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../context/LanguageContext';

interface PermissionRouteProps {
  children: ReactNode;
  permission?: string;
  permissions?: string[];
  /** When true, only HQ / super-admin (canViewAllDivisions) may open the route. */
  hqOnly?: boolean;
}

function isSuperAdmin(user: { roles?: string[] } | null) {
  return Boolean(user?.roles?.includes('super_admin'));
}

export default function PermissionRoute({
  children,
  permission,
  permissions,
  hqOnly = false,
}: PermissionRouteProps) {
  const { user, loading, hasPermission } = useAuth();
  const { t } = useTranslation();

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="50vh">
        <CircularProgress />
      </Box>
    );
  }

  const required = permission ? [permission] : permissions ?? [];
  const hasPerm = isSuperAdmin(user) || required.length === 0 || required.some((p) => hasPermission(p));
  const hqOk = !hqOnly || isSuperAdmin(user) || Boolean(user?.canViewAllDivisions);
  const allowed = hasPerm && hqOk;

  if (!allowed) {
    return (
      <Box p={4} textAlign="center">
        <Typography variant="h6" color="error" gutterBottom>{t('access.deniedTitle')}</Typography>
        <Typography color="text.secondary">
          {t('access.deniedMessage')}
        </Typography>
      </Box>
    );
  }

  return <>{children}</>;
}

export function AdminRoute({ children }: { children: ReactNode }) {
  const { user, loading, hasPermission } = useAuth();
  const { t } = useTranslation();

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="50vh">
        <CircularProgress />
      </Box>
    );
  }

  const allowed = isSuperAdmin(user) || hasPermission('user:read') || hasPermission('audit:read');

  if (!allowed) {
    return (
      <Box p={4} textAlign="center">
        <Typography variant="h6" color="error" gutterBottom>{t('access.deniedTitle')}</Typography>
        <Typography color="text.secondary">
          {t('access.deniedMessage')}
        </Typography>
      </Box>
    );
  }

  return <>{children}</>;
}
