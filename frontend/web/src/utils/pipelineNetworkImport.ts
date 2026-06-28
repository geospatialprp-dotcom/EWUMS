import type { Feature, FeatureCollection, Geometry, LineString, Point, Position } from 'geojson';
import { parseSurveyFiles, to2DGeometry } from './geoImport';

export const PIPELINE_NETWORK_ACCEPT = '.zip,.geojson,.json,.shp,.dbf,.prj';

export type PipelineNetworkSummary = {
  featureCount: number;
  geometryLabel: string;
  pointCount: number;
  lineCount: number;
  polygonCount: number;
};

export type PipelineNetworkEndpoints = {
  start: [number, number];
  end: [number, number];
};

function isLineGeometry(geometry: Geometry): geometry is LineString {
  return geometry.type === 'LineString';
}

function lineVertexCount(geometry: LineString): number {
  return geometry.coordinates.length;
}

export function summarizePipelineNetwork(collection: FeatureCollection): PipelineNetworkSummary {
  let pointCount = 0;
  let lineCount = 0;
  let polygonCount = 0;

  for (const feature of collection.features) {
    const type = feature.geometry?.type;
    if (type === 'Point' || type === 'MultiPoint') pointCount += 1;
    else if (type === 'LineString' || type === 'MultiLineString') lineCount += 1;
    else if (type === 'Polygon' || type === 'MultiPolygon') polygonCount += 1;
  }

  const kinds = [
    pointCount ? 'Point' : '',
    lineCount ? 'LineString' : '',
    polygonCount ? 'Polygon' : '',
  ].filter(Boolean);

  const geometryLabel = kinds.length > 1 ? 'Mixed' : (kinds[0] ?? 'Unknown');

  return {
    featureCount: collection.features.length,
    geometryLabel,
    pointCount,
    lineCount,
    polygonCount,
  };
}

export function parsedFeaturesToCollection(features: Array<{ geometry?: { type: string; coordinates: unknown } | null; properties?: Record<string, unknown> }>): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: features.flatMap((feature, index) => {
      if (!feature?.geometry?.type || feature.geometry.coordinates == null) return [];
      return [{
        type: 'Feature' as const,
        properties: feature.properties ?? { source: 'imported_pipeline', index },
        geometry: to2DGeometry(feature.geometry) as Geometry,
      }];
    }),
  };
}

export async function parsePipelineNetworkFiles(files: File[]): Promise<FeatureCollection> {
  const parsed = await parseSurveyFiles(files, 'Any');
  if (!parsed.length) {
    throw new Error('No geometries found in the uploaded file.');
  }
  const collection = parsedFeaturesToCollection(parsed);
  if (!collection.features.length) {
    throw new Error('No valid geometries found in the uploaded file.');
  }
  return collection;
}

export function extractNetworkEndpoints(collection: FeatureCollection): PipelineNetworkEndpoints | null {
  const lines = collection.features
    .map((feature) => feature.geometry)
    .filter((geometry): geometry is LineString => !!geometry && isLineGeometry(geometry));

  if (!lines.length) return null;

  const longest = lines.reduce((best, line) => (
    lineVertexCount(line) > lineVertexCount(best) ? line : best
  ));

  const coords = longest.coordinates as Position[];
  if (coords.length < 2) return null;

  const start = coords[0];
  const end = coords[coords.length - 1];
  if (!Array.isArray(start) || !Array.isArray(end) || start.length < 2 || end.length < 2) return null;

  return {
    start: [Number(start[0]), Number(start[1])],
    end: [Number(end[0]), Number(end[1])],
  };
}

export function groupFeaturesByGeometryType(collection: FeatureCollection): {
  points: Feature[];
  lines: Feature[];
  polygons: Feature[];
} {
  const points: Feature[] = [];
  const lines: Feature[] = [];
  const polygons: Feature[] = [];

  for (const feature of collection.features) {
    const type = feature.geometry?.type;
    if (type === 'Point' || type === 'MultiPoint') points.push(feature);
    else if (type === 'LineString' || type === 'MultiLineString') lines.push(feature);
    else if (type === 'Polygon' || type === 'MultiPolygon') polygons.push(feature);
  }

  return { points, lines, polygons };
}

export function toFeatureCollection(features: Feature[]): FeatureCollection {
  return { type: 'FeatureCollection', features };
}
