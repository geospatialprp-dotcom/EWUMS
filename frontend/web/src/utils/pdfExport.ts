/** Client-side PDF export — UJS/EWUMS letterhead, PRP Geospatial footer, tabular reports. */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { APP_BRAND } from '../constants/branding';
import { DEFAULT_DEPARTMENT_ID, getDepartmentById } from '../constants/departments';
import { OM_REVENUE_KPI_DEFINITIONS, formatInr, formatRevenueKpiValue } from '../constants/omBilling';
import { formatAuditLocationForExport } from './auditLocationDisplay';

export const PDF_COLORS = {
  navy: [15, 23, 42] as const,
  orange: [249, 115, 22] as const,
  slate: [100, 116, 139] as const,
  lightBg: [248, 250, 252] as const,
  white: [255, 255, 255] as const,
};

export type PdfTableSection = {
  heading?: string;
  columns: string[];
  rows: string[][];
};

export type PdfExportOptions = {
  title: string;
  subtitle?: string;
  divisionScope?: string | null;
  fileName: string;
  orientation?: 'portrait' | 'landscape';
  sections: PdfTableSection[];
};

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.-]+/g, '_').slice(0, 120);
}

function formatGeneratedAt(date = new Date()): string {
  return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function truncateCell(value: string, max = 120): string {
  const text = value.trim() || '—';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function drawPageHeader(doc: jsPDF, meta: Pick<PdfExportOptions, 'title' | 'subtitle' | 'divisionScope'>): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const department = getDepartmentById(DEFAULT_DEPARTMENT_ID);

  doc.setFillColor(...PDF_COLORS.navy);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setFillColor(...PDF_COLORS.orange);
  doc.rect(0, 28, pageWidth, 1.2, 'F');

  doc.setTextColor(...PDF_COLORS.white);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(department.name, pageWidth / 2, 9, { align: 'center' });

  if (department.nameHi) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(department.nameHi, pageWidth / 2, 14.5, { align: 'center' });
  }

  doc.setFontSize(8);
  doc.text(APP_BRAND.headerTitleShort, pageWidth / 2, department.nameHi ? 19 : 16, { align: 'center' });

  doc.setTextColor(...PDF_COLORS.navy);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(meta.title, 14, 38);

  let y = 44;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...PDF_COLORS.slate);

  if (meta.subtitle) {
    doc.text(meta.subtitle, 14, y);
    y += 5;
  }

  const metaLines: string[] = [`Generated: ${formatGeneratedAt()}`];
  if (meta.divisionScope) {
    metaLines.push(`Division: ${meta.divisionScope}`);
  }
  doc.text(metaLines.join('  ·  '), 14, y);
  y += 8;

  doc.setDrawColor(...PDF_COLORS.orange);
  doc.setLineWidth(0.4);
  doc.line(14, y, pageWidth - 14, y);

  return y + 6;
}

function drawPageFooter(doc: jsPDF): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageCount = doc.getNumberOfPages();

  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(14, pageHeight - 14, pageWidth - 14, pageHeight - 14);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...PDF_COLORS.slate);
    doc.text(
      `${APP_BRAND.companyName} · ${APP_BRAND.companyUrl}`,
      14,
      pageHeight - 9,
    );
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, pageHeight - 9, { align: 'right' });
  }
}

export function exportPdfDocument(options: PdfExportOptions): void {
  const doc = new jsPDF({
    orientation: options.orientation ?? 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  let startY = drawPageHeader(doc, options);
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = { left: 14, right: 14, top: 14, bottom: 18 };

  options.sections.forEach((section, index) => {
    if (section.heading) {
      if (startY > doc.internal.pageSize.getHeight() - 40) {
        doc.addPage();
        startY = margin.top + 6;
      }
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...PDF_COLORS.navy);
      doc.text(section.heading, margin.left, startY);
      startY += 5;
    }

    if (!section.rows.length) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(...PDF_COLORS.slate);
      doc.text('No records to export.', margin.left, startY);
      startY += 10;
      return;
    }

    autoTable(doc, {
      head: [section.columns],
      body: section.rows,
      startY,
      margin,
      theme: 'grid',
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        overflow: 'linebreak',
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: PDF_COLORS.navy,
        textColor: PDF_COLORS.white,
        fontStyle: 'bold',
        fontSize: 7.5,
      },
      alternateRowStyles: { fillColor: PDF_COLORS.lightBg },
      columnStyles: index === 0 ? undefined : {},
      didDrawPage: (data) => {
        if (data.pageNumber > 1 && data.cursor?.y === margin.top) {
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...PDF_COLORS.navy);
          doc.text(options.title, margin.left, 10);
        }
      },
    });

    const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY;
    startY = (finalY ?? startY) + (index < options.sections.length - 1 ? 10 : 4);
  });

  drawPageFooter(doc);
  doc.save(`${sanitizeFileName(options.fileName)}.pdf`);
}

// ── Audit Trail ─────────────────────────────────────────────────────────────

export type AuditPdfRow = {
  createdAt: string;
  userEmail: string | null;
  userName: string | null;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  ipAddress: string | null;
  location: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationAccuracyMeters?: number | null;
  details: Record<string, unknown>;
};

function formatAuditUser(row: AuditPdfRow): string {
  if (row.userEmail) {
    return row.userName ? `${row.userName} (${row.userEmail})` : row.userEmail;
  }
  if (row.userName) return row.userName;
  return row.userId ?? '—';
}

function formatAuditResource(row: AuditPdfRow): string {
  const type = row.resourceType ?? '—';
  return row.resourceId ? `${type} · ${row.resourceId}` : type;
}

