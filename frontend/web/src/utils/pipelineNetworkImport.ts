import type { Feature, FeatureCollection, Geometry, LineString, MultiLineString, Position } from 'geojson';
import { transform } from 'ol/proj';
import { parseSurveyFiles, to2DGeometry } from './geoImport';

export const PIPELINE_NETWORK_ACCEPT = '.zip,.geojson,.json,.shp,.dbf,.prj';

/** Common projected CRS for Uttarakhand / northern India pipeline SHP imports. */
const PIPELINE_IMPORT_CRS_GUESSES = [
  'EPSG:32644',
  'EPSG:32643',
  'EPSG:7755',
  'EPSG:3857',
] as const;

function isLikelyWgs84LonLat(lon: number, lat: number): boolean {
  return Math.abs(lon) <= 180 && Math.abs(lat) <= 90;
}

function isLikelyUttarakhand(lon: number, lat: number): boolean {
  return lon >= 77 && lon <= 81.5 && lat >= 28.4 && lat <= 31.5;
}

function firstCoordinate(geometry: Geometry): [number, number] | null {
  const coords = (geometry as { coordinates?: unknown }).coordinates;
  if (!coords) return null;

  const walk = (value: unknown): [number, number] | null => {
    if (!Array.isArray(value) || value.length < 2) return null;
    if (typeof value[0] === 'number' && typeof value[1] === 'number') {
      return [Number(value[0]), Number(value[1])];
    }
    return walk(value[0]);
  };

  return walk(coords);
}

function reprojectCoordPair(x: number, y: number, fromEpsg: string): [number, number] | null {
  try {
    const [lon, lat] = transform([x, y], fromEpsg, 'EPSG:4326');
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
    if (!isLikelyWgs84LonLat(lon, lat)) return null;
    return [lon, lat];
  } catch {
    return null;
  }
}

function reprojectCoordinates(coords: unknown, depth: number, fromEpsg: string): unknown {
  if (depth === 0) {
    if (!Array.isArray(coords) || coords.length < 2) return coords;
    return reprojectCoordPair(Number(coords[0]), Number(coords[1]), fromEpsg) ?? coords;
  }
  if (!Array.isArray(coords)) return coords;
  return coords.map((part) => reprojectCoordinates(part, depth - 1, fromEpsg));
}

function geometryCoordDepth(type: string): number {
  switch (type) {
    case 'Point': return 0;
    case 'MultiPoint':
    case 'LineString': return 1;
    case 'MultiLineString':
    case 'Polygon': return 2;
    case 'MultiPolygon': return 3;
    default: return 1;
  }
}

function ensureWgs84Geometry(geometry: Geometry): Geometry {
  const sample = firstCoordinate(geometry);
  if (!sample) return geometry;
  if (isLikelyWgs84LonLat(sample[0], sample[1])) return geometry;

  for (const crs of PIPELINE_IMPORT_CRS_GUESSES) {
    const depth = geometryCoordDepth(geometry.type);
    const reprojected = {
      ...geometry,
      coordinates: reprojectCoordinates(
        (geometry as { coordinates: unknown }).coordinates,
        depth,
        crs,
      ),
    } as Geometry;
    const test = firstCoordinate(reprojected);
    if (test && isLikelyUttarakhand(test[0], test[1])) return reprojected;
    if (test && isLikelyWgs84LonLat(test[0], test[1]) && !isLikelyWgs84LonLat(sample[0], sample[1])) {
      return reprojected;
    }
  }

  return geometry;
}

/** Reproject shapefile / projected imports to WGS84 so map layers and API payloads accept them. */
export function ensureWgs84FeatureCollection(collection: FeatureCollection): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: collection.features.map((feature) => (
      feature.geometry
        ? { ...feature, geometry: ensureWgs84Geometry(feature.geometry) }
        : feature
    )),
  };
}

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


function coordDistanceSq(a: [number, number], b: [number, number]): number {
  const dLon = a[0] - b[0];
  const dLat = a[1] - b[1];
  return dLon * dLon + dLat * dLat;
}

function coordsEqual(a: [number, number], b: [number, number]): boolean {
  return coordKey(a) === coordKey(b);
}

