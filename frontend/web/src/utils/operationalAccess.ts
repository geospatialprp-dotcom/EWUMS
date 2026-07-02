export function isSuperAdmin(roles?: string[] | null): boolean {
  return roles?.includes('super_admin') ?? false;
}

export const SUPER_ADMIN_VIEW_ONLY_MESSAGE =
  'Super Admin has view-only access; use a division login for operational tasks.';

/** HQ officials — post-creation DPR/TAC/PDF review (not Super Admin). */
export const HQ_STATE_REVIEWER_ROLES = ['se', 'ce', 'cgm', 'md'] as const;

export function isHqStateReviewer(roles?: string[] | null): boolean {
  return roles?.some((r) => (HQ_STATE_REVIEWER_ROLES as readonly string[]).includes(r)) ?? false;
}

const SUPER_ADMIN_DEMO_OPERATIONAL = new Set([
  'om:create',
  'om:update',
  'dpr_proposal:approve',
  'dpr_pdf_review:annotate',
  'dpr_pdf_review:comment',
  'project:delete',
]);

export function canPerformOperational(
  roles: string[] | undefined | null,
  hasPermission: (permission: string) => boolean,
  permission: string,
): boolean {
  if (isSuperAdmin(roles)) {
    return SUPER_ADMIN_DEMO_OPERATIONAL.has(permission);
  }
  return hasPermission(permission);
}

export function hasOperationalRole(
  roles: string[] | undefined | null,
  allowed: readonly string[],
): boolean {
  if (isSuperAdmin(roles)) return false;
  return roles?.some((r) => allowed.includes(r)) ?? false;
}
