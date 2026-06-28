import GeoJSONFormat from 'ol/format/GeoJSON';
import type { Feature as GeoFeature, FeatureCollection as GeoFeatureCollection } from 'geojson';
import type FeatureLike from 'ol/Feature';
import type { StyleLike } from 'ol/style/Style';
import VectorSource from 'ol/source/Vector';
import { Fill, Stroke, Style, Text, Circle as CircleStyle } from 'ol/style';

const geoJsonFormat = new GeoJSONFormat();

export function normalizeMapFeature(feature: GeoFeature): GeoFeature | null {
  if (!feature?.geometry) return null;

  let geometry = feature.geometry;
  if (typeof geometry === 'string') {
    try {
      geometry = JSON.parse(geometry) as GeoFeature['geometry'];
    } catch {
      return null;
    }
  }

  if (!geometry?.type || geometry.coordinates == null) return null;

  return {
    type: 'Feature',
    id: feature.id,
    geometry,
    properties: feature.properties ?? {},
  };
}

export function toGeoFeatureCollection(
  features: GeoFeature[],
  allowedTypes?: string[],
): GeoFeatureCollection {
  const seen = new Set<string>();
  const unique: GeoFeature[] = [];

  features.forEach((feature) => {
    const normalized = normalizeMapFeature(feature);
    if (!normalized?.geometry) return;
    if (allowedTypes?.length && !allowedTypes.includes(normalized.geometry.type)) return;

    let key = JSON.stringify(normalized.geometry.coordinates);
    if (normalized.geometry.type === 'Point' && Array.isArray(normalized.geometry.coordinates)) {
      const [lon, lat] = normalized.geometry.coordinates as number[];
      if (Number.isFinite(lon) && Number.isFinite(lat)) {
        key = `${lon.toFixed(5)},${lat.toFixed(5)}`;
      }
    }

    if (seen.has(key)) return;
    seen.add(key);
    unique.push(normalized);
  });

  return { type: 'FeatureCollection', features: unique };
}

export function loadGeoJsonCollection(
  source: VectorSource,
  collection: GeoFeatureCollection,
  allowedTypes?: string[],
) {
  source.clear();
  const normalized = toGeoFeatureCollection(collection.features ?? [], allowedTypes);
  if (!normalized.features.length) return 0;

  try {
    const olFeatures = geoJsonFormat.readFeatures(normalized, {
      dataProjection: 'EPSG:4326',
      featureProjection: 'EPSG:3857',
    });
    if (olFeatures.length) {
      olFeatures.forEach((item, index) => {
        const rawId = normalized.features[index]?.id;
        if (rawId != null) {
          item.setId(String(rawId));
          item.set('featureId', String(rawId));
        }
      });
      source.addFeatures(olFeatures);
      return olFeatures.length;
    }
  } catch {
    // Try feature-by-feature fallback below.
  }

  let loaded = 0;
  normalized.features.forEach((feature) => {
    try {
      const parsed = geoJsonFormat.readFeature(feature, {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857',
      });
      const items = Array.isArray(parsed) ? parsed : [parsed];
      items.forEach((item) => {
        if (item?.getGeometry()) {
          if (feature.id != null) {
            item.setId(String(feature.id));
            item.set('featureId', String(feature.id));
          }
          source.addFeature(item);
          loaded += 1;
        }
      });
    } catch {
      // skip invalid feature
    }
  });
  return loaded;
}

function withAlpha(color: string, alpha: number): string {
  if (color.startsWith('#') && color.length === 7) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}

function polygonStyles(strokeColor: string, width: number): Style {
  return new Style({
    fill: new Fill({ color: 'rgba(0, 0, 0, 0.01)' }),
    stroke: new Stroke({
      color: strokeColor,
      width,
      lineJoin: 'round',
      lineCap: 'round',
    }),
  });
}

function featureNearExtent(geometry: import('ol/geom/Geometry').default, extent: number[], bufferMeters = 5000) {
  if (!extent.every(Number.isFinite)) return true;
  const center = [(extent[0] + extent[2]) / 2, (extent[1] + extent[3]) / 2];
  const featureCenter = geometry.getClosestPoint(center);
  const dx = featureCenter[0] - center[0];
  const dy = featureCenter[1] - center[1];
  const maxSpan = Math.max(extent[2] - extent[0], extent[3] - extent[1]);
  const maxDistance = Math.max(maxSpan * 4, bufferMeters * 2);
  return Math.hypot(dx, dy) <= maxDistance;
}

function resolvePolygonFillColor(
  markerColor: string | undefined,
  styleConfig: Record<string, unknown> | undefined,
  fillOpacity: number,
): string {
  if (markerColor) return withAlpha(markerColor, fillOpacity);
  const fill = styleConfig?.fill;
  if (typeof fill === 'string' && fill.length) {
    if (fill.startsWith('rgba(') || fill.startsWith('rgb(')) return fill;
    if (fill.startsWith('#')) return withAlpha(fill, fillOpacity);
    return fill;
  }
  return withAlpha(strokeColorFromStyle(styleConfig), fillOpacity);
}

