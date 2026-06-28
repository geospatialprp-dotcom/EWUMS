import axios from 'axios';
import { featureClassesApi } from '../services/api';
import { formatApiError } from './apiError';
import { OUTSIDE_DISTRICT_LAYER_MESSAGE } from './jurisdictionGeometry';

export type ImportFeaturePayload = Array<{
  geometry: object;
  attributes: Record<string, unknown>;
}>;

export function summarizeImportFailures(failed: Array<{ index: number; reason: string }>) {
  if (!failed.length) return '';
  const byReason = new Map<string, number>();
  failed.forEach((item) => {
    byReason.set(item.reason, (byReason.get(item.reason) ?? 0) + 1);
  });
  const parts = [...byReason.entries()].map(([reason, count]) => (
    count > 1 ? `${reason} (${count}×)` : reason
  ));
  return parts.join('; ');
}

function isOutsideDistrictError(message: string): boolean {
  return /outside your authorized district boundary/i.test(message);
}

function shouldStopImport(err: unknown, message: string): boolean {
  if (isOutsideDistrictError(message)) return true;
  if (axios.isAxiosError(err) && err.response?.status === 403) return true;
  return /entity too large|413|too large/i.test(message);
}

export async function importFeaturesInBatches(
  projectId: string,
  classId: string,
  features: ImportFeaturePayload,
  batchSize = 5,
): Promise<{ imported: number; failed: Array<{ index: number; reason: string }>; total: number }> {
  let imported = 0;
  const failed: Array<{ index: number; reason: string }> = [];

  for (let offset = 0; offset < features.length; offset += batchSize) {
    const batch = features.slice(offset, offset + batchSize);
    try {
      const res = await featureClassesApi.importFeatures(projectId, classId, { features: batch });
      const result = res.data as {
        imported: number;
        failed: Array<{ index: number; reason: string }>;
        total: number;
      };
      imported += result.imported;
      result.failed?.forEach((item) => {
        failed.push({ index: item.index + offset, reason: item.reason });
      });
    } catch (err) {
      const message = formatApiError(err, 'Import batch failed');
      if (shouldStopImport(err, message)) {
        throw new Error(message || OUTSIDE_DISTRICT_LAYER_MESSAGE);
      }
      batch.forEach((_, index) => {
        failed.push({ index: offset + index, reason: message });
      });
    }
  }

  if (!imported) {
    const uniqueReasons = [...new Set(failed.map((item) => item.reason).filter(Boolean))];
    throw new Error(uniqueReasons[0] ?? 'No features were imported.');
  }

  return { imported, failed, total: features.length };
}
