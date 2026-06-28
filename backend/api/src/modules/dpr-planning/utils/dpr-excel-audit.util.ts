import * as XLSX from 'xlsx';
import type {
  BoqCrossCheck,
  BoqPageValidation,
  BoqTotalRowCheck,
  BoqValidationReport,
} from './dpr-boq-validation.util';
import type {
  DprAuditError,
  DprAuditSeverity,
  DprExcelAuditReport,
  DprExcelAuditSummary,
  DprFormulaAuditRow,
} from './dpr-excel-audit.types';

export const AMOUNT_TOLERANCE = 0.5;
export const TOTAL_TOLERANCE = 1.0;
const MAX_STORED_ERRORS = 2000;
const MAX_FORMULA_AUDITS = 2000;

export function getVisibleSheetNames(workbook: XLSX.WorkBook): { visible: string[]; hidden: string[] } {
  const sheetNames = Array.isArray(workbook?.SheetNames) ? workbook.SheetNames : [];
  const meta = workbook.Workbook?.Sheets ?? [];
  const visible: string[] = [];
  const hidden: string[] = [];
  sheetNames.forEach((name, idx) => {
    const sheetMeta = meta.find((s) => s.name === name) ?? meta[idx];
    const state = sheetMeta?.Hidden ?? 0;
    if (state === 0) visible.push(name);
    else hidden.push(name);
  });
  return { visible, hidden };
}

function parseNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const cleaned = String(value ?? '').replace(/[,₹\s%]/g, '').trim();
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function cellRef(col: number, row: number): string {
  return XLSX.utils.encode_cell({ r: row, c: col });
}

function amountColRef(page: BoqPageValidation, rowNo: number): string {
  const col = page.headerMap?.amount;
  if (col === undefined || !rowNo) return '';
  return cellRef(col, rowNo - 1);
}

function sumRange(sheet: XLSX.WorkSheet, ref: string): number {
  const range = XLSX.utils.decode_range(ref.replace(/\$/g, ''));
  let sum = 0;
  for (let r = range.s.r; r <= range.e.r; r += 1) {
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const addr = XLSX.utils.encode_cell({ r, c });
      sum += parseNumber(sheet[addr]?.v);
    }
  }
  return round2(sum);
}

function evalCellRef(sheet: XLSX.WorkSheet, ref: string): number {
  const addr = ref.replace(/\$/g, '').toUpperCase();
  return parseNumber(sheet[addr]?.v);
}

function evalArithmeticChain(sheet: XLSX.WorkSheet, expr: string): number | null {
  const tokens = expr.replace(/\s/g, '').split(/(?=[+\-])|(?<=[+\-])/).filter(Boolean);
  if (tokens.length < 3) return null;
  let acc = evalCellRef(sheet, tokens[0]);
  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i];
    const ref = tokens[i + 1];
    if (!ref) return null;
    const val = evalCellRef(sheet, ref);
    if (op === '+') acc = round2(acc + val);
    else if (op === '-') acc = round2(acc - val);
    else return null;
  }
  return round2(acc);
}

