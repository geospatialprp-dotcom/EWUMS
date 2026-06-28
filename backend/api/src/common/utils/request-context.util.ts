import type { Request } from 'express';

export interface AuditContext {
  ipAddress?: string;
  location?: string;
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
