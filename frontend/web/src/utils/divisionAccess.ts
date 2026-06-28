import { useAuth } from '../context/AuthContext';
import type { DivisionOption } from '../context/DivisionContext';

/** True for Super Admin / HQ roles that may view all divisions in the tenant. */
export function useCanViewAllDivisions(): boolean {
  const { user } = useAuth();
  return Boolean(user?.canViewAllDivisions);
}

export const ALL_SCHEMES_LABEL = 'All schemes';

/** Subtitle for HQ / Super Admin pages when division switcher applies. */
export function divisionScopeSubtitle(
  canViewAllDivisions: boolean,
  activeDivision: DivisionOption | null,
): string | undefined {
  if (!canViewAllDivisions) return undefined;
  if (activeDivision) {
    return `Showing data for ${activeDivision.name}`;
  }
  return 'All divisions — use the header switcher to filter by division';
}

export function buildMapExplorerUrl(divisionFilter = '') {
  if (!divisionFilter) return '/map';
  return `/map?division=${encodeURIComponent(divisionFilter)}&fit=1`;
}