function evaluateFormula(sheet: XLSX.WorkSheet, formula: string): number | null {
  const expr = formula.replace(/^=/, '').trim();
  if (!expr) return null;
  if (/^#REF!|#VALUE!|#DIV\/0!|#N\/A|#NAME\?|#NULL!/i.test(expr)) return null;

  const sumMatch = /^SUM\(([^)]+)\)$/i.exec(expr);
  if (sumMatch) {
    const parts = sumMatch[1].split(',').map((p) => p.trim());
    let total = 0;
    for (const part of parts) total = round2(total + sumRange(sheet, part));
    return total;
  }

  const roundMatch = /^ROUND\(([^,]+),\s*(\d+)\)$/i.exec(expr.replace(/\s/g, ''));
  if (roundMatch) {
    const val = evalCellRef(sheet, roundMatch[1]) || sumRange(sheet, roundMatch[1]);
    const digits = Number(roundMatch[2]);
    const factor = 10 ** digits;
    return Math.round(val * factor) / factor;
  }

  const pctMatch = /^([A-Z]+\d+)\*([A-Z]+\d+)\/100$/i.exec(expr.replace(/\s/g, ''));
  if (pctMatch) return round2(evalCellRef(sheet, pctMatch[1]) * evalCellRef(sheet, pctMatch[2]) / 100);

  const divMatch = /^([A-Z]+\d+)\/([A-Z]+\d+)$/i.exec(expr.replace(/\s/g, ''));
  if (divMatch) {
    const denom = evalCellRef(sheet, divMatch[2]);
    if (denom === 0) return null;
    return round2(evalCellRef(sheet, divMatch[1]) / denom);
  }

  const mulMatch = /^([A-Z]+\d+)\*([A-Z]+\d+)$/i.exec(expr.replace(/\s/g, ''));
  if (mulMatch) return round2(evalCellRef(sheet, mulMatch[1]) * evalCellRef(sheet, mulMatch[2]));

  const addSub = evalArithmeticChain(sheet, expr.replace(/\s/g, ''));
  if (addSub != null) return addSub;

  return null;
}

function isTotalLabel(text: string): boolean {
  return /grand\s*total|gross\s*total|section\s*total|sub\s*total|net\s*amount|\btotal\b/i.test(text);
}

function auditFormulasOnSheet(
  sheet: XLSX.WorkSheet,
  sheetName: string,
  pageNo: number,
): { errors: DprAuditError[]; rows: DprFormulaAuditRow[]; verified: number; unverified: number } {
  const errors: DprAuditError[] = [];
  const rows: DprFormulaAuditRow[] = [];
  let verified = 0;
  let unverified = 0;

  for (const addr of Object.keys(sheet)) {
    if (addr.startsWith('!')) continue;
    const cell = sheet[addr] as XLSX.CellObject | undefined;
    if (!cell?.f) continue;

    const decoded = XLSX.utils.decode_cell(addr);
    const displayed = parseNumber(cell.v);
    const computed = evaluateFormula(sheet, cell.f);
    const rowNo = decoded.r + 1;

    if (/^=.*#REF!/i.test(cell.f) || /^#REF!/i.test(String(cell.v ?? ''))) {
      rows.push({
        sheetName, pageNo, cellRef: addr, rowNo, formula: cell.f,
        displayedValue: displayed || null, computedValue: null,
        status: 'mismatch', match: false, issue: 'Broken reference',
      });
      errors.push({
        sheetName, pageNo, rowNo, cellRef: addr,
        errorType: 'Broken reference', category: 'formula', severity: 'critical',
        expectedValue: null, actualValue: displayed, difference: null,
        message: `Cell ${addr} has broken reference in formula ${cell.f}`,
      });
      continue;
    }

    if (computed == null) {
      unverified += 1;
      rows.push({
        sheetName, pageNo, cellRef: addr, rowNo, formula: cell.f,
        displayedValue: displayed || null, computedValue: null,
        status: 'unverified', match: false,
        issue: 'Formula not evaluable — manual review required',
      });
      continue;
    }

    verified += 1;
    const match = Math.abs(displayed - computed) <= AMOUNT_TOLERANCE;
    rows.push({
      sheetName, pageNo, cellRef: addr, rowNo, formula: cell.f,
      displayedValue: displayed || null, computedValue: computed,
      status: match ? 'verified' : 'mismatch',
      match,
      issue: match ? undefined : 'Formula result mismatch',
    });

    if (!match) {
      errors.push({
        sheetName, pageNo, rowNo, cellRef: addr,
        errorType: 'Formula arithmetic mismatch', category: 'arithmetic', severity: 'major',
        expectedValue: computed, actualValue: displayed,
        difference: round2(displayed - computed),
        message: `Cell ${addr}: formula ${cell.f} evaluates to ${computed} but shows ${displayed}`,
      });
    }
  }

  return { errors, rows, verified, unverified };
}

