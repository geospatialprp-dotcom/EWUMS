import { isSecretariatReviewer } from '../constants/dprPlanningWorkflow';
import { isContractorUser, isSuperAdmin } from './operationalAccess';

/** Landing route after login for Secretariat officials. */
export const SECRETARIAT_HOME = '/dpr-planning';

/** Secretariat may only use DPR pipeline routes (and sub-paths). */
const SECRETARIAT_ALLOWED_PREFIXES = [SECRETARIAT_HOME] as const;

/** Secretariat-scoped users see DPR only — not map, projects, billing, etc. */
export function isSecretariatScopedUser(roles?: string[] | null): boolean {
  return isSecretariatReviewer(roles ?? []) && !isSuperAdmin(roles);
}

export function isSecretariatAllowedPath(pathname: string): boolean {
  return SECRETARIAT_ALLOWED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function getDefaultHomePath(roles?: string[] | null): string {
  if (isSecretariatScopedUser(roles)) return SECRETARIAT_HOME;
  if (isContractorUser(roles)) return '/projects';
  return '/map';
}
