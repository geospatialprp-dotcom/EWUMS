import booleanWithin from '@turf/boolean-within';
import { feature as turfFeature } from '@turf/helpers';

type GeoGeometry = {
  type: string;
  coordinates: unknown;
};

type DistrictBoundaryCollection = {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: GeoGeometry;
    properties?: Record<string, unknown>;
  }>;
};

export const OUTSIDE_JURISDICTION_MESSAGE =
  'This location is outside your authorized district boundary.';

export const OUTSIDE_DISTRICT_LAYER_MESSAGE =
  'This layer is outside your authorized district boundary and cannot be opened in Map Explorer.';

export function geometryWithinDistrictBoundaries(
  geometry: GeoGeometry | null | undefined,
  districtBoundaries: DistrictBoundaryCollection | null | undefined,
): boolean {
  if (!geometry?.type || geometry.coordinates == null) return false;
  if (!districtBoundaries?.features?.length) return true;

  const subject = turfFeature(geometry as GeoJSON.Geometry);
  return districtBoundaries.features.some((boundary) => {
    if (!boundary.geometry?.type) return false;
    const district = turfFeature(boundary.geometry as GeoJSON.Geometry);
    return booleanWithin(subject, district);
  });
}

export function jurisdictionRestrictedForAccess(
  access: { canViewAllDivisions?: boolean; jurisdictionRestricted?: boolean } | null | undefined,
): boolean {
  if (!access) return false;
  if (access.canViewAllDivisions) return false;
  return Boolean(access.jurisdictionRestricted ?? true);
}
