import { Fill, Stroke, Style, Circle as CircleStyle } from 'ol/style';
import type FeatureLike from 'ol/Feature';

/**
 * ArcMap Desktop–style map symbology (simple marker / simple line).
 * Thin strokes, modest markers, cyan selection — not thick web “glow” styles.
 */
export const ARCMAP_SYM = {
  /** Classic ArcMap selection cyan */
  selection: '#00FFFF',
  selectionOutline: '#000000',
  /** Digitize / sketch (ArcGIS blue) */
  sketch: '#0070FF',
  analyze: '#9C27B0',
  sketchVertexFill: '#FFFFFF',
  sketchVertexStroke: '#000000',
  defaultPointFill: '#0070FF',
  defaultPointOutline: '#000000',
  defaultLine: '#E53935',
  searchMarker: '#C62828',
  /** Screen pixels — ArcMap-like simple symbols */
  pointRadius: 5,
  pointOutlineWidth: 1,
  lineWidth: 1.5,
  selectPointRadius: 6,
  selectLineWidth: 2,
  sketchPointRadius: 4,
  sketchLineWidth: 1.5,
  dimPointRadius: 4,
  dimLineWidth: 1,
  polygonOutlineWidth: 1,
  polygonFillOpacity: 0.22,
} as const;

export function arcMapPointStyle(
  fill: string,
  options?: { radius?: number; outline?: string; outlineWidth?: number },
): Style {
  return new Style({
    image: new CircleStyle({
      radius: options?.radius ?? ARCMAP_SYM.pointRadius,
      fill: new Fill({ color: fill }),
      stroke: new Stroke({
        color: options?.outline ?? ARCMAP_SYM.defaultPointOutline,
        width: options?.outlineWidth ?? ARCMAP_SYM.pointOutlineWidth,
      }),
    }),
  });
}

export function arcMapLineStyle(
  color: string,
  options?: { width?: number; lineDash?: number[] },
): Style {
  return new Style({
    stroke: new Stroke({
      color,
      width: options?.width ?? ARCMAP_SYM.lineWidth,
      lineCap: 'round',
      lineJoin: 'round',
      lineDash: options?.lineDash,
    }),
  });
}

export function arcMapPolygonStyle(
  stroke: string,
  fill: string,
  outlineWidth = ARCMAP_SYM.polygonOutlineWidth,
): Style {
  return new Style({
    fill: new Fill({ color: fill }),
    stroke: new Stroke({
      color: stroke,
      width: outlineWidth,
      lineJoin: 'round',
      lineCap: 'round',
    }),
  });
}

/** Identify / select — ArcMap cyan selection. */
export function arcMapSelectionStyle(feature: FeatureLike): Style {
  const geomType = feature.getGeometry()?.getType();
  if (geomType === 'Point' || geomType === 'MultiPoint') {
    return arcMapPointStyle(ARCMAP_SYM.selection, {
      radius: ARCMAP_SYM.selectPointRadius,
      outline: ARCMAP_SYM.selectionOutline,
      outlineWidth: 1.25,
    });
  }
  if (geomType === 'LineString' || geomType === 'MultiLineString') {
    return arcMapLineStyle(ARCMAP_SYM.selection, { width: ARCMAP_SYM.selectLineWidth });
  }
  return arcMapPolygonStyle(
    ARCMAP_SYM.selection,
    'rgba(0, 255, 255, 0.22)',
    ARCMAP_SYM.selectLineWidth,
  );
}

/** Edit selection — ArcMap edit cyan with slightly stronger outline. */
export function arcMapEditSelectionStyle(feature: FeatureLike): Style {
  return arcMapSelectionStyle(feature);
}

/** Digitize / measure sketch layer style. */
export function arcMapSketchStyle(mode: 'draw' | 'analyze' = 'draw'): Style {
  const color = mode === 'analyze' ? ARCMAP_SYM.analyze : ARCMAP_SYM.sketch;
  const fill =
    mode === 'analyze' ? 'rgba(156, 39, 176, 0.12)' : 'rgba(0, 112, 255, 0.12)';
  return new Style({
    fill: new Fill({ color: fill }),
    stroke: new Stroke({
      color,
      width: ARCMAP_SYM.sketchLineWidth,
      lineDash: mode === 'analyze' ? [6, 4] : undefined,
      lineCap: 'round',
      lineJoin: 'round',
    }),
    image: new CircleStyle({
      radius: ARCMAP_SYM.sketchPointRadius,
      fill: new Fill({ color: ARCMAP_SYM.sketchVertexFill }),
      stroke: new Stroke({ color: color, width: 1.5 }),
    }),
  });
}

export function arcMapSearchMarkerStyle(): Style {
  return arcMapPointStyle(ARCMAP_SYM.searchMarker, {
    radius: 5,
    outline: '#FFFFFF',
    outlineWidth: 1.25,
  });
}
