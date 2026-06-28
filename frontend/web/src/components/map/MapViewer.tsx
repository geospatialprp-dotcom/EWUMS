import { useEffect, useRef, useState, useCallback } from 'react';
import OlMap from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSONFormat from 'ol/format/GeoJSON';
import type { Feature as GeoFeature, FeatureCollection as GeoFeatureCollection } from 'geojson';
import type FeatureLike from 'ol/Feature';
import { fromLonLat, toLonLat, transformExtent } from 'ol/proj';
import type { Feature as OlFeature } from 'ol';
import Feature from 'ol/Feature';
import Collection from 'ol/Collection';
import Point from 'ol/geom/Point';
import { Style, Fill, Stroke, Circle as CircleStyle } from 'ol/style';
import { createOverlayStyle, loadGeoJsonCollection } from '../../utils/mapGeoJson';
import { captureMapSnapshot, type MapSnapshotResult } from '../../utils/mapSnapshot';
import {
  ELEVATION_SOURCE_LABELS,
  formatElevation,
  lookupElevation,
  type ElevationSource,
} from '../../utils/elevationLookup';
import Draw from 'ol/interaction/Draw';
import Select from 'ol/interaction/Select';
import Modify from 'ol/interaction/Modify';
import { click, altKeyOnly, shiftKeyOnly, singleClick } from 'ol/events/condition';
import { defaults as defaultControls } from 'ol/control';
import { getLength } from 'ol/sphere';
import { formatAreaFromGeometry } from '../../utils/mapMeasurements';
import { unByKey } from 'ol/Observable';
import type { EventsKey } from 'ol/events';
import type BaseLayer from 'ol/layer/Base';
import {
  BasemapConfig, createBasemapLayer, createGeoTiffBasemapLayer,
  DEFAULT_FALLBACK_BASEMAPS,
  isBlankBasemap, isGeoTiffBasemap, WORLD_VIEW_WGS84,
} from '../../utils/basemapLayers';
import { zoomForPlaceType } from '../../utils/geocoding';
import {
  Box, Paper, Typography, Chip, IconButton, Tooltip,
} from '@mui/material';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import TerrainIcon from '@mui/icons-material/Terrain';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import { MAP_CHROME, mapMapOverlayIconButtonSx, mapZoomControlsSx, mapZoomIconSx } from '../../utils/mapChromeStyles';
import MapNorthScaleBar from './MapNorthScaleBar';

interface OverlayLayerConfig {
  id: string;
  name?: string;
  visible: boolean;
  geometryType?: string;
  features: GeoFeatureCollection;
  style?: Record<string, unknown>;
  zIndex?: number;
}

interface MapFlyTarget {
  lon: number;
  lat: number;
  /** WGS 84 bounds: [west, south, east, north] */
  bbox?: [number, number, number, number];
  zoom?: number;
  placeType?: string;
  revision: number;
  /** When false, fly without dropping a search pin (jurisdiction fit). */
  showMarker?: boolean;
}

interface MapFeaturePick {
  featureId: string;
  layerId: string;
}

interface MapFocusFeature {
  featureId: string;
  revision: number;
}

interface MapViewerProps {
  assets?: GeoFeatureCollection;
  basemaps?: BasemapConfig[];
  activeBasemapId?: string;
  overlayLayers?: OverlayLayerConfig[];
  fitToLayerId?: string;
  /** When set, fit the map to the union extent of these overlay layers (preferred over fitToLayerId). */
  fitToLayerIds?: string[];
  fitRevision?: number;
  flyToTarget?: MapFlyTarget | null;
  onFeatureSelect?: (feature: GeoFeature) => void;
  center?: [number, number];
  zoom?: number;
  activeTool?: string;
  onMeasureResult?: (result: string) => void;
  digitizeGeometryType?: 'Point' | 'LineString' | 'Polygon';
  onDigitizeComplete?: (geometry: GeoFeature['geometry']) => void;
  analyzeDrawType?: 'Point' | 'Polygon';
  onAnalyzeDrawComplete?: (geometry: GeoFeature['geometry']) => void;
  clearQueryRevision?: number;
  editLayerId?: string;
  selectedFeatureId?: string | null;
  focusFeature?: MapFocusFeature | null;
  onFeaturePick?: (pick: MapFeaturePick | null) => void;
  onGeometryModified?: (pick: MapFeaturePick & { geometry: GeoFeature['geometry'] }) => void;
  onFeatureIdentify?: (pick: { featureId: string; layerId: string; properties: Record<string, unknown> }) => void;
  onIdentifyClear?: () => void;
  identifyFeatureId?: string | null;
  identifyLayerId?: string;
  snapshotRequest?: number;
  /** Fit to the union extent of these layers immediately before snapshot capture. */
  snapshotFitLayerIds?: string[];
  layoutRevision?: number;
  onSnapshot?: (result: MapSnapshotResult) => void;
  /** Authorized WGS 84 bounds — map locks pan/zoom inside this area. */
  jurisdictionBbox?: [number, number, number, number] | null;
  jurisdictionRevision?: number;
  jurisdictionBboxKey?: string;
}

export type { MapFlyTarget, MapFeaturePick, MapFocusFeature };

type CursorInspect = {
  lon: number;
  lat: number;
  elevation: number | null;
  elevationSource: ElevationSource | null;
  elevationLoading: boolean;
};

function identifyHighlightStyle(feature: FeatureLike) {
  const geom = feature.getGeometry();
  const geomType = geom?.getType();
  const color = '#1565C0';

  if (geomType === 'Point' || geomType === 'MultiPoint') {
    return new Style({
      image: new CircleStyle({
        radius: 11,
        fill: new Fill({ color }),
        stroke: new Stroke({ color: '#fff', width: 3 }),
      }),
    });
  }
  if (geomType === 'LineString' || geomType === 'MultiLineString') {
    return new Style({ stroke: new Stroke({ color, width: 6 }) });
  }
  return new Style({
    fill: new Fill({ color: 'rgba(21, 101, 192, 0.35)' }),
    stroke: new Stroke({ color, width: 4 }),
  });
}

function dimmedFeatureStyle(feature: FeatureLike, geometryType?: string, styleConfig?: Record<string, unknown>) {
  const geom = feature.getGeometry();
  const geomType = geom?.getType();
  const strokeColor = (styleConfig?.stroke as string) ?? '#E53935';
  const mutedStroke = strokeColor + '55';
  const mutedFill = 'rgba(148, 163, 184, 0.12)';

  if (geomType === 'Point' || geomType === 'MultiPoint') {
    return new Style({
      image: new CircleStyle({
        radius: 7,
        fill: new Fill({ color: '#94a3b855' }),
        stroke: new Stroke({ color: '#ffffff88', width: 2 }),
      }),
    });
  }
  if (geomType === 'LineString' || geomType === 'MultiLineString') {
    return new Style({ stroke: new Stroke({ color: mutedStroke, width: 2 }) });
  }
  if (geometryType === 'Polygon' || geomType === 'Polygon' || geomType === 'MultiPolygon') {
    return new Style({
      fill: new Fill({ color: mutedFill }),
      stroke: new Stroke({ color: mutedStroke, width: 1.5 }),
    });
  }
  return undefined;
}

