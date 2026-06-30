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
    [11, '', 'Total Cost', '', '', DSR, UJN, SOR, 0, TOTAL],
  ];

  const checks = validateTotalRows(rows, THARALI_HEADER, 1, TOTAL);
  const totalCost = checks.find((c) => c.checkStep === 7 && c.rowNo === 4);
  assert(!!totalCost, 'Expected Step 7 Total Cost check at row 4');
  assert(totalCost!.match === true, `Total Cost should pass; got: ${totalCost!.message}`);

  const dsrCol = totalCost!.columnChecks?.find((c) => c.columnLabel === 'DSR');
  assert(dsrCol?.computedAmount === DSR, `DSR calculated must be ${DSR}, got ${dsrCol?.computedAmount}`);
  assert(dsrCol?.computedAmount !== DSR * 2, `DSR must not be double-counted (${DSR * 2})`);
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

/** so & Tra — premature Sub Total + post-subtotal items → Total Cost must not be zero. */
function testSoTraStep7PrematureSubtotalWithItems(): void {
  const DSR = 2704964;
  const UJN = 1296;
  const SOR = 393668.98;
  const SUB_TOTAL = 3099928.98;
  const EXTRA = 100;
  const TOTAL = SUB_TOTAL + EXTRA;

  const rows: (string | number)[][] = [
    ['S.No', 'Description', 'Unit', 'Qty', 'Rate', 'DSR', 'UJN', 'SOR(PWD)', 'NSI', 'Total Amount'],
    [1, 'Earthwork item', 'cum', 100, 27049.64, DSR, UJN, SOR, 0, SUB_TOTAL],
    [2, 'Sub Total', '', '', '', DSR, UJN, SOR, 0, SUB_TOTAL],
    [3, 'Extra item after subtotal', 'Nos', 1, EXTRA, EXTRA, 0, 0, 0, EXTRA],
    [11, '', 'Total Cost', '', '', DSR + EXTRA, UJN, SOR, 0, TOTAL],
  ];

  const checks = validateTotalRows(rows, THARALI_HEADER, 1, TOTAL);
  const totalCost = checks.find((c) => c.checkStep === 7 && c.rowNo === 5);
  assert(!!totalCost, 'Expected Step 7 Total Cost check at row 5');
  assert(totalCost!.match === true, `Total Cost should pass; got: ${totalCost!.message}`);

  const dsrCol = totalCost!.columnChecks?.find((c) => c.columnLabel === 'DSR');
  assert(dsrCol?.computedAmount === DSR + EXTRA, `DSR calculated must be ${DSR + EXTRA}, got ${dsrCol?.computedAmount}`);
  assert((dsrCol?.computedAmount ?? 0) > 0, 'Step 7 DSR must not be zero');
}

