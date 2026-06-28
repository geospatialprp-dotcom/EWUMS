export type AppLocale = 'en' | 'hi';

export const LOCALE_STORAGE_KEY = 'egip_locale';

export const SUPPORTED_LOCALES: Array<{ id: AppLocale; label: string }> = [
  { id: 'en', label: 'English' },
  { id: 'hi', label: 'हिन्दी' },
];