function auditVerticalAmountColumn(
  sheet: XLSX.WorkSheet,
  sheetName: string,
  pageNo: number,
  headerMap: Record<string, number>,
  headerRowIdx: number,
  rows: (string | number)[][],
): DprAuditError[] {
  const errors: DprAuditError[] = [];
  if (headerMap.amount === undefined) return errors;

  const amountCol = headerMap.amount;
  let runningSum = 0;

  for (let i = headerRowIdx + 1; i < rows.length; i += 1) {
    const cells = rows[i].map((c) => String(c ?? '').trim());
    const joined = cells.filter(Boolean).join(' ');
    const amount = parseNumber(cells[amountCol]);

    if (isTotalLabel(joined) && amount > 0) {
      if (runningSum > 0 && Math.abs(amount - runningSum) > TOTAL_TOLERANCE) {
        errors.push({
          sheetName, pageNo, rowNo: i + 1,
          cellRef: cellRef(amountCol, i),
          errorType: 'Vertical column sum mismatch',
          category: 'vertical', severity: 'critical',
          expectedValue: runningSum, actualValue: amount,
          difference: round2(amount - runningSum),
          message: `Amount column sum ₹${runningSum.toLocaleString('en-IN')} ≠ declared total ₹${amount.toLocaleString('en-IN')} at row ${i + 1}`,
        });
      }
      runningSum = 0;
      continue;
    }

    const desc = headerMap.description !== undefined ? cells[headerMap.description] : joined;
    if (!desc || desc.length < 3 || isTotalLabel(desc)) continue;
    const qty = headerMap.qty !== undefined ? parseNumber(cells[headerMap.qty]) : 0;
    const rate = headerMap.rate !== undefined ? parseNumber(cells[headerMap.rate]) : 0;
    if (qty > 0 || rate > 0 || amount > 0) runningSum = round2(runningSum + amount);
  }

  return errors;
}

function auditDataQuality(
  page: BoqPageValidation,
  rows: (string | number)[][],
  headerMap: Record<string, number>,
  headerRowIdx: number,
): DprAuditError[] {
  const errors: DprAuditError[] = [];
  const seenDescriptions = new Map<string, number>();

  for (let i = headerRowIdx + 1; i < rows.length; i += 1) {
    const cells = rows[i].map((c) => String(c ?? '').trim());
    if (!cells.some(Boolean)) continue;
    const joined = cells.filter(Boolean).join(' ');
    if (isTotalLabel(joined)) continue;

    const desc = headerMap.description !== undefined ? cells[headerMap.description] : joined;
    const qty = headerMap.qty !== undefined ? parseNumber(cells[headerMap.qty]) : 0;
    const rate = headerMap.rate !== undefined ? parseNumber(cells[headerMap.rate]) : 0;
    const amount = headerMap.amount !== undefined ? parseNumber(cells[headerMap.amount]) : 0;
    const rowNo = i + 1;

    if ((qty > 0 || rate > 0 || amount > 0) && (!desc || desc.length < 2)) {
      errors.push({
        sheetName: page.sheetName, pageNo: page.pageNo, rowNo, cellRef: '',
        errorType: 'Blank mandatory cell', category: 'data', severity: 'minor',
        expectedValue: 'Description / Particulars', actualValue: '(blank)',
        difference: null,
        message: `Row ${rowNo}: quantity/rate/amount present but description is blank`,
      });
    }

    if (qty < 0 || rate < 0) {
      const col = qty < 0 ? headerMap.qty : headerMap.rate;
      errors.push({
        sheetName: page.sheetName, pageNo: page.pageNo, rowNo,
        cellRef: col !== undefined ? cellRef(col, i) : '',
        errorType: 'Invalid negative value', category: 'data', severity: 'major',
        expectedValue: '>= 0', actualValue: qty < 0 ? qty : rate,
        difference: null,
        message: `Row ${rowNo}: negative ${qty < 0 ? 'quantity' : 'rate'} not permitted`,
      });
    }

    if (desc && desc.length >= 3 && (qty > 0 || amount > 0)) {
      const key = desc.toLowerCase();
      const prev = seenDescriptions.get(key);
      if (prev != null) {
        errors.push({
          sheetName: page.sheetName, pageNo: page.pageNo, rowNo, cellRef: '',
          errorType: 'Duplicate entry', category: 'data', severity: 'minor',
          expectedValue: 'Unique item', actualValue: desc,
          difference: null,
          message: `Row ${rowNo}: duplicate description "${desc}" (also at row ${prev})`,
        });
      } else {
        seenDescriptions.set(key, rowNo);
      }
    }

    if (headerMap.qty !== undefined && headerMap.rate !== undefined && headerMap.amount !== undefined) {
      const addr = cellRef(headerMap.amount, i);
      const cell = rows[i]; // need sheet for formula check - skip if no formula access here
      void cell;
      if (qty > 0 && rate > 0 && amount > 0) {
        const expected = round2(qty * rate);
        if (Math.abs(amount - expected) > AMOUNT_TOLERANCE) {
          const sheetCell = addr; // placeholder for overwritten formula detection in line audit
          void sheetCell;
        }
      }
    }
  }

  return errors;
}

