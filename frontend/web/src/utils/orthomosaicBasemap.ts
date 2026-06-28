import type { BasemapConfig } from './basemapLayers';



export type OrthomosaicSourceType = 'xyz' | 'file';



export type OrthomosaicConfig = {

  sourceType?: OrthomosaicSourceType;

  tileUrl?: string;

  fileName?: string | null;

  fileUrl?: string | null;

  name?: string | null;

  attribution?: string | null;

  maxZoom?: number | null;

};



export function normalizeOrthomosaicConfig(raw: unknown): OrthomosaicConfig | null {

  if (!raw || typeof raw !== 'object') return null;

  const config = raw as Record<string, unknown>;

  const tileUrl = String(

    config.tileUrl ?? config.tile_url ?? config.mosaicUrl ?? config.mosaic_url ?? '',

  ).trim();

  const fileUrl = String(config.fileUrl ?? config.file_url ?? '').trim();

  const fileName = String(config.fileName ?? config.file_name ?? '').trim();

  const sourceType = (config.sourceType ?? config.source_type) as OrthomosaicSourceType | undefined;



  if (fileUrl || fileName || sourceType === 'file') {

    if (!fileUrl) return null;

    return {

      sourceType: 'file',

      fileUrl,

      fileName: fileName || null,

      tileUrl: undefined,

      name: (config.name as string | null | undefined) ?? null,

      attribution: (config.attribution as string | null | undefined) ?? null,

      maxZoom: ((config.maxZoom ?? config.max_zoom) as number | null | undefined) ?? null,

    };

  }



  if (!tileUrl) return null;

  return {

    sourceType: 'xyz',

    tileUrl,

    name: (config.name as string | null | undefined) ?? null,

    attribution: (config.attribution as string | null | undefined) ?? null,

    maxZoom: ((config.maxZoom ?? config.max_zoom) as number | null | undefined) ?? null,

  };

}



export function validateOrthomosaicTileUrl(tileUrl: string): string | null {

  const url = tileUrl.trim();

  if (!url) return 'Mosaic URL is required.';

  if (!/^https?:\/\//i.test(url)) return 'Mosaic URL must start with http:// or https://';

  if (!/\{z\}/i.test(url) || !/\{x\}/i.test(url) || !/\{y\}/i.test(url)) {

    return 'Mosaic URL must include {z}, {x}, and {y} placeholders.';

  }

  return null;

}



export function hasOrthomosaicBasemap(config?: OrthomosaicConfig | null | unknown) {

  const normalized = normalizeOrthomosaicConfig(config);

  if (!normalized) return false;

  return Boolean(normalized.tileUrl || normalized.fileUrl);

}



export function projectOrthoBasemapId(projectId: string) {

  return `ortho-${projectId}`;

}



export function orthomosaicFileDownloadUrl(projectId: string) {

  return `/api/v1/projects/${projectId}/orthomosaic/file`;

}



export function buildOrthoBasemap(

  projectId: string,

  projectName: string,

  config: OrthomosaicConfig | unknown,

): BasemapConfig {

  const normalized = normalizeOrthomosaicConfig(config);

  if (!normalized) {

    throw new Error('Orthomosaic config is missing a tile URL or uploaded file.');

  }



  if (normalized.sourceType === 'file' || normalized.fileUrl) {

    return {

      id: projectOrthoBasemapId(projectId),

      name: normalized.name?.trim() || `${projectName} Drone`,

      sourceType: 'geotiff',

      sourceConfig: {

        url: normalized.fileUrl ?? orthomosaicFileDownloadUrl(projectId),

        attribution: normalized.attribution?.trim() || 'Drone orthomosaic',

        fileName: normalized.fileName ?? undefined,

      },

    };

  }



  const tileUrl = normalized.tileUrl;

  if (!tileUrl) {

    throw new Error('Orthomosaic config is missing a tile URL.');

  }



  return {

    id: projectOrthoBasemapId(projectId),

    name: normalized.name?.trim() || `${projectName} Drone`,

    sourceType: 'xyz',

    sourceConfig: {

      url: tileUrl,

      attribution: normalized.attribution?.trim() || 'Drone orthomosaic',

      maxZoom: normalized.maxZoom ?? 22,

    },

  };

}



export async function fetchAuthenticatedArrayBuffer(url: string): Promise<ArrayBuffer> {

  const token = localStorage.getItem('egip_token');

  const response = await fetch(url, {

    headers: token ? { Authorization: `Bearer ${token}` } : {},

  });

  if (!response.ok) {

    throw new Error(`Failed to load orthomosaic file (${response.status}).`);

  }

  return response.arrayBuffer();

}


