/** Line amount for a BOQ item — matches Excel "Total Amount with Tax" / frontend boqLineAmount. */
export function boqQtyAmount(
  contractQty: number,
  qty: number,
  rate: number,
  contractAmount: number,
): number {
  const stored = Number(contractAmount);
  const baseQty = Number(contractQty);
  const q = Number(qty) || 0;
  if (Number.isFinite(stored) && stored > 0 && baseQty > 0) {
    return Math.round((q / baseQty) * stored * 100) / 100;
  }
  return Math.round(q * Number(rate) * 100) / 100;
}

/** Amount for one RA / invoice line from BOQ (proportional to Excel Total Amount with Tax). */
export function raBillLineAmount(
  contractQty: number,
  billQty: number,
  rate: number,
  contractAmount: number,
): number {
  return boqQtyAmount(contractQty, billQty, rate, contractAmount);
}

/** Unit rate for display on RA lines. */
export function raBillDisplayRate(
  contractQty: number,
  rate: number,
  contractAmount: number,
): number {
  return boqEffectiveRate(contractQty, rate, contractAmount);
}

/** Full contract line amount (Grand Total row for one BOQ item). */
export function boqContractLineAmount(
  contractQty: number,
  rate: number,
  contractAmount: number,
): number {
  const stored = Number(contractAmount);
  if (Number.isFinite(stored) && stored > 0) return stored;
  return Math.round(Number(contractQty) * Number(rate) * 100) / 100;
}

/** Effective unit value derived from stored line amount (for rate display in reports). */
export function boqEffectiveRate(
  contractQty: number,
  rate: number,
  contractAmount: number,
): number {
  const baseQty = Number(contractQty);
  const stored = Number(contractAmount);
  if (Number.isFinite(stored) && stored > 0 && baseQty > 0) {
    return stored / baseQty;
  }
  return Number(rate) || 0;
}

export type BoqVarianceType = 'excess' | 'savings' | 'pending' | 'none';

/** Classify MB vs Revised BOQ variance — savings only when MB is verified (mbQty > 0). */
export function boqVarianceType(mbQty: number, revisedQty: number, mbVariance: number): BoqVarianceType {
  if (mbVariance > 0) return 'excess';
  if (mbQty > 0 && mbVariance < 0) return 'savings';
  if (mbQty === 0 && revisedQty > 0) return 'pending';
  return 'none';
}

/** Qty awaiting first verified MB entry (not counted as savings). */
export function boqPendingMeasurementQty(mbQty: number, revisedQty: number): number {
  return mbQty === 0 && revisedQty > 0 ? revisedQty : 0;
}

/** Verified MB underrun vs Revised BOQ (actual savings). */
export function boqSavingsQty(mbQty: number, mbVariance: number): number {
  return mbQty > 0 && mbVariance < 0 ? Math.abs(mbVariance) : 0;
}

/** Default GST % — BOQ Excel uses "Rate with GST" / "Total Amount with Tax". */
export const BOQ_GST_PERCENT = 18;

/** Extract GST component from a GST-inclusive amount: inclusive × rate / (100 + rate). */
export function gstFromInclusiveAmount(inclusiveAmount: number, gstPercent = BOQ_GST_PERCENT): number {
  const amt = Number(inclusiveAmount) || 0;
  const pct = Number(gstPercent) || 0;
  if (amt <= 0 || pct <= 0) return 0;
  return Math.round(amt * (pct / (100 + pct)) * 100) / 100;
}

/** Pre-GST taxable base from GST-inclusive amount. */
export function taxableBaseFromInclusive(inclusiveAmount: number, gstPercent = BOQ_GST_PERCENT): number {
  return Math.round((Number(inclusiveAmount) - gstFromInclusiveAmount(inclusiveAmount, gstPercent)) * 100) / 100;
}

/** Net payable when gross is GST-inclusive: gross minus recoveries (do not add GST again). */
export function netPayableFromInclusiveGross(grossInclusive: number, recoveries = 0): number {
  return Math.round((Number(grossInclusive) - Number(recoveries)) * 100) / 100;
}
