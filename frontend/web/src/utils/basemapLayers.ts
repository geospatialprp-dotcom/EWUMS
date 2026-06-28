import TileLayer from 'ol/layer/Tile';
import WebGLTile from 'ol/layer/WebGLTile';
import type BaseLayer from 'ol/layer/Base';
import Google from 'ol/source/Google';
import GeoTIFF from 'ol/source/GeoTIFF';
import XYZ from 'ol/source/XYZ';
import { fetchAuthenticatedArrayBuffer } from './orthomosaicBasemap';

export interface BasemapConfig {
  id: string;
  name: string;
  sourceType: string;
  sourceConfig: {
    url?: string;
    attribution?: string;
    maxZoom?: number;
    mapType?: string;
    apiKey?: string;
    fileName?: string;
  };
}

/** Default Map Explorer view — worldwide, WGS 84 geographic (EPSG:4326). */
export const WORLD_VIEW_WGS84 = {
  center: [0, 20] as [number, number],
  zoom: 2,
  projection: 'EPSG:4326',
};

/** Uttarakhand state default extent for Super Admin / state-wide users. */
export const UTTARAKHAND_STATE_MAP_VIEW = {
  center: [78.8, 30.2] as [number, number],
  zoom: 7.2,
  bbox: [77.57, 28.43, 81.03, 31.45] as [number, number, number, number],
};

/** Shown when API layer catalog is empty or unavailable. */
export const DEFAULT_FALLBACK_BASEMAPS: BasemapConfig[] = [
  {
    id: 'osm-default',
    name: 'OpenStreetMap',
    sourceType: 'xyz',
    sourceConfig: {
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '© OpenStreetMap contributors',
    },
  },
  {
    id: 'basemap-none',
    name: 'None',
    sourceType: 'none',
    sourceConfig: {},
  },
];

export const DEFAULT_MAP_LAYER_CATALOG = [
  {
    id: 'basemaps-group',
    name: 'Basemaps',
    isExpanded: true,
    layers: DEFAULT_FALLBACK_BASEMAPS.map((basemap) => ({
      id: basemap.id,
      name: basemap.name,
      sourceType: basemap.sourceType,
      sourceConfig: basemap.sourceConfig,
      defaultStyle: {},
      minZoom: null,
      maxZoom: null,
    })),
  },
];

export function isBlankBasemap(config: BasemapConfig): boolean {
  return config.sourceType === 'none';
}

export function isGoogleBasemap(config: BasemapConfig): boolean {
  return config.sourceType === 'google';
}

export function isGeoTiffBasemap(config: BasemapConfig): boolean {
  return config.sourceType === 'geotiff';
}

function resolveGoogleApiKey(config: BasemapConfig): string | undefined {
  const fromConfig = config.sourceConfig.apiKey?.trim();
  if (fromConfig) return fromConfig;

  const fromEnv = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (typeof fromEnv === 'string' && fromEnv.trim()) return fromEnv.trim();

  return undefined;
}

export function createBasemapLayer(config: BasemapConfig): TileLayer | null {
  if (isBlankBasemap(config) || isGeoTiffBasemap(config)) return null;

  if (isGoogleBasemap(config)) {
    const apiKey = resolveGoogleApiKey(config);
    if (!apiKey) {
      console.warn(
        `[EGIP] Google basemap "${config.name}" requires VITE_GOOGLE_MAPS_API_KEY in frontend/web/.env`,
      );
      return null;
    }

    return new TileLayer({
      source: new Google({
        key: apiKey,
        mapType: config.sourceConfig.mapType ?? 'satellite',
        highDpi: true,
      }),
      properties: { basemapId: config.id, basemapName: config.name },
      zIndex: 0,
    });
  }

  const url = config.sourceConfig.url;
  if (!url) {
    throw new Error(`Basemap "${config.name}" is missing a tile URL.`);
  }

  return new TileLayer({
    source: new XYZ({
      url,
      attributions: config.sourceConfig.attribution,
      maxZoom: config.sourceConfig.maxZoom ?? 19,
      crossOrigin: 'anonymous',
    }),
    properties: { basemapId: config.id, basemapName: config.name },
    zIndex: 0,
  });
}

export async function createGeoTiffBasemapLayer(config: BasemapConfig): Promise<WebGLTile | null> {
  if (!isGeoTiffBasemap(config)) return null;
  const url = config.sourceConfig.url;
  if (!url) {
    throw new Error(`Basemap "${config.name}" is missing an orthomosaic file URL.`);
  }

  const arrayBuffer = await fetchAuthenticatedArrayBuffer(url);
  return new WebGLTile({
    source: new GeoTIFF({
      sources: [{ arrayBuffer }],
      normalize: true,
    }),
    properties: { basemapId: config.id, basemapName: config.name },
    zIndex: 0,
  });
}

export type BasemapLayer = BaseLayer;