function auditOverwrittenFormulas(
  sheet: XLSX.WorkSheet,
  page: BoqPageValidation,
  headerMap: Record<string, number>,
  headerRowIdx: number,
  rows: (string | number)[][],
): DprAuditError[] {
  const errors: DprAuditError[] = [];
  if (headerMap.qty === undefined || headerMap.rate === undefined || headerMap.amount === undefined) return errors;

  for (let i = headerRowIdx + 1; i < rows.length; i += 1) {
    const cells = rows[i].map((c) => String(c ?? '').trim());
    const joined = cells.filter(Boolean).join(' ');
    if (isTotalLabel(joined)) continue;

    const qty = parseNumber(cells[headerMap.qty]);
    const rate = parseNumber(cells[headerMap.rate]);
    const amount = parseNumber(cells[headerMap.amount]);
    if (qty <= 0 || rate <= 0 || amount <= 0) continue;

    const addr = cellRef(headerMap.amount, i);
    const cell = sheet[addr] as XLSX.CellObject | undefined;
    const rowNo = i + 1;
    const expected = round2(qty * rate);

    if (cell && !cell.f && Math.abs(amount - expected) <= AMOUNT_TOLERANCE) {
      errors.push({
        sheetName: page.sheetName, pageNo: page.pageNo, rowNo, cellRef: addr,
        errorType: 'Missing formula', category: 'formula', severity: 'minor',
        expectedValue: `=${XLSX.utils.encode_col(headerMap.qty)}${rowNo}*${XLSX.utils.encode_col(headerMap.rate)}${rowNo}`,
        actualValue: amount, difference: null,
        message: `Cell ${addr}: amount matches Qty×Rate but no Excel formula present (possible hard-coded value)`,
      });
    } else if (cell?.f && !/^=/i.test(cell.f) && cell.f.includes(String(amount))) {
      errors.push({
        sheetName: page.sheetName, pageNo: page.pageNo, rowNo, cellRef: addr,
        errorType: 'Overwritten formula', category: 'formula', severity: 'major',
        expectedValue: 'Dynamic formula', actualValue: cell.f,
        difference: null,
        message: `Cell ${addr}: formula may have been overwritten with static value`,
      });
    }
  }

  return errors;
}

function lineToAuditError(page: BoqPageValidation, line: BoqPageValidation['lines'][number]): DprAuditError {
  const severity: DprAuditSeverity = line.status === 'fail' ? 'major' : 'minor';
  const amountRef = line.sheetRow ? amountColRef(page, line.sheetRow) : '';
  const qtyRef = line.sheetRow && page.headerMap?.qty !== undefined
    ? cellRef(page.headerMap.qty, line.sheetRow - 1) : '';
  const cellRefStr = amountRef || qtyRef;

  return {
    sheetName: page.sheetName,
    pageNo: page.pageNo,
    rowNo: line.sheetRow ?? line.lineNo,
    cellRef: cellRefStr,
    errorType: line.status === 'fail' ? 'Qty × Rate mismatch' : 'Data warning',
    category: line.status === 'fail' ? 'horizontal' : 'data',
    severity,
    expectedValue: line.computedAmount,
    actualValue: line.declaredAmount,
    difference: line.difference,
    message: line.message ?? `${line.description}: Qty×Rate check`,
  };
}

