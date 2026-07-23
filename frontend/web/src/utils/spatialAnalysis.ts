export type SpatialOperation = 'intersect' | 'within' | 'contains' | 'buffer';

/** ArcMap Select By Location — selection method. */
export type SpatialSelectionMethod =
  | 'create_new'
  | 'add_to'
  | 'remove_from'
  | 'select_from_current';

export const SPATIAL_SELECTION_METHODS: Array<{
  value: SpatialSelectionMethod;
  label: string;
}> = [
  { value: 'create_new', label: 'Create a new selection' },
  { value: 'add_to', label: 'Add to current selection' },
  { value: 'remove_from', label: 'Remove from current selection' },
  { value: 'select_from_current', label: 'Select from currently selected features' },
];

export const SPATIAL_OPERATIONS: Array<{
  value: SpatialOperation;
  label: string;
  description: string;
  drawType: 'Polygon' | 'Point';
}> = [
  {
    value: 'intersect',
    label: 'intersect the source feature',
    description: 'Features that overlap the drawn geometry',
    drawType: 'Polygon',
  },
  {
    value: 'within',
    label: 'are completely within the source feature',
    description: 'Features entirely inside the drawn geometry',
    drawType: 'Polygon',
  },
  {
    value: 'contains',
    label: 'completely contain the source feature',
    description: 'Features that contain the drawn point',
    drawType: 'Point',
  },
  {
    value: 'buffer',
    label: 'are within a distance of the source feature',
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

/** Merge a new spatial query result set with the current selection (ArcMap selection method). */
export function applySpatialSelectionMethod<T extends { id?: string | number | null }>(
  method: SpatialSelectionMethod,
  previous: T[],
  next: T[],
): T[] {
  const featureId = (feature: T) => String(feature.id ?? '');
  const previousIds = new Set(previous.map(featureId));
  const nextIds = new Set(next.map(featureId));

  switch (method) {
    case 'add_to': {
      const byId = new Map(previous.map((feature) => [featureId(feature), feature]));
      for (const feature of next) byId.set(featureId(feature), feature);
      return Array.from(byId.values());
    }
    case 'remove_from':
      return previous.filter((feature) => !nextIds.has(featureId(feature)));
    case 'select_from_current':
      return next.filter((feature) => previousIds.has(featureId(feature)));
    case 'create_new':
    default:
      return next;
  }
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
