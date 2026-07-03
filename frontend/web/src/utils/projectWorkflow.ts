import { isSuperAdmin } from './operationalAccess';

const HQ_ORGANIZATION_ROLES = ['se', 'ce', 'cgm', 'md'] as const;

type ProjectWorkflowUser = {
  roles?: string[];
};

/** @deprecated HQ no longer registers construction projects — use isDivisionEeProjectRegistrar */
export function isHqProjectRegistrar(user: ProjectWorkflowUser | null | undefined): boolean {
  if (!user?.roles?.length) return false;
  return HQ_ORGANIZATION_ROLES.some((role) => user.roles!.includes(role));
}

export function isDivisionEeProjectRegistrar(user: ProjectWorkflowUser | null | undefined): boolean {
  if (!user?.roles?.length || isSuperAdmin(user.roles)) return false;
  return user.roles.includes('ee');
}

export function isDivisionScopedUser(user: ProjectWorkflowUser | null | undefined): boolean {
  if (!user?.roles?.length) return false;
  return user.roles.some((role) => ['ee', 'je', 'ae', 'accounts'].includes(role))
    && !HQ_ORGANIZATION_ROLES.some((role) => user.roles!.includes(role));
}