function selectedEditStyle(feature: FeatureLike) {
  const geom = feature.getGeometry();
  const geomType = geom?.getType();
  const color = '#FF6F00';

  if (geomType === 'Point' || geomType === 'MultiPoint') {
    return new Style({
      image: new CircleStyle({
        radius: 10,
        fill: new Fill({ color }),
        stroke: new Stroke({ color: '#fff', width: 2 }),
      }),
    });
  }
  if (geomType === 'LineString' || geomType === 'MultiLineString') {
    return new Style({ stroke: new Stroke({ color, width: 5 }) });
  }
  return new Style({
    fill: new Fill({ color: 'rgba(255, 111, 0, 0.2)' }),
    stroke: new Stroke({ color, width: 3 }),
  });
}

function getOlFeatureId(feature: OlFeature): string | null {
  const fromProp = feature.get('featureId');
  if (fromProp != null && fromProp !== '') return String(fromProp);
  const id = feature.getId();
  if (id != null && id !== '') return String(id);
  return null;
}

function findOlFeature(layerId: string, featureId: string, refs: globalThis.Map<string, VectorLayer<VectorSource>>) {
  const layer = refs.get(layerId);
  const source = layer?.getSource();
  if (!source) return null;
  return source.getFeatures().find((feature) => getOlFeatureId(feature) === featureId) ?? null;
}

function pruneDetachedSelections(
  layerId: string,
  selected: Collection<OlFeature>,
  refs: globalThis.Map<string, VectorLayer<VectorSource>>,
) {
  const source = refs.get(layerId)?.getSource();
  if (!source) {
    selected.clear();
    return;
  }
  const live = new Set(source.getFeatures());
  for (let index = selected.getLength() - 1; index >= 0; index -= 1) {
    if (!live.has(selected.item(index))) {
      selected.removeAt(index);
    }
  }
}

function syncEditSelection(
  layerId: string,
  featureId: string | null | undefined,
  select: Select,
  refs: globalThis.Map<string, VectorLayer<VectorSource>>,
) {
  const selected = select.getFeatures();
  pruneDetachedSelections(layerId, selected, refs);

  if (!featureId) {
    selected.clear();
    return;
  }

  const olFeature = findOlFeature(layerId, featureId, refs);
  if (!olFeature) {
    selected.clear();
    return;
  }

  if (selected.getLength() === 1 && selected.item(0) === olFeature) {
    return;
  }

  selected.clear();
  selected.push(olFeature);
}

function findFeatureAtCoordinate(
  coordinate: number[],
  refs: globalThis.Map<string, VectorLayer<VectorSource>>,
) {
  let pickedFeature: OlFeature | null = null;
  let pickedLayerId: string | undefined;

  refs.forEach((olLayer, layerId) => {
    if (pickedFeature || !olLayer.getVisible()) return;
    const source = olLayer.getSource();
    if (!source) return;

    source.getFeatures().forEach((candidate) => {
      if (pickedFeature) return;
      const geom = candidate.getGeometry();
      if (geom?.intersectsCoordinate(coordinate)) {
        pickedFeature = candidate;
        pickedLayerId = layerId;
      }
    });
  });

  return pickedFeature ? { feature: pickedFeature, layerId: pickedLayerId! } : null;
}

function vertexDeleteCondition(event: Parameters<typeof singleClick>[0]) {
  return singleClick(event) && (altKeyOnly(event) || shiftKeyOnly(event));
}

const statusColors: Record<string, string> = {
  active: '#00897B',
  critical: '#C62828',
  inactive: '#9E9E9E',
  maintenance: '#F57F17',
};

function getFeatureStyle(feature: FeatureLike) {
  const status = feature.get('status') as string;
  const geom = feature.getGeometry();
  const geomType = geom?.getType();
  const color = statusColors[status] ?? '#1565C0';

  if (geomType === 'Point') {
    return new Style({
      image: new CircleStyle({ radius: 8, fill: new Fill({ color }), stroke: new Stroke({ color: '#fff', width: 2 }) }),
    });
  }
  if (geomType === 'LineString') {
    return new Style({ stroke: new Stroke({ color, width: 4 }) });
  }
  return new Style({
    fill: new Fill({ color: color + '40' }),
    stroke: new Stroke({ color, width: 2 }),
  });
}

function allowedGeometryTypes(geometryType?: string) {
  if (geometryType === 'Polygon') return ['Polygon', 'MultiPolygon'];
  if (geometryType === 'LineString') return ['LineString', 'MultiLineString'];
  if (geometryType === 'Point') return ['Point', 'MultiPoint'];
  return undefined;
}

function computeLayersExtent(
  layerIds: string[],
  refs: globalThis.Map<string, VectorLayer<VectorSource>>,
): number[] | null {
  let extent: number[] | null = null;
  for (const layerId of layerIds) {
    const layer = refs.get(layerId);
    const source = layer?.getSource();
    if (!source?.getFeatures().length) continue;
    const layerExtent = source.getExtent();
    if (!layerExtent || !layerExtent.every((value) => Number.isFinite(value))) continue;
    extent = extent
      ? [
          Math.min(extent[0], layerExtent[0]),
          Math.min(extent[1], layerExtent[1]),
          Math.max(extent[2], layerExtent[2]),
          Math.max(extent[3], layerExtent[3]),
        ]
      : layerExtent;
  }
  return extent;
}

type FitLayersOptions = {
  padding?: [number, number, number, number];
  maxZoom?: number;
  duration?: number;
};

function fitMapToLayer(map: OlMap, layerId: string, refs: globalThis.Map<string, VectorLayer<VectorSource>>) {
  const extent = computeLayersExtent([layerId], refs);
  if (!extent) return false;

  map.updateSize();
  map.getView().fit(extent as [number, number, number, number], {
    padding: [60, 60, 60, 60],
    maxZoom: 20,
    duration: 600,
  });
  return true;
}

function fitMapToLayers(
  map: OlMap,
  layerIds: string[],
  refs: globalThis.Map<string, VectorLayer<VectorSource>>,
  options?: FitLayersOptions,
) {
  const extent = computeLayersExtent(layerIds, refs);
  if (!extent) return false;

  map.updateSize();
  map.getView().fit(extent as [number, number, number, number], {
    padding: options?.padding ?? [60, 60, 60, 60],
    maxZoom: options?.maxZoom ?? 17,
    duration: options?.duration ?? 600,
  });
  return true;
}

