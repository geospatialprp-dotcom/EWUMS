export interface GeocodeResult {
  id: string;
  label: string;
  lon: number;
  lat: number;
  /** WGS 84 bounds: [west, south, east, north] */
  bbox?: [number, number, number, number];
  placeType?: string;
}

export function zoomForPlaceType(placeType?: string): number {
  switch (placeType) {
    case 'country':
      return 6;
    case 'state':
    case 'region':
      return 8;
    case 'county':
    case 'district':
      return 10;
    case 'city':
    case 'town':
      return 12;
    case 'village':
    case 'suburb':
    case 'neighbourhood':
      return 14;
    default:
      return 12;
  }
}

function formatPlaceLabel(properties: Record<string, unknown>): string {
  const name = properties.name as string | undefined;
  const parts = [
    name,
    properties.city as string | undefined,
    properties.state as string | undefined,
    properties.country as string | undefined,
  ].filter((part, index, list) => part && list.indexOf(part) === index);

  return parts.join(', ') || name || 'Unknown place';
}

function extentToBbox(extent: number[]): [number, number, number, number] | undefined {
  if (extent.length !== 4) return undefined;
  const [minLon, maxLat, maxLon, minLat] = extent;
  if (![minLon, maxLat, maxLon, minLat].every(Number.isFinite)) return undefined;
  return [minLon, minLat, maxLon, maxLat];
}

export async function searchPlaces(
  query: string,
  signal?: AbortSignal,
  bounds?: [number, number, number, number],
): Promise<GeocodeResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', trimmed);
  url.searchParams.set('limit', '8');
  url.searchParams.set('lang', 'en');
  if (bounds) {
    const [west, south, east, north] = bounds;
    url.searchParams.set('bbox', `${west},${south},${east},${north}`);
  }

  const response = await fetch(url.toString(), { signal });
  if (!response.ok) {
    throw new Error('Place search failed');
  }

  const data = await response.json() as {
    features?: Array<{
      geometry?: { coordinates?: [number, number] };
      properties?: Record<string, unknown>;
    }>;
  };

  const results: GeocodeResult[] = [];

  (data.features ?? []).forEach((feature, index) => {
    const coords = feature.geometry?.coordinates;
    if (!coords || coords.length < 2) return;

    const [lon, lat] = coords;
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;

    const properties = feature.properties ?? {};
    const extent = properties.extent;
    const bbox = Array.isArray(extent) ? extentToBbox(extent as number[]) : undefined;

    results.push({
      id: `${lon.toFixed(5)},${lat.toFixed(5)},${index}`,
      label: formatPlaceLabel(properties),
      lon,
      lat,
      bbox,
      placeType: properties.osm_value as string | undefined,
    });
  });

  return results;
}
