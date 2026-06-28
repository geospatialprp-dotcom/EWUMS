import type { AttributeField } from '../services/api';

/** Decimal places lat/long values are normalized to (≈ 0.1 m precision). */
export const COORDINATE_DECIMALS = 6;

const LAT_FIELD_TOKENS = new Set(['latitude', 'lat']);
const LON_FIELD_TOKENS = new Set(['longitude', 'lng', 'long', 'lon']);

function normalizeFieldToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Locate latitude/longitude attribute fields (by name or label) in a schema. */
export function findCoordinateFields(schema: AttributeField[]): {
  latField?: AttributeField;
  lonField?: AttributeField;
} {
  let latField: AttributeField | undefined;
  let lonField: AttributeField | undefined;
  for (const field of schema) {
    const tokens = [normalizeFieldToken(field.name), normalizeFieldToken(field.label ?? '')];
    if (!lonField && tokens.some((token) => LON_FIELD_TOKENS.has(token))) {
      lonField = field;
      continue;
    }
    if (!latField && tokens.some((token) => LAT_FIELD_TOKENS.has(token))) {
      latField = field;
    }
  }
  return { latField, lonField };
}

/** Set of field names that hold latitude/longitude values for a schema. */
export function coordinateFieldNames(schema: AttributeField[]): Set<string> {
  const { latField, lonField } = findCoordinateFields(schema);
  const names = new Set<string>();
  if (latField) names.add(latField.name);
  if (lonField) names.add(lonField.name);
  return names;
}

/** Format a coordinate as a fixed 6-decimal string (keeps trailing zeros). */
export function formatCoordinateString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return num.toFixed(COORDINATE_DECIMALS);
}

/** Decimal degrees with hemisphere labels, e.g. 29.025630° N, 79.330000° E */
export function formatCoordinatePair(lat: unknown, lon: unknown): string {
  const latStr = formatCoordinateString(lat);
  const lonStr = formatCoordinateString(lon);
  if (!latStr || !lonStr) return '—';
  const latNum = Number(lat);
  const lonNum = Number(lon);
  const latHem = latNum >= 0 ? 'N' : 'S';
  const lonHem = lonNum >= 0 ? 'E' : 'W';
  return `${latStr}° ${latHem}, ${lonStr}° ${lonHem}`;
}

/** Coerce a decimal-degree coordinate to the value type the attribute field expects. */
export function coordinateValueForField(field: AttributeField, coordinate: number): unknown {
  if (field.type === 'integer') return Math.round(coordinate);
  if (field.type === 'number') return Number(coordinate.toFixed(COORDINATE_DECIMALS));
  return coordinate.toFixed(COORDINATE_DECIMALS);
}
