"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSubTotalLabel = isSubTotalLabel;
exports.isSectionTotalLabel = isSectionTotalLabel;
exports.isTotalCostLabel = isTotalCostLabel;
exports.isGrandTotalLabel = isGrandTotalLabel;
exports.isTharaliLayout = isTharaliLayout;
exports.validateTotalRows = validateTotalRows;
exports.validateBoqExcelBuffer = validateBoqExcelBuffer;
const XLSX = __importStar(require("xlsx"));
const boq_unit_util_1 = require("../../construction/utils/boq-unit.util");
const dpr_excel_audit_util_1 = require("./dpr-excel-audit.util");
/** Line-level Qty×Rate / component sums — 2-decimal rounding slack. */
const QTY_RATE_AMOUNT_TOLERANCE = 0.05;
/** Sub Total / Total Cost row checks — allow small column rounding on large totals. */
const SECTION_TOTAL_TOLERANCE = 5.0;
function totalRowTolerance(amount) {
    const base = Math.abs(amount);
    return Math.max(0.05, SECTION_TOTAL_TOLERANCE, base * 0.00001);
}
/** Only persist problem lines — keeps API/DB payloads small for large BOQ files. */
const STORE_PROBLEM_LINES_ONLY = true;
const TOTAL_LABEL_PATTERNS = [
    { key: 'Gross Total', pattern: /gross\s*total/i, priority: 1 },
    { key: 'Grand Total', pattern: /grand\s*total/i, priority: 2 },
    { key: 'GAC', pattern: /\bgac\b|gross\s*amount\s*of\s*contract/i, priority: 3 },
    { key: 'BC', pattern: /\bbc\b|basic\s*cost/i, priority: 4 },
    { key: 'Abstract of Cost', pattern: /abstract\s*of\s*cost|cost\s*abstract/i, priority: 5 },
    { key: 'Section Total', pattern: /section\s*total/i, priority: 6 },
    { key: 'Total Cost', pattern: /total\s*cost/i, priority: 7 },
    { key: 'Net Amount', pattern: /net\s*amount/i, priority: 8 },
    { key: 'Sub Total', pattern: /sub[\s-]*total/i, priority: 9 },
    { key: 'Total', pattern: /\btotal\b/i, priority: 10 },
];
function isSubTotalLabel(text) {
    return /sub[\s-]*total/i.test(text);
}
function isSectionTotalLabel(text) {
    return /section\s*total/i.test(text);
}
function isTotalCostLabel(text) {
    return /total\s*cost|grand\s*total|gross\s*total|net\s*amount/i.test(text);
}
function isGrandTotalLabel(text) {
    return /grand\s*total|gross\s*total|\bgac\b|abstract\s*of\s*cost/i.test(text);
}
function emptyColumnSums() {
    return { dsr: 0, ujn: 0, sorPwd: 0, nsi: 0, totalAmount: 0, amount: 0 };
}
function addColumnSums(a, b) {
    return {
        dsr: a.dsr + b.dsr,
        ujn: a.ujn + b.ujn,
        sorPwd: a.sorPwd + b.sorPwd,
        nsi: a.nsi + b.nsi,
        totalAmount: a.totalAmount + b.totalAmount,
        amount: a.amount + b.amount,
    };
}
function rowColumnAmounts(cells, headerMap) {
    if (isTharaliLayout(headerMap)) {
        const c = tharaliComponentsFromRow(cells, headerMap);
        const totalAmount = c.totalAmount;
        const ujn = c.ujn;
        return {
            dsr: c.dsr,
            ujn,
            sorPwd: c.sorPwd,
            nsi: c.nsi,
            totalAmount: totalAmount > 0 ? totalAmount : ujn,
            amount: totalAmount > 0 ? totalAmount : ujn,
        };
    }
    const amt = parseNumber(headerMap.amount !== undefined ? cells[headerMap.amount] : 0)
        || amountFromRow(cells, headerMap);
    return { dsr: 0, ujn: 0, sorPwd: 0, nsi: 0, totalAmount: amt, amount: amt };
}
function tharaliHorizontalComponentSum(declared) {
    const withSor = round2(declared.dsr + declared.ujn + declared.sorPwd + declared.nsi);
    const withoutSor = round2(declared.dsr + declared.ujn + declared.nsi);
    const tol = totalRowTolerance(declared.totalAmount);
    if (Math.abs(declared.totalAmount - withSor) <= tol)
        return withSor;
    if (Math.abs(declared.totalAmount - withoutSor) <= tol)
        return withoutSor;
    return withSor;
}
function tharaliRowHorizontalCheck(declared, tharali) {
    if (!tharali || declared.totalAmount <= 0) {
        return { horizontalMatch: null };
    }
    const hasComponents = declared.dsr > 0 || declared.ujn > 0 || declared.sorPwd > 0 || declared.nsi > 0;
    if (!hasComponents) {
        return { horizontalMatch: null };
    }
    const horizontalDeclared = declared.totalAmount;
    const horizontalComputed = tharaliHorizontalComponentSum(declared);
    const horizontalMatch = Math.abs(horizontalDeclared - horizontalComputed) <= totalRowTolerance(horizontalDeclared);
    return { horizontalMatch, horizontalDeclared, horizontalComputed };
}
/** Step 6 Total Amount when lump sums sit in UJN/NSI columns but not Total Amount column (cwra). */
function tharaliSubtotalComputedSums(sums, declared) {
    const fromCol = round2(sums.totalAmount);
    const withoutSor = round2(sums.dsr + sums.ujn + sums.nsi);
    const withSor = round2(sums.dsr + sums.ujn + sums.sorPwd + sums.nsi);
    if (declared && declared.totalAmount > 0) {
        const d = declared.totalAmount;
        const tol = totalRowTolerance(d);
        if (Math.abs(d - withoutSor) <= tol)
            return { ...sums, totalAmount: withoutSor };
        if (Math.abs(d - withSor) <= tol)
            return { ...sums, totalAmount: withSor };
        if (Math.abs(d - fromCol) <= tol)
            return { ...sums, totalAmount: fromCol };
    }
    if (fromCol > 0 && Math.abs(fromCol - withSor) <= totalRowTolerance(withSor)) {
        return { ...sums, totalAmount: fromCol };
    }
    if (fromCol > 0 && Math.abs(fromCol - withoutSor) <= totalRowTolerance(withoutSor)) {
        return { ...sums, totalAmount: fromCol };
    }
    if (withoutSor > fromCol) {
        return { ...sums, totalAmount: withoutSor };
    }
    return { ...sums, totalAmount: fromCol > 0 ? fromCol : withSor };
}
function getActiveColumns(headerMap, tharali) {
    if (tharali) {
        const cols = [];
        if (headerMap.dsr !== undefined)
            cols.push({ key: 'dsr', label: 'DSR' });
        if (headerMap.ujn !== undefined)
            cols.push({ key: 'ujn', label: 'UJN' });
        if (headerMap.sor_pwd !== undefined)
            cols.push({ key: 'sorPwd', label: 'SOR(PWD)' });
        if (headerMap.nsi !== undefined)
            cols.push({ key: 'nsi', label: 'NSI' });
        if (headerMap.total_amount !== undefined)
            cols.push({ key: 'totalAmount', label: 'Total Amount' });
        return cols;
    }
    return [{ key: 'amount', label: 'Amount' }];
}
function buildColumnChecks(declared, computed, columns, rowNo, step, label) {
    const checks = [];
    for (const col of columns) {
        const d = declared[col.key];
        const c = computed[col.key];
        if (d <= 0 && c <= 0)
            continue;
        const match = Math.abs(d - c) <= totalRowTolerance(Math.max(d, c));
        checks.push({
            column: col.key,
            columnLabel: col.label,
            declaredAmount: d,
            computedAmount: c,
            match,
            message: match
                ? undefined
                : `Step ${step} — ${label} row ${rowNo}, ${col.label}: Excel ₹${d.toLocaleString('en-IN')} ≠ calculated ₹${c.toLocaleString('en-IN')}`,
        });
    }
    return checks;
}
function primaryAmount(cols) {
    return cols.totalAmount > 0 ? cols.totalAmount : cols.amount;
}
function parseNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value))
        return value;
    const cleaned = String(value ?? '').replace(/[,₹\s]/g, '').trim();
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : 0;
}
function isNumericCell(value) {
    if (typeof value === 'number' && Number.isFinite(value))
        return true;
    const cleaned = String(value ?? '').replace(/[,₹\s]/g, '').trim();
    if (!cleaned)
        return false;
    return Number.isFinite(Number(cleaned));
}
function round2(n) {
    return Math.round(n * 100) / 100;
}
/** Format a numeric cell value for error messages — full precision, no display rounding. */
function formatCellNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        const raw = String(value);
        if (!/[eE]/.test(raw))
            return raw;
        return value.toFixed(10).replace(/\.?0+$/, '');
    }
    const cleaned = String(value ?? '').replace(/[,₹\s]/g, '').trim();
    return cleaned || '0';
}
function normalizeKey(key) {
    return key.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}