function formatAuditDetails(details: Record<string, unknown>): string {
  const text = JSON.stringify(details);
  return text === '{}' ? '—' : text;
}

export function exportAuditTrailPdf(
  rows: AuditPdfRow[],
  divisionScope?: string | null,
): void {
  exportPdfDocument({
    title: 'Audit Trail',
    subtitle: 'Activity Log · गतिविधि लॉग',
    divisionScope,
    fileName: `audit-trail_${new Date().toISOString().slice(0, 10)}`,
    orientation: 'landscape',
    sections: [{
      heading: 'Activity Log',
      columns: ['Timestamp', 'User', 'Action', 'Resource', 'IP', 'Location', 'Details'],
      rows: rows.map((log) => [
        new Date(log.createdAt).toLocaleString('en-IN'),
        formatAuditUser(log),
        log.action,
        formatAuditResource(log),
        log.ipAddress ?? '—',
        formatAuditLocationForExport(log),
        truncateCell(formatAuditDetails(log.details), 200),
      ]),
    }],
  });
}

// ── Billing & Revenue ───────────────────────────────────────────────────────

export type BillingPdfData = {
  summary: Record<string, unknown>;
  bills: Array<Record<string, unknown>>;
  projectLabel: string;
};

export function exportBillingPdf(data: BillingPdfData, divisionScope?: string | null): void {
  const summaryRows = OM_REVENUE_KPI_DEFINITIONS.map((kpi) => [
    kpi.label,
    formatRevenueKpiValue(kpi.key, kpi.format, data.summary),
  ]);

  const period = data.summary.period as { from?: string; to?: string } | undefined;
  const periodLabel = period?.from && period?.to ? `${period.from} → ${period.to}` : undefined;

  exportPdfDocument({
    title: 'Billing & Revenue',
    subtitle: `Revenue Summary & Bill Register · ${data.projectLabel}${periodLabel ? ` · ${periodLabel}` : ''}`,
    divisionScope,
    fileName: `billing-revenue_${new Date().toISOString().slice(0, 10)}`,
    orientation: 'landscape',
    sections: [
      {
        heading: 'Revenue KPI Summary · राजस्व सारांश',
        columns: ['Metric', 'Value'],
        rows: summaryRows,
      },
      {
        heading: 'Bill Register · बिल रजिस्टर',
        columns: [
          'Bill No',
          'Consumer',
          'Cycle',
          'Period',
          'Consumption',
          'Water',
          'Fixed',
          'Tax/Penalty',
          'Arrears',
          'Total',
          'Balance',
          'Status',
        ],
        rows: data.bills.map((b) => [
          String(b.billNo ?? '—'),
          String(b.consumerCode ?? b.fhtcNumber ?? '—'),
          String(b.billingCycleLabel ?? b.billingCycle ?? 'Monthly'),
          `${String(b.billingPeriodFrom ?? '—')} → ${String(b.billingPeriodTo ?? '—')}`,
          `${String(b.consumptionKl ?? '—')} KL`,
          formatInr(Number(b.waterCharge)),
          formatInr(Number(b.fixedChargesTotal ?? b.fixedCharge)),
          `Tax ${formatInr(Number(b.taxAmount))} / Pen ${formatInr(Number(b.penaltyAmount))}`,
          formatInr(Number(b.arrearsAmount)),
          formatInr(Number(b.totalAmount)),
          formatInr(Number(b.balanceAmount)),
          String(b.statusLabel ?? b.status ?? '—'),
        ]),
      },
    ],
  });
}

// ── Project Management ──────────────────────────────────────────────────────

export type ProjectPdfRow = {
  projectCode: string;
  name: string;
  divisionName?: string | null;
  status: string;
  physicalProgress: number;
  financialProgress: number;
  budget: number | null;
  spent: number;
};

function formatProjectStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function exportProjectsPdf(
  rows: ProjectPdfRow[],
  divisionScope?: string | null,
): void {
  exportPdfDocument({
    title: 'Project Management',
    subtitle: 'Scheme Portfolio · परियोजना सूची',
    divisionScope,
    fileName: `projects_${new Date().toISOString().slice(0, 10)}`,
    orientation: 'landscape',
    sections: [{
      heading: 'Schemes · Status & Progress',
      columns: [
        'Code',
        'Scheme Name',
        'Division',
        'Status',
        'Work Progress',
        'Payment Progress',
        'Budget',
        'Spent',
      ],
      rows: rows.map((p) => {
        const budget = Number(p.budget) || 0;
        const spent = Number(p.spent) || 0;
        const financialPct = budget > 0
          ? Math.min(100, Math.round((spent / budget) * 10000) / 100)
          : Number(p.financialProgress) || 0;
        const physicalPct = Math.min(100, Math.max(0, Number(p.physicalProgress) || 0));

        return [
          p.projectCode,
          p.name,
          p.divisionName ?? '—',
          formatProjectStatus(p.status),
          `${physicalPct}%`,
          `${financialPct}%`,
          p.budget != null ? formatInr(Number(p.budget)) : '—',
          formatInr(Number(p.spent)),
        ];
      }),
    }],
  });
}

// ── Map layout PDF (used by mapExport.ts) ───────────────────────────────────

export function jpegToPdfBlob(
  jpegBytes: Uint8Array,
  widthPx: number,
  heightPx: number,
  pageSize: 'A4' | 'A3',
): Blob {
  const orientation = widthPx >= heightPx ? 'landscape' : 'portrait';
  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: pageSize.toLowerCase() as 'a4' | 'a3',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const binary = jpegBytes.reduce((acc, byte) => acc + String.fromCharCode(byte), '');
  const imgData = `data:image/jpeg;base64,${btoa(binary)}`;

  doc.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
  return doc.output('blob');
}
