/**
 * Inline regression tests for Step 6/7 BOQ section totals.
 * Run: npm run test:boq-section-totals
 */
import { validateTotalRows } from './dpr-boq-validation.util';

const THARALI_HEADER: Record<string, number> = {
  serial: 0,
  description: 1,
  unit: 2,
  qty: 3,
  rate: 4,
  dsr: 5,
  ujn: 6,
  sor_pwd: 7,
  nsi: 8,
  total_amount: 9,
};

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

/** Reproduces "so & Tra" row 11 — Step 7 Total Cost must equal Excel, not 2×. */
function testSoTraStep7TotalCostRow11(): void {
  const DSR = 2704964;
  const UJN = 1296;
  const SOR = 393668.98;
  const TOTAL = 3099928.98;

  const rows: (string | number)[][] = [
    ['S.No', 'Description', 'Unit', 'Qty', 'Rate', 'DSR', 'UJN', 'SOR(PWD)', 'NSI', 'Total Amount'],
    [1, 'Earthwork item', 'cum', 100, 27049.64, DSR, UJN, SOR, 0, TOTAL],
    [2, 'Sub Total', '', '', '', DSR, UJN, SOR, 0, TOTAL],
    // Description col blank; "Total Cost" only in joined text — auditVerticalAmountColumn used to double-count this row.
    [11, '', 'Total Cost', '', '', DSR, UJN, SOR, 0, TOTAL],
  ];

  const checks = validateTotalRows(rows, THARALI_HEADER, 1, TOTAL);
  const totalCost = checks.find((c) => c.checkStep === 7 && c.rowNo === 4);
  assert(!!totalCost, 'Expected Step 7 Total Cost check at row 4');
  assert(totalCost!.match === true, `Total Cost should pass; got: ${totalCost!.message}`);

  const dsrCol = totalCost!.columnChecks?.find((c) => c.columnLabel === 'DSR');
  assert(dsrCol?.computedAmount === DSR, `DSR calculated must be ${DSR}, got ${dsrCol?.computedAmount}`);
  assert(dsrCol?.computedAmount !== DSR * 2, `DSR must not be double-counted (${DSR * 2})`);

  const ujnCol = totalCost!.columnChecks?.find((c) => c.columnLabel === 'UJN');
  assert(ujnCol?.computedAmount === UJN, `UJN calculated must be ${UJN}, got ${ujnCol?.computedAmount}`);

  const totalCol = totalCost!.columnChecks?.find((c) => c.columnLabel === 'Total Amount');
  assert(
    Math.abs((totalCol?.computedAmount ?? 0) - TOTAL) <= 1,
    `Total Amount calculated must be ${TOTAL}, got ${totalCol?.computedAmount}`,
  );
}

/** cwra-style amount-only rows in Amount column must contribute to Step 6 UJN subtotal. */
function testCwraAmountOnlyRowsStep6(): void {
  const UJN = 951892;
  const header: Record<string, number> = {
    ...THARALI_HEADER,
    amount: 10,
  };

  const rows: (string | number)[][] = [
    ['S.No', 'Description', 'Unit', 'Qty', 'Rate', 'DSR', 'UJN', 'SOR(PWD)', 'NSI', 'Total Amount', 'Amount'],
    [1, 'Lump sum item', 'LS', 0, 0, 0, 0, 0, 0, 0, UJN],
    [2, 'Sub Total', '', '', '', 0, UJN, 0, 0, UJN, ''],
  ];

  const checks = validateTotalRows(rows, header, 1, UJN);
  const subTotal = checks.find((c) => c.checkStep === 6);
  assert(!!subTotal, 'Expected Step 6 Sub Total check');
  assert(subTotal!.match === true, `Sub Total should pass; got: ${subTotal!.message}`);

  const ujnCol = subTotal!.columnChecks?.find((c) => c.columnLabel === 'UJN');
  assert(ujnCol?.computedAmount === UJN, `UJN calculated must be ${UJN}, got ${ujnCol?.computedAmount}`);
}

