export type AuditLocationFields = {
  location: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationAccuracyMeters?: number | null;
};

export function openStreetMapUrl(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`;
}

export function formatAuditLocationLabel(entry: AuditLocationFields): string {
  if (entry.latitude != null && entry.longitude != null) {
    const accuracy =
      entry.locationAccuracyMeters != null
        ? ` ±${Math.round(entry.locationAccuracyMeters)} m`
        : '';
    return `${entry.latitude.toFixed(6)}, ${entry.longitude.toFixed(6)}${accuracy}`;
  }
  return entry.location ?? '—';
}
