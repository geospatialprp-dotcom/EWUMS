import * as XLSX from 'xlsx';
import { attachExcelAudit, AMOUNT_TOLERANCE, getVisibleSheetNames } from './dpr-excel-audit.util';
import type { DprExcelAuditReport } from './dpr-excel-audit.types';
const SECTION_TOTAL_TOLERANCE = 1.0;
/** Only persist problem lines — keeps API/DB payloads small for large BOQ files. */
const STORE_PROBLEM_LINES_ONLY = true;

export type BoqLineValidation = {
  lineNo: number;
  sheetRow?: number;
  itemCode?: string;
  description: string;
  unit: string;
  qty: number;
  rate: number;
  declaredAmount: number;
  computedAmount: number;
  difference: number;
  status: 'pass' | 'fail' | 'warning';
  message?: string;
};

export type BoqKeyTotal = {
  label: string;
  amount: number;
  rowNo?: number;
  source: 'label' | 'highlight';
};

export type BoqTotalRowCheck = {
  label: string;
  rowNo: number;
  declaredAmount: number;
  computedAmount: number;
  match: boolean;
  message?: string;
};

export type BoqPageValidation = {
  pageNo: number;
  sheetName: string;
  sheetType: 'boq' | 'gac' | 'bc' | 'abstract' | 'form' | 'other';
  status: 'passed' | 'failed' | 'warning' | 'skipped';
  isCalculationSheet: boolean;
  totalItems: number;
  passedItems: number;
  failedItems: number;
  warningItems: number;
  computedPageTotal: number;
  declaredPageTotal: number | null;
  pageTotalMatch: boolean | null;
  hasIssues: boolean;
  issues: string[];
  keyTotals: BoqKeyTotal[];
  headerLabels: string[];
  headerRowNo: number | null;
  headerValid: boolean;
  headerIssues: string[];
  headerMap?: Record<string, number>;
  totalChecks: BoqTotalRowCheck[];
  lines: BoqLineValidation[];
};

export type BoqCrossCheck = {
  label: string;
  gac: number | null;
  bc: number | null;
  abstract: number | null;
  boqSum: number | null;
  match: boolean;
  message?: string;
};

export type BoqValidationReport = {
  status: 'passed' | 'failed' | 'warning';
  totalItems: number;
  passedItems: number;
  failedItems: number;
  warningItems: number;
  computedGrandTotal: number;
  declaredGrandTotal: number | null;
  grandTotalMatch: boolean | null;
  firstCalculationPageNo: number | null;
  pages: BoqPageValidation[];
  lines: BoqLineValidation[];
  crossChecks: BoqCrossCheck[];
  summary: {
    message: string;
    readyForTac: boolean;
    issues: string[];
  };
};

const TOTAL_LABEL_PATTERNS: Array<{ key: string; pattern: RegExp; priority: number }> = [
  { key: 'Gross Total', pattern: /gross\s*total/i, priority: 1 },
  { key: 'Grand Total', pattern: /grand\s*total/i, priority: 2 },
  { key: 'GAC', pattern: /\bgac\b|gross\s*amount\s*of\s*contract/i, priority: 3 },
  { key: 'BC', pattern: /\bbc\b|basic\s*cost/i, priority: 4 },
  { key: 'Abstract of Cost', pattern: /abstract\s*of\s*cost|cost\s*abstract/i, priority: 5 },
  { key: 'Section Total', pattern: /section\s*total/i, priority: 6 },
  { key: 'Net Amount', pattern: /net\s*amount/i, priority: 7 },
  { key: 'Sub Total', pattern: /sub\s*total/i, priority: 8 },
  { key: 'Total', pattern: /\btotal\b/i, priority: 9 },
];

function parseNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const cleaned = String(value ?? '').replace(/[,₹\s]/g, '').trim();
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function isHeaderRow(cells: string[]): boolean {
  const lower = cells.map((c) => c.toLowerCase());
  const hasDesc = lower.some((c) => c.includes('description') || c.includes('particulars') || c.includes('item'));
  const hasQty = lower.some((c) => c.includes('qty') || c.includes('quantity'));
  const hasRate = lower.some((c) => c.includes('rate'));
  const hasAmount = lower.some((c) => c.includes('amount') || c.includes('cost'));
  const hasSn = lower.some((c) => c === 'sn' || c === 's.no' || c === 's.no.' || c.includes('serial'));
  return hasDesc && (hasQty || hasRate || hasAmount || hasSn);
}

function buildHeaderMap(cells: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  cells.forEach((cell, idx) => {
    const key = normalizeKey(cell);
    if (!key) return;
    if (key === 'sn' || ['s_no', 'sno', 'sl_no', 'sr_no', 'serial'].includes(key)) map.serial = idx;
    else if (key.includes('description') || key.includes('particulars') || key.includes('item')) map.description = idx;
    else if (key === 'unit' || key === 'units' || key === 'uom') map.unit = idx;
    else if (key.includes('qty') || key.includes('quantity')) map.qty = idx;
    else if (key.includes('rate')) map.rate = idx;
    else if (key.includes('amount') || key.includes('cost')) map.amount = idx;
  });
  return map;
}

function findHeaderInfo(rows: (string | number)[][]): {
  headerRowNo: number | null;
  headerLabels: string[];
  headerMap: Record<string, number>;
  headerValid: boolean;
  headerIssues: string[];
} {
  for (let i = 0; i < Math.min(rows.length, 40); i += 1) {
    const cells = rows[i].map((c) => String(c ?? '').trim());
    if (!cells.some(Boolean)) continue;
    if (!isHeaderRow(cells)) continue;

    const headerMap = buildHeaderMap(cells);
    const issues: string[] = [];
    if (headerMap.description === undefined) issues.push('Missing Description / Particulars column');
    if (headerMap.qty === undefined && headerMap.rate === undefined) {
      issues.push('Missing Qty and Rate columns');
    }
    if (headerMap.amount === undefined && headerMap.rate === undefined) {
      issues.push('Missing Amount column');
    }

    return {
      headerRowNo: i + 1,
      headerLabels: cells.filter(Boolean),
      headerMap,
      headerValid: issues.length === 0,
      headerIssues: issues,
    };
  }
  return { headerRowNo: null, headerLabels: [], headerMap: {}, headerValid: false, headerIssues: ['No BOQ column heading row found'] };
}

function rowLabel(cells: string[]): string {
  return cells.filter(Boolean).join(' ').trim();
}

function amountFromRow(cells: string[], headerMap: Record<string, number>): number {
  if (headerMap.amount !== undefined) {
    const v = parseNumber(cells[headerMap.amount]);
    if (v > 0) return round2(v);
  }
  const nums = cells.map(parseNumber).filter((n) => n > 0);
  return nums.length ? round2(Math.max(...nums)) : 0;
}

function isDataRow(cells: string[], headerMap: Record<string, number>): boolean {
  const desc = headerMap.description !== undefined ? String(cells[headerMap.description] ?? '').trim() : rowLabel(cells);
  if (!desc || desc.length < 3) return false;
  const lower = desc.toLowerCase();
  if (/grand\s*total|gross\s*total|section\s*total|sub\s*total|abstract|^\s*total\s*$/i.test(lower)) return false;
  if (/^\d+(\.\d+)?$/.test(desc)) return false;
  const qty = headerMap.qty !== undefined ? parseNumber(cells[headerMap.qty]) : 0;
  const rate = headerMap.rate !== undefined ? parseNumber(cells[headerMap.rate]) : 0;
  const amount = amountFromRow(cells, headerMap);
  return qty > 0 || rate > 0 || amount > 0;
}

