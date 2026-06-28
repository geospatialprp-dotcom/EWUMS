import axios from 'axios';
import { getLocale, translate } from '../i18n';

type FailedImportItem = { index?: number; reason: string };

type NestImportErrorPayload = {
  message?: string;
  imported?: number;
  failed?: FailedImportItem[];
};

function formatFailedReasons(failed: FailedImportItem[] | undefined) {
  if (!failed?.length) return null;
  const byReason = new Map<string, number>();
  failed.forEach((item) => {
    byReason.set(item.reason, (byReason.get(item.reason) ?? 0) + 1);
  });
  return [...byReason.entries()]
    .map(([reason, count]) => (count > 1 ? `${reason} (${count}×)` : reason))
    .join('; ');
}

export function formatApiError(err: unknown, fallbackKey = 'errors.requestFailed'): string {
  const locale = getLocale();
  const fallback = translate(locale, fallbackKey);

  if (axios.isAxiosError(err)) {
    if (err.response?.status === 413) {
      return translate(locale, 'errors.uploadTooLarge');
    }
    if (err.response?.status === 403) {
      const data = err.response?.data as Record<string, unknown> | undefined;
      if (typeof data?.message === 'string') return data.message;
      if (Array.isArray(data?.message)) return data.message.join(', ');
      return translate(locale, 'errors.boundaryDenied');
    }
    const data = err.response?.data as Record<string, unknown> | undefined;
    if (!data) return fallback;

    const nested = data.message;
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      const payload = nested as NestImportErrorPayload;
      const failedMessage = formatFailedReasons(payload.failed);
      if (failedMessage) return failedMessage;
      if (typeof payload.message === 'string') return payload.message;
    }

    const topLevelFailed = formatFailedReasons(data.failed as FailedImportItem[] | undefined);
    if (topLevelFailed) return topLevelFailed;

    if (Array.isArray(data.message)) return data.message.join(', ');
    if (typeof data.message === 'string') {
      if (/entity too large/i.test(data.message)) {
        return translate(locale, 'errors.geometryTooLarge');
      }
      return data.message;
    }
    if (typeof data === 'string' && /entity too large/i.test(data)) {
      return translate(locale, 'errors.geometryTooLargeRetry');
    }
  }

  return err instanceof Error ? err.message : fallback;
}
