import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  LinearProgress, Stack, Tab, Tabs, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Typography,
} from '@mui/material';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import type { FeatureCollection, LineString, Point } from 'geojson';
import axios from 'axios';
import MapViewer from '../map/MapViewer';
import { landAcquisitionApi } from '../../services/api';
import { UTTARAKHAND_STATE_MAP_VIEW, type BasemapConfig } from '../../utils/basemapLayers';
import LaLinkProjectPanel from './LaLinkProjectPanel';
import { dataTableSx } from '../../utils/pagePresentationStyles';
import {
  extractNetworkEndpoints,
  groupFeaturesByGeometryType,
  toFeatureCollection,
} from '../../utils/pipelineNetworkImport';

const LA_BASEMAPS: BasemapConfig[] = [
  {
    id: 'osm',
    name: 'OpenStreetMap',
    sourceType: 'xyz',
    sourceConfig: {
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    },
  },
];

const ROUTE_COLORS: Record<string, string> = {
  current: '#64748b',
  alt1: '#2563eb',
  alt2: '#16a34a',
  alt3: '#9333ea',
};

type RouteRow = {
  key: string;
  label: string;
  description?: string;
  geometry?: LineString;
  metrics?: Record<string, number>;
  recommendations?: Array<{ code: string; label: string; priority: string; rationale: string }>;
  isExisting?: boolean;
};

type Props = {
  caseId: string;
  projectId?: string | null;
  open: boolean;
  onClose: () => void;
  onApplied: () => void;
  onProjectLinked?: () => void;
};

function getApiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg)) return msg.join(', ');
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

/** GeoJSON is [lon, lat]; correct common lat/lon swaps for India / Uttarakhand. */
function normalizeLonLatPair(a: number, b: number): [number, number] {
  const x = Number(a);
  const y = Number(b);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return [x, y];
  const looksLikeLonLat = x >= 68 && x <= 97 && y >= 6 && y <= 37;
  const looksSwapped = y >= 68 && y <= 97 && x >= 6 && x <= 37;
  if (!looksLikeLonLat && looksSwapped) return [y, x];
  return [x, y];
}

function pointCoords(geom: Point): [number, number] | null {
  const c = geom.coordinates;
  if (!Array.isArray(c) || c.length < 2) return null;
  return normalizeLonLatPair(Number(c[0]), Number(c[1]));
}

function normalizeRouteRow(raw: unknown): RouteRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const key = String(row.key ?? row.name ?? '');
  if (!key) return null;
  return {
    key,
    label: String(row.label ?? row.name ?? key),
    description: typeof row.description === 'string' ? row.description : undefined,
    geometry: row.geometry as LineString | undefined,
    metrics: row.metrics as Record<string, number> | undefined,
    recommendations: Array.isArray(row.recommendations)
      ? row.recommendations as RouteRow['recommendations']
      : undefined,
    isExisting: row.isExisting === true,
  };
}

function normalizeRouteResults(data: Record<string, unknown>) {
  const rawRoutes = Array.isArray(data.routes) ? data.routes : [];
  const routes = rawRoutes
    .map((route) => normalizeRouteRow(route))
    .filter((route): route is RouteRow => route != null);
  return {
    ...data,
    routes,
    recommendedRouteKey: String(data.recommendedRouteKey ?? routes[0]?.key ?? 'current'),
  } as Record<string, unknown> & { routes: RouteRow[]; recommendedRouteKey: string };
}

function alignmentFeaturesFromMap(fc: FeatureCollection): FeatureCollection {
  const features = fc.features.filter((feature) => {
    const layer = feature.properties?.layer;
    return layer === 'alignment' || layer === 'corridor';
  });
  return { type: 'FeatureCollection', features };
}

