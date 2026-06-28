import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Chip, Divider, Grid, LinearProgress, List, ListItem,
  ListItemText, Paper, Typography,
} from '@mui/material';
import PublishOutlinedIcon from '@mui/icons-material/PublishOutlined';
import type { Feature, FeatureCollection } from 'geojson';
import buffer from '@turf/buffer';
import MapViewer from '../map/MapViewer';
import { UTTARAKHAND_STATE_MAP_VIEW, LA_MAP_BASEMAPS, getDefaultSatelliteBasemapId } from '../../utils/basemapLayers';
import { LA_GIS_VIZ_COLORS, LA_MAP_MARKER_COLORS, LA_MAP_MARKER_LABELS, isClearancePendingApproval } from '../../constants/laGisVisualization';
import LaGisVisualizationLegend from './LaGisVisualizationLegend';
import {
  buildEndpointMarkerFeatures,
  computeNetworkLengthM,
  ensureWgs84FeatureCollection,
  extractNetworkEndpoints,
  groupFeaturesByGeometryType,
  summarizePipelineNetwork,
  toFeatureCollection,
} from '../../utils/pipelineNetworkImport';
import { normalizeMapFeature } from '../../utils/mapGeoJson';
import {
  buildAcquisitionMapPublishHtml,
  type AcquisitionMapPublishMeta,
} from '../../utils/laAcquisitionMapPublish';
import { openLaDocumentHtml } from '../../utils/laDocumentPdf';
import type { MapSnapshotResult } from '../../utils/mapSnapshot';

const PIPELINE_COVER_COLOR = LA_GIS_VIZ_COLORS.road_corridor;
const PIPELINE_CENTERLINE_COLOR = '#1e40af';
const IMPORTED_NETWORK_COLOR = '#ea580c';
const DEFAULT_ROW_WIDTH_M = 6;
const MAX_ROW_WIDTH_M = 50;
const PIPELINE_COVER_FILL = 'rgba(59, 130, 246, 0.48)';
const AFFECTED_MARKER_RADIUS = 5;
const CLEARANCE_MARKER_RADIUS = 4;
const ENDPOINT_START_COLOR = LA_MAP_MARKER_COLORS.networkStart;
const ENDPOINT_END_COLOR = LA_MAP_MARKER_COLORS.networkEnd;
const ENDPOINT_NODE_COLOR = LA_MAP_MARKER_COLORS.networkNode;

export type LaMapClearanceMarker = {
  id: string;
  status: string;
  laParcelId?: string | null;
  label?: string;
  authority?: string | null;
  clearanceType?: string;
  overlayLayerLabel?: string | null;
  khasraNo?: string | null;
};

export type LaMapPipelineInfo = {
  importFileName?: string | null;
  appliedAt?: string | null;
  alignmentLengthM?: number;
};

type Props = {
  geoJson: FeatureCollection | null;
  loading?: boolean;
  /** Session import from Auto Route / AI Route Compare — orange preview overlay */
  importedPipelineNetwork?: FeatureCollection | null;
  /** Original SHP/network filename from session import */
  importFileName?: string | null;
  /** Saved alignment metadata from case detail */
  pipelineInfo?: LaMapPipelineInfo;
  /** Case metadata for published map export */
  publishMeta?: AcquisitionMapPublishMeta;
  /** Show junction node markers only when the network has multiple segments */
  showNetworkNodes?: boolean;
  /** Clearance items — markers at linked parcel centroids with authority labels */
  clearances?: LaMapClearanceMarker[];
  /** Open Auto Route dialog from the pipeline warning banner */
  onOpenAutoRoute?: () => void;
};

type MarkerTooltip = {
  title: string;
  lines: string[];
};

type OverlayLayer = {
  id: string;
  name: string;
  visible: boolean;
  geometryType: 'Point' | 'LineString' | 'Polygon';
  features: FeatureCollection;
  style: Record<string, unknown>;
  zIndex?: number;
};

function featureLayer(feature: Feature): string {
  return String((feature.properties as Record<string, unknown>)?.layer ?? 'other');
}

function isPolygonFeature(feature: Feature): boolean {
  const type = feature.geometry?.type;
  if (type !== 'Polygon' && type !== 'MultiPolygon') return false;
  const coords = feature.geometry?.coordinates;
  return Array.isArray(coords) && coords.length > 0;
}

