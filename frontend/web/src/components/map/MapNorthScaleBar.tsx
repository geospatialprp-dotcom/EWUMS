import { useCallback, useEffect, useRef, useState } from 'react';
import type OlMap from 'ol/Map';
import { getPointResolution } from 'ol/proj';
import { unByKey } from 'ol/Observable';
import type { EventsKey } from 'ol/events';
import { Box, Typography } from '@mui/material';
import { MAP_CHROME, mapCompassCardSx } from '../../utils/mapChromeStyles';

type ScaleBarState = {
  barWidthPx: number;
  label: string;
};

const MAX_BAR_PX = 96;
const NICE_METERS = [
  1, 2, 5, 10, 20, 50, 100, 200, 500,
  1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000,
];

function pointerToMapRotation(angleRad: number): number {
  return -angleRad;
}

function mapRotationToPointer(angleRad: number): number {
  return -angleRad;
}

const CARDINAL_ROTATION: Record<string, number> = {
  N: 0,
  E: pointerToMapRotation(Math.PI / 2),
  S: pointerToMapRotation(Math.PI),
  W: pointerToMapRotation(-Math.PI / 2),
};

function pointerAngleRad(event: PointerEvent, element: HTMLElement): number {
  const rect = element.getBoundingClientRect();
  const x = event.clientX - (rect.left + rect.width / 2);
  const y = event.clientY - (rect.top + rect.height / 2);
  return Math.atan2(x, -y);
}

function computeScaleBar(map: OlMap): ScaleBarState {
  const view = map.getView();
  const resolution = view.getResolution();
  const center = view.getCenter();
  const projection = view.getProjection();

  if (resolution == null || !center) {
    return { barWidthPx: 0, label: '—' };
  }

  const metersPerPixel = getPointResolution(projection, resolution, center);
  if (!Number.isFinite(metersPerPixel) || metersPerPixel <= 0) {
    return { barWidthPx: 0, label: '—' };
  }

  const maxMeters = metersPerPixel * MAX_BAR_PX;
  let chosen = NICE_METERS[0];
  for (const value of NICE_METERS) {
    if (value <= maxMeters) chosen = value;
    else break;
  }

  const barWidthPx = Math.max(24, Math.round(chosen / metersPerPixel));
  const label = chosen >= 1000
    ? `${chosen % 1000 === 0 ? chosen / 1000 : (chosen / 1000).toFixed(1)} km`
    : `${chosen} m`;

  return { barWidthPx, label };
}

interface MapNorthScaleBarProps {
  map: OlMap | null;
}

