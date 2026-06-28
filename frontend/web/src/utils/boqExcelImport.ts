import * as XLSX from 'xlsx';
import {
  COMPONENT_LABELS,
  PROJECT_COMPONENT_ORDER,
  BOQ_TABLE_COLUMNS,
  type ProjectComponent,
} from '../constants/construction';
import type { SchemeType } from '../services/api';
import { extractBoqUnit } from './boqUnits';

export interface ParsedBoqRow {
  itemCode: string;
  description: string;
  unit: string;
  contractQty: number;
  rate: number;
  amount: number;
  schemeType: SchemeType;
  component?: ProjectComponent;
  sortOrder: number;
  serialNo?: number;
}

export interface ParsedBoqSection {
  component: ProjectComponent | 'other';
  label: string;
  sectionNumber: number;
  items: ParsedBoqRow[];
}

/** Payload fields accepted by POST /construction/boq/import */
export interface BoqImportPayloadItem {
  itemCode: string;
  description: string;
  unit: string;
  contractQty: number;
  rate: number;
  contractAmount?: number;
  schemeType: SchemeType;
  component?: ProjectComponent;
  sortOrder: number;
}

export { BOQ_TABLE_COLUMNS };

/** Standard 6-column BOQ layout: SN | Item Description | QTY | Unit | Rate with GST | Total Amount with Tax */
const STANDARD_HEADER: HeaderMap = {
  serial: 0,
  description: 1,
  qty: 2,
  unit: 3,
  rate: 4,
  amount: 5,
};

const COMPONENT_ALIASES: Record<string, ProjectComponent> = {
  source_development: 'source_development',
  source: 'source_development',
  'source development': 'source_development',
  'source development works': 'source_development',
  'source & treatment works': 'source_development',
  'source treatment works': 'source_development',
  gravity_main: 'gravity_main',
  'gravity main': 'gravity_main',
  'gravity main pipeline': 'gravity_main',
  'supply main': 'gravity_main',
  'supply main / gravity main': 'gravity_main',
  'supply main gravity main': 'gravity_main',
  pumping_main: 'pumping_main',
  'pumping main': 'pumping_main',
  'pumping main pipeline': 'pumping_main',
  reservoir: 'reservoir',
  'reservoir construction': 'reservoir',
  'storage & reservoir works': 'reservoir',
  'storage & reserviour works': 'reservoir',
  'storage reservoir works': 'reservoir',
  distribution: 'distribution',
  'distribution network': 'distribution',
  'distribution system': 'distribution',
  fhtc: 'fhtc',
  'fhtc connections': 'fhtc',
};

const LABEL_TO_COMPONENT = Object.fromEntries(
  Object.entries(COMPONENT_LABELS).map(([key, label]) => [label.toLowerCase(), key as ProjectComponent]),
) as Record<string, ProjectComponent>;

type HeaderMap = {
  serial?: number;
  code?: number;
  description?: number;
  unit?: number;
  qty?: number;
  rate?: number;
  amount?: number;
  component?: number;
  scheme?: number;
};

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function parseNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const cleaned = String(value ?? '').replace(/[,₹\s]/g, '').trim();
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function resolveComponent(raw: string, fallback?: string): ProjectComponent | undefined {
  for (const candidate of [raw, fallback].filter(Boolean) as string[]) {
    const stripped = candidate.replace(/^\d+[\s\-–—.]+/i, '').trim();
    for (const key of [normalizeText(candidate), normalizeText(stripped)]) {
      if (COMPONENT_ALIASES[key]) return COMPONENT_ALIASES[key];
      if (LABEL_TO_COMPONENT[key]) return LABEL_TO_COMPONENT[key];
      if (key.includes('source') && key.includes('treatment')) return 'source_development';
      if (key.includes('storage') && /reserv/i.test(key)) return 'reservoir';
      if (/supply\s*main|gravity\s*main/.test(key)) return 'gravity_main';
      if (key.includes('distribution')) return 'distribution';
      if (key in COMPONENT_LABELS) return key as ProjectComponent;
    }
  }
  return undefined;
}

function resolveSchemeType(raw: string, component?: ProjectComponent): SchemeType {
  const key = raw.trim().toLowerCase();
  if (key === 'pumping' || key.includes('pump')) return 'pumping';
  if (component === 'pumping_main') return 'pumping';
  return 'gravity';
}

function makeItemCode(
  itemCode: string,
  description: string,
  component: ProjectComponent | undefined,
  serialNo: number | undefined,
  sortOrder: number,
): string {
  if (itemCode && !/^\d+$/.test(itemCode)) return itemCode;
  const prefix = component
    ? component.split('_').map((w) => w[0]?.toUpperCase() ?? '').join('').slice(0, 3)
    : 'BOQ';
  const sn = serialNo ?? sortOrder;
  return `${prefix}-${String(sn).padStart(3, '0')}`;
}

