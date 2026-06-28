export type ElevationSource = 'open-meteo' | 'open-elevation' | 'usgs';

export type ElevationResult = {
  elevation: number;
  source: ElevationSource;
  unit: 'm';
};

export const ELEVATION_SOURCE_LABELS: Record<ElevationSource, string> = {
  'open-meteo': 'Copernicus DEM',
  'open-elevation': 'SRTM',
  usgs: 'USGS 3DEP',
};

const cache = new Map<string, ElevationResult>();
const CACHE_PRECISION = 4;

function cacheKey(lat: number, lon: number) {
  return `${lat.toFixed(CACHE_PRECISION)},${lon.toFixed(CACHE_PRECISION)}`;
}

function isUsCoverage(lat: number, lon: number) {
  return lat >= 24.5 && lat <= 49.5 && lon >= -125 && lon <= -66.5;
}

async function fetchOpenMeteo(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<ElevationResult | null> {
  const url = new URL('https://api.open-meteo.com/v1/elevation');
  url.searchParams.set('latitude', lat.toFixed(6));
  url.searchParams.set('longitude', lon.toFixed(6));

  const response = await fetch(url, { signal });
  if (!response.ok) return null;

  const data = await response.json() as { elevation?: number[] };
  const elevation = data.elevation?.[0];
  if (typeof elevation !== 'number' || !Number.isFinite(elevation)) return null;

  return { elevation, source: 'open-meteo', unit: 'm' };
}

async function fetchOpenElevation(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<ElevationResult | null> {
  const url = new URL('https://api.open-elevation.com/api/v1/lookup');
  url.searchParams.set('locations', `${lat.toFixed(6)},${lon.toFixed(6)}`);

  const response = await fetch(url, { signal });
  if (!response.ok) return null;

  const data = await response.json() as { results?: Array<{ elevation?: number }> };
  const elevation = data.results?.[0]?.elevation;
  if (typeof elevation !== 'number' || !Number.isFinite(elevation)) return null;

  return { elevation, source: 'open-elevation', unit: 'm' };
}

async function fetchUsgs(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<ElevationResult | null> {
  if (!isUsCoverage(lat, lon)) return null;

  const url = new URL('https://epqs.nationalmap.gov/v1/json');
  url.searchParams.set('x', lon.toFixed(6));
  url.searchParams.set('y', lat.toFixed(6));
  url.searchParams.set('wkid', '4326');
  url.searchParams.set('units', 'Meters');

  const response = await fetch(url, { signal });
  if (!response.ok) return null;

  const data = await response.json() as { value?: number | string };
  const elevation = typeof data.value === 'number' ? data.value : Number(data.value);
  if (!Number.isFinite(elevation)) return null;

  return { elevation, source: 'usgs', unit: 'm' };
}

const SOURCE_CHAIN: Array<(lat: number, lon: number, signal?: AbortSignal) => Promise<ElevationResult | null>> = [
  fetchOpenMeteo,
  fetchOpenElevation,
  fetchUsgs,
];

export async function lookupElevation(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<ElevationResult | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const key = cacheKey(lat, lon);
  const cached = cache.get(key);
  if (cached) return cached;

  const orderedSources = isUsCoverage(lat, lon)
    ? [fetchUsgs, fetchOpenMeteo, fetchOpenElevation]
    : SOURCE_CHAIN;

  for (const fetchSource of orderedSources) {
    try {
      const result = await fetchSource(lat, lon, signal);
      if (result) {
        cache.set(key, result);
        return result;
      }
    } catch (error) {
      if (signal?.aborted) throw error;
    }
  }

  return null;
}

export function formatElevation(elevation: number) {
  return `${Math.round(elevation).toLocaleString()} m`;
}
