import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, Chip, CircularProgress, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import OlMap from 'ol/Map';
import View from 'ol/View';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import GeoJSON from 'ol/format/GeoJSON';
import { fromLonLat, toLonLat, transformExtent } from 'ol/proj';
import { Style, Fill, Stroke, Circle as CircleStyle } from 'ol/style';
import { unByKey } from 'ol/Observable';
import { feature as turfFeature } from '@turf/helpers';
import booleanWithin from '@turf/boolean-within';
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

type DistrictBoundaryCollection = {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: { type: string; coordinates: unknown };
    properties?: Record<string, unknown>;
  }>;
};

type BasemapMode = 'satellite' | 'hybrid';

const boundaryStyle = new Style({
  stroke: new Stroke({ color: 'rgba(2, 132, 199, 0.95)', width: 2.5 }),
  fill: new Fill({ color: 'rgba(2, 132, 199, 0.07)' }),
});

const pickStyle = new Style({
  image: new CircleStyle({
    radius: 8,
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

function isPointInsideDistrict(
  lat: number,
  lng: number,
  districtBoundary: DistrictBoundaryCollection | null | undefined,
): boolean {
  if (!districtBoundary?.features?.length) return true;
  const point = turfFeature({ type: 'Point', coordinates: [lng, lat] });
  return districtBoundary.features.some((boundary) => {
    if (!boundary.geometry?.type) return false;
    return booleanWithin(point, turfFeature(boundary.geometry as GeoJSON.Geometry));
  });
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
  const boundarySource = useRef(new VectorSource());
  const pickSource = useRef(new VectorSource());
  const districtBoundaryRef = useRef<DistrictBoundaryCollection | null>(null);
  const districtNameRef = useRef('Chamoli');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [districtName, setDistrictName] = useState('Chamoli');
  const [basemapMode, setBasemapMode] = useState<BasemapMode>('satellite');
  const [hint, setHint] = useState('Zoom to your rooftop inside the district boundary and tap');

  const resolveAt = useCallback(async (lat: number, lng: number) => {
    if (!isPointInsideDistrict(lat, lng, districtBoundaryRef.current)) {
      setHint(`Tap inside ${districtNameRef.current} district boundary only`);
      return;
    }

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
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setHint(typeof msg === 'string' ? msg : 'Could not resolve Khasra/House number. Zoom closer and tap again.');
    } finally {
      setBusy(false);
    }
  }, [onSelect, projectCode]);

  useEffect(() => {
    if (!open || !mapRef.current) return undefined;

    boundarySource.current.clear();
    pickSource.current.clear();
    districtBoundaryRef.current = null;
    setLoading(true);
    setHint('Zoom to your rooftop inside the district boundary and tap');

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
        new VectorLayer({ source: boundarySource.current, style: boundaryStyle, zIndex: 2 }),
        new VectorLayer({ source: pickSource.current, style: pickStyle, zIndex: 3 }),
      ],
      view: new View({
        center: fromLonLat([79.5, 30.35]),
        zoom: 9,
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

    const geoJson = new GeoJSON();

    consumerPortalApi.listHouseholdPlots(projectCode?.trim() || undefined)
      .then((res) => {
        const name = String(res.data?.districtName ?? 'Chamoli');
        districtNameRef.current = name;
        setDistrictName(name);

        const boundary = res.data?.districtBoundary as DistrictBoundaryCollection | undefined;
        districtBoundaryRef.current = boundary ?? null;

        if (boundary?.features?.length) {
          const features = geoJson.readFeatures(boundary, {
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:3857',
          });
          boundarySource.current.addFeatures(features);
        }

        const bbox = res.data?.bbox as number[] | undefined;
        if (bbox?.length === 4 && bbox.every((v) => Number.isFinite(v))) {
          const extent = transformExtent(bbox as [number, number, number, number], 'EPSG:4326', 'EPSG:3857');
          map.getView().fit(extent, { padding: [28, 28, 28, 28], duration: 500, maxZoom: 12 });
        } else {
          const center = res.data?.center as { lat: number; lng: number; zoom?: number } | undefined;
          if (center?.lat != null && center?.lng != null) {
            map.getView().animate({
              center: fromLonLat([center.lng, center.lat]),
              zoom: center.zoom ?? 10,
              duration: 400,
            });
          }
        }

        setHint(`${name} district — zoom to your house rooftop and tap`);
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
        <Box display="flex" alignItems="center" gap={1} flexWrap="wrap" flex={1} minWidth={180}>
          <Chip
            size="small"
            label={`${districtName} boundary`}
            sx={{ fontWeight: 700, bgcolor: 'rgba(2,132,199,0.1)', color: '#0369a1' }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
            {hint}
          </Typography>
        </Box>
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
        }}
      />
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
        {defaultBasemapId.startsWith('google')
          ? 'Google satellite — only inside the blue district boundary. Zoom to rooftop, tap your building.'
          : 'Satellite imagery — only inside the blue district boundary. Zoom to rooftop, tap your building.'}
      </Typography>
      {(loading || busy) && (
        <Box display="flex" alignItems="center" gap={1} mt={1}>
          <CircularProgress size={16} />
          <Typography variant="caption" color="text.secondary">
            {loading ? 'Loading district map…' : 'Reading Khasra / House number…'}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
