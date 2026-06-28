import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import axios from 'axios';
import { authApi, setUnauthorizedHandler } from '../services/api';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
  divisionId?: string | null;
  divisionCode?: string | null;
  divisionName?: string | null;
  circleId?: string | null;
  circleCode?: string | null;
  circleName?: string | null;
  accessScope?: 'global' | 'state' | 'circle' | 'division';
  canViewAllDivisions?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('egip_token'));
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(() => {
    localStorage.removeItem('egip_token');
    localStorage.removeItem('egip_user');
    setToken(null);
    setUser(null);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    if (window.location.pathname !== '/login') {
      window.location.replace('/login');
    }
  }, [clearSession]);

  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, [logout]);

  useEffect(() => {
    const init = async () => {
      const storedToken = localStorage.getItem('egip_token');
      const storedUser = localStorage.getItem('egip_user');

      if (!storedToken) {
        setLoading(false);
        return;
      }

      setToken(storedToken);
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }

      try {
        const { data } = await authApi.profile();
        if (data?.id) {
          const refreshed = {
            id: data.id,
            email: data.email,
            firstName: data.firstName,
            lastName: data.lastName,
            tenantId: data.tenantId,
            roles: Array.isArray(data.roles)
              ? data.roles.map((r: string | { code: string }) => (typeof r === 'string' ? r : r.code))
              : [],
            permissions: data.permissions ?? [],
            divisionId: data.divisionId ?? null,
            divisionCode: data.divisionCode ?? null,
            divisionName: data.divisionName ?? null,
            circleId: data.circleId ?? null,
            circleCode: data.circleCode ?? null,
            circleName: data.circleName ?? null,
            accessScope: data.accessScope ?? 'division',
            canViewAllDivisions: data.canViewAllDivisions ?? false,
          };
          localStorage.setItem('egip_user', JSON.stringify(refreshed));
          setUser(refreshed);
        }
      } catch (err) {
        // Stale dev-server token or expired JWT — clear without redirect loop
        if (axios.isAxiosError(err) && err.response?.status === 401) {
          clearSession();
        }
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [clearSession]);

  const login = async (email: string, password: string) => {
    clearSession();
    const { data } = await authApi.login(email.trim().toLowerCase(), password);
    localStorage.setItem('egip_token', data.accessToken);
    localStorage.setItem('egip_user', JSON.stringify(data.user));
    setToken(data.accessToken);
    setUser(data.user);
  };

  const hasPermission = (permission: string) => {
    if (!user) return false;
    return user.permissions.includes(permission);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
