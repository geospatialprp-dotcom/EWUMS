import type { Request } from 'express';

export interface AuditContext {
  ipAddress?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
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

export function formatCoords(latitude: number, longitude: number): string {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

export function formatAuditLocation(parts: {
  place?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}): string | undefined {
  const place = parts.place?.trim() || '';
  const hasCoords =
    typeof parts.latitude === 'number'
    && Number.isFinite(parts.latitude)
    && typeof parts.longitude === 'number'
    && Number.isFinite(parts.longitude);
  const coords = hasCoords ? formatCoords(parts.latitude!, parts.longitude!) : '';
  if (place && coords) return `${place} · ${coords}`;
  if (coords) return coords;
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

export async function resolveIpGeo(ip: string): Promise<IpGeoResult> {
  if (!ip || isPrivateIp(ip)) return {};
  try {
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,city,lat,lon`,
      { signal: AbortSignal.timeout(2500) },
    );
    if (!res.ok) return {};
    const data = (await res.json()) as {
      status?: string;
      country?: string;
      city?: string;
      lat?: number;
      lon?: number;
    };
    if (data.status !== 'success') return {};
    const place = [data.city, data.country].filter(Boolean).join(', ') || undefined;
    const latitude = typeof data.lat === 'number' ? data.lat : undefined;
    const longitude = typeof data.lon === 'number' ? data.lon : undefined;
    return { place, latitude, longitude };
  } catch {
    return {};
  }
}

/** @deprecated use resolveIpGeo — kept for callers expecting a place string */
export async function resolveIpLocation(ip: string): Promise<string | undefined> {
  const geo = await resolveIpGeo(ip);
  return formatAuditLocation(geo);
}
