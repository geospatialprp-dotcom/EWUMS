import {
  mapsExactLocationUrl,
  parseCoordinatePair,
  parseCoordsFromLocationText,
} from './coordinateFields';

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

export type AuditLocationFields = {
  location?: string | null;
  details?: Record<string, unknown> | null;
};

export type AuditLocationView = {
  text: string;
  mapsUrl: string | null;
  latitude: number | null;
  longitude: number | null;
};

/** Build display text + Google Maps URL for Audit Location column. */
export function resolveAuditLocation(log: AuditLocationFields): AuditLocationView {
  const details = log.details ?? {};
  const fromDetails = parseCoordinatePair(details.latitude, details.longitude);
  const fromText = parseCoordsFromLocationText(log.location ?? undefined);
  const coords = fromDetails ?? fromText;

  const address =
    (typeof details.address === 'string' && details.address.trim())
    || (typeof details.place === 'string' && details.place.trim())
    || '';

  const accuracy = typeof details.accuracyMeters === 'number'
    ? details.accuracyMeters
    : Number(details.accuracyMeters);
  const source = details.locationSource === 'gps' || details.locationSource === 'ip'
    ? details.locationSource
    : (coords ? 'gps' : null);

  let text = '—';
  if (log.location?.includes('\n')) {
    text = log.location;
  } else if (coords) {
    const coordLine = `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`;
    let suffix = '';
    if (source === 'gps' && Number.isFinite(accuracy) && accuracy > 0) {
      suffix = ` (±${Math.round(accuracy)} m GPS)`;
    } else if (source === 'gps') {
      suffix = ' (GPS)';
    } else if (source === 'ip') {
      suffix = ' (IP approx)';
    }
    const place = address || (log.location?.split('\n')[0]?.trim() ?? '');
    text = place ? `${place}\n${coordLine}${suffix}` : `${coordLine}${suffix}`;
  } else if (log.location?.trim()) {
    text = log.location.trim();
  }

  return {
    text,
    mapsUrl: coords ? mapsExactLocationUrl(coords.latitude, coords.longitude) : null,
    latitude: coords?.latitude ?? null,
    longitude: coords?.longitude ?? null,
  };
}
