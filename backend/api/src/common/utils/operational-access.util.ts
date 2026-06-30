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

/** Super Admin demo exceptions — complaints, DPR state approval, and PDF review for demos. */
const SUPER_ADMIN_DEMO_OPERATIONAL = new Set([
  'om:create',
  'om:update',
  'dpr_proposal:approve',
  'dpr_pdf_review:annotate',
  'dpr_pdf_review:comment',
]);

export function isDemoOperationalPermission(permission: string): boolean {
  return SUPER_ADMIN_DEMO_OPERATIONAL.has(permission);
}
