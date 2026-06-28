import GeoJSON from 'ol/format/GeoJSON';
import KML from 'ol/format/KML';
import WKT from 'ol/format/WKT';
import type Feature from 'ol/Feature';
import type { Geometry } from 'ol/geom';
import GeometryCollection from 'ol/geom/GeometryCollection';

export const SURVEY_IMPORT_ACCEPT = '.csv,.kml,.kmz,.zip,.shp,.dbf,.prj,.geojson,.json,.txt';

export const SURVEY_IMPORT_FORMATS_HELP =
  'CSV (points with lat/lon columns, or WKT column for lines/polygons), KML/KMZ, GeoJSON, or Shapefile (.zip archive or select .shp + .dbf + .prj together).';

export type SurveyGeometryType = 'Point' | 'LineString' | 'Polygon' | 'Any';

export type ParsedSurveyFeature = {
  geometry: { type: string; coordinates: unknown };
  properties: Record<string, unknown>;
  label: string;
};

const LAT_KEYS = ['lat', 'latitude', 'y', 'northing'];
const LON_KEYS = ['lon', 'lng', 'long', 'longitude', 'x', 'easting'];
const WKT_KEYS = ['wkt', 'geometry', 'geom', 'the_geom', 'shape', 'wkt_geom'];

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function isLikelyLatLonSwap(x: number, y: number): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  // India / South Asia surveys: lat 5-40, lon 60-100 stored as lat,lon by mistake
  if (x >= 5 && x <= 40 && y >= 60 && y <= 100) return true;
  // General: first value looks like latitude, second like longitude
  if (Math.abs(x) <= 40 && Math.abs(y) > 40 && Math.abs(y) <= 180) return true;
  return false;
}

