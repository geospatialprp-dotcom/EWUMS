export type OmConsumerCategory = 'bpl' | 'apl' | 'government' | 'commercial' | 'institutional';
export type OmBillingCycle = 'monthly' | 'quarterly' | 'half_yearly';
export type OmBillStatus = 'generated' | 'approved' | 'issued' | 'paid' | 'partial' | 'overdue' | 'waived';
export type OmPaymentMode = 'upi' | 'net_banking' | 'debit_card' | 'credit_card' | 'qr_code' | 'csc' | 'cash' | 'pos';
export type OmReadingMethod = 'mobile_app' | 'smart_meter' | 'amr' | 'iot_meter' | 'manual';
export type OmArrearBucket = '30_days' | '60_days' | '90_days' | '180_days' | 'above_1_year';
export type OmArrearAction = 'reminder_sms' | 'whatsapp_reminder' | 'demand_notice' | 'disconnection_notice';

export interface TariffSlab {
  fromKl: number;
  toKl: number | null;
  ratePerKl: number;
}

export const OM_CONSUMER_CATEGORIES: Array<{ code: OmConsumerCategory; label: string }> = [
  { code: 'bpl', label: 'BPL' },
  { code: 'apl', label: 'APL' },
  { code: 'government', label: 'Government' },
  { code: 'commercial', label: 'Commercial' },
  { code: 'institutional', label: 'Institutional' },
];

export const OM_CONNECTION_STATUSES = [
  { code: 'active', label: 'Active' },
  { code: 'inactive', label: 'Inactive' },
  { code: 'disconnected', label: 'Disconnected' },
  { code: 'temporary_suspension', label: 'Temporary Suspension' },
  { code: 'pending', label: 'Pending' },
];

export const OM_BILLING_CYCLES: Array<{ code: OmBillingCycle; label: string }> = [
  { code: 'monthly', label: 'Monthly' },
  { code: 'quarterly', label: 'Quarterly' },
  { code: 'half_yearly', label: 'Half-Yearly' },
];

export const OM_BILL_STATUSES: Array<{ code: OmBillStatus; label: string }> = [
  { code: 'generated', label: 'Generated' },
  { code: 'approved', label: 'Approved' },
  { code: 'issued', label: 'Issued' },
  { code: 'paid', label: 'Paid' },
  { code: 'partial', label: 'Partially Paid' },
  { code: 'overdue', label: 'Overdue' },
  { code: 'waived', label: 'Waived' },
];

export const OM_PAYMENT_MODES: Array<{ code: OmPaymentMode; label: string }> = [
  { code: 'upi', label: 'UPI' },
  { code: 'net_banking', label: 'Net Banking' },
  { code: 'debit_card', label: 'Debit Card' },
  { code: 'credit_card', label: 'Credit Card' },
  { code: 'qr_code', label: 'QR Code Payment' },
  { code: 'csc', label: 'CSC Payment' },
  { code: 'cash', label: 'Cash Collection' },
  { code: 'pos', label: 'POS Machine' },
];

/** Digital modes routed through Razorpay (or demo gateway in development). */
export const OM_PAYMENT_GATEWAY_MODES = ['upi', 'net_banking', 'debit_card', 'credit_card', 'qr_code'] as const;
export type OmPaymentGatewayMode = (typeof OM_PAYMENT_GATEWAY_MODES)[number];

export const OM_READING_METHODS: Array<{ code: OmReadingMethod; label: string }> = [
  { code: 'mobile_app', label: 'Mobile App Entry' },
  { code: 'smart_meter', label: 'Smart Meter Integration' },
  { code: 'amr', label: 'AMR Meter' },
  { code: 'iot_meter', label: 'IoT Meter' },
  { code: 'manual', label: 'Manual Reading' },
];

export const OM_METER_CONDITIONS = [
  { code: 'normal', label: 'Normal' },
  { code: 'damaged', label: 'Damaged' },
  { code: 'tampered', label: 'Tampered' },
  { code: 'inaccessible', label: 'Inaccessible' },
];

export const OM_ARREAR_BUCKETS: Array<{ code: OmArrearBucket; label: string; minDays: number; maxDays: number | null }> = [
  { code: '30_days', label: '30 Days', minDays: 1, maxDays: 30 },
  { code: '60_days', label: '60 Days', minDays: 31, maxDays: 60 },
  { code: '90_days', label: '90 Days', minDays: 61, maxDays: 90 },
  { code: '180_days', label: '180 Days', minDays: 91, maxDays: 180 },
  { code: 'above_1_year', label: 'Above 1 Year', minDays: 181, maxDays: null },
];

