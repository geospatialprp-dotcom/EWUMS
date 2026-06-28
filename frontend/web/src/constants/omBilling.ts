/** Billing & Revenue (mirrors backend om-billing-catalog) */

export const OM_CONSUMER_CATEGORIES = [
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

export const OM_BILLING_CYCLES = [
  { code: 'monthly', label: 'Monthly' },
  { code: 'quarterly', label: 'Quarterly' },
  { code: 'half_yearly', label: 'Half-Yearly' },
];

export const OM_BILL_STATUSES = [
  { code: 'generated', label: 'Generated' },
  { code: 'approved', label: 'Approved' },
  { code: 'issued', label: 'Issued' },
  { code: 'paid', label: 'Paid' },
  { code: 'partial', label: 'Partially Paid' },
  { code: 'overdue', label: 'Overdue' },
  { code: 'waived', label: 'Waived' },
];

export const OM_PAYMENT_MODES = [
  { code: 'upi', label: 'UPI' },
  { code: 'net_banking', label: 'Net Banking' },
  { code: 'debit_card', label: 'Debit Card' },
  { code: 'credit_card', label: 'Credit Card' },
  { code: 'qr_code', label: 'QR Code Payment' },
  { code: 'csc', label: 'CSC Payment' },
  { code: 'cash', label: 'Cash Collection' },
  { code: 'pos', label: 'POS Machine' },
];

export const OM_METER_CONDITIONS = [
  { code: 'normal', label: 'Normal' },
  { code: 'damaged', label: 'Damaged' },
  { code: 'tampered', label: 'Tampered' },
  { code: 'inaccessible', label: 'Inaccessible' },
];

export const METER_VALIDATION_LABELS: Record<string, string> = {
  negativeReading: 'Negative Reading',
  readingLessThanPrevious: 'Reading Decreased',
  zeroConsumption: 'Zero Consumption',
  abnormalConsumption: 'Abnormal Consumption',
  meterTampering: 'Meter Tampering',
};

export const EMPTY_READING_FORM = {
  consumerId: '',
  readingDate: new Date().toISOString().slice(0, 10),
  readingMethod: 'manual',
  previousReading: '',
  currentReading: '',
  latitude: '',
  longitude: '',
  meterCondition: 'normal',
  photoUrl: '',
  notes: '',
};

export function previewMeterReadingValidation(
  previous: number | null,
  current: number | null,
  meterCondition: string,
): { consumption: number | null; valid: boolean; isAbnormal: boolean; alerts: string[] } {
  if (current == null || Number.isNaN(current)) {
    return { consumption: null, valid: true, isAbnormal: false, alerts: [] };
  }
  const prev = previous != null && !Number.isNaN(previous) ? previous : null;
  const result = validateMeterReadingLocal(prev, current, meterCondition);
  const consumption = prev != null ? Math.round((current - prev) * 1000) / 1000 : null;
  return { consumption, valid: result.valid, isAbnormal: result.isAbnormal, alerts: result.alerts };
}

function validateMeterReadingLocal(
  previous: number | null,
  current: number,
  meterCondition?: string,
): { valid: boolean; isAbnormal: boolean; alerts: string[] } {
  const flags = {
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
  return {
    valid: !flags.negativeReading && !flags.readingLessThanPrevious,
    isAbnormal: flags.zeroConsumption || flags.abnormalConsumption || flags.meterTampering,
    alerts,
  };
}

export const OM_READING_METHODS = [
  { code: 'mobile_app', label: 'Mobile App Entry' },
  { code: 'smart_meter', label: 'Smart Meter Integration' },
  { code: 'amr', label: 'AMR Meter' },
  { code: 'iot_meter', label: 'IoT Meter' },
  { code: 'manual', label: 'Manual Reading' },
];

export const OM_BILLING_WORKFLOW = [
  { step: 'meter_reading', label: 'Meter Reading' },
  { step: 'consumption', label: 'Consumption Calculation' },
  { step: 'tariff', label: 'Tariff Application' },
  { step: 'generation', label: 'Bill Generation' },
  { step: 'approval', label: 'Approval' },
  { step: 'notification', label: 'Consumer Notification' },
];

export const OM_BILL_DELIVERY_CHANNELS = [
  { code: 'pdf', label: 'Digital Bill PDF' },
  { code: 'sms', label: 'SMS Notification' },
  { code: 'whatsapp', label: 'WhatsApp Bill' },
  { code: 'email', label: 'Email Bill' },
];

export type OmBillingCycle = 'monthly' | 'quarterly' | 'half_yearly';

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

const defaultPeriod = computeBillingPeriod('monthly');

export const EMPTY_GENERATE_FORM = {
  billingCycle: 'monthly' as OmBillingCycle,
  billingPeriodFrom: defaultPeriod.billingPeriodFrom,
  billingPeriodTo: defaultPeriod.billingPeriodTo,
  dueDate: defaultPeriod.dueDate,
};

export function workflowStepIndex(step: string | undefined): number {
  if (!step) return 3;
  const idx = OM_BILLING_WORKFLOW.findIndex((w) => w.step === step);
  return idx >= 0 ? idx : 3;
}

export function collectionWorkflowStepIndex(step: string | undefined): number {
  if (!step) return 4;
  const idx = OM_COLLECTION_WORKFLOW.findIndex((w) => w.step === step);
  return idx >= 0 ? idx : 4;
}

export const OM_COLLECTION_WORKFLOW = [
  { step: 'payment_received', label: 'Payment Received' },
  { step: 'receipt_generated', label: 'Receipt Generated' },
  { step: 'ledger_update', label: 'Ledger Update' },
  { step: 'demand_adjustment', label: 'Demand Adjustment' },
  { step: 'notification', label: 'Consumer Notification' },
];

export const OM_ARREAR_BUCKETS = [
  { code: '30_days', label: '30 Days', minDays: 1, maxDays: 30 },
  { code: '60_days', label: '60 Days', minDays: 31, maxDays: 60 },
  { code: '90_days', label: '90 Days', minDays: 61, maxDays: 90 },
  { code: '180_days', label: '180 Days', minDays: 91, maxDays: 180 },
  { code: 'above_1_year', label: 'Above 1 Year', minDays: 181, maxDays: null },
];

export const OM_ARREAR_ACTIONS = [
  { code: 'reminder_sms', label: 'Reminder SMS', channel: 'sms' as const },
  { code: 'whatsapp_reminder', label: 'WhatsApp Reminder', channel: 'whatsapp' as const },
  { code: 'demand_notice', label: 'Demand Notice', channel: 'sms' as const },
  { code: 'disconnection_notice', label: 'Disconnection Notice', channel: 'sms' as const },
];

export const OM_ARREAR_VIEWS = [
  { code: 'arrear_register', label: 'Arrear Register' },
  { code: 'consumer_aging', label: 'Consumer Aging Report' },
  { code: 'defaulter_list', label: 'Defaulter List' },
];

export const OM_DEMAND_REGISTER_VIEWS = [
  { code: 'village', label: 'Village-wise Demand' },
  { code: 'scheme', label: 'Scheme-wise Demand' },
  { code: 'consumer', label: 'Consumer-wise Demand' },
  { code: 'month', label: 'Monthly Demand Register' },
];

export type OmDemandGroupBy = 'village' | 'scheme' | 'consumer' | 'month';

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

export function gisRevenueLayerColor(layer: string, properties?: Record<string, unknown>): string {
  if (layer === 'fhtc') {
    const status = String(properties?.connectionStatus ?? '');
    if (status === 'active') return '#16a34a';
    if (status === 'pending') return '#f59e0b';
    if (status === 'disconnected') return '#64748b';
    return '#2563eb';
  }
  if (layer === 'billing') {
    const status = String(properties?.billingStatus ?? '');
    if (status === 'paid') return '#16a34a';
    if (status === 'overdue') return '#dc2626';
    if (status === 'partial') return '#f59e0b';
    return '#0ea5e9';
  }
  if (layer === 'collection') {
    const status = String(properties?.collectionStatus ?? '');
    if (status === 'collected') return '#16a34a';
    if (status === 'partial') return '#f59e0b';
    if (status === 'pending') return '#ef4444';
    return '#94a3b8';
  }
  if (layer === 'defaulter') return '#dc2626';
  if (layer === 'meter') return '#7c3aed';
  if (layer === 'heatmap') {
    const intensity = Number(properties?.intensity ?? 0);
    if (intensity > 0.75) return '#b91c1c';
    if (intensity > 0.5) return '#ea580c';
    if (intensity > 0.25) return '#f59e0b';
    return '#fde68a';
  }
  return '#2563eb';
}

/** Revenue KPIs dashboard — monitored indicators */
export const OM_REVENUE_KPI_GROUPS = [
  { key: 'consumers', label: 'Consumer Connections' },
  { key: 'revenue', label: 'Revenue & Collection' },
  { key: 'arrears', label: 'Arrears & Recovery' },
  { key: 'efficiency', label: 'Efficiency & Cost Recovery' },
] as const;

export const OM_REVENUE_KPI_DEFINITIONS = [
  { key: 'totalConsumers', label: 'Total Consumers', group: 'consumers', format: 'count' as const, tone: 'teal' as const },
  { key: 'activeConsumers', label: 'Active Consumers', group: 'consumers', format: 'count' as const, tone: 'blue' as const },
  { key: 'meteredConnections', label: 'Metered Connections', group: 'consumers', format: 'count' as const, tone: 'blue' as const },
  { key: 'unmeteredConnections', label: 'Unmetered Connections', group: 'consumers', format: 'count' as const, tone: 'amber' as const },
  { key: 'monthlyDemand', label: 'Monthly Demand', group: 'revenue', format: 'currency' as const, tone: 'violet' as const },
  { key: 'monthlyCollection', label: 'Monthly Collection', group: 'revenue', format: 'currency' as const, tone: 'teal' as const },
  { key: 'collectionEfficiencyPct', label: 'Collection Efficiency (%)', group: 'revenue', format: 'percent' as const, tone: 'amber' as const },
  { key: 'revenueRealizationPct', label: 'Revenue Realization (%)', group: 'revenue', format: 'percent' as const, tone: 'teal' as const },
  { key: 'outstandingArrears', label: 'Outstanding Arrears', group: 'arrears', format: 'currency' as const, tone: 'rose' as const },
  { key: 'defaulterCount', label: 'Defaulter Count', group: 'arrears', format: 'count' as const, tone: 'rose' as const },
  { key: 'nrwPct', label: 'NRW (Non-Revenue Water)', group: 'efficiency', format: 'percent' as const, tone: 'amber' as const },
  { key: 'costRecoveryRatioPct', label: 'Cost Recovery Ratio', group: 'efficiency', format: 'percent' as const, tone: 'violet' as const },
  { key: 'monthlyOmCost', label: 'Monthly O&M Cost', group: 'efficiency', format: 'currency' as const, tone: 'blue' as const },
] as const;

export function formatRevenueKpiValue(
  key: string,
  format: 'count' | 'currency' | 'percent',
  summary: Record<string, unknown>,
): string {
  const value = summary[key];
  if (value == null) return '—';
  if (format === 'currency') return formatInr(Number(value));
  if (format === 'percent') return `${value}%`;
  return String(value);
}

export function nrwStatusColor(nrwPct: number | null | undefined, threshold = OM_NRW_EFFICIENCY_THRESHOLD_PCT): 'success' | 'warning' | 'error' | 'default' {
  if (nrwPct == null) return 'default';
  const efficiency = 100 - nrwPct;
  if (efficiency >= threshold) return 'success';
  if (efficiency >= threshold - 15) return 'warning';
  return 'error';
}

/** Stage 15.12 — Billing & Revenue Reports */
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

export const OM_BILLING_REPORT_GROUP_LABELS: Record<string, string> = {
  registers: 'Registers',
  demand: 'Demand',
  collection: 'Collection',
  arrears: 'Arrears & Recovery',
  analytics: 'Revenue Analytics',
  ledger: 'Ledger',
  audit: 'Audit',
};

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
  { type: 'revenue_efficiency', label: 'Revenue Efficiency' },
  { type: 'village_revenue', label: 'Village-wise Revenue' },
  { type: 'scheme_revenue', label: 'Scheme-wise Revenue' },
  { type: 'consumer_ledger', label: 'Consumer Ledger' },
  { type: 'payment_receipt_register', label: 'Payment Receipt Register' },
  { type: 'financial_audit', label: 'Financial Audit' },
  { type: 'gis_revenue', label: 'Revenue GIS Dashboard Export' },
];

export type TariffSlab = { fromKl: number; toKl: number | null; ratePerKl: number };

export const DEFAULT_TARIFF_SLABS: TariffSlab[] = [
  { fromKl: 0, toKl: 10, ratePerKl: 5 },
  { fromKl: 10, toKl: 20, ratePerKl: 8 },
  { fromKl: 20, toKl: null, ratePerKl: 12 },
];

export function formatSlabRange(fromKl: number, toKl: number | null): string {
  if (toKl == null) return `Above ${fromKl} KL`;
  return `${fromKl}–${toKl} KL`;
}

export function formatSlabSummary(slabs: TariffSlab[]): string {
  return slabs.map((s) => `${formatSlabRange(s.fromKl, s.toKl)} @ ₹${s.ratePerKl}/KL`).join(' · ');
}

export const EMPTY_TARIFF_FORM = {
  tariffName: 'Standard Domestic Tariff',
  billingCycle: 'monthly',
  consumerCategory: '',
  fixedCharge: '50',
  serviceCharge: '20',
  maintenanceCharge: '10',
  meterRent: '15',
  latePenaltyPct: '2',
  reconnectionCharge: '500',
  newConnectionCharge: '1000',
  taxPct: '0',
  effectiveFrom: new Date().toISOString().slice(0, 10),
  slabs: DEFAULT_TARIFF_SLABS.map((s) => ({
    fromKl: String(s.fromKl),
    toKl: s.toKl != null ? String(s.toKl) : '',
    ratePerKl: String(s.ratePerKl),
  })),
};

export function billStatusColor(status: string): 'default' | 'success' | 'warning' | 'error' | 'info' {
  if (status === 'paid') return 'success';
  if (status === 'overdue' || status === 'partial') return 'error';
  if (status === 'issued' || status === 'approved') return 'info';
  if (status === 'generated') return 'warning';
  return 'default';
}

export function formatInr(amount: number | null | undefined): string {
  if (amount == null) return '—';
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
