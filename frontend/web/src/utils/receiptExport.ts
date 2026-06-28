import { formatInr } from '../constants/omBilling';

type PaymentRecord = Record<string, unknown>;

export function renderReceiptHtml(payment: PaymentRecord): string {
  const ack = (payment.acknowledgement ?? {}) as Record<string, unknown>;
  const ledger = (payment.ledgerUpdate ?? {}) as Record<string, unknown>;
  const demand = (payment.demandAdjustment ?? {}) as Record<string, unknown>;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Receipt ${String(payment.receiptNo ?? '')}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 24px; color: #1a1a1a; }
  h1 { margin: 0 0 4px; font-size: 22px; }
  .meta { color: #666; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 8px 12px; border-bottom: 1px solid #eee; }
  td:first-child { color: #555; width: 40%; }
  td:last-child { font-weight: 600; }
</style></head><body>
  <h1>Payment Acknowledgement</h1>
  <div class="meta">${String(payment.receiptNo ?? '')} · ${String(payment.paymentDate ?? '')}</div>
  <table>
    <tr><td>Consumer</td><td>${String(payment.consumerCode ?? '')} — ${String(payment.fhtcNumber ?? '')}</td></tr>
    <tr><td>Name</td><td>${String(payment.consumerName ?? '—')}</td></tr>
    <tr><td>Payment Mode</td><td>${String(payment.paymentModeLabel ?? payment.paymentMode ?? '')}</td></tr>
    <tr><td>Amount</td><td>${formatInr(Number(payment.amount ?? 0))}</td></tr>
    <tr><td>Bill</td><td>${String(payment.billNo ?? ledger.billNo ?? 'General payment')}</td></tr>
    <tr><td>Transaction Ref</td><td>${String(payment.transactionRef ?? '—')}</td></tr>
    <tr><td>Acknowledgement</td><td>${String(ack.message ?? '')}</td></tr>
    <tr><td>Ledger Update</td><td>${ledger.balanceBefore != null ? `Balance ${ledger.balanceBefore} → ${ledger.balanceAfter}` : 'Recorded'}</td></tr>
    <tr><td>Demand Adjustment</td><td>${formatInr(Number(demand.appliedAmount ?? payment.amount ?? 0))}</td></tr>
  </table>
</body></html>`;
}

export function openReceiptPrintView(payment: PaymentRecord): void {
  const html = renderReceiptHtml(payment);
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();
  iframe.contentWindow?.focus();
  iframe.contentWindow?.print();
  setTimeout(() => {
    if (iframe.parentNode) document.body.removeChild(iframe);
  }, 3000);
}
