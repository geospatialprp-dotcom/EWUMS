/** Deep-link into Map Explorer for a construction GIS asset with GPS coordinates. */
export function buildConstructionAssetMapUrl(options: {
  projectId: string;
  assetCode: string;
  latitude: number;
  longitude: number;
  assetName?: string;
  assetType?: string;
  zoom?: number;
}): string {
  const params = new URLSearchParams();
  params.set('project', options.projectId);
  params.set('lat', String(options.latitude));
  params.set('lng', String(options.longitude));
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
    const lat = Number(a.latitude);
    const lng = Number(a.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;
  });
  if (mapped.length >= 1) {
    const a = mapped[0];
    return buildConstructionAssetMapUrl({
      projectId,
      assetCode: String(a.assetCode ?? 'asset'),
      latitude: Number(a.latitude),
      longitude: Number(a.longitude),
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
  const lat = Number(searchParams.get('lat'));
  const lng = Number(searchParams.get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0 || lng === 0) {
    return null;
  }
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