function linePathLengthSq(coords: Position[]): number {
  let len = 0;
  for (let i = 1; i < coords.length; i += 1) {
    len += coordDistanceSq(
      [Number(coords[i - 1][0]), Number(coords[i - 1][1])],
      [Number(coords[i][0]), Number(coords[i][1])],
    );
  }
  return len;
}

function positionToCoord(raw: Position): [number, number] | null {
  if (!Array.isArray(raw) || raw.length < 2) return null;
  return [Number(raw[0]), Number(raw[1])];
}

/** Flatten LineString and MultiLineString features into individual line parts. */
export function flattenLineGeometries(collection: FeatureCollection): LineString[] {
  const lines: LineString[] = [];

  for (const feature of collection.features) {
    const geometry = feature.geometry;
    if (!geometry) continue;

    if (geometry.type === 'LineString') {
      if (geometry.coordinates.length >= 2) lines.push(geometry);
      continue;
    }

    if (geometry.type === 'MultiLineString') {
      for (const part of (geometry as MultiLineString).coordinates) {
        if (part.length >= 2) {
          lines.push({ type: 'LineString', coordinates: part });
        }
      }
    }
  }

  return lines;
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
  return ensureWgs84FeatureCollection(collection);
}

/**
 * Pick distinct start/end for a pipeline network.
 * For multi-segment (possibly disconnected) imports: farthest pair among all segment
 * termini; if those coincide (e.g. closed loop), fall back to bounding-box diagonal
 * vertices; last resort uses first vs last distinct vertex on the longest segment.
 */
export function extractNetworkEndpoints(collection: FeatureCollection): PipelineNetworkEndpoints | null {
  const lines = flattenLineGeometries(collection);
  if (!lines.length) return null;

  const endpointCandidates: [number, number][] = [];
  for (const line of lines) {
    const coords = line.coordinates as Position[];
    if (coords.length < 2) continue;
    const first = positionToCoord(coords[0]);
    const last = positionToCoord(coords[coords.length - 1]);
    if (first) endpointCandidates.push(first);
    if (last) endpointCandidates.push(last);
  }
  if (!endpointCandidates.length) return null;

  let bestStart = endpointCandidates[0];
  let bestEnd = endpointCandidates[Math.min(1, endpointCandidates.length - 1)];
  let bestDist = -1;

  for (let i = 0; i < endpointCandidates.length; i += 1) {
    for (let j = i + 1; j < endpointCandidates.length; j += 1) {
      const dist = coordDistanceSq(endpointCandidates[i], endpointCandidates[j]);
      if (dist > bestDist) {
        bestDist = dist;
        bestStart = endpointCandidates[i];
        bestEnd = endpointCandidates[j];
      }
    }
  }

  if (bestDist <= 0 || coordsEqual(bestStart, bestEnd)) {
    const allVerts: [number, number][] = [];
    for (const line of lines) {
      for (const raw of line.coordinates as Position[]) {
        const coord = positionToCoord(raw);
        if (coord) allVerts.push(coord);
      }
    }
    if (allVerts.length < 2) return null;

    let minLon = Infinity;
    let minLat = Infinity;
    let maxLon = -Infinity;
    let maxLat = -Infinity;
    for (const [lon, lat] of allVerts) {
      minLon = Math.min(minLon, lon);
      minLat = Math.min(minLat, lat);
      maxLon = Math.max(maxLon, lon);
      maxLat = Math.max(maxLat, lat);
    }

    const nearestTo = (target: [number, number]): [number, number] => {
      let nearest = allVerts[0];
      let nearestDist = Infinity;
      for (const vertex of allVerts) {
        const dist = coordDistanceSq(vertex, target);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = vertex;
        }
      }
      return nearest;
    };

    bestStart = nearestTo([minLon, minLat]);
    bestEnd = nearestTo([maxLon, maxLat]);
  }

  if (coordsEqual(bestStart, bestEnd)) {
    const longest = lines.reduce((best, line) => (
      linePathLengthSq(line.coordinates as Position[]) > linePathLengthSq(best.coordinates as Position[])
        ? line
        : best
    ));
    const coords = longest.coordinates as Position[];
    const first = positionToCoord(coords[0]);
    if (!first) return null;
    bestStart = first;
    bestEnd = first;
    for (let i = coords.length - 1; i >= 0; i -= 1) {
      const candidate = positionToCoord(coords[i]);
      if (candidate && !coordsEqual(candidate, bestStart)) {
        bestEnd = candidate;
        break;
      }
    }
  }

  if (coordsEqual(bestStart, bestEnd)) return null;

  return { start: bestStart, end: bestEnd };
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

