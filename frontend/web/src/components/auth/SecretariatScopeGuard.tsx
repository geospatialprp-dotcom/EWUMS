import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  isSecretariatAllowedPath,
  isSecretariatScopedUser,
  SECRETARIAT_HOME,
} from '../../utils/roleNavigation';

export default function SecretariatScopeGuard({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!isSecretariatScopedUser(user?.roles)) {
    return <>{children}</>;
  }

  if (!isSecretariatAllowedPath(location.pathname)) {
    return <Navigate to={SECRETARIAT_HOME} replace />;
  }

  return <>{children}</>;
}