function validateTotalRows(
  rows: (string | number)[][],
  headerMap: Record<string, number>,
  headerRowNo: number | null,
  lineSum: number,
): BoqTotalRowCheck[] {
  const checks: BoqTotalRowCheck[] = [];
  const startIdx = headerRowNo ? headerRowNo : 0;
  let sectionSum = 0;

  for (let i = startIdx; i < rows.length; i += 1) {
    const cells = rows[i].map((c) => String(c ?? '').trim());
    const joined = rowLabel(cells);
    if (!joined) continue;

    if (Object.keys(headerMap).length > 0 && isDataRow(cells, headerMap)) {
      sectionSum = round2(sectionSum + amountFromRow(cells, headerMap));
    }

    for (const { key, pattern } of TOTAL_LABEL_PATTERNS) {
      if (!pattern.test(joined)) continue;
      const declaredAmount = amountFromRow(cells, headerMap);
      if (declaredAmount <= 0) continue;

      let computedAmount = lineSum;
      if (/gross\s*total|grand\s*total/i.test(key)) {
        computedAmount = lineSum;
      } else if (/section\s*total|sub\s*total/i.test(key)) {
        computedAmount = sectionSum;
        sectionSum = 0;
      }

      const match = Math.abs(declaredAmount - computedAmount) <= SECTION_TOTAL_TOLERANCE;
      checks.push({
        label: key,
        rowNo: i + 1,
        declaredAmount,
        computedAmount,
        match,
        message: match
          ? undefined
          : `${key} row ${i + 1}: Excel shows ₹${declaredAmount.toLocaleString('en-IN')} but calculated ₹${computedAmount.toLocaleString('en-IN')}`,
      });
      break;
    }
  }

  return checks;
}


function extractLabeledTotals(rows: (string | number)[][]): BoqKeyTotal[] {
  const totals: BoqKeyTotal[] = [];
  rows.forEach((row, idx) => {
    const cells = row.map((c) => String(c ?? '').trim());
    const joined = rowLabel(cells);
    if (!joined) return;
    for (const { key, pattern } of TOTAL_LABEL_PATTERNS) {
      if (!pattern.test(joined)) continue;
      const amounts = cells.map(parseNumber).filter((n) => n > 0);
      if (!amounts.length) continue;
      totals.push({ label: key, amount: round2(Math.max(...amounts)), rowNo: idx + 1, source: 'label' });
      break;
    }
  });
  return totals;
}

function extractSheetKeyTotals(_sheet: XLSX.WorkSheet, _workbook: XLSX.WorkBook, rows: (string | number)[][]): BoqKeyTotal[] {
  return extractLabeledTotals(rows);
}

function slimLines(lines: BoqLineValidation[]): BoqLineValidation[] {
  if (!STORE_PROBLEM_LINES_ONLY) return lines;
  return lines.filter((l) => l.status === 'fail' || l.status === 'warning');
}

function slimPage(page: BoqPageValidation): BoqPageValidation {
  if (!STORE_PROBLEM_LINES_ONLY) return page;
  return { ...page, lines: slimLines(page.lines) };
}

function pickDeclaredTotal(totalChecks: BoqTotalRowCheck[], keyTotals: BoqKeyTotal[], lineSum: number): number | null {
  const priority = ['Gross Total', 'Grand Total', 'GAC', 'Abstract of Cost', 'BC', 'Section Total', 'Net Amount', 'Sub Total', 'Total'];
  for (const label of priority) {
    const hit = totalChecks.find((t) => t.label === label && t.declaredAmount > 0);
    if (hit) return hit.declaredAmount;
    const key = keyTotals.find((t) => t.label.toLowerCase() === label.toLowerCase());
    if (key) return key.amount;
  }
  return lineSum > 0 ? round2(lineSum) : null;
}

function classifySheet(sheetName: string, rows: (string | number)[][], lines: BoqLineValidation[], headerValid: boolean): BoqPageValidation['sheetType'] {
  const name = sheetName.toLowerCase();
  const sample = rows.slice(0, 20).flat().map((c) => String(c ?? '').toLowerCase()).join(' ');
  if (/\bgac\b|gross\s*amount/.test(name) || (/\bgac\b|gross\s*amount\s*of\s*contract/.test(sample) && !headerValid)) return 'gac';
  if (/\bbc\b|basic\s*cost/.test(name) || (/\bbc\b|basic\s*cost/.test(sample) && !headerValid)) return 'bc';
  if (/abstract\s*of\s*cost|cost\s*abstract|\baoc\b/.test(name) || /abstract\s*of\s*cost/.test(sample)) return 'abstract';
  if (headerValid || lines.length > 0) return 'boq';
  if (/form\s*j|comprehensive|annexure|cover|index|instruction|top\s*page/.test(name)) return 'form';
  if (/form\s*j|comprehensive/.test(sample)) return 'form';
  return 'other';
}

