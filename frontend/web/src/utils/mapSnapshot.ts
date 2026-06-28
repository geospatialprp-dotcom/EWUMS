import type OlMap from 'ol/Map';
import BaseLayer from 'ol/layer/Base';
import LayerGroup from 'ol/layer/Group';
import type Layer from 'ol/layer/Layer';
import { getFeatureImageUrl } from './featureImage';

function isCanvasTainted(canvas: HTMLCanvasElement): boolean {
  try {
    const probe = document.createElement('canvas');
    probe.width = 1;
    probe.height = 1;
    const ctx = probe.getContext('2d');
    if (!ctx) return true;
    ctx.drawImage(canvas, 0, 0, 1, 1, 0, 0, 1, 1);
    ctx.getImageData(0, 0, 1, 1);
    return false;
  } catch {
    return true;
  }
}

function collectSkippedOverlayCanvases(map: OlMap): Set<HTMLCanvasElement> {
  const canvases = new Set<HTMLCanvasElement>();

  const visit = (layer: BaseLayer) => {
    if (layer.get('basemapId') || layer.get('cursorOverlay')) {
      const renderer = (layer as Layer).getRenderer?.();
      const container = (renderer as { container?: HTMLElement } | null)?.container;
      container?.querySelectorAll('canvas').forEach((canvas) => {
        if (canvas.width > 0) canvases.add(canvas);
      });
    }
    if (layer instanceof LayerGroup) {
      layer.getLayers().getArray().forEach(visit);
    }
  };

  map.getLayers().getArray().forEach(visit);
  return canvases;
}

type DrawOptions = {
  skipTainted: boolean;
  skipBasemapCanvases: Set<HTMLCanvasElement> | null;
};

function drawMapCanvases(
  map: OlMap,
  context: CanvasRenderingContext2D,
  options: DrawOptions,
): { drewAny: boolean; skippedBasemap: boolean } {
  const canvases = map.getViewport().querySelectorAll<HTMLCanvasElement>('.ol-layer canvas, canvas.ol-layer');
  let drewAny = false;
  let skippedBasemap = false;

  canvases.forEach((canvas) => {
    if (canvas.width === 0) return;

    if (options.skipBasemapCanvases?.has(canvas)) {
      skippedBasemap = true;
      return;
    }

    if (options.skipTainted && isCanvasTainted(canvas)) {
      skippedBasemap = true;
      return;
    }

    const parent = canvas.parentElement as HTMLElement | null;
    const opacity = parent?.style.opacity;
    context.globalAlpha = opacity === '' || opacity == null ? 1 : Number(opacity);

    const matrix = canvas.style.transform.match(/^matrix\(([^)]+)\)$/);
    if (matrix) {
      const values = matrix[1].split(',').map(Number);
      context.setTransform(values[0], values[1], values[2], values[3], values[4], values[5]);
    } else {
      context.setTransform(1, 0, 0, 1, 0, 0);
    }

    context.drawImage(canvas, 0, 0);
    context.setTransform(1, 0, 0, 1, 0, 0);
    drewAny = true;
  });

  return { drewAny, skippedBasemap };
}

function compositeMap(
  map: OlMap,
  mode: 'full' | 'without-basemap',
): { canvas: HTMLCanvasElement | null; skippedBasemap: boolean } {
  const size = map.getSize();
  if (!size || size[0] === 0 || size[1] === 0) {
    return { canvas: null, skippedBasemap: false };
  }

  const mapCanvas = document.createElement('canvas');
  mapCanvas.width = size[0];
  mapCanvas.height = size[1];
  const context = mapCanvas.getContext('2d');
  if (!context) return { canvas: null, skippedBasemap: false };

  const skipBasemapCanvases = mode === 'without-basemap' ? collectSkippedOverlayCanvases(map) : null;

  if (mode === 'without-basemap') {
    context.fillStyle = '#eef2f6';
    context.fillRect(0, 0, size[0], size[1]);
  }

  const { drewAny, skippedBasemap } = drawMapCanvases(map, context, {
    skipTainted: mode === 'without-basemap',
    skipBasemapCanvases,
  });

  if (!drewAny) return { canvas: null, skippedBasemap };
  return { canvas: mapCanvas, skippedBasemap };
}

export type MapSnapshotResult = {
  dataUrl: string | null;
  /** True when basemap tiles were skipped (e.g. Google/satellite without CORS). */
  basemapOmitted?: boolean;
};

export function captureMapSnapshot(map: OlMap): MapSnapshotResult {
  const full = compositeMap(map, 'full');
  if (full.canvas) {
    try {
      return { dataUrl: full.canvas.toDataURL('image/png') };
    } catch {
      // Basemap tiles tainted the canvas — retry without them.
    }
  }

  const partial = compositeMap(map, 'without-basemap');
  if (!partial.canvas) {
    return { dataUrl: null };
  }

  try {
    return {
      dataUrl: partial.canvas.toDataURL('image/png'),
      basemapOmitted: partial.skippedBasemap || full.canvas != null,
    };
  } catch {
    return { dataUrl: null };
  }
}

export function findImageUrl(attributes: Record<string, unknown>): string | null {
  return getFeatureImageUrl(attributes);
}