function totalCheckToError(page: BoqPageValidation, check: BoqTotalRowCheck): DprAuditError {
  return {
    sheetName: page.sheetName,
    pageNo: page.pageNo,
    rowNo: check.rowNo,
    cellRef: amountColRef(page, check.rowNo),
    errorType: `${check.label} mismatch`,
    category: /gross|grand|abstract|gac|bc/i.test(check.label) ? 'dpr_estimate' : 'vertical',
    severity: /gross|grand|abstract|gac|bc/i.test(check.label) ? 'critical' : 'major',
    expectedValue: check.computedAmount,
    actualValue: check.declaredAmount,
    difference: round2(check.declaredAmount - check.computedAmount),
    message: check.message ?? `${check.label} row ${check.rowNo} mismatch`,
  };
}

function crossCheckToError(check: BoqCrossCheck, page: BoqPageValidation | undefined): DprAuditError {
  return {
    sheetName: page?.sheetName ?? 'Cross-sheet',
    pageNo: page?.pageNo ?? 0,
    rowNo: 0,
    cellRef: '',
    errorType: 'DPR estimate mismatch',
    category: 'dpr_estimate',
    severity: 'critical',
    expectedValue: check.gac ?? check.boqSum,
    actualValue: check.abstract ?? check.bc,
    difference: check.gac != null && check.abstract != null ? round2((check.abstract ?? 0) - check.gac) : null,
    message: check.message ?? check.label,
  };
}

