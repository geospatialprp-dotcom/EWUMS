import { ForbiddenException } from '@nestjs/common';
import type { JwtPayload } from '../../modules/auth/interfaces/jwt-payload.interface';

export function isSuperAdmin(roles?: string[] | null): boolean {
  return roles?.includes('super_admin') ?? false;
}

export function assertNotSuperAdminForOperations(user: JwtPayload, action: string): void {
  if (isSuperAdmin(user.roles)) {
    throw new ForbiddenException(
      `Super Admin cannot perform ${action}. Use a division account for field operations.`,
    );
  }
}

export function assertNotSuperAdminRolesForOperations(roles: string[] | null | undefined, action: string): void {
  if (isSuperAdmin(roles)) {
    throw new ForbiddenException(
      `Super Admin cannot perform ${action}. Use a division account for field operations.`,
    );
  }
}

const ADMIN_PERMISSION_PREFIXES = ['user:', 'role:', 'audit:', 'tenant:'] as const;

export function isAdminPermission(permission: string): boolean {
  return ADMIN_PERMISSION_PREFIXES.some((prefix) => permission.startsWith(prefix));
}

export function isReadPermission(permission: string): boolean {
  return permission.endsWith(':read');
}

/** HQ officials conduct post-creation DPR state review (TAC, sanction, etc.). */
export const HQ_STATE_REVIEWER_ROLES = ['se', 'ce', 'cgm', 'md'] as const;

export function isHqStateReviewer(roles?: string[] | null): boolean {
  return roles?.some((r) => (HQ_STATE_REVIEWER_ROLES as readonly string[]).includes(r)) ?? false;
}

/** Super Admin demo exceptions — initiation, state review (TAC/PDF), complaints, deletion requests. */
const SUPER_ADMIN_DEMO_OPERATIONAL = new Set([
  'om:create',
  'om:update',
  'dpr_proposal:create',
  'dpr_proposal:approve',
  'dpr_pdf_review:annotate',
  'dpr_pdf_review:comment',
  'project:delete',
]);

export function isDemoOperationalPermission(permission: string): boolean {
  return SUPER_ADMIN_DEMO_OPERATIONAL.has(permission);
}
