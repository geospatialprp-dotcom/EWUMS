const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  ee: 'EE',
  ae: 'AE',
  je: 'JE',
  accounts: 'Accounts',
  contractor: 'Contractor',
  gis_admin: 'GIS Admin',
  se: 'SE',
  ce: 'CE',
  secretariat: 'Secretariat',
};

const ROLE_PRIORITY = ['super_admin', 'ce', 'ee', 'ae', 'je', 'accounts', 'contractor', 'gis_admin'];

export type UserDisplayFields = {
  roles: string[];
  divisionName?: string | null;
  firstName?: string;
  lastName?: string;
};

function primaryRole(roles: string[]): string {
  for (const code of ROLE_PRIORITY) {
    if (roles.includes(code)) return code;
  }
  return roles[0] ?? 'staff';
}

export function shortDivisionName(divisionName?: string | null): string | null {
  if (!divisionName?.trim()) return null;
  return divisionName.replace(/\s+Division$/i, '').replace(/^UJS State HQ \(.*\)$/i, 'State HQ').trim();
}

/** Header label e.g. "EE Karanprayag", "JE Haridwar", "Super Admin" */
export function formatUserAuthorityLabel(user: UserDisplayFields): string {
  const role = primaryRole(user.roles);
  const roleLabel = ROLE_LABELS[role] ?? role.replace(/_/g, ' ').toUpperCase();
  const div = shortDivisionName(user.divisionName);
  if (div && role !== 'super_admin') return `${roleLabel} ${div}`;
  if (role === 'super_admin') return div ? `Super Admin · ${div}` : 'Super Admin';
  return roleLabel;
}

export function formatUserSubtitle(user: UserDisplayFields): string {
  const div = shortDivisionName(user.divisionName);
  if (div) return div;
  return user.roles.includes('super_admin') ? 'State Headquarters' : 'UJS';
}

/** Profile name shown in the header (first + last name from the account). */
export function formatUserProfileName(user: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}): string {
  const fullName = [user.firstName, user.lastName].filter((part) => part?.trim()).join(' ').trim();
  if (fullName) return fullName;
  return user.email?.split('@')[0]?.trim() ?? '';
}

/** Short role caption above the profile name in the app bar. */
export function formatHeaderUserCaption(user: UserDisplayFields): string {
  if (user.roles.includes('super_admin')) return 'Super Admin';
  return formatUserAuthorityLabel(user);
}
