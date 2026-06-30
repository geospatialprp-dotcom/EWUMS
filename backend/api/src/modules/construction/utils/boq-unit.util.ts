const KNOWN_UNIT_PATTERN = /^(nos?|no\.?s\.?|cum|c\.?u\.?m\.?|rmt|r\.?m\.?t\.?|rm|qtl|quintal)$/i;

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

export function looksLikeUnit(value: string): boolean {
  const v = String(value ?? '').trim();
  if (!v || v.length > 20) return false;
  if (/^\d+([.,]\d+)?$/.test(v)) return false;
  return KNOWN_UNIT_PATTERN.test(v) || /^[a-zA-Z]{2,5}$/.test(v);
}

export type BoqUnitHeaderMap = Record<string, number>;

/** Resolve Unit column index — by header or by position between Qty and Rate. */
export function resolveUnitColumn(map: BoqUnitHeaderMap, cells: string[]): number | undefined {
  if (map.unit !== undefined) return map.unit;

  if (map.qty !== undefined) {
    const afterQty = map.qty + 1;
    if (map.rate !== afterQty && map.amount !== afterQty && map.total_amount !== afterQty
      && looksLikeUnit(cells[afterQty])) {
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

export function extractBoqUnit(cells: string[], map: BoqUnitHeaderMap): string {
  const idx = resolveUnitColumn(map, cells);
  if (idx !== undefined) {
    const unit = normalizeBoqUnit(String(cells[idx] ?? ''));
    if (unit) return unit;
  }
  return '';
}

/** Column indices that must never be treated as amount/qty/rate in numeric scans. */
export function nonAmountColumnIndices(map: BoqUnitHeaderMap): Set<number> {
  const skip = new Set<number>();
  for (const key of ['serial', 'description', 'sor_code', 'unit', 'qty', 'rate'] as const) {
    if (map[key] !== undefined) skip.add(map[key]);
  }
  return skip;
}

export function isUnitHeaderKey(key: string, raw: string): boolean {
  return key === 'unit' || key === 'units' || key === 'uom' || key === 'um'
    || (key.includes('unit') && !key.includes('amount') && !key.includes('community'));
}
