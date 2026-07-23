import type { Request } from 'express';

export interface AuditContext {
  ipAddress?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  /** GPS accuracy radius in metres (browser Geolocation). */
  accuracyMeters?: number;
}

export function getClientIp(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() || undefined;
  }
  if (Array.isArray(forwarded)) {
    return forwarded[0]?.split(',')[0]?.trim() || undefined;
  }
  return req.ip || req.socket?.remoteAddress || undefined;
}

export function getLocationFromHeaders(req: Request): string | undefined {
  const country =
    (req.headers['cf-ipcountry'] as string | undefined)
    || (req.headers['x-vercel-ip-country'] as string | undefined);
  const city =
    (req.headers['cf-ipcity'] as string | undefined)
    || (req.headers['x-vercel-ip-city'] as string | undefined);

  const parts = [city, country].filter((v) => v && v !== 'XX');
  if (parts.length) return parts.join(', ');
  if (country && country !== 'XX') return country;
  return undefined;
}

export function formatCoords(latitude: number, longitude: number): string {
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

/**
 * Audit Location column format (matches ops expectation):
 *   Bhurgaon, Dehradun, Uttarakhand, 248001, India
 *   30.321794, 78.003398 (±94 m GPS)
 */
export function formatAuditLocation(parts: {
  place?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  accuracyMeters?: number | null;
  source?: 'gps' | 'ip' | null;
}): string | undefined {
  const place = parts.place?.trim() || '';
  const hasCoords =
    typeof parts.latitude === 'number'
    && Number.isFinite(parts.latitude)
    && typeof parts.longitude === 'number'
    && Number.isFinite(parts.longitude);
  const coords = hasCoords ? formatCoords(parts.latitude!, parts.longitude!) : '';

  let accuracy = '';
  if (
    parts.source === 'gps'
    && typeof parts.accuracyMeters === 'number'
    && Number.isFinite(parts.accuracyMeters)
    && parts.accuracyMeters > 0
  ) {
    accuracy = ` (±${Math.round(parts.accuracyMeters)} m GPS)`;
  } else if (parts.source === 'gps' && coords) {
    accuracy = ' (GPS)';
  } else if (parts.source === 'ip' && coords) {
    accuracy = ' (IP approx)';
  }

  const coordLine = coords ? `${coords}${accuracy}` : '';
  if (place && coordLine) return `${place}\n${coordLine}`;
  if (coordLine) return coordLine;
  if (place) return place;
  return undefined;
}

export function extractAuditContext(req: Request): AuditContext {
  const ipAddress = getClientIp(req);
  return {
    ipAddress,
    location: getLocationFromHeaders(req),
  };
}

export function isPrivateIp(ip: string): boolean {
  const normalized = ip.replace(/^::ffff:/, '');
  return (
    normalized === '127.0.0.1'
    || normalized === '::1'
    || normalized.startsWith('10.')
    || normalized.startsWith('192.168.')
    || /^172\.(1[6-9]|2\d|3[01])\./.test(normalized)
  );
}

export type IpGeoResult = {
  place?: string;
  latitude?: number;
  longitude?: number;
};

function joinAddressParts(parts: Array<string | undefined | null>): string | undefined {
  const cleaned = parts
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter((p) => p.length > 0);
  // de-dupe consecutive repeats
  const unique: string[] = [];
  for (const part of cleaned) {
    if (unique[unique.length - 1]?.toLowerCase() !== part.toLowerCase()) {
      unique.push(part);
    }
  }
  return unique.length ? unique.join(', ') : undefined;
}

export async function resolveIpGeo(ip: string): Promise<IpGeoResult> {
  if (!ip || isPrivateIp(ip)) return {};
  try {
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,regionName,city,zip,lat,lon`,
      { signal: AbortSignal.timeout(2500) },
    );
    if (!res.ok) return {};
    const data = (await res.json()) as {
      status?: string;
      country?: string;
      regionName?: string;
      city?: string;
      zip?: string;
      lat?: number;
      lon?: number;
    };
    if (data.status !== 'success') return {};
    const place = joinAddressParts([data.city, data.regionName, data.zip, data.country]);
    const latitude = typeof data.lat === 'number' ? data.lat : undefined;
    const longitude = typeof data.lon === 'number' ? data.lon : undefined;
    return { place, latitude, longitude };
  } catch {
    return {};
  }
}

/** Reverse-geocode GPS to a postal-style address (Nominatim). */
export async function reverseGeocodeAddress(
  latitude: number,
  longitude: number,
): Promise<string | undefined> {
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(String(latitude))}`
      + `&lon=${encodeURIComponent(String(longitude))}&zoom=18&addressdetails=1`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(3000),
      headers: {
        Accept: 'application/json',
        'User-Agent': 'EWUMS-AuditTrail/1.0 (ujs; contact=ops@ewumsujs.com)',
      },
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as {
      display_name?: string;
      address?: Record<string, string>;
    };
    const a = data.address ?? {};
    const locality =
      a.suburb
      || a.neighbourhood
      || a.village
      || a.hamlet
      || a.city_district
      || a.county;
    const city = a.city || a.town || a.municipality || a.county;
    const place = joinAddressParts([
      locality && locality !== city ? locality : undefined,
      city,
      a.state,
      a.postcode,
      a.country,
    ]);
    return place || data.display_name?.split(',').slice(0, 5).join(',').trim();
  } catch {
    return undefined;
  }
}

/** @deprecated use resolveIpGeo */
export async function resolveIpLocation(ip: string): Promise<string | undefined> {
  const geo = await resolveIpGeo(ip);
  return formatAuditLocation({ ...geo, source: 'ip' });
}
