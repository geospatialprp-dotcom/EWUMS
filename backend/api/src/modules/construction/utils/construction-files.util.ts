import * as fs from 'fs';
import * as path from 'path';

export function sanitizeUploadFileName(originalName: string): string {
  const base = path.basename(originalName || 'file');
  const ext = path.extname(base);
  const stem = path.basename(base, ext).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'file';
  return `${stem}${ext.toLowerCase()}`;
}

export function uniqueUploadFileName(originalName: string): string {
  const safe = sanitizeUploadFileName(originalName);
  const ext = path.extname(safe);
  const stem = path.basename(safe, ext);
  return `${stem}-${Date.now()}${ext}`;
}

export function constructionUploadDir(
  resourceType: string,
  resourceId: string,
): string {
  return path.join(process.cwd(), 'uploads', 'construction', resourceType, resourceId);
}

export function constructionUploadRelativeUrl(
  resourceType: string,
  resourceId: string,
  fileName: string,
): string {
  return `/uploads/construction/${resourceType}/${resourceId}/${fileName}`;
}

export function resolveConstructionFilePath(fileUrl: string): string {
  const normalized = fileUrl.replace(/^\/+/, '');
  return path.join(process.cwd(), normalized);
}

export function guessMimeType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  const map: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.pdf': 'application/pdf',
  };
  return map[ext] ?? 'application/octet-stream';
}

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function writeUploadFile(dir: string, fileName: string, buffer: Buffer): string {
  ensureDir(dir);
  const absolutePath = path.join(dir, fileName);
  fs.writeFileSync(absolutePath, buffer);
  return absolutePath;
}

export function fileExists(absolutePath: string): boolean {
  try {
    return fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile();
  } catch {
    return false;
  }
}