function inferRowWidthM(features: Feature[]): number {
  for (const feature of features) {
    const props = (feature.properties ?? {}) as Record<string, unknown>;
    const raw = props.rowWidthM ?? props.row_width_m ?? props.rowWidth ?? props.row_width;
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_ROW_WIDTH_M;
}

function coerceWgs84Coord(coord: unknown): [number, number] | null {
  if (!Array.isArray(coord) || coord.length < 2) return null;
  const lon = Number(coord[0]);
  const lat = Number(coord[1]);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  if (Math.abs(lon) > 180 || Math.abs(lat) > 90) return null;
  return [lon, lat];
}

function isValidWgs84Coord(coord: unknown): coord is [number, number] {
  return coerceWgs84Coord(coord) != null;
}

function ringCentroid(ring: number[][]): [number, number] | null {
  if (!ring.length) return null;
  let sumX = 0;
  let sumY = 0;
  let count = 0;
  for (const coord of ring) {
    if (isValidWgs84Coord(coord)) {
      sumX += coord[0];
      sumY += coord[1];
      count += 1;
    }
  }
  if (!count) return null;
  return [sumX / count, sumY / count];
}

function featureCentroid(feature: Feature): [number, number] | null {
  const geom = feature.geometry;
  if (!geom) return null;
  if (geom.type === 'Point' && isValidWgs84Coord(geom.coordinates)) {
    return [geom.coordinates[0], geom.coordinates[1]];
  }
  if (geom.type === 'Polygon' && Array.isArray(geom.coordinates)) {
    const ring = (geom.coordinates as number[][][])[0] ?? [];
    return ringCentroid(ring);
  }
  if (geom.type === 'MultiPolygon' && Array.isArray(geom.coordinates)) {
    const firstPoly = (geom.coordinates as number[][][][])[0];
    const ring = firstPoly?.[0] ?? [];
    return ringCentroid(ring);
  }
  return null;
}

function formatCoord(coord: [number, number] | null | undefined): string {
  if (!coord) return '—';
  return `${coord[1].toFixed(5)}°N, ${coord[0].toFixed(5)}°E`;
}

function shortAuthorityLabel(authority: string | null | undefined): string {
  if (!authority?.trim()) return 'Authority TBD';
  const value = authority.trim();
  if (/forest/i.test(value)) return 'Forest Dept';
  if (/revenue|pwd|public works/i.test(value)) return 'Revenue/PWD';
  if (/nhai|national highway/i.test(value)) return 'NHAI';
  if (/railway|rail/i.test(value)) return 'Railway';
  if (/gram panchayat|gram sabha/i.test(value)) return 'Gram Panchayat';
  if (value.length <= 20) return value;
  return `${value.slice(0, 18)}…`;
}

function buildParcelAuthorityMap(clearances: LaMapClearanceMarker[] | undefined): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const clearance of clearances ?? []) {
    const parcelId = clearance.laParcelId?.replace(/^parcel-/, '');
    const authority = clearance.authority?.trim();
    if (!parcelId || !authority) continue;
    const list = map.get(parcelId) ?? [];
    const short = shortAuthorityLabel(authority);
    if (!list.includes(short)) list.push(short);
    map.set(parcelId, list);
  }
  return map;
}

function parcelIdFromFeature(parcel: Feature): string {
  const rawId = parcel.id ?? (parcel.properties as Record<string, unknown>)?.id;
  return String(rawId ?? '').replace(/^parcel-/, '');
}

function flattenLineFeatures(features: Feature[]): Feature[] {
  const lines: Feature[] = [];
  for (const raw of features) {
    const feature = normalizeMapFeature(raw) ?? raw;
    const geom = feature.geometry;
    if (!geom) continue;
    if (geom.type === 'LineString') {
      lines.push(feature);
    } else if (geom.type === 'MultiLineString' && Array.isArray(geom.coordinates)) {
      for (const coords of geom.coordinates as number[][][]) {
        lines.push({
          ...feature,
          geometry: { type: 'LineString', coordinates: coords },
        });
      }
    } else if (geom.type === 'GeometryCollection' && Array.isArray(geom.geometries)) {
      for (const sub of geom.geometries) {
        if (sub.type === 'LineString' || sub.type === 'MultiLineString') {
          lines.push({ ...feature, geometry: sub });
        }
      }
    }
  }
  return lines;
}

function isUsableLineFeature(feature: Feature): boolean {
  const geom = feature.geometry;
  if (!geom || geom.type !== 'LineString' || !Array.isArray(geom.coordinates)) return false;
  const coords = geom.coordinates as unknown[];
  if (coords.length < 2) return false;
  const unique = new Set<string>();
  for (const raw of coords) {
    const coord = coerceWgs84Coord(raw);
    if (!coord) return false;
    unique.add(`${coord[0].toFixed(6)},${coord[1].toFixed(6)}`);
  }
  return unique.size >= 2;
}

function withCoercedLineCoords(feature: Feature): Feature | null {
  if (!isUsableLineFeature(feature)) return null;
  const coords = ((feature.geometry as { coordinates: unknown[] }).coordinates ?? [])
    .map(coerceWgs84Coord)
    .filter((c): c is [number, number] => c != null);
  if (coords.length < 2) return null;
  const unique = new Set(coords.map((c) => `${c[0].toFixed(6)},${c[1].toFixed(6)}`));
  if (unique.size < 2) return null;
  return {
    ...feature,
    geometry: { type: 'LineString', coordinates: coords },
  };
}

function normalizeLineFeatures(features: Feature[]): Feature[] {
  return flattenLineFeatures(features)
    .map(withCoercedLineCoords)
    .filter((f): f is Feature => f != null);
}

function hasPointOnlyPipelineGeometry(features: Feature[]): boolean {
  for (const raw of features) {
    const feature = normalizeMapFeature(raw) ?? raw;
    const type = feature.geometry?.type;
    if (type === 'Point' || type === 'MultiPoint') return true;
  }
  return false;
}

function polygonOuterRing(feature: Feature): number[][] {
  const geom = feature.geometry;
  if (!geom) return [];
  if (geom.type === 'Polygon') return (geom.coordinates as number[][][])[0] ?? [];
  if (geom.type === 'MultiPolygon') return (geom.coordinates as number[][][][])[0]?.[0] ?? [];
  return [];
}