function strokeColorFromStyle(styleConfig?: Record<string, unknown>): string {
  return (styleConfig?.stroke as string) ?? '#E53935';
}

function polygonFeatureStyle(
  strokeColor: string,
  width: number,
  markerColor: string | undefined,
  fillOpacity: number,
  styleConfig?: Record<string, unknown>,
): Style {
  const stroke = markerColor ?? strokeColor;
  const fillColor = resolvePolygonFillColor(markerColor, styleConfig, fillOpacity);
  return new Style({
    fill: new Fill({ color: fillColor }),
    stroke: new Stroke({
      color: stroke,
      width: Math.max(width, 2),
      lineJoin: 'round',
      lineCap: 'round',
    }),
  });
}

export function createOverlayStyle(
  styleConfig?: Record<string, unknown>,
  geometryType?: string,
  viewExtent?: number[],
): StyleLike {
  const strokeColor = (styleConfig?.stroke as string) ?? '#E53935';
  const width = Number(styleConfig?.width ?? styleConfig?.strokeWidth ?? 3);
  const polygonOutline = polygonStyles(strokeColor, Math.max(width, 3));
  const polygonFillOpacity = Number(styleConfig?.fillOpacity ?? 0.35);

  if (geometryType === 'Polygon' || geometryType === 'MultiPolygon') {
    const styleForFeature = (feature: FeatureLike) => {
      const geom = feature.getGeometry();
      if (!geom) return undefined;
      if (viewExtent && !featureNearExtent(geom, viewExtent)) return undefined;
      const type = geom.getType();
      if (type !== 'Polygon' && type !== 'MultiPolygon') return undefined;
      const markerColor = typeof feature.get === 'function'
        ? feature.get('markerColor') as string | undefined
        : undefined;
      return polygonFeatureStyle(strokeColor, width, markerColor, polygonFillOpacity, styleConfig);
    };
    if (!viewExtent) return styleForFeature;
    return styleForFeature;
  }

  return (feature: FeatureLike) => {
    const geom = feature.getGeometry();
    if (!geom) return undefined;
    if (viewExtent && !featureNearExtent(geom, viewExtent)) return undefined;

    const geomType = geom.getType();

    if (geomType === 'Point' || geomType === 'MultiPoint') {
      const markerColor = typeof feature.get === 'function' ? feature.get('markerColor') as string | undefined : undefined;
      const pointRing = typeof feature.get === 'function' ? feature.get('pointRing') === true : false;
      const pointFillOverride = typeof feature.get === 'function'
        ? feature.get('pointFill') as string | undefined
        : undefined;
      const pointFill = pointFillOverride
        ?? (pointRing ? 'rgba(255,255,255,0.92)' : (markerColor ?? (styleConfig?.fill as string) ?? '#7B1FA2'));
      const featureRadius = typeof feature.get === 'function' ? feature.get('pointRadius') : undefined;
      const pointRadius = Number(featureRadius ?? styleConfig?.pointRadius ?? styleConfig?.radius ?? 7);
      const strokeColor = pointRing ? (markerColor ?? '#e11d48') : '#FFFFFF';
      const strokeWidth = pointRing ? 2 : 2;
      const circleStyle = new Style({
        image: new CircleStyle({
          radius: pointRadius,
          fill: new Fill({ color: pointFill }),
          stroke: new Stroke({ color: strokeColor, width: strokeWidth }),
        }),
      });
      const mapLabel = typeof feature.get === 'function'
        ? feature.get('mapLabel') as string | undefined
        : undefined;
      if (mapLabel?.trim()) {
        return [
          circleStyle,
          new Style({
            text: new Text({
              text: mapLabel.trim(),
              offsetY: -(pointRadius + 10),
              font: 'bold 10px "Segoe UI", Arial, sans-serif',
              fill: new Fill({ color: '#1e293b' }),
              stroke: new Stroke({ color: '#ffffff', width: 3 }),
            }),
          }),
        ];
      }
      return circleStyle;
    }
    if (geomType === 'LineString' || geomType === 'MultiLineString') {
      return new Style({ stroke: new Stroke({ color: strokeColor, width: Math.max(width, 4) }) });
    }
    if (geomType === 'Polygon' || geomType === 'MultiPolygon') {
      const markerColor = typeof feature.get === 'function' ? feature.get('markerColor') as string | undefined : undefined;
      if (markerColor) {
        return new Style({
          fill: new Fill({ color: withAlpha(markerColor, polygonFillOpacity) }),
          stroke: new Stroke({ color: markerColor, width: 1 }),
        });
      }
      return polygonOutline;
    }
    return undefined;
  };
}
