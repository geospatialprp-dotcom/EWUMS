import * as XLSX from 'xlsx';
import { ImportBoqItemDto } from '../dto/construction.dto';
import { resolveFhtcItemComponent } from './boq-fhtc.util';

type BoqComponent =
  | 'source_development'
  | 'gravity_main'
  | 'pumping_main'
  | 'reservoir'
  | 'distribution'
  | 'fhtc';

const BOQ_SECTIONS: Array<{ component: BoqComponent; label: string; match: (text: string) => boolean }> = [
  {
    component: 'source_development',
    label: 'Source & Treatment Works',
    match: (t) => /source/.test(t) && /treatment/.test(t),
  },
  {
    component: 'reservoir',
    label: 'Storage & Reservoir Works',
    match: (t) => /storage/.test(t) && /reserv/i.test(t),
  },
  {
    component: 'gravity_main',
    label: 'Supply Main / Gravity Main',
    match: (t) => /supply\s*main|gravity\s*main|supply\s*main\s*\/\s*gravity\s*main/.test(t),
  },
  {
    component: 'pumping_main',
    label: 'Pumping Main',
    match: (t) => /pumping\s*main/.test(t) && !/gravity/.test(t),
  },
  {
    component: 'distribution',
    label: 'Distribution System',
    match: (t) => /distribution/.test(t),
  },
  {
    component: 'fhtc',
    label: 'FHTC Connections',
    match: (t) => /fhtc/.test(t),
  },
];

const COMPONENT_ALIASES: Record<string, BoqComponent> = {
  source_development: 'source_development',
  source: 'source_development',
  'source development': 'source_development',
  'source development works': 'source_development',
  'source treatment works': 'source_development',
  'source & treatment works': 'source_development',
  gravity_main: 'gravity_main',
  'gravity main': 'gravity_main',
  'supply main': 'gravity_main',
  'supply main gravity main': 'gravity_main',
  'supply main / gravity main': 'gravity_main',
  pumping_main: 'pumping_main',
  'pumping main': 'pumping_main',
  reservoir: 'reservoir',
  'storage reservoir works': 'reservoir',
  'storage & reservoir works': 'reservoir',
  'storage & reserviour works': 'reservoir',
  distribution: 'distribution',
  'distribution system': 'distribution',
  'distribution network': 'distribution',
  fhtc: 'fhtc',
};

const KNOWN_UNIT_PATTERN = /^(nos?|no\.?s\.?|cum|c\.?u\.?m\.?|rmt|r\.?m\.?t\.?|rm|qtl|quintal)$/i;

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export function normalizeBoqUnit(raw: string): string {
  const cleaned = raw.trim();
  if (!cleaned) return '';
  const key = cleaned.toLowerCase().replace(/\./g, '').replace(/\s+/g, '');
  const aliases: Record<string, string> = {
    nos: 'Nos',
    no: 'Nos',
    cum: 'cum',
    cumt: 'cum',
    rmt: 'Rmt',
    rm: 'Rmt',
    qtl: 'Qtl',
    quintal: 'Qtl',
  };
  return aliases[key] ?? cleaned;
}

function looksLikeUnit(value: string): boolean {
  const v = String(value ?? '').trim();
  if (!v || v.length > 20) return false;
  if (/^\d+([.,]\d+)?$/.test(v)) return false;
  return KNOWN_UNIT_PATTERN.test(v) || /^[a-zA-Z]{2,5}$/.test(v);
}

function resolveUnitColumn(map: Record<string, number>, cells: string[]): number | undefined {
  if (map.unit !== undefined) return map.unit;

  if (map.qty !== undefined) {
    const afterQty = map.qty + 1;
    if (map.rate !== afterQty && map.amount !== afterQty && looksLikeUnit(cells[afterQty])) {
      return afterQty;
    }
  }

  if (map.qty !== undefined && map.rate !== undefined && map.rate > map.qty + 1) {
    for (let i = map.qty + 1; i < map.rate; i += 1) {
      if (looksLikeUnit(cells[i])) return i;
    }
  }

  if (map.qty === 2 && looksLikeUnit(cells[3])) return 3;

  return undefined;
}