function isHeaderRow(cells) {
    const lower = cells.map((c) => c.toLowerCase());
    const hasDesc = lower.some((c) => c.includes('description') || c.includes('particulars') || c.includes('item'));
    const hasQty = lower.some((c) => c.includes('qty') || c.includes('quantity'));
    const hasRate = lower.some((c) => c.includes('rate'));
    const hasAmount = lower.some((c) => c.includes('amount') || c.includes('cost'));
    const hasSn = lower.some((c) => c === 'sn' || c === 's.no' || c === 's.no.' || c.includes('serial'));
    const hasUnit = lower.some((c) => c === 'unit' || c === 'units' || c === 'uom');
    return hasDesc && (hasQty || hasRate || hasAmount || hasSn || hasUnit);
}
function buildHeaderMap(cells) {
    const map = {};
    cells.forEach((cell, idx) => {
        const key = normalizeKey(cell);
        const raw = cell.trim().toLowerCase();
        if (!key)
            return;
        if (key === 'sn' || ['s_no', 'sno', 'sl_no', 'sr_no', 'serial'].includes(key))
            map.serial = idx;
        else if ((key.includes('sor') && key.includes('code')) || raw === 'sor code')
            map.sor_code = idx;
        else if (key.includes('description') || key.includes('particulars') || key.includes('item'))
            map.description = idx;
        else if ((0, boq_unit_util_1.isUnitHeaderKey)(key, raw))
            map.unit = idx;
        else if (key === 'r_qty' || key === 'rqty' || key.includes('qty') || key.includes('quantity'))
            map.qty = idx;
        else if (key.includes('rate'))
            map.rate = idx;
        else if (key === 'dsr' || raw === 'dsr')
            map.dsr = idx;
        else if (key === 'ujn'
            || raw === 'ujn'
            || raw.replace(/\s/g, '') === 'ujn'
            || /^ujn(\b|_|\s|$)/.test(raw)
            || key.startsWith('ujn_'))
            map.ujn = idx;
        else if (/sor.*pwd|pwd.*sor|sor_pwd/.test(key) || /sor\s*\(?\s*pwd\s*\)?/i.test(raw))
            map.sor_pwd = idx;
        else if (key === 'nsi' || raw === 'nsi')
            map.nsi = idx;
        else if ((key.includes('total') && key.includes('amount')) || raw === 'total amount')
            map.total_amount = idx;
        else if (key === 'amt' || key.startsWith('amt') || key.includes('amount') || key.includes('cost'))
            map.amount = idx;
    });
    return map;
}
function finalizeHeaderMap(cells, map) {
    const unitIdx = (0, boq_unit_util_1.resolveUnitColumn)(map, cells);
    if (unitIdx !== undefined)
        map.unit = unitIdx;
    return map;
}
function isTharaliLayout(headerMap) {
    return headerMap.ujn !== undefined
        || (headerMap.dsr !== undefined && headerMap.total_amount !== undefined)
        || (headerMap.ujn !== undefined && headerMap.total_amount !== undefined);
}
function lineAmountColumn(headerMap) {
    if (isTharaliLayout(headerMap)) {
        if (headerMap.total_amount !== undefined)
            return 'total_amount';
        if (headerMap.ujn !== undefined)
            return 'ujn';
    }
    return 'amount';
}
function cellAmount(cells, headerMap, col) {
    const idx = headerMap[col];
    if (idx === undefined)
        return 0;
    return round2(parseNumber(cells[idx]));
}
function findHeaderInfo(rows) {
    for (let i = 0; i < Math.min(rows.length, 40); i += 1) {
        const cells = rows[i].map((c) => String(c ?? '').trim());
        if (!cells.some(Boolean))
            continue;
        if (!isHeaderRow(cells))
            continue;
        const headerMap = finalizeHeaderMap(cells, buildHeaderMap(cells));
        const issues = [];
        const tharali = isTharaliLayout(headerMap);
        if (headerMap.description === undefined)
            issues.push('Missing Description / Particulars column');
        if (tharali) {
            if (headerMap.qty === undefined)
                issues.push('Missing Quantity column');
            if (headerMap.rate === undefined)
                issues.push('Missing Rate column');
            if (headerMap.unit === undefined)
                issues.push('Missing Unit column');
            if (headerMap.ujn === undefined && headerMap.total_amount === undefined) {
                issues.push('Missing UJN or Total Amount column (Tharali/UJS layout)');
            }
        }
        else {
            if (headerMap.qty === undefined && headerMap.rate === undefined) {
                issues.push('Missing Qty and Rate columns');
            }
            if (headerMap.amount === undefined && headerMap.rate === undefined) {
                issues.push('Missing Amount column');
            }
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
function rowLabel(cells) {
    return cells.filter(Boolean).join(' ').trim();
}
function tharaliRowTotal(cells, headerMap) {
    const { dsr, ujn, sorPwd, nsi, totalAmount } = tharaliComponentsFromRow(cells, headerMap);
    if (totalAmount > 0)
        return totalAmount;
    const componentSum = round2(dsr + ujn + sorPwd + nsi);
    if (componentSum > 0)
        return componentSum;
    if (ujn > 0)
        return ujn;
    return 0;
}
function amountFromRow(cells, headerMap) {
    const col = lineAmountColumn(headerMap);
    const primary = cellAmount(cells, headerMap, col);
    if (primary > 0)
        return primary;
    if (headerMap.amount !== undefined && col !== 'amount') {
        const fallback = cellAmount(cells, headerMap, 'amount');
        if (fallback > 0)
            return fallback;
    }
    if (isTharaliLayout(headerMap)) {
        const tharaliTotal = tharaliRowTotal(cells, headerMap);
        if (tharaliTotal > 0)
            return tharaliTotal;
    }
    const qty = headerMap.qty !== undefined ? parseNumber(cells[headerMap.qty]) : 0;
    const rate = headerMap.rate !== undefined ? parseNumber(cells[headerMap.rate]) : 0;
    if (qty > 0 && rate > 0)
        return round2(qty * rate);
    if (rate > 0 && qty <= 0)
        return round2(rate);
    const skip = (0, boq_unit_util_1.nonAmountColumnIndices)(headerMap);
    const nums = cells
        .map((cell, idx) => (skip.has(idx) ? 0 : parseNumber(cell)))
        .filter((n) => n > 0);
    return nums.length ? round2(Math.max(...nums)) : 0;
}
function tharaliComponentsFromRow(row, headerMap) {
    return {
        dsr: headerMap.dsr !== undefined ? parseNumber(row[headerMap.dsr]) : 0,
        ujn: headerMap.ujn !== undefined ? parseNumber(row[headerMap.ujn]) : 0,
        sorPwd: headerMap.sor_pwd !== undefined ? parseNumber(row[headerMap.sor_pwd]) : 0,
        nsi: headerMap.nsi !== undefined ? parseNumber(row[headerMap.nsi]) : 0,
        totalAmount: headerMap.total_amount !== undefined ? parseNumber(row[headerMap.total_amount]) : 0,
    };
}
/** Skip Tharali rows where qty/rate columns likely hold serial numbers or misaligned data. */
function isTharaliMisalignedRow(qty, rate, totalAmount, ujn) {
    if (qty <= 0 && rate <= 0)
        return false;
    const qtyRate = qty > 0 && rate > 0 ? round2(qty * rate) : 0;
    const refTotal = totalAmount > 0 ? totalAmount : ujn > 0 ? ujn : 0;
    if (rate >= 10000 && Number.isInteger(rate) && (refTotal <= 0 || rate > refTotal * 5)) {
        return true;
    }
    if (qtyRate > 0 && refTotal > 0) {
        const ratio = Math.max(qtyRate, refTotal) / Math.min(qtyRate, refTotal);
        if (ratio > 50)
            return true;
    }
    return false;
}
function isContributingItemRow(cells, headerMap) {
    if (isDescriptionOnlyRow(cells, headerMap))
        return false;
    return isBoqItemRow(cells, headerMap);
}
function assignTharaliLumpSum(lumpSum, headerMap) {
    if (headerMap.ujn !== undefined) {
        return {
            ujn: lumpSum,
            totalAmount: headerMap.total_amount !== undefined ? lumpSum : 0,
        };
    }
    if (headerMap.total_amount !== undefined) {
        return { ujn: 0, totalAmount: lumpSum };
    }
    return { ujn: lumpSum, totalAmount: 0 };
}
/** Scan amount-region columns when mapped Tharali cells are blank (cwra lump-sum rows). */
function sectionLumpSumFallback(cells, headerMap) {
    if (headerMap.amount !== undefined) {
        const mapped = parseNumber(cells[headerMap.amount]);
        if (mapped > 0)
            return round2(mapped);
    }
    const tharaliEmpty = ((headerMap.dsr === undefined || parseNumber(cells[headerMap.dsr]) <= 0)
        && (headerMap.ujn === undefined || parseNumber(cells[headerMap.ujn]) <= 0)
        && (headerMap.sor_pwd === undefined || parseNumber(cells[headerMap.sor_pwd]) <= 0)
        && (headerMap.nsi === undefined || parseNumber(cells[headerMap.nsi]) <= 0)
        && (headerMap.total_amount === undefined || parseNumber(cells[headerMap.total_amount]) <= 0));
    if (tharaliEmpty && headerMap.rate !== undefined) {
        const rate = parseNumber(cells[headerMap.rate]);
        if (rate > 0)
            return round2(rate);
    }
    const skip = new Set((0, boq_unit_util_1.nonAmountColumnIndices)(headerMap));
    for (const key of ['dsr', 'ujn', 'sor_pwd', 'nsi', 'total_amount', 'amount']) {
        if (headerMap[key] !== undefined)
            skip.add(headerMap[key]);
    }
    const start = Math.max(headerMap.description ?? 0, headerMap.unit ?? 0, headerMap.qty ?? 0, headerMap.rate ?? 0) + 1;
    let sum = 0;
    for (let idx = start; idx < cells.length; idx += 1) {
        if (skip.has(idx))
            continue;
        const n = parseNumber(cells[idx]);
        if (n > 0)
            sum += n;
    }
    return round2(sum);
}
/** Step 6/7 vertical sums — direct mapped-column read plus lump-sum fallbacks (cwra Rate/Amt cols). */
function sectionRowColumnAmounts(cells, headerMap) {
    if (isTharaliLayout(headerMap)) {
        let dsr = headerMap.dsr !== undefined ? parseNumber(cells[headerMap.dsr]) : 0;
        let ujn = headerMap.ujn !== undefined ? parseNumber(cells[headerMap.ujn]) : 0;
        let sorPwd = headerMap.sor_pwd !== undefined ? parseNumber(cells[headerMap.sor_pwd]) : 0;
        let nsi = headerMap.nsi !== undefined ? parseNumber(cells[headerMap.nsi]) : 0;
        let totalAmount = headerMap.total_amount !== undefined ? parseNumber(cells[headerMap.total_amount]) : 0;
        const componentSum = dsr + ujn + sorPwd + nsi;
        if (componentSum <= 0 && totalAmount <= 0) {
            const lumpSum = sectionLumpSumFallback(cells, headerMap);
            if (lumpSum > 0) {
                const assigned = assignTharaliLumpSum(lumpSum, headerMap);
                ujn = assigned.ujn;
                if (assigned.totalAmount > 0)
                    totalAmount = assigned.totalAmount;
            }
        }
        else if (totalAmount <= 0 && componentSum > 0) {
            totalAmount = componentSum;
        }
        return {
            dsr,
            ujn,
            sorPwd,
            nsi,
            totalAmount,
            amount: totalAmount > 0 ? totalAmount : ujn,
        };
    }
    return rowColumnAmounts(cells, headerMap);
}
function sectionRowHasAmounts(cells, headerMap) {
    const amts = sectionRowColumnAmounts(cells, headerMap);
    if (amts.dsr > 0 || amts.ujn > 0 || amts.sorPwd > 0 || amts.nsi > 0
        || amts.totalAmount > 0 || amts.amount > 0) {
        return true;
    }
    const qty = headerMap.qty !== undefined ? parseNumber(cells[headerMap.qty]) : 0;
    const rate = headerMap.rate !== undefined ? parseNumber(cells[headerMap.rate]) : 0;
    return qty > 0 || rate > 0;
}
function isDescriptionOnlyRow(cells, headerMap) {
    if (sectionRowHasAmounts(cells, headerMap))
        return false;
    const qty = headerMap.qty !== undefined ? parseNumber(cells[headerMap.qty]) : 0;
    const rate = headerMap.rate !== undefined ? parseNumber(cells[headerMap.rate]) : 0;
    if (qty > 0 && rate > 0)
        return false;
    if (rate > 0 && qty <= 0)
        return false;
    if (headerMap.amount !== undefined && parseNumber(cells[headerMap.amount]) > 0)
        return false;
    if (isTharaliLayout(headerMap)) {
        const { dsr, ujn, sorPwd, nsi, totalAmount } = tharaliComponentsFromRow(cells, headerMap);
        if (dsr > 0 || ujn > 0 || sorPwd > 0 || nsi > 0 || totalAmount > 0)
            return false;
    }
    const desc = headerMap.description !== undefined
        ? String(cells[headerMap.description] ?? '').trim()
        : rowLabel(cells);
    return desc.length >= 3;
}
/** Sub Total label in description, or in joined text only when description is blank (not item rows). */
function resolveSubTotalLabel(descCol, joined) {
    if (isSubTotalLabel(descCol))
        return true;
    if (descCol.length >= 3 && !isSubTotalLabel(descCol))
        return false;
    return isSubTotalLabel(joined);
}
/** Item rows below a premature Sub Total label — real subtotal row comes later (cwra rows 8–10). */
function hasItemRowsBelow(rows, headerMap, fromIdx) {
    for (let j = fromIdx + 1; j < rows.length; j += 1) {
        const cells = rows[j].map((c) => String(c ?? '').trim());
        const joined = rowLabel(cells);
        if (!joined)
            continue;
        const descCol = headerMap.description !== undefined
            ? String(cells[headerMap.description] ?? '').trim()
            : joined;
        if (isTotalCostLabel(joined) || isTotalCostLabel(descCol))
            break;
        if (isGrandTotalLabel(joined) || isGrandTotalLabel(descCol))
            break;
        if (resolveSubTotalLabel(descCol, joined))
            break;
        if (sectionRowHasAmounts(cells, headerMap) && !isDescriptionOnlyRow(cells, headerMap))
            return true;
    }
    return false;
}
/** Rows that contribute to Step 6/7 vertical column sums — direct column amounts, not qty/rate gates. */
function isSectionContributingRow(cells, headerMap, _joined, descCol, treatAsItemDespiteLabel = false) {
    if (!treatAsItemDespiteLabel) {
        if (isSubTotalLabel(descCol))
            return false;
        if (isSectionTotalLabel(descCol))
            return false;
        if (isTotalCostLabel(descCol))
            return false;
    }
    if (Object.keys(headerMap).length === 0)
        return false;
    if (!sectionRowHasAmounts(cells, headerMap))
        return false;
    if (isDescriptionOnlyRow(cells, headerMap))
        return false;
    return treatAsItemDespiteLabel || descCol.length >= 3 || sectionRowHasAmounts(cells, headerMap);
}
function isBoqItemRow(cells, headerMap) {
    const qty = headerMap.qty !== undefined ? parseNumber(cells[headerMap.qty]) : 0;
    const rate = headerMap.rate !== undefined ? parseNumber(cells[headerMap.rate]) : 0;
    const amount = amountFromRow(cells, headerMap);
    if (isTharaliLayout(headerMap)) {
        const { dsr, ujn, sorPwd, nsi, totalAmount } = tharaliComponentsFromRow(cells, headerMap);
        if (qty <= 0 && rate <= 0 && totalAmount <= 0 && ujn <= 0 && dsr <= 0 && sorPwd <= 0 && nsi <= 0) {
            return false;
        }
        if (isTharaliMisalignedRow(qty, rate, totalAmount, ujn))
            return false;
        return qty > 0 || rate > 0 || amount > 0 || ujn > 0 || totalAmount > 0
            || dsr > 0 || sorPwd > 0 || nsi > 0;
    }
    return qty > 0 || rate > 0 || amount > 0;
}
function isDataRow(cells, headerMap) {
    const desc = headerMap.description !== undefined ? String(cells[headerMap.description] ?? '').trim() : rowLabel(cells);
    if (!desc || desc.length < 3)
        return false;
    const lower = desc.toLowerCase();
    if (/grand\s*total|gross\s*total|total\s*cost|section\s*total|sub[\s-]*total|abstract|^\s*total\s*$/i.test(lower))
        return false;
    if (isSectionTotalLabel(desc))
        return false;
    if (/^\d+(\.\d+)?$/.test(desc))
        return false;
    return isBoqItemRow(cells, headerMap);
}
function validateTotalRows(rows, headerMap, headerRowNo, lineSum) {
    const checks = [];
    const startIdx = headerRowNo ? headerRowNo : 0;
    const tharali = isTharaliLayout(headerMap);
    const activeColumns = getActiveColumns(headerMap, tharali);
    let sectionItemSums = emptyColumnSums();
    /** Step 7 base = Sub Total row amounts; post-subtotal item rows are added on top. */
    let totalCostContributors = emptyColumnSums();
    let afterSubtotalForTotalCost = false;
    for (let i = startIdx; i < rows.length; i += 1) {
        const cells = rows[i].map((c) => String(c ?? '').trim());
        const joined = rowLabel(cells);
        if (!joined)
            continue;
        const descCol = headerMap.description !== undefined
            ? String(cells[headerMap.description] ?? '').trim()
            : joined;
        const hasSubTotalLabel = resolveSubTotalLabel(descCol, joined);
        const prematureSubTotal = hasSubTotalLabel && hasItemRowsBelow(rows, headerMap, i);
        const isSubTotal = hasSubTotalLabel && !prematureSubTotal;
        const isTotalCost = isTotalCostLabel(joined) || isTotalCostLabel(descCol);
        if (!isSubTotal && !isTotalCost) {
            const contributes = isSectionContributingRow(cells, headerMap, joined, descCol, prematureSubTotal)
                || (prematureSubTotal && sectionRowHasAmounts(cells, headerMap));
            if (contributes) {
                const rowAmts = sectionRowColumnAmounts(cells, headerMap);
                sectionItemSums = addColumnSums(sectionItemSums, rowAmts);
                if (afterSubtotalForTotalCost) {
                    totalCostContributors = addColumnSums(totalCostContributors, rowAmts);
                }
            }
        }
        if (isSubTotal) {
            const declared = rowColumnAmounts(cells, headerMap);
            const hasDeclared = activeColumns.some((col) => declared[col.key] > 0);
            if (!hasDeclared)
                continue;
            const computedSums = tharali ? tharaliSubtotalComputedSums(sectionItemSums, declared) : sectionItemSums;
            const columnChecks = buildColumnChecks(declared, computedSums, activeColumns, i + 1, 6, 'Sub Total');
            let allMatch = columnChecks.length === 0 || columnChecks.every((c) => c.match);
            const { horizontalMatch, horizontalDeclared, horizontalComputed, } = tharaliRowHorizontalCheck(declared, tharali);
            if (horizontalMatch === false)
                allMatch = false;
            checks.push({
                label: 'Sub Total',
                rowNo: i + 1,
                rowType: 'subtotal',
                checkStep: 6,
                declaredAmount: primaryAmount(declared),
                computedAmount: primaryAmount(computedSums),
                match: allMatch,
                columnChecks,
                horizontalMatch,
                horizontalDeclared,
                horizontalComputed,
                message: allMatch
                    ? undefined
                    : [
                        ...columnChecks.filter((c) => !c.match).map((c) => c.message),
                        horizontalMatch === false
                            ? `Step 6 — Sub Total row ${i + 1}: DSR+UJN+SOR(PWD)+NSI = ${horizontalComputed} ≠ Total Amount ${horizontalDeclared}`
                            : null,
                    ].filter(Boolean).join('; '),
            });
            totalCostContributors = declared;
            afterSubtotalForTotalCost = true;
            sectionItemSums = emptyColumnSums();
            continue;
        }
        if (isTotalCost) {
            const declared = rowColumnAmounts(cells, headerMap);
            const hasDeclared = activeColumns.some((col) => declared[col.key] > 0);
            if (!hasDeclared)
                continue;
            const isGrand = isGrandTotalLabel(joined) || isGrandTotalLabel(descCol);
            const label = /total\s*cost/i.test(joined) || /total\s*cost/i.test(descCol)
                ? 'Total Cost'
                : isGrand ? 'Grand Total' : 'Total Cost';
            const computedSums = isGrand && primaryAmount(totalCostContributors) <= 0
                ? { ...emptyColumnSums(), totalAmount: lineSum, amount: lineSum }
                : totalCostContributors;
            const columnChecks = buildColumnChecks(declared, computedSums, activeColumns, i + 1, 7, label);
            let allMatch = columnChecks.length === 0 || columnChecks.every((c) => c.match);
            const { horizontalMatch, horizontalDeclared, horizontalComputed, } = tharaliRowHorizontalCheck(declared, tharali);
            if (horizontalMatch === false)
                allMatch = false;
            checks.push({
                label,
                rowNo: i + 1,
                rowType: isGrand ? 'grand_total' : 'total_cost',
                checkStep: 7,
                declaredAmount: primaryAmount(declared),
                computedAmount: primaryAmount(computedSums),
                match: allMatch,
                columnChecks,
                horizontalMatch,
                horizontalDeclared,
                horizontalComputed,
                message: allMatch
                    ? undefined
                    : [
                        ...columnChecks.filter((c) => !c.match).map((c) => c.message),
                        horizontalMatch === false
                            ? `Step 7 — ${label} row ${i + 1}: DSR+UJN+SOR(PWD)+NSI = ${horizontalComputed} ≠ Total Amount ${horizontalDeclared}`
                            : null,
                    ].filter(Boolean).join('; '),
            });
            totalCostContributors = emptyColumnSums();
            afterSubtotalForTotalCost = false;
            sectionItemSums = emptyColumnSums();
        }
    }
    return checks;
}
function extractLabeledTotals(rows) {
    const totals = [];
    rows.forEach((row, idx) => {
        const cells = row.map((c) => String(c ?? '').trim());
        const joined = rowLabel(cells);
        if (!joined)
            return;
        for (const { key, pattern } of TOTAL_LABEL_PATTERNS) {
            if (!pattern.test(joined))
                continue;
            const amounts = cells.map(parseNumber).filter((n) => n > 0);
            if (!amounts.length)
                continue;
            totals.push({ label: key, amount: round2(Math.max(...amounts)), rowNo: idx + 1, source: 'label' });
            break;
        }
    });
    return totals;
}
function extractSheetKeyTotals(_sheet, _workbook, rows) {
    return extractLabeledTotals(rows);
}
function slimLineIssues(line) {
    const issues = (line.issues ?? []).filter((i) => i.status !== 'pass');
    return issues.length > 0 ? { ...line, issues } : line;
}
function slimLines(lines) {
    if (!STORE_PROBLEM_LINES_ONLY)
        return lines;
    return lines
        .filter((l) => l.status === 'fail' || l.status === 'warning')
        .map(slimLineIssues);
}
function slimTotalChecks(checks) {
    if (!STORE_PROBLEM_LINES_ONLY)
        return checks;
    return checks
        .filter((t) => !t.match || t.horizontalMatch === false)
        .map((t) => ({
        ...t,
        columnChecks: (t.columnChecks ?? []).filter((c) => !c.match),
    }));
}
function slimPage(page) {
    if (!STORE_PROBLEM_LINES_ONLY)
        return page;
    const lines = slimLines(page.lines);
    const totalChecks = slimTotalChecks(page.totalChecks);
    return {
        ...page,
        lines,
        totalChecks,
        issues: page.hasIssues ? page.issues : [],
        keyTotals: page.hasIssues ? page.keyTotals : [],
    };
}
function slimCrossChecks(checks) {
    if (!STORE_PROBLEM_LINES_ONLY)
        return checks;
    return checks.filter((c) => !c.match);
}
function pickDeclaredTotal(totalChecks, keyTotals, lineSum) {
    const priority = ['Gross Total', 'Grand Total', 'GAC', 'Abstract of Cost', 'BC', 'Section Total', 'Total Cost', 'Net Amount', 'Sub Total', 'Total'];
    for (const label of priority) {
        const hit = totalChecks.find((t) => t.label === label && t.declaredAmount > 0);
        if (hit)
            return hit.declaredAmount;
        const key = keyTotals.find((t) => t.label.toLowerCase() === label.toLowerCase());
        if (key)
            return key.amount;
    }
    return lineSum > 0 ? round2(lineSum) : null;
}
function classifySheet(sheetName, rows, lines, headerValid) {
    const name = sheetName.toLowerCase();
    const sample = rows.slice(0, 20).flat().map((c) => String(c ?? '').toLowerCase()).join(' ');
    if (/\bgac\b|gross\s*amount/.test(name) || (/\bgac\b|gross\s*amount\s*of\s*contract/.test(sample) && !headerValid))
        return 'gac';
    if (/\bbc\b|basic\s*cost/.test(name) || (/\bbc\b|basic\s*cost/.test(sample) && !headerValid))
        return 'bc';
    if (/abstract\s*of\s*cost|cost\s*abstract|\baoc\b/.test(name) || /abstract\s*of\s*cost/.test(sample))
        return 'abstract';
    if (headerValid || lines.length > 0)
        return 'boq';
    if (/form\s*j|comprehensive|annexure|cover|index|instruction|top\s*page/.test(name))
        return 'form';
    if (/form\s*j|comprehensive/.test(sample))
        return 'form';
    return 'other';
}
function isCalculationSheet(sheetType, headerValid, lines, totalChecks, keyTotals) {
    if (sheetType === 'form')
        return false;
    if (['gac', 'bc', 'abstract', 'boq'].includes(sheetType))
        return true;
    if (headerValid || lines.length > 0)
        return true;
    if (totalChecks.length > 0 || keyTotals.length > 0)
        return true;
    return false;
}
function mergeLineStatus(issues) {
    if (issues.some((i) => i.status === 'fail'))
        return 'fail';
    if (issues.some((i) => i.status === 'warning'))
        return 'warning';
    return 'pass';
}
function failedIssueMessages(issues) {
    return issues.filter((i) => i.status !== 'pass').map((i) => i.message).join('; ');
}
function validateTharaliLineValues(lineNo, description, unit, qty, rate, components, itemCode, sheetRow, rawQty, rawRate) {
    const dsr = round2(components.dsr);
    const ujn = round2(components.ujn);
    const sorPwd = round2(components.sorPwd);
    const nsi = round2(components.nsi);
    const totalAmount = round2(components.totalAmount);
    const qtyRateTotal = qty * rate;
    const componentSum = dsr + ujn + sorPwd + nsi;
    const declaredAmount = totalAmount > 0 ? totalAmount : ujn > 0 ? ujn : round2(qtyRateTotal);
    const hasComponentSum = dsr > 0 || ujn > 0 || sorPwd > 0 || nsi > 0;
    const hasDirectAmount = totalAmount > 0 || ujn > 0 || hasComponentSum;
    const qtyRateCheckApplicable = qty > 0 && rate > 0 && totalAmount > 0;
    const qtyRateTotalMatch = !qtyRateCheckApplicable
        || Math.abs(qtyRateTotal - totalAmount) <= QTY_RATE_AMOUNT_TOLERANCE;
    const componentSumMatch = totalAmount <= 0 || !hasComponentSum
        || Math.abs(componentSum - totalAmount) <= QTY_RATE_AMOUNT_TOLERANCE;
    const crossCheckMatch = qtyRateTotalMatch && componentSumMatch;
    const isItemRow = qty > 0 || rate > 0 || totalAmount > 0 || ujn > 0
        || dsr > 0 || sorPwd > 0 || nsi > 0;
    const rowRef = sheetRow ? `Row ${sheetRow}, ` : '';
    const qtyDisplay = formatCellNumber(rawQty ?? qty);
    const rateDisplay = formatCellNumber(rawRate ?? rate);
    const issues = [];
    if (!description.trim() || description.trim().length < 3) {
        issues.push({
            order: 1, checkType: 'description', column: 'Description', status: 'fail',
            message: 'Step 1 — Description: item description is required and must not be empty',
            expectedValue: 'Non-empty description', actualValue: description.trim() || '(blank)',
        });
    }
    else {
        issues.push({
            order: 1, checkType: 'description', column: 'Description', status: 'pass',
            message: 'Step 1 — Description: OK',
        });
    }
    if (String(rawQty ?? '').trim() && !isNumericCell(rawQty)) {
        issues.push({
            order: 2, checkType: 'quantity', column: 'Qty', status: 'fail',
            message: 'Step 2 — Quantity: must be numeric',
            expectedValue: 'Numeric value', actualValue: String(rawQty ?? ''),
        });
    }
    else if (rate > 0 && qty <= 0) {
        issues.push({
            order: 2, checkType: 'quantity', column: 'Qty', status: 'fail',
            message: `Step 2 — Quantity: must be greater than zero when rate is present (found ${qtyDisplay})`,
            expectedValue: '> 0', actualValue: qty,
        });
    }
    else if (qty > 0 && rate > 0 && !unit.trim()) {
        issues.push({
            order: 2, checkType: 'quantity', column: 'Unit', status: 'fail',
            message: 'Step 2 — Quantity: unit is required when quantity and rate are present',
            expectedValue: 'Unit', actualValue: '(blank)',
        });
    }
    else {
        issues.push({
            order: 2, checkType: 'quantity', column: 'Qty', status: 'pass',
            message: 'Step 2 — Quantity: OK',
        });
    }
    if (String(rawRate ?? '').trim() && !isNumericCell(rawRate)) {
        issues.push({
            order: 3, checkType: 'rate', column: 'Rate', status: 'fail',
            message: 'Step 3 — Rate: must be numeric',
            expectedValue: 'Numeric value', actualValue: String(rawRate ?? ''),
        });
    }
    else if (rate < 0) {
        issues.push({
            order: 3, checkType: 'rate', column: 'Rate', status: 'fail',
            message: `Step 3 — Rate: must be zero or greater (found ${rateDisplay})`,
            expectedValue: '>= 0', actualValue: rate,
        });
    }
    else {
        issues.push({
            order: 3, checkType: 'rate', column: 'Rate', status: 'pass',
            message: 'Step 3 — Rate: OK',
        });
    }
    if (qty > 0 && rate > 0 && totalAmount > 0) {
        if (!qtyRateTotalMatch) {
            issues.push({
                order: 4, checkType: 'qty_rate_amount', column: 'Total Amount', status: 'fail',
                message: `${rowRef}Step 4 — Qty×Rate=Total Amount: ${qtyDisplay} × ${rateDisplay} = ${qtyRateTotal} ≠ Total Amount ${totalAmount}`,
                expectedValue: qtyRateTotal, actualValue: totalAmount, difference: round2(totalAmount - qtyRateTotal),
            });
        }
        else {
            issues.push({
                order: 4, checkType: 'qty_rate_amount', column: 'Total Amount', status: 'pass',
                message: 'Step 4 — Qty×Rate=Total Amount: OK',
            });
        }
    }
    if (totalAmount > 0 && hasComponentSum) {
        if (!componentSumMatch) {
            issues.push({
                order: 5, checkType: 'component_sum', column: 'Total Amount', status: 'fail',
                message: `${rowRef}Step 5 — DSR+UJN+SOR(PWD)+NSI=Total Amount: ${dsr}+${ujn}+${sorPwd}+${nsi} = ${componentSum} ≠ Total Amount ${totalAmount}`,
                expectedValue: componentSum, actualValue: totalAmount, difference: round2(totalAmount - componentSum),
            });
        }
        else {
            issues.push({
                order: 5, checkType: 'component_sum', column: 'Total Amount', status: 'pass',
                message: 'Step 5 — DSR+UJN+SOR(PWD)+NSI=Total Amount: OK',
            });
        }
    }
    if (qty > 0 && rate > 0 && hasComponentSum && ujn > 0) {
        // Cross-check between Qty×Rate and component columns is covered by Steps 4–5; skip redundant warning.
    }
    if (!issues.some((i) => i.status === 'fail') && isItemRow && qty <= 0 && rate <= 0 && declaredAmount <= 0) {
        issues.push({
            order: 2, checkType: 'quantity', column: 'Qty', status: 'warning',
            message: 'Step 2 — Quantity: zero quantity, rate and amount on item row',
        });
    }
    else if (!issues.some((i) => i.status === 'fail') && qty > 0 && rate === 0 && declaredAmount > 0 && !hasDirectAmount) {
        issues.push({
            order: 3, checkType: 'rate', column: 'Rate', status: 'warning',
            message: 'Step 3 — Rate: amount present but rate is zero',
        });
    }
    else if (!issues.some((i) => i.status === 'fail') && qty === 0 && rate > 0 && declaredAmount > 0) {
        issues.push({
            order: 2, checkType: 'quantity', column: 'Qty', status: 'warning',
            message: 'Step 2 — Quantity: amount present but quantity is zero',
        });
    }
    const status = mergeLineStatus(issues);
    return {
        lineNo,
        sheetRow,
        itemCode,
        description,
        unit,
        qty,
        rate,
        declaredAmount,
        computedAmount: qtyRateTotal > 0 ? qtyRateTotal : componentSum,
        difference: round2(declaredAmount - (qtyRateTotal > 0 ? qtyRateTotal : componentSum)),
        status,
        message: failedIssueMessages(issues) || undefined,
        issues,
        layoutFormat: 'tharali',
        tharali: {
            dsr, ujn, sorPwd, nsi, totalAmount,
            qtyRateTotal, componentSum,
            qtyRateTotalMatch,
            componentSumMatch,
            crossCheckMatch,
            ujnComputed: qtyRateTotal,
            totalComputed: componentSum,
            ujnMatch: qtyRateTotalMatch,
            totalAmountMatch: componentSumMatch,
        },
    };
}
function validateLineValues(lineNo, description, unit, qty, rate, declaredAmount, itemCode, sheetRow, rawQty, rawRate) {
    const roundedDeclared = round2(declaredAmount);
    const computedAmount = qty * rate;
    const difference = round2(roundedDeclared - computedAmount);
    const absDiff = Math.abs(roundedDeclared - computedAmount);
    const isItemRow = qty > 0 || rate > 0 || roundedDeclared > 0;
    const qtyDisplay = formatCellNumber(rawQty ?? qty);
    const rateDisplay = formatCellNumber(rawRate ?? rate);
    const issues = [];
    if (!description.trim() || description.trim().length < 3) {
        issues.push({
            order: 1, checkType: 'description', column: 'Description', status: 'fail',
            message: 'Step 1 — Description: item description is required and must not be empty',
            expectedValue: 'Non-empty description', actualValue: description.trim() || '(blank)',
        });
    }
    else {
        issues.push({
            order: 1, checkType: 'description', column: 'Description', status: 'pass',
            message: 'Step 1 — Description: OK',
        });
    }
    if (String(rawQty ?? '').trim() && !isNumericCell(rawQty)) {
        issues.push({
            order: 2, checkType: 'quantity', column: 'Qty', status: 'fail',
            message: 'Step 2 — Quantity: must be numeric',
            expectedValue: 'Numeric value', actualValue: String(rawQty ?? ''),
        });
    }
    else if (rate > 0 && qty <= 0) {
        issues.push({
            order: 2, checkType: 'quantity', column: 'Qty', status: 'fail',
            message: `Step 2 — Quantity: must be greater than zero when rate is present (found ${qtyDisplay})`,
            expectedValue: '> 0', actualValue: qty,
        });
    }
    else if (qty > 0 && rate > 0 && !unit.trim()) {
        issues.push({
            order: 2, checkType: 'quantity', column: 'Unit', status: 'fail',
            message: 'Step 2 — Quantity: unit is required when quantity and rate are present',
            expectedValue: 'Unit', actualValue: '(blank)',
        });
    }
    else if (isItemRow && qty <= 0 && rate <= 0 && roundedDeclared <= 0) {
        issues.push({
            order: 2, checkType: 'quantity', column: 'Qty', status: 'warning',
            message: 'Step 2 — Quantity: zero quantity, rate and amount on item row',
        });
    }
    else {
        issues.push({
            order: 2, checkType: 'quantity', column: 'Qty', status: 'pass',
            message: 'Step 2 — Quantity: OK',
        });
    }
    if (String(rawRate ?? '').trim() && !isNumericCell(rawRate)) {
        issues.push({
            order: 3, checkType: 'rate', column: 'Rate', status: 'fail',
            message: 'Step 3 — Rate: must be numeric',
            expectedValue: 'Numeric value', actualValue: String(rawRate ?? ''),
        });
    }
    else if (rate < 0) {
        issues.push({
            order: 3, checkType: 'rate', column: 'Rate', status: 'fail',
            message: `Step 3 — Rate: must be zero or greater (found ${rateDisplay})`,
            expectedValue: '>= 0', actualValue: rate,
        });
    }
    else {
        issues.push({
            order: 3, checkType: 'rate', column: 'Rate', status: 'pass',
            message: 'Step 3 — Rate: OK',
        });
    }
    if (qty > 0 && rate >= 0 && roundedDeclared > 0) {
        if (absDiff > QTY_RATE_AMOUNT_TOLERANCE) {
            issues.push({
                order: 4, checkType: 'qty_rate_amount', column: 'Amount', status: 'fail',
                message: `Step 4 — Qty×Rate=Amount: ${qtyDisplay} × ${rateDisplay} = ${computedAmount} ≠ Amount ${roundedDeclared}`,
                expectedValue: computedAmount, actualValue: roundedDeclared, difference,
            });
        }
        else {
            issues.push({
                order: 4, checkType: 'qty_rate_amount', column: 'Amount', status: 'pass',
                message: 'Step 4 — Qty×Rate=Amount: OK',
            });
        }
    }
    if (!issues.some((i) => i.status === 'fail') && qty > 0 && rate === 0 && roundedDeclared > 0) {
        issues.push({
            order: 3, checkType: 'rate', column: 'Rate', status: 'warning',
            message: 'Step 3 — Rate: amount present but rate is zero',
        });
    }
    else if (!issues.some((i) => i.status === 'fail') && qty === 0 && rate > 0 && roundedDeclared > 0) {
        issues.push({
            order: 2, checkType: 'quantity', column: 'Qty', status: 'warning',
            message: 'Step 2 — Quantity: amount present but quantity is zero',
        });
    }
    const status = mergeLineStatus(issues);
    return {
        lineNo,
        sheetRow,
        itemCode,
        description,
        unit,
        qty,
        rate,
        declaredAmount: roundedDeclared,
        computedAmount,
        difference,
        status,
        message: failedIssueMessages(issues) || undefined,
        issues,
        layoutFormat: 'standard',
    };
}
function parseLinesFromSheetRows(rows, headerInfo, startLineNo) {
    const { headerMap, headerRowNo, headerValid } = headerInfo;
    if (!headerValid || headerRowNo == null)
        return [];
    const tharali = isTharaliLayout(headerMap);
    const lines = [];
    let lineNo = startLineNo;
    const startIdx = headerRowNo;
    for (let i = startIdx; i < rows.length; i += 1) {
        const rawRow = rows[i];
        const cells = rawRow.map((c) => String(c ?? '').trim());
        if (!cells.some(Boolean))
            continue;
        if (i > startIdx && isHeaderRow(cells))
            continue;
        if (!isDataRow(cells, headerMap))
            continue;
        const description = headerMap.description !== undefined
            ? String(cells[headerMap.description] ?? '').trim()
            : rowLabel(cells);
        const unit = (0, boq_unit_util_1.extractBoqUnit)(cells, headerMap);
        const qty = headerMap.qty !== undefined ? parseNumber(rawRow[headerMap.qty]) : 0;
        const rate = headerMap.rate !== undefined ? parseNumber(rawRow[headerMap.rate]) : 0;
        const itemCode = headerMap.sor_code !== undefined ? String(cells[headerMap.sor_code] ?? '').trim() : undefined;
        let amount = amountFromRow(cells, headerMap);
        if (amount <= 0 && qty > 0 && rate > 0)
            amount = round2(qty * rate);
        if (qty <= 0 && rate <= 0 && amount <= 0)
            continue;
        lineNo += 1;
        const rawQty = headerMap.qty !== undefined ? rawRow[headerMap.qty] : '';
        const rawRate = headerMap.rate !== undefined ? rawRow[headerMap.rate] : '';
        if (tharali) {
            lines.push(validateTharaliLineValues(lineNo, description, unit, qty, rate, tharaliComponentsFromRow(rawRow, headerMap), itemCode || undefined, i + 1, rawQty, rawRate));
        }
        else {
            lines.push(validateLineValues(lineNo, description, unit, qty, rate, amount, itemCode || undefined, i + 1, rawQty, rawRate));
        }
    }
    return lines;
}
function pickSheetTotal(pages, type, ...labels) {
    const sheet = pages.find((p) => p.sheetType === type && p.isCalculationSheet);
    if (!sheet)
        return null;
    for (const label of labels) {
        const tc = sheet.totalChecks.find((t) => t.label.toLowerCase() === label.toLowerCase() && t.declaredAmount > 0);
        if (tc)
            return tc.declaredAmount;
        const kt = sheet.keyTotals.find((t) => t.label.toLowerCase().includes(label.toLowerCase()));
        if (kt)
            return kt.amount;
    }
    return sheet.declaredPageTotal;
}
function buildCrossChecks(pages) {
    const calc = pages.filter((p) => p.isCalculationSheet);
    const gac = pickSheetTotal(calc, 'gac', 'Gross Total', 'Grand Total', 'GAC');
    const bc = pickSheetTotal(calc, 'bc', 'Gross Total', 'Grand Total', 'BC');
    const abstractTotal = pickSheetTotal(calc, 'abstract', 'Abstract of Cost', 'Grand Total', 'Gross Total');
    const boqPages = calc.filter((p) => p.sheetType === 'boq');
    const boqSum = round2(boqPages.reduce((sum, p) => sum + p.computedPageTotal, 0));
    const checks = [];
    const parts = [
        { name: 'GAC', val: gac },
        { name: 'BC', val: bc },
        { name: 'Abstract', val: abstractTotal },
        { name: 'BOQ sum', val: boqSum > 0 ? boqSum : null },
    ].filter((v) => v.val != null && v.val > 0);
    const tharaliBoqPages = boqPages.filter((p) => p.layoutFormat === 'tharali');
    if (tharaliBoqPages.length === 0 && parts.length >= 2) {
        const base = parts[0].val;
        const match = parts.every((v) => Math.abs(v.val - base) <= totalRowTolerance(base));
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
    if (tharaliBoqPages.length > 0 && abstractTotal != null && abstractTotal > 0) {
        const componentSum = round2(tharaliBoqPages.reduce((sum, p) => sum + p.computedPageTotal, 0));
        const match = Math.abs(componentSum - abstractTotal) <= totalRowTolerance(abstractTotal);
        checks.push({
            label: 'Abstract gross vs component BOQ sheets (Tharali)',
            gac: null,
            bc: null,
            abstract: abstractTotal,
            boqSum: componentSum,
            match,
            message: match
                ? `Abstract of Cost gross ₹${abstractTotal.toLocaleString('en-IN')} matches sum of ${tharaliBoqPages.length} component sheet(s)`
                : `Abstract gross ₹${abstractTotal.toLocaleString('en-IN')} ≠ component BOQ sum ₹${componentSum.toLocaleString('en-IN')} (${tharaliBoqPages.map((p) => p.sheetName).join(', ')})`,
        });
    }
    return checks;
}
function validateWorkbookPages(workbook, visibleSheetNames) {
    const pages = [];
    let globalLineNo = 0;
    const names = Array.isArray(visibleSheetNames) && visibleSheetNames.length > 0
        ? visibleSheetNames
        : (Array.isArray(workbook?.SheetNames) ? workbook.SheetNames : []);
    names.forEach((sheetName, pageIdx) => {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet)
            return;
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
        const headerInfo = findHeaderInfo(rows);
        const layoutFormat = isTharaliLayout(headerInfo.headerMap) ? 'tharali' : 'standard';
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
                layoutFormat,
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
            ? Math.abs(computedPageTotal - declaredPageTotal) <= totalRowTolerance(declaredPageTotal)
            : (failedTotals.length === 0 && declaredPageTotal != null ? true : null);
        const issues = [];
        if (!headerInfo.headerValid && lines.length > 0) {
            issues.push(`Column headings issue: ${headerInfo.headerIssues.join('; ')}`);
        }
        if (failedItems > 0) {
            issues.push(layoutFormat === 'tharali'
                ? `${failedItems} line(s) failed ordered checks (Description → Qty → Rate → Qty×Rate=Total Amount → DSR+UJN+SOR(PWD)+NSI=Total Amount → cross-check)`
                : `${failedItems} line(s) failed ordered checks (Description → Qty → Rate → Qty×Rate=Amount)`);
        }
        if (warningItems > 0)
            issues.push(`${warningItems} line(s) have warnings`);
        failedTotals.forEach((t) => { if (t.message)
            issues.push(t.message); });
        if (declaredPageTotal != null && pageTotalMatch === false) {
            issues.push(`Sheet total mismatch: Excel ₹${declaredPageTotal.toLocaleString('en-IN')} vs calculated ₹${computedPageTotal.toLocaleString('en-IN')}`);
        }
        if (lines.length > 0 && !totalChecks.some((t) => /gross|grand/i.test(t.label)) && declaredPageTotal == null) {
            issues.push('No Gross Total / Grand Total row found on this calculation sheet');
        }
        let status = 'passed';
        if (!headerInfo.headerValid && lines.length > 0)
            status = 'failed';
        else if (failedItems > 0 || failedTotals.length > 0 || pageTotalMatch === false)
            status = 'failed';
        else if (warningItems > 0)
            status = 'warning';
        pages.push({
            pageNo: pageIdx + 1,
            sheetName,
            sheetType,
            layoutFormat,
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
        });
    });
    return pages;
}
function validateBoqExcelBuffer(buffer) {
    if (!buffer?.length) {
        throw new Error('Excel file is empty');
    }
    const workbook = XLSX.read(buffer, { type: 'buffer', cellFormula: true, cellStyles: false });
    if (!workbook || !Array.isArray(workbook.SheetNames) || workbook.SheetNames.length === 0) {
        throw new Error('Invalid Excel workbook — no worksheets found');
    }
    const { visible, hidden } = (0, dpr_excel_audit_util_1.getVisibleSheetNames)(workbook);
    const sheetNames = visible.length > 0 ? visible : workbook.SheetNames;
    const pages = validateWorkbookPages(workbook, sheetNames);
    const calcPages = pages.filter((p) => p.isCalculationSheet);
    const allLines = calcPages.flatMap((p) => p.lines);
    const crossChecks = buildCrossChecks(calcPages);
    const firstProblem = calcPages.find((p) => p.hasIssues);
    const firstCalc = calcPages[0];
    const firstCalculationPageNo = firstProblem?.pageNo ?? firstCalc?.pageNo ?? null;
    if (!calcPages.length) {
        const baseReport = {
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
        return (0, dpr_excel_audit_util_1.attachExcelAudit)(workbook, sheetNames, hidden, baseReport);
    }
    const passedItems = allLines.filter((l) => l.status === 'pass').length;
    const failedItems = allLines.filter((l) => l.status === 'fail').length;
    const warningItems = allLines.filter((l) => l.status === 'warning').length;
    const grossFromGac = pickSheetTotal(calcPages, 'gac', 'Gross Total', 'Grand Total');
    const grossFromAbstract = pickSheetTotal(calcPages, 'abstract', 'Gross Total', 'Grand Total', 'Abstract of Cost');
    const computedGrandTotal = round2(calcPages.filter((p) => p.sheetType === 'boq').reduce((sum, p) => sum + p.computedPageTotal, 0)
        || grossFromGac
        || grossFromAbstract
        || 0);
    const declaredGrandTotal = grossFromAbstract ?? grossFromGac ?? null;
    const grandTotalMatch = crossChecks.length > 0 ? crossChecks[0].match : null;
    const problemPages = calcPages.filter((p) => p.hasIssues);
    const slimmedCrossChecks = slimCrossChecks(crossChecks);
    let status = 'passed';
    if (problemPages.some((p) => p.status === 'failed') || crossChecks.some((c) => !c.match))
        status = 'failed';
    else if (problemPages.length > 0 || warningItems > 0)
        status = 'warning';
    const readyForTac = status === 'passed';
    const summaryMessage = status === 'passed'
        ? 'BOQ validation PASSED'
        : status === 'warning'
            ? 'BOQ validation passed with warnings — see errors below'
            : 'BOQ validation failed — fix errors below and re-upload';
    const baseReport = {
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
        lines: allLines,
        crossChecks,
        summary: {
            message: summaryMessage,
            readyForTac,
            issues: status === 'passed' ? [] : [summaryMessage],
        },
    };
    const audited = (0, dpr_excel_audit_util_1.attachExcelAudit)(workbook, sheetNames, hidden, baseReport);
    return {
        ...audited,
        pages: audited.pages.map(slimPage),
        lines: slimLines(allLines),
        crossChecks: slimmedCrossChecks,
    };
}
