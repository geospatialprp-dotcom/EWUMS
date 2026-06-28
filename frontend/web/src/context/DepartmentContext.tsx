import { createContext, useContext, useMemo, useState, useCallback, ReactNode } from 'react';
import {
  DEFAULT_DEPARTMENT_ID,
  DEPARTMENT_BRANDS,
  DEPARTMENT_STORAGE_KEY,
  getDepartmentById,
  type DepartmentBrand,
} from '../constants/departments';

interface DepartmentContextType {
  department: DepartmentBrand;
  setDepartmentId: (id: string) => void;
}

const DepartmentContext = createContext<DepartmentContextType | undefined>(undefined);

function readStoredDepartmentId(): string {
  try {
    const stored = localStorage.getItem(DEPARTMENT_STORAGE_KEY);
    if (stored && DEPARTMENT_BRANDS.some((d) => d.id === stored)) {
      return stored;
    }
  } catch {
    // ignore storage failures
  }
  return DEFAULT_DEPARTMENT_ID;
}

export function DepartmentProvider({ children }: { children: ReactNode }) {
  const [departmentId, setDepartmentIdState] = useState(readStoredDepartmentId);

  const setDepartmentId = useCallback((id: string) => {
    setDepartmentIdState(id);
    try {
      localStorage.setItem(DEPARTMENT_STORAGE_KEY, id);
    } catch {
      // ignore storage failures
    }
  }, []);

  const department = useMemo(() => getDepartmentById(departmentId), [departmentId]);

  const value = useMemo(
    () => ({ department, setDepartmentId }),
    [department, setDepartmentId],
  );

  return (
    <DepartmentContext.Provider value={value}>
      {children}
    </DepartmentContext.Provider>
  );
}

export function useDepartment() {
  const ctx = useContext(DepartmentContext);
  if (!ctx) throw new Error('useDepartment must be used within DepartmentProvider');
  return ctx;
}
