import { useAuth } from '../context/AuthContext';

/** True for Super Admin / HQ roles that may view all divisions in the tenant. */
export function useCanViewAllDivisions(): boolean {
  const { user } = useAuth();
  return Boolean(user?.canViewAllDivisions);
}

export const ALL_SCHEMES_LABEL = 'All schemes';