function applyOverlayStyles(
  map: OlMap,
  overlayLayers: OverlayLayerConfig[],
  refs: globalThis.Map<string, VectorLayer<VectorSource>>,
  identify?: { layerId: string; featureId: string } | null,
  disableViewCulling = false,
) {
  const viewExtent = disableViewCulling
    ? undefined
    : map.getView().calculateExtent(map.getSize());
  overlayLayers.forEach((config) => {
    const olLayer = refs.get(config.id);
    if (!olLayer?.getVisible()) return;

    if (identify?.layerId === config.id && identify.featureId) {
      olLayer.setStyle((feature) => {
        const fid = getOlFeatureId(feature as OlFeature);
        if (fid === identify.featureId) {
          return identifyHighlightStyle(feature);
        }
        const dimmed = dimmedFeatureStyle(feature, config.geometryType, config.style);
        if (dimmed) return dimmed;
        const baseStyle = createOverlayStyle(config.style, config.geometryType, viewExtent);
        return typeof baseStyle === 'function' ? baseStyle(feature) : baseStyle;
      });
      return;
    }

    olLayer.setStyle(createOverlayStyle(config.style, config.geometryType, viewExtent));
  });
}

const searchMarkerStyle = new Style({
  image: new CircleStyle({
    radius: 8,
    fill: new Fill({ color: '#D32F2F' }),
    stroke: new Stroke({ color: '#FFFFFF', width: 3 }),
  }),
});

function flyMapToTarget(map: OlMap, target: MapFlyTarget, markerSource: VectorSource) {
  const view = map.getView();
  markerSource.clear();
  if (target.showMarker !== false) {
    markerSource.addFeature(new Feature({
      geometry: new Point(fromLonLat([target.lon, target.lat])),
    }));
  }

  if (target.bbox) {
    const [west, south, east, north] = target.bbox;
    if (target.showMarker === false) {
      applyJurisdictionView(map, target.bbox, { animate: true, fit: true });
      return;
    }
    const extent = transformExtent([west, south, east, north], 'EPSG:4326', 'EPSG:3857');
    view.fit(extent, {
      padding: [48, 48, 48, 48],
      maxZoom: 14,
      duration: 700,
    });
    return;
  }

  const zoomLevel = target.zoom ?? zoomForPlaceType(target.placeType);
  view.animate({
    center: fromLonLat([target.lon, target.lat]),
    zoom: zoomLevel,
    duration: 700,
  });
}

/** Fit and lock the map to an authorized jurisdiction bbox (Uttarakhand or district). */
function applyJurisdictionView(
  map: OlMap,
  bbox: [number, number, number, number],
  options: { animate?: boolean; fit?: boolean } = {},
): boolean {
  const { animate = false, fit = true } = options;
  const size = map.getSize();
  if (!size || size[0] < 10 || size[1] < 10) return false;

  const view = map.getView();
  const [west, south, east, north] = bbox;
  const extent = transformExtent([west, south, east, north], 'EPSG:4326', 'EPSG:3857');
  const pad = 0.12;
  const constraintExtent = transformExtent(
    [west - pad, south - pad, east + pad, north + pad],
    'EPSG:4326',
    'EPSG:3857',
  );

  view.unset('extent');

  if (fit) {
    view.fit(extent, {
      padding: [40, 40, 40, 40],
      maxZoom: 14,
      duration: animate ? 600 : 0,
    });
  }

  // Keep a wide zoom range — do not tie minZoom to the fitted level (breaks zoom out).
  view.setMinZoom(6);
  view.setMaxZoom(20);
  view.set('extent', constraintExtent);

  return true;
}