function isCalculationSheet(
  sheetType: BoqPageValidation['sheetType'],
  headerValid: boolean,
  lines: BoqLineValidation[],
  totalChecks: BoqTotalRowCheck[],
  keyTotals: BoqKeyTotal[],
): boolean {
  if (sheetType === 'form') return false;
  if (['gac', 'bc', 'abstract', 'boq'].includes(sheetType)) return true;
  if (headerValid || lines.length > 0) return true;
  if (totalChecks.length > 0 || keyTotals.length > 0) return true;
  return false;
}

function validateLineValues(
  lineNo: number,
  description: string,
  unit: string,
  qty: number,
  rate: number,
  declaredAmount: number,
  itemCode?: string,
  sheetRow?: number,
): BoqLineValidation {
  const roundedQty = round2(qty);
  const roundedRate = round2(rate);
  const roundedDeclared = round2(declaredAmount);
  const computedAmount = round2(roundedQty * roundedRate);
  const difference = round2(roundedDeclared - computedAmount);
  const absDiff = Math.abs(difference);

  let status: BoqLineValidation['status'] = 'pass';
  let message: string | undefined;

  if (roundedQty <= 0 && roundedRate <= 0 && roundedDeclared <= 0) {
    status = 'warning';
    message = 'Zero quantity, rate and amount';
  } else if (roundedQty > 0 && roundedRate > 0 && absDiff > AMOUNT_TOLERANCE) {
    status = 'fail';
    message = `Qty × Rate (${computedAmount}) ≠ Amount (${roundedDeclared})`;
  } else if (roundedQty > 0 && roundedRate === 0 && roundedDeclared > 0) {
    status = 'warning';
    message = 'Amount present but rate is zero';
  } else if (roundedQty === 0 && roundedRate > 0 && roundedDeclared > 0) {
    status = 'warning';
    message = 'Amount present but quantity is zero';
  }

  return {
    lineNo,
    sheetRow,
    itemCode,
    description,
    unit,
    qty: roundedQty,
    rate: roundedRate,
    declaredAmount: roundedDeclared,
    computedAmount,
    difference,
    status,
    message,
  };
}

function parseLinesFromSheetRows(
  rows: (string | number)[][],
  headerInfo: ReturnType<typeof findHeaderInfo>,
  startLineNo: number,
): BoqLineValidation[] {
  const { headerMap, headerRowNo, headerValid } = headerInfo;
  if (!headerValid || headerRowNo == null) return [];

  const lines: BoqLineValidation[] = [];
  let lineNo = startLineNo;
  const startIdx = headerRowNo;

  for (let i = startIdx; i < rows.length; i += 1) {
    const cells = rows[i].map((c) => String(c ?? '').trim());
    if (!cells.some(Boolean)) continue;
    if (i > startIdx && isHeaderRow(cells)) continue;
    if (!isDataRow(cells, headerMap)) continue;

    const description = headerMap.description !== undefined
      ? String(cells[headerMap.description] ?? '').trim()
      : rowLabel(cells);
    const unit = headerMap.unit !== undefined ? String(cells[headerMap.unit] ?? '').trim() : '';
    const qty = headerMap.qty !== undefined ? parseNumber(cells[headerMap.qty]) : 0;
    const rate = headerMap.rate !== undefined ? parseNumber(cells[headerMap.rate]) : 0;
    let amount = amountFromRow(cells, headerMap);
    if (amount <= 0 && qty > 0 && rate > 0) amount = round2(qty * rate);
    if (qty <= 0 && rate <= 0 && amount <= 0) continue;

    lineNo += 1;
    lines.push(validateLineValues(lineNo, description, unit, qty, rate, amount, undefined, i + 1));
  }

  return lines;
}