/** Approximate geodesic length of all LineString parts in a feature collection (meters). */
export function computeNetworkLengthM(collection: FeatureCollection): number {
  const lines = flattenLineGeometries(collection);
  if (!lines.length) return 0;

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusM = 6_371_000;

  let total = 0;
  for (const line of lines) {
    const coords = line.coordinates as Position[];
    for (let i = 1; i < coords.length; i += 1) {
      const [lon1, lat1] = [Number(coords[i - 1][0]), Number(coords[i - 1][1])];
      const [lon2, lat2] = [Number(coords[i][0]), Number(coords[i][1])];
      if (![lon1, lat1, lon2, lat2].every(Number.isFinite)) continue;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a = Math.sin(dLat / 2) ** 2
        + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
      total += 2 * earthRadiusM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
  }
  return total;
}

export type PipelineEndpointRole = 'start' | 'end' | 'node';

export type PipelineEndpointMarker = {
  role: PipelineEndpointRole;
  coordinates: [number, number];
  label: string;
};

const ENDPOINT_KEY_PRECISION = 5;

function coordKey(coord: [number, number]): string {
  return `${coord[0].toFixed(ENDPOINT_KEY_PRECISION)},${coord[1].toFixed(ENDPOINT_KEY_PRECISION)}`;
}

function collectLineStrings(collection: FeatureCollection): LineString[] {
  return flattenLineGeometries(collection);
}

/** Start/end of the network extent (farthest segment termini across all lines). */
export function extractPipelineEndpointMarkers(collection: FeatureCollection): PipelineEndpointMarker[] {
  const endpoints = extractNetworkEndpoints(collection);
  if (!endpoints) return [];
  return [
    { role: 'start', coordinates: endpoints.start, label: 'Network Start' },
    { role: 'end', coordinates: endpoints.end, label: 'Network End' },
  ];
}

/** Junction vertices where two or more line segments meet (optional network nodes). */
export function extractPipelineNetworkNodes(collection: FeatureCollection): PipelineEndpointMarker[] {
  const lines = collectLineStrings(collection);
  if (lines.length < 2) return [];

  const counts = new Map<string, { coord: [number, number]; count: number }>();
  for (const line of lines) {
    for (const raw of line.coordinates as Position[]) {
      if (!Array.isArray(raw) || raw.length < 2) continue;
      const coord: [number, number] = [Number(raw[0]), Number(raw[1])];
      const key = coordKey(coord);
      const existing = counts.get(key);
      if (existing) existing.count += 1;
      else counts.set(key, { coord, count: 1 });
    }
  }

  const endpointKeys = new Set(
    extractPipelineEndpointMarkers(collection).map((m) => coordKey(m.coordinates)),
  );

  const nodes: PipelineEndpointMarker[] = [];
  let nodeIndex = 1;
  for (const { coord, count } of counts.values()) {
    if (count < 2) continue;
    const key = coordKey(coord);
    if (endpointKeys.has(key)) continue;
    nodes.push({
      role: 'node',
      coordinates: coord,
      label: `Node ${nodeIndex}`,
    });
    nodeIndex += 1;
  }
  return nodes;
}

export function endpointMarkerToFeature(marker: PipelineEndpointMarker): Feature {
  const color = marker.role === 'start'
    ? '#16a34a'
    : marker.role === 'end'
      ? '#dc2626'
      : '#64748b';
  const radius = marker.role === 'node' ? 5 : 8;
  return {
    type: 'Feature',
    properties: {
      layer: 'endpoint',
      endpointRole: marker.role,
      label: marker.label,
      markerColor: color,
      pointRadius: radius,
    },
    geometry: { type: 'Point', coordinates: marker.coordinates },
  };
}

export function buildEndpointMarkerFeatures(
  collection: FeatureCollection,
  includeNetworkNodes = false,
): Feature[] {
  const markers = [
    ...extractPipelineEndpointMarkers(collection),
    ...(includeNetworkNodes ? extractPipelineNetworkNodes(collection) : []),
  ];
  return markers.map(endpointMarkerToFeature);
}
