import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, Grid, LinearProgress, Slider, Stack, Switch, Tab, Tabs,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography,
} from '@mui/material';
import RouteOutlinedIcon from '@mui/icons-material/RouteOutlined';
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import type { FeatureCollection, LineString, Point } from 'geojson';
import { Link as RouterLink } from 'react-router-dom';
import axios from 'axios';
import MapViewer from '../map/MapViewer';
import { landAcquisitionApi } from '../../services/api';
import { UTTARAKHAND_STATE_MAP_VIEW, LA_MAP_BASEMAPS, getDefaultSatelliteBasemapId } from '../../utils/basemapLayers';
import LaLinkProjectPanel from './LaLinkProjectPanel';
import { dataTableSx } from '../../utils/pagePresentationStyles';
import {
  PIPELINE_NETWORK_ACCEPT,
  extractNetworkEndpoints,
  groupFeaturesByGeometryType,
  parsePipelineNetworkFiles,
  summarizePipelineNetwork,
  toFeatureCollection,
} from '../../utils/pipelineNetworkImport';

const ROUTE_COLORS: Record<string, string> = {
  imported: '#ea580c',
  current: '#64748b',
  alt1: '#2563eb',
  alt2: '#16a34a',
  alt3: '#9333ea',
};

type CriteriaRow = { code: string; label: string; defaultWeight: number };

type RouteRow = {
  key: string;
  label: string;
  description?: string;
  geometry?: LineString;
  metrics?: Record<string, number>;
  scores?: Record<string, number>;
  lengthM?: number;
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
  criteria?: CriteriaRow[];
  /** Shared across Auto Route and AI Route Compare for this case session */
  importedPipelineNetwork?: FeatureCollection | null;
  onImportedPipelineNetworkChange?: (network: FeatureCollection | null) => void;
  importedPipelineFileName?: string | null;
  onImportedPipelineFileNameChange?: (name: string | null) => void;
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
    scores: row.scores as Record<string, number> | undefined,
    lengthM: typeof row.lengthM === 'number' ? row.lengthM : undefined,
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
    recommendedRouteKey: String(data.recommendedRouteKey ?? routes[0]?.key ?? 'imported'),
  } as Record<string, unknown> & { routes: RouteRow[]; recommendedRouteKey: string };
}

function pointCoords(geom: Point): [number, number] | null {
  const c = geom.coordinates;
  if (!Array.isArray(c) || c.length < 2) return null;
  return [Number(c[0]), Number(c[1])];
}

