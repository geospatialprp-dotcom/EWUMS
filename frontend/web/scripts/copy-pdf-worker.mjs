import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
const dest = path.join(root, 'public/pdf.worker.min.mjs');

if (!fs.existsSync(src)) {
  console.error('pdfjs-dist worker not found — run npm install in frontend/web');
  process.exit(1);
}

fs.copyFileSync(src, dest);
console.log('Copied pdf.worker.min.mjs → public/');