/** cwra-style amount-only rows in Amount column must contribute to Step 6 UJN subtotal. */
function testCwraAmountOnlyRowsStep6(): void {
  const UJN = 951892;
  const header: Record<string, number> = { ...THARALI_HEADER, amount: 10 };

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

/** cwra — rows 8 + 10 + 11 items, row 9 description skip → Sub Total row 12. */
function testCwraRows8_10_11Step6(): void {
  const UJN = 951892;
  const NSI = 13400;
  const SOR1 = 57917.48;
  const SOR2 = 38611.65;
  const SOR = 96529.13;
  const TOTAL = 965292;
  const header: Record<string, number> = { ...THARALI_HEADER };

  const rows: (string | number)[][] = [
    ['S.No', 'Description', 'Unit', 'Qty', 'Rate', 'DSR', 'UJN', 'SOR(PWD)', 'NSI', 'Total Amount'],
    [8, 'Main lump sum item', 'LS', 0, 0, 0, UJN, 0, 0, UJN],
    [9, 'Protection works for substructure and foundation', '', '', '', 0, 0, 0, 0, 0],
    [10, 'SOR rated item A', 'Nos', 1, SOR1, 0, 0, SOR1, 0, SOR1],
    [10, 'SOR rated item B', 'Nos', 1, SOR2, 0, 0, SOR2, 0, SOR2],
    [11, 'NSI rated item', 'LS', 0, 0, 0, 0, 0, NSI, NSI],
    [12, 'Sub Total', '', '', '', 0, UJN, SOR, NSI, TOTAL],
  ];

  const checks = validateTotalRows(rows, header, 1, TOTAL);
  const subTotal = checks.find((c) => c.checkStep === 6 && c.rowNo === 7);
  assert(!!subTotal, 'Expected Step 6 Sub Total check at row 12');
  assert(subTotal!.match === true, `Sub Total should pass; got: ${subTotal!.message}`);

  const ujnCol = subTotal!.columnChecks?.find((c) => c.columnLabel === 'UJN');
  assert(ujnCol?.computedAmount === UJN, `UJN calculated must be ${UJN}, got ${ujnCol?.computedAmount}`);

  const sorCol = subTotal!.columnChecks?.find((c) => c.columnLabel === 'SOR(PWD)');
  assert(Math.abs((sorCol?.computedAmount ?? 0) - SOR) <= 0.05, `SOR(PWD) calculated must be ${SOR}, got ${sorCol?.computedAmount}`);

  const nsiCol = subTotal!.columnChecks?.find((c) => c.columnLabel === 'NSI');
  assert(nsiCol?.computedAmount === NSI, `NSI calculated must be ${NSI}, got ${nsiCol?.computedAmount}`);

  const totalCol = subTotal!.columnChecks?.find((c) => c.columnLabel === 'Total Amount');
  assert(totalCol?.computedAmount === TOTAL, `Total Amount calculated must be ${TOTAL}, got ${totalCol?.computedAmount}`);
}

/** cwra row 8 wrongly labeled Sub Total — must contribute as item; real subtotal row 12. */
function testCwraPrematureSubTotalRow8(): void {
  const UJN = 951892;
  const NSI = 13400;
  const SOR1 = 57917.48;
  const SOR2 = 38611.65;
  const SOR = 96529.13;
  const TOTAL = 965292;
  const header: Record<string, number> = { ...THARALI_HEADER };

  const rows: (string | number)[][] = [
    ['S.No', 'Description', 'Unit', 'Qty', 'Rate', 'DSR', 'UJN', 'SOR(PWD)', 'NSI', 'Total Amount'],
    [8, 'Sub Total', '', '', '', 0, UJN, 0, 0, UJN],
    [9, 'Protection works for substructure and foundation', '', '', '', 0, 0, 0, 0, 0],
    [10, 'SOR rated item A', 'Nos', 1, SOR1, 0, 0, SOR1, 0, SOR1],
    [10, 'SOR rated item B', 'Nos', 1, SOR2, 0, 0, SOR2, 0, SOR2],
    [11, 'NSI rated item', 'LS', 0, 0, 0, 0, 0, NSI, NSI],
    [12, 'Sub Total', '', '', '', 0, UJN, SOR, NSI, TOTAL],
  ];

  const checks = validateTotalRows(rows, header, 1, TOTAL);
  const subTotal = checks.find((c) => c.checkStep === 6 && c.rowNo === 7);
  assert(!!subTotal, 'Expected Step 6 Sub Total check at row 12 only');
  assert(subTotal!.match === true, `Sub Total should pass; got: ${subTotal!.message}`);

  const premature = checks.find((c) => c.checkStep === 6 && c.rowNo === 2);
  assert(!premature, 'Row 8 must not trigger Step 6 when row 10 items follow');
}

/** cwra row 11 wrongly labeled Sub Total — must contribute as item; real subtotal row 12. */
function testCwraPrematureSubTotalRow11(): void {
  const UJN = 951892;
  const NSI = 13400;
  const SOR1 = 57917.48;
  const SOR2 = 38611.65;
  const SOR = 96529.13;
  const TOTAL = 965292;
  const header: Record<string, number> = { ...THARALI_HEADER };

  const rows: (string | number)[][] = [
    ['S.No', 'Description', 'Unit', 'Qty', 'Rate', 'DSR', 'UJN', 'SOR(PWD)', 'NSI', 'Total Amount'],
    [8, 'Main lump sum item', 'LS', 0, 0, 0, UJN, 0, 0, UJN],
    [9, 'Protection works for substructure and foundation', '', '', '', 0, 0, 0, 0, 0],
    [10, 'SOR rated item A', 'Nos', 1, SOR1, 0, 0, SOR1, 0, SOR1],
    [10, 'SOR rated item B', 'Nos', 1, SOR2, 0, 0, SOR2, 0, SOR2],
    [11, 'Sub Total', '', '', '', 0, 0, 0, NSI, NSI],
    [12, 'Sub Total', '', '', '', 0, UJN, SOR, NSI, TOTAL],
  ];

  const checks = validateTotalRows(rows, header, 1, TOTAL);
  const subTotal = checks.find((c) => c.checkStep === 6 && c.rowNo === 7);
  assert(!!subTotal, 'Expected Step 6 Sub Total check at row 12 only');
  assert(subTotal!.match === true, `Sub Total should pass; got: ${subTotal!.message}`);

  const premature = checks.find((c) => c.checkStep === 6 && c.rowNo === 6);
  assert(!premature, 'Row 11 must not trigger Step 6 when row 12 subtotal follows');

  const nsiCol = subTotal!.columnChecks?.find((c) => c.columnLabel === 'NSI');
  assert(nsiCol?.computedAmount === NSI, `NSI calculated must include row 11 item; got ${nsiCol?.computedAmount}`);
}

/** cwra production block — rows 1–7 + premature row 8 + row 10 + row 11 → Sub Total row 12; UJN must not 2×. */
function testCwraRows1_7_8_10_11NoDoubleUjn(): void {
  const UJN = 951892;
  const NSI = 13400;
  const SOR1 = 57917.48;
  const SOR2 = 38611.65;
  const SOR = 96529.13;
  const TOTAL = 965292;
  const header: Record<string, number> = { ...THARALI_HEADER };

  const rows: (string | number)[][] = [
    ['S.No', 'Description', 'Unit', 'Qty', 'Rate', 'DSR', 'UJN', 'SOR(PWD)', 'NSI', 'Total Amount'],
    [1, 'Lump sum item A', 'LS', 0, 500_000, 0, 0, 0, 0, 0],
    [2, 'Lump sum item B', 'LS', 0, 451_892, 0, 0, 0, 0, 0],
    [3, 'Lump sum item C', 'LS', 0, 0, 0, 0, 0, 0, 0],
    [4, 'Lump sum item D', 'LS', 0, 0, 0, 0, 0, 0, 0],
    [5, 'Lump sum item E', 'LS', 0, 0, 0, 0, 0, 0, 0],
    [6, 'Lump sum item F', 'LS', 0, 0, 0, 0, 0, 0, 0],
    [7, 'Detail item G', 'LS', 0, 0, 0, 0, 0, 0, 0],
    [8, 'Sub Total', '', '', '', 0, UJN, 0, 0, UJN],
    [9, 'Protection works for substructure and foundation', '', '', '', 0, 0, 0, 0, 0],
    [10, 'SOR rated item A', 'Nos', 1, SOR1, 0, 0, SOR1, 0, SOR1],
    [10, 'SOR rated item B', 'Nos', 1, SOR2, 0, 0, SOR2, 0, SOR2],
    [11, 'NSI rated item', 'LS', 0, 0, 0, 0, 0, NSI, NSI],
    [12, 'Sub Total', '', '', '', 0, UJN, SOR, NSI, TOTAL],
  ];

  const checks = validateTotalRows(rows, header, 1, TOTAL);
  const subTotal = checks.find((c) => c.checkStep === 6 && c.rowNo === 14);
  assert(!!subTotal, 'Expected Step 6 Sub Total check at row 12');
  assert(subTotal!.match === true, `Sub Total should pass; got: ${subTotal!.message}`);

  const ujnCol = subTotal!.columnChecks?.find((c) => c.columnLabel === 'UJN');
  assert(ujnCol?.computedAmount === UJN, `UJN calculated must be ${UJN}, got ${ujnCol?.computedAmount}`);
  assert(ujnCol!.computedAmount !== UJN * 2, `UJN must not be double-counted (${UJN * 2})`);

  const premature = checks.find((c) => c.checkStep === 6 && c.rowNo === 9);
  assert(!premature, 'Premature row 8 must not trigger Step 6');
}

/** cwra — lump sums in unmapped Amt column; rows 1–2 + row 8 block → Sub Total row 12. */
function testCwraUnmappedAmtColumnStep6(): void {
  const UJN = 951892;
  const NSI = 13400;
  const TOTAL = UJN + NSI;
  const header: Record<string, number> = { ...THARALI_HEADER, amount: 10 };

  const rows: (string | number)[][] = [
    ['S.No', 'Description', 'Unit', 'Qty', 'Rate', 'DSR', 'UJN', 'SOR(PWD)', 'NSI', 'Total Amount', 'Amt'],
    [1, 'Lump sum item A', 'LS', 0, 0, 0, 0, 0, 0, 0, 500_000],
    [2, 'Lump sum item B', 'LS', 0, 0, 0, 0, 0, 0, 0, 451_892],
    [8, 'Sub Total', 'LS', 0, 0, 0, UJN, 0, 0, UJN, ''],
    [9, 'Protection works for substructure', '', '', '', 0, 0, 0, 0, 0, 0],
    [11, 'NSI rated item', 'LS', 0, 0, 0, 0, 0, NSI, NSI, 0],
    [12, 'Sub Total', '', '', '', 0, UJN, 0, NSI, TOTAL, ''],
  ];

  const checks = validateTotalRows(rows, header, 1, TOTAL);
  const subTotal = checks.find((c) => c.checkStep === 6 && c.rowNo === 7);
  assert(!!subTotal, 'Expected Step 6 Sub Total check at row 12');
  assert(subTotal!.match === true, `Sub Total should pass; got: ${subTotal!.message}`);

  const ujnCol = subTotal!.columnChecks?.find((c) => c.columnLabel === 'UJN');
  assert(ujnCol?.computedAmount === UJN, `UJN calculated must be ${UJN}, got ${ujnCol?.computedAmount}`);
}

/** cwra — Rate column lump sums; rows 1–2 + row 8 block → Sub Total row 12. */
function testCwraRateColumnLumpSumStep6(): void {
  const UJN = 951892;
  const NSI = 13400;
  const TOTAL = UJN + NSI;
  const header: Record<string, number> = { ...THARALI_HEADER };

  const rows: (string | number)[][] = [
    ['S.No', 'Description', 'Unit', 'Qty', 'Rate', 'DSR', 'UJN', 'SOR(PWD)', 'NSI', 'Total Amount'],
    [1, 'Lump sum item A', 'LS', 0, 500_000, 0, 0, 0, 0, 0],
    [2, 'Lump sum item B', 'LS', 0, 451_892, 0, 0, 0, 0, 0],
    [8, 'Sub Total', 'LS', 0, 0, 0, UJN, 0, 0, UJN],
    [9, 'Protection works for substructure', '', '', '', 0, 0, 0, 0, 0],
    [11, 'NSI rated item', 'LS', 0, 0, 0, 0, 0, NSI, NSI],
    [12, 'Sub Total', '', '', '', 0, UJN, 0, NSI, TOTAL],
  ];

  const checks = validateTotalRows(rows, header, 1, TOTAL);
  const subTotal = checks.find((c) => c.checkStep === 6 && c.rowNo === 7);
  assert(!!subTotal, 'Expected Step 6 Sub Total check at row 12');
  assert(subTotal!.match === true, `Sub Total should pass; got: ${subTotal!.message}`);

  const ujnCol = subTotal!.columnChecks?.find((c) => c.columnLabel === 'UJN');
  assert(ujnCol?.computedAmount === UJN, `UJN calculated must be ${UJN}, got ${ujnCol?.computedAmount}`);
}

/** Abstract Of Cost — exact Tharali column layout (S.N. | SOR CODE | Description | Qty | Rate | Per unit | DSR | UJN | SOR | NSI | Total). */
const THARALI_ABSTRACT_HEADER: Record<string, number> = {
  serial: 0,
  sor_code: 1,
  description: 2,
  qty: 3,
  rate: 4,
  unit: 5,
  dsr: 6,
  ujn: 7,
  sor_pwd: 8,
  nsi: 9,
  total_amount: 10,
};

/** Treatment Works Abstract rows 1–3 + Sub Total row 4 — direct column mapping, no lump-sum fallbacks. */
function testAbstractTreatmentWorksRows1to4(): void {
  const DSR = 606242 + 93312 + 2005410;
  const UJN = 1296;
  const SOR = 75906;
  const NSI = 16774;
  const TOTAL = 700218 + 93312 + 2005410;

  const rows: (string | number)[][] = [
    ['S.N.', 'SOR CODE', 'Description', 'Quantity', 'Rate', 'Per unit', 'DSR', 'UJN', 'SOR(PWD)', 'NSI', 'Total Amount'],
    [1, 'A1', 'Treatment item 1', 2, 350109, 'Job', 606242, UJN, SOR, NSI, 700218],
    [2, 'A2', 'Treatment item 2', 6, 15552, 'cum', 93312, 0, 0, 0, 93312],
    [3, 'A3', 'Treatment item 3', 2, 1002705, 'Job', 2005410, 0, 0, 0, 2005410],
    [4, '', 'Sub Total', '', '', '', DSR, UJN, SOR, NSI, TOTAL],
  ];

  const checks = validateTotalRows(rows, THARALI_ABSTRACT_HEADER, 1, TOTAL);
  const subTotal = checks.find((c) => c.checkStep === 6 && c.rowNo === 5);
  assert(!!subTotal, 'Expected Step 6 Sub Total check at row 5');
  assert(subTotal!.match === true, `Sub Total should pass; got: ${subTotal!.message}`);

  const dsrCol = subTotal!.columnChecks?.find((c) => c.columnLabel === 'DSR');
  assert(dsrCol?.computedAmount === DSR, `DSR calculated must be ${DSR}, got ${dsrCol?.computedAmount}`);

  assert(subTotal!.horizontalMatch === true, 'Sub Total horizontal DSR+UJN+SOR+NSI must equal Total Amount');
}

function runAll(): void {
  testAbstractTreatmentWorksRows1to4();
  testSoTraStep7TotalCostRow11();
  testSoTraUjnTolerance1296vs1300();
  testSoTraStep7PrematureSubtotalWithItems();
  testCwraAmountOnlyRowsStep6();
  testCwraRows8_10_11Step6();
  testCwraPrematureSubTotalRow8();
  testCwraPrematureSubTotalRow11();
  testCwraRows1_7_8_10_11NoDoubleUjn();
  testCwraUnmappedAmtColumnStep6();
  testCwraRateColumnLumpSumStep6();
  console.log('dpr-boq-section-totals: all tests passed');
}

runAll();