function extractUnit(cells: string[], map: Record<string, number>): string {
  const idx = resolveUnitColumn(map, cells);
  if (idx !== undefined) {
    const unit = normalizeBoqUnit(String(cells[idx] ?? ''));
    if (unit) return unit;
  }
  return 'Nos';
}

function parseNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const cleaned = String(value ?? '').replace(/[,₹\s]/g, '').trim();
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function resolveComponentFromText(raw: string): BoqComponent | undefined {
  const stripped = raw.replace(/^\d+[\s\-–—.]+/i, '').trim();
  for (const candidate of [raw, stripped]) {
    const key = normalizeText(candidate);
    if (COMPONENT_ALIASES[key]) return COMPONENT_ALIASES[key];
    for (const section of BOQ_SECTIONS) {
      if (section.match(key)) return section.component;
    }
  }
  return undefined;
}

function detectSectionHeader(cells: string[]): { component: BoqComponent; label: string; sectionNumber?: number } | null {
  const joined = cells.filter(Boolean).join(' ').trim();
  if (!joined || joined.length < 6) return null;

  const numbered = joined.match(/^(\d+)\s*[-–—.]\s*(.+)$/i);
  const body = numbered ? numbered[2].trim() : joined;
  const sectionNumber = numbered ? Number(numbered[1]) : undefined;
  const normalized = normalizeText(body);

  for (const section of BOQ_SECTIONS) {
    if (section.match(normalized) || section.match(normalizeText(joined))) {
      return { component: section.component, label: body, sectionNumber };
    }
  }

  const alias = resolveComponentFromText(body);
  if (alias) return { component: alias, label: body, sectionNumber };

  const nonEmpty = cells.filter((c) => c.trim());
  if (nonEmpty.length === 1) {
    const single = resolveComponentFromText(nonEmpty[0]);
    if (single) return { component: single, label: nonEmpty[0].trim(), sectionNumber };
  }

  return null;
}

function isHeaderRow(cells: string[]): boolean {
  const lower = cells.map((c) => c.toLowerCase());
  const hasDesc = lower.some((c) => c.includes('description') || c.includes('particulars'));
  const hasQty = lower.some((c) => c.includes('qty') || c.includes('quantity'));
  const hasRate = lower.some((c) => c.includes('rate'));
  const hasSn = lower.some((c) => c === 'sn' || c === 's.no');
  const hasUnit = lower.some((c) => c === 'unit' || c === 'units' || c === 'uom');
  return hasDesc && (hasQty || hasRate || hasSn || hasUnit);
}

function buildHeaderMap(cells: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  cells.forEach((cell, idx) => {
    const key = normalizeKey(cell);
    const raw = cell.trim().toLowerCase();
    if (!key) return;
    if (key === 'sn' || ['s_no', 'sno', 'sl_no', 'sr_no'].includes(key)) {
      map.serial = idx;
    } else if ((key.includes('sor') && key.includes('code')) || raw === 'sor code') {
      map.sor_code = idx;
    } else if (key.includes('description') || key.includes('particulars')) {
      map.description = idx;
    } else if (key === 'unit' || key === 'units' || key === 'uom' || key === 'um'
      || (key.includes('unit') && !key.includes('amount') && !key.includes('community'))) {
      map.unit = idx;
    } else if (key === 'r_qty' || key === 'rqty' || key.includes('qty') || key.includes('quantity')) {
      map.qty = idx;
    } else if (key.includes('rate')) {
      map.rate = idx;
    } else if (key === 'dsr' || raw === 'dsr') {
      map.dsr = idx;
    } else if (key === 'ujn' || raw === 'ujn') {
      map.ujn = idx;
    } else if (/sor.*pwd|pwd.*sor|sor_pwd/.test(key) || /sor\s*\(?\s*pwd\s*\)?/i.test(raw)) {
      map.sor_pwd = idx;
    } else if (key === 'nsi' || raw === 'nsi') {
      map.nsi = idx;
    } else if ((key.includes('total') && key.includes('amount')) || raw === 'total amount') {
      map.total_amount = idx;
    } else if (key.includes('amount') || (key.includes('total') && key.includes('tax'))) {
      map.amount = idx;
    }
  });
  return map;
}

