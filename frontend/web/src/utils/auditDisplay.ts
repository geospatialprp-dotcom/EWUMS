/**
 * Audit Trail "Details" / Division cell — show division name only (clean ops UX).
 * Email, coords, and other meta live in User / Location columns.
 */
export function formatAuditDivisionDetail(
  details: Record<string, unknown> | null | undefined,
): string {
  if (!details || typeof details !== 'object') return '—';

  const raw =
    details.divisionName
    ?? details.division
    ?? details.division_name;

  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  return '—';
}
