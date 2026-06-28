import * as fs from 'fs';
import * as path from 'path';

const ALLOWED_EXTENSIONS = new Set(['.tif', '.tiff', '.geotiff']);

export function isAllowedOrthomosaicFileName(originalName: string): boolean {
  const ext = path.extname(originalName || '').toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext);
}

export function sanitizeOrthomosaicFileName(originalName: string): string {
  const base = path.basename(originalName || 'orthomosaic.tif');
  const ext = path.extname(base).toLowerCase();
  const stem = path.basename(base, ext).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'orthomosaic';
  const safeExt = ALLOWED_EXTENSIONS.has(ext) ? ext : '.tif';
  return `${stem}${safeExt}`;
}

export function uniqueOrthomosaicFileName(originalName: string): string {
  const safe = sanitizeOrthomosaicFileName(originalName);
  const ext = path.extname(safe);
  const stem = path.basename(safe, ext);
  return `${stem}-${Date.now()}${ext}`;
}

export function orthomosaicUploadDir(projectId: string): string {
  return path.join(process.cwd(), 'uploads', 'orthomosaic', projectId);
}

export function orthomosaicFileAbsolutePath(projectId: string, fileName: string): string {
  return path.join(orthomosaicUploadDir(projectId), path.basename(fileName));
}

export function orthomosaicFileApiUrl(projectId: string): string {
  return `/api/v1/projects/${projectId}/orthomosaic/file`;
}

export function orthomosaicMimeType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === '.tif' || ext === '.tiff' || ext === '.geotiff') return 'image/tiff';
  return 'application/octet-stream';
}

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function fileExists(absolutePath: string): boolean {
  try {
    return fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile();
  } catch {
    return false;
  }
}

export function removeOrthomosaicFile(projectId: string, fileName: string): void {
  const absolutePath = orthomosaicFileAbsolutePath(projectId, fileName);
  if (fileExists(absolutePath)) {
    fs.unlinkSync(absolutePath);
  }
}
