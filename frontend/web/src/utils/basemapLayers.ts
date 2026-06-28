/**
 * Basemap catalog for Map Explorer and LA map panels.
 *
 * Google satellite/hybrid use OpenLayers `ol/source/Google` (Map Tiles API), not XYZ URLs.
 * Enable in Google Cloud Console (https://console.cloud.google.com/google/maps-apis):
 *   - Map Tiles API (required for Google Satellite / Hybrid)
 *   - Maps JavaScript API (optional; not used by this tile source)
 *
 * Set `VITE_GOOGLE_MAPS_API_KEY` in frontend/web/.env — never commit real keys.
 */
import TileLayer from 'ol/layer/Tile';
import LayerGroup from 'ol/layer/Group';
import WebGLTile from 'ol/layer/WebGLTile';
import type BaseLayer from 'ol/layer/Base';
import Google from 'ol/source/Google';
import GeoTIFF from 'ol/source/GeoTIFF';
import XYZ from 'ol/source/XYZ';
import { fetchAuthenticatedArrayBuffer } from './orthomosaicBasemap';

const ESRI_WORLD_IMAGERY_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const ESRI_REFERENCE_LABELS_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places_Alternate/MapServer/tile/{z}/{y}/{x}';
const ESRI_ATTRIBUTION =
  'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community';

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
    overlayUrl?: string;
    overlayAttribution?: string;
  };
}

export const ESRI_SATELLITE_BASEMAP: BasemapConfig = {
  id: 'satellite-esri',
  name: 'Satellite (Google Earth style)',
  sourceType: 'xyz',
  sourceConfig: {
    url: ESRI_WORLD_IMAGERY_URL,
    attribution: ESRI_ATTRIBUTION,
    maxZoom: 19,
  },
};

export const ESRI_HYBRID_BASEMAP: BasemapConfig = {
  id: 'hybrid-esri',
  name: 'Satellite + Labels',
  sourceType: 'xyz',
  sourceConfig: {
    url: ESRI_WORLD_IMAGERY_URL,
    overlayUrl: ESRI_REFERENCE_LABELS_URL,
    attribution: ESRI_ATTRIBUTION,
    maxZoom: 19,
  },
};

export const GOOGLE_SATELLITE_BASEMAP: BasemapConfig = {
  id: 'google-satellite',
  name: 'Google Satellite',
  sourceType: 'google',
  sourceConfig: {
    mapType: 'satellite',
    attribution: 'Imagery © Google',
    maxZoom: 22,
  },
};

export const GOOGLE_HYBRID_BASEMAP: BasemapConfig = {
  id: 'google-hybrid',
  name: 'Google Hybrid',
  sourceType: 'google',
  sourceConfig: {
    mapType: 'hybrid',
    attribution: 'Imagery © Google',
    maxZoom: 22,
  },
};

export const OPENSTREETMAP_BASEMAP: BasemapConfig = {
  id: 'osm-default',
  name: 'OpenStreetMap',
  sourceType: 'xyz',
  sourceConfig: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
  },
};

export const BLANK_BASEMAP: BasemapConfig = {
  id: 'basemap-none',
  name: 'None',
  sourceType: 'none',
  sourceConfig: {},
};

export function hasGoogleMapsApiKey(): boolean {
  const fromEnv = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  return typeof fromEnv === 'string' && fromEnv.trim().length > 0;
}

export function buildOptionalGoogleBasemaps(): BasemapConfig[] {
  if (!hasGoogleMapsApiKey()) return [];
  return [GOOGLE_SATELLITE_BASEMAP, GOOGLE_HYBRID_BASEMAP];
}

const ESRI_BASEMAPS: BasemapConfig[] = [ESRI_SATELLITE_BASEMAP, ESRI_HYBRID_BASEMAP];