function isTharaliLayout(map: Record<string, number>): boolean {
  return map.ujn !== undefined
    || (map.dsr !== undefined && map.total_amount !== undefined);
}

function lineAmountFromRow(cells: string[], map: Record<string, number>): number {
  if (isTharaliLayout(map)) {
    if (map.total_amount !== undefined) {
      const total = parseNumber(cells[map.total_amount]);
      if (total > 0) return total;
    }
    if (map.ujn !== undefined) {
      const ujn = parseNumber(cells[map.ujn]);
      if (ujn > 0) return ujn;
    }
  }
  return parseNumber(map.amount !== undefined ? cells[map.amount] : 0);
}

function finalizeAmounts(qty: number, rate: number, amount: number) {
  if (amount > 0 && qty > 0) {
    const unitRate = Math.round((amount / qty) * 100) / 100;
    return { qty, rate: unitRate, amount };
  }
  if (amount > 0 && rate === 0 && qty > 0) return { qty, rate: amount / qty, amount };
  if (amount > 0 && qty === 0 && rate > 0) return { qty: amount / rate, rate, amount };
  if (amount > 0 && qty === 0 && rate === 0) return { qty: 1, rate: amount, amount };
  if (rate > 0 && qty > 0 && amount === 0) {
    return { qty, rate, amount: Math.round(qty * rate * 100) / 100 };
  }
  return { qty, rate, amount: amount > 0 ? amount : qty * rate };
}

function isSummaryRow(description: string): boolean {
  const t = description.toLowerCase();
  return t.includes('grand total') || t.includes('section total') || t.includes('total amount');
}

function isValidBoqDescription(description: string): boolean {
  const text = description.trim();
  if (text.length < 4) return false;
  if (!/[a-zA-Z]/.test(text)) return false;
  if (/^\d+(\.\d+)?$/.test(text)) return false;
  if (resolveComponentFromText(text)) return false;
  return true;
}

function resolveSchemeType(component?: BoqComponent): 'gravity' | 'pumping' {
  return component === 'pumping_main' ? 'pumping' : 'gravity';
}

export function parseBoqExcelBuffer(buffer: Buffer): ImportBoqItemDto[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const items: ImportBoqItemDto[] = [];
  let sortOrder = 0;
  let currentComponent: BoqComponent | undefined;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1, defval: '' });
    let header: Record<string, number> | null = null;

    for (const row of rows) {
      const cells = row.map((c) => String(c ?? '').trim());
      if (cells.every((c) => !c)) continue;

      if (isHeaderRow(cells)) {
        header = buildHeaderMap(cells);
        continue;
      }

      const section = detectSectionHeader(cells);
      if (section) {
        currentComponent = section.component;
        continue;
      }

      if (!header) continue;

      const h = header;
      const get = (k: string) => (h[k] !== undefined ? String(cells[h[k]] ?? '').trim() : '');

      const description = get('description');
      if (!description || isSummaryRow(description)) continue;
      if (!isValidBoqDescription(description)) continue;
      if (['sn', 'item description', 'item code'].includes(description.toLowerCase())) continue;

      let qty = parseNumber(get('qty'));
      let rate = parseNumber(get('rate'));
      let amount = lineAmountFromRow(cells, h);
      ({ qty, rate, amount } = finalizeAmounts(qty, rate, amount));
      if (qty === 0 && rate === 0 && amount === 0) continue;

      sortOrder += 1;
      const serialRaw = get('serial') || (h.sor_code !== undefined ? String(cells[h.sor_code] ?? '').trim() : '');
      const serialLabel = serialRaw || String(sortOrder);
      const prefix = sheetName.replace(/[^a-z]/gi, '').slice(0, 3).toUpperCase() || 'BOQ';
      const component = resolveFhtcItemComponent(description)
        ?? currentComponent
        ?? resolveComponentFromText(sheetName);

      items.push({
        itemCode: `${prefix}-${serialLabel.replace(/\s+/g, '')}`,
        description,
        unit: extractUnit(cells, h),
        contractQty: qty,
        rate,
        contractAmount: amount > 0 ? amount : Math.round(qty * rate * 100) / 100,
        schemeType: resolveSchemeType(component),
        component,
        sortOrder,
      });
    }
  }

  return items;
}