/** cwra row 8 — lump sums in unmapped Amt column + NSI item rows (matches production sheet). */
function testCwraUnmappedAmtColumnStep6(): void {
  const UJN = 951892;
  const NSI = 13400;
  const TOTAL = UJN + NSI;
  const header: Record<string, number> = { ...THARALI_HEADER };

  const rows: (string | number)[][] = [
    ['S.No', 'Description', 'Unit', 'Qty', 'Rate', 'DSR', 'UJN', 'SOR(PWD)', 'NSI', 'Total Amount', 'Amt'],
    [1, 'Lump sum item A', 'LS', 0, 0, 0, 0, 0, 0, 0, 500_000],
    [2, 'Lump sum item B', 'LS', 0, 0, 0, 0, 0, 0, 0, 451_892],
    [3, 'NSI rated item', 'LS', 0, 0, 0, 0, 0, NSI, NSI, 0],
    [8, 'Sub Total', '', '', '', 0, UJN, 0, NSI, TOTAL],
  ];

  const checks = validateTotalRows(rows, header, 1, TOTAL);
  const subTotal = checks.find((c) => c.checkStep === 6 && c.rowNo === 5);
  assert(!!subTotal, 'Expected Step 6 Sub Total check at row 5');
  assert(subTotal!.match === true, `Sub Total should pass; got: ${subTotal!.message}`);

  const ujnCol = subTotal!.columnChecks?.find((c) => c.columnLabel === 'UJN');
  assert(ujnCol?.computedAmount === UJN, `UJN calculated must be ${UJN}, got ${ujnCol?.computedAmount}`);

  const totalCol = subTotal!.columnChecks?.find((c) => c.columnLabel === 'Total Amount');
  assert(
    totalCol?.computedAmount === TOTAL,
    `Total Amount calculated must be ${TOTAL}, got ${totalCol?.computedAmount}`,
  );
}

/** cwra row 8 — UJN values directly in UJN column (7 items summing to 951892) + NSI. */
function testCwraDirectUjnColumnStep6(): void {
  const UJN = 951892;
  const NSI = 13400;
  const TOTAL = UJN + NSI;
  const header: Record<string, number> = { ...THARALI_HEADER };

  const rows: (string | number)[][] = [
    ['S.No', 'Description', 'Unit', 'Qty', 'Rate', 'DSR', 'UJN', 'SOR(PWD)', 'NSI', 'Total Amount'],
    [1, 'Lump sum item A', 'LS', 0, 0, 0, 200_000, 0, 0, 0],
    [2, 'Lump sum item B', 'LS', 0, 0, 0, 150_000, 0, 0, 0],
    [3, 'Lump sum item C', 'LS', 0, 0, 0, 100_000, 0, 0, 0],
    [4, 'Lump sum item D', 'LS', 0, 0, 0, 250_000, 0, 0, 0],
    [5, 'Lump sum item E', 'LS', 0, 0, 0, 151_892, 0, 0, 0],
    [6, 'Lump sum item F', 'LS', 0, 0, 0, 100_000, 0, 0, 0],
    [7, 'NSI rated item', 'LS', 0, 0, 0, 0, 0, NSI, NSI],
    [8, 'Sub Total', '', '', '', 0, UJN, 0, NSI, TOTAL],
  ];

  const checks = validateTotalRows(rows, header, 1, TOTAL);
  const subTotal = checks.find((c) => c.checkStep === 6 && c.rowNo === 9);
  assert(!!subTotal, 'Expected Step 6 Sub Total check at row 9');
  assert(subTotal!.match === true, `Sub Total should pass; got: ${subTotal!.message}`);

  const ujnCol = subTotal!.columnChecks?.find((c) => c.columnLabel === 'UJN');
  assert(ujnCol?.computedAmount === UJN, `UJN calculated must be ${UJN}, got ${ujnCol?.computedAmount}`);

  const totalCol = subTotal!.columnChecks?.find((c) => c.columnLabel === 'Total Amount');
  assert(
    totalCol?.computedAmount === TOTAL,
    `Total Amount calculated must be ${TOTAL}, got ${totalCol?.computedAmount}`,
  );
}

/** cwra row 8 — Rate column lump sums with incidental Qty=1 (serial leak), UJN column empty on items. */
function testCwraRateLumpQtyOneStep6(): void {
  const UJN = 951892;
  const NSI = 13400;
  const TOTAL = UJN + NSI;
  const header: Record<string, number> = { ...THARALI_HEADER };

  const rows: (string | number)[][] = [
    ['S.No', 'Description', 'Unit', 'Qty', 'Rate', 'DSR', 'UJN', 'SOR(PWD)', 'NSI', 'Total Amount'],
    [1, 'Lump sum item A', 'LS', 1, 500_000, 0, 0, 0, 0, 0],
    [2, 'Lump sum item B', 'LS', 1, 451_892, 0, 0, 0, 0, 0],
    [3, 'NSI rated item', 'LS', 0, 0, 0, 0, 0, NSI, NSI],
    [8, 'Sub Total', '', '', '', 0, UJN, 0, NSI, TOTAL],
  ];

  const checks = validateTotalRows(rows, header, 1, TOTAL);
  const subTotal = checks.find((c) => c.checkStep === 6 && c.rowNo === 5);
  assert(!!subTotal, 'Expected Step 6 Sub Total check at row 5');
  assert(subTotal!.match === true, `Sub Total should pass; got: ${subTotal!.message}`);

  const ujnCol = subTotal!.columnChecks?.find((c) => c.columnLabel === 'UJN');
  assert(ujnCol?.computedAmount === UJN, `UJN calculated must be ${UJN}, got ${ujnCol?.computedAmount}`);

  const totalCol = subTotal!.columnChecks?.find((c) => c.columnLabel === 'Total Amount');
  assert(
    totalCol?.computedAmount === TOTAL,
    `Total Amount calculated must be ${TOTAL}, got ${totalCol?.computedAmount}`,
  );
}

