/** Deep-link into Map Explorer for a construction GIS asset with GPS coordinates. */

const UTTARAKHAND_LAT_RANGE = [28, 32] as const;
const UTTARAKHAND_LON_RANGE = [77, 82] as const;

/** Fix common mobile GPS lat/lng swap for Uttarakhand field assets. */
export function normalizeConstructionGps(lat: number, lng: number): { lat: number; lng: number } {
  const inLatBand = (v: number) => v >= UTTARAKHAND_LAT_RANGE[0] && v <= UTTARAKHAND_LAT_RANGE[1];
  const inLonBand = (v: number) => v >= UTTARAKHAND_LON_RANGE[0] && v <= UTTARAKHAND_LON_RANGE[1];
  if (inLatBand(lat) && inLonBand(lng)) return { lat, lng };
  if (inLatBand(lng) && inLonBand(lat)) return { lat: lng, lng: lat };
  return { lat, lng };
}

export function readAssetLatitude(asset: Record<string, unknown>): number {
  return Number(asset.latitude ?? asset.lat);
}

export function readAssetLongitude(asset: Record<string, unknown>): number {
  return Number(asset.longitude ?? asset.lng ?? asset.lon);
}

export function buildConstructionAssetMapUrl(options: {
  projectId: string;
  assetCode: string;
  latitude: number;
  longitude: number;
  assetName?: string;
  assetType?: string;
  zoom?: number;
}): string {
  const { lat, lng } = normalizeConstructionGps(options.latitude, options.longitude);
  const params = new URLSearchParams();
  params.set('project', options.projectId);
  params.set('lat', String(lat));
  params.set('lng', String(lng));
  params.set('asset', options.assetCode);
  if (options.assetName?.trim()) {
    params.set('assetName', options.assetName.trim());
  }
  if (options.assetType?.trim()) {
    params.set('assetType', options.assetType.trim());
  }
  params.set('zoom', String(options.zoom ?? 18));
  return `/map?${params.toString()}`;
}

/** Open Map Explorer for a project; focus the only mapped asset or the first one. */
export function buildProjectGisMapExplorerUrl(
  projectId: string,
  assets: Array<{ assetCode?: string; name?: string; assetType?: string; latitude?: unknown; longitude?: unknown }>,
): string {
  const mapped = assets.filter((a) => {
    const lat = readAssetLatitude(a as Record<string, unknown>);
    const lng = readAssetLongitude(a as Record<string, unknown>);
    return Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;
  });
  if (mapped.length >= 1) {
    const a = mapped[0];
    const rec = a as Record<string, unknown>;
    return buildConstructionAssetMapUrl({
      projectId,
      assetCode: String(a.assetCode ?? 'asset'),
      latitude: readAssetLatitude(rec),
      longitude: readAssetLongitude(rec),
      assetName: a.name ? String(a.name) : undefined,
      assetType: a.assetType ? String(a.assetType) : undefined,
    });
  }
  const params = new URLSearchParams();
  params.set('project', projectId);
  return `/map?${params.toString()}`;
}

export type ConstructionAssetMapFocus = {
  assetCode: string;
  assetName?: string;
  assetType?: string;
  lat: number;
  lng: number;
  zoom: number;
};

export function parseConstructionAssetMapFocus(
  searchParams: URLSearchParams,
): ConstructionAssetMapFocus | null {
  const latRaw = Number(searchParams.get('lat') ?? searchParams.get('latitude'));
  const lngRaw = Number(searchParams.get('lng') ?? searchParams.get('longitude'));
  if (!Number.isFinite(latRaw) || !Number.isFinite(lngRaw) || latRaw === 0 || lngRaw === 0) {
    return null;
  }
  const { lat, lng } = normalizeConstructionGps(latRaw, lngRaw);
  const assetCode = searchParams.get('asset') ?? searchParams.get('focusAsset') ?? '';
  const zoomRaw = Number(searchParams.get('zoom'));
  const zoom = Number.isFinite(zoomRaw) && zoomRaw > 0 ? zoomRaw : 18;
  return {
    lat,
    lng,
    assetCode,
    assetName: searchParams.get('assetName') ?? undefined,
    assetType: searchParams.get('assetType') ?? undefined,
    zoom,
  };
}
