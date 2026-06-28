export const OM_MOBILE_BILLING_FEATURES = [
  { code: 'meter_reading', label: 'Capture Meter Reading' },
  { code: 'payment', label: 'Collect Payments' },
  { code: 'receipt', label: 'Generate Receipt' },
  { code: 'gps', label: 'Capture GPS' },
  { code: 'signature', label: 'Capture Consumer Signature' },
  { code: 'photo', label: 'Upload Meter Photos' },
  { code: 'offline', label: 'Offline Mode Supported' },
] as const;

export const OM_MOBILE_CAPTURE_SOURCE = 'mobile_billing_app';