function isSummaryRow(description: string, itemCode: string): boolean {
  const text = `${description} ${itemCode}`.toLowerCase();
  return text.includes('grand total') || text.includes('section total')
    || text.includes('total amount') || text === 'total';
}

function isValidBoqDescription(description: string): boolean {
  const text = description.trim();
  if (text.length < 4) return false;
  if (!/[a-zA-Z]/.test(text)) return false;
  if (/^\d+(\.\d+)?$/.test(text)) return false;
  return true;
}

function detectSectionHeader(cells: string[]): ProjectComponent | undefined {
  const joined = cells.filter(Boolean).join(' ').trim();
  if (!joined || joined.length < 6) return undefined;

  const numbered = joined.match(/^(\d+)\s*[-–—.]\s*(.+)$/i);
  const text = numbered ? numbered[2] : joined;
  const comp = resolveComponent(text);
  if (comp) return comp;

  const nonEmpty = cells.filter((c) => c.trim());
  if (nonEmpty.length === 1) return resolveComponent(nonEmpty[0]);

  return undefined;
}

function isHeaderRow(cells: string[]): boolean {
  const lower = cells.map((c) => c.toLowerCase());
  const hasDesc = lower.some((c) => c.includes('description') || c.includes('particulars'));
  const hasQty = lower.some((c) => c === 'qty' || c.includes('qty') || c.includes('quantity'));
  const hasRate = lower.some((c) => c.includes('rate'));
  const hasSn = lower.some((c) => c === 'sn' || c === 's.no' || c === 'sno');
  const hasAmount = lower.some((c) => c.includes('amount') || c.includes('tax'));
  const hasUnit = lower.some((c) => c === 'unit' || c === 'units' || c === 'uom');
  return hasDesc && (hasQty || hasRate || hasSn || hasAmount || hasUnit);
}

function buildHeaderMap(cells: string[]): HeaderMap {
  const map: HeaderMap = {};
  cells.forEach((cell, idx) => {
    const key = normalizeKey(cell);
    if (!key) return;

    if (key === 'sn' || ['s_no', 'sno', 'sl_no', 'sr_no', 'serial', 'serial_no'].includes(key)) {
      map.serial = idx;
    } else if (key.includes('item_code') || (key === 'code' && !key.includes('description'))) {
      map.code = idx;
    } else if (key.includes('description') || key.includes('particulars')) {
      map.description = idx;
    } else if (key === 'unit' || key === 'units' || key === 'uom' || key === 'um'
      || (key.includes('unit') && !key.includes('amount') && !key.includes('community'))) {
      map.unit = idx;
    } else if (key === 'qty' || key === 'r_qty' || key === 'rqty' || key.includes('quantity')
      || (key.includes('qty') && !key.includes('rate'))) {
      map.qty = idx;
    } else if (key.includes('rate')) {
      map.rate = idx;
    } else if (key.includes('amount') || (key.includes('total') && key.includes('tax'))) {
      map.amount = idx;
    } else if (key.includes('component')) {
      map.component = idx;
    } else if (key.includes('scheme')) {
      map.scheme = idx;
    }
  });

  if (map.description === undefined && cells.length >= 6) {
    return { ...STANDARD_HEADER };
  }
  return map;
}

function finalizeAmounts(qty: number, rate: number, amount: number): { qty: number; rate: number; amount: number } {
  if (amount > 0 && rate === 0 && qty > 0) return { qty, rate: amount / qty, amount };
  if (amount > 0 && qty === 0 && rate > 0) return { qty: amount / rate, rate, amount };
  if (amount > 0 && qty === 0 && rate === 0) return { qty: 1, rate: amount, amount };
  return { qty, rate, amount: amount > 0 ? amount : qty * rate };
}

