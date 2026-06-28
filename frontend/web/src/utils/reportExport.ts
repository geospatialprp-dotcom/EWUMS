/** CSV and print-to-PDF export for tabular O&M and billing reports. */

import { renderUjsLetterheadHtml } from './remarksDocumentPdf';
export type ReportSection = { name: string; rows: Array<Record<string, unknown>> };

export function flattenExportRow(row: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v == null) out[k] = '';
    else if (Array.isArray(v) || (typeof v === 'object' && !(v instanceof Date))) {
      out[k] = JSON.stringify(v);
    } else {
      out[k] = String(v);
    }
  }
  return out;
}

function pushSection(sections: ReportSection[], name: string, rows: unknown) {
  if (Array.isArray(rows) && rows.length) {
    sections.push({ name, rows: rows as Array<Record<string, unknown>> });
  }
}

export function extractReportSections(report: Record<string, unknown>): ReportSection[] {
  const sections: ReportSection[] = [];

  if (Array.isArray(report.rows) && report.rows.length) {
    const first = report.rows[0] as Record<string, unknown>;
    if (first?.consumer && (first.bills || first.payments)) {
      pushSection(sections, 'Consumer Ledger', (report.rows as Array<Record<string, unknown>>).map((row) => {
        const consumer = row.consumer as Record<string, unknown>;
        const bills = row.bills as unknown[];
        const payments = row.payments as unknown[];
        return {
          consumerCode: consumer.consumerCode,
          fhtcNumber: consumer.fhtcNumber,
          consumerName: consumer.consumerName,
          village: consumer.village,
          billCount: bills?.length ?? 0,
          paymentCount: payments?.length ?? 0,
        };
      }));
    } else {
      pushSection(sections, 'Data', report.rows as Array<Record<string, unknown>>);
    }
  }

  pushSection(sections, 'Arrears', report.arrearRows);
  pushSection(sections, 'Recent Payments', report.recentPayments);
  pushSection(sections, 'Recent Bills', report.recentBills);
  pushSection(sections, 'Service Requests', report.serviceRequests);
  pushSection(sections, 'Alerts', report.alerts);
  pushSection(sections, 'Inspections', report.inspections);
  pushSection(sections, 'Income', report.income);
  pushSection(sections, 'Expense', report.expense);

  return sections;
}

function escapeCsv(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function summaryEntries(report: Record<string, unknown>): Array<[string, string]> {
  const entries: Array<[string, string]> = [];

  const summary = report.summary as Record<string, unknown> | undefined;
  if (summary && typeof summary === 'object') {
    for (const [k, v] of Object.entries(summary)) {
      entries.push([k, v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)]);
    }
  }

  const audit = report.auditSnapshot as Record<string, unknown> | undefined;
  if (audit) {
    for (const [k, v] of Object.entries(audit)) {
      entries.push([`audit.${k}`, v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)]);
    }
  }

  const period = report.period as Record<string, unknown> | undefined;
  if (period?.from || period?.to) {
    entries.push(['period', `${String(period.from ?? '')} to ${String(period.to ?? '')}`]);
  }
  if (report.projectCode) entries.push(['projectCode', String(report.projectCode)]);
  if (report.projectName) entries.push(['projectName', String(report.projectName)]);
  if (report.generatedAt) entries.push(['generatedAt', String(report.generatedAt)]);
  if (report.reportType) entries.push(['reportType', String(report.reportType)]);

  return entries;
}

export function buildReportCsv(report: Record<string, unknown>): string {
  const lines: string[] = [];
  const summary = summaryEntries(report);

  if (summary.length) {
    lines.push('Summary');
    lines.push('Field,Value');
    summary.forEach(([k, v]) => lines.push(`${escapeCsv(k)},${escapeCsv(v)}`));
    lines.push('');
  }

  const sections = extractReportSections(report);
  for (const section of sections) {
    lines.push(section.name);
    const flatRows = section.rows.map(flattenExportRow);
    const cols = [...new Set(flatRows.flatMap((r) => Object.keys(r)))];
    lines.push(cols.map(escapeCsv).join(','));
    for (const row of flatRows) {
      lines.push(cols.map((c) => escapeCsv(row[c] ?? '')).join(','));
    }
    lines.push('');
  }

  if (!sections.length && !summary.length) {
    lines.push('Report');
    lines.push('Content');
    lines.push(escapeCsv(JSON.stringify(report)));
  }

  return lines.join('\r\n');
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.-]+/g, '_').slice(0, 120);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadReportCsv(baseName: string, report: Record<string, unknown>): void {
  const blob = new Blob([buildReportCsv(report)], { type: 'text/csv;charset=utf-8' });
  triggerDownload(blob, `${sanitizeFileName(baseName)}.csv`);
}

function renderHtmlTable(sectionName: string, rows: Array<Record<string, unknown>>): string {
  if (!rows.length) return '';
  const flatRows = rows.map(flattenExportRow);
  const cols = [...new Set(flatRows.flatMap((r) => Object.keys(r)))];
  const head = cols.map((c) => `<th>${escapeHtml(c)}</th>`).join('');
  const body = flatRows.map((row) =>
    `<tr>${cols.map((c) => `<td>${escapeHtml(row[c] ?? '')}</td>`).join('')}</tr>`,
  ).join('');
  return `<h3>${escapeHtml(sectionName)}</h3><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

export function renderReportHtml(title: string, report: Record<string, unknown>): string {
  const summary = summaryEntries(report);
  const summaryHtml = summary.length
    ? `<table class="summary">${summary.map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`).join('')}</table>`
    : '';
  const sectionsHtml = extractReportSections(report).map((s) => renderHtmlTable(s.name, s.rows)).join('');
  const fallback = !sectionsHtml && !summaryHtml
    ? `<pre>${escapeHtml(JSON.stringify(report, null, 2))}</pre>`
    : '';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 24px; color: #1a1a1a; font-size: 12px; }
  .letterhead { text-align: center; border-bottom: 2px solid #1a3558; padding-bottom: 14px; margin-bottom: 18px; }
  .letterhead img { height: 72px; width: auto; object-fit: contain; margin-bottom: 8px; }
  .org-en { font-size: 18px; font-weight: 700; color: #1a3558; margin: 0; }
  .org-hi { font-size: 15px; font-weight: 700; color: #0369a1; margin: 4px 0 0; }
  h1 { font-size: 20px; margin: 0 0 8px; text-align: center; }
  h3 { font-size: 14px; margin: 20px 0 8px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; vertical-align: top; word-break: break-word; }
  th { background: #f5f5f5; }
  .summary td:first-child { width: 35%; color: #555; }
  .meta { color: #666; margin-bottom: 16px; text-align: center; }
  pre { background: #f5f5f5; padding: 12px; overflow: auto; font-size: 11px; }
  @media print { body { margin: 12mm; } }
</style></head><body>
  ${renderUjsLetterheadHtml()}
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">${escapeHtml(String(report.generatedAt ?? new Date().toISOString()))}</div>
  ${summaryHtml}
  ${sectionsHtml}
  ${fallback}
</body></html>`;
}

export function downloadReportHtml(title: string, report: Record<string, unknown>, baseName: string): void {
  const blob = new Blob([renderReportHtml(title, report)], { type: 'text/html;charset=utf-8' });
  triggerDownload(blob, `${sanitizeFileName(baseName)}.html`);
}

export function openReportPdfView(title: string, report: Record<string, unknown>): boolean {
  const html = renderReportHtml(title, report);
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
    downloadReportHtml(title, report, title);
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
