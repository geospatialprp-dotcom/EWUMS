import type { Feature, FeatureCollection, Geometry, Position } from 'geojson';
import { createZipArchive } from './zipStore';
import { sanitizeExportFileName } from './downloadFile';

const WGS84_PRJ = 'GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["Degree",0.0174532925199433]]';

const META_KEYS = new Set(['layerId', 'featureClassName', 'geometryType', 'featureId', 'featureClassId', 'featureClassCode']);

type ExportField = { sourceKey: string; name: string; type: 'C' | 'N'; size: number; precision: number };

function dbfFieldName(name: string) {
  return name.replace(/[^A-Za-z0-9_]/g, '_').slice(0, 10).toUpperCase() || 'FIELD';
}

function sanitizeProperties(properties: Record<string, unknown> = {}) {
  const out: Record<string, string | number | boolean> = {};
  Object.entries(properties).forEach(([key, value]) => {
    if (META_KEYS.has(key)) return;
    if (value == null) return;
    if (typeof value === 'string' && value.startsWith('data:image/')) return;
    if (typeof value === 'object') return;
    out[key] = value as string | number | boolean;
  });
  return out;
}

function inferFields(features: Feature[]): ExportField[] {
  const keys = new Set<string>();
  features.forEach((feature) => {
    Object.keys(sanitizeProperties(feature.properties as Record<string, unknown>)).forEach((key) => keys.add(key));
  });
  return Array.from(keys).slice(0, 24).map((key) => {
    const sample = features
      .map((f) => sanitizeProperties(f.properties as Record<string, unknown>)[key])
      .find((v) => v != null);
    if (typeof sample === 'number') {
      return { sourceKey: key, name: dbfFieldName(key), type: 'N' as const, size: 18, precision: 6 };
    }
    return { sourceKey: key, name: dbfFieldName(key), type: 'C' as const, size: 80, precision: 0 };
  });
}

type ShapeRecord =
  | { type: 1; x: number; y: number }
  | { type: 3; parts: number[][]; points: Position[] }
  | { type: 5; parts: number[][]; points: Position[] };

function flattenGeometry(geometry: Geometry | null | undefined): ShapeRecord[] {
  if (!geometry) return [];
  if (geometry.type === 'Point') {
    const [x, y] = geometry.coordinates as Position;
    return [{ type: 1, x, y }];
  }
  if (geometry.type === 'MultiPoint') {
    return geometry.coordinates.map(([x, y]) => ({ type: 1, x, y }));
  }
  if (geometry.type === 'LineString') {
    return [{ type: 3, parts: [[0]], points: geometry.coordinates as Position[] }];
  }
  if (geometry.type === 'MultiLineString') {
    const points = geometry.coordinates.flat() as Position[];
    const parts: number[] = [];
    let index = 0;
    geometry.coordinates.forEach((line) => {
      parts.push(index);
      index += line.length;
    });
    return [{ type: 3, parts: [parts], points }];
  }
  if (geometry.type === 'Polygon') {
    const points = geometry.coordinates.flat() as Position[];
    const parts = geometry.coordinates.map((_, idx, arr) => {
      const offset = arr.slice(0, idx).reduce((sum, ring) => sum + ring.length, 0);
      return offset;
    });
    return [{ type: 5, parts: [parts], points }];
  }
  if (geometry.type === 'MultiPolygon') {
    const points = geometry.coordinates.flat(2) as Position[];
    const parts: number[] = [];
    let index = 0;
    geometry.coordinates.forEach((polygon) => {
      polygon.forEach((ring) => {
        parts.push(index);
        index += ring.length;
      });
    });
    return [{ type: 5, parts: [parts], points }];
  }
  return [];
}

function writeDbf(fields: ExportField[], features: Feature[]) {
  const headerSize = 32 + fields.length * 32 + 1;
  const recordSize = 1 + fields.reduce((sum, field) => sum + field.size, 0);
  const buffer = new ArrayBuffer(headerSize + recordSize * features.length);
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const encoder = new TextEncoder();

  view.setUint8(0, 0x03);
  view.setUint16(1, new Date().getFullYear() - 1900, true);
  view.setUint8(3, new Date().getMonth() + 1);
  view.setUint8(4, new Date().getDate());
  view.setUint32(4, features.length, true);
  view.setUint16(8, headerSize, true);
  view.setUint16(10, recordSize, true);

  fields.forEach((field, index) => {
    const offset = 32 + index * 32;
    const name = encoder.encode(field.name.padEnd(11, '\0').slice(0, 11));
    bytes.set(name, offset);
    view.setUint8(offset + 11, field.type.charCodeAt(0));
    view.setUint32(offset + 16, field.size, true);
    if (field.type === 'N') view.setUint8(offset + 17, field.precision);
  });
  view.setUint8(headerSize - 1, 0x0d);

  features.forEach((feature, rowIndex) => {
    const props = sanitizeProperties(feature.properties as Record<string, unknown>);
    const rowOffset = headerSize + rowIndex * recordSize;
    view.setUint8(rowOffset, 0x20);
    let colOffset = rowOffset + 1;
    fields.forEach((field) => {
      const raw = props[field.sourceKey];
      let text = '';
      if (raw == null) text = '';
      else if (field.type === 'N') text = String(Number(raw));
      else text = String(raw);
      const encoded = encoder.encode(text.slice(0, field.size).padEnd(field.size, ' '));
      bytes.set(encoded.slice(0, field.size), colOffset);
      colOffset += field.size;
    });
  });

  return bytes;
}

