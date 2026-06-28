import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  getLocale,
  initLocale,
  setActiveLocale,
  translate,
  type AppLocale,
} from '../i18n';

type LanguageContextValue = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>(() => {
    initLocale();
    return getLocale();
  });

  useEffect(() => {
    const onLocaleChange = (event: Event) => {
      const next = (event as CustomEvent<AppLocale>).detail;
      if (next === 'en' || next === 'hi') setLocaleState(next);
    };
    window.addEventListener('egip-locale-change', onLocaleChange);
    return () => window.removeEventListener('egip-locale-change', onLocaleChange);
  }, []);

  const setLocale = useCallback((next: AppLocale) => {
    setActiveLocale(next);
    setLocaleState(next);
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(locale, key, params),
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useTranslation() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useTranslation must be used within LanguageProvider');
  }
  return ctx;
}

export function useOptionalTranslation() {
  return useContext(LanguageContext);
}
