const DIVISION_MILESTONE_ROLES = ['je', 'ae', 'ee', 'accounts'] as const;

type MilestoneUser = {
  roles: string[];
  divisionId?: string | null;
  canViewAllDivisions?: boolean;
  permissions?: string[];
};

export function canManageMilestones(user: MilestoneUser | null | undefined): boolean {
  if (!user) return false;
  if (user.roles.includes('super_admin')) return false;
  if (user.canViewAllDivisions) return false;
  if (!user.divisionId) return false;
  if (!DIVISION_MILESTONE_ROLES.some((role) => user.roles.includes(role))) return false;
  if (user.permissions?.length) {
    return user.permissions.includes('project:milestone');
  }
  return true;
}

export function isMilestoneReadOnlyViewer(user: MilestoneUser | null | undefined): boolean {
  if (!user) return false;
  return !canManageMilestones(user) && (user.roles.includes('super_admin') || Boolean(user.canViewAllDivisions));
}