function bboxForRecords(records: ShapeRecord[]) {
  let xmin = Infinity; let ymin = Infinity; let xmax = -Infinity; let ymax = -Infinity;
  records.forEach((record) => {
    if (record.type === 1) {
      xmin = Math.min(xmin, record.x); xmax = Math.max(xmax, record.x);
      ymin = Math.min(ymin, record.y); ymax = Math.max(ymax, record.y);
      return;
    }
    record.points.forEach(([x, y]) => {
      xmin = Math.min(xmin, x); xmax = Math.max(xmax, x);
      ymin = Math.min(ymin, y); ymax = Math.max(ymax, y);
    });
  });
  if (!Number.isFinite(xmin)) {
    return { xmin: -180, ymin: -90, xmax: 180, ymax: 90 };
  }
  return { xmin, ymin, xmax, ymax };
}

function writeShpShx(records: ShapeRecord[]) {
  const bbox = bboxForRecords(records);
  const shpParts: Uint8Array[] = [];
  const shxParts: Uint8Array[] = [];
  let contentWords = 0;

  records.forEach((record, index) => {
    let body: Uint8Array;
    if (record.type === 1) {
      body = new Uint8Array(4 + 8 + 8);
      const view = new DataView(body.buffer);
      view.setInt32(0, 1, true);
      view.setFloat64(4, record.x, true);
      view.setFloat64(12, record.y, true);
    } else {
      const numParts = record.parts[0].length;
      const numPoints = record.points.length;
      body = new Uint8Array(4 + 32 + 4 + 4 + numParts * 4 + numPoints * 16);
      const view = new DataView(body.buffer);
      view.setInt32(0, record.type, true);
      view.setFloat64(4, bbox.xmin, true);
      view.setFloat64(12, bbox.ymin, true);
      view.setFloat64(20, bbox.xmax, true);
      view.setFloat64(28, bbox.ymax, true);
      view.setInt32(36, numParts, true);
      view.setInt32(40, numPoints, true);
      record.parts[0].forEach((part, partIndex) => view.setInt32(44 + partIndex * 4, part, true));
      record.points.forEach(([x, y], pointIndex) => {
        view.setFloat64(44 + numParts * 4 + pointIndex * 16, x, true);
        view.setFloat64(44 + numParts * 4 + pointIndex * 16 + 8, y, true);
      });
    }

    const recordWords = body.byteLength / 2;
    const header = new Uint8Array(8);
    const hview = new DataView(header.buffer);
    hview.setInt32(0, index + 1, false);
    hview.setInt32(4, recordWords, false);
    shpParts.push(header, body);

    const indexRecord = new Uint8Array(8);
    const iview = new DataView(indexRecord.buffer);
    iview.setInt32(0, contentWords, false);
    iview.setInt32(4, recordWords, false);
    shxParts.push(indexRecord);
    contentWords += 4 + recordWords;
  });

  const fileWords = 50 + contentWords;
  const shp = new Uint8Array(100 + shpParts.reduce((sum, part) => sum + part.length, 0));
  const shx = new Uint8Array(100 + shxParts.reduce((sum, part) => sum + part.length, 0));
  const shpView = new DataView(shp.buffer);
  const shxView = new DataView(shx.buffer);

  shpView.setInt32(0, 9994, false);
  shpView.setInt32(24, fileWords, false);
  shpView.setInt32(28, 1000, true);
  shpView.setInt32(32, records[0]?.type ?? 1, true);
  shpView.setFloat64(36, bbox.xmin, true);
  shpView.setFloat64(44, bbox.ymin, true);
  shpView.setFloat64(52, bbox.xmax, true);
  shpView.setFloat64(60, bbox.ymax, true);

  shxView.setInt32(0, 9994, false);
  shxView.setInt32(24, 50 + records.length * 4, false);
  shxView.setInt32(28, 1000, true);
  shxView.setInt32(32, records[0]?.type ?? 1, true);
  shxView.setFloat64(36, bbox.xmin, true);
  shxView.setFloat64(44, bbox.ymin, true);
  shxView.setFloat64(52, bbox.xmax, true);
  shxView.setFloat64(60, bbox.ymax, true);

  let offset = 100;
  shpParts.forEach((part) => { shp.set(part, offset); offset += part.length; });
  offset = 100;
  shxParts.forEach((part) => { shx.set(part, offset); offset += part.length; });

  return { shp, shx };
}

export function shapefileBuffersFromCollection(collection: FeatureCollection) {
  const features = collection.features.filter((feature) => feature.geometry);
  const records = features.flatMap((feature) => flattenGeometry(feature.geometry));
  if (!records.length) return null;

  const fields = inferFields(features);
  const { shp, shx } = writeShpShx(records);
  const dbf = writeDbf(fields, features);
  const prj = new TextEncoder().encode(WGS84_PRJ);
  return { shp, shx, dbf, prj };
}

export function createShapefileZip(
  layers: Array<{ layerName: string; collection: FeatureCollection }>,
): Blob | null {
  const entries: Array<{ path: string; data: Uint8Array }> = [];

  layers.forEach((layer) => {
    const buffers = shapefileBuffersFromCollection(layer.collection);
    if (!buffers) return;
    const base = sanitizeExportFileName(layer.layerName).toLowerCase();
    entries.push(
      { path: `${base}.shp`, data: buffers.shp },
      { path: `${base}.shx`, data: buffers.shx },
      { path: `${base}.dbf`, data: buffers.dbf },
      { path: `${base}.prj`, data: buffers.prj },
    );
  });

  if (!entries.length) return null;
  const archive = createZipArchive(entries);
  return new Blob([archive.buffer.slice(archive.byteOffset, archive.byteOffset + archive.byteLength)], {
    type: 'application/zip',
  });
}
