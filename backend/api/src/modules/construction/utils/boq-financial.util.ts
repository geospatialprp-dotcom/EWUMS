import { Repository } from 'typeorm';
import { BoqItem } from '../entities/boq-item.entity';

export type BoqFinancialSource = 'l1_contractor' | 'government';

/** Financial progress, reconciliation, and billing use L1 Contractor BOQ when uploaded. */
export async function resolveFinancialBoqSource(
  boqRepo: Repository<BoqItem>,
  tenantId: string,
  projectId: string,
): Promise<BoqFinancialSource> {
  const l1Count = await boqRepo.count({
    where: { tenantId, projectId, isActive: true, boqSource: 'l1_contractor' },
  });
  return l1Count > 0 ? 'l1_contractor' : 'government';
}

export function financialBoqLabel(source: BoqFinancialSource): string {
  return source === 'l1_contractor' ? 'L1 Contractor BOQ' : 'Original / Tender BOQ';
}

export function buildBoqIdToItemCode(items: BoqItem[]): Record<string, string> {
  return Object.fromEntries(items.map((i) => [i.id, i.itemCode]));
}

export function aggregateQtyByItemCode(
  rawRows: Array<{ boq_item_id: string; qty: string | number }>,
  idToItemCode: Record<string, string>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rawRows) {
    const code = idToItemCode[r.boq_item_id];
    if (!code) continue;
    out[code] = (out[code] ?? 0) + Number(r.qty);
  }
  return out;
}

export function maxDprQtyByItemCode(items: BoqItem[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    const qty = Number(item.dprQty);
    if (qty <= 0) continue;
    out[item.itemCode] = Math.max(out[item.itemCode] ?? 0, qty);
  }
  return out;
}

export function financialBoqByItemCode(items: BoqItem[], source: BoqFinancialSource): Record<string, BoqItem> {
  return Object.fromEntries(
    items.filter((i) => i.boqSource === source).map((i) => [i.itemCode, i]),
  );
}

function normalizeBoqMatchKey(description: string): string {
  return description.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Resolve L1 (or tender) BOQ row for billing — MB/DPR may link to tender item id. */
export function resolveFinancialBoqItem(
  linked: BoqItem | null | undefined,
  financialSource: BoqFinancialSource,
  allItems: BoqItem[],
): BoqItem | null {
  if (financialSource === 'government') {
    return linked ?? null;
  }

  const l1Items = allItems.filter((i) => i.boqSource === 'l1_contractor' && i.isActive);
  if (!l1Items.length) return linked ?? null;
  if (!linked) return null;

  const byCode = financialBoqByItemCode(allItems, 'l1_contractor');
  if (byCode[linked.itemCode]) return byCode[linked.itemCode];

  const descKey = normalizeBoqMatchKey(linked.description);
  const byDesc = l1Items.find((i) => normalizeBoqMatchKey(i.description) === descKey);
  if (byDesc) return byDesc;

  if (linked.component && linked.sortOrder) {
    const bySort = l1Items.find(
      (i) => i.component === linked.component && Number(i.sortOrder) === Number(linked.sortOrder),
    );
    if (bySort) return bySort;
  }

  return null;
}
