import type { Request } from 'express';

export interface AuditContext {
  ipAddress?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  locationAccuracyMeters?: number;
  locationSource?: 'gps' | 'ip' | 'header';
}

export interface ResolvedAuditLocation {
  location?: string;
  latitude?: number;
  longitude?: number;
  locationAccuracyMeters?: number;
  locationSource?: 'gps' | 'ip' | 'header';
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
    (req.headers['cf-ipcountry'] as string | undefined) ||
    (req.headers['x-vercel-ip-country'] as string | undefined);
  const city =
    (req.headers['cf-ipcity'] as string | undefined) ||
    (req.headers['x-vercel-ip-city'] as string | undefined);

  const parts = [city, country].filter((v) => v && v !== 'XX');
  if (parts.length) return parts.join(', ');
  if (country && country !== 'XX') return country;
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
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized.startsWith('10.') ||
    normalized.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(normalized)
  );
}

export async function resolveIpLocation(ip: string): Promise<string | undefined> {
  if (!ip || isPrivateIp(ip)) return undefined;
  try {
    const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,city`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { status?: string; country?: string; city?: string };
    if (data.status !== 'success') return undefined;
    const parts = [data.city, data.country].filter(Boolean);
    return parts.length ? parts.join(', ') : undefined;
  } catch {
    return undefined;
  }
}

export function formatGpsCoordinates(lat: number, lng: number, accuracyMeters?: number): string {
  const coords = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  if (typeof accuracyMeters === 'number' && Number.isFinite(accuracyMeters)) {
    return `${coords} (±${Math.round(accuracyMeters)} m GPS)`;
  }
  return `${coords} (GPS)`;
}

export async function reverseGeocodeGps(lat: number, lng: number): Promise<string | undefined> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: { 'User-Agent': 'EGIP-Platform-Audit/1.0 (compliance audit trail)' },
        signal: AbortSignal.timeout(4000),
      },
    );
    if (!res.ok) return undefined;
    const data = (await res.json()) as { display_name?: string };
    return data.display_name?.trim() || undefined;
  } catch {
    return undefined;
  }
}

/** Prefer device GPS; fall back to CDN headers or IP geolocation (approximate). */
export async function resolveAuditLocation(context: AuditContext): Promise<ResolvedAuditLocation> {
  if (typeof context.latitude === 'number' && typeof context.longitude === 'number') {
    const address = await reverseGeocodeGps(context.latitude, context.longitude);
    const coords = formatGpsCoordinates(
      context.latitude,
      context.longitude,
      context.locationAccuracyMeters,
    );
    const location = address ? `${address} · ${coords}` : coords;
    return {
      location,
      latitude: context.latitude,
      longitude: context.longitude,
      locationAccuracyMeters: context.locationAccuracyMeters,
      locationSource: 'gps',
    };
  }

  let location = context.location;
  let locationSource: ResolvedAuditLocation['locationSource'] = location ? 'header' : undefined;

  if (!location && context.ipAddress) {
    location = await resolveIpLocation(context.ipAddress);
    locationSource = location ? 'ip' : undefined;
    if (location) location = `${location} (approximate — IP only)`;
  }

  return { location, locationSource };
}