function pickSheetTotal(pages: BoqPageValidation[], type: BoqPageValidation['sheetType'], ...labels: string[]): number | null {
  const sheet = pages.find((p) => p.sheetType === type && p.isCalculationSheet);
  if (!sheet) return null;
  for (const label of labels) {
    const tc = sheet.totalChecks.find((t) => t.label.toLowerCase() === label.toLowerCase() && t.declaredAmount > 0);
    if (tc) return tc.declaredAmount;
    const kt = sheet.keyTotals.find((t) => t.label.toLowerCase().includes(label.toLowerCase()));
    if (kt) return kt.amount;
  }
  return sheet.declaredPageTotal;
}

function buildCrossChecks(pages: BoqPageValidation[]): BoqCrossCheck[] {
  const calc = pages.filter((p) => p.isCalculationSheet);
  const gac = pickSheetTotal(calc, 'gac', 'Gross Total', 'Grand Total', 'GAC');
  const bc = pickSheetTotal(calc, 'bc', 'Gross Total', 'Grand Total', 'BC');
  const abstractTotal = pickSheetTotal(calc, 'abstract', 'Abstract of Cost', 'Grand Total', 'Gross Total');
  const boqSum = round2(
    calc.filter((p) => p.sheetType === 'boq').reduce((sum, p) => sum + p.computedPageTotal, 0),
  );

  const checks: BoqCrossCheck[] = [];
  const parts = [
    { name: 'GAC', val: gac },
    { name: 'BC', val: bc },
    { name: 'Abstract', val: abstractTotal },
    { name: 'BOQ sum', val: boqSum > 0 ? boqSum : null },
  ].filter((v): v is { name: string; val: number } => v.val != null && v.val > 0);

  if (parts.length >= 2) {
    const base = parts[0].val;
    const match = parts.every((v) => Math.abs(v.val - base) <= SECTION_TOTAL_TOLERANCE * Math.max(1, parts.length));
    checks.push({
      label: 'GAC / BC / Abstract / BOQ sum',
      gac: gac && gac > 0 ? gac : null,
      bc: bc && bc > 0 ? bc : null,
      abstract: abstractTotal && abstractTotal > 0 ? abstractTotal : null,
      boqSum: boqSum > 0 ? boqSum : null,
      match,
      message: match
        ? 'Gross Total / Grand Total match across GAC, BC, Abstract of Cost and BOQ sheets'
        : `Mismatch — GAC ₹${(gac ?? 0).toLocaleString('en-IN')}, BC ₹${(bc ?? 0).toLocaleString('en-IN')}, Abstract ₹${(abstractTotal ?? 0).toLocaleString('en-IN')}, BOQ sum ₹${(boqSum ?? 0).toLocaleString('en-IN')}`,
    });
  }

  return checks;
}

