import type { Request } from 'express';
import type { JalMitraLang } from './jal-mitra-i18n';

export function resolveRequestLocale(req: Request): 'en' | 'hi' | undefined {
  const header = req.headers['accept-language'];
  if (!header) return undefined;
  const value = Array.isArray(header) ? header.join(',') : header;
  const primary = value.split(',')[0]?.trim().toLowerCase() ?? '';
  if (primary.startsWith('hi')) return 'hi';
  if (primary.startsWith('en')) return 'en';
  return undefined;
}

export function resolveJalMitraLanguage(
  req: Request,
  explicit?: JalMitraLang,
): JalMitraLang | undefined {
  if (explicit) return explicit;
  return resolveRequestLocale(req);
}