/** Detect circular buffers from Point geometry (PostGIS/turf use many vertices — not a small ring). */
function isLikelyPointBufferPolygon(feature: Feature): boolean {
  const ring = polygonOuterRing(feature);
  if (ring.length < 4) return false;

  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const coord of ring) {
    const c = coerceWgs84Coord(coord);
    if (!c) continue;
    minLon = Math.min(minLon, c[0]);
    maxLon = Math.max(maxLon, c[0]);
    minLat = Math.min(minLat, c[1]);
    maxLat = Math.max(maxLat, c[1]);
  }
  if (!Number.isFinite(minLon)) return false;

  const width = maxLon - minLon;
  const height = maxLat - minLat;
  const maxDim = Math.max(width, height);
  const minDim = Math.min(width, height) || maxDim;
  const aspect = maxDim / minDim;

  // Line ROW buffers are elongated; point buffers are compact and roughly square.
  if (aspect < 2.2) {
    const centroid = ringCentroid(ring);
    if (!centroid) return true;
    let maxDist = 0;
    let minDist = Infinity;
    for (const coord of ring) {
      const c = coerceWgs84Coord(coord);
      if (!c) continue;
      const dist = Math.hypot(c[0] - centroid[0], c[1] - centroid[1]);
      maxDist = Math.max(maxDist, dist);
      minDist = Math.min(minDist, dist);
    }
    if (!Number.isFinite(minDist) || minDist <= 0) return true;
    if (maxDist / minDist < 1.45) return true;
  }

  // Very small square bbox at high zoom is almost always a point buffer artifact.
  return maxDim < 0.00008 && aspect < 3;
}

function buildRowCoverFromLines(lines: Feature[], rowWidthM: number): Feature[] {
  const safeWidth = Math.min(Math.max(rowWidthM, 1), MAX_ROW_WIDTH_M);
  const covers: Feature[] = [];
  for (const raw of lines) {
    const line = withCoercedLineCoords(raw);
    if (!line) continue;
    try {
      const poly = buffer(line, safeWidth, { units: 'meters', steps: 12 });
      if (!poly?.geometry) continue;
      covers.push({
        ...poly,
        properties: {
          layer: 'corridor',
          vizCategory: 'road_corridor',
          markerColor: PIPELINE_COVER_COLOR,
        },
      });
    } catch {
      // skip invalid geometry
    }
  }
  return covers;
}

/** Prefer client-side ROW buffer from centerlines; never show server point-buffer circles without a line route. */
function resolveCoverFeatures(corridors: Feature[], alignments: Feature[]): Feature[] {
  const normalizedAlignments = normalizeLineFeatures(alignments);
  const rowWidthM = inferRowWidthM([...normalizedAlignments, ...corridors]);
  if (normalizedAlignments.length) {
    return buildRowCoverFromLines(normalizedAlignments, rowWidthM);
  }
  return corridors.filter((feature) => isPolygonFeature(feature) && !isLikelyPointBufferPolygon(feature));
}

function resolvePipelineMapIssue(
  alignments: Feature[],
  corridors: Feature[],
  normalizedAlignments: Feature[],
): string | null {
  if (normalizedAlignments.length) return null;
  if (!alignments.length && !corridors.length) return null;
  if (hasPointOnlyPipelineGeometry(alignments)) {
    return 'Pipeline alignment is stored as a point, not a route line. Apply route or import line network first.';
  }
  return 'Apply route or import line network first — the map needs a LineString pipeline centerline along the full route.';
}

function buildAffectedParcelMarkers(
  parcels: Feature[],
  parcelAuthorities: Map<string, string[]>,
): Feature[] {
  const markers: Feature[] = [];
  for (const parcel of parcels) {
    const centroid = featureCentroid(parcel);
    if (!centroid) continue;
    const props = (parcel.properties ?? {}) as Record<string, unknown>;
    const parcelId = parcelIdFromFeature(parcel);
    const authorities = parcelAuthorities.get(parcelId) ?? [];
    const khasraNo = props.khasraNo != null ? String(props.khasraNo) : undefined;
    const mapLabel = authorities.length
      ? undefined
      : (khasraNo ? `Khasra ${khasraNo}` : LA_MAP_MARKER_LABELS.affectedParcel);
    markers.push({
      type: 'Feature',
      id: `affected-marker-${String(parcel.id ?? props.khasraNo ?? markers.length)}`,
      properties: {
        layer: 'affected_marker',
        label: LA_MAP_MARKER_LABELS.affectedParcel,
        mapLabel,
        markerColor: LA_MAP_MARKER_COLORS.affectedParcel,
        pointRadius: AFFECTED_MARKER_RADIUS,
        khasraNo,
        village: props.village,
        authorities: authorities.join(', '),
        markerKind: 'affected_parcel',
      },
      geometry: { type: 'Point', coordinates: centroid },
    });
  }
  return markers;
}

