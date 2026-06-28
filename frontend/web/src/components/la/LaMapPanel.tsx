import { useEffect, useMemo, useState } from 'react';
import { Box, LinearProgress, Typography } from '@mui/material';
import type { FeatureCollection } from 'geojson';
import MapViewer from '../map/MapViewer';
import type { BasemapConfig } from '../../utils/basemapLayers';
import { LA_GIS_VIZ_COLORS } from '../../constants/laGisVisualization';
import LaGisVisualizationLegend from './LaGisVisualizationLegend';

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

const ROAD_CORRIDOR_COLOR = LA_GIS_VIZ_COLORS.road_corridor;

type Props = {
  geoJson: FeatureCollection | null;
  loading?: boolean;
};

export default function LaMapPanel({ geoJson, loading }: Props) {
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    setRevision((r) => r + 1);
  }, [geoJson]);

  const overlayLayers = useMemo(() => {
    if (!geoJson?.features?.length) return [];
    const byLayer = new Map<string, FeatureCollection['features']>();
    for (const f of geoJson.features) {
      const layer = String((f.properties as Record<string, unknown>)?.layer ?? 'other');
      if (!byLayer.has(layer)) byLayer.set(layer, []);
      byLayer.get(layer)!.push(f);
    }
    return [...byLayer.entries()].map(([layer, features]) => ({
      id: `la-${layer}`,
      name: layer === 'alignment'
        ? 'Pipeline Alignment'
        : layer === 'corridor'
          ? 'Road Corridor'
          : 'Affected Parcels',
      visible: true,
      geometryType: layer === 'parcel' ? 'Polygon' : layer === 'alignment' ? 'LineString' : 'Polygon',
      features: { type: 'FeatureCollection' as const, features },
      style: layer === 'parcel'
        ? { fillOpacity: 0.42, strokeWidth: 2 }
        : layer === 'corridor'
          ? {
            stroke: ROAD_CORRIDOR_COLOR,
            strokeWidth: 1,
            fill: ROAD_CORRIDOR_COLOR,
            fillOpacity: 0.18,
            strokeDash: [4, 4],
          }
          : { stroke: ROAD_CORRIDOR_COLOR, strokeWidth: 4 },
    }));
  }, [geoJson]);

  if (loading) {
    return (
      <Box py={4}>
        <LinearProgress />
        <Typography variant="body2" color="text.secondary" align="center" mt={2}>Loading map…</Typography>
      </Box>
    );
  }

  if (!geoJson?.features?.length) {
    return (
      <Box py={4} textAlign="center">
        <Typography variant="body2" color="text.secondary">
          Trace alignment and identify parcels to view acquisition geometry on the map.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ height: 420 }}>
        <MapViewer
          basemaps={LA_BASEMAPS}
          defaultBasemapId="osm"
          overlayLayers={overlayLayers}
          flyTargetRevision={revision}
        />
      </Box>
      <LaGisVisualizationLegend />
    </Box>
  );
}
