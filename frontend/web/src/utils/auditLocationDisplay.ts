export type AuditLocationFields = {
  location: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationAccuracyMeters?: number | null;
  details?: Record<string, unknown>;
};

export type AuditLocationPresentation =
  | {
      kind: 'gps';
      address: string | null;
      latitude: number;
      longitude: number;
      accuracyMeters: number | null;
      mapUrl: string;
    }
  | {
      kind: 'approximate';
      label: string;
    }
  | {
      kind: 'unknown';
    };

export function openStreetMapUrl(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`;
}

function extractAddressFromStoredLocation(
  location: string | null,
  lat: number,
  lng: number,
): string | null {
  if (!location) return null;

  const separator = ' · ';
  if (location.includes(separator)) {
    const address = location.split(separator)[0]?.trim();
    if (address) return address;
  }

  const latText = lat.toFixed(6);
  const lngText = lng.toFixed(6);
  if (location.includes(latText) && location.includes(lngText)) {
    return null;
  }

  return location.replace(/\s*\([^)]*\)/g, '').trim() || null;
}

function cleanApproximateLabel(location: string): string {
  return location.replace(/\s*\(approximate[^)]*\)/gi, '').trim() || location;
}

export function normalizeAuditLocationFields(entry: AuditLocationFields): AuditLocationFields {
  const latitude = entry.latitude != null ? Number(entry.latitude) : null;
  const longitude = entry.longitude != null ? Number(entry.longitude) : null;
  const locationAccuracyMeters =
    entry.locationAccuracyMeters != null ? Number(entry.locationAccuracyMeters) : null;

  return {
    ...entry,
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    locationAccuracyMeters: Number.isFinite(locationAccuracyMeters) ? locationAccuracyMeters : null,
  };
}

export function getAuditLocationPresentation(entry: AuditLocationFields): AuditLocationPresentation {
  const normalized = normalizeAuditLocationFields(entry);

  if (normalized.latitude != null && normalized.longitude != null) {
    return {
      kind: 'gps',
      address: extractAddressFromStoredLocation(
        normalized.location,
        normalized.latitude,
        normalized.longitude,
      ),
      latitude: normalized.latitude,
      longitude: normalized.longitude,
      accuracyMeters: normalized.locationAccuracyMeters ?? null,
      mapUrl: openStreetMapUrl(normalized.latitude, normalized.longitude),
    };
  }

  if (normalized.location) {
    return {
      kind: 'approximate',
      label: cleanApproximateLabel(normalized.location),
    };
  }

  return { kind: 'unknown' };
}

function formatGpsLocationLines(pres: Extract<AuditLocationPresentation, { kind: 'gps' }>): string[] {
  const coords = `${pres.latitude.toFixed(6)}, ${pres.longitude.toFixed(6)}`;
  const accuracy = pres.accuracyMeters != null ? ` ±${Math.round(pres.accuracyMeters)} m` : '';
  const lines = ['[GPS]'];
  if (pres.address) lines.push(pres.address);
  lines.push(`${coords}${accuracy}`);
  return lines;
}

export function formatAuditLocationForExport(entry: AuditLocationFields): string {
  const pres = getAuditLocationPresentation(entry);

  if (pres.kind === 'gps') {
    return formatGpsLocationLines(pres).join(' · ');
  }

  if (pres.kind === 'approximate') {
    return `[Approximate] ${pres.label}`;
  }

  return '—';
}

/** Multi-line location text for PDF cells (address + coordinates). */
export function formatAuditLocationForPdf(entry: AuditLocationFields): string {
  const pres = getAuditLocationPresentation(entry);

  if (pres.kind === 'gps') {
    return formatGpsLocationLines(pres).join('\n');
  }

  if (pres.kind === 'approximate') {
    return `[Approximate]\n${pres.label}\nCity-level IP lookup`;
  }

  return '—';
}

/** @deprecated Use getAuditLocationPresentation for UI */
export function formatAuditLocationLabel(entry: AuditLocationFields): string {
  return formatAuditLocationForExport(entry);
}