function buildClearanceMarkers(
  clearances: LaMapClearanceMarker[] | undefined,
  parcels: Feature[],
): Feature[] {
  if (!clearances?.length) return [];
  const parcelById = new Map<string, Feature>();
  for (const parcel of parcels) {
    const rawId = parcel.id ?? (parcel.properties as Record<string, unknown>)?.id;
    if (rawId != null) {
      parcelById.set(String(rawId).replace(/^parcel-/, ''), parcel);
      parcelById.set(String(rawId), parcel);
    }
  }

  const grouped = new Map<string, {
    centroid: [number, number];
    parcel: Feature;
    items: LaMapClearanceMarker[];
  }>();

  for (const clearance of clearances) {
    const parcelId = clearance.laParcelId?.replace(/^parcel-/, '');
    const parcel = parcelId ? parcelById.get(parcelId) : undefined;
    const centroid = parcel ? featureCentroid(parcel) : null;
    if (!centroid || !parcelId) continue;
    const key = `${parcelId}:${centroid[0].toFixed(5)},${centroid[1].toFixed(5)}`;
    const bucket = grouped.get(key) ?? { centroid, parcel, items: [] };
    bucket.items.push(clearance);
    grouped.set(key, bucket);
  }

  const markers: Feature[] = [];
  for (const [key, group] of grouped.entries()) {
    const authorities = [...new Set(
      group.items
        .map((item) => shortAuthorityLabel(item.authority))
        .filter(Boolean),
    )];
    const pending = group.items.some((item) => isClearancePendingApproval(item.status));
    const primary = group.items[0];
    const parcelProps = (group.parcel.properties ?? {}) as Record<string, unknown>;
    const khasraNo = primary.khasraNo
      ?? (parcelProps.khasraNo != null ? String(parcelProps.khasraNo) : undefined);
    const clearanceSummary = group.items
      .map((item) => String(item.label ?? item.clearanceType ?? 'Clearance'))
      .join('; ');

    markers.push({
      type: 'Feature',
      id: `clearance-marker-${key}`,
      properties: {
        layer: 'clearance_marker',
        label: primary.label ?? LA_MAP_MARKER_LABELS.clearancePending,
        mapLabel: authorities.join(' · ') || shortAuthorityLabel(primary.authority),
        markerColor: pending ? LA_MAP_MARKER_COLORS.clearancePending : '#16a34a',
        pointRadius: pending ? CLEARANCE_MARKER_RADIUS : 3,
        pointRing: pending,
        clearanceId: primary.id,
        authority: authorities.join(', ') || primary.authority,
        clearanceType: clearanceSummary,
        overlayLayerLabel: group.items
          .map((item) => item.overlayLayerLabel)
          .filter(Boolean)
          .join(', ') || primary.overlayLayerLabel,
        status: pending ? 'pending' : 'approved',
        khasraNo,
        markerKind: 'clearance',
      },
      geometry: { type: 'Point', coordinates: group.centroid },
    });
  }
  return markers;
}

function partitionGeoJson(geoJson: FeatureCollection | null) {
  const parcels: Feature[] = [];
  const alignments: Feature[] = [];
  const corridors: Feature[] = [];

  for (const raw of geoJson?.features ?? []) {
    const feature = normalizeMapFeature(raw);
    if (!feature) continue;
    const layer = featureLayer(feature);
    if (layer === 'parcel') parcels.push(feature);
    else if (layer === 'alignment') alignments.push(feature);
    else if (layer === 'corridor') corridors.push(feature);
  }

  return { parcels, alignments, corridors };
}

function buildOverlayLayers(
  geoJson: FeatureCollection | null,
  importedPipelineNetwork: FeatureCollection | null | undefined,
  showNetworkNodes: boolean,
  clearances: LaMapClearanceMarker[] | undefined,
): OverlayLayer[] {
  const { parcels, alignments, corridors } = partitionGeoJson(geoJson);
  const normalizedAlignments = normalizeLineFeatures(alignments);
  const hasSavedPipeline = normalizedAlignments.length > 0;
  const layers: OverlayLayer[] = [];

  const groupedImported = importedPipelineNetwork
    ? groupFeaturesByGeometryType(importedPipelineNetwork)
    : { points: [], lines: [], polygons: [] };
  const importedLines = normalizeLineFeatures(groupedImported.lines);
  const showImportedNetwork = importedLines.length > 0;
  const parcelAuthorities = buildParcelAuthorityMap(clearances);

  if (parcels.length) {
    layers.push({
      id: 'la-parcel',
      name: 'Affected Parcels',
      visible: true,
      geometryType: 'Polygon',
      features: { type: 'FeatureCollection', features: parcels },
      style: { fillOpacity: 0.32, strokeWidth: 2 },
      zIndex: 24,
    });
  }

  const coverFeatures = resolveCoverFeatures(corridors, alignments);

  if (coverFeatures.length) {
    layers.push({
      id: 'la-corridor',
      name: 'Pipeline Cover',
      visible: true,
      geometryType: 'Polygon',
      features: { type: 'FeatureCollection', features: coverFeatures },
      style: {
        stroke: PIPELINE_COVER_COLOR,
        strokeWidth: 2,
        fill: PIPELINE_COVER_FILL,
        fillOpacity: 0.48,
      },
      zIndex: 26,
    });
  }

  if (normalizedAlignments.length) {
    layers.push({
      id: 'la-alignment',
      name: hasSavedPipeline && showImportedNetwork ? 'Applied Pipeline Alignment' : 'Pipeline Alignment',
      visible: true,
      geometryType: 'LineString',
      features: { type: 'FeatureCollection', features: normalizedAlignments },
      style: { stroke: PIPELINE_CENTERLINE_COLOR, strokeWidth: 5 },
      zIndex: 28,
    });
  }

  if (showImportedNetwork) {
    if (importedLines.length) {
      const importedRowWidth = hasSavedPipeline
        ? DEFAULT_ROW_WIDTH_M
        : inferRowWidthM([...normalizedAlignments, ...corridors]);
      const importedCovers = buildRowCoverFromLines(importedLines, importedRowWidth);
      if (importedCovers.length && !hasSavedPipeline) {
        layers.push({
          id: 'la-imported-cover',
          name: 'Imported Pipeline Cover',
          visible: true,
          geometryType: 'Polygon',
          features: toFeatureCollection(importedCovers),
          style: {
            stroke: IMPORTED_NETWORK_COLOR,
            strokeWidth: 2,
            fill: 'rgba(234, 88, 12, 0.28)',
            fillOpacity: 0.28,
          },
          zIndex: 26,
        });
      }
      layers.push({
        id: 'la-imported-lines',
        name: hasSavedPipeline ? 'Imported Network (preview)' : 'Imported Pipeline Network',
        visible: true,
        geometryType: 'LineString',
        features: toFeatureCollection(importedLines),
        style: {
          stroke: IMPORTED_NETWORK_COLOR,
          strokeWidth: hasSavedPipeline ? 3 : 4,
          strokeOpacity: hasSavedPipeline ? 0.75 : 1,
        },
        zIndex: hasSavedPipeline ? 27 : 28,
      });
    }
    if (groupedImported.polygons.length && !hasSavedPipeline) {
      layers.push({
        id: 'la-imported-polygons',
        name: 'Imported Network Polygons',
        visible: true,
        geometryType: 'Polygon',
        features: toFeatureCollection(groupedImported.polygons.filter((f) => !isLikelyPointBufferPolygon(f))),
        style: { fill: IMPORTED_NETWORK_COLOR, fillOpacity: 0.18, stroke: IMPORTED_NETWORK_COLOR, strokeWidth: 2 },
      });
    }
  }

  const affectedMarkers = buildAffectedParcelMarkers(parcels, parcelAuthorities);
  if (affectedMarkers.length) {
    layers.push({
      id: 'la-affected-markers',
      name: 'Affected Parcel Markers',
      visible: true,
      geometryType: 'Point',
      features: toFeatureCollection(affectedMarkers),
      style: {},
      zIndex: 30,
    });
  }

  const clearanceMarkers = buildClearanceMarkers(clearances, parcels);
  if (clearanceMarkers.length) {
    layers.push({
      id: 'la-clearance-markers',
      name: 'Clearance Authority Markers',
      visible: true,
      geometryType: 'Point',
      features: toFeatureCollection(clearanceMarkers),
      style: {},
      zIndex: 31,
    });
  }

  const endpointSourceLines = normalizedAlignments.length
    ? toFeatureCollection(normalizedAlignments)
    : (showImportedNetwork && importedLines.length
      ? toFeatureCollection(importedLines)
      : null);

  const includeNetworkNodes = showNetworkNodes && normalizedAlignments.length > 1;

  if (endpointSourceLines?.features.length) {
    const endpointFeatures = buildEndpointMarkerFeatures(endpointSourceLines, includeNetworkNodes);
    if (endpointFeatures.length) {
      layers.push({
        id: 'la-endpoints',
        name: 'Network Endpoints',
        visible: true,
        geometryType: 'Point',
        features: toFeatureCollection(endpointFeatures),
        style: { stroke: '#ffffff', strokeWidth: 2 },
        zIndex: 32,
      });
    }
  }

  return layers;
}

