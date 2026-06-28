const HQ_PROJECT_REGISTRAR_ROLES = ['se', 'ce', 'cgm', 'md'] as const;

type ProjectWorkflowUser = {
  roles?: string[];
};

export function isHqProjectRegistrar(user: ProjectWorkflowUser | null | undefined): boolean {
  if (!user?.roles?.length) return false;
  return HQ_PROJECT_REGISTRAR_ROLES.some((role) => user.roles!.includes(role));
}

export function isDivisionScopedUser(user: ProjectWorkflowUser | null | undefined): boolean {
  if (!user?.roles?.length) return false;
  return user.roles.some((role) => ['ee', 'je', 'ae', 'accounts'].includes(role))
    && !isHqProjectRegistrar(user);
}