export default function LaRouteRecommendationDialog({
  caseId, projectId, open, onClose, onApplied, onProjectLinked,
}: Props) {
  const requestGenRef = useRef(0);
  const [pickMode, setPickMode] = useState<'start' | 'end'>('start');
  const [start, setStart] = useState<[number, number] | null>(null);
  const [end, setEnd] = useState<[number, number] | null>(null);
  const [existingNetwork, setExistingNetwork] = useState<FeatureCollection | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [selectedKey, setSelectedKey] = useState('current');
  const [tab, setTab] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fitRevision, setFitRevision] = useState(0);
  const [mapInitRevision, setMapInitRevision] = useState(0);

  const invalidatePendingRequests = useCallback(() => {
    requestGenRef.current += 1;
  }, []);

  const bumpFit = useCallback(() => {
    setFitRevision((r) => r + 1);
  }, []);

  useEffect(() => {
    if (!open) return;
    invalidatePendingRequests();
    setPickMode('start');
    setStart(null);
    setEnd(null);
    setExistingNetwork(null);
    setResult(null);
    setSelectedKey('current');
    setTab(0);
    setError('');
    setMapInitRevision((r) => r + 1);

    landAcquisitionApi.getMapGeoJson(caseId)
      .then((res) => {
        const fc = res.data as FeatureCollection;
        const alignmentFc = alignmentFeaturesFromMap(fc);
        if (!alignmentFc.features.length) {
          bumpFit();
          return;
        }

        setExistingNetwork(alignmentFc);
        const lineFc = toFeatureCollection(
          groupFeaturesByGeometryType(alignmentFc).lines,
        );
        const endpoints = extractNetworkEndpoints(lineFc);
        if (endpoints) {
          setStart(endpoints.start);
          setEnd(endpoints.end);
          setPickMode('end');
        }
        bumpFit();
      })
      .catch(() => bumpFit());
  }, [open, caseId, invalidatePendingRequests, bumpFit]);

  const routes = (result?.routes as RouteRow[]) ?? [];
  const recommendedKey = String(result?.recommendedRouteKey ?? 'current');
  const comparison = result?.comparison as { rows?: Array<Record<string, string | number>> } | undefined;
  const hasResults = routes.length > 0;

  const overlayLayers = useMemo(() => {
    const layers: Array<{
      id: string;
      name: string;
      visible: boolean;
      geometryType: 'Point' | 'LineString' | 'Polygon';
      features: FeatureCollection;
      style: Record<string, unknown>;
    }> = [];

    if (existingNetwork?.features.length) {
      const grouped = groupFeaturesByGeometryType(existingNetwork);
      if (grouped.lines.length) {
        layers.push({
          id: 'existing-alignment',
          name: 'Existing alignment',
          visible: true,
          geometryType: 'LineString',
          features: toFeatureCollection(grouped.lines),
          style: { stroke: '#64748b', strokeWidth: 4, strokeOpacity: 0.85 },
        });
      }
      if (grouped.polygons.length) {
        layers.push({
          id: 'existing-corridor',
          name: 'Existing corridor',
          visible: true,
          geometryType: 'Polygon',
          features: toFeatureCollection(grouped.polygons),
          style: { fill: 'rgba(59, 130, 246, 0.12)', stroke: '#3b82f6', strokeWidth: 2 },
        });
      }
    }

    if (start) {
      layers.push({
        id: 'start-pt',
        name: 'Start',
        visible: true,
        geometryType: 'Point',
        features: {
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            properties: { label: 'Start' },
            geometry: { type: 'Point', coordinates: start },
          }],
        },
        style: { fill: '#16a34a', radius: 9, stroke: '#fff', strokeWidth: 2 },
      });
    }
    if (end) {
      layers.push({
        id: 'end-pt',
        name: 'End',
        visible: true,
        geometryType: 'Point',
        features: {
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            properties: { label: 'End' },
            geometry: { type: 'Point', coordinates: end },
          }],
        },
        style: { fill: '#dc2626', radius: 9, stroke: '#fff', strokeWidth: 2 },
      });
    }

    if (start && end) {
      layers.push({
        id: 'route-endpoints',
        name: 'Endpoints',
        visible: false,
        geometryType: 'Point',
        features: {
          type: 'FeatureCollection',
          features: [
            { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: start } },
            { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: end } },
          ],
        },
        style: { fill: '#000', radius: 1 },
      });
    }

    for (const route of routes) {
      if (!route.geometry?.coordinates?.length) continue;
      const isSelected = route.key === selectedKey;
      layers.push({
        id: `route-${route.key}`,
        name: route.label,
        visible: isSelected || route.key === recommendedKey,
        geometryType: 'LineString',
        features: {
          type: 'FeatureCollection',
          features: [{ type: 'Feature', properties: { label: route.label }, geometry: route.geometry }],
        },
        style: {
          stroke: ROUTE_COLORS[route.key] ?? '#2563eb',
          strokeWidth: isSelected ? 5 : 3,
          strokeOpacity: isSelected ? 1 : 0.55,
        },
      });
    }

    return layers;
  }, [start, end, existingNetwork, routes, selectedKey, recommendedKey]);

  const fitToLayerId = useMemo(() => {
    if (routes.length) return `route-${selectedKey}`;
    if (existingNetwork?.features.length) {
      const grouped = groupFeaturesByGeometryType(existingNetwork);
      if (grouped.lines.length) return 'existing-alignment';
      if (grouped.polygons.length) return 'existing-corridor';
    }
    if (start && end) return 'route-endpoints';
    if (start) return 'start-pt';
    return undefined;
  }, [routes.length, selectedKey, existingNetwork, start, end]);

  useEffect(() => {
    if (!open) return;
    bumpFit();
  }, [open, start, end, routes.length, selectedKey, bumpFit]);

  const handleDigitize = useCallback((geometry: Point | LineString | unknown) => {
    try {
      if (!geometry || typeof geometry !== 'object' || (geometry as Point).type !== 'Point') return;
      const coords = pointCoords(geometry as Point);
      if (!coords) return;
      invalidatePendingRequests();
      if (pickMode === 'start') {
        setStart(coords);
        setPickMode('end');
      } else {
        setEnd(coords);
      }
      setResult(null);
      setError('');
    } catch (err) {
      setError(getApiError(err, 'Failed to record map point'));
    }
  }, [pickMode, invalidatePendingRequests]);

  const buildPayload = () => {
    if (!start || !end) throw new Error('Pick start and end points on the map');
    return {
      start: { lon: start[0], lat: start[1] },
      end: { lon: end[0], lat: end[1] },
      rowWidthM: 6,
      saveAndTrace: false,
    };
  };

  const runRecommend = () => {
    if (!start || !end) {
      setError('Pick start and end points on the map');
      return;
    }
    const requestGen = requestGenRef.current + 1;
    requestGenRef.current = requestGen;
    setBusy(true);
    setError('');
    landAcquisitionApi.recommendRoutes(caseId, buildPayload())
      .then((res) => {
        if (requestGenRef.current !== requestGen) return;
        const data = normalizeRouteResults(res.data as Record<string, unknown>);
        setResult(data);
        setSelectedKey(String(data.recommendedRouteKey ?? 'current'));
        const snappedStart = data.start as { lon: number; lat: number } | undefined;
        const snappedEnd = data.end as { lon: number; lat: number } | undefined;
        if (snappedStart && snappedEnd) {
          setStart([snappedStart.lon, snappedStart.lat]);
          setEnd([snappedEnd.lon, snappedEnd.lat]);
        }
      })
      .catch((err) => {
        if (requestGenRef.current !== requestGen) return;
        setError(getApiError(err, 'Route recommendation failed'));
      })
      .finally(() => {
        if (requestGenRef.current === requestGen) setBusy(false);
      });
  };

  const applySelected = () => {
    const route = routes.find((r) => r.key === selectedKey);
    if (!route?.geometry || !start || !end) return;
    const requestGen = requestGenRef.current + 1;
    requestGenRef.current = requestGen;
    setBusy(true);
    setError('');
    landAcquisitionApi.autoRoute(caseId, {
      ...buildPayload(),
      geometry: route.geometry,
      saveAndTrace: true,
    })
      .then(() => {
        if (requestGenRef.current !== requestGen) return;
        onApplied();
        onClose();
      })
      .catch((err) => {
        if (requestGenRef.current !== requestGen) return;
        setError(getApiError(err, 'Failed to apply route'));
      })
      .finally(() => {
        if (requestGenRef.current === requestGen) setBusy(false);
      });
  };

  const selectedRoute = routes.find((r) => r.key === selectedKey);

  return (
    <Dialog open={open} onClose={onClose} maxWidth={hasResults ? 'lg' : 'md'} fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AutoAwesomeOutlinedIcon color="primary" />
        AI Land Acquisition Route Recommendation
      </DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {busy && <LinearProgress sx={{ mb: 2 }} />}

        <Typography variant="body2" color="text.secondary" mb={2}>
          Pick a <strong>start</strong> and <strong>end</strong> point on the map (or use endpoints from an
          existing alignment). The AI engine compares your current alignment with optimized alternatives on
          cost, acquisition, environmental impact, and construction feasibility.
        </Typography>

        {!projectId && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} mb={1}>
              Link a project to this LA case first
            </Typography>
            <LaLinkProjectPanel caseId={caseId} compact onLinked={() => onProjectLinked?.()} />
          </Alert>
        )}

        <Stack direction="row" spacing={1} mb={1} flexWrap="wrap">
          <Chip
            label={start ? `Start: ${start[1].toFixed(5)}, ${start[0].toFixed(5)}` : 'Pick start point'}
            color={pickMode === 'start' ? 'primary' : start ? 'success' : 'default'}
            onClick={() => setPickMode('start')}
            variant={pickMode === 'start' ? 'filled' : 'outlined'}
          />
          <Chip
            label={end ? `End: ${end[1].toFixed(5)}, ${end[0].toFixed(5)}` : 'Pick end point'}
            color={pickMode === 'end' ? 'primary' : end ? 'success' : 'default'}
            onClick={() => setPickMode('end')}
            variant={pickMode === 'end' ? 'filled' : 'outlined'}
          />
        </Stack>

        <Box sx={{ height: 360, borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'divider', mb: 2 }}>
          <MapViewer
            basemaps={LA_BASEMAPS}
            activeBasemapId="osm"
            overlayLayers={overlayLayers}
            center={UTTARAKHAND_STATE_MAP_VIEW.center}
            zoom={UTTARAKHAND_STATE_MAP_VIEW.zoom}
            jurisdictionBbox={UTTARAKHAND_STATE_MAP_VIEW.bbox}
            jurisdictionRevision={mapInitRevision}
            fitToLayerId={fitToLayerId}
            fitRevision={fitRevision}
            activeTool="digitize"
            digitizeGeometryType="Point"
            onDigitizeComplete={handleDigitize}
          />
        </Box>

        {hasResults && (
          <>
            <Stack direction="row" spacing={1} mb={2} flexWrap="wrap">
              {routes.map((r) => (
                <Chip
                  key={r.key}
                  label={r.label}
                  onClick={() => setSelectedKey(r.key)}
                  color={r.key === selectedKey ? 'primary' : 'default'}
                  variant={r.key === selectedKey ? 'filled' : 'outlined'}
                  icon={r.key === recommendedKey ? <AutoAwesomeOutlinedIcon /> : undefined}
                  sx={{ borderColor: ROUTE_COLORS[r.key] }}
                />
              ))}
            </Stack>

            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
              <Tab label="Comparison" />
              <Tab label="AI Recommendations" />
            </Tabs>

            {tab === 0 && comparison?.rows && (
              <TableContainer sx={{ maxHeight: 280, mb: 2 }}>
                <Table size="small" stickyHeader sx={dataTableSx}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Metric</TableCell>
                      {routes.map((r) => (
                        <TableCell key={r.key} align="right">
                          {r.label}
                          {r.key === recommendedKey && (
                            <Chip size="small" label="Recommended" color="success" sx={{ ml: 0.5 }} />
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {comparison.rows.map((row) => (
                      <TableRow key={String(row.metric)}>
                        <TableCell>{String(row.metric)}</TableCell>
                        {routes.map((r) => (
                          <TableCell key={r.key} align="right">{String(row[r.key] ?? '—')}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {tab === 1 && selectedRoute && (
              <Box mb={2}>
                <Typography variant="subtitle2" fontWeight={700} mb={1}>
                  Recommendations for {selectedRoute.label}
                </Typography>
                {(selectedRoute.recommendations ?? []).length === 0 ? (
                  <Typography variant="body2" color="text.secondary">No specific recommendations for this route.</Typography>
                ) : (
                  (selectedRoute.recommendations ?? []).map((rec) => (
                    <Alert key={rec.code} severity={rec.priority === 'high' ? 'warning' : 'info'} sx={{ mb: 1 }}>
                      <Typography variant="body2" fontWeight={600}>{rec.label}</Typography>
                      <Typography variant="caption">{rec.rationale}</Typography>
                    </Alert>
                  ))
                )}
              </Box>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button
          variant="outlined"
          startIcon={<AutoAwesomeOutlinedIcon />}
          disabled={!start || !end || busy || !projectId}
          onClick={runRecommend}
        >
          Analyze Routes
        </Button>
        <Button
          variant="contained"
          startIcon={<SaveOutlinedIcon />}
          disabled={!hasResults || !selectedRoute?.geometry || busy || !projectId}
          onClick={applySelected}
        >
          Apply {selectedRoute?.label ?? 'Route'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
