/** Compact INR for KPI tiles (Indian numbering). Full amount via tooltip when needed. */
export function formatCompactInr(amount: number | null | undefined): { display: string; full: string } {
  const n = Number(amount ?? 0);
  const full = `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  if (n >= 1_00_00_000) return { display: `₹${(n / 1_00_00_000).toFixed(2)} Cr`, full };
  if (n >= 1_00_000) return { display: `₹${(n / 1_00_000).toFixed(2)} L`, full };
  return { display: full, full };
}