function fixCoordinatePair(coord: number[]): number[] {
  if (coord.length < 2) return coord;
  let [x, y] = coord;
  if (isLikelyLatLonSwap(x, y)) [x, y] = [y, x];
  return [x, y];
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

function fixGeometryCoordinates(geometry: { type: string; coordinates: unknown }) {
  const depth = geometryCoordDepth(geometry.type);

  const fixDeep = (coords: unknown, level: number): unknown => {
    if (level === 0) return fixCoordinatePair(coords as number[]);
    return (coords as unknown[]).map((part) => fixDeep(part, level - 1));
  };

  return {
    type: geometry.type,
    coordinates: fixDeep(geometry.coordinates, depth),
  };
}

export function summarizeGeometry(geometry: { type: string; coordinates: unknown }) {
  const { type, coordinates } = geometry;

  if (type === 'Point' && Array.isArray(coordinates) && coordinates.length >= 2) {
    const [lon, lat] = coordinates as number[];
    return {
      summary: `${lon.toFixed(5)}°, ${lat.toFixed(5)}°`,
      vertexCount: 1,
      valid: Math.abs(lon) <= 180 && Math.abs(lat) <= 90,
    };
  }

  if (type === 'LineString' && Array.isArray(coordinates)) {
    const line = coordinates as number[][];
    const mid = line[Math.floor(line.length / 2)] ?? line[0];
    return {
      summary: mid
        ? `Line · ${line.length} vertices · ~${mid[0]?.toFixed(5)}°, ${mid[1]?.toFixed(5)}°`
        : `Line · ${line.length} vertices`,
      vertexCount: line.length,
      valid: line.every((c) => Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90),
    };
  }

  if (type === 'Polygon' && Array.isArray(coordinates)) {
    const ring = (coordinates as number[][][])[0] ?? [];
    const centroid = ringCentroid(ring);
    return {
      summary: centroid
        ? `Polygon · ${ring.length} vertices · ~${centroid[0].toFixed(5)}°, ${centroid[1].toFixed(5)}°`
        : `Polygon · ${ring.length} vertices`,
      vertexCount: ring.length,
      valid: ring.every((c) => Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90),
    };
  }

  return { summary: type, vertexCount: 0, valid: false };
}

export function to2DGeometry(geometry: { type: string; coordinates: unknown }) {
  return simplifyImportGeometry({
    type: geometry.type,
    coordinates: stripZCoordinates(geometry.coordinates, geometryCoordDepth(geometry.type)),
  });
}

function stripZCoordinates(coords: unknown, level: number): unknown {
  const round = (value: number) => Math.round(value * 1e6) / 1e6;
  if (level === 0) {
    const pair = coords as number[];
    return pair.length >= 2 ? [round(pair[0]), round(pair[1])] : pair;
  }
  return (coords as unknown[]).map((part) => stripZCoordinates(part, level - 1));
}

/** Reduce dense polygon rings so import payloads stay within server limits. */
export function simplifyImportGeometry(geometry: { type: string; coordinates: unknown }) {
  const maxRingPoints = 1500;

  const decimateRing = (ring: number[][]): number[][] => {
    if (ring.length <= maxRingPoints) return ring;
    const step = Math.ceil((ring.length - 1) / (maxRingPoints - 1));
    const out: number[][] = [];
    for (let i = 0; i < ring.length; i += step) out.push(ring[i]);
    const last = ring[ring.length - 1];
    const tail = out[out.length - 1];
    if (!tail || tail[0] !== last[0] || tail[1] !== last[1]) out.push(last);
    return out;
  };

  if (geometry.type === 'Polygon' && Array.isArray(geometry.coordinates)) {
    return {
      type: 'Polygon',
      coordinates: (geometry.coordinates as number[][][]).map((ring) => decimateRing(ring)),
    };
  }

  if (geometry.type === 'MultiPolygon' && Array.isArray(geometry.coordinates)) {
    return {
      type: 'MultiPolygon',
      coordinates: (geometry.coordinates as number[][][][]).map(
        (polygon) => polygon.map((ring) => decimateRing(ring)),
      ),
    };
  }

  if (geometry.type === 'LineString' && Array.isArray(geometry.coordinates)) {
    const line = geometry.coordinates as number[][];
    if (line.length <= maxRingPoints) return geometry;
    const step = Math.ceil((line.length - 1) / (maxRingPoints - 1));
    const out: number[][] = [];
    for (let i = 0; i < line.length; i += step) out.push(line[i]);
    const last = line[line.length - 1];
    const tail = out[out.length - 1];
    if (!tail || tail[0] !== last[0] || tail[1] !== last[1]) out.push(last);
    return { type: 'LineString', coordinates: out };
  }

  return geometry;
}

function geometrySignature(geometry: { type: string; coordinates: unknown }) {
  return JSON.stringify(to2DGeometry(geometry));
}

function dedupeParsedFeatures(features: ParsedSurveyFeature[]) {
  const seen = new Set<string>();
  return features.filter((feature) => {
    const key = geometrySignature(feature.geometry);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function coordsEqual(a: number[], b: number[]) {
  return Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
}

function closeRing(ring: number[][]): number[][] {
  if (ring.length < 3) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (coordsEqual(first, last)) return ring;
  return [...ring, [...first]];
}

function finalizePolygonFromKml(geometry: { type: string; coordinates: unknown }) {
  const rings = geometry.coordinates as number[][][];
  return {
    type: 'Polygon',
    coordinates: rings.map((ring) => closeRing(ring)),
  };
}

function finalizePolygon(geometry: { type: string; coordinates: unknown }) {
  const rings = geometry.coordinates as number[][][];
  return {
    type: 'Polygon',
    coordinates: rings.map((ring) => closeRing(ring.map((c) => fixCoordinatePair(c)))),
  };
}

function expandGeometriesForType(
  geometry: { type: string; coordinates: unknown },
  expectedType: SurveyGeometryType,
  fromKml = false,
): Array<{ type: string; coordinates: unknown }> {
  const fixed = fromKml ? geometry : fixGeometryCoordinates(geometry);

  // 'Any' (mixed) layers keep each feature's native geometry without coercion,
  // expanding Multi* collections into individual single-part geometries.
  if (expectedType === 'Any') {
    if (fixed.type === 'MultiPoint') return expandGeometriesForType(fixed, 'Point', fromKml);
    if (fixed.type === 'MultiLineString') return expandGeometriesForType(fixed, 'LineString', fromKml);
    if (fixed.type === 'MultiPolygon') return expandGeometriesForType(fixed, 'Polygon', fromKml);
    if (fixed.type === 'Point' || fixed.type === 'LineString') return [fixed];
    if (fixed.type === 'Polygon') {
      return [fromKml ? finalizePolygonFromKml(fixed) : finalizePolygon(fixed)];
    }
    return [];
  }

  if (expectedType === 'Point' && fixed.type === 'MultiPoint') {
    const coords = fixed.coordinates as number[][];
    return coords.map((coord) => ({
      type: 'Point',
      coordinates: fromKml ? [coord[0], coord[1]] : fixCoordinatePair(coord),
    }));
  }

  if (expectedType === 'LineString' && fixed.type === 'MultiLineString') {
    const lines = fixed.coordinates as number[][][];
    return lines.map((line) => ({
      type: 'LineString',
      coordinates: fromKml ? line.map((c) => [c[0], c[1]]) : line.map((c) => fixCoordinatePair(c)),
    }));
  }

  if (expectedType === 'Polygon' && fixed.type === 'MultiPolygon') {
    const polygons = fixed.coordinates as number[][][][];
    return polygons.map((poly) => (
      fromKml
        ? finalizePolygonFromKml({ type: 'Polygon', coordinates: poly })
        : finalizePolygon({ type: 'Polygon', coordinates: poly })
    ));
  }

  const normalized = deriveGeometryForType(fixed, expectedType);
  if (!normalized) return [];

  if (expectedType === 'Polygon' && normalized.type === 'Polygon') {
    return [fromKml ? finalizePolygonFromKml(normalized) : finalizePolygon(normalized)];
  }

  return [normalized];
}

function normalizeGeometry(
  geometry: { type: string; coordinates: unknown },
  expectedType: SurveyGeometryType,
): { type: string; coordinates: unknown } | null {
  const results = expandGeometriesForType(geometry, expectedType);
  return results[0] ?? null;
}

function normalizeGeometries(
  geometry: { type: string; coordinates: unknown },
  expectedType: SurveyGeometryType,
  fromKml = false,
): Array<{ type: string; coordinates: unknown }> {
  return expandGeometriesForType(geometry, expectedType, fromKml);
}

function geometryToGeoJson(geometry: Geometry) {
  return new GeoJSON().writeGeometryObject(geometry, {
    dataProjection: 'EPSG:4326',
    featureProjection: 'EPSG:4326',
  }) as {
    type: string;
    coordinates: unknown;
  };
}

function flattenGeometries(geometry: Geometry): Geometry[] {
  if (geometry.getType() === 'GeometryCollection') {
    return (geometry as GeometryCollection)
      .getGeometries()
      .flatMap((child) => flattenGeometries(child));
  }
  return [geometry];
}

function ringCentroid(ring: number[][]) {
  if (!ring.length) return null;
  let sumX = 0;
  let sumY = 0;
  let count = 0;
  ring.forEach((coord) => {
    if (coord.length >= 2 && Number.isFinite(coord[0]) && Number.isFinite(coord[1])) {
      sumX += coord[0];
      sumY += coord[1];
      count += 1;
    }
  });
  if (!count) return null;
  return [sumX / count, sumY / count];
}

function lineMidpoint(coords: number[][]) {
  if (!coords.length) return null;
  if (coords.length === 1) return coords[0];
  const mid = Math.floor(coords.length / 2);
  return coords[mid];
}

function deriveGeometryForType(
  geometry: { type: string; coordinates: unknown },
  expectedType: SurveyGeometryType,
): { type: string; coordinates: unknown } | null {
  const { type, coordinates } = geometry;

  if (type === expectedType) return geometry;

  if (expectedType === 'Point') {
    if (type === 'MultiPoint') {
      const coords = coordinates as number[][];
      if (coords.length > 0) return { type: 'Point', coordinates: coords[0] };
    }
    if (type === 'LineString') {
      const coords = coordinates as number[][];
      const point = lineMidpoint(coords);
      if (point) return { type: 'Point', coordinates: point };
    }
    if (type === 'MultiLineString') {
      const lines = coordinates as number[][][];
      const point = lines.length ? lineMidpoint(lines[0]) : null;
      if (point) return { type: 'Point', coordinates: point };
    }
    if (type === 'Polygon') {
      const rings = coordinates as number[][][];
      const point = rings.length ? ringCentroid(rings[0]) : null;
      if (point) return { type: 'Point', coordinates: point };
    }
    if (type === 'MultiPolygon') {
      const polygons = coordinates as number[][][][];
      const point = polygons.length && polygons[0].length
        ? ringCentroid(polygons[0][0])
        : null;
      if (point) return { type: 'Point', coordinates: point };
    }
  }

  if (expectedType === 'LineString') {
    if (type === 'MultiLineString') {
      const lines = coordinates as number[][][];
      if (lines.length > 0) return { type: 'LineString', coordinates: lines[0] };
    }
    if (type === 'Polygon') {
      const rings = coordinates as number[][][];
      if (rings.length > 0) return { type: 'LineString', coordinates: rings[0] };
    }
  }

  if (expectedType === 'Polygon') {
    if (type === 'MultiPolygon') {
      const polygons = coordinates as number[][][][];
      if (polygons.length > 0) return { type: 'Polygon', coordinates: polygons[0] };
    }
    if (type === 'LineString') {
      const coords = coordinates as number[][];
      if (coords.length >= 3) {
        return { type: 'Polygon', coordinates: [coords] };
      }
    }
    if (type === 'LinearRing') {
      const ring = coordinates as number[][];
      if (ring.length >= 3) {
        return { type: 'Polygon', coordinates: [ring] };
      }
    }
  }

  return null;
}

function collectGeometryTypes(geometries: Array<{ type: string }>) {
  return [...new Set(geometries.map((geometry) => geometry.type))];
}

function cleanProperties(properties: Record<string, unknown>) {
  const cleaned = { ...properties };
  delete cleaned.geometry;
  Object.keys(cleaned).forEach((key) => {
    if (key.startsWith('_') || key === 'draw' || key === 'visibility') {
      delete cleaned[key];
    }
  });
  return cleaned;
}

function featureLabel(properties: Record<string, unknown> | null | undefined, index: number) {
  return String(
    properties?.name
    ?? properties?.Name
    ?? properties?.description
    ?? properties?.Description
    ?? `Survey ${index + 1}`,
  );
}

function parseFeatureGeometries(
  feature: Feature,
  index: number,
  expectedType: SurveyGeometryType,
  foundTypes: Set<string>,
  preserveCoordinates = false,
): ParsedSurveyFeature[] {
  const geometry = feature.getGeometry();
  if (!geometry) return [];

  const properties = cleanProperties(feature.getProperties());
  const results: ParsedSurveyFeature[] = [];

  flattenGeometries(geometry).forEach((part, partIndex) => {
    const geoJson = geometryToGeoJson(part);
    foundTypes.add(geoJson.type);
    normalizeGeometries(geoJson, expectedType, preserveCoordinates).forEach((normalized) => {
      results.push({
        label: featureLabel(properties, index + partIndex),
        geometry: normalized,
        properties,
      });
    });
  });

  return results;
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  values.push(current.trim());
  return values;
}

function findColumnIndex(headers: string[], candidates: string[]) {
  const normalized = headers.map(normalizeKey);
  for (const candidate of candidates) {
    const index = normalized.indexOf(candidate);
    if (index >= 0) return index;
  }
  return -1;
}

const wktFormat = new WKT();

function parseWktGeometry(wkt: string) {
  try {
    const geometry = wktFormat.readGeometry(wkt.trim(), {
      dataProjection: 'EPSG:4326',
      featureProjection: 'EPSG:4326',
    });
    return geometryToGeoJson(geometry);
  } catch {
    return null;
  }
}

function rowPropertiesFromCsv(
  headers: string[],
  values: string[],
  skipIndexes: number[],
) {
  const properties: Record<string, unknown> = {};
  headers.forEach((header, index) => {
    if (skipIndexes.includes(index)) return;
    if (values[index] !== undefined && values[index] !== '') {
      properties[header] = values[index];
    }
  });
  return properties;
}

function parseCsvSurvey(text: string, expectedType: SurveyGeometryType): ParsedSurveyFeature[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error('CSV file must include a header row and at least one survey record.');

  const headers = parseCsvLine(lines[0]);
  const wktIndex = findColumnIndex(headers, WKT_KEYS);
  const latIndex = findColumnIndex(headers, LAT_KEYS);
  const lonIndex = findColumnIndex(headers, LON_KEYS);

  const parsed: ParsedSurveyFeature[] = [];
  const foundTypes = new Set<string>();

  if (wktIndex >= 0) {
    for (let rowIndex = 1; rowIndex < lines.length; rowIndex += 1) {
      const values = parseCsvLine(lines[rowIndex]);
      const wkt = values[wktIndex]?.trim();
      if (!wkt) continue;

      const geometry = parseWktGeometry(wkt);
      if (!geometry) continue;

      const properties = rowPropertiesFromCsv(headers, values, [wktIndex]);
      foundTypes.add(geometry.type);
      normalizeGeometries(geometry, expectedType).forEach((normalized) => {
        parsed.push({
          label: String(properties.name ?? properties.id ?? `Survey ${rowIndex}`),
          geometry: normalized,
          properties,
        });
      });
    }

    if (!parsed.length) {
      const found = [...foundTypes];
      throw new Error(
        found.length
          ? `No valid ${expectedType} geometries found in CSV WKT column. File contains: ${found.join(', ')}.`
          : 'No valid geometries found in CSV WKT column.',
      );
    }
    return dedupeParsedFeatures(parsed);
  }

  if (expectedType !== 'Point' && expectedType !== 'Any') {
    throw new Error(
      'CSV lines and polygons require a WKT column (e.g. wkt, geometry). For points, use lat/lon columns or a WKT column.',
    );
  }

  if (latIndex < 0 || lonIndex < 0) {
    throw new Error('CSV must include latitude and longitude columns (e.g. lat, lon), or a WKT column.');
  }

  for (let rowIndex = 1; rowIndex < lines.length; rowIndex += 1) {
    const values = parseCsvLine(lines[rowIndex]);
    const lat = Number(values[latIndex]);
    const lon = Number(values[lonIndex]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const properties = rowPropertiesFromCsv(headers, values, [latIndex, lonIndex]);
    parsed.push({
      label: String(properties.name ?? properties.id ?? `Survey ${rowIndex}`),
      geometry: { type: 'Point', coordinates: [lon, lat] },
      properties,
    });
  }

  if (!parsed.length) throw new Error('No valid survey points found in CSV.');
  return dedupeParsedFeatures(parsed);
}

type RawGeoJsonFeature = {
  type?: string;
  geometry?: { type: string; coordinates: unknown };
  properties?: Record<string, unknown>;
};

function parseRawGeoJsonFeatures(
  rawFeatures: RawGeoJsonFeature[],
  expectedType: SurveyGeometryType,
  sourceLabel = 'file',
): ParsedSurveyFeature[] {
  const parsed: ParsedSurveyFeature[] = [];
  const foundTypes = new Set<string>();

  rawFeatures.forEach((feature, index) => {
    if (!feature?.geometry) return;
    const properties = { ...(feature.properties ?? {}) };
    foundTypes.add(feature.geometry.type);
    // GeoJSON and shapefiles already use lon,lat order — do not apply survey swap heuristics.
    normalizeGeometries(feature.geometry, expectedType, true).forEach((normalized) => {
      parsed.push({
        label: String(properties.name ?? properties.label ?? `Feature ${index + 1}`),
        geometry: normalized,
        properties,
      });
    });
  });

  if (!parsed.length) {
    const found = collectGeometryTypes([...foundTypes].map((type) => ({ type })));
    throw new Error(
      found.length
        ? `No valid ${expectedType} geometries found. ${sourceLabel} contains: ${found.join(', ')}.`
        : `No valid ${expectedType} geometries found in ${sourceLabel}.`,
    );
  }
  return dedupeParsedFeatures(parsed);
}

function parseGeoJsonSurvey(text: string, expectedType: SurveyGeometryType): ParsedSurveyFeature[] {
  const data = JSON.parse(text) as {
    type?: string;
    features?: RawGeoJsonFeature[];
    geometry?: { type: string; coordinates: unknown };
    properties?: Record<string, unknown>;
  };

  const rawFeatures = data.type === 'FeatureCollection'
    ? data.features ?? []
    : data.type === 'Feature'
      ? [data]
      : data.geometry
        ? [{ type: 'Feature', geometry: data.geometry, properties: data.properties ?? {} }]
        : [];

  return parseRawGeoJsonFeatures(rawFeatures, expectedType, 'GeoJSON file');
}

async function readKmlFromArchive(buffer: ArrayBuffer): Promise<string> {
  const { unzip } = await import('but-unzip');
  const items = unzip(new Uint8Array(buffer));
  const kmlItem = items.find((item) => /\.kml$/i.test(item.filename));
  if (!kmlItem) {
    throw new Error('Archive does not contain a .kml file.');
  }
  const kmlBytes = await kmlItem.read();
  return new TextDecoder().decode(kmlBytes);
}

async function parseZipSurvey(
  buffer: ArrayBuffer,
  expectedType: SurveyGeometryType,
): Promise<ParsedSurveyFeature[]> {
  try {
    return await parseShapefileSurvey(buffer, expectedType);
  } catch {
    const kmlText = await readKmlFromArchive(buffer);
    return parseKmlSurvey(kmlText, expectedType);
  }
}

async function parseKmzSurvey(
  buffer: ArrayBuffer,
  expectedType: SurveyGeometryType,
): Promise<ParsedSurveyFeature[]> {
  const kmlText = await readKmlFromArchive(buffer);
  return parseKmlSurvey(kmlText, expectedType);
}

async function loadShapefileParser() {
  const module = await import('shpjs');
  return module.default;
}

async function parseShapefileGeoJson(
  geojson: {
    features?: RawGeoJsonFeature[];
  } | Array<{ features?: RawGeoJsonFeature[] }>,
  expectedType: SurveyGeometryType,
): Promise<ParsedSurveyFeature[]> {
  const collections = (Array.isArray(geojson) ? geojson : [geojson])
    .filter((collection): collection is { features?: RawGeoJsonFeature[] } => !!collection);
  const rawFeatures = collections.flatMap((collection) => collection.features ?? [])
    .filter((feature): feature is RawGeoJsonFeature => !!feature);
  return parseRawGeoJsonFeatures(rawFeatures, expectedType, 'shapefile');
}

async function parseShapefileFromFiles(
  files: File[],
  expectedType: SurveyGeometryType,
): Promise<ParsedSurveyFeature[]> {
  const byExtension = (extension: string) => files.find(
    (file) => file.name.toLowerCase().endsWith(extension),
  );

  const shpFile = byExtension('.shp');
  if (!shpFile) {
    throw new Error('Shapefile import requires a .shp file. Include .dbf and .prj when available.');
  }

  const input: {
    shp: ArrayBuffer;
    dbf?: ArrayBuffer;
    prj?: string;
    cpg?: string;
  } = {
    shp: await shpFile.arrayBuffer(),
  };

  const dbfFile = byExtension('.dbf');
  const prjFile = byExtension('.prj');
  const cpgFile = byExtension('.cpg');
  if (dbfFile) input.dbf = await dbfFile.arrayBuffer();
  if (prjFile) input.prj = await prjFile.text();
  if (cpgFile) input.cpg = await cpgFile.text();

  const getShapefile = await loadShapefileParser();
  const geojson = await getShapefile(input);
  return parseShapefileGeoJson(geojson, expectedType);
}

async function parseShapefileSurvey(
  buffer: ArrayBuffer,
  expectedType: SurveyGeometryType,
): Promise<ParsedSurveyFeature[]> {
  const getShapefile = await loadShapefileParser();
  const geojson = await getShapefile(buffer);
  return parseShapefileGeoJson(geojson, expectedType);
}

function parseKmlCoordinates(value: string): number[][] {
  return value
    .trim()
    .split(/\s+/)
    .map((chunk) => chunk.split(',').map(Number))
    .filter((coord) => coord.length >= 2 && Number.isFinite(coord[0]) && Number.isFinite(coord[1]))
    .map((coord) => [coord[0], coord[1]]);
}

function parseCoordinatesText(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .map((chunk) => chunk.split(',').map(Number))
    .filter((coord) => coord.length >= 2 && Number.isFinite(coord[0]) && Number.isFinite(coord[1]));
}

function geometryFromKmlCoordinates(type: string, coordsText: string | null | undefined) {
  if (!coordsText) return null;
  const coords = parseKmlCoordinates(coordsText);
  if (!coords.length) return null;

  // KML is always longitude, latitude — preserve order exactly as written in the file.
  if (type === 'Point') {
    return { type: 'Point', coordinates: coords[0] };
  }
  if (type === 'LineString') {
    return { type: 'LineString', coordinates: coords };
  }
  if (type === 'Polygon' || type === 'LinearRing') {
    return { type: 'Polygon', coordinates: [coords] };
  }
  return null;
}

function geometryFromCoordinates(type: string, coordsText: string | null | undefined) {
  if (!coordsText) return null;
  const coords = parseCoordinatesText(coordsText);
  if (!coords.length) return null;

  if (type === 'Point') {
    return { type: 'Point', coordinates: fixCoordinatePair(coords[0]) };
  }
  if (type === 'LineString') {
    return { type: 'LineString', coordinates: coords.map((c) => fixCoordinatePair(c)) };
  }
  if (type === 'Polygon' || type === 'LinearRing') {
    return { type: 'Polygon', coordinates: [coords.map((c) => fixCoordinatePair(c))] };
  }
  return null;
}

function extractGeometriesFromNode(node: Element): Array<{ type: string; coordinates: unknown }> {
  const results: Array<{ type: string; coordinates: unknown }> = [];
  const tag = node.localName ?? node.tagName;

  if (tag === 'MultiGeometry') {
    Array.from(node.children).forEach((child) => {
      results.push(...extractGeometriesFromNode(child));
    });
    return results;
  }

  if (tag === 'Point' || tag === 'LineString') {
    const coordsText = node.getElementsByTagName('coordinates')[0]?.textContent;
    const geometry = geometryFromKmlCoordinates(tag, coordsText);
    if (geometry) results.push(geometry);
    return results;
  }

  if (tag === 'LinearRing') {
    const coordsText = node.getElementsByTagName('coordinates')[0]?.textContent;
    const geometry = geometryFromKmlCoordinates('Polygon', coordsText);
    if (geometry) results.push(geometry);
    return results;
  }

  if (tag === 'Polygon') {
    const ring = node.getElementsByTagName('outerBoundaryIs')[0]
      ?? node.getElementsByTagName('LinearRing')[0]
      ?? node;
    const coordsText = ring.getElementsByTagName('coordinates')[0]?.textContent
      ?? node.getElementsByTagName('coordinates')[0]?.textContent;
    const geometry = geometryFromKmlCoordinates('Polygon', coordsText);
    if (geometry) results.push(geometry);
    return results;
  }

  return results;
}

function parseKmlDomFallback(text: string, expectedType: SurveyGeometryType): ParsedSurveyFeature[] {
  const doc = new DOMParser().parseFromString(text, 'text/xml');
  if (doc.getElementsByTagName('parsererror').length) return [];

  const placemarks = Array.from(doc.getElementsByTagName('Placemark'));
  const parsed: ParsedSurveyFeature[] = [];

  placemarks.forEach((placemark, index) => {
    const properties: Record<string, unknown> = {};
    const nameNode = placemark.getElementsByTagName('name')[0];
    if (nameNode?.textContent) properties.name = nameNode.textContent.trim();

    placemark.querySelectorAll('ExtendedData Data').forEach((node) => {
      const key = node.getAttribute('name');
      const value = node.getElementsByTagName('value')[0]?.textContent?.trim();
      if (key && value) properties[key] = value;
    });

    placemark.querySelectorAll('SimpleData').forEach((node) => {
      const key = node.getAttribute('name');
      const value = node.textContent?.trim();
      if (key && value) properties[key] = value;
    });

    const candidates: Array<{ type: string; coordinates: unknown }> = [];
    const multi = placemark.getElementsByTagName('MultiGeometry')[0];
    if (multi) {
      candidates.push(...extractGeometriesFromNode(multi));
    } else {
      ['Point', 'LineString', 'Polygon'].forEach((kind) => {
        Array.from(placemark.getElementsByTagName(kind)).forEach((node) => {
          candidates.push(...extractGeometriesFromNode(node));
        });
      });
    }

    candidates.forEach((candidate, candidateIndex) => {
      normalizeGeometries(candidate, expectedType, true).forEach((normalized) => {
        parsed.push({
          label: featureLabel(properties, index + candidateIndex),
          geometry: normalized,
          properties,
        });
      });
    });
  });

  return dedupeParsedFeatures(parsed);
}

function parseKmlSurvey(text: string, expectedType: SurveyGeometryType): ParsedSurveyFeature[] {
  const foundTypes = new Set<string>();
  const parsed: ParsedSurveyFeature[] = [];

  // DOM parser first — reads exact KML lon,lat coordinates from the file
  let domParsed: ParsedSurveyFeature[] = [];
  try {
    domParsed = parseKmlDomFallback(text, expectedType);
  } catch {
    domParsed = [];
  }
  domParsed.forEach((item) => {
    foundTypes.add(item.geometry.type);
    parsed.push(item);
  });

  if (!parsed.length) {
    try {
      const kmlFormat = new KML({ extractStyles: false, showPointNames: true });
      const olFeatures = kmlFormat.readFeatures(text, {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:4326',
      });

      olFeatures.forEach((feature, index) => {
        parseFeatureGeometries(feature, index, expectedType, foundTypes, true).forEach((item) => {
          parsed.push(item);
        });
      });
    } catch {
      // Ignore OL parse errors when DOM already failed.
    }
  }

  if (!parsed.length) {
    const found = [...foundTypes];
    throw new Error(
      found.length
        ? `No valid ${expectedType} geometries found. KML contains: ${found.join(', ')}. Create a matching feature class or use a file with ${expectedType} data.`
        : `No valid ${expectedType} geometries found in KML file. Check that the file has Placemarks with coordinates.`,
    );
  }

  return dedupeParsedFeatures(parsed);
}

export async function parseSurveyFile(
  file: File,
  expectedType: SurveyGeometryType,
): Promise<ParsedSurveyFeature[]> {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';

  if (extension === 'csv') return parseCsvSurvey(await file.text(), expectedType);
  if (extension === 'geojson' || extension === 'json') {
    return parseGeoJsonSurvey(await file.text(), expectedType);
  }
  if (extension === 'kml') return parseKmlSurvey(await file.text(), expectedType);
  if (extension === 'kmz') return parseKmzSurvey(await file.arrayBuffer(), expectedType);
  if (extension === 'zip') return parseZipSurvey(await file.arrayBuffer(), expectedType);
  if (extension === 'shp') return parseShapefileFromFiles([file], expectedType);
  if (extension === 'txt') return parseCsvSurvey(await file.text(), expectedType);

  throw new Error(
    `Unsupported file type ".${extension}". Use ${SURVEY_IMPORT_ACCEPT.replace(/\./g, '').split(',').join(', ')} survey files.`,
  );
}

export async function parseSurveyFiles(
  files: File[],
  expectedType: SurveyGeometryType,
): Promise<ParsedSurveyFeature[]> {
  if (!files.length) throw new Error('No file selected.');
  if (files.length === 1) return parseSurveyFile(files[0], expectedType);

  const hasShapefilePart = files.some((file) => {
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    return ['shp', 'dbf', 'shx', 'prj', 'cpg'].includes(extension);
  });

  if (hasShapefilePart) {
    return parseShapefileFromFiles(files, expectedType);
  }

  throw new Error(
    'Multiple files are supported for shapefile imports (.shp, .dbf, .prj). For other formats, upload a single file or a .zip shapefile archive.',
  );
}

export function mapPropertiesToSchema(
  properties: Record<string, unknown>,
  schema: Array<{ name: string; label: string; type: string; required?: boolean; options?: string[] }>,
  fieldMapping: Record<string, string>,
  fallbackLabel?: string,
  featureIndex = 0,
): Record<string, unknown> {
  const attributes: Record<string, unknown> = {};

  schema.forEach((field) => {
    const sourceKey = fieldMapping[field.name];
    let value: unknown;

    if (sourceKey) {
      value = properties[sourceKey];
    } else {
      const direct = properties[field.name];
      const byLabel = properties[field.label];
      const normalizedEntries = Object.entries(properties).find(
        ([key]) => normalizeKey(key) === normalizeKey(field.name)
          || normalizeKey(key) === normalizeKey(field.label),
      );
      value = direct ?? byLabel ?? normalizedEntries?.[1];
    }

    if (value === undefined || value === null || value === '') {
      if (field.type === 'boolean') attributes[field.name] = false;
      return;
    }

    switch (field.type) {
      case 'number':
        attributes[field.name] = Number(value);
        break;
      case 'integer':
        attributes[field.name] = Number.parseInt(String(value), 10);
        break;
      case 'boolean':
        attributes[field.name] = value === true || value === 'true' || value === '1' || value === 'yes';
        break;
      default:
        attributes[field.name] = String(value);
    }
  });

  return attributes;
}

export function listSourcePropertyKeys(features: ParsedSurveyFeature[]) {
  const keys = new Set<string>();
  features.forEach((feature) => {
    Object.keys(feature.properties).forEach((key) => keys.add(key));
  });
  return [...keys].sort();
}

function normalizePropertyKey(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

/** Build attribute columns from survey file property keys. */
export function inferAttributeSchemaFromFeatures(
  features: ParsedSurveyFeature[],
  toSnakeCase: (value: string, fallback: string) => string,
): Array<{ name: string; label: string; type: 'text'; required: false }> {
  const keys = listSourcePropertyKeys(features);
  const used = new Set<string>();
  return keys.map((key, index) => {
    let name = toSnakeCase(key, `field_${index + 1}`);
    let candidate = name;
    let suffix = 2;
    while (used.has(candidate)) {
      candidate = `${name}_${suffix}`;
      suffix += 1;
    }
    used.add(candidate);
    return { name: candidate, label: key, type: 'text' as const, required: false as const };
  });
}

export function autoFieldMapping(
  schema: Array<{ name: string; label: string }>,
  sourceKeys: string[],
) {
  const mapping: Record<string, string> = {};
  schema.forEach((field) => {
    const match = sourceKeys.find(
      (key) => key === field.label
        || normalizePropertyKey(key) === normalizePropertyKey(field.label)
        || normalizePropertyKey(key) === normalizePropertyKey(field.name),
    );
    if (match) mapping[field.name] = match;
  });
  return mapping;
}
