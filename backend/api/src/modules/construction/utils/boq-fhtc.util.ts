/** BOQ row fields used for FHTC connection tracking. */
export type FhtcBoqRowLike = {
  component?: string | null;
  description?: string;
  itemCode?: string;
  unit?: string;
  contractQty?: number;
  revisedQty?: number;
  mbQty?: number;
  dprQty?: number;
  rate?: number;
  contractValue?: number;
  revisedValue?: number;
  mbValue?: number;
  remainingQty?: number;
};

/** Standard FHTC connection line from government BOQ templates (e.g. item 1.44 Connection Charges). */
export function isFhtcConnectionChargesRow(row: Pick<FhtcBoqRowLike, 'description' | 'itemCode'>): boolean {
  const desc = String(row.description ?? '').trim();
  if (/connection\s*charges?/i.test(desc)) return true;
  const code = String(row.itemCode ?? '').trim();
  return /(?:^|[-/])1\.44$/i.test(code) || /^1\.44$/i.test(code);
}

/**
 * FHTC progress is driven by the Connection Charges BOQ line when present;
 * otherwise falls back to all items tagged component=fhtc.
 */
export function selectFhtcBoqRows<T extends FhtcBoqRowLike>(rows: T[]): T[] {
  const charges = rows.filter(isFhtcConnectionChargesRow);
  if (charges.length > 0) return charges;
  return rows.filter((r) => r.component === 'fhtc');
}

export function summarizeFhtcBoqRows(rows: FhtcBoqRowLike[]) {
  const target = rows.reduce((s, r) => s + Number(r.revisedQty ?? r.contractQty ?? 0), 0);
  const completed = rows.reduce((s, r) => s + Number(r.mbQty ?? 0), 0);
  const dprDone = rows.reduce((s, r) => s + Number(r.dprQty ?? 0), 0);
  const contractValue = rows.reduce((s, r) => s + Number(r.revisedValue ?? r.contractValue ?? 0), 0);
  const mbValue = rows.reduce((s, r) => s + Number(r.mbValue ?? 0), 0);
  const pct = target > 0
    ? Math.min(100, Math.round((completed / target) * 10000) / 100)
    : 0;
  const primary = rows[0];
  return {
    source: rows.some(isFhtcConnectionChargesRow) ? 'connection_charges' as const : 'fhtc_component' as const,
    targetConnections: Math.round(target * 100) / 100,
    completedConnections: Math.round(completed * 100) / 100,
    dprConnections: Math.round(dprDone * 100) / 100,
    completionPct: pct,
    unit: primary?.unit ?? 'Nos',
    rate: primary?.rate != null ? Math.round(Number(primary.rate) * 100) / 100 : null,
    contractValue: Math.round(contractValue * 100) / 100,
    mbValue: Math.round(mbValue * 100) / 100,
    rows,
  };
}

export function resolveFhtcItemComponent(description: string): 'fhtc' | undefined {
  return /connection\s*charges?/i.test(description.trim()) ? 'fhtc' : undefined;
}