export default function MapNorthScaleBar({ map }: MapNorthScaleBarProps) {
  const compassRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const [rotationDeg, setRotationDeg] = useState(0);
  const [scale, setScale] = useState<ScaleBarState>({ barWidthPx: 0, label: '—' });
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!map) return undefined;

    const view = map.getView();
    const keys: EventsKey[] = [];

    const refresh = () => {
      if (draggingRef.current) return;
      const rotation = view.getRotation();
      setRotationDeg((mapRotationToPointer(rotation) * 180) / Math.PI);
      setScale(computeScaleBar(map));
    };

    keys.push(view.on('change:rotation', refresh));
    keys.push(view.on('change:resolution', refresh));
    keys.push(view.on('change:center', refresh));
    keys.push(map.on('moveend', refresh));
    refresh();

    return () => {
      unByKey(keys);
    };
  }, [map]);

  const setMapRotation = useCallback((rotation: number, animate = false) => {
    if (!map) return;
    const view = map.getView();
    setRotationDeg((mapRotationToPointer(rotation) * 180) / Math.PI);
    if (animate) {
      view.animate({ rotation, duration: 250 });
    } else {
      view.setRotation(rotation);
    }
  }, [map]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!map || !compassRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    draggingRef.current = true;
    setDragging(true);
    compassRef.current.setPointerCapture(event.pointerId);
    setMapRotation(pointerToMapRotation(pointerAngleRad(event.nativeEvent, compassRef.current)));
  }, [map, setMapRotation]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || !map || !compassRef.current) return;
    event.preventDefault();
    setMapRotation(pointerToMapRotation(pointerAngleRad(event.nativeEvent, compassRef.current)));
  }, [map, setMapRotation]);

  const endDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    if (compassRef.current?.hasPointerCapture(event.pointerId)) {
      compassRef.current.releasePointerCapture(event.pointerId);
    }
    if (map) setScale(computeScaleBar(map));
  }, [map]);

  const snapToCardinal = useCallback((direction: keyof typeof CARDINAL_ROTATION) => {
    setMapRotation(CARDINAL_ROTATION[direction], true);
  }, [setMapRotation]);

  if (!map) return null;

  const compassSize = 56;

  return (
    <Box sx={mapCompassCardSx()}>
      <Box
        ref={compassRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        title="Drag to rotate map · Click N/E/S/W to snap"
        sx={{
          position: 'relative',
          width: compassSize,
          height: compassSize,
          mx: 'auto',
          mb: 0.75,
          cursor: dragging ? 'grabbing' : 'grab',
          touchAction: 'none',
        }}
      >
          <Box
            sx={{
              position: 'absolute',
              inset: 4,
              borderRadius: '50%',
              border: '1px solid',
              borderColor: 'rgba(100, 116, 139, 0.45)',
              pointerEvents: 'none',
            }}
          />

        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            transform: `rotate(${rotationDeg}deg)`,
            transformOrigin: '50% 50%',
            transition: dragging ? 'none' : 'transform 0.15s ease-out',
          }}
        >
          {(['N', 'E', 'S', 'W'] as const).map((dir) => {
            const isNorth = dir === 'N';
            const position = dir === 'N'
              ? { top: 0, left: '50%', transform: 'translateX(-50%)' }
              : dir === 'S'
                ? { bottom: 0, left: '50%', transform: 'translateX(-50%)' }
                : dir === 'E'
                  ? { top: '50%', right: 0, transform: 'translateY(-50%)' }
                  : { top: '50%', left: 0, transform: 'translateY(-50%)' };

            return (
              <Typography
                key={dir}
                variant="caption"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  snapToCardinal(dir);
                }}
                sx={{
                  position: 'absolute',
                  ...position,
                  fontSize: isNorth ? '0.62rem' : '0.58rem',
                  fontWeight: isNorth ? 700 : 600,
                  color: isNorth ? MAP_CHROME.accent : '#64748b',
                  lineHeight: 1,
                  cursor: 'pointer',
                  zIndex: 2,
                  px: 0.25,
                  pointerEvents: 'auto',
                }}
              >
                {dir}
              </Typography>
            );
          })}

          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: 18,
              height: 18,
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              border: '1px solid',
              borderColor: 'rgba(100, 116, 139, 0.35)',
              bgcolor: 'transparent',
              zIndex: 1,
              pointerEvents: 'none',
            }}
          />

          <Box
            sx={{
              position: 'absolute',
              top: 10,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderBottom: `14px solid ${MAP_CHROME.accent}`,
              pointerEvents: 'none',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              top: 22,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 2,
              height: 10,
              bgcolor: MAP_CHROME.accent,
              borderRadius: 1,
              pointerEvents: 'none',
            }}
          />
        </Box>
      </Box>

      <Box sx={{ minWidth: MAX_BAR_PX }}>
        <Box
          sx={{
            width: scale.barWidthPx || MAX_BAR_PX,
            height: 8,
            border: '1px solid #334155',
            mx: 'auto',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <Box sx={{ flex: 1, bgcolor: '#334155' }} />
          <Box sx={{ flex: 1, bgcolor: '#ffffff' }} />
        </Box>
        <Typography
          variant="caption"
          align="center"
          display="block"
          sx={{ mt: 0.35, fontSize: '0.65rem', fontWeight: 600, color: 'text.secondary' }}
        >
          {scale.label}
        </Typography>
      </Box>
    </Box>
  );
}
