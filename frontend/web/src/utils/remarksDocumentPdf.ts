import { DEFAULT_DEPARTMENT_ID, getDepartmentById } from '../constants/departments';
import type { BilingualText } from './bilingualText';
import { hasBilingualContent } from './bilingualText';

export type RemarksPdfMetaRow = { label: string; value: string };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.-]+/g, '_').slice(0, 120);
}

function resolveLogoUrl(): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const department = getDepartmentById(DEFAULT_DEPARTMENT_ID);
  const candidates = [
    department.logoUrl,
    '/departments/uttarakhand-peyjal-nigam.svg',
    '/egip-icon.svg',
  ];
  for (const path of candidates) {
    if (path) return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
  }
  return '';
}

function renderUjsLetterheadHtml(): string {
  const department = getDepartmentById(DEFAULT_DEPARTMENT_ID);
  const logoUrl = resolveLogoUrl();
  return `
  <header class="letterhead">
    ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(department.logoAlt)}" />` : ''}
    <p class="org-en">${escapeHtml(department.name)}</p>
    ${department.nameHi ? `<p class="org-hi">${escapeHtml(department.nameHi)}</p>` : ''}
  </header>`;
}

export { renderUjsLetterheadHtml };

export function renderRemarksDocumentHtml(options: {
  title: string;
  subtitle?: string;
  bilingual: BilingualText;
  meta?: RemarksPdfMetaRow[];
  generatedAt?: string;
}): string {
  const generatedAt = options.generatedAt ?? new Date().toLocaleString('en-IN');
  const metaRows = (options.meta ?? []).filter((row) => row.value.trim());

  const section = (heading: string, body: string) => {
    if (!body.trim()) return '';
    return `
      <section class="lang-block">
        <h3>${escapeHtml(heading)}</h3>
        <div class="body">${escapeHtml(body).replace(/\n/g, '<br/>')}</div>
      </section>`;
  };

  const metaHtml = metaRows.length
    ? `<table class="meta">${metaRows.map((row) =>
      `<tr><td>${escapeHtml(row.label)}</td><td>${escapeHtml(row.value)}</td></tr>`,
    ).join('')}</table>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(options.title)}</title>
  <style>
    @page { margin: 14mm; }
    body {
      font-family: "Segoe UI", Arial, sans-serif;
      color: #1a1a1a;
      margin: 0;
      padding: 24px;
      font-size: 13px;
      line-height: 1.5;
    }
    .letterhead {
      text-align: center;
      border-bottom: 2px solid #1a3558;
      padding-bottom: 14px;
      margin-bottom: 18px;
    }
    .letterhead img {
      height: 72px;
      width: auto;
      object-fit: contain;
      margin-bottom: 8px;
    }
    .org-en { font-size: 18px; font-weight: 700; color: #1a3558; margin: 0; }
    .org-hi { font-size: 15px; font-weight: 700; color: #0369a1; margin: 4px 0 0; }
    .doc-title {
      font-size: 20px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 6px;
      text-align: center;
    }
    .doc-subtitle {
      text-align: center;
      color: #475569;
      margin: 0 0 16px;
      font-size: 14px;
    }
    .meta {
      width: 100%;
      border-collapse: collapse;
      margin: 0 0 18px;
      font-size: 12px;
    }
    .meta td {
      border: 1px solid #cbd5e1;
      padding: 6px 10px;
      vertical-align: top;
    }
    .meta td:first-child {
      width: 32%;
      background: #f8fafc;
      font-weight: 600;
      color: #334155;
    }
    .lang-block {
      margin-bottom: 16px;
      border: 1px solid #dbeafe;
      border-radius: 6px;
      overflow: hidden;
    }
    .lang-block h3 {
      margin: 0;
      padding: 8px 12px;
      background: linear-gradient(180deg, #e8eef5 0%, #d4dce8 100%);
      font-size: 12px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #1a3558;
    }
    .lang-block .body {
      padding: 12px;
      white-space: pre-wrap;
      min-height: 48px;
    }
    .footer {
      margin-top: 24px;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
      color: #64748b;
      text-align: right;
    }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
  ${renderUjsLetterheadHtml()}

  <h1 class="doc-title">${escapeHtml(options.title)}</h1>
  ${options.subtitle ? `<p class="doc-subtitle">${escapeHtml(options.subtitle)}</p>` : ''}

  ${metaHtml}
  ${section('English', options.bilingual.en)}
  ${section('हिंदी', options.bilingual.hi)}

  <div class="footer">Generated: ${escapeHtml(generatedAt)}</div>
</body>
</html>`;
}

function triggerHtmlDownload(html: string, fileName: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${sanitizeFileName(fileName)}.html`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function openRemarksDocumentPdf(options: {
  title: string;
  subtitle?: string;
  bilingual: BilingualText;
  meta?: RemarksPdfMetaRow[];
  fileName?: string;
}): boolean {
  if (!hasBilingualContent(options.bilingual)) return false;

  const html = renderRemarksDocumentHtml(options);
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
    triggerHtmlDownload(html, options.fileName ?? options.title);
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
