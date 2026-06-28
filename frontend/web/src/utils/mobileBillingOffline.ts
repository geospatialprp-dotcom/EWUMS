import { MOBILE_OFFLINE_STORAGE_KEY, type MobileOfflineQueueItem } from '../constants/mobileBilling';

export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

/** Local calendar date (YYYY-MM-DD) for when the field observation is taken. */
export function localObservationDate(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatObservationDate(date = new Date()): string {
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatObservationTimestamp(date = new Date()): string {
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function observationCaptureMeta(date = new Date()) {
  return {
    readingDate: localObservationDate(date),
    capturedAt: date.toISOString(),
  };
}

export function loadOfflineQueue(): MobileOfflineQueueItem[] {
  try {
    const raw = localStorage.getItem(MOBILE_OFFLINE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MobileOfflineQueueItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveOfflineQueue(items: MobileOfflineQueueItem[]): void {
  localStorage.setItem(MOBILE_OFFLINE_STORAGE_KEY, JSON.stringify(items));
}

export function enqueueOfflineItem(item: MobileOfflineQueueItem): MobileOfflineQueueItem[] {
  const queue = loadOfflineQueue();
  const next = [item, ...queue.filter((q) => q.offlineId !== item.offlineId)];
  saveOfflineQueue(next);
  return next;
}

export function removeOfflineItem(offlineId: string): MobileOfflineQueueItem[] {
  const next = loadOfflineQueue().filter((q) => q.offlineId !== offlineId);
  saveOfflineQueue(next);
  return next;
}

export function createOfflineId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function captureGps(): Promise<{ latitude: number; longitude: number } | null> {
  if (!navigator.geolocation) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  });
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