function validateWorkbookPages(workbook: XLSX.WorkBook, visibleSheetNames?: string[]): BoqPageValidation[] {
  const pages: BoqPageValidation[] = [];
  let globalLineNo = 0;
  const names = Array.isArray(visibleSheetNames) && visibleSheetNames.length > 0
    ? visibleSheetNames
    : (Array.isArray(workbook?.SheetNames) ? workbook.SheetNames : []);

  names.forEach((sheetName, pageIdx) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return;

    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1, defval: '', raw: true });
    const headerInfo = findHeaderInfo(rows);
    const lines = parseLinesFromSheetRows(rows, headerInfo, globalLineNo);
    globalLineNo += lines.length;

    const sheetType = classifySheet(sheetName, rows, lines, headerInfo.headerValid);
    const keyTotals = extractSheetKeyTotals(sheet, workbook, rows);
    const lineSum = round2(lines.reduce((sum, l) => sum + l.declaredAmount, 0));
    const totalChecks = headerInfo.headerValid || lines.length > 0
      ? validateTotalRows(rows, headerInfo.headerMap, headerInfo.headerRowNo, lineSum)
      : validateTotalRows(rows, {}, null, lineSum);

    const calcSheet = isCalculationSheet(sheetType, headerInfo.headerValid, lines, totalChecks, keyTotals);
    const passedItems = lines.filter((l) => l.status === 'pass').length;
    const failedItems = lines.filter((l) => l.status === 'fail').length;
    const warningItems = lines.filter((l) => l.status === 'warning').length;
    const computedPageTotal = lineSum;
    const declaredPageTotal = pickDeclaredTotal(totalChecks, keyTotals, lineSum);

    if (!calcSheet) {
      pages.push({
        pageNo: pageIdx + 1,
        sheetName,
        sheetType,
        status: 'skipped',
        isCalculationSheet: false,
        totalItems: 0,
        passedItems: 0,
        failedItems: 0,
        warningItems: 0,
        computedPageTotal: 0,
        declaredPageTotal: null,
        pageTotalMatch: null,
        hasIssues: false,
        issues: [],
        keyTotals: [],
        headerLabels: [],
        headerRowNo: null,
        headerValid: false,
        headerIssues: [],
        totalChecks: [],
        lines: [],
      });
      return;
    }

    const failedTotals = totalChecks.filter((t) => !t.match);
    const pageTotalMatch = declaredPageTotal != null && computedPageTotal > 0
      ? Math.abs(computedPageTotal - declaredPageTotal) <= SECTION_TOTAL_TOLERANCE
      : (failedTotals.length === 0 && declaredPageTotal != null ? true : null);

    const issues: string[] = [];
    if (!headerInfo.headerValid && lines.length > 0) {
      issues.push(`Column headings issue: ${headerInfo.headerIssues.join('; ')}`);
    }
    if (failedItems > 0) issues.push(`${failedItems} line(s) failed Qty × Rate = Amount`);
    if (warningItems > 0) issues.push(`${warningItems} line(s) have warnings`);
    failedTotals.forEach((t) => { if (t.message) issues.push(t.message); });
    if (declaredPageTotal != null && pageTotalMatch === false) {
      issues.push(`Sheet total mismatch: Excel ₹${declaredPageTotal.toLocaleString('en-IN')} vs calculated ₹${computedPageTotal.toLocaleString('en-IN')}`);
    }
    if (lines.length > 0 && !totalChecks.some((t) => /gross|grand/i.test(t.label)) && declaredPageTotal == null) {
      issues.push('No Gross Total / Grand Total row found on this calculation sheet');
    }

    let status: BoqPageValidation['status'] = 'passed';
    if (!headerInfo.headerValid && lines.length > 0) status = 'failed';
    else if (failedItems > 0 || failedTotals.length > 0 || pageTotalMatch === false) status = 'failed';
    else if (warningItems > 0) status = 'warning';

    pages.push(slimPage({
      pageNo: pageIdx + 1,
      sheetName,
      sheetType,
      status,
      isCalculationSheet: true,
      totalItems: lines.length,
      passedItems,
      failedItems,
      warningItems,
      computedPageTotal,
      declaredPageTotal,
      pageTotalMatch,
      hasIssues: status === 'failed' || status === 'warning',
      issues,
      keyTotals,
        headerLabels: headerInfo.headerLabels,
        headerRowNo: headerInfo.headerRowNo,
        headerValid: headerInfo.headerValid,
        headerIssues: headerInfo.headerIssues,
        headerMap: headerInfo.headerMap,
        totalChecks,
      lines,
    }));
  });

  return pages;
}

