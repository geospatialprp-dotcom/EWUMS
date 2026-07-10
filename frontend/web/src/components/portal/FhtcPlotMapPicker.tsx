import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, CircularProgress, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import OlMap from 'ol/Map';
import View from 'ol/View';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { fromLonLat, toLonLat } from 'ol/proj';
import { Style, Fill, Stroke, Circle as CircleStyle } from 'ol/style';
import { unByKey } from 'ol/Observable';
import {
  createBasemapLayer,
  ESRI_HYBRID_BASEMAP,
  ESRI_SATELLITE_BASEMAP,
  getDefaultSatelliteBasemapId,
  GOOGLE_HYBRID_BASEMAP,
  GOOGLE_SATELLITE_BASEMAP,
  hasGoogleMapsApiKey,
} from '../../utils/basemapLayers';
import { consumerPortalApi } from '../../services/portalApi';

export type FhtcPlotSelection = {
  fhtcNumber: string;
  khasraNo?: string | null;
  houseNo?: string | null;
  village?: string | null;
  ward?: string | null;
  latitude: number;
  longitude: number;
  snapped?: boolean;
  message?: string;
};

type PlotRow = {
  id: string;
  fhtcNumber: string;
  village?: string | null;
  ward?: string | null;
  latitude: number;
  longitude: number;
  source?: string;
};

type BasemapMode = 'satellite' | 'hybrid';

const plotStyle = new Style({
  image: new CircleStyle({
    radius: 6,
    fill: new Fill({ color: 'rgba(2, 132, 199, 0.85)' }),
    stroke: new Stroke({ color: '#ffffff', width: 2 }),
  }),
});

const pickStyle = new Style({
  image: new CircleStyle({
    radius: 10,
    fill: new Fill({ color: 'rgba(220, 38, 38, 0.92)' }),
    stroke: new Stroke({ color: '#ffffff', width: 2.5 }),
  }),
});

function resolveBasemapConfig(mode: BasemapMode) {
  if (hasGoogleMapsApiKey()) {
    return mode === 'hybrid' ? GOOGLE_HYBRID_BASEMAP : GOOGLE_SATELLITE_BASEMAP;
  }
  return mode === 'hybrid' ? ESRI_HYBRID_BASEMAP : ESRI_SATELLITE_BASEMAP;
}