/** cwra row 8 — lump sums in Rate column (LS items) + NSI item rows (production cwra sheet). */
function testCwraRateColumnLumpSumStep6(): void {
  const UJN = 951892;
  const NSI = 13400;
  const TOTAL = UJN + NSI;
  const header: Record<string, number> = { ...THARALI_HEADER };

  const rows: (string | number)[][] = [
    ['S.No', 'Description', 'Unit', 'Qty', 'Rate', 'DSR', 'UJN', 'SOR(PWD)', 'NSI', 'Total Amount'],
    [1, 'Lump sum item A', 'LS', 0, 500_000, 0, 0, 0, 0, 0],
    [2, 'Lump sum item B', 'LS', 0, 451_892, 0, 0, 0, 0, 0],
    [3, 'NSI rated item', 'LS', 0, 0, 0, 0, 0, NSI, NSI],
    [8, 'Sub Total', '', '', '', 0, UJN, 0, NSI, TOTAL],
  ];

  const checks = validateTotalRows(rows, header, 1, TOTAL);
  const subTotal = checks.find((c) => c.checkStep === 6 && c.rowNo === 5);
  assert(!!subTotal, 'Expected Step 6 Sub Total check at row 5');
  assert(subTotal!.match === true, `Sub Total should pass; got: ${subTotal!.message}`);

  const ujnCol = subTotal!.columnChecks?.find((c) => c.columnLabel === 'UJN');
  assert(ujnCol?.computedAmount === UJN, `UJN calculated must be ${UJN}, got ${ujnCol?.computedAmount}`);

  const totalCol = subTotal!.columnChecks?.find((c) => c.columnLabel === 'Total Amount');
  assert(
    totalCol?.computedAmount === TOTAL,
    `Total Amount calculated must be ${TOTAL}, got ${totalCol?.computedAmount}`,
  );
}

/** so & Tra — UJN ₹4 rounding slack (summed 1300 vs Excel 1296) must pass Step 6/7. */
function testSoTraUjnTolerance1296vs1300(): void {
  const UJN_EXCEL = 1296;
  const UJN_SUMMED = 1300;
  const TOTAL = UJN_EXCEL;

  const rows: (string | number)[][] = [
    ['S.No', 'Description', 'Unit', 'Qty', 'Rate', 'DSR', 'UJN', 'SOR(PWD)', 'NSI', 'Total Amount'],
    [1, 'Small UJN item', 'Nos', 1, UJN_SUMMED, 0, UJN_SUMMED, 0, 0, UJN_SUMMED],
    [2, 'Sub Total', '', '', '', 0, UJN_EXCEL, 0, 0, TOTAL],
    [11, '', 'Total Cost', '', '', 0, UJN_EXCEL, 0, 0, TOTAL],
  ];

  const checks = validateTotalRows(rows, THARALI_HEADER, 1, TOTAL);
  const subTotal = checks.find((c) => c.checkStep === 6);
  assert(!!subTotal, 'Expected Step 6 Sub Total check');
  assert(subTotal!.match === true, `Sub Total should pass within ₹5 tolerance; got: ${subTotal!.message}`);

  const ujnStep6 = subTotal!.columnChecks?.find((c) => c.columnLabel === 'UJN');
  assert(ujnStep6?.declaredAmount === UJN_EXCEL, `UJN declared must be ${UJN_EXCEL}`);
  assert(ujnStep6?.computedAmount === UJN_SUMMED, `UJN computed must be ${UJN_SUMMED}`);
  assert(ujnStep6?.match === true, 'Step 6 UJN 1296 vs 1300 must pass within ₹5 tolerance');

  const totalCost = checks.find((c) => c.checkStep === 7 && c.rowNo === 4);
  assert(!!totalCost, 'Expected Step 7 Total Cost check at row 4');
  assert(totalCost!.match === true, `Total Cost should pass; got: ${totalCost!.message}`);
}

function runAll(): void {
  testSoTraStep7TotalCostRow11();
  testSoTraUjnTolerance1296vs1300();
  testCwraAmountOnlyRowsStep6();
  testCwraUnmappedAmtColumnStep6();
  testCwraDirectUjnColumnStep6();
  testCwraRateLumpQtyOneStep6();
  testCwraRateColumnLumpSumStep6();
  console.log('dpr-boq-section-totals: all tests passed');
}

runAll();