function dedupeErrors(errors: DprAuditError[]): DprAuditError[] {
  const seen = new Set<string>();
  return errors.filter((e) => {
    const key = `${e.sheetName}|${e.rowNo}|${e.cellRef}|${e.category}|${e.errorType}|${e.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function rankErrors(errors: DprAuditError[]): DprAuditError[] {
  const order = { critical: 0, major: 1, minor: 2 };
  return [...errors].sort((a, b) => order[a.severity] - order[b.severity]);
}

export function buildExcelAudit(
  workbook: XLSX.WorkBook,
  visible: string[],
  hidden: string[],
  pages: BoqPageValidation[],
  crossChecks: BoqCrossCheck[],
  baseReport: BoqValidationReport,
): DprExcelAuditSummary {
  const errors: DprAuditError[] = [];
  const formulaAudits: DprFormulaAuditRow[] = [];
  let formulasVerified = 0;
  let formulasUnverified = 0;
  let calculationsVerified = 0;

  for (const page of pages) {
    if (!page.isCalculationSheet) continue;
    calculationsVerified += page.totalItems + page.totalChecks.length;

    for (const line of page.lines) {
      if (line.status !== 'pass') errors.push(lineToAuditError(page, line));
    }
    for (const check of page.totalChecks) {
      if (!check.match) errors.push(totalCheckToError(page, check));
    }
    if (!page.headerValid && page.totalItems > 0) {
      errors.push({
        sheetName: page.sheetName,
        pageNo: page.pageNo,
        rowNo: page.headerRowNo ?? 0,
        cellRef: page.headerRowNo ? `A${page.headerRowNo}` : '',
        errorType: 'Column heading issue',
        category: 'data',
        severity: 'minor',
        expectedValue: 'Valid BOQ headings',
        actualValue: (page.headerIssues ?? []).join('; '),
        difference: null,
        message: (page.headerIssues ?? []).join('; '),
      });
    }

    const sheet = workbook.Sheets[page.sheetName];
    if (!sheet) continue;

    const formulaAudit = auditFormulasOnSheet(sheet, page.sheetName, page.pageNo);
    formulasVerified += formulaAudit.verified;
    formulasUnverified += formulaAudit.unverified;
    // Store only issues for DB/API payload — full audit available in Excel export
    formulaAudits.push(...formulaAudit.rows.filter((r) => r.status !== 'verified'));
    errors.push(...formulaAudit.errors);

    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1, defval: '', raw: true });
    const headerRowIdx = (page.headerRowNo ?? 1) - 1;
    const headerMap = page.headerMap ?? {};
    errors.push(...auditVerticalAmountColumn(sheet, page.sheetName, page.pageNo, headerMap, headerRowIdx, rows));
    errors.push(...auditDataQuality(page, rows, headerMap, headerRowIdx));
    errors.push(...auditOverwrittenFormulas(sheet, page, headerMap, headerRowIdx, rows));
  }

  for (const check of crossChecks) {
    if (!check.match) {
      const firstBoq = pages.find((p) => p.sheetType === 'boq' && p.isCalculationSheet);
      const abstractPage = pages.find((p) => p.sheetType === 'abstract' && p.isCalculationSheet);
      errors.push(crossCheckToError(check, abstractPage ?? firstBoq));
    }
  }

  const ranked = rankErrors(dedupeErrors(errors));
  const totalChecks = calculationsVerified + formulasVerified + formulasUnverified;
  const totalErrors = ranked.length;
  const errorsBySeverity = {
    critical: ranked.filter((e) => e.severity === 'critical').length,
    major: ranked.filter((e) => e.severity === 'major').length,
    minor: ranked.filter((e) => e.severity === 'minor').length,
  };
  const errorPercentage = totalChecks > 0 ? round2((totalErrors / totalChecks) * 100) : 0;
  const validationStatus = baseReport.status === 'passed'
    ? 'Pass'
    : baseReport.status === 'warning'
      ? 'Warning'
      : 'Fail';

  return {
    visibleSheetsChecked: visible.length,
    hiddenSheetsSkipped: hidden.length,
    hiddenSheetNames: hidden,
    formulasVerified,
    formulasUnverified,
    calculationsVerified,
    totalErrors,
    errorPercentage,
    validationStatus,
    errors: ranked.slice(0, MAX_STORED_ERRORS),
    formulaAudits: formulaAudits.slice(0, MAX_FORMULA_AUDITS),
    errorsBySeverity,
    firstErrorPageNo: ranked[0]?.pageNo ?? baseReport.firstCalculationPageNo,
    firstErrorCellRef: ranked[0]?.cellRef ?? null,
  };
}

export function attachExcelAudit(
  workbook: XLSX.WorkBook,
  visible: string[],
  hidden: string[],
  report: BoqValidationReport,
): DprExcelAuditReport {
  try {
    const audit = buildExcelAudit(workbook, visible, hidden, report.pages, report.crossChecks, report);
    return { ...report, audit };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Audit engine error';
    return {
      ...report,
      audit: {
        visibleSheetsChecked: visible.length,
        hiddenSheetsSkipped: hidden.length,
        hiddenSheetNames: hidden,
        formulasVerified: 0,
        formulasUnverified: 0,
        calculationsVerified: 0,
        totalErrors: 0,
        errorPercentage: 0,
        validationStatus: report.status === 'passed' ? 'Pass' : report.status === 'warning' ? 'Warning' : 'Fail',
        errors: [{
          sheetName: 'System',
          pageNo: 0,
          rowNo: 0,
          cellRef: '',
          errorType: 'Audit engine error',
          category: 'data',
          severity: 'minor',
          expectedValue: null,
          actualValue: null,
          difference: null,
          message: `Extended audit could not complete: ${msg}. Line-level BOQ checks still applied.`,
        }],
        formulaAudits: [],
        errorsBySeverity: { critical: 0, major: 0, minor: 1 },
        firstErrorPageNo: report.firstCalculationPageNo,
        firstErrorCellRef: null,
      },
    };
  }
}