export function validateBoqExcelBuffer(buffer: Buffer): DprExcelAuditReport {
  if (!buffer?.length) {
    throw new Error('Excel file is empty');
  }
  const workbook = XLSX.read(buffer, { type: 'buffer', cellFormula: true, cellStyles: false });
  if (!workbook || !Array.isArray(workbook.SheetNames) || workbook.SheetNames.length === 0) {
    throw new Error('Invalid Excel workbook — no worksheets found');
  }
  const { visible, hidden } = getVisibleSheetNames(workbook);
  const sheetNames = visible.length > 0 ? visible : workbook.SheetNames;
  const pages = validateWorkbookPages(workbook, sheetNames);
  const calcPages = pages.filter((p) => p.isCalculationSheet);
  const allLines = calcPages.flatMap((p) => p.lines);
  const crossChecks = buildCrossChecks(calcPages);
  const firstProblem = calcPages.find((p) => p.hasIssues);
  const firstCalc = calcPages[0];
  const firstCalculationPageNo = firstProblem?.pageNo ?? firstCalc?.pageNo ?? null;

  if (!calcPages.length) {
    const baseReport: BoqValidationReport = {
      status: 'failed',
      totalItems: 0,
      passedItems: 0,
      failedItems: 0,
      warningItems: 0,
      computedGrandTotal: 0,
      declaredGrandTotal: null,
      grandTotalMatch: null,
      firstCalculationPageNo: null,
      pages,
      lines: [],
      crossChecks: [],
      summary: {
        message: 'No calculation sheets found — check GAC, BC, BOQ item pages and Abstract of Cost',
        readyForTac: false,
        issues: ['Excel has no sheets with BOQ column headings or total rows'],
      },
    };
    return attachExcelAudit(workbook, sheetNames, hidden, baseReport);
  }

  const passedItems = allLines.filter((l) => l.status === 'pass').length;
  const failedItems = allLines.filter((l) => l.status === 'fail').length;
  const warningItems = allLines.filter((l) => l.status === 'warning').length;

  const grossFromGac = pickSheetTotal(calcPages, 'gac', 'Gross Total', 'Grand Total');
  const grossFromAbstract = pickSheetTotal(calcPages, 'abstract', 'Gross Total', 'Grand Total', 'Abstract of Cost');
  const computedGrandTotal = round2(
    calcPages.filter((p) => p.sheetType === 'boq').reduce((sum, p) => sum + p.computedPageTotal, 0)
      || grossFromGac
      || grossFromAbstract
      || 0,
  );
  const declaredGrandTotal = grossFromAbstract ?? grossFromGac ?? null;
  const grandTotalMatch = crossChecks.length > 0 ? crossChecks[0].match : null;

  const problemPages = calcPages.filter((p) => p.hasIssues);
  const totalErrors = calcPages.flatMap((p) => p.totalChecks.filter((t) => !t.match));
  const issues: string[] = [];
  if (problemPages.length > 0) {
    issues.push(`${problemPages.length} calculation sheet(s) have errors — see highlighted pages below`);
  }
  if (failedItems > 0) issues.push(`${failedItems} line(s) failed Qty × Rate = Amount`);
  if (totalErrors.length > 0) issues.push(`${totalErrors.length} Total / Gross Total row mismatch(es)`);
  if (crossChecks.some((c) => !c.match)) issues.push('GAC / BC / Abstract / BOQ Gross Totals do not match');

  let status: BoqValidationReport['status'] = 'passed';
  if (problemPages.some((p) => p.status === 'failed') || crossChecks.some((c) => !c.match)) status = 'failed';
  else if (problemPages.length > 0 || warningItems > 0) status = 'warning';

  const baseReport: BoqValidationReport = {
    status,
    totalItems: allLines.length,
    passedItems,
    failedItems,
    warningItems,
    computedGrandTotal,
    declaredGrandTotal,
    grandTotalMatch,
    firstCalculationPageNo,
    pages,
    lines: slimLines(allLines),
    crossChecks,
    summary: {
      message: status !== 'failed'
        ? (status === 'warning' ? 'BOQ passed with warnings — review calculation sheets' : 'All calculation sheets passed — ready for TAC')
        : 'BOQ failed — fix Total / Gross Total and line errors on highlighted calculation sheets',
      readyForTac: status !== 'failed',
      issues,
    },
  };

  return attachExcelAudit(workbook, sheetNames, hidden, baseReport);
}
