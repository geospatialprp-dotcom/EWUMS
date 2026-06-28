import { formatInr } from '../constants/omBilling';

type BillRecord = Record<string, unknown>;

function line(label: string, value: string): string {
  return `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee;color:#555;width:45%">${label}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;font-weight:600">${value}</td></tr>`;
}

export function renderBillHtml(bill: BillRecord): string {
  const components = (bill.billComponents ?? {}) as Record<string, unknown>;
  const consumer = (components.consumerDetails ?? {}) as Record<string, unknown>;
  const period = (components.billingPeriod ?? {}) as Record<string, unknown>;
  const fixedBreakdown = (components.fixedChargeBreakdown ?? {}) as Record<string, unknown>;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Bill ${String(bill.billNo ?? '')}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 24px; color: #1a1a1a; }
  h1 { margin: 0 0 4px; font-size: 22px; }
  .meta { color: #666; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  .total td { font-size: 18px; border-top: 2px solid #333; }
  @media print { body { margin: 12mm; } }
</style></head><body>
  <h1>Water Supply Bill</h1>
  <div class="meta">${String(bill.billNo ?? '')} · ${String(bill.billingCycleLabel ?? bill.billingCycle ?? 'Monthly')}</div>
  <table>
    ${line('Consumer ID', String(consumer.consumerCode ?? bill.consumerCode ?? '—'))}
    ${line('FHTC Number', String(consumer.fhtcNumber ?? bill.fhtcNumber ?? '—'))}
    ${line('Household Head', String(consumer.consumerName ?? bill.consumerName ?? '—'))}
    ${line('Village / Ward', `${String(consumer.village ?? bill.village ?? '—')} / ${String(consumer.ward ?? '—')}`)}
    ${line('Billing Period', `${String(period.from ?? bill.billingPeriodFrom ?? '—')} to ${String(period.to ?? bill.billingPeriodTo ?? '—')}`)}
    ${line('Previous Reading (KL)', String(components.previousReading ?? bill.previousReading ?? '—'))}
    ${line('Current Reading (KL)', String(components.currentReading ?? bill.currentReading ?? '—'))}
    ${line('Consumption (KL)', String(components.consumptionKl ?? bill.consumptionKl ?? '—'))}
    ${line('Water Charges', formatInr(Number(components.waterCharges ?? bill.waterCharge ?? 0)))}
    ${line('Fixed Charge', formatInr(Number(fixedBreakdown.fixed ?? bill.fixedCharge ?? 0)))}
    ${line('Service Charge', formatInr(Number(fixedBreakdown.service ?? bill.serviceCharge ?? 0)))}
    ${line('Maintenance Charge', formatInr(Number(fixedBreakdown.maintenance ?? bill.maintenanceCharge ?? 0)))}
    ${line('Meter Rent', formatInr(Number(fixedBreakdown.meterRent ?? bill.meterRent ?? 0)))}
    ${line('Taxes', formatInr(Number(components.taxes ?? bill.taxAmount ?? 0)))}
    ${line('Penalty', formatInr(Number(components.penalty ?? bill.penaltyAmount ?? 0)))}
    ${line('Outstanding Arrears', formatInr(Number(components.outstandingArrears ?? bill.arrearsAmount ?? 0)))}
    ${line('Total Demand', formatInr(Number(components.totalDemand ?? bill.totalAmount ?? 0)))}
    ${line('Due Date', String(bill.dueDate ?? '—'))}
  </table>
</body></html>`;
}

export function openBillPrintView(bill: BillRecord): boolean {
  const html = renderBillHtml(bill);
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  iframe.style.opacity = '0';
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const doc = iframe.contentDocument ?? frameWindow?.document;
  if (!doc || !frameWindow) {
    document.body.removeChild(iframe);
    downloadBillHtml(bill);
    return false;
  }

  doc.open();
  doc.write(html);
  doc.close();

  const cleanup = () => {
    if (iframe.parentNode) document.body.removeChild(iframe);
  };

  frameWindow.focus();
  frameWindow.print();
  frameWindow.addEventListener('afterprint', cleanup, { once: true });
  setTimeout(cleanup, 3000);
  return true;
}

export function downloadBillHtml(bill: BillRecord): void {
  const html = renderBillHtml(bill);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${String(bill.billNo ?? 'bill')}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

export function buildBillNotificationText(bill: BillRecord): string {
  const components = (bill.billComponents ?? {}) as Record<string, unknown>;
  const consumer = (components.consumerDetails ?? {}) as Record<string, unknown>;
  return [
    `EGIP Water Bill ${String(bill.billNo ?? '')}`,
    `Consumer: ${String(consumer.consumerCode ?? bill.consumerCode ?? '')}`,
    `Period: ${String(bill.billingPeriodFrom ?? '')} to ${String(bill.billingPeriodTo ?? '')}`,
    `Consumption: ${String(bill.consumptionKl ?? components.consumptionKl ?? 0)} KL`,
    `Total Demand: ${formatInr(Number(bill.totalAmount ?? components.totalDemand ?? 0))}`,
    `Due Date: ${String(bill.dueDate ?? '')}`,
  ].join('\n');
}

function normalizeMobile(mobile: string): string {
  const digits = mobile.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.startsWith('91') && digits.length === 12) return digits;
  return digits;
}

export function resolveBillEmail(bill: BillRecord): string | null {
  const components = (bill.billComponents ?? {}) as Record<string, unknown>;
  const consumer = (components.consumerDetails ?? {}) as Record<string, unknown>;
  const code = String(consumer.consumerCode ?? bill.consumerCode ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return code ? `${code}@egip.local` : null;
}

export function openSmsApp(mobile: string, message: string): boolean {
  const digits = mobile.replace(/\D/g, '');
  if (!digits) return false;
  window.location.href = `sms:${digits}?body=${encodeURIComponent(message)}`;
  return true;
}

export function openWhatsAppApp(mobile: string, message: string): boolean {
  const num = normalizeMobile(mobile);
  if (!num) return false;
  window.open(`https://wa.me/${num}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  return true;
}

export function openEmailApp(email: string, billNo: string, message: string): boolean {
  if (!email) return false;
  window.location.href = `mailto:${email}?subject=${encodeURIComponent(`Water Bill ${billNo}`)}&body=${encodeURIComponent(message)}`;
  return true;
}