export const OM_ARREAR_ACTIONS: Array<{ code: OmArrearAction; label: string; channel: 'sms' | 'whatsapp' }> = [
  { code: 'reminder_sms', label: 'Reminder SMS', channel: 'sms' },
  { code: 'whatsapp_reminder', label: 'WhatsApp Reminder', channel: 'whatsapp' },
  { code: 'demand_notice', label: 'Demand Notice', channel: 'sms' },
  { code: 'disconnection_notice', label: 'Disconnection Notice', channel: 'sms' },
];

export const OM_BILLING_WORKFLOW = [
  { step: 'meter_reading', label: 'Meter Reading' },
  { step: 'consumption', label: 'Consumption Calculation' },
  { step: 'tariff', label: 'Tariff Application' },
  { step: 'generation', label: 'Bill Generation' },
  { step: 'approval', label: 'Approval' },
  { step: 'notification', label: 'Consumer Notification' },
];

export const OM_COLLECTION_WORKFLOW = [
  { step: 'payment_received', label: 'Payment Received' },
  { step: 'receipt_generated', label: 'Receipt Generated' },
  { step: 'ledger_update', label: 'Ledger Update' },
  { step: 'demand_adjustment', label: 'Demand Adjustment' },
  { step: 'notification', label: 'Consumer Notification' },
];

export const OM_BILL_DELIVERY_CHANNELS = [
  { code: 'pdf', label: 'Digital Bill PDF' },
  { code: 'sms', label: 'SMS Notification' },
  { code: 'whatsapp', label: 'WhatsApp Bill' },
  { code: 'email', label: 'Email Bill' },
];

export const OM_DEMAND_REGISTER_VIEWS = [
  { code: 'village', label: 'Village-wise Demand' },
  { code: 'scheme', label: 'Scheme-wise Demand' },
  { code: 'consumer', label: 'Consumer-wise Demand' },
  { code: 'month', label: 'Monthly Demand Register' },
];

export type OmDemandGroupBy = 'village' | 'scheme' | 'consumer' | 'month';

export function computeBillingPeriod(
  cycle: OmBillingCycle,
  referenceDate: Date = new Date(),
): { billingPeriodFrom: string; billingPeriodTo: string; dueDate: string } {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();

  if (cycle === 'quarterly') {
    const quarterStartMonth = Math.floor(month / 3) * 3;
    const from = new Date(year, quarterStartMonth, 1);
    const to = new Date(year, quarterStartMonth + 3, 0);
    const due = new Date(year, quarterStartMonth + 3, 15);
    return {
      billingPeriodFrom: formatDateIso(from),
      billingPeriodTo: formatDateIso(to),
      dueDate: formatDateIso(due),
    };
  }

  if (cycle === 'half_yearly') {
    const halfStartMonth = month < 6 ? 0 : 6;
    const from = new Date(year, halfStartMonth, 1);
    const to = new Date(year, halfStartMonth + 6, 0);
    const due = new Date(year, halfStartMonth + 6, 15);
    return {
      billingPeriodFrom: formatDateIso(from),
      billingPeriodTo: formatDateIso(to),
      dueDate: formatDateIso(due),
    };
  }

  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 0);
  const due = new Date(year, month + 1, 15);
  return {
    billingPeriodFrom: formatDateIso(from),
    billingPeriodTo: formatDateIso(to),
    dueDate: formatDateIso(due),
  };
}

function formatDateIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getWorkflowStepForBillStatus(status: string): string {
  if (status === 'generated') return 'generation';
  if (status === 'approved') return 'approval';
  if (['issued', 'paid', 'partial', 'overdue'].includes(status)) return 'notification';
  return 'generation';
}

export const OM_GIS_REVENUE_LAYERS = [
  { code: 'fhtc', label: 'FHTC Connections', color: '#2563eb', description: 'Household tap connection points' },
  { code: 'meter', label: 'Meter Locations', color: '#7c3aed', description: 'GPS-tagged meter reading locations' },
  { code: 'billing', label: 'Billing Status', color: '#0ea5e9', description: 'Latest bill status per consumer' },
  { code: 'collection', label: 'Collection Status', color: '#16a34a', description: 'Payment collection state' },
  { code: 'defaulter', label: 'Defaulter Locations', color: '#dc2626', description: 'Consumers with overdue balances' },
  { code: 'heatmap', label: 'Revenue Heat Map', color: '#f59e0b', description: 'Revenue intensity grid cells' },
] as const;

