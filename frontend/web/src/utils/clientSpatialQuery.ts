import booleanContains from '@turf/boolean-contains';
import booleanIntersects from '@turf/boolean-intersects';
import booleanWithin from '@turf/boolean-within';
import buffer from '@turf/buffer';
import { feature as turfFeature } from '@turf/helpers';
import type { SpatialOperation, SpatialQueryMeta, SpatialQueryResponse } from './spatialAnalysis';

type GeoFeatureLike = {
  type: 'Feature';
  id?: string;
  geometry?: { type: string; coordinates: unknown } | null;
  properties?: Record<string, unknown>;
};

function asTurfFeature(item: GeoFeatureLike) {
  if (!item.geometry?.type || item.geometry.coordinates == null) return null;
  return turfFeature(item.geometry as GeoJSON.Geometry, item.properties ?? {});
}

export function runClientSpatialQuery(
  features: GeoFeatureLike[],
  operation: SpatialOperation,
  queryGeometry: object,
  layerId: string,
  layerName: string,
  featureClassName: string,
  geometryType: string,
  bufferMeters = 500,
): SpatialQueryResponse {
  const query = asTurfFeature({ type: 'Feature', geometry: queryGeometry as GeoJSON.Geometry });
  if (!query) {
    return {
      type: 'FeatureCollection',
      features: [],
      meta: {
        operation,
        layerId,
        layerName,
        featureClassName,
        geometryType,
        count: 0,
        distance: operation === 'buffer' ? bufferMeters : null,
      },
    };
  }

  const searchGeometry = operation === 'buffer'
    ? buffer(query, bufferMeters / 1000, { units: 'kilometers', steps: 16 })
    : query;

  const matched = features.filter((item) => {
    const candidate = asTurfFeature(item);
    if (!candidate) return false;

    switch (operation) {
      case 'intersect':
        return booleanIntersects(searchGeometry, candidate);
      case 'within':
        return booleanWithin(candidate, searchGeometry);
      case 'contains':
        return booleanContains(candidate, searchGeometry);
      case 'buffer':
        return booleanIntersects(searchGeometry, candidate);
      default:
        return false;
    }
  });

  const meta: SpatialQueryMeta = {
    operation,
    layerId,
    layerName,
    featureClassName,
    geometryType,
    count: matched.length,
    distance: operation === 'buffer' ? bufferMeters : null,
  };

  return {
    type: 'FeatureCollection',
    features: matched.map((item) => ({
      type: 'Feature' as const,
      id: String(item.id ?? ''),
      geometry: item.geometry as object,
      properties: item.properties ?? {},
    })),
    meta,
  };
}