const NETWORK_FIT_LAYER_ORDER = [
  'la-alignment',
  'la-corridor',
  'la-imported-lines',
  'la-imported-cover',
  'la-imported-polygons',
  'la-parcel',
  'la-endpoints',
  'la-affected-markers',
  'la-clearance-markers',
] as const;

function resolveNetworkFitLayerIds(overlayLayers: OverlayLayer[]): string[] {
  const present = new Set(overlayLayers.map((layer) => layer.id));
  return NETWORK_FIT_LAYER_ORDER.filter((id) => present.has(id));
}

export default function LaMapPanel({
  geoJson,
  loading,
  importedPipelineNetwork,
  importFileName,
  pipelineInfo,
  publishMeta,
  showNetworkNodes = false,
  clearances,
  onOpenAutoRoute,
}: Props) {
  const [fitRevision, setFitRevision] = useState(0);
  const [mapInitRevision, setMapInitRevision] = useState(0);
  const [snapshotRequest, setSnapshotRequest] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [markerTooltip, setMarkerTooltip] = useState<MarkerTooltip | null>(null);
  const pendingPublishRef = useRef(false);

  const sessionImportedNetwork = useMemo(() => {
    if (!importedPipelineNetwork?.features.length) return null;
    return ensureWgs84FeatureCollection(importedPipelineNetwork);
  }, [importedPipelineNetwork]);

  const sessionImportedLines = useMemo(
    () => normalizeLineFeatures(groupFeaturesByGeometryType(sessionImportedNetwork ?? { type: 'FeatureCollection', features: [] }).lines),
    [sessionImportedNetwork],
  );

  const importedSummary = useMemo(
    () => (sessionImportedNetwork ? summarizePipelineNetwork(sessionImportedNetwork) : null),
    [sessionImportedNetwork],
  );

  useEffect(() => {
    setFitRevision((r) => r + 1);
    setMapInitRevision((r) => r + 1);
  }, [geoJson, sessionImportedNetwork]);

  const overlayLayers = useMemo(
    () => buildOverlayLayers(geoJson, sessionImportedNetwork, showNetworkNodes, clearances),
    [geoJson, sessionImportedNetwork, showNetworkNodes, clearances],
  );

  const networkFitLayerIds = useMemo(
    () => resolveNetworkFitLayerIds(overlayLayers),
    [overlayLayers],
  );

  const { parcels, alignments, corridors } = useMemo(() => partitionGeoJson(geoJson), [geoJson]);
  const normalizedAlignments = useMemo(
    () => normalizeLineFeatures(alignments),
    [alignments],
  );
  const hasSavedPipeline = normalizedAlignments.length > 0;
  const showImportedNetwork = sessionImportedLines.length > 0;
  const includeNetworkNodes = showNetworkNodes && normalizedAlignments.length > 1;
  const rowWidthM = useMemo(
    () => inferRowWidthM([...normalizedAlignments, ...corridors]),
    [normalizedAlignments, corridors],
  );

  const pipelineSummary = useMemo(() => {
    const appliedFc = normalizedAlignments.length
      ? toFeatureCollection(normalizedAlignments)
      : null;
    const previewFc = showImportedNetwork && !hasSavedPipeline && sessionImportedNetwork
      ? sessionImportedNetwork
      : null;
    const lengthSource = appliedFc ?? previewFc;
    const computedLengthM = lengthSource ? computeNetworkLengthM(lengthSource) : 0;
    const totalLengthM = pipelineInfo?.alignmentLengthM && pipelineInfo.alignmentLengthM > 0
      ? pipelineInfo.alignmentLengthM
      : computedLengthM;

    const endpointSource = appliedFc ?? (sessionImportedLines.length
      ? toFeatureCollection(sessionImportedLines)
      : null);
    const endpoints = endpointSource ? extractNetworkEndpoints(endpointSource) : null;

    const villages = [...new Set(
      parcels
        .map((p) => String((p.properties as Record<string, unknown>)?.village ?? '').trim())
        .filter(Boolean),
    )].sort((a, b) => a.localeCompare(b));

    return {
      totalLengthM,
      rowWidthM,
      segmentCount: normalizedAlignments.length || sessionImportedLines.length,
      startCoord: endpoints?.start ?? null,
      endCoord: endpoints?.end ?? null,
      villages,
      villageCount: villages.length,
    };
  }, [
    normalizedAlignments,
    showImportedNetwork,
    hasSavedPipeline,
    sessionImportedNetwork,
    sessionImportedLines,
    pipelineInfo?.alignmentLengthM,
    parcels,
  ]);

  const affectedAuthorities = useMemo(() => {
    const unique = new Map<string, { authority: string; count: number; pending: number }>();
    for (const clearance of clearances ?? []) {
      const authority = clearance.authority?.trim();
      if (!authority) continue;
      const short = shortAuthorityLabel(authority);
      const existing = unique.get(short) ?? { authority: short, count: 0, pending: 0 };
      existing.count += 1;
      if (isClearancePendingApproval(clearance.status)) existing.pending += 1;
      unique.set(short, existing);
    }
    return [...unique.values()].sort((a, b) => a.authority.localeCompare(b.authority));
  }, [clearances]);

  const enrichedPublishMeta = useMemo((): AcquisitionMapPublishMeta | undefined => {
    if (!publishMeta) return undefined;
    return {
      ...publishMeta,
      alignmentLengthM: pipelineSummary.totalLengthM || publishMeta.alignmentLengthM,
      rowWidthM: pipelineSummary.rowWidthM,
      segmentCount: pipelineSummary.segmentCount,
      villageCount: pipelineSummary.villageCount,
      villages: pipelineSummary.villages,
      startCoord: formatCoord(pipelineSummary.startCoord),
      endCoord: formatCoord(pipelineSummary.endCoord),
      importSourceName: importFileName ?? pipelineInfo?.importFileName ?? undefined,
      importedSegmentCount: sessionImportedLines.length || undefined,
      appliedAt: pipelineInfo?.appliedAt ?? undefined,
      affectedAuthorities: affectedAuthorities.map((a) => a.authority),
      clearances: (clearances ?? []).map((c) => ({
        label: String(c.label ?? c.clearanceType ?? 'Clearance'),
        authority: c.authority ? String(c.authority) : undefined,
        status: String(c.status),
        overlayLayer: c.overlayLayerLabel ? String(c.overlayLayerLabel) : undefined,
      })),
    };
  }, [
    publishMeta,
    pipelineSummary,
    importFileName,
    pipelineInfo,
    sessionImportedLines.length,
    affectedAuthorities,
    clearances,
  ]);

  const affectedMarkerCount = parcels.length;
  const pendingClearanceCount = useMemo(
    () => (clearances ?? []).filter((c) => isClearancePendingApproval(c.status)).length,
    [clearances],
  );

  const legendExtras = useMemo(() => {
    const items: Array<{ label: string; color: string; variant: 'square' | 'circle' | 'line' | 'ring' }> = [];
    if (normalizedAlignments.length || (showImportedNetwork && !hasSavedPipeline)) {
      items.push({ label: 'Pipeline Cover (ROW)', color: PIPELINE_COVER_COLOR, variant: 'square' });
    }
    if (hasSavedPipeline) {
      items.push({ label: 'Applied Pipeline Centerline', color: PIPELINE_CENTERLINE_COLOR, variant: 'line' });
    }
    if (showImportedNetwork) {
      items.push({
        label: hasSavedPipeline ? 'Imported Network (preview)' : 'Imported Network (first)',
        color: IMPORTED_NETWORK_COLOR,
        variant: 'line',
      });
    }
    if (affectedMarkerCount) {
      items.push({
        label: 'Affected Parcel + Authority',
        color: LA_MAP_MARKER_COLORS.affectedParcel,
        variant: 'circle',
      });
    }
    if ((clearances ?? []).length) {
      items.push({
        label: 'Clearance Authority Label',
        color: LA_MAP_MARKER_COLORS.clearancePending,
        variant: 'ring',
      });
    }
    const hasEndpoints = normalizedAlignments.length > 0 || showImportedNetwork;
    if (hasEndpoints) {
      items.push({ label: LA_MAP_MARKER_LABELS.networkStart, color: ENDPOINT_START_COLOR, variant: 'circle' });
      items.push({ label: LA_MAP_MARKER_LABELS.networkEnd, color: ENDPOINT_END_COLOR, variant: 'circle' });
      if (includeNetworkNodes) {
        items.push({ label: LA_MAP_MARKER_LABELS.networkNode, color: ENDPOINT_NODE_COLOR, variant: 'circle' });
      }
    }
    return items;
  }, [
    normalizedAlignments.length,
    showImportedNetwork,
    hasSavedPipeline,
    affectedMarkerCount,
    clearances,
    includeNetworkNodes,
  ]);

  const handleMarkerIdentify = useCallback((pick: { properties: Record<string, unknown> }) => {
    const props = pick.properties;
    const kind = String(props.markerKind ?? '');
    if (kind === 'clearance') {
      setMarkerTooltip({
        title: shortAuthorityLabel(props.authority as string | undefined),
        lines: [
          `Clearance: ${String(props.clearanceType ?? props.label ?? '—')}`,
          `Authority: ${String(props.authority ?? '—')}`,
          `GIS layer: ${String(props.overlayLayerLabel ?? '—')}`,
          `Khasra: ${String(props.khasraNo ?? '—')}`,
          `Status: ${String(props.status ?? '—')}`,
        ],
      });
      return;
    }
    if (kind === 'affected_parcel') {
      setMarkerTooltip({
        title: String(props.mapLabel ?? LA_MAP_MARKER_LABELS.affectedParcel),
        lines: [
          `Khasra: ${String(props.khasraNo ?? '—')}`,
          `Village: ${String(props.village ?? '—')}`,
          props.authorities ? `Authorities: ${String(props.authorities)}` : 'No statutory clearance linked yet',
        ].filter(Boolean),
      });
      return;
    }
    setMarkerTooltip(null);
  }, []);

  const handlePublishSnapshot = (result: MapSnapshotResult) => {
    if (!pendingPublishRef.current) return;
    pendingPublishRef.current = false;
    setPublishing(false);

    const html = buildAcquisitionMapPublishHtml(result.dataUrl, enrichedPublishMeta ?? {
      caseNo: 'LA Case',
      title: 'Pipeline Acquisition',
    });
    openLaDocumentHtml(html, `Acquisition Map — ${publishMeta?.caseNo ?? 'LA Case'}`);
  };

  const publishMap = () => {
    pendingPublishRef.current = true;
    setPublishing(true);
    setSnapshotRequest((r) => r + 1);
  };

  const pipelineMapIssue = useMemo(() => {
    if (hasSavedPipeline || showImportedNetwork) return null;
    return resolvePipelineMapIssue(alignments, corridors, normalizedAlignments);
  }, [alignments, corridors, normalizedAlignments, hasSavedPipeline, showImportedNetwork]);

  const fitToLayerIds = networkFitLayerIds.length ? networkFitLayerIds : undefined;

  const hasMapContent = (geoJson?.features?.length ?? 0) > 0
    || sessionImportedLines.length > 0;

  const renderDetailRow = (label: string, value: string) => (
    <Box key={label} display="flex" justifyContent="space-between" gap={1} py={0.35}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="caption" fontWeight={600} textAlign="right">{value}</Typography>
    </Box>
  );

  if (loading) {
    return (
      <Box py={4}>
        <LinearProgress />
        <Typography variant="body2" color="text.secondary" align="center" mt={2}>Loading map…</Typography>
      </Box>
    );
  }

  if (!hasMapContent) {
    return (
      <Box py={4} textAlign="center">
        <Typography variant="body2" color="text.secondary">
          Trace alignment and identify parcels to view acquisition geometry on the map.
          Import a pipeline network in Auto Route to preview the pipe cover before applying.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
      {publishMeta && (
        <Box
          px={1.5}
          py={1}
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          flexWrap="wrap"
          gap={1}
          bgcolor="background.paper"
          borderBottom="1px solid"
          borderColor="divider"
        >
          <Typography variant="caption" color="text.secondary">
            Blue applied pipeline, orange imported preview, authority labels on markers — click a marker for clearance detail
          </Typography>
          <Button
            size="small"
            variant="contained"
            startIcon={<PublishOutlinedIcon />}
            disabled={publishing || !hasMapContent}
            onClick={publishMap}
          >
            {publishing ? 'Capturing…' : 'Publish Acquisition Map'}
          </Button>
        </Box>
      )}
      {pipelineMapIssue && (
        <Alert
          severity="warning"
          sx={{ borderRadius: 0 }}
          action={onOpenAutoRoute ? (
            <Button color="inherit" size="small" onClick={onOpenAutoRoute}>
              Open Auto Route
            </Button>
          ) : undefined}
        >
          {pipelineMapIssue}
          <Typography component="span" variant="body2" display="block" sx={{ mt: 0.5 }}>
            {onOpenAutoRoute
              ? 'Use Auto Route → Import pipeline network → Apply & Trace to save the full route line on this map.'
              : 'Open Auto Route → Import pipeline network → Apply & Trace to save the full route line.'}
          </Typography>
        </Alert>
      )}
      <Grid container>
        <Grid item xs={12} lg={8}>
          <Box sx={{ height: 420, position: 'relative' }}>
            <MapViewer
              basemaps={LA_MAP_BASEMAPS}
              activeBasemapId={getDefaultSatelliteBasemapId()}
              overlayLayers={overlayLayers}
              center={UTTARAKHAND_STATE_MAP_VIEW.center}
              zoom={UTTARAKHAND_STATE_MAP_VIEW.zoom}
              jurisdictionBbox={UTTARAKHAND_STATE_MAP_VIEW.bbox}
              jurisdictionRevision={mapInitRevision}
              fitToLayerId={undefined}
              fitToLayerIds={fitToLayerIds}
              fitRevision={fitRevision}
              snapshotRequest={snapshotRequest}
              snapshotFitLayerIds={networkFitLayerIds}
              onSnapshot={handlePublishSnapshot}
              onFeatureIdentify={(pick) => handleMarkerIdentify(pick)}
              onIdentifyClear={() => setMarkerTooltip(null)}
            />
            {markerTooltip && (
              <Paper
                elevation={4}
                sx={{
                  position: 'absolute',
                  left: 12,
                  bottom: 12,
                  zIndex: 5,
                  p: 1.25,
                  maxWidth: 280,
                  bgcolor: 'background.paper',
                }}
              >
                <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                  {markerTooltip.title}
                </Typography>
                {markerTooltip.lines.map((line) => (
                  <Typography key={line} variant="caption" display="block" color="text.secondary">
                    {line}
                  </Typography>
                ))}
                <Button size="small" sx={{ mt: 0.5, p: 0, minWidth: 0 }} onClick={() => setMarkerTooltip(null)}>
                  Dismiss
                </Button>
              </Paper>
            )}
          </Box>
        </Grid>
        <Grid item xs={12} lg={4} sx={{ borderLeft: { lg: '1px solid' }, borderColor: { lg: 'divider' }, bgcolor: 'grey.50' }}>
          <Box p={1.5}>
            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
              Pipeline Details
            </Typography>
            {renderDetailRow('Total length', pipelineSummary.totalLengthM
              ? `${Math.round(pipelineSummary.totalLengthM).toLocaleString('en-IN')} m`
              : '—')}
            {renderDetailRow('ROW width', `${pipelineSummary.rowWidthM} m`)}
            {renderDetailRow('Segments', String(pipelineSummary.segmentCount || '—'))}
            {renderDetailRow('Start', formatCoord(pipelineSummary.startCoord))}
            {renderDetailRow('End', formatCoord(pipelineSummary.endCoord))}
            {renderDetailRow(
              'Villages crossed',
              pipelineSummary.villageCount
                ? `${pipelineSummary.villageCount}${pipelineSummary.villages.length
                  ? ` (${pipelineSummary.villages.slice(0, 3).join(', ')}${pipelineSummary.villages.length > 3 ? '…' : ''})`
                  : ''}`
                : '—',
            )}

            <Divider sx={{ my: 1.25 }} />

            {showImportedNetwork && (
              <>
                <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                  Imported Network (preview)
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" mb={0.75}>
                  Original SHP/network imported first — shown in orange until applied alignment replaces the preview ROW.
                </Typography>
                {renderDetailRow('Source file', importFileName ?? pipelineInfo?.importFileName ?? 'Session import')}
                {renderDetailRow(
                  'Features',
                  `${importedSummary?.featureCount ?? sessionImportedLines.length} · ${importedSummary?.lineCount ?? sessionImportedLines.length} line(s)`,
                )}
                {hasSavedPipeline && (
                  <Chip
                    size="small"
                    color="warning"
                    variant="outlined"
                    label="Orange overlay = imported first; blue line = applied & saved"
                    sx={{ mt: 0.5, height: 'auto', '& .MuiChip-label': { whiteSpace: 'normal', py: 0.5 } }}
                  />
                )}
                <Divider sx={{ my: 1.25 }} />
              </>
            )}

            {hasSavedPipeline && (
              <>
                <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                  Applied Pipeline
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" mb={0.75}>
                  Saved alignment traced on this case — blue centerline and ROW cover on map.
                </Typography>
                {renderDetailRow('Segments saved', String(normalizedAlignments.length))}
                {renderDetailRow(
                  'Applied on',
                  pipelineInfo?.appliedAt
                    ? new Date(pipelineInfo.appliedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
                    : '—',
                )}
                <Divider sx={{ my: 1.25 }} />
              </>
            )}

            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
              Affected Authorities
            </Typography>
            {!affectedAuthorities.length ? (
              <Typography variant="caption" color="text.secondary">
                Run Detect Clearances after identifying parcels to see Forest Dept, Revenue/PWD, NHAI, Railway, and other statutory authorities.
              </Typography>
            ) : (
              <List dense disablePadding>
                {(clearances ?? []).map((clearance) => (
                  <ListItem key={clearance.id} disableGutters sx={{ py: 0.25, alignItems: 'flex-start' }}>
                    <ListItemText
                      primary={(
                        <Box display="flex" alignItems="center" gap={0.75} flexWrap="wrap">
                          <Chip
                            size="small"
                            label={shortAuthorityLabel(clearance.authority)}
                            color={isClearancePendingApproval(clearance.status) ? 'warning' : 'success'}
                            variant={isClearancePendingApproval(clearance.status) ? 'filled' : 'outlined'}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {String(clearance.label ?? clearance.clearanceType ?? 'Clearance')}
                          </Typography>
                        </Box>
                      )}
                      secondary={(
                        <Typography variant="caption" color="text.secondary" component="span" display="block">
                          {clearance.overlayLayerLabel ? `Layer: ${clearance.overlayLayerLabel} · ` : ''}
                          Status: {String(clearance.status)}
                          {clearance.khasraNo ? ` · Khasra ${clearance.khasraNo}` : ''}
                        </Typography>
                      )}
                    />
                  </ListItem>
                ))}
              </List>
            )}
            {pendingClearanceCount > 0 && (
              <Typography variant="caption" color="warning.main" display="block" mt={1}>
                {pendingClearanceCount} clearance(s) pending approval — rose ring markers on map
              </Typography>
            )}
          </Box>
        </Grid>
      </Grid>
      <LaGisVisualizationLegend extraItems={legendExtras} />
    </Box>
  );
}
