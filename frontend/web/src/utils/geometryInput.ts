type GeometryType = 'Point' | 'LineString' | 'Polygon';

export function parseOptionalGeometry(
  geometryType: GeometryType,
  geometryJson: string,
  latitude: string,
  longitude: string,
): object | undefined {
  const jsonTrim = geometryJson.trim();
  const latTrim = latitude.trim();
  const lonTrim = longitude.trim();

  if (geometryType === 'Point' && (latTrim || lonTrim)) {
    if (!latTrim || !lonTrim) {
      throw new Error('Enter both latitude and longitude, or leave both blank.');
    }
    const lat = Number(latTrim);
    const lon = Number(lonTrim);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      throw new Error('Latitude and longitude must be valid numbers.');
    }
    if (lat < -90 || lat > 90) {
      throw new Error('Latitude must be between -90 and 90.');
    }
    if (lon < -180 || lon > 180) {
      throw new Error('Longitude must be between -180 and 180.');
    }
    return { type: 'Point', coordinates: [lon, lat] };
  }

  if (!jsonTrim) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonTrim);
  } catch {
    throw new Error(
      geometryType === 'Point'
        ? 'Use latitude and longitude fields, or paste GeoJSON like {"type":"Point","coordinates":[77.6,12.96]}.'
        : `Paste valid ${geometryType} GeoJSON, or leave geometry blank.`,
    );
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Geometry must be a GeoJSON object.');
  }

  return parsed as object;
}
