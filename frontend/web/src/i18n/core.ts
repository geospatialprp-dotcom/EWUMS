import { en } from './locales/en';
import { hi } from './locales/hi';
import type { AppLocale } from './types';
import { LOCALE_STORAGE_KEY } from './types';

export type Messages = typeof en;

const catalogs: Record<AppLocale, Messages> = { en, hi };

let activeLocale: AppLocale = readStoredLocale();

function readStoredLocale(): AppLocale {
  if (typeof window === 'undefined') return 'en';
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  return stored === 'hi' ? 'hi' : 'en';
}

export function getLocale(): AppLocale {
  return activeLocale;
}

export function setActiveLocale(locale: AppLocale) {
  activeLocale = locale;
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    document.documentElement.lang = locale === 'hi' ? 'hi' : 'en';
    window.dispatchEvent(new CustomEvent('egip-locale-change', { detail: locale }));
    if (locale === 'hi') {
      localStorage.setItem('jal_mitra_lang', 'hi');
    } else {
      localStorage.setItem('jal_mitra_lang', 'en');
    }
  }
}

export function initLocale() {
  activeLocale = readStoredLocale();
  if (typeof document !== 'undefined') {
    document.documentElement.lang = activeLocale === 'hi' ? 'hi' : 'en';
  }
}

function getByPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((cur, part) => {
    if (cur == null || typeof cur !== 'object') return undefined;
    return (cur as Record<string, unknown>)[part];
  }, obj);
}

function interpolate(template: string, params?: Record<string, string | number>) {
  if (!params) return template;
  return Object.entries(params).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

export function translate(
  locale: AppLocale,
  key: string,
  params?: Record<string, string | number>,
): string {
  const value = getByPath(catalogs[locale], key) ?? getByPath(catalogs.en, key);
  if (typeof value === 'string') return interpolate(value, params);
  return key;
}

export function translateList(locale: AppLocale, key: string): string[] {
  const value = getByPath(catalogs[locale], key) ?? getByPath(catalogs.en, key);
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function acceptLanguageHeader(locale: AppLocale = getLocale()): string {
  return locale === 'hi' ? 'hi-IN,hi;q=0.9,en;q=0.8' : 'en-IN,en;q=0.9,hi;q=0.7';
}
