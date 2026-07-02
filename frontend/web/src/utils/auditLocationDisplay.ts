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

export function getAuditLocationPresentation(entry: AuditLocationFields): AuditLocationPresentation {
  if (entry.latitude != null && entry.longitude != null) {
    return {
      kind: 'gps',
      address: extractAddressFromStoredLocation(entry.location, entry.latitude, entry.longitude),
      latitude: entry.latitude,
      longitude: entry.longitude,
      accuracyMeters: entry.locationAccuracyMeters ?? null,
      mapUrl: openStreetMapUrl(entry.latitude, entry.longitude),
    };
  }

  if (entry.location) {
    return {
      kind: 'approximate',
      label: cleanApproximateLabel(entry.location),
    };
  }

  return { kind: 'unknown' };
}

export function formatAuditLocationForExport(entry: AuditLocationFields): string {
  const pres = getAuditLocationPresentation(entry);

  if (pres.kind === 'gps') {
    const coords = `${pres.latitude.toFixed(6)}, ${pres.longitude.toFixed(6)}`;
    const accuracy = pres.accuracyMeters != null ? ` ±${Math.round(pres.accuracyMeters)} m` : '';
    if (pres.address) return `${pres.address} · ${coords}${accuracy} (GPS)`;
    return `${coords}${accuracy} (GPS)`;
  }

  if (pres.kind === 'approximate') {
    return `${pres.label} (approximate — IP)`;
  }

  return '—';
}

/** @deprecated Use getAuditLocationPresentation for UI */
export function formatAuditLocationLabel(entry: AuditLocationFields): string {
  return formatAuditLocationForExport(entry);
}
