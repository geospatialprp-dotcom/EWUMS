export const MOBILE_BILLING_FEATURES = [
  { code: 'meter_reading', label: 'Capture Meter Reading' },
  { code: 'payment', label: 'Collect Payments' },
  { code: 'receipt', label: 'Generate Receipt' },
  { code: 'gps', label: 'Capture GPS' },
  { code: 'signature', label: 'Capture Consumer Signature' },
  { code: 'thumb_impression', label: 'Thumb Impression (if cannot sign)' },
  { code: 'photo', label: 'Upload Meter Photos' },
  { code: 'offline', label: 'Offline Mode Supported' },
] as const;

export const MOBILE_FIELD_PAYMENT_MODES = [
  { code: 'cash', label: 'Cash Collection', gateway: false },
  { code: 'upi', label: 'UPI', gateway: true },
  { code: 'qr_code', label: 'QR Code Payment', gateway: true },
  { code: 'pos', label: 'POS Machine', gateway: false },
  { code: 'csc', label: 'CSC Payment', gateway: false },
] as const;

export const MOBILE_GATEWAY_PAYMENT_MODES = MOBILE_FIELD_PAYMENT_MODES
  .filter((m) => m.gateway)
  .map((m) => m.code);

export function isMobileGatewayPaymentMode(mode: string) {
  return MOBILE_GATEWAY_PAYMENT_MODES.includes(mode as (typeof MOBILE_GATEWAY_PAYMENT_MODES)[number]);
}

export const MOBILE_OFFLINE_STORAGE_KEY = 'egip_mobile_billing_queue_v1';

export type MobileOfflineItemType = 'meter_reading' | 'payment';

export type MobileOfflineQueueItem = {
  offlineId: string;
  type: MobileOfflineItemType;
  consumerId: string;
  consumerLabel: string;
  capturedAt: string;
  payload: Record<string, unknown>;
  photoDataUrl?: string;
};
