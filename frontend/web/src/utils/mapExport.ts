import GeoJSON from 'ol/format/GeoJSON';
import KML from 'ol/format/KML';
import type { Feature as GeoFeature, FeatureCollection } from 'geojson';
import { toGeoFeatureCollection } from './mapGeoJson';
import { createShapefileZip } from './shapefileExport';
import { downloadBlob, downloadText, timestampForFile } from './downloadFile';
import { jpegToPdfBlob } from './pdfExport';

export type MapExportLayer = {
  layerId: string;
  layerName: string;
  features: GeoFeature[];
};

export type MapPrintSize = 'A4' | 'A3';

export type MapLegendItem = {
  name: string;
  color?: string;
};

export type MapLayoutOptions = {
  pageSize: MapPrintSize;
  title: string;
  subtitle?: string;
  legend: MapLegendItem[];
};

const META_KEYS = new Set(['layerId', 'featureClassName', 'geometryType', 'featureId', 'featureClassId', 'featureClassCode']);

const PRINT_DPI = 150;
const MM_PER_INCH = 25.4;

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sanitizeFeatureForExport(feature: GeoFeature): GeoFeature | null {
  if (!feature.geometry) return null;
  const props: Record<string, unknown> = {};
  Object.entries(feature.properties ?? {}).forEach(([key, value]) => {
    if (META_KEYS.has(key)) return;
    if (value == null) return;
    if (typeof value === 'string' && value.startsWith('data:image/')) return;
    if (typeof value === 'object') return;
    props[key] = value;
  });
  return {
    type: 'Feature',
    id: feature.id,
    geometry: feature.geometry,
    properties: props,
  };
}

function layerCollection(layer: MapExportLayer, allowedTypes?: string[]): FeatureCollection {
  const features = layer.features
    .map(sanitizeFeatureForExport)
    .filter((feature): feature is GeoFeature => feature !== null);
  return toGeoFeatureCollection(features, allowedTypes);
}

function extractPlacemarks(kml: string) {
  const doc = new DOMParser().parseFromString(kml, 'text/xml');
  return Array.from(doc.querySelectorAll('Placemark'))
    .map((node) => new XMLSerializer().serializeToString(node))
    .join('');
}

