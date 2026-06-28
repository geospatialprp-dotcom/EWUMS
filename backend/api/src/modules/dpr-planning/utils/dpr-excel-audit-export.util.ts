import * as XLSX from 'xlsx';
import type { DprExcelAuditReport } from './dpr-excel-audit.types';

function fmt(n: number | string | null | undefined): string {
  if (n == null) return '';
  if (typeof n === 'number') return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return String(n);
}

function sheetFromRows(rows: (string | number)[][]): XLSX.WorkSheet {
  return XLSX.utils.aoa_to_sheet(rows);
}

export function buildDprValidationExcelExport(
  report: DprExcelAuditReport,
  meta: { proposalNo?: string; fileName?: string; validatedAt?: string },
): Buffer {
  const wb = XLSX.utils.book_new();
  const audit = report.audit;
  const validatedAt = meta.validatedAt ?? new Date().toISOString();

  const errorLogRows: (string | number)[][] = [
    ['Sheet Name', 'Page/Row', 'Cell Reference', 'Error Type', 'Severity', 'Category', 'Expected Value', 'Actual Value', 'Difference', 'Message'],
    ...audit.errors.map((e) => [
      e.sheetName,
      e.pageNo ? `${e.pageNo}/${e.rowNo}` : e.rowNo,
      e.cellRef,
      e.errorType,
      e.severity.toUpperCase(),
      e.category,
      fmt(e.expectedValue),
      fmt(e.actualValue),
      e.difference != null ? fmt(e.difference) : '',
      e.message,
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, sheetFromRows(errorLogRows), 'Error Log');

  const calcRows: (string | number)[][] = [
    ['Sheet', 'Page', 'Check Type', 'Row', 'Expected', 'Actual', 'Status', 'Message'],
    ...report.pages
      .filter((p) => p.isCalculationSheet)
      .flatMap((p) => [
        ...p.totalChecks.map((t) => [
          p.sheetName, p.pageNo, t.label, t.rowNo, t.computedAmount, t.declaredAmount,
          t.match ? 'OK' : 'ERROR', t.message ?? '',
        ]),
        ...p.lines.map((l) => [
          p.sheetName, p.pageNo, 'Qty × Rate', l.sheetRow ?? l.lineNo,
          l.computedAmount, l.declaredAmount, l.status === 'pass' ? 'OK' : l.status.toUpperCase(), l.message ?? '',
        ]),
      ]),
  ];
  XLSX.utils.book_append_sheet(wb, sheetFromRows(calcRows), 'Calculation Verification');

  const formulaRows: (string | number)[][] = [
    ['Sheet', 'Page', 'Cell', 'Row', 'Formula', 'Displayed', 'Computed', 'Status', 'Issue'],
    ...audit.formulaAudits.map((f) => [
      f.sheetName, f.pageNo, f.cellRef, f.rowNo, f.formula,
      f.displayedValue ?? '', f.computedValue ?? '',
      f.status?.toUpperCase() ?? (f.match ? 'VERIFIED' : 'ERROR'),
      f.issue ?? '',
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, sheetFromRows(formulaRows.length > 1 ? formulaRows : [
    ['Sheet', 'Page', 'Cell', 'Row', 'Formula', 'Displayed', 'Computed', 'Status', 'Issue'],
    ['—', '—', '—', '—', 'No formulas found on visible calculation sheets', '', '', '—', ''],
  ]), 'Formula Audit');

  const dashboardRows: (string | number)[][] = [
    ['DPR VALIDATION SUMMARY DASHBOARD'],
    ['Proposal', meta.proposalNo ?? ''],
    ['Source File', meta.fileName ?? ''],
    ['Validated At', validatedAt],
    [],
    ['Metric', 'Value'],
    ['Validation Status', audit.validationStatus],
    ['Visible Sheets Checked', audit.visibleSheetsChecked],
    ['Hidden Sheets Skipped', audit.hiddenSheetsSkipped],
    ['Formulas Verified', audit.formulasVerified],
    ['Formulas Unverified (manual review)', audit.formulasUnverified ?? 0],
    ['Calculations Verified', audit.calculationsVerified],
    ['Total Line Items', report.totalItems],
    ['Lines Passed', report.passedItems],
    ['Lines Failed', report.failedItems],
    ['Warnings', report.warningItems],
    ['Total Errors', audit.totalErrors],
    ['Error %', `${audit.errorPercentage}%`],
    ['Critical Errors', audit.errorsBySeverity.critical],
    ['Major Errors', audit.errorsBySeverity.major],
    ['Minor Errors', audit.errorsBySeverity.minor],
    ['BOQ Computed Total', report.computedGrandTotal],
    ['Declared Gross/Abstract', report.declaredGrandTotal ?? ''],
    ['GAC-BC-Abstract-BOQ Match', report.grandTotalMatch ? 'Yes' : 'No'],
    [],
    ['Hidden Sheets (not audited)'],
    ...audit.hiddenSheetNames.map((n) => [n]),
    [],
    ['Cross-Checks'],
    ...report.crossChecks.map((c) => [c.label, c.match ? 'OK' : 'FAIL', c.message ?? '']),
    [],
    ['Summary Message', report.summary.message],
  ];
  XLSX.utils.book_append_sheet(wb, sheetFromRows(dashboardRows), 'Validation Dashboard');

  const certStatus = audit.validationStatus === 'Pass' ? 'CERTIFIED — PASS' : 'NOT CERTIFIED — FAIL / REVIEW REQUIRED';
  const certRows: (string | number)[][] = [
    ['FINAL DPR VALIDATION CERTIFICATE'],
    [],
    ['This automated audit certifies that the uploaded DPR estimate workbook has been checked'],
    ['against visible worksheets only (hidden sheets excluded).'],
    [],
    ['Proposal ID', meta.proposalNo ?? ''],
    ['File Name', meta.fileName ?? ''],
    ['Validation Date', validatedAt],
    ['Certificate Status', certStatus],
    [],
    ['Visible sheets audited', audit.visibleSheetsChecked],
    ['Hidden sheets excluded', audit.hiddenSheetsSkipped],
    ['Total errors found', audit.totalErrors],
    ['Ready for TAC submission', report.summary.readyForTac ? 'Yes' : 'No'],
    [],
    ['Issued by', 'EGIP Platform — Automated DPR Excel Audit Engine'],
    ['Note', 'Engineering estimates must be manually reviewed before administrative sanction.'],
  ];
  XLSX.utils.book_append_sheet(wb, sheetFromRows(certRows), 'Validation Certificate');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
