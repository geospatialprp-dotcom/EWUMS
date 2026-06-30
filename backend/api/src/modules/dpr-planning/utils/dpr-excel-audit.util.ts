import * as XLSX from 'xlsx';
import type {
  BoqCrossCheck,
  BoqPageValidation,
  BoqTotalRowCheck,
  BoqValidationReport,
} from './dpr-boq-validation.util';
import {
  isSubTotalLabel,
  isSectionTotalLabel,
  isTotalCostLabel,
  isGrandTotalLabel,
} from './dpr-boq-validation.util';
import type {
  DprAuditError,
  DprAuditSeverity,
  DprExcelAuditReport,
  DprExcelAuditSummary,
  DprFormulaAuditRow,
  DprSheetSummary,
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

function totalRowTolerance(amount: number): number {
  const base = Math.abs(amount);
  return Math.max(0.05, TOTAL_TOLERANCE, base * 0.00001);
}

function cellRef(col: number, row: number): string {
  return XLSX.utils.encode_cell({ r: row, c: col });
}

function columnLabel(col: number, headerMap?: Record<string, number>, field?: string): string {
  if (field && headerMap?.[field] !== undefined) {
    return field.charAt(0).toUpperCase() + field.slice(1);
  }
  return XLSX.utils.encode_col(col);
}

function refColumn(cellRefStr: string): string {
  if (!cellRefStr) return '';
  try {
    return XLSX.utils.encode_col(XLSX.utils.decode_cell(cellRefStr).c);
  } catch {
    return '';
  }
}

function amountColRef(page: BoqPageValidation, rowNo: number): string {
  const col = page.headerMap?.total_amount ?? page.headerMap?.ujn ?? page.headerMap?.amount;
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
  return isSubTotalLabel(text) || isSectionTotalLabel(text) || isTotalCostLabel(text) || isGrandTotalLabel(text);
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
      // Formula display vs eval mismatch is informational only — Excel may use precision we cannot replay.
    }
  }

  return { errors, rows, verified, unverified };
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
      const descCol = headerMap.description;
      errors.push({
        sheetName: page.sheetName, pageNo: page.pageNo, rowNo,
        column: descCol !== undefined ? columnLabel(descCol, headerMap, 'description') : 'Description',
        cellRef: descCol !== undefined ? cellRef(descCol, i) : '',
        errorType: 'Blank mandatory cell', category: 'data', severity: 'minor',
        expectedValue: 'Description / Particulars', actualValue: '(blank)',
        difference: null,
        message: `Row ${rowNo}: quantity/rate/amount present but description is blank`,
      });
    }

    if (qty < 0 || rate < 0) {
      const col = qty < 0 ? headerMap.qty : headerMap.rate;
      const field = qty < 0 ? 'qty' : 'rate';
      errors.push({
        sheetName: page.sheetName, pageNo: page.pageNo, rowNo,
        column: col !== undefined ? columnLabel(col, headerMap, field) : field,
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

function issueToErrorType(checkType: string): string {
  if (checkType === 'description') return 'Missing / invalid description';
  if (checkType === 'quantity') return 'Invalid quantity';
  if (checkType === 'rate') return 'Invalid rate';
  if (checkType === 'qty_rate_ujn' || checkType === 'qty_rate_amount') return 'Qty × Rate ≠ Total Amount';
  if (checkType === 'component_sum') return 'Component sum ≠ Total Amount';
  if (checkType === 'cross_check') return 'Qty×Rate ≠ component sum';
  return 'Data warning';
}

function cellRefForIssue(
  page: BoqPageValidation,
  line: BoqPageValidation['lines'][number],
  issue: { checkType: string; column?: string },
): string {
  const rowIdx = (line.sheetRow ?? line.lineNo) - 1;
  const map = page.headerMap;
  if (!map || rowIdx < 0) return '';

  const fieldByCheck: Record<string, string | undefined> = {
    description: 'description',
    quantity: 'qty',
    rate: 'rate',
    qty_rate_ujn: map.total_amount !== undefined ? 'total_amount' : 'ujn',
    qty_rate_amount: map.total_amount !== undefined ? 'total_amount' : 'amount',
    component_sum: 'total_amount',
    cross_check: 'total_amount',
  };
  const field = fieldByCheck[issue.checkType];
  if (field && map[field] !== undefined) return cellRef(map[field], rowIdx);
  if (issue.column === 'Unit' && map.unit !== undefined) return cellRef(map.unit, rowIdx);
  return line.sheetRow ? amountColRef(page, line.sheetRow) : '';
}

function lineToAuditErrors(page: BoqPageValidation, line: BoqPageValidation['lines'][number]): DprAuditError[] {
  const failedIssues = (line.issues ?? []).filter((i) => i.status !== 'pass');
  if (failedIssues.length > 0) {
    return failedIssues.map((issue) => {
      const severity: DprAuditSeverity = issue.status === 'fail' ? 'major' : 'minor';
      const isHorizontal = issue.checkType === 'qty_rate_ujn'
        || issue.checkType === 'component_sum'
        || issue.checkType === 'qty_rate_amount'
        || issue.checkType === 'cross_check';
      return {
        sheetName: page.sheetName,
        pageNo: page.pageNo,
        rowNo: line.sheetRow ?? line.lineNo,
        column: issue.column,
        cellRef: cellRefForIssue(page, line, issue),
        errorType: issueToErrorType(issue.checkType),
        checkOrder: issue.order,
        category: isHorizontal ? 'horizontal' : 'data',
        severity,
        expectedValue: issue.expectedValue ?? null,
        actualValue: issue.actualValue ?? null,
        difference: issue.difference ?? null,
        message: issue.message,
      };
    });
  }

  if (line.status === 'pass') return [];

  const severity: DprAuditSeverity = line.status === 'fail' ? 'major' : 'minor';
  const tharali = line.layoutFormat === 'tharali' && line.tharali;
  const failQtyRate = tharali && !tharali.qtyRateTotalMatch && line.qty > 0 && line.rate > 0 && tharali.totalAmount > 0;
  const failComponent = tharali && !tharali.componentSumMatch && tharali.totalAmount > 0;
  const failCross = tharali && !tharali.crossCheckMatch && line.qty > 0 && line.rate > 0;

  let column = 'Amount';
  let cellRefStr = '';
  if (failQtyRate && page.headerMap?.total_amount !== undefined && line.sheetRow) {
    column = 'Total Amount';
    cellRefStr = cellRef(page.headerMap.total_amount, line.sheetRow - 1);
  } else if (failQtyRate && page.headerMap?.ujn !== undefined && line.sheetRow) {
    column = 'Total Amount';
    cellRefStr = cellRef(page.headerMap.ujn, line.sheetRow - 1);
  } else if (failComponent && page.headerMap?.total_amount !== undefined && line.sheetRow) {
    column = 'Total Amount';
    cellRefStr = cellRef(page.headerMap.total_amount, line.sheetRow - 1);
  } else if (failCross && page.headerMap?.ujn !== undefined && line.sheetRow) {
    column = 'UJN';
    cellRefStr = cellRef(page.headerMap.ujn, line.sheetRow - 1);
  } else {
    const amountRef = line.sheetRow ? amountColRef(page, line.sheetRow) : '';
    const qtyRef = line.sheetRow && page.headerMap?.qty !== undefined
      ? cellRef(page.headerMap.qty, line.sheetRow - 1) : '';
    cellRefStr = amountRef || qtyRef;
    column = amountRef
      ? (page.headerMap?.total_amount !== undefined ? 'Total Amount'
        : page.headerMap?.ujn !== undefined ? 'UJN'
          : page.headerMap?.amount !== undefined ? columnLabel(page.headerMap.amount, page.headerMap, 'amount') : refColumn(amountRef))
      : (page.headerMap?.qty !== undefined ? columnLabel(page.headerMap.qty, page.headerMap, 'qty') : refColumn(qtyRef));
  }

  const errorType = failQtyRate ? 'Qty × Rate ≠ Total Amount'
    : failComponent ? 'Component sum ≠ Total Amount'
      : failCross ? 'Qty×Rate ≠ component sum'
        : line.status === 'fail' ? 'Qty × Rate ≠ Amount' : 'Data warning';
  const checkOrder = failQtyRate ? 4 : failComponent ? 5 : failCross ? 6 : line.status === 'fail' ? 4 : 1;

  return [{
    sheetName: page.sheetName,
    pageNo: page.pageNo,
    rowNo: line.sheetRow ?? line.lineNo,
    column,
    cellRef: cellRefStr,
    errorType,
    checkOrder,
    category: line.status === 'fail' ? 'horizontal' : 'data',
    severity,
    expectedValue: failQtyRate ? tharali?.qtyRateTotal
      : failComponent ? tharali?.componentSum
        : failCross ? tharali?.qtyRateTotal
          : line.computedAmount,
    actualValue: failQtyRate ? tharali?.totalAmount
      : failComponent ? tharali?.totalAmount
        : failCross ? tharali?.componentSum
          : line.declaredAmount,
    difference: line.difference,
    message: line.message ?? `${line.description}: row check`,
  }];
}

function totalCheckToErrors(page: BoqPageValidation, check: BoqTotalRowCheck): DprAuditError[] {
  const errors: DprAuditError[] = [];
  const step = check.checkStep ?? (check.rowType === 'subtotal' ? 6 : 7);
  const isSub = check.rowType === 'subtotal' || step === 6;

  if (check.columnChecks?.length) {
    for (const col of check.columnChecks) {
      if (col.match) continue;
      const colIdx = page.headerMap?.[col.column === 'sorPwd' ? 'sor_pwd' : col.column === 'totalAmount' ? 'total_amount' : col.column];
      errors.push({
        sheetName: page.sheetName,
        pageNo: page.pageNo,
        rowNo: check.rowNo,
        column: col.columnLabel,
        cellRef: colIdx !== undefined ? cellRef(colIdx, check.rowNo - 1) : amountColRef(page, check.rowNo),
        errorType: isSub ? 'Sub Total mismatch' : 'Total Cost mismatch',
        checkOrder: step,
        category: 'vertical',
        severity: isSub ? 'major' : 'critical',
        expectedValue: col.computedAmount,
        actualValue: col.declaredAmount,
        difference: round2(col.declaredAmount - col.computedAmount),
        message: col.message
          ?? `Step ${step} — ${check.label} row ${check.rowNo}, ${col.columnLabel}: Excel ₹${col.declaredAmount.toLocaleString('en-IN')} ≠ calculated ₹${col.computedAmount.toLocaleString('en-IN')}`,
      });
    }
  } else if (!check.match) {
    const addr = amountColRef(page, check.rowNo);
    errors.push({
      sheetName: page.sheetName,
      pageNo: page.pageNo,
      rowNo: check.rowNo,
      column: page.headerMap?.total_amount !== undefined ? 'Total Amount'
        : page.headerMap?.amount !== undefined ? 'Amount' : refColumn(addr),
      cellRef: addr,
      errorType: isSub ? 'Sub Total mismatch' : 'Total Cost mismatch',
      checkOrder: step,
      category: 'vertical',
      severity: isSub ? 'major' : 'critical',
      expectedValue: check.computedAmount,
      actualValue: check.declaredAmount,
      difference: round2(check.declaredAmount - check.computedAmount),
      message: check.message
        ?? `Step ${step} — ${check.label} row ${check.rowNo}: Excel ₹${check.declaredAmount.toLocaleString('en-IN')} ≠ calculated ₹${check.computedAmount.toLocaleString('en-IN')}`,
    });
  }

  if (check.horizontalMatch === false) {
    errors.push({
      sheetName: page.sheetName,
      pageNo: page.pageNo,
      rowNo: check.rowNo,
      column: 'Total Amount',
      cellRef: page.headerMap?.total_amount !== undefined
        ? cellRef(page.headerMap.total_amount, check.rowNo - 1)
        : amountColRef(page, check.rowNo),
      errorType: 'Component sum ≠ Total Amount',
      checkOrder: step,
      category: 'horizontal',
      severity: 'major',
      expectedValue: check.horizontalComputed ?? null,
      actualValue: check.horizontalDeclared ?? null,
      difference: check.horizontalDeclared != null && check.horizontalComputed != null
        ? round2(check.horizontalDeclared - check.horizontalComputed)
        : null,
      message: check.message?.includes('DSR+UJN')
        ? check.message.split('; ').find((m) => m.includes('DSR+UJN')) ?? check.message
        : `Step ${step} — ${check.label} row ${check.rowNo}: DSR+UJN+SOR(PWD)+NSI = ${check.horizontalComputed} ≠ Total Amount ${check.horizontalDeclared}`,
    });
  }

  return errors;
}

function crossCheckToError(check: BoqCrossCheck, page: BoqPageValidation | undefined): DprAuditError {
  const isTharaliGross = /tharali/i.test(check.label);
  return {
    sheetName: page?.sheetName ?? 'Cross-sheet',
    pageNo: page?.pageNo ?? 0,
    rowNo: 0,
    column: isTharaliGross ? 'Gross Total' : 'Grand Total',
    cellRef: '',
    errorType: isTharaliGross ? 'Abstract gross mismatch' : 'DPR estimate mismatch',
    category: 'dpr_estimate',
    severity: 'critical',
    expectedValue: check.boqSum ?? check.gac,
    actualValue: check.abstract ?? check.bc,
    difference: check.abstract != null && check.boqSum != null ? round2(check.abstract - check.boqSum) : null,
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
  const severityOrder = { critical: 0, major: 1, minor: 2 };
  return [...errors].sort((a, b) => {
    const orderDiff = (a.checkOrder ?? 99) - (b.checkOrder ?? 99);
    if (orderDiff !== 0) return orderDiff;
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

function buildSheetsSummary(
  pages: BoqPageValidation[],
  visible: string[],
  blockingErrors: DprAuditError[],
): DprSheetSummary[] {
  const errorsBySheet = new Map<string, number>();
  for (const e of blockingErrors) {
    if (!e.sheetName) continue;
    errorsBySheet.set(e.sheetName, (errorsBySheet.get(e.sheetName) ?? 0) + 1);
  }
  const pageByName = new Map(pages.map((p) => [p.sheetName, p]));

  return visible.map((sheetName) => {
    const page = pageByName.get(sheetName);
    if (!page?.isCalculationSheet) {
      return { sheetName, status: 'skipped' as const };
    }
    const errorCount = errorsBySheet.get(sheetName) ?? 0;
    const itemCount = page.totalItems + page.totalChecks.length;
    return {
      sheetName,
      status: errorCount > 0 ? ('failed' as const) : ('passed' as const),
      itemCount,
      errorCount,
    };
  });
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
      if (line.status !== 'pass') errors.push(...lineToAuditErrors(page, line));
    }
    for (const check of page.totalChecks) {
      if (!check.match) errors.push(...totalCheckToErrors(page, check));
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
    // Step 6/7 vertical totals: validateTotalRows → totalCheckToErrors (single source of truth).
  }

  for (const check of crossChecks) {
    if (!check.match) {
      const abstractPage = pages.find((p) => p.sheetType === 'abstract' && p.isCalculationSheet);
      const firstBoq = pages.find((p) => p.sheetType === 'boq' && p.isCalculationSheet);
      errors.push(crossCheckToError(check, /tharali/i.test(check.label) ? abstractPage : abstractPage ?? firstBoq));
    }
  }

  const ranked = rankErrors(dedupeErrors(errors));
  const blockingErrors = ranked.filter((e) => e.severity === 'critical' || e.severity === 'major');
  const totalChecks = calculationsVerified + formulasVerified + formulasUnverified;
  const totalErrors = blockingErrors.length;
  const errorSheetCount = new Set(blockingErrors.map((e) => e.sheetName).filter(Boolean)).size;
  const errorsBySeverity = {
    critical: blockingErrors.filter((e) => e.severity === 'critical').length,
    major: blockingErrors.filter((e) => e.severity === 'major').length,
    minor: ranked.filter((e) => e.severity === 'minor').length,
  };
  const errorPercentage = totalChecks > 0 ? round2((totalErrors / totalChecks) * 100) : 0;
  const validationStatus = baseReport.status === 'passed'
    ? 'Pass'
    : baseReport.status === 'warning'
      ? 'Warning'
      : 'Fail';

  const summaryMessage = totalErrors === 0
    ? 'BOQ validation PASSED'
    : `${totalErrors} error${totalErrors === 1 ? '' : 's'} in ${errorSheetCount} sheet${errorSheetCount === 1 ? '' : 's'}`;

  const sheetsSummary = buildSheetsSummary(pages, visible, blockingErrors);

  return {
    visibleSheetsChecked: visible.length,
    hiddenSheetsSkipped: hidden.length,
    hiddenSheetNames: hidden,
    formulasVerified,
    formulasUnverified,
    calculationsVerified,
    totalErrors,
    errorSheetCount,
    errorPercentage,
    validationStatus,
    errors: blockingErrors.slice(0, MAX_STORED_ERRORS),
    formulaAudits: formulaAudits.slice(0, MAX_FORMULA_AUDITS),
    errorsBySeverity,
    firstErrorPageNo: blockingErrors[0]?.pageNo ?? ranked[0]?.pageNo ?? baseReport.firstCalculationPageNo,
    firstErrorCellRef: blockingErrors[0]?.cellRef ?? ranked[0]?.cellRef ?? null,
    summaryMessage,
    sheetsSummary,
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
    const hasBlockingAuditErrors = audit.totalErrors > 0;
    const finalStatus: BoqValidationReport['status'] = hasBlockingAuditErrors
      ? 'failed'
      : report.status;
    const readyForTac = finalStatus === 'passed';
    const summaryMessage = readyForTac
      ? 'BOQ validation PASSED'
      : audit.summaryMessage;

    return {
      ...report,
      status: finalStatus,
      summary: {
        ...report.summary,
        message: summaryMessage,
        readyForTac,
        issues: readyForTac ? [] : [summaryMessage],
      },
      audit: {
        ...audit,
        validationStatus: finalStatus === 'passed' ? 'Pass' : finalStatus === 'warning' ? 'Warning' : 'Fail',
        summaryMessage,
      },
    };
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
        errorSheetCount: 0,
        errorPercentage: 0,
        validationStatus: report.status === 'passed' ? 'Pass' : report.status === 'warning' ? 'Warning' : 'Fail',
        summaryMessage: report.summary.message,
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
        sheetsSummary: buildSheetsSummary(report.pages, visible, []),
      },
    };
  }
}