export default function FhtcPlotMapPicker({
  open,
  projectCode,
  onSelect,
}: {
  open: boolean;
  projectCode?: string;
  onSelect: (selection: FhtcPlotSelection) => void;
}) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<OlMap | null>(null);
  const plotSource = useRef(new VectorSource());
  const pickSource = useRef(new VectorSource());
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [basemapMode, setBasemapMode] = useState<BasemapMode>('satellite');
  const [hint, setHint] = useState('Zoom to your rooftop and tap the building');

  const resolveAt = useCallback(async (lat: number, lng: number) => {
    setBusy(true);
    setHint('Reading Khasra / House number…');
    try {
      const { data } = await consumerPortalApi.resolveHouseholdPlot({
        latitude: lat,
        longitude: lng,
        projectCode: projectCode?.trim() || undefined,
      });
      pickSource.current.clear();
      pickSource.current.addFeature(new Feature({
        geometry: new Point(fromLonLat([lng, lat])),
      }));
      onSelect({
        fhtcNumber: String(data.fhtcNumber),
        khasraNo: data.khasraNo ?? null,
        houseNo: data.houseNo ?? null,
        village: data.village ?? null,
        ward: data.ward ?? null,
        latitude: Number(data.latitude ?? lat),
        longitude: Number(data.longitude ?? lng),
        snapped: Boolean(data.snapped),
        message: typeof data.message === 'string' ? data.message : undefined,
      });
      setHint(
        typeof data.message === 'string'
          ? data.message
          : `Household ${data.fhtcNumber} assigned for this rooftop`,
      );
    } catch {
      setHint('Could not resolve Khasra/House number. Zoom closer and tap again.');
    } finally {
      setBusy(false);
    }
  }, [onSelect, projectCode]);

  useEffect(() => {
    if (!open || !mapRef.current) return undefined;

    plotSource.current.clear();
    pickSource.current.clear();
    setLoading(true);
    setHint('Zoom to your rooftop and tap the building');

    const basemapConfig = resolveBasemapConfig(basemapMode);
    const basemapLayer = createBasemapLayer(basemapConfig);
    if (!basemapLayer) {
      setHint('Satellite map unavailable — check map API configuration');
      setLoading(false);
      return undefined;
    }

    const map = new OlMap({
      target: mapRef.current,
      layers: [
        basemapLayer,
        new VectorLayer({ source: plotSource.current, style: plotStyle, zIndex: 2 }),
        new VectorLayer({ source: pickSource.current, style: pickStyle, zIndex: 3 }),
      ],
      view: new View({
        center: fromLonLat([79.6512, 30.2656]),
        zoom: 17,
        maxZoom: hasGoogleMapsApiKey() ? 22 : 19,
        constrainResolution: false,
      }),
      controls: [],
    });
    mapInstance.current = map;

    const clickKey = map.on('singleclick', (evt) => {
      const [lng, lat] = toLonLat(evt.coordinate);
      void resolveAt(lat, lng);
    });

    consumerPortalApi.listHouseholdPlots(projectCode?.trim() || undefined)
      .then((res) => {
        const plots = (res.data?.plots ?? []) as PlotRow[];
        const center = res.data?.center as { lat: number; lng: number; zoom?: number } | undefined;
        plots.forEach((plot) => {
          if (!Number.isFinite(plot.latitude) || !Number.isFinite(plot.longitude)) return;
          plotSource.current.addFeature(new Feature({
            geometry: new Point(fromLonLat([plot.longitude, plot.latitude])),
            fhtcNumber: plot.fhtcNumber,
          }));
        });
        if (center?.lat != null && center?.lng != null) {
          map.getView().animate({
            center: fromLonLat([center.lng, center.lat]),
            zoom: center.zoom ?? 17,
            duration: 400,
          });
        }
      })
      .catch(() => setHint('Satellite map ready — zoom in and tap your rooftop'))
      .finally(() => setLoading(false));

    return () => {
      unByKey(clickKey);
      map.setTarget(undefined);
      mapInstance.current = null;
    };
  }, [open, projectCode, resolveAt, basemapMode]);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setHint('Geolocation not available in this browser');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const map = mapInstance.current;
        if (map) {
          map.getView().animate({
            center: fromLonLat([pos.coords.longitude, pos.coords.latitude]),
            zoom: 19,
            duration: 500,
          });
        }
        void resolveAt(pos.coords.latitude, pos.coords.longitude);
      },
      () => setHint('Could not detect GPS location'),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  if (!open) return null;

  const defaultBasemapId = getDefaultSatelliteBasemapId();

  return (
    <Box sx={{ mt: 1.5 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1} gap={1} flexWrap="wrap">
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, flex: 1, minWidth: 180 }}>
          {hint}
        </Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={basemapMode}
          onChange={(_, value: BasemapMode | null) => value && setBasemapMode(value)}
          sx={{ '& .MuiToggleButton-root': { textTransform: 'none', px: 1.25, py: 0.25, fontSize: '0.72rem' } }}
        >
          <ToggleButton value="satellite">Satellite</ToggleButton>
          <ToggleButton value="hybrid">Labels</ToggleButton>
        </ToggleButtonGroup>
        <Button
          size="small"
          variant="outlined"
          startIcon={<MyLocationIcon />}
          onClick={useMyLocation}
          disabled={busy}
          sx={{ textTransform: 'none' }}
        >
          My GPS
        </Button>
      </Box>
      <Box
        ref={mapRef}
        sx={{
          height: 320,
          borderRadius: 2,
          overflow: 'hidden',
          border: '1px solid #bae6fd',
          position: 'relative',
          cursor: 'crosshair',
          '&::after': {
            content: '""',
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            boxShadow: 'inset 0 0 0 1px rgba(2,132,199,0.15)',
          },
        }}
      />
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
        {defaultBasemapId.startsWith('google')
          ? 'Google satellite imagery — zoom to rooftop level, then tap your building.'
          : 'Satellite imagery (Esri) — zoom to rooftop level, then tap your building.'}
      </Typography>
      {(loading || busy) && (
        <Box display="flex" alignItems="center" gap={1} mt={1}>
          <CircularProgress size={16} />
          <Typography variant="caption" color="text.secondary">
            {loading ? 'Loading satellite map…' : 'Reading Khasra / House number…'}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