export function buildKmlDocument(layers: MapExportLayer[]): string | null {
  const geoJsonFmt = new GeoJSON();
  const kmlFmt = new KML();
  const folders = layers.map((layer) => {
    const collection = layerCollection(layer);
    if (!collection.features.length) return '';
    const olFeatures = geoJsonFmt.readFeatures(collection, {
      dataProjection: 'EPSG:4326',
      featureProjection: 'EPSG:4326',
    });
    const layerKml = kmlFmt.writeFeatures(olFeatures, { featureProjection: 'EPSG:4326' });
    const placemarks = extractPlacemarks(layerKml);
    if (!placemarks) return '';
    return `<Folder><name>${escapeXml(layer.layerName)}</name>${placemarks}</Folder>`;
  }).filter(Boolean);

  if (!folders.length) return null;

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>EGIP Map Export</name>
    ${folders.join('\n')}
  </Document>
</kml>`;
}

export function exportVisibleLayersToKml(layers: MapExportLayer[]) {
  const kml = buildKmlDocument(layers);
  if (!kml) throw new Error('No visible map features to export.');
  downloadText(kml, `map-export-${timestampForFile()}.kml`, 'application/vnd.google-earth.kml+xml');
}

export function exportVisibleLayersToShapefile(layers: MapExportLayer[]) {
  const zip = createShapefileZip(
    layers.map((layer) => ({
      layerName: layer.layerName,
      collection: layerCollection(layer),
    })),
  );
  if (!zip) throw new Error('No visible map features to export.');
  downloadBlob(zip, `map-export-${timestampForFile()}.zip`);
}

function pagePixels(size: MapPrintSize) {
  const landscape = size === 'A4'
    ? { widthMm: 297, heightMm: 210 }
    : { widthMm: 420, heightMm: 297 };
  return {
    width: Math.round((landscape.widthMm / MM_PER_INCH) * PRINT_DPI),
    height: Math.round((landscape.heightMm / MM_PER_INCH) * PRINT_DPI),
  };
}

async function loadImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load map image for export.'));
    image.src = dataUrl;
  });
}

async function renderMapLayoutCanvas(
  mapImageDataUrl: string,
  options: Omit<MapLayoutOptions, 'pageSize'> & { pageSize: MapPrintSize },
) {
  const page = pagePixels(options.pageSize);
  const canvas = document.createElement('canvas');
  canvas.width = page.width;
  canvas.height = page.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create map export canvas.');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, page.width, page.height);

  const margin = Math.round(page.width * 0.04);
  const headerHeight = Math.round(page.height * 0.12);
  const footerHeight = Math.round(page.height * 0.1);
  const mapTop = margin + headerHeight;
  const mapHeight = page.height - mapTop - footerHeight - margin;
  const mapWidth = page.width - margin * 2;

  ctx.fillStyle = '#0f172a';
  ctx.font = `600 ${Math.round(page.height * 0.035)}px Segoe UI, Arial, sans-serif`;
  ctx.fillText(options.title, margin, margin + Math.round(page.height * 0.04));

  ctx.fillStyle = '#64748b';
  ctx.font = `400 ${Math.round(page.height * 0.022)}px Segoe UI, Arial, sans-serif`;
  ctx.fillText(
    options.subtitle ?? `WGS 84 · ${new Date().toLocaleString()}`,
    margin,
    margin + Math.round(page.height * 0.075),
  );

  const image = await loadImage(mapImageDataUrl);
  const scale = Math.min(mapWidth / image.width, mapHeight / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const drawX = margin + (mapWidth - drawWidth) / 2;
  const drawY = mapTop + (mapHeight - drawHeight) / 2;

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.strokeRect(margin, mapTop, mapWidth, mapHeight);
  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);

  ctx.fillStyle = '#334155';
  ctx.font = `500 ${Math.round(page.height * 0.02)}px Segoe UI, Arial, sans-serif`;
  const legendY = page.height - footerHeight;
  ctx.fillText('Legend:', margin, legendY);

  let legendX = margin + Math.round(page.width * 0.08);
  options.legend.forEach((item) => {
    ctx.fillStyle = item.color ?? '#E53935';
    ctx.fillRect(legendX, legendY - 10, 14, 14);
    ctx.fillStyle = '#334155';
    ctx.fillText(item.name, legendX + 20, legendY);
    legendX += ctx.measureText(item.name).width + 48;
  });

  return canvas;
}

function canvasToJpegBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error('Failed to encode map layout image.'));
        return;
      }
      resolve(new Uint8Array(await blob.arrayBuffer()));
    }, 'image/jpeg', 0.92);
  });
}

export async function exportMapLayoutPng(mapImageDataUrl: string, options: MapLayoutOptions) {
  const canvas = await renderMapLayoutCanvas(mapImageDataUrl, options);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error('Failed to create map PNG export.'));
    }, 'image/png');
  });
  downloadBlob(blob, `map-${options.pageSize.toLowerCase()}-${timestampForFile()}.png`);
}

export async function exportMapLayoutPdf(mapImageDataUrl: string, options: MapLayoutOptions) {
  const canvas = await renderMapLayoutCanvas(mapImageDataUrl, options);
  const jpegBytes = await canvasToJpegBytes(canvas);
  const pdfBlob = jpegToPdfBlob(jpegBytes, canvas.width, canvas.height, options.pageSize);
  downloadBlob(pdfBlob, `map-${options.pageSize.toLowerCase()}-${timestampForFile()}.pdf`);
}

export function buildVisibleExportLayers(
  featureClassLayers: Array<{ id: string; name: string }>,
  layerVisibility: Record<string, boolean>,
  layerFeatures: Record<string, GeoFeature[]>,
): MapExportLayer[] {
  return featureClassLayers
    .filter((layer) => layerVisibility[layer.id])
    .map((layer) => ({
      layerId: layer.id,
      layerName: layer.name,
      features: layerFeatures[layer.id] ?? [],
    }))
    .filter((layer) => layer.features.length > 0);
}