export type OmGisRevenueLayerCode = (typeof OM_GIS_REVENUE_LAYERS)[number]['code'];

export const OM_NRW_EFFICIENCY_THRESHOLD_PCT = 70;

/** Revenue KPIs dashboard — monitored indicators */
export const OM_REVENUE_KPI_GROUPS = [
  { key: 'consumers', label: 'Consumer Connections' },
  { key: 'revenue', label: 'Revenue & Collection' },
  { key: 'arrears', label: 'Arrears & Recovery' },
  { key: 'efficiency', label: 'Efficiency & Cost Recovery' },
] as const;

export const OM_REVENUE_KPI_DEFINITIONS = [
  { key: 'totalConsumers', label: 'Total Consumers', group: 'consumers', format: 'count' as const },
  { key: 'activeConsumers', label: 'Active Consumers', group: 'consumers', format: 'count' as const },
  { key: 'meteredConnections', label: 'Metered Connections', group: 'consumers', format: 'count' as const },
  { key: 'unmeteredConnections', label: 'Unmetered Connections', group: 'consumers', format: 'count' as const },
  { key: 'monthlyDemand', label: 'Monthly Demand', group: 'revenue', format: 'currency' as const },
  { key: 'monthlyCollection', label: 'Monthly Collection', group: 'revenue', format: 'currency' as const },
  { key: 'collectionEfficiencyPct', label: 'Collection Efficiency (%)', group: 'revenue', format: 'percent' as const },
  { key: 'revenueRealizationPct', label: 'Revenue Realization (%)', group: 'revenue', format: 'percent' as const },
  { key: 'outstandingArrears', label: 'Outstanding Arrears', group: 'arrears', format: 'currency' as const },
  { key: 'defaulterCount', label: 'Defaulter Count', group: 'arrears', format: 'count' as const },
  { key: 'nrwPct', label: 'NRW (Non-Revenue Water)', group: 'efficiency', format: 'percent' as const },
  { key: 'costRecoveryRatioPct', label: 'Cost Recovery Ratio', group: 'efficiency', format: 'percent' as const },
  { key: 'monthlyOmCost', label: 'Monthly O&M Cost', group: 'efficiency', format: 'currency' as const },
] as const;

/** Stage 15.12 — Billing & Revenue Reports (primary catalog) */
export const OM_BILLING_REVENUE_REPORTS_1512 = [
  { type: 'consumer_register', label: 'Consumer Register', group: 'registers', description: 'All consumer billing accounts with FHTC, GIS, meter and tariff linkage.' },
  { type: 'meter_register', label: 'Meter Register', group: 'registers', description: 'Meter readings with consumption, GPS capture, validation flags and photos.' },
  { type: 'billing_register', label: 'Billing Register', group: 'registers', description: 'Generated bills with demand components, status and balance.' },
  { type: 'demand_register', label: 'Demand Register', group: 'demand', description: 'Aggregated billing demand by village, scheme, consumer or month.' },
  { type: 'collection_register', label: 'Collection Register', group: 'collection', description: 'All payments received with mode-wise collection summary.' },
  { type: 'arrear_register', label: 'Arrear Register', group: 'arrears', description: 'Outstanding bills with aging buckets and balance due.' },
  { type: 'defaulter_report', label: 'Defaulter Report', group: 'arrears', description: 'Consumers with overdue balances eligible for recovery action.' },
  { type: 'revenue_efficiency', label: 'Revenue Efficiency Report', group: 'analytics', description: 'Collection efficiency, demand vs collection and billing KPIs.' },
  { type: 'village_revenue', label: 'Village-wise Revenue Report', group: 'analytics', description: 'Revenue and collection performance grouped by village.' },
  { type: 'scheme_revenue', label: 'Scheme-wise Revenue Report', group: 'analytics', description: 'Revenue and collection performance grouped by water supply scheme.' },
  { type: 'consumer_ledger', label: 'Consumer Ledger', group: 'ledger', description: 'Per-consumer bill and payment history (running account).' },
  { type: 'payment_receipt_register', label: 'Payment Receipt Register', group: 'collection', description: 'Receipt-wise payment acknowledgements with ledger updates.' },
  { type: 'financial_audit', label: 'Financial Audit Reports', group: 'audit', description: 'Billing, collection, arrear and ERP GL audit snapshot.' },
] as const;