export default function MapViewer({
  assets, basemaps = [], activeBasemapId, overlayLayers = [], fitToLayerId, fitToLayerIds, fitRevision = 0,
  flyToTarget, onFeatureSelect, center = WORLD_VIEW_WGS84.center, zoom = WORLD_VIEW_WGS84.zoom,
  activeTool = 'info', onMeasureResult, digitizeGeometryType, onDigitizeComplete,
  editLayerId, selectedFeatureId, focusFeature, onFeaturePick, onGeometryModified,
  onFeatureIdentify, onIdentifyClear, identifyFeatureId, identifyLayerId,
  analyzeDrawType, onAnalyzeDrawComplete, clearQueryRevision = 0,
  snapshotRequest = 0, snapshotFitLayerIds, onSnapshot,
  layoutRevision = 0,
  jurisdictionBbox = null,
  jurisdictionRevision = 0,
  jurisdictionBboxKey = '',
}: MapViewerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<OlMap | null>(null);
  const basemapLayers = useRef<BaseLayer[]>([]);
  const vectorSource = useRef(new VectorSource());
  const vectorLayer = useRef<VectorLayer<VectorSource> | null>(null);
  const overlayLayerRefs = useRef<globalThis.Map<string, VectorLayer<VectorSource>>>(new globalThis.Map());
  const drawSource = useRef(new VectorSource());
  const drawLayer = useRef<VectorLayer<VectorSource> | null>(null);
  const drawInteraction = useRef<Draw | null>(null);
  const selectInteraction = useRef<Select | null>(null);
  const modifyInteraction = useRef<Modify | null>(null);
  const measureListeners = useRef<EventsKey[]>([]);
  const editListeners = useRef<EventsKey[]>([]);
  const searchMarkerSource = useRef(new VectorSource());
  const searchMarkerLayer = useRef<VectorLayer<VectorSource> | null>(null);
  const elevationTimerRef = useRef<number | null>(null);
  const elevationAbortRef = useRef<AbortController | null>(null);
  const lastFitKey = useRef('');
  const overlayLayersRef = useRef(overlayLayers);
  const activeToolRef = useRef(activeTool);
  const onFeaturePickRef = useRef(onFeaturePick);
  const onGeometryModifiedRef = useRef(onGeometryModified);
  const editLayerIdRef = useRef(editLayerId);
  const selectedFeatureIdRef = useRef(selectedFeatureId);
  const onFeatureIdentifyRef = useRef(onFeatureIdentify);
  const onIdentifyClearRef = useRef(onIdentifyClear);
  const onSnapshotRef = useRef(onSnapshot);
  const snapshotFitLayerIdsRef = useRef(snapshotFitLayerIds);
  const onAnalyzeDrawCompleteRef = useRef(onAnalyzeDrawComplete);
  const identifyFeatureIdRef = useRef(identifyFeatureId);
  const identifyLayerIdRef = useRef(identifyLayerId);
  const jurisdictionBboxRef = useRef(jurisdictionBbox);
  const [selectedFeature, setSelectedFeature] = useState<GeoFeature | null>(null);
  const [cursorInspect, setCursorInspect] = useState<CursorInspect | null>(null);
  const [mapForControls, setMapForControls] = useState<OlMap | null>(null);

  overlayLayersRef.current = overlayLayers;
  activeToolRef.current = activeTool;
  onFeaturePickRef.current = onFeaturePick;
  onGeometryModifiedRef.current = onGeometryModified;
  editLayerIdRef.current = editLayerId;
  selectedFeatureIdRef.current = selectedFeatureId;
  onFeatureIdentifyRef.current = onFeatureIdentify;
  onIdentifyClearRef.current = onIdentifyClear;
  onSnapshotRef.current = onSnapshot;
  snapshotFitLayerIdsRef.current = snapshotFitLayerIds;
  onAnalyzeDrawCompleteRef.current = onAnalyzeDrawComplete;
  identifyFeatureIdRef.current = identifyFeatureId;
  identifyLayerIdRef.current = identifyLayerId;
  jurisdictionBboxRef.current = jurisdictionBbox;

  const initialCenter = jurisdictionBbox
    ? [
        (jurisdictionBbox[0] + jurisdictionBbox[2]) / 2,
        (jurisdictionBbox[1] + jurisdictionBbox[3]) / 2,
      ] as [number, number]
    : center;
  const initialZoom = jurisdictionBbox ? 8 : zoom;

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    drawLayer.current = new VectorLayer({
      source: drawSource.current,
      style: new Style({
        fill: new Fill({ color: 'rgba(21, 101, 192, 0.2)' }),
        stroke: new Stroke({ color: '#1565C0', width: 2, lineDash: [5, 5] }),
        image: new CircleStyle({ radius: 5, fill: new Fill({ color: '#1565C0' }) }),
      }),
      zIndex: 10,
    });

    const assetVectorLayer = new VectorLayer({
      source: vectorSource.current,
      style: (feature) => getFeatureStyle(feature),
      zIndex: 5,
    });
    vectorLayer.current = assetVectorLayer;

    searchMarkerLayer.current = new VectorLayer({
      source: searchMarkerSource.current,
      style: searchMarkerStyle,
      zIndex: 30,
    });

    const tileBasemapConfigs = basemaps.length
      ? basemaps.filter((config) => !isBlankBasemap(config))
      : DEFAULT_FALLBACK_BASEMAPS.filter((config) => !isBlankBasemap(config));

    const initialBasemapLayers = tileBasemapConfigs
      .map((config) => createBasemapLayer(config))
      .filter((layer): layer is TileLayer => layer !== null);

    basemapLayers.current = initialBasemapLayers;
    const defaultBasemapId = activeBasemapId || basemaps[0]?.id || tileBasemapConfigs[0]?.id || 'osm-default';
    const showTiles = !basemaps.some((config) => config.id === defaultBasemapId && isBlankBasemap(config));
    initialBasemapLayers.forEach((layer) => {
      const layerId = layer.get('basemapId') as string;
      layer.setVisible(showTiles && layerId === defaultBasemapId);
    });

    mapInstance.current = new OlMap({
      target: mapRef.current,
      controls: defaultControls({ zoom: false, rotate: false, attribution: false }),
      layers: [
        ...initialBasemapLayers,
        assetVectorLayer,
        drawLayer.current,
        searchMarkerLayer.current,
      ],
      view: new View({ center: fromLonLat(initialCenter), zoom: initialZoom }),
    });
    setMapForControls(mapInstance.current);

    mapInstance.current.on('click', (evt) => {
      if (activeToolRef.current !== 'info') return;

      let pickedLayerId: string | undefined;
      let feature = mapInstance.current!.forEachFeatureAtPixel(
        evt.pixel,
        (f, layer) => {
          if (layer === vectorLayer.current) return f;
          for (const [layerId, overlayLayer] of overlayLayerRefs.current.entries()) {
            if (overlayLayer === layer) {
              pickedLayerId = layerId;
              return f;
            }
          }
          return undefined;
        },
        {
          layerFilter: (l) => {
            if (l === vectorLayer.current) return true;
            for (const overlayLayer of overlayLayerRefs.current.values()) {
              if (overlayLayer === l) return true;
            }
            return false;
          },
          hitTolerance: 8,
        },
      );

      if (!feature) {
        const coordHit = findFeatureAtCoordinate(evt.coordinate, overlayLayerRefs.current);
        if (coordHit) {
          feature = coordHit.feature;
          pickedLayerId = coordHit.layerId;
        }
      }

      if (feature) {
        const geom = feature.getGeometry();
        if (!geom) return;
        const properties = { ...feature.getProperties() };
        delete properties.geometry;

        const geoFeature: GeoFeature = {
          type: 'Feature',
          geometry: new GeoJSONFormat().writeGeometryObject(geom) as GeoFeature['geometry'],
          properties,
        };
        setSelectedFeature(geoFeature);
        onFeatureSelect?.(geoFeature);

        const featureId = getOlFeatureId(feature);
        if (featureId && pickedLayerId) {
          onFeatureIdentifyRef.current?.({ featureId, layerId: pickedLayerId, properties });
        }
      } else {
        setSelectedFeature(null);
        onIdentifyClearRef.current?.();
      }
    });

    const applyDefaultCursor = () => {
      const target = mapInstance.current?.getTargetElement();
      if (target) target.style.cursor = 'default';
    };
    applyDefaultCursor();
    mapInstance.current.on('pointerdrag', applyDefaultCursor);
    mapInstance.current.on('moveend', applyDefaultCursor);

    mapInstance.current.on('pointermove', (evt) => {
      if (evt.dragging) return;

      applyDefaultCursor();
      const [lon, lat] = toLonLat(evt.coordinate);

      setCursorInspect((prev) => ({
        lon,
        lat,
        elevation: prev && prev.lat === lat && prev.lon === lon ? prev.elevation : null,
        elevationSource: prev && prev.lat === lat && prev.lon === lon ? prev.elevationSource : null,
        elevationLoading: true,
      }));

      if (elevationTimerRef.current != null) {
        window.clearTimeout(elevationTimerRef.current);
      }
      elevationAbortRef.current?.abort();

      elevationTimerRef.current = window.setTimeout(() => {
        const controller = new AbortController();
        elevationAbortRef.current = controller;
        const targetLat = lat;
        const targetLon = lon;

        void lookupElevation(targetLat, targetLon, controller.signal)
          .then((result) => {
            setCursorInspect((prev) => {
              if (!prev || prev.lat !== targetLat || prev.lon !== targetLon) return prev;
              return {
                ...prev,
                elevation: result?.elevation ?? null,
                elevationSource: result?.source ?? null,
                elevationLoading: false,
              };
            });
          })
          .catch(() => {
            setCursorInspect((prev) => {
              if (!prev || prev.lat !== targetLat || prev.lon !== targetLon) return prev;
              return { ...prev, elevationLoading: false };
            });
          });
      }, 350);
    });

    const hideCursorInspect = () => {
      setCursorInspect(null);
      if (elevationTimerRef.current != null) {
        window.clearTimeout(elevationTimerRef.current);
        elevationTimerRef.current = null;
      }
      elevationAbortRef.current?.abort();
      elevationAbortRef.current = null;
    };

    mapRef.current.addEventListener('mouseleave', hideCursorInspect);

    const refreshOverlayStyles = () => {
      if (!mapInstance.current) return;
      const identify = activeToolRef.current === 'info'
        && identifyFeatureIdRef.current
        && identifyLayerIdRef.current
        ? { layerId: identifyLayerIdRef.current, featureId: identifyFeatureIdRef.current }
        : null;
      applyOverlayStyles(
        mapInstance.current,
        overlayLayersRef.current,
        overlayLayerRefs.current,
        identify,
      );
    };
    mapInstance.current.on('moveend', refreshOverlayStyles);

    requestAnimationFrame(() => {
      mapInstance.current?.updateSize();
    });

    return () => {
      mapRef.current?.removeEventListener('mouseleave', hideCursorInspect);
      if (elevationTimerRef.current != null) {
        window.clearTimeout(elevationTimerRef.current);
      }
      elevationAbortRef.current?.abort();
      mapInstance.current?.un('moveend', refreshOverlayStyles);
      overlayLayerRefs.current.clear();
      basemapLayers.current = [];
      mapInstance.current?.setTarget(undefined);
      mapInstance.current = null;
      setMapForControls(null);
    };
  }, []);

  useEffect(() => {
    if (!mapInstance.current) return;

    const map = mapInstance.current;
    const mapLayers = map.getLayers();
    const tileConfigs = basemaps.length
      ? basemaps.filter((config) => !isBlankBasemap(config))
      : DEFAULT_FALLBACK_BASEMAPS.filter((config) => !isBlankBasemap(config));
    const configuredIds = new Set(tileConfigs.map((config) => config.id));
    let cancelled = false;

    basemapLayers.current = basemapLayers.current.filter((layer) => {
      const layerId = layer.get('basemapId') as string;
      if (configuredIds.has(layerId)) return true;
      mapLayers.remove(layer);
      return false;
    });

    const existingIds = new Set(
      basemapLayers.current.map((layer) => layer.get('basemapId') as string),
    );

    const applyVisibility = () => {
      if (cancelled) return;

      const blankActive = basemaps.some(
        (config) => config.id === activeBasemapId && isBlankBasemap(config),
      );

      if (blankActive) {
        basemapLayers.current.forEach((layer) => layer.setVisible(false));
        return;
      }

      let activeId = activeBasemapId || tileConfigs[0]?.id;
      if (!activeId) return;

      const hasActiveLayer = basemapLayers.current.some(
        (layer) => layer.get('basemapId') === activeId,
      );
      if (!hasActiveLayer) {
        activeId = basemapLayers.current[0]?.get('basemapId') as string;
      }
      if (!activeId) return;

      basemapLayers.current.forEach((layer) => {
        const layerId = layer.get('basemapId') as string;
        layer.setVisible(layerId === activeId);
      });
    };

    tileConfigs.forEach((config) => {
      if (existingIds.has(config.id)) return;
      if (isGeoTiffBasemap(config)) {
        void createGeoTiffBasemapLayer(config)
          .then((geoLayer) => {
            if (cancelled || !geoLayer || !mapInstance.current) return;
            basemapLayers.current.push(geoLayer);
            map.getLayers().insertAt(0, geoLayer);
            applyVisibility();
          })
          .catch((error) => {
            console.error('[EGIP] Failed to load orthomosaic GeoTIFF basemap:', error);
          });
        return;
      }
      const tileLayer = createBasemapLayer(config);
      if (!tileLayer) return;
      basemapLayers.current.push(tileLayer);
      mapLayers.insertAt(0, tileLayer);
    });

    applyVisibility();

    return () => {
      cancelled = true;
    };
  }, [activeBasemapId, basemaps]);

  useEffect(() => {
    if (!assets) return;
    vectorSource.current.clear();
    const validCollection = {
      type: 'FeatureCollection' as const,
      features: (assets.features ?? []).filter(
        (feature) => feature?.geometry?.type && feature.geometry.coordinates != null,
      ),
    };
    if (!validCollection.features.length) return;
    try {
      const loaded = loadGeoJsonCollection(vectorSource.current, validCollection);
      if (!loaded) vectorSource.current.clear();
    } catch {
      vectorSource.current.clear();
    }
  }, [assets]);

  useEffect(() => {
    if (!mapInstance.current) return;

    const map = mapInstance.current;
    const activeIds = new Set(overlayLayers.map((layer) => layer.id));

    overlayLayerRefs.current.forEach((olLayer, layerId) => {
      if (!activeIds.has(layerId)) {
        map.removeLayer(olLayer);
        overlayLayerRefs.current.delete(layerId);
      }
    });

    overlayLayers.forEach((config) => {
      const mapLayers = map.getLayers().getArray();
      let olLayer = overlayLayerRefs.current.get(config.id);
      if (olLayer && !mapLayers.includes(olLayer)) {
        overlayLayerRefs.current.delete(config.id);
        olLayer = undefined;
      }

      if (!olLayer) {
        olLayer = new VectorLayer({
          source: new VectorSource(),
          zIndex: config.zIndex ?? 25,
          renderBuffer: 512,
          updateWhileAnimating: true,
          updateWhileInteracting: true,
        });
        overlayLayerRefs.current.set(config.id, olLayer);
        map.addLayer(olLayer);
      }

      olLayer.setVisible(config.visible);
      olLayer.setZIndex(config.zIndex ?? 25);
      const source = olLayer.getSource();
      if (!source) return;

      if (!config.visible || !config.features.features?.length) {
        source.clear();
        return;
      }

      loadGeoJsonCollection(
        source,
        config.features,
        allowedGeometryTypes(config.geometryType),
      );
    });

    map.updateSize();
    const identify = activeTool === 'info' && identifyFeatureId && identifyLayerId
      ? { layerId: identifyLayerId, featureId: identifyFeatureId }
      : null;
    applyOverlayStyles(map, overlayLayers, overlayLayerRefs.current, identify);

    if (activeToolRef.current === 'edit' && editLayerIdRef.current && selectInteraction.current) {
      requestAnimationFrame(() => {
        if (!selectInteraction.current || !editLayerIdRef.current) return;
        syncEditSelection(
          editLayerIdRef.current,
          selectedFeatureIdRef.current,
          selectInteraction.current,
          overlayLayerRefs.current,
        );
      });
    }
  }, [overlayLayers, activeTool, identifyFeatureId, identifyLayerId]);

  useEffect(() => {
    if (!mapInstance.current) return;
    const identify = activeTool === 'info' && identifyFeatureId && identifyLayerId
      ? { layerId: identifyLayerId, featureId: identifyFeatureId }
      : null;
    applyOverlayStyles(
      mapInstance.current,
      overlayLayersRef.current,
      overlayLayerRefs.current,
      identify,
    );
  }, [activeTool, identifyFeatureId, identifyLayerId, overlayLayers]);

  useEffect(() => {
    if (!mapInstance.current) return;
    const fitIds = fitToLayerIds?.filter(Boolean);
    const fitKey = fitIds?.length
      ? `${fitIds.join('+')}:${fitRevision}`
      : fitToLayerId
        ? `${fitToLayerId}:${fitRevision}`
        : null;
    if (!fitKey) return;
    if (fitKey === lastFitKey.current) return;

    const map = mapInstance.current;
    let attempts = 0;

    const tryFit = () => {
      const fitted = fitIds?.length
        ? fitMapToLayers(map, fitIds, overlayLayerRefs.current)
        : fitToLayerId
          ? fitMapToLayer(map, fitToLayerId, overlayLayerRefs.current)
          : false;
      if (fitted) {
        lastFitKey.current = fitKey;
        return;
      }
      attempts += 1;
      if (attempts < 10) requestAnimationFrame(tryFit);
    };

    requestAnimationFrame(tryFit);
  }, [fitToLayerId, fitToLayerIds, fitRevision, overlayLayers]);

  useEffect(() => {
    if (!mapInstance.current || !jurisdictionBbox) return;
    const map = mapInstance.current;
    let attempts = 0;

    const tryApply = () => {
      map.updateSize();
      if (applyJurisdictionView(map, jurisdictionBbox, { animate: attempts > 0, fit: true })) return;
      attempts += 1;
      if (attempts < 12) requestAnimationFrame(tryApply);
    };

    tryApply();
  }, [jurisdictionBbox, jurisdictionRevision, jurisdictionBboxKey]);

  useEffect(() => {
    if (!mapInstance.current || !flyToTarget) return;
    flyMapToTarget(mapInstance.current, flyToTarget, searchMarkerSource.current);
    requestAnimationFrame(() => {
      mapInstance.current?.updateSize();
    });
  }, [flyToTarget]);

  const clearEditInteractions = useCallback(() => {
    editListeners.current.forEach((key) => unByKey(key));
    editListeners.current = [];
    if (modifyInteraction.current && mapInstance.current) {
      mapInstance.current.removeInteraction(modifyInteraction.current);
      modifyInteraction.current = null;
    }
    if (selectInteraction.current && mapInstance.current) {
      selectInteraction.current.getFeatures().clear();
      mapInstance.current.removeInteraction(selectInteraction.current);
      selectInteraction.current = null;
    }
  }, []);

  const clearMeasureListeners = useCallback(() => {
    measureListeners.current.forEach((listener) => unByKey(listener));
    measureListeners.current = [];
  }, []);

  const clearDraw = useCallback(() => {
    drawSource.current.clear();
    if (drawInteraction.current && mapInstance.current) {
      mapInstance.current.removeInteraction(drawInteraction.current);
      drawInteraction.current = null;
    }
    clearMeasureListeners();
  }, [clearMeasureListeners]);

  useEffect(() => {
    if (!drawLayer.current) return;
    const isAnalyze = activeTool === 'analyze';
    drawLayer.current.setStyle(new Style({
      fill: new Fill({ color: isAnalyze ? 'rgba(123, 31, 162, 0.15)' : 'rgba(21, 101, 192, 0.2)' }),
      stroke: new Stroke({
        color: isAnalyze ? '#7B1FA2' : '#1565C0',
        width: 2,
        lineDash: isAnalyze ? [8, 4] : [5, 5],
      }),
      image: new CircleStyle({
        radius: 6,
        fill: new Fill({ color: isAnalyze ? '#7B1FA2' : '#1565C0' }),
        stroke: new Stroke({ color: '#fff', width: 2 }),
      }),
    }));
  }, [activeTool]);

  useEffect(() => {
    if (!clearQueryRevision) return;
    drawSource.current.clear();
  }, [clearQueryRevision]);

  useEffect(() => {
    if (!mapInstance.current) return;
    clearDraw();

    if (activeTool === 'info' || activeTool === 'edit') return;

    let drawType: 'Point' | 'LineString' | 'Polygon' = 'Point';
    if (activeTool === 'measure') drawType = 'LineString';
    if (activeTool === 'measureArea') drawType = 'Polygon';
    if (activeTool === 'polygon') drawType = 'Polygon';
    if (activeTool === 'digitize' && digitizeGeometryType) {
      drawType = digitizeGeometryType;
    }
    if (activeTool === 'analyze') {
      drawType = analyzeDrawType ?? 'Polygon';
    }

    if (activeTool === 'digitize' && !digitizeGeometryType) return;

    const draw = new Draw({ source: drawSource.current, type: drawType });
    drawInteraction.current = draw;
    mapInstance.current.addInteraction(draw);

    const trackMeasureListener = (listener: EventsKey) => {
      measureListeners.current.push(listener);
    };

    if (drawType === 'Polygon' && onMeasureResult && activeTool === 'measureArea') {
      trackMeasureListener(draw.on('drawstart', (evt) => {
        const geom = evt.feature.getGeometry();
        if (!geom) return;

        trackMeasureListener(geom.on('change', () => {
          const updated = evt.feature.getGeometry();
          if (updated) onMeasureResult(formatAreaFromGeometry(updated));
        }));
      }));
    }

    if (activeTool === 'measure') {
      trackMeasureListener(draw.on('drawend', (evt) => {
        const geom = evt.feature.getGeometry();
        if (geom) {
          const length = getLength(geom);
          const result = length > 1000
            ? `${(length / 1000).toFixed(2)} km`
            : `${length.toFixed(1)} m`;
          onMeasureResult?.(result);
        }
      }));
    }

    if (activeTool === 'measureArea') {
      trackMeasureListener(draw.on('drawend', (evt) => {
        const geom = evt.feature.getGeometry();
        if (geom) onMeasureResult?.(formatAreaFromGeometry(geom));
      }));
    }

    if ((activeTool === 'digitize' || activeTool === 'polygon') && onDigitizeComplete) {
      trackMeasureListener(draw.on('drawend', (evt) => {
        const geom = evt.feature.getGeometry();
        if (!geom) return;
        const geometry = new GeoJSONFormat().writeGeometryObject(geom, {
          dataProjection: 'EPSG:4326',
          featureProjection: 'EPSG:3857',
        }) as GeoFeature['geometry'];
        drawSource.current.removeFeature(evt.feature);
        onDigitizeComplete(geometry);
      }));
    }

    if (activeTool === 'analyze') {
      trackMeasureListener(draw.on('drawend', (evt) => {
        const geom = evt.feature.getGeometry();
        if (!geom) return;
        drawSource.current.getFeatures()
          .filter((feature) => feature !== evt.feature)
          .forEach((feature) => drawSource.current.removeFeature(feature));
        const geometry = new GeoJSONFormat().writeGeometryObject(geom, {
          dataProjection: 'EPSG:4326',
          featureProjection: 'EPSG:3857',
        }) as GeoFeature['geometry'];
        onAnalyzeDrawCompleteRef.current?.(geometry);
      }));
    }

    return clearDraw;
  }, [activeTool, clearDraw, onMeasureResult, digitizeGeometryType, onDigitizeComplete, analyzeDrawType]);

  useEffect(() => {
    if (!mapInstance.current) return;
    clearEditInteractions();

    if (activeTool !== 'edit' || !editLayerId) return;

    const map = mapInstance.current;
    const editLayer = overlayLayerRefs.current.get(editLayerId);
    if (!editLayer) return;

    const select = new Select({
      layers: [editLayer],
      style: selectedEditStyle,
      condition: click,
      hitTolerance: 6,
    });
    selectInteraction.current = select;
    map.addInteraction(select);

    const selected = select.getFeatures();
    const editSource = editLayer.getSource();
    if (!editSource) return;

    // Bind Modify to the whole layer source so any vertex can be grabbed and
    // dragged directly, without having to click the feature to select it first.
    const modify = new Modify({
      source: editSource,
      deleteCondition: vertexDeleteCondition,
    });
    modifyInteraction.current = modify;
    map.addInteraction(modify);

    const notifyPick = () => {
      const layerId = editLayerIdRef.current;
      if (!layerId) return;
      const feature = selected.item(0);
      if (!feature) {
        onFeaturePickRef.current?.(null);
        return;
      }
      const featureId = getOlFeatureId(feature);
      if (!featureId) return;
      onFeaturePickRef.current?.({ featureId, layerId });
    };

    // When a vertex drag begins on any feature, treat it as the selected one so
    // the on-screen highlight and attribute row follow the edit.
    const syncSelectionToModified = (features: Collection<OlFeature>) => {
      const feature = features.item(0);
      if (!feature) return;
      if (selected.getLength() !== 1 || selected.item(0) !== feature) {
        selected.clear();
        selected.push(feature);
      }
      const layerId = editLayerIdRef.current;
      const featureId = getOlFeatureId(feature);
      if (layerId && featureId) {
        onFeaturePickRef.current?.({ featureId, layerId });
      }
    };

    editListeners.current.push(
      select.on('select', notifyPick),
      modify.on('modifystart', (evt) => {
        syncSelectionToModified(evt.features as Collection<OlFeature>);
      }),
      modify.on('modifyend', (evt) => {
        syncSelectionToModified(evt.features as Collection<OlFeature>);
        const layerId = editLayerIdRef.current;
        if (!layerId) return;
        evt.features.forEach((feature) => {
          const featureId = getOlFeatureId(feature);
          const geom = feature.getGeometry();
          if (!featureId || !geom) return;
          const geometry = new GeoJSONFormat().writeGeometryObject(geom, {
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:3857',
          }) as GeoFeature['geometry'];
          onGeometryModifiedRef.current?.({ featureId, layerId, geometry });
        });
      }),
    );

    return clearEditInteractions;
  }, [activeTool, editLayerId, clearEditInteractions]);

  useEffect(() => {
    if (!mapInstance.current || activeTool !== 'edit' || !editLayerId) return;
    const select = selectInteraction.current;
    if (!select) return;

    syncEditSelection(editLayerId, selectedFeatureId, select, overlayLayerRefs.current);
  }, [activeTool, editLayerId, selectedFeatureId, overlayLayers]);

  useEffect(() => {
    if (!mapInstance.current || !focusFeature?.featureId || !editLayerId) return;

    const map = mapInstance.current;
    let attempts = 0;

    const tryFocus = () => {
      const olFeature = findOlFeature(editLayerId, focusFeature.featureId, overlayLayerRefs.current);
      if (!olFeature) {
        attempts += 1;
        if (attempts < 10) requestAnimationFrame(tryFocus);
        return;
      }

      const geom = olFeature.getGeometry();
      if (geom) {
        const view = map.getView();
        if (geom.getType() === 'Point') {
          view.animate({
            center: (geom as Point).getCoordinates(),
            zoom: 16,
            duration: 400,
          });
        } else {
          const extent = geom.getExtent();
          if (extent.every(Number.isFinite)) {
            view.fit(extent, {
              padding: [80, 80, 120, 80],
              maxZoom: 18,
              duration: 400,
            });
          }
        }
      }

      if (activeTool === 'edit' && selectInteraction.current) {
        syncEditSelection(editLayerId, focusFeature.featureId, selectInteraction.current, overlayLayerRefs.current);
      }
    };

    tryFocus();
  }, [focusFeature, editLayerId, activeTool, overlayLayers]);

  useEffect(() => {
    if (!mapInstance.current || !snapshotRequest) return;

    const map = mapInstance.current;
    const fitIds = snapshotFitLayerIdsRef.current?.filter(Boolean);

    const restoreStyles = () => {
      const identify = activeToolRef.current === 'info'
        && identifyFeatureIdRef.current
        && identifyLayerIdRef.current
        ? { layerId: identifyLayerIdRef.current, featureId: identifyFeatureIdRef.current }
        : null;
      applyOverlayStyles(map, overlayLayersRef.current, overlayLayerRefs.current, identify);
    };

    const finishCapture = () => {
      onSnapshotRef.current?.(captureMapSnapshot(map));
      restoreStyles();
    };

    const capture = () => {
      finishCapture();
    };

    if (fitIds?.length) {
      fitMapToLayers(map, fitIds, overlayLayerRefs.current, {
        padding: [48, 48, 48, 48],
        maxZoom: 16,
        duration: 0,
      });
    }

    const identify = activeToolRef.current === 'info'
      && identifyFeatureIdRef.current
      && identifyLayerIdRef.current
      ? { layerId: identifyLayerIdRef.current, featureId: identifyFeatureIdRef.current }
      : null;
    applyOverlayStyles(map, overlayLayersRef.current, overlayLayerRefs.current, identify, true);

    map.once('rendercomplete', capture);
    map.renderSync();

    return () => {
      map.un('rendercomplete', capture);
    };
  }, [snapshotRequest]);

  useEffect(() => {
    if (!mapInstance.current || !layoutRevision) return;
    const map = mapInstance.current;
    requestAnimationFrame(() => {
      map.updateSize();
    });
  }, [layoutRevision]);

  const handleZoom = (delta: number) => {
    const map = mapInstance.current;
    const view = map?.getView();
    if (!map || !view) return;

    const currentZoom = view.getZoom();
    if (currentZoom == null) return;

    const size = map.getSize();
    if (!size) return;

    view.animate({
      zoom: currentZoom + delta,
      center: view.getCenter(),
      duration: 200,
    });
  };

  const handleLocate = () => {
    const map = mapInstance.current;
    if (!map) return;

    searchMarkerSource.current.clear();

    const fitIds = fitToLayerIds?.filter(Boolean);
    if (fitIds?.length && fitMapToLayers(map, fitIds, overlayLayerRefs.current)) {
      return;
    }

    const fitTarget = fitToLayerId && overlayLayerRefs.current.get(fitToLayerId)?.getVisible()
      ? fitToLayerId
      : undefined;
    if (fitTarget && fitMapToLayer(map, fitTarget, overlayLayerRefs.current)) {
      return;
    }

    let extent: number[] | null = null;
    overlayLayerRefs.current.forEach((layer) => {
      if (!layer.getVisible()) return;
      const source = layer.getSource();
      if (!source?.getFeatures().length) return;
      const layerExtent = source.getExtent();
      if (!layerExtent.every((v) => Number.isFinite(v))) return;
      extent = extent
        ? [
            Math.min(extent[0], layerExtent[0]),
            Math.min(extent[1], layerExtent[1]),
            Math.max(extent[2], layerExtent[2]),
            Math.max(extent[3], layerExtent[3]),
          ]
        : layerExtent;
    });

    if (extent) {
      map.getView().fit(extent as [number, number, number, number], {
        padding: [80, 80, 80, 80],
        maxZoom: 19,
        duration: 500,
      });
      return;
    }

    const jurisdiction = jurisdictionBboxRef.current;
    if (jurisdiction && applyJurisdictionView(map, jurisdiction, { animate: true, fit: true })) {
      return;
    }

    map.getView().animate({ center: fromLonLat(center), zoom, duration: 500 });
  };

  const props = selectedFeature?.properties as Record<string, unknown> | undefined;
  const blankBasemapActive = basemaps.some(
    (config) => config.id === activeBasemapId && isBlankBasemap(config),
  );

  return (
    <Box position="relative" width="100%" height="100%">
      <Box
        ref={mapRef}
        width="100%"
        height="100%"
        sx={{
          bgcolor: blankBasemapActive ? '#fafafa' : 'transparent',
          '& .ol-viewport': { cursor: 'default' },
        }}
      />

      <Box position="absolute" top={16} left={16} sx={mapZoomControlsSx()} zIndex={20}>
        <Tooltip title="Zoom in">
          <IconButton size="small" onClick={() => handleZoom(1)} sx={mapMapOverlayIconButtonSx()}>
            <ZoomInIcon sx={mapZoomIconSx()} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Zoom out">
          <IconButton size="small" onClick={() => handleZoom(-1)} sx={mapMapOverlayIconButtonSx()}>
            <ZoomOutIcon sx={mapZoomIconSx()} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Fit to layers">
          <IconButton size="small" onClick={handleLocate} sx={mapMapOverlayIconButtonSx()}>
            <MyLocationIcon sx={mapZoomIconSx()} />
          </IconButton>
        </Tooltip>
      </Box>

      <MapNorthScaleBar map={mapForControls} />

      {cursorInspect && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 12,
            right: 12,
            zIndex: 20,
            px: 0,
            py: 0,
            bgcolor: 'transparent',
            pointerEvents: 'none',
            minWidth: 148,
          }}
        >
          <Box display="flex" alignItems="flex-start" gap={0.75} mb={0.35}>
            <LocationOnIcon sx={{ fontSize: 15, color: MAP_CHROME.accent, mt: 0.1, filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.9))' }} />
            <Box>
              <Typography
                variant="caption"
                fontFamily="monospace"
                fontWeight={600}
                fontSize="0.68rem"
                lineHeight={1.2}
                sx={{ textShadow: '0 0 4px rgba(255,255,255,0.95), 0 1px 2px rgba(255,255,255,0.85)' }}
              >
                {cursorInspect.lat.toFixed(5)}°, {cursorInspect.lon.toFixed(5)}°
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                display="block"
                fontSize="0.58rem"
                lineHeight={1.1}
                sx={{ textShadow: '0 0 4px rgba(255,255,255,0.95)' }}
              >
                WGS 84
              </Typography>
            </Box>
          </Box>
          <Box display="flex" alignItems="center" gap={0.75}>
            <TerrainIcon sx={{ fontSize: 15, color: MAP_CHROME.accent, filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.9))' }} />
            <Box flex={1} minWidth={0}>
              <Typography
                variant="caption"
                fontWeight={700}
                fontSize="0.68rem"
                lineHeight={1.2}
                color={cursorInspect.elevation != null ? MAP_CHROME.accentDark : 'text.secondary'}
                sx={{ textShadow: '0 0 4px rgba(255,255,255,0.95), 0 1px 2px rgba(255,255,255,0.85)' }}
              >
                {cursorInspect.elevationLoading
                  ? 'Loading elevation…'
                  : cursorInspect.elevation != null
                    ? formatElevation(cursorInspect.elevation)
                    : 'Elevation unavailable'}
              </Typography>
              {cursorInspect.elevationSource && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                  fontSize="0.56rem"
                  lineHeight={1.1}
                  sx={{ textShadow: '0 0 4px rgba(255,255,255,0.95)' }}
                >
                  {ELEVATION_SOURCE_LABELS[cursorInspect.elevationSource]}
                </Typography>
              )}
            </Box>
          </Box>
        </Box>
      )}

      {selectedFeature && props && activeTool !== 'info' && (
        <Paper elevation={0} sx={{
          position: 'absolute', bottom: 16, left: 72, maxWidth: 360,
          p: 2, maxHeight: 180, overflow: 'auto',
          borderRadius: 2, border: 1, borderColor: 'divider',
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.1)',
        }}>
          <Typography variant="subtitle1" fontWeight={600}>
            {(props.name as string) ?? (props.featureClassName as string) ?? 'Feature'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {props.assetCode
              ? `${props.assetCode as string} · ${props.assetTypeName as string}`
              : (props.featureClassName as string)}
          </Typography>
          {props.status != null ? (
            <Box mt={1} display="flex" gap={1}>
              <Chip label={props.status as string} size="small" color={props.status === 'critical' ? 'error' : 'success'} />
              <Chip label={`Health: ${props.healthScore}%`} size="small" variant="outlined" />
            </Box>
          ) : null}
        </Paper>
      )}
    </Box>
  );
}
