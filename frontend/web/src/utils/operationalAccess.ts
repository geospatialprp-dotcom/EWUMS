export function isSuperAdmin(roles?: string[] | null): boolean {
  return roles?.includes('super_admin') ?? false;
}

export const SUPER_ADMIN_VIEW_ONLY_MESSAGE =
  'Super Admin has view-only access; use HQ or division login for operational tasks.';

const SUPER_ADMIN_DEMO_OPERATIONAL = new Set([
  'om:create',
  'om:update',
  'dpr_proposal:approve',
  'dpr_pdf_review:annotate',
  'dpr_pdf_review:comment',
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
