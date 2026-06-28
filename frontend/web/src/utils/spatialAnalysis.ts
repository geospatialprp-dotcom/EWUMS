export type SpatialOperation = 'intersect' | 'within' | 'contains' | 'buffer';

export const SPATIAL_OPERATIONS: Array<{
  value: SpatialOperation;
  label: string;
  description: string;
  drawType: 'Polygon' | 'Point';
}> = [
  {
    value: 'intersect',
    label: 'Intersect',
    description: 'Features that overlap the drawn area',
    drawType: 'Polygon',
  },
  {
    value: 'within',
    label: 'Within',
    description: 'Features entirely inside the drawn area',
    drawType: 'Polygon',
  },
  {
    value: 'contains',
    label: 'Contains',
    description: 'Features that contain the drawn point or shape',
    drawType: 'Point',
  },
  {
    value: 'buffer',
    label: 'Buffer',
    description: 'Features within a distance of the drawn point',
    drawType: 'Point',
  },
];

export interface SpatialQueryMeta {
  operation: SpatialOperation;
  layerId: string;
  layerName: string;
  featureClassName: string;
  geometryType: string;
  count: number;
  distance: number | null;
}

export interface SpatialQueryResponse {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    id: string;
    geometry: object;
    properties: Record<string, unknown>;
  }>;
  meta: SpatialQueryMeta;
}
