import { formatInr } from '../constants/omBilling';

type ArrearRecord = Record<string, unknown>;

export function renderArrearNoticeHtml(
  row: ArrearRecord,
  noticeType: 'demand_notice' | 'disconnection_notice',
): string {
  const title = noticeType === 'demand_notice' ? 'Demand Notice' : 'Disconnection Notice';
  const body = noticeType === 'demand_notice'
    ? 'You are hereby demanded to clear the outstanding water charges within 7 days to avoid further recovery action.'
    : 'Water supply to the below connection will be disconnected unless payment is received within 48 hours.';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 24px; color: #1a1a1a; }
  h1 { margin: 0 0 4px; font-size: 22px; color: #b91c1c; }
  .meta { color: #666; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 8px 12px; border-bottom: 1px solid #eee; }
  td:first-child { color: #555; width: 40%; }
  td:last-child { font-weight: 600; }
  .notice { margin-top: 20px; padding: 12px; background: #fef2f2; border: 1px solid #fecaca; }
</style></head><body>
  <h1>EGIP ${title}</h1>
  <div class="meta">Bill ${String(row.billNo ?? '')} · ${new Date().toISOString().slice(0, 10)}</div>
  <table>
    <tr><td>Consumer</td><td>${String(row.consumerCode ?? '')}</td></tr>
    <tr><td>FHTC</td><td>${String(row.fhtcNumber ?? '')}</td></tr>
    <tr><td>Name</td><td>${String(row.consumerName ?? '—')}</td></tr>
    <tr><td>Village</td><td>${String(row.village ?? '—')}</td></tr>
    <tr><td>Outstanding</td><td>${formatInr(Number(row.balanceAmount ?? 0))}</td></tr>
    <tr><td>Due Date</td><td>${String(row.dueDate ?? '—')}</td></tr>
    <tr><td>Days Overdue</td><td>${String(row.daysOverdue ?? 0)}</td></tr>
    <tr><td>Aging Category</td><td>${String(row.arrearBucketLabel ?? row.arrearBucket ?? '—')}</td></tr>
  </table>
  <div class="notice">${body}</div>
</body></html>`;
}

export function openArrearNoticePrintView(
  row: ArrearRecord,
  noticeType: 'demand_notice' | 'disconnection_notice',
): void {
  const html = renderArrearNoticeHtml(row, noticeType);
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
