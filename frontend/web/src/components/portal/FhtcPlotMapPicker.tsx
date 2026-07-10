import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import OlMap from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import OSM from 'ol/source/OSM';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { fromLonLat, toLonLat } from 'ol/proj';
import { Style, Fill, Stroke, Circle as CircleStyle } from 'ol/style';
import { unByKey } from 'ol/Observable';
import { consumerPortalApi } from '../../services/portalApi';

export type FhtcPlotSelection = {
  fhtcNumber: string;
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

const plotStyle = new Style({
  image: new CircleStyle({
    radius: 7,
    fill: new Fill({ color: 'rgba(2, 132, 199, 0.85)' }),
    stroke: new Stroke({ color: '#ffffff', width: 2 }),
  }),
});

const pickStyle = new Style({
  image: new CircleStyle({
    radius: 9,
    fill: new Fill({ color: 'rgba(220, 38, 38, 0.9)' }),
    stroke: new Stroke({ color: '#ffffff', width: 2 }),
  }),
});

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
  const [hint, setHint] = useState('Tap your household plot on the map');

  const resolveAt = useCallback(async (lat: number, lng: number) => {
    setBusy(true);
    setHint('Resolving household number…');
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
        village: data.village ?? null,
        ward: data.ward ?? null,
        latitude: Number(data.latitude ?? lat),
        longitude: Number(data.longitude ?? lng),
        snapped: Boolean(data.snapped),
        message: typeof data.message === 'string' ? data.message : undefined,
      });
      setHint(
        data.snapped
          ? `Selected ${data.fhtcNumber} at this plot`
          : `Assigned ${data.fhtcNumber} for this location`,
      );
    } catch {
      setHint('Could not resolve FHTC for this location. Try again.');
    } finally {
      setBusy(false);
    }
  }, [onSelect, projectCode]);

  useEffect(() => {
    if (!open || !mapRef.current) return undefined;

    plotSource.current.clear();
    pickSource.current.clear();
    setLoading(true);
    setHint('Tap your household plot on the map');

    const map = new OlMap({
      target: mapRef.current,
      layers: [
        new TileLayer({ source: new OSM() }),
        new VectorLayer({ source: plotSource.current, style: plotStyle }),
        new VectorLayer({ source: pickSource.current, style: pickStyle }),
      ],
      view: new View({
        center: fromLonLat([79.6512, 30.2656]),
        zoom: 14,
      }),
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
          const feature = new Feature({
            geometry: new Point(fromLonLat([plot.longitude, plot.latitude])),
            fhtcNumber: plot.fhtcNumber,
          });
          plotSource.current.addFeature(feature);
        });
        if (center?.lat != null && center?.lng != null) {
          map.getView().animate({
            center: fromLonLat([center.lng, center.lat]),
            zoom: center.zoom ?? 15,
            duration: 400,
          });
        }
      })
      .catch(() => setHint('Map loaded — tap your plot location'))
      .finally(() => setLoading(false));

    return () => {
      unByKey(clickKey);
      map.setTarget(undefined);
      mapInstance.current = null;
    };
  }, [open, projectCode, resolveAt]);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setHint('Geolocation not available in this browser');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => { void resolveAt(pos.coords.latitude, pos.coords.longitude); },
      () => setHint('Could not detect GPS location'),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  if (!open) return null;

  return (
    <Box sx={{ mt: 1.5 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1} gap={1} flexWrap="wrap">
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
          {hint}
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={<MapOutlinedIcon />}
          onClick={useMyLocation}
          disabled={busy}
          sx={{ textTransform: 'none' }}
        >
          Use my GPS
        </Button>
      </Box>
      <Box
        ref={mapRef}
        sx={{
          height: 260,
          borderRadius: 2,
          overflow: 'hidden',
          border: '1px solid #bae6fd',
          position: 'relative',
        }}
      />
      {(loading || busy) && (
        <Box display="flex" alignItems="center" gap={1} mt={1}>
          <CircularProgress size={16} />
          <Typography variant="caption" color="text.secondary">
            {loading ? 'Loading household plots…' : 'Updating FHTC…'}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
