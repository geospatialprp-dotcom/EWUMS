/** Round BOQ grand total to nearest whole rupee (.50 and above rounds up). */
export function roundBoqTotalToNearestRupee(amount: number): number {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

export function formatBoqRoundedRupee(amount: number): string {
  return roundBoqTotalToNearestRupee(amount).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}
