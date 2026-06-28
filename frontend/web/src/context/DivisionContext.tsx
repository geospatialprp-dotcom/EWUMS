import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react';
import { divisionsApi } from '../services/api';
import { setActiveDivisionIdGetter } from '../services/api';
import { useAuth } from './AuthContext';

export type DivisionOption = {
  id: string;
  code: string;
  name: string;
  isHeadquarters?: boolean;
};

type DivisionContextValue = {
  divisions: DivisionOption[];
  activeDivisionId: string | null;
  activeDivision: DivisionOption | null;
  setActiveDivisionId: (id: string | null) => void;
  canSwitchDivision: boolean;
  scopeKey: string;
  loading: boolean;
};

const DivisionContext = createContext<DivisionContextValue | null>(null);

const STORAGE_KEY = 'egip_active_division_id';

export function DivisionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const canSwitchDivision = Boolean(user?.canViewAllDivisions);
  const [divisions, setDivisions] = useState<DivisionOption[]>([]);
  const [activeDivisionId, setActiveDivisionIdState] = useState<string | null>(() => {
    if (!canSwitchDivision) return user?.divisionId ?? null;
    try {
      return sessionStorage.getItem(STORAGE_KEY) || null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setDivisions([]);
      return;
    }
    if (!canSwitchDivision) {
      setActiveDivisionIdState(user.divisionId ?? null);
      setDivisions(user.divisionId
        ? [{ id: user.divisionId, code: user.divisionCode ?? '', name: user.divisionName ?? 'My Division' }]
        : []);
      return;
    }
    setLoading(true);
    divisionsApi.list()
      .then((res) => {
        const list = (res.data ?? []).map((d: DivisionOption) => d);
        const fieldDivisions = list.filter((d) => !d.isHeadquarters);
        setDivisions(fieldDivisions);
        setActiveDivisionIdState((current) => {
          if (!current || fieldDivisions.some((d) => d.id === current)) return current;
          try {
            sessionStorage.removeItem(STORAGE_KEY);
          } catch {
            /* ignore */
          }
          return null;
        });
      })
      .catch(() => setDivisions([]))
      .finally(() => setLoading(false));
  }, [user, canSwitchDivision]);

  const setActiveDivisionId = useCallback((id: string | null) => {
    if (!canSwitchDivision) return;
    setActiveDivisionIdState(id);
    try {
      if (id) sessionStorage.setItem(STORAGE_KEY, id);
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, [canSwitchDivision]);

  const effectiveDivisionId = canSwitchDivision
    ? activeDivisionId
    : (user?.divisionId ?? null);

  useEffect(() => {
    setActiveDivisionIdGetter(() => effectiveDivisionId);
    return () => setActiveDivisionIdGetter(() => null);
  }, [effectiveDivisionId]);

  const activeDivision = useMemo(
    () => divisions.find((d) => d.id === effectiveDivisionId) ?? null,
    [divisions, effectiveDivisionId],
  );

  const value = useMemo<DivisionContextValue>(() => ({
    divisions,
    activeDivisionId: effectiveDivisionId,
    activeDivision,
    setActiveDivisionId,
    canSwitchDivision,
    scopeKey: effectiveDivisionId ?? 'all',
    loading,
  }), [
    divisions,
    effectiveDivisionId,
    activeDivision,
    setActiveDivisionId,
    canSwitchDivision,
    loading,
  ]);

  return (
    <DivisionContext.Provider value={value}>
      {children}
    </DivisionContext.Provider>
  );
}

export function useDivisionScope() {
  const ctx = useContext(DivisionContext);
  if (!ctx) {
    throw new Error('useDivisionScope must be used within DivisionProvider');
  }
  return ctx;
}

export function useDivisionScopeKey(): string {
  const ctx = useContext(DivisionContext);
  return ctx?.scopeKey ?? 'all';
}
