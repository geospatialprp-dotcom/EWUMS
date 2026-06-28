export type AccessScope = 'division' | 'circle' | 'state' | 'global';

export interface JwtPayload {
  sub: string;
  email: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
  divisionId?: string | null;
  divisionCode?: string | null;
  divisionName?: string | null;
  circleId?: string | null;
  circleCode?: string | null;
  circleName?: string | null;
  accessScope?: AccessScope;
  canViewAllDivisions?: boolean;
  /** Per-request division filter from X-Active-Division-Id (super admin / HQ only). */
  activeDivisionId?: string | null;
  consumerId?: string;
  portalType?: 'staff' | 'consumer';
}