/** Satellite-first basemaps for Map Explorer fallback and LA map panels. */
export function buildSatelliteFirstBasemaps(osmId = 'osm-default'): BasemapConfig[] {
  const googleBasemaps = buildOptionalGoogleBasemaps();
  const satelliteBasemaps = googleBasemaps.length
    ? [...googleBasemaps, ...ESRI_BASEMAPS]
    : ESRI_BASEMAPS;

  return [
    ...satelliteBasemaps,
    { ...OPENSTREETMAP_BASEMAP, id: osmId },
    BLANK_BASEMAP,
  ];
}

/** Default satellite basemap id — Google when API key is set, otherwise Esri. */
export function getDefaultSatelliteBasemapId(): string {
  return hasGoogleMapsApiKey() ? GOOGLE_SATELLITE_BASEMAP.id : ESRI_SATELLITE_BASEMAP.id;
}

export function resolveDefaultBasemapId(
  basemaps: BasemapConfig[],
  activeBasemapId?: string,
): string {
  if (activeBasemapId) return activeBasemapId;

  const firstTileBasemap = basemaps.find((config) => !isBlankBasemap(config));
  if (firstTileBasemap) return firstTileBasemap.id;

  return getDefaultSatelliteBasemapId();
}

export const LA_MAP_BASEMAPS: BasemapConfig[] = buildSatelliteFirstBasemaps('osm');

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
export const DEFAULT_FALLBACK_BASEMAPS: BasemapConfig[] = buildSatelliteFirstBasemaps();

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

function createXyzTileLayer(
  url: string,
  config: BasemapConfig,
  attribution?: string,
): TileLayer {
  return new TileLayer({
    source: new XYZ({
      url,
      attributions: attribution ?? config.sourceConfig.attribution,
      maxZoom: config.sourceConfig.maxZoom ?? 19,
      crossOrigin: 'anonymous',
    }),
    zIndex: 0,
  });
}

export function createBasemapLayer(config: BasemapConfig): BaseLayer | null {
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

  const overlayUrl = config.sourceConfig.overlayUrl?.trim();
  if (overlayUrl) {
    return new LayerGroup({
      layers: [
        createXyzTileLayer(url, config),
        createXyzTileLayer(
          overlayUrl,
          config,
          config.sourceConfig.overlayAttribution ?? config.sourceConfig.attribution,
        ),
      ],
      properties: { basemapId: config.id, basemapName: config.name },
      zIndex: 0,
    });
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

type SatelliteBasemapLayer = {
  id: string;
  name: string;
  sourceType: string;
  sourceConfig?: BasemapConfig['sourceConfig'];
};

function findGoogleSatelliteBasemap(layers: SatelliteBasemapLayer[]) {
  return layers.find(
    (layer) =>
      layer.id === GOOGLE_SATELLITE_BASEMAP.id
      || layer.name === 'Google Imagery'
      || layer.name === GOOGLE_SATELLITE_BASEMAP.name
      || (layer.sourceType === 'google' && layer.sourceConfig?.mapType === 'satellite'),
  );
}

function findEsriSatelliteBasemap(layers: SatelliteBasemapLayer[]) {
  const byId = layers.find((layer) => layer.id === ESRI_SATELLITE_BASEMAP.id);
  if (byId) return byId;

  const esriByName = layers.find(
    (layer) =>
      layer.name === ESRI_SATELLITE_BASEMAP.name
      || layer.name === 'Satellite Imagery',
  );
  if (esriByName) return esriByName;

  return layers.find(
    (layer) =>
      layer.sourceType === 'xyz'
      && typeof layer.sourceConfig?.url === 'string'
      && layer.sourceConfig.url.includes('World_Imagery'),
  );
}

/** Prefer Google satellite when API key is set, otherwise Esri satellite from a catalog group. */
export function findSatelliteImageryBasemap(
  layers: SatelliteBasemapLayer[],
): SatelliteBasemapLayer | undefined {
  if (hasGoogleMapsApiKey()) {
    const googleSatellite = findGoogleSatelliteBasemap(layers);
    if (googleSatellite) return googleSatellite;
  }

  return findEsriSatelliteBasemap(layers) ?? findGoogleSatelliteBasemap(layers);
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