function parseCellsRow(
  cells: string[],
  header: HeaderMap,
  currentComponent: ProjectComponent | undefined,
  sheetName: string,
  sortOrder: number,
): ParsedBoqRow | null {
  const get = (idx?: number) => (idx !== undefined ? String(cells[idx] ?? '').trim() : '');

  let itemCode = get(header.code);
  const description = get(header.description);
  const unit = extractBoqUnit(cells, header);
  let qty = parseNumber(get(header.qty));
  let rate = parseNumber(get(header.rate));
  let amount = parseNumber(get(header.amount));
  const serialRaw = get(header.serial);
  const serialNo = serialRaw ? parseNumber(serialRaw) || undefined : undefined;

  if (!description && !itemCode) return null;
  if (isSummaryRow(description, itemCode)) return null;
  if (description && !isValidBoqDescription(description)) return null;

  const codeLower = (itemCode || description).toLowerCase();
  if (['item code', 'sn', 'item description', 's.no', 'sno'].includes(codeLower)) return null;

  const componentRaw = get(header.component);
  const schemeRaw = get(header.scheme);
  const fhtcOverride = /connection\s*charges?/i.test(description) ? 'fhtc' as ProjectComponent : undefined;
  const component = fhtcOverride
    ?? resolveComponent(componentRaw, currentComponent ? COMPONENT_LABELS[currentComponent] : sheetName)
    ?? currentComponent
    ?? resolveComponent(sheetName);

  ({ qty, rate, amount } = finalizeAmounts(qty, rate, amount));

  if (!description || (qty === 0 && rate === 0 && amount === 0)) return null;

  itemCode = makeItemCode(itemCode, description, component, serialNo, sortOrder);

  return {
    itemCode,
    description,
    unit,
    contractQty: qty,
    rate,
    amount,
    schemeType: resolveSchemeType(schemeRaw, component),
    component,
    sortOrder,
    serialNo,
  };
}

function looksLikeDataRow(cells: string[]): boolean {
  if (cells.length < 3) return false;
  const desc = cells[1] ?? cells[0];
  if (!desc || !isValidBoqDescription(desc)) return false;
  const lower = desc.toLowerCase();
  if (lower.includes('description') || lower.includes('particulars')) return false;
  return true;
}

function parseSheetAsArrays(sheet: XLSX.WorkSheet, sheetName: string): ParsedBoqRow[] {
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1, defval: '' });
  let header: HeaderMap | null = null;
  let currentComponent = resolveComponent(sheetName);
  const items: ParsedBoqRow[] = [];
  let sortOrder = 0;

  for (const row of rows) {
    const cells = row.map((c) => String(c ?? '').trim());
    if (cells.every((c) => !c)) continue;

    if (isHeaderRow(cells)) {
      header = buildHeaderMap(cells);
      continue;
    }

    const section = detectSectionHeader(cells);
    if (section) {
      currentComponent = section;
      continue;
    }

    if (!header) continue;

    const activeHeader = header;

    if (!looksLikeDataRow(cells)) continue;

    sortOrder += 1;
    const parsed = parseCellsRow(cells, activeHeader, currentComponent, sheetName, sortOrder);
    if (parsed) items.push(parsed);
  }

  return items;
}

export function toImportPayload(items: ParsedBoqRow[]): BoqImportPayloadItem[] {
  return items.map((row) => ({
    itemCode: row.itemCode,
    description: row.description,
    unit: row.unit,
    contractQty: row.contractQty,
    rate: row.rate,
    contractAmount: row.amount > 0 ? row.amount : Math.round(row.contractQty * row.rate * 100) / 100,
    schemeType: row.schemeType,
    component: row.component,
    sortOrder: row.sortOrder,
  }));
}

export function groupBoqBySection(items: ParsedBoqRow[]): ParsedBoqSection[] {
  const buckets = new Map<ProjectComponent | 'other', ParsedBoqRow[]>();

  for (const item of items) {
    const key = item.component ?? 'other';
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(item);
  }

  const sections: ParsedBoqSection[] = [];
  let sectionNumber = 0;

  for (const comp of PROJECT_COMPONENT_ORDER) {
    const compItems = buckets.get(comp);
    if (!compItems?.length) continue;
    sectionNumber += 1;
    sections.push({
      component: comp,
      label: COMPONENT_LABELS[comp],
      sectionNumber,
      items: compItems.sort((a, b) => a.sortOrder - b.sortOrder),
    });
    buckets.delete(comp);
  }

  for (const [comp, compItems] of buckets) {
    if (!compItems.length) continue;
    sectionNumber += 1;
    sections.push({
      component: comp,
      label: comp === 'other' ? 'BOQ Items' : comp.replace(/_/g, ' '),
      sectionNumber,
      items: compItems.sort((a, b) => a.sortOrder - b.sortOrder),
    });
  }

  return sections;
}

export async function parseBoqExcel(file: File): Promise<ParsedBoqRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const items: ParsedBoqRow[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    items.push(...parseSheetAsArrays(sheet, sheetName));
  }

  if (!items.length) {
    throw new Error(
      `No BOQ rows found. Expected columns: ${BOQ_TABLE_COLUMNS.join(', ')}`,
    );
  }

  return items;
}

export const BOQ_EXCEL_COLUMNS = [...BOQ_TABLE_COLUMNS];