export default function LaAutoRouteDialog({
  caseId, projectId, open, onClose, onApplied, onProjectLinked, criteria = [],
  importedPipelineNetwork: sharedImportedNetwork,
  onImportedPipelineNetworkChange,
  importedPipelineFileName: sharedImportFileName,
  onImportedPipelineFileNameChange,
}: Props) {
  const fileInputId = useId();
  const [pickMode, setPickMode] = useState<'start' | 'end'>('start');
  const [start, setStart] = useState<[number, number] | null>(null);
  const [end, setEnd] = useState<[number, number] | null>(null);
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [routeResults, setRouteResults] = useState<Record<string, unknown> | null>(null);
  const [selectedRouteKey, setSelectedRouteKey] = useState('imported');
  const [resultsTab, setResultsTab] = useState(0);
  const [localImportedNetwork, setLocalImportedNetwork] = useState<FeatureCollection | null>(null);
  const importedNetwork = onImportedPipelineNetworkChange
    ? (sharedImportedNetwork ?? null)
    : localImportedNetwork;
  const setImportedNetwork = useCallback((network: FeatureCollection | null) => {
    if (onImportedPipelineNetworkChange) onImportedPipelineNetworkChange(network);
    else setLocalImportedNetwork(network);
  }, [onImportedPipelineNetworkChange]);
  const [localImportFileName, setLocalImportFileName] = useState('');
  const importFileName = onImportedPipelineFileNameChange
    ? (sharedImportFileName ?? '')
    : localImportFileName;
  const setImportFileName = useCallback((name: string) => {
    if (onImportedPipelineFileNameChange) onImportedPipelineFileNameChange(name || null);
    else setLocalImportFileName(name);
  }, [onImportedPipelineFileNameChange]);
  const [importParsing, setImportParsing] = useState(false);
  const [useNetworkEndpoints, setUseNetworkEndpoints] = useState(true);
  const [useImportedAsCorridor, setUseImportedAsCorridor] = useState(true);
  const [snapToImportedNetwork, setSnapToImportedNetwork] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fitRevision, setFitRevision] = useState(0);
  const [mapInitRevision, setMapInitRevision] = useState(0);
  const requestGenRef = useRef(0);

  useEffect(() => {
    if (open) setMapInitRevision((r) => r + 1);
  }, [open]);

  const invalidatePendingRequests = useCallback(() => {
    requestGenRef.current += 1;
  }, []);

  const networkSummary = useMemo(
    () => (importedNetwork ? summarizePipelineNetwork(importedNetwork) : null),
    [importedNetwork],
  );

  const routes = (routeResults?.routes as RouteRow[]) ?? [];
  const recommendedKey = String(routeResults?.recommendedRouteKey ?? 'imported');
  const comparison = routeResults?.comparison as { rows?: Array<Record<string, string | number>> } | undefined;

  const buildNetworkPayload = () => (
    importedNetwork ? {
      importedNetwork,
      snapToImportedNetwork,
      useImportedAsCorridor,
    } : {}
  );

  const overlayLayers = useMemo(() => {
    const layers: Array<{
      id: string;
      name: string;
      visible: boolean;
      geometryType: 'Point' | 'LineString' | 'Polygon';
      features: FeatureCollection;
      style: Record<string, unknown>;
    }> = [];

    if (importedNetwork?.features.length) {
      const grouped = groupFeaturesByGeometryType(importedNetwork);
      if (grouped.lines.length) {
        layers.push({
          id: 'imported-lines',
          name: 'Imported pipeline',
          visible: true,
          geometryType: 'LineString',
          features: toFeatureCollection(grouped.lines),
          style: { stroke: '#ea580c', strokeWidth: 4, strokeOpacity: 0.9 },
        });
      }
      if (grouped.points.length) {
        layers.push({
          id: 'imported-points',
          name: 'Imported points',
          visible: true,
          geometryType: 'Point',
          features: toFeatureCollection(grouped.points),
          style: { fill: '#ea580c', radius: 6, stroke: '#fff', strokeWidth: 1 },
        });
      }
      if (grouped.polygons.length) {
        layers.push({
          id: 'imported-polygons',
          name: 'Imported polygons',
          visible: true,
          geometryType: 'Polygon',
          features: toFeatureCollection(grouped.polygons),
          style: { fill: 'rgba(234, 88, 12, 0.15)', stroke: '#ea580c', strokeWidth: 2 },
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

    for (const route of routes) {
      if (!route.geometry?.coordinates?.length) continue;
      const isSelected = route.key === selectedRouteKey;
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

    const routeGeom = preview?.geometry as LineString | undefined;
    if (routeGeom?.coordinates?.length && !routes.length) {
      layers.push({
        id: 'auto-route',
        name: 'Auto Route',
        visible: true,
        geometryType: 'LineString',
        features: {
          type: 'FeatureCollection',
          features: [{ type: 'Feature', properties: {}, geometry: routeGeom }],
        },
        style: { stroke: '#2563eb', strokeWidth: 4 },
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

    return layers;
  }, [start, end, preview, importedNetwork, routes, selectedRouteKey, recommendedKey]);

  const fitToLayerId = useMemo(() => {
    if (routes.length) return `route-${selectedRouteKey}`;
    if (importedNetwork?.features.length) return 'imported-lines';
    const routeGeom = preview?.geometry as LineString | undefined;
    if (routeGeom?.coordinates?.length) return 'auto-route';
    if (start && end) return 'route-endpoints';
    if (start) return 'start-pt';
    return undefined;
  }, [routes.length, selectedRouteKey, importedNetwork, preview, start, end]);

  useEffect(() => {
    if (!open) return;
    setFitRevision((r) => r + 1);
  }, [open, start, end, routes.length, selectedRouteKey, importedNetwork, preview]);

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
      setPreview(null);
      setRouteResults(null);
      setError('');
    } catch (err) {
      setError(getApiError(err, 'Failed to record map point'));
    }
  }, [pickMode, invalidatePendingRequests]);

  const applyImportedEndpoints = useCallback((collection: FeatureCollection) => {
    const lineFc = toFeatureCollection(groupFeaturesByGeometryType(collection).lines);
    const endpoints = extractNetworkEndpoints(lineFc);
    if (!endpoints) return false;
    setStart(endpoints.start);
    setEnd(endpoints.end);
    setPickMode('end');
    return true;
  }, []);

  const handleImportFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setImportParsing(true);
    setError('');
    try {
      const collection = await parsePipelineNetworkFiles(Array.from(files));
      setImportedNetwork(collection);
      setImportFileName(files[0]?.name ?? 'imported-network');
      setPreview(null);
      setRouteResults(null);

      if (useNetworkEndpoints) {
        applyImportedEndpoints(collection);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse pipeline network file');
      setImportedNetwork(null);
      setImportFileName('');
    } finally {
      setImportParsing(false);
    }
  };

  const applyNetworkEndpoints = () => {
    if (!importedNetwork) return;
    if (!applyImportedEndpoints(importedNetwork)) {
      setError('Imported network has no LineString features for endpoint detection');
      return;
    }
    setPreview(null);
    setRouteResults(null);
    setError('');
  };

  const buildPayload = () => {
    if (!start || !end) throw new Error('Pick start and end points on the map');
    return {
      start: { lon: start[0], lat: start[1] },
      end: { lon: end[0], lat: end[1] },
      weights,
      rowWidthM: 6,
      saveAndTrace: false,
      ...buildNetworkPayload(),
    };
  };

  const runPreview = () => {
    const requestGen = requestGenRef.current + 1;
    requestGenRef.current = requestGen;
    setBusy(true);
    setError('');
    landAcquisitionApi.previewAutoRoute(caseId, buildPayload())
      .then((res) => {
        if (requestGenRef.current !== requestGen) return;
        const data = res.data as Record<string, unknown>;
        setPreview(data);
        setRouteResults(null);
        const snappedStart = data.start as { lon: number; lat: number } | undefined;
        const snappedEnd = data.end as { lon: number; lat: number } | undefined;
        if (snapToImportedNetwork && snappedStart && snappedEnd) {
          setStart([snappedStart.lon, snappedStart.lat]);
          setEnd([snappedEnd.lon, snappedEnd.lat]);
        }
      })
      .catch((err) => {
        if (requestGenRef.current !== requestGen) return;
        setError(getApiError(err, 'Auto-route preview failed'));
      })
      .finally(() => {
        if (requestGenRef.current === requestGen) setBusy(false);
      });
  };

  const runAutoTraceAll = () => {
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
        setRouteResults(data);
        setPreview(null);
        const key = String(data.recommendedRouteKey ?? 'imported');
        setSelectedRouteKey(key);
        const snappedStart = data.start as { lon: number; lat: number } | undefined;
        const snappedEnd = data.end as { lon: number; lat: number } | undefined;
        if (snapToImportedNetwork && snappedStart && snappedEnd) {
          setStart([snappedStart.lon, snappedStart.lat]);
          setEnd([snappedEnd.lon, snappedEnd.lat]);
        }
      })
      .catch((err) => {
        if (requestGenRef.current !== requestGen) return;
        setError(getApiError(err, 'Auto trace failed'));
      })
      .finally(() => {
        if (requestGenRef.current === requestGen) setBusy(false);
      });
  };

  const applyRoute = (geometry?: LineString) => {
    const requestGen = requestGenRef.current + 1;
    requestGenRef.current = requestGen;
    setBusy(true);
    setError('');
    landAcquisitionApi.autoRoute(caseId, {
      ...buildPayload(),
      geometry,
      saveAndTrace: true,
    })
      .then(() => {
        if (requestGenRef.current !== requestGen) return;
        onApplied();
        onClose();
      })
      .catch((err) => {
        if (requestGenRef.current !== requestGen) return;
        setError(getApiError(err, 'Auto-route failed'));
      })
      .finally(() => {
        if (requestGenRef.current === requestGen) setBusy(false);
      });
  };

  const canApplyImportedCorridor = Boolean(
    importedNetwork?.features.length && useImportedAsCorridor,
  );

  const applySelectedRoute = () => {
    const route = routes.find((r) => r.key === selectedRouteKey);
    if (route?.geometry) {
      applyRoute(route.geometry);
      return;
    }
    const previewGeom = preview?.geometry as LineString | undefined;
    if (previewGeom?.coordinates?.length) {
      applyRoute(previewGeom);
      return;
    }
    applyRoute();
  };

  const scores = preview?.scores as Record<string, number> | undefined;
  const selectedRoute = routes.find((r) => r.key === selectedRouteKey);
  const hasResults = routes.length > 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth={hasResults ? 'lg' : 'md'} fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <RouteOutlinedIcon color="primary" />
        Auto Trace Engine
      </DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {(busy || importParsing) && <LinearProgress sx={{ mb: 2 }} />}

        <Typography variant="body2" color="text.secondary" mb={2}>
          Pick a <strong>start</strong> and <strong>end</strong> point, or import a pipeline network
          (SHP / GeoJSON). The engine runs GIS least-cost routing using road corridors, land tenure,
          hazards, and environmental layers from Feature Class Catalog.
        </Typography>

        {!projectId && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} mb={1}>
              Link a project to this LA case before auto-routing
            </Typography>
            <LaLinkProjectPanel
              caseId={caseId}
              compact
              onLinked={() => onProjectLinked?.()}
            />
          </Alert>
        )}

        <Box
          sx={{
            mb: 2, p: 2, borderRadius: 2, border: '1px dashed',
            borderColor: 'divider', bgcolor: 'action.hover',
          }}
        >
          <Typography variant="subtitle2" fontWeight={700} mb={1}>
            Import pipeline network
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" mb={1}>
            <Button
              component="label"
              htmlFor={fileInputId}
              size="small"
              variant="outlined"
              startIcon={<UploadFileOutlinedIcon />}
              disabled={importParsing || busy}
            >
              Import pipeline (SHP / GeoJSON)
            </Button>
            <input
              id={fileInputId}
              type="file"
              hidden
              accept={PIPELINE_NETWORK_ACCEPT}
              multiple
              onChange={(e) => {
                handleImportFiles(e.target.files);
                e.target.value = '';
              }}
            />
            {importedNetwork && (
              <Chip
                size="small"
                color="warning"
                label={`${networkSummary?.featureCount ?? 0} features · ${networkSummary?.geometryLabel ?? 'Mixed'}`}
                onDelete={() => {
                  setImportedNetwork(null);
                  setImportFileName('');
                  setRouteResults(null);
                  setPreview(null);
                }}
              />
            )}
            {importFileName && (
              <Typography variant="caption" color="text.secondary">{importFileName}</Typography>
            )}
          </Stack>
          {networkSummary && (
            <Typography variant="caption" color="text.secondary" display="block" mb={1}>
              {networkSummary.pointCount > 0 && `${networkSummary.pointCount} point(s) · `}
              {networkSummary.lineCount > 0 && `${networkSummary.lineCount} line(s) · `}
              {networkSummary.polygonCount > 0 && `${networkSummary.polygonCount} polygon(s)`}
            </Typography>
          )}
          {importedNetwork && (
            <Stack direction="row" spacing={2} flexWrap="wrap">
              <FormControlLabel
                control={(
                  <Switch
                    size="small"
                    checked={useNetworkEndpoints}
                    onChange={(e) => setUseNetworkEndpoints(e.target.checked)}
                  />
                )}
                label={<Typography variant="caption">Use network endpoints as start/end</Typography>}
              />
              <FormControlLabel
                control={(
                  <Switch
                    size="small"
                    checked={useImportedAsCorridor}
                    onChange={(e) => setUseImportedAsCorridor(e.target.checked)}
                  />
                )}
                label={<Typography variant="caption">Use imported geometry as routing corridor</Typography>}
              />
              <FormControlLabel
                control={(
                  <Switch
                    size="small"
                    checked={snapToImportedNetwork}
                    onChange={(e) => setSnapToImportedNetwork(e.target.checked)}
                  />
                )}
                label={<Typography variant="caption">Snap start/end to network</Typography>}
              />
              {useNetworkEndpoints && networkSummary?.lineCount ? (
                <Button size="small" onClick={applyNetworkEndpoints}>Apply network endpoints</Button>
              ) : null}
            </Stack>
          )}
        </Box>

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
          {projectId && (
            <Button
              size="small"
              component={RouterLink}
              to={`/map?projectId=${projectId}`}
              target="_blank"
              startIcon={<OpenInNewOutlinedIcon />}
            >
              Draw manually in Map Explorer
            </Button>
          )}
        </Stack>

        <Box sx={{ height: 360, borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'divider', mb: 2 }}>
          <MapViewer
            basemaps={LA_MAP_BASEMAPS}
            activeBasemapId={getDefaultSatelliteBasemapId()}
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

        {criteria.length > 0 && (
          <Box mb={2} sx={{ maxHeight: 220, overflowY: 'auto', pr: 1 }}>
            <Typography variant="subtitle2" fontWeight={700} mb={1}>
              Routing criteria weights (0 = ignore, 2 = strict)
            </Typography>
            <Grid container spacing={2}>
              {criteria.filter(Boolean).map((c) => (
                <Grid item xs={12} sm={6} key={c.code}>
                  <Typography variant="caption">{c.label}</Typography>
                  <Slider
                    size="small"
                    min={0}
                    max={2}
                    step={0.25}
                    value={weights[c.code] ?? c.defaultWeight ?? 1}
                    onChange={(_, v) => setWeights((prev) => ({ ...prev, [c.code]: v as number }))}
                    valueLabelDisplay="auto"
                  />
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {scores && !hasResults && (
          <Alert severity="info" icon={false} sx={{ mb: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} mb={0.5}>Route analysis preview</Typography>
            <Typography variant="caption" display="block">
              Length: {Number(preview?.lengthM ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })} m
              {' · '}Road affinity: {scores.roadAffinityPct}%
              {' · '}River crossings: {scores.riverCrossings}
              {' · '}Rail crossings: {scores.railwayCrossings}
              {' · '}Forest cells: {scores.forestCells}
              {' · '}Private land cells: {scores.privateLandCells}
            </Typography>
          </Alert>
        )}

        {hasResults && (
          <>
            <Stack direction="row" spacing={1} mb={2} flexWrap="wrap">
              {routes.map((r) => (
                <Chip
                  key={r.key}
                  label={r.label}
                  onClick={() => setSelectedRouteKey(r.key)}
                  color={r.key === selectedRouteKey ? 'primary' : 'default'}
                  variant={r.key === selectedRouteKey ? 'filled' : 'outlined'}
                  icon={r.key === recommendedKey ? <AutoAwesomeOutlinedIcon /> : undefined}
                  sx={{ borderColor: ROUTE_COLORS[r.key] }}
                />
              ))}
            </Stack>

            <Tabs value={resultsTab} onChange={(_, v) => setResultsTab(v)} sx={{ mb: 2 }}>
              <Tab label="Comparison" />
              <Tab label="Land tenure & scores" />
              <Tab label="AI Recommendations" />
            </Tabs>

            {resultsTab === 0 && comparison?.rows && (
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

            {resultsTab === 1 && selectedRoute && (
              <Alert severity="info" icon={false} sx={{ mb: 2 }}>
                <Typography variant="subtitle2" fontWeight={700} mb={0.5}>
                  {selectedRoute.label} — GIS scores
                </Typography>
                <Typography variant="caption" display="block">
                  Length: {Number(selectedRoute.lengthM ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })} m
                  {' · '}Road affinity: {selectedRoute.scores?.roadAffinityPct ?? 0}%
                  {' · '}River crossings: {selectedRoute.scores?.riverCrossings ?? 0}
                  {' · '}Rail crossings: {selectedRoute.scores?.railwayCrossings ?? 0}
                  {' · '}Forest cells: {selectedRoute.scores?.forestCells ?? 0}
                  {' · '}Private land cells: {selectedRoute.scores?.privateLandCells ?? 0}
                  {' · '}Govt land cells: {selectedRoute.scores?.govtLandCells ?? 0}
                </Typography>
              </Alert>
            )}

            {resultsTab === 2 && selectedRoute && (
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
          startIcon={<PlayArrowOutlinedIcon />}
          disabled={!start || !end || busy || !projectId}
          onClick={runPreview}
        >
          Preview Route
        </Button>
        <Button
          variant="outlined"
          startIcon={<AutoAwesomeOutlinedIcon />}
          disabled={!start || !end || busy || !projectId}
          onClick={runAutoTraceAll}
        >
          Auto Trace All Routes
        </Button>
        <Button
          variant="contained"
          startIcon={<SaveOutlinedIcon />}
          disabled={(!preview && !hasResults && !canApplyImportedCorridor) || busy || !projectId}
          onClick={() => applySelectedRoute()}
        >
          {hasResults ? `Apply ${selectedRoute?.label ?? 'Route'}` : 'Apply & Trace'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
