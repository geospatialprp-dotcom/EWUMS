import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Simulate user's Excel layout
const ws = XLSX.utils.aoa_to_sheet([
  ['WATER SUPPLY SCHEME BOQ'],
  ['1. Distribution Network'],
  ['SN', 'ITEM DESCRIPTION', 'QTY', 'UNIT', 'RATE WITH GST', 'TOTAL AMOUNT WITH TAX'],
  [1, 'Distribution main laying 100 mm DI', 2500, 'rm', 920, 2300000],
  [2, 'Distribution valve installation', 40, 'nos', 8500, 340000],
  ['', '', '', '', 'Total Amount with Tax', 2640000],
]);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'BOQ');
const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
const testPath = path.join(__dirname, '..', '_test_boq.xlsx');
fs.writeFileSync(testPath, buf);

const sheet = wb.Sheets['BOQ'];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
console.log('Raw rows:', rows.length);
rows.forEach((r, i) => console.log(i, JSON.stringify(r)));
