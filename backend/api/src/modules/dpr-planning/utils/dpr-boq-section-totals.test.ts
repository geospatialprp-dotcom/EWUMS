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

function runAll(): void {
  testSoTraStep7TotalCostRow11();
  testCwraAmountOnlyRowsStep6();
  testCwraUnmappedAmtColumnStep6();
  console.log('dpr-boq-section-totals: all tests passed');
}

runAll();
