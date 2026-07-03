/** Sum BOQ line amounts in paise to avoid floating-point drift. */
export function sumBoqAmounts(amounts: number[]): number {
  const totalPaise = amounts.reduce((sum, amount) => {
    const paise = Math.round(Number(amount) * 100);
    return Number.isFinite(paise) ? sum + paise : sum;
  }, 0);
  return totalPaise / 100;
}

/** Round BOQ total to nearest whole rupee (.50 and above rounds up). */
export function roundBoqTotalToNearestRupee(amount: number): number {
  const paise = Math.round(Number(amount) * 100);
  if (!Number.isFinite(paise)) return 0;
  const rupees = Math.trunc(paise / 100);
  const fraction = Math.abs(paise % 100);
  if (fraction >= 50) return rupees + (paise >= 0 ? 1 : -1);
  return rupees;
}

export function formatBoqRoundedRupee(amount: number): string {
  return roundBoqTotalToNearestRupee(amount).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export function formatBoqAmount(amount: number): string {
  return Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
