import { useMemo, useState } from 'react';
import {
  Box, Chip, Grid, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography,
} from '@mui/material';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import type { FeatureCollection, Feature, Polygon } from 'geojson';
import MapViewer from '../map/MapViewer';
import SurfaceCard from '../layout/SurfaceCard';
import KpiStatCard from '../layout/KpiStatCard';
import {
  OM_GIS_REVENUE_LAYERS,
  OM_NRW_EFFICIENCY_THRESHOLD_PCT,
  gisRevenueLayerColor,
  formatInr,
  type OmGisRevenueLayerCode,
} from '../../constants/omBilling';
import { dataTableSx } from '../../utils/pagePresentationStyles';
import { formatCoordinatePair } from '../../utils/coordinateFields';
import type { BasemapConfig } from '../../utils/basemapLayers';

const REVENUE_BASEMAPS: BasemapConfig[] = [
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

type GisMarker = Record<string, unknown> & {
  id: string;
  latitude: number;
  longitude: number;
  layers?: string[];
};

type RevenueGisData = {
  layers?: typeof OM_GIS_REVENUE_LAYERS;
  mapMarkers?: GisMarker[];
  meterLocations?: GisMarker[];
  villageAnalytics?: Array<Record<string, unknown>>;
  defaulterClusters?: Array<Record<string, unknown>>;
  nrwZones?: Array<Record<string, unknown>>;
  revenueHeatMap?: Array<Record<string, unknown>>;
  bounds?: { minLat: number; maxLat: number; minLng: number; maxLng: number } | null;
  summary?: Record<string, unknown>;
};

function pointFeatures(
  items: GisMarker[],
  layer: OmGisRevenueLayerCode,
  labelFn: (item: GisMarker) => string,
): Feature[] {
  return items
    .filter((item) => (item.layers ?? [layer]).includes(layer))
    .map((item) => ({
      type: 'Feature' as const,
      id: `${layer}-${String(item.id)}`,
      geometry: {
        type: 'Point' as const,
        coordinates: [Number(item.longitude), Number(item.latitude)],
      },
      properties: {
        ...item,
        label: labelFn(item),
        layer,
        markerColor: gisRevenueLayerColor(layer, item),
      },
    }));
}

function heatCellPolygon(lat: number, lng: number, size = 0.0125): Polygon {
  return {
    type: 'Polygon',
    coordinates: [[
      [lng - size, lat - size],
      [lng + size, lat - size],
      [lng + size, lat + size],
      [lng - size, lat + size],
      [lng - size, lat - size],
    ]],
  };
}

function efficiencyTone(pct: number | null | undefined): 'teal' | 'amber' | 'rose' {
  if (pct == null) return 'amber';
  if (pct >= OM_NRW_EFFICIENCY_THRESHOLD_PCT) return 'teal';
  if (pct >= 50) return 'amber';
  return 'rose';
}

export default function OmRevenueGisDashboard({ data }: { data: RevenueGisData | null }) {
  const summary = data?.summary ?? {};
  const mapMarkers = (data?.mapMarkers ?? []) as GisMarker[];
  const meterLocations = (data?.meterLocations ?? []) as GisMarker[];
  const villageAnalytics = data?.villageAnalytics ?? [];
  const defaulterClusters = data?.defaulterClusters ?? [];
  const nrwZones = data?.nrwZones ?? [];
  const heatMap = data?.revenueHeatMap ?? [];

  const [visibleLayers, setVisibleLayers] = useState<Record<OmGisRevenueLayerCode, boolean>>({
    fhtc: true,
    meter: true,
    billing: false,
    collection: false,
    defaulter: true,
    heatmap: true,
  });
  const [fitRevision, setFitRevision] = useState(0);

  const mapCenter = useMemo<[number, number]>(() => {
    if (data?.bounds) {
      const { minLat, maxLat, minLng, maxLng } = data.bounds;
      return [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
    }
    if (mapMarkers[0]) return [Number(mapMarkers[0].longitude), Number(mapMarkers[0].latitude)];
    return [79.3, 30.0];
  }, [data?.bounds, mapMarkers]);

  const overlayLayers = useMemo(() => {
    const layers: Array<{
      id: string;
      name: string;
      visible: boolean;
      geometryType: string;
      features: FeatureCollection;
      style: Record<string, unknown>;
    }> = [];

    if (visibleLayers.heatmap && heatMap.length) {
      layers.push({
        id: 'heatmap',
        name: 'Revenue Heat Map',
        visible: true,
        geometryType: 'Polygon',
        features: {
          type: 'FeatureCollection',
          features: heatMap.map((cell, idx) => ({
            type: 'Feature' as const,
            id: `heat-${idx}`,
            geometry: heatCellPolygon(Number(cell.latitude), Number(cell.longitude)),
            properties: {
              ...cell,
              layer: 'heatmap',
              markerColor: gisRevenueLayerColor('heatmap', cell),
            },
          })),
        },
        style: { fillOpacity: 0.45, strokeWidth: 1 },
      });
    }

    const pointLayerDefs: Array<{ code: OmGisRevenueLayerCode; items: GisMarker[]; label: (i: GisMarker) => string }> = [
      { code: 'fhtc', items: mapMarkers, label: (i) => String(i.fhtcNumber ?? i.consumerCode ?? '') },
      { code: 'billing', items: mapMarkers, label: (i) => `${String(i.fhtcNumber ?? '')} · ${String(i.billingStatus ?? '')}` },
      { code: 'collection', items: mapMarkers, label: (i) => `${String(i.fhtcNumber ?? '')} · ${String(i.collectionStatus ?? '')}` },
      { code: 'defaulter', items: mapMarkers.filter((m) => m.isDefaulter), label: (i) => String(i.fhtcNumber ?? i.consumerCode ?? '') },
      { code: 'meter', items: meterLocations, label: (i) => String(i.fhtcNumber ?? i.consumerCode ?? 'Meter') },
    ];

    for (const def of pointLayerDefs) {
      if (!visibleLayers[def.code]) continue;
      const features = pointFeatures(def.items, def.code, def.label);
      if (!features.length) continue;
      layers.push({
        id: def.code,
        name: OM_GIS_REVENUE_LAYERS.find((l) => l.code === def.code)?.label ?? def.code,
        visible: true,
        geometryType: 'Point',
        features: { type: 'FeatureCollection', features },
        style: { pointRadius: def.code === 'defaulter' ? 7 : 6 },
      });
    }

    return layers;
  }, [visibleLayers, mapMarkers, meterLocations, heatMap]);

  const toggleLayer = (code: OmGisRevenueLayerCode) => {
    setVisibleLayers((prev) => ({ ...prev, [code]: !prev[code] }));
    setFitRevision((r) => r + 1);
  };

  const fitLayerId = overlayLayers.find((l) => l.visible)?.id ?? 'fhtc';

  return (
    <>
      <Grid container spacing={2} mb={2}>
        {[
          { label: 'Map Features', value: summary.mapFeatures ?? 0, tone: 'blue' as const },
          { label: 'Meter GPS Points', value: summary.meterLocations ?? 0, tone: 'violet' as const },
          { label: 'Defaulters', value: summary.defaulterCount ?? 0, tone: 'rose' as const },
          { label: 'Defaulter Clusters', value: summary.defaulterClusters ?? 0, tone: 'rose' as const },
          { label: 'NRW Zones', value: summary.nrwZoneCount ?? 0, tone: 'amber' as const },
          { label: 'Collection Efficiency', value: summary.collectionEfficiencyPct != null ? `${summary.collectionEfficiencyPct}%` : '—', tone: 'teal' as const },
        ].map((k) => (
          <Grid item xs={6} sm={4} md={2} key={k.label}>
            <KpiStatCard label={k.label} value={k.value} tone={k.tone} />
          </Grid>
        ))}
      </Grid>

      <SurfaceCard title="Revenue GIS Map — Consumer & Revenue Status">
        <Typography variant="body2" color="text.secondary" mb={1.5}>
          Map all consumers and revenue status. Toggle GIS layers to view FHTC connections, meter locations,
          billing/collection status, defaulters, and revenue heat intensity.
        </Typography>
        <Box display="flex" gap={0.75} flexWrap="wrap" mb={2}>
          {OM_GIS_REVENUE_LAYERS.map((layer) => (
            <Chip
              key={layer.code}
              size="small"
              label={layer.label}
              clickable
              variant={visibleLayers[layer.code as OmGisRevenueLayerCode] ? 'filled' : 'outlined'}
              onClick={() => toggleLayer(layer.code as OmGisRevenueLayerCode)}
              sx={{
                bgcolor: visibleLayers[layer.code as OmGisRevenueLayerCode] ? layer.color : undefined,
                color: visibleLayers[layer.code as OmGisRevenueLayerCode] ? '#fff' : undefined,
              }}
            />
          ))}
        </Box>

        <Box
          sx={{
            position: 'relative',
            height: 420,
            borderRadius: 2,
            overflow: 'hidden',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          {mapMarkers.length === 0 && meterLocations.length === 0 ? (
            <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="100%" bgcolor="#0f172a">
              <MapOutlinedIcon sx={{ color: '#64748b', fontSize: 40, mb: 1 }} />
              <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                No geo-tagged consumers for this scheme. Add latitude/longitude in Consumer Accounts.
              </Typography>
            </Box>
          ) : (
            <MapViewer
              basemaps={REVENUE_BASEMAPS}
              activeBasemapId="osm"
              overlayLayers={overlayLayers}
              fitToLayerId={fitLayerId}
              fitRevision={fitRevision}
              center={mapCenter}
              zoom={13}
              activeTool="info"
            />
          )}
        </Box>
      </SurfaceCard>

      <Grid container spacing={2} mt={0.5}>
        <Grid item xs={12} md={6}>
          <SurfaceCard title="Village-wise Collection Efficiency">
            <TableContainer>
              <Table size="small" sx={dataTableSx}>
                <TableHead>
                  <TableRow>
                    <TableCell>Village</TableCell>
                    <TableCell align="right">Demand</TableCell>
                    <TableCell align="right">Collection</TableCell>
                    <TableCell align="right">Efficiency</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {villageAnalytics.map((v) => (
                    <TableRow key={String(v.village)}>
                      <TableCell>{String(v.village)}</TableCell>
                      <TableCell align="right">{formatInr(v.demand as number)}</TableCell>
                      <TableCell align="right">{formatInr(v.collection as number)}</TableCell>
                      <TableCell align="right">
                        <Chip
                          size="small"
                          label={v.collectionEfficiencyPct != null ? `${v.collectionEfficiencyPct}%` : '—'}
                          color={efficiencyTone(v.collectionEfficiencyPct as number | null) === 'teal' ? 'success' : efficiencyTone(v.collectionEfficiencyPct as number | null) === 'rose' ? 'error' : 'warning'}
                          variant="outlined"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {!villageAnalytics.length && (
                    <TableRow><TableCell colSpan={4} align="center">No village analytics</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </SurfaceCard>
        </Grid>

        <Grid item xs={12} md={6}>
          <SurfaceCard title={`Non-Revenue Water Zones (< ${OM_NRW_EFFICIENCY_THRESHOLD_PCT}% efficiency)`}>
            <TableContainer>
              <Table size="small" sx={dataTableSx}>
                <TableHead>
                  <TableRow>
                    <TableCell>Village</TableCell>
                    <TableCell align="right">Efficiency</TableCell>
                    <TableCell align="right">Balance</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {nrwZones.map((z) => (
                    <TableRow key={String(z.village)}>
                      <TableCell>{String(z.village)}</TableCell>
                      <TableCell align="right">{String(z.collectionEfficiencyPct ?? '—')}%</TableCell>
                      <TableCell align="right">{formatInr(z.balance as number)}</TableCell>
                    </TableRow>
                  ))}
                  {!nrwZones.length && (
                    <TableRow><TableCell colSpan={3} align="center">No NRW zones under threshold</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </SurfaceCard>
        </Grid>

        <Grid item xs={12} md={6}>
          <SurfaceCard title="Defaulter Clusters">
            <TableContainer>
              <Table size="small" sx={dataTableSx}>
                <TableHead>
                  <TableRow>
                    <TableCell>Village</TableCell>
                    <TableCell align="right">Defaulters</TableCell>
                    <TableCell align="right">Total Balance</TableCell>
                    <TableCell>Centroid</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {defaulterClusters.map((c) => (
                    <TableRow key={String(c.village)}>
                      <TableCell>{String(c.village)}</TableCell>
                      <TableCell align="right">{String(c.count)}</TableCell>
                      <TableCell align="right">{formatInr(c.totalBalance as number)}</TableCell>
                      <TableCell>{formatCoordinatePair(c.latitude as number, c.longitude as number)}</TableCell>
                    </TableRow>
                  ))}
                  {!defaulterClusters.length && (
                    <TableRow><TableCell colSpan={4} align="center">No defaulter clusters</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </SurfaceCard>
        </Grid>

        <Grid item xs={12} md={6}>
          <SurfaceCard title="Revenue Heat Map — Top Cells">
            <TableContainer>
              <Table size="small" sx={dataTableSx}>
                <TableHead>
                  <TableRow>
                    <TableCell>Cell</TableCell>
                    <TableCell align="right">Consumers</TableCell>
                    <TableCell align="right">Balance</TableCell>
                    <TableCell align="right">Intensity</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {heatMap.slice(0, 12).map((cell) => (
                    <TableRow key={String(cell.cellKey)}>
                      <TableCell>{formatCoordinatePair(cell.latitude as number, cell.longitude as number)}</TableCell>
                      <TableCell align="right">{String(cell.consumerCount)}</TableCell>
                      <TableCell align="right">{formatInr(cell.totalBalance as number)}</TableCell>
                      <TableCell align="right">
                        <Chip
                          size="small"
                          label={`${Math.round(Number(cell.intensity ?? 0) * 100)}%`}
                          sx={{ bgcolor: gisRevenueLayerColor('heatmap', cell), color: '#fff' }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {!heatMap.length && (
                    <TableRow><TableCell colSpan={4} align="center">No heat map cells</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </SurfaceCard>
        </Grid>

        <Grid item xs={12}>
          <SurfaceCard title="Mapped Consumers">
            <TableContainer>
              <Table size="small" sx={dataTableSx}>
                <TableHead>
                  <TableRow>
                    <TableCell>Consumer</TableCell>
                    <TableCell>FHTC</TableCell>
                    <TableCell>Village</TableCell>
                    <TableCell>GIS</TableCell>
                    <TableCell>Billing</TableCell>
                    <TableCell>Collection</TableCell>
                    <TableCell align="right">Balance</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {mapMarkers.slice(0, 50).map((m) => (
                    <TableRow key={String(m.id)} hover>
                      <TableCell>{String(m.consumerCode)}</TableCell>
                      <TableCell>{String(m.fhtcNumber)}</TableCell>
                      <TableCell>{String(m.village ?? '—')}</TableCell>
                      <TableCell>{formatCoordinatePair(m.latitude as number, m.longitude as number)}</TableCell>
                      <TableCell><Chip size="small" label={String(m.billingStatus)} variant="outlined" /></TableCell>
                      <TableCell><Chip size="small" label={String(m.collectionStatus)} variant="outlined" /></TableCell>
                      <TableCell align="right">{formatInr(m.balanceAmount as number)}</TableCell>
                    </TableRow>
                  ))}
                  {!mapMarkers.length && (
                    <TableRow><TableCell colSpan={7} align="center">No mapped consumers</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </SurfaceCard>
        </Grid>
      </Grid>
    </>
  );
}