export const OM_BILLING_REPORT_TYPES = [
  { type: 'consumer_register', label: 'Consumer Register' },
  { type: 'meter_register', label: 'Meter Register' },
  { type: 'billing_register', label: 'Billing Register' },
  { type: 'demand_register', label: 'Demand Register' },
  { type: 'village_wise_demand', label: 'Village-wise Demand' },
  { type: 'scheme_wise_demand', label: 'Scheme-wise Demand' },
  { type: 'consumer_wise_demand', label: 'Consumer-wise Demand' },
  { type: 'monthly_demand_register', label: 'Monthly Demand Register' },
  { type: 'collection_register', label: 'Collection Register' },
  { type: 'revenue_register', label: 'Revenue Register' },
  { type: 'arrear_register', label: 'Arrear Register' },
  { type: 'consumer_aging_report', label: 'Consumer Aging Report' },
  { type: 'defaulter_report', label: 'Defaulter Report' },
  { type: 'revenue_efficiency', label: 'Revenue Efficiency Report' },
  { type: 'village_revenue', label: 'Village-wise Revenue Report' },
  { type: 'scheme_revenue', label: 'Scheme-wise Revenue Report' },
  { type: 'consumer_ledger', label: 'Consumer Ledger' },
  { type: 'payment_receipt_register', label: 'Payment Receipt Register' },
  { type: 'financial_audit', label: 'Financial Audit Reports' },
  { type: 'gis_revenue', label: 'Revenue GIS Dashboard Export' },
];

export const DEFAULT_TARIFF_SLABS: TariffSlab[] = [
  { fromKl: 0, toKl: 10, ratePerKl: 5 },
  { fromKl: 10, toKl: 20, ratePerKl: 8 },
  { fromKl: 20, toKl: null, ratePerKl: 12 },
];

export function calculateSlabCharge(consumptionKl: number, slabs: TariffSlab[]): number {
  if (consumptionKl <= 0) return 0;
  let remaining = consumptionKl;
  let charge = 0;
  const sorted = [...slabs].sort((a, b) => a.fromKl - b.fromKl);

  for (const slab of sorted) {
    if (remaining <= 0) break;
    const slabSize = slab.toKl != null ? slab.toKl - slab.fromKl : remaining;
    const volume = Math.min(remaining, slabSize);
    charge += volume * slab.ratePerKl;
    remaining -= volume;
  }
  return Math.round(charge * 100) / 100;
}

export function getArrearBucket(daysOverdue: number): OmArrearBucket | null {
  if (daysOverdue <= 0) return null;
  for (const b of OM_ARREAR_BUCKETS) {
    if (b.maxDays == null && daysOverdue >= b.minDays) return b.code;
    if (b.maxDays != null && daysOverdue >= b.minDays && daysOverdue <= b.maxDays) return b.code;
  }
  return 'above_1_year';
}

export function validateMeterReading(
  previous: number | null,
  current: number,
  meterCondition?: string,
): { valid: boolean; flags: Record<string, boolean>; isAbnormal: boolean; alerts: string[] } {
  const flags: Record<string, boolean> = {
    negativeReading: current < 0,
    readingLessThanPrevious: previous != null && current < previous,
    zeroConsumption: previous != null && current === previous,
    abnormalConsumption: previous != null && current - previous > 50,
    meterTampering: meterCondition === 'tampered',
  };
  const alerts: string[] = [];
  if (flags.negativeReading) alerts.push('Negative reading validation failed');
  if (flags.readingLessThanPrevious) alerts.push('Current reading is less than previous reading');
  if (flags.zeroConsumption) alerts.push('Zero consumption alert');
  if (flags.abnormalConsumption) alerts.push('Abnormal consumption detected (> 50 KL)');
  if (flags.meterTampering) alerts.push('Meter tampering detected');
  const isAbnormal = flags.zeroConsumption || flags.abnormalConsumption || flags.meterTampering;
  const valid = !flags.negativeReading && !flags.readingLessThanPrevious;
  return { valid, flags, isAbnormal, alerts };
}
