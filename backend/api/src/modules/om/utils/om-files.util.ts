import * as path from 'path';
import {
  ensureDir,
  fileExists,
  guessMimeType,
  uniqueUploadFileName,
  writeUploadFile,
} from '../../construction/utils/construction-files.util';

export function omHandoverUploadDir(handoverId: string): string {
  return path.join(process.cwd(), 'uploads', 'om', 'handover', handoverId);
}

export function omHandoverUploadRelativeUrl(handoverId: string, fileName: string): string {
  return `/uploads/om/handover/${handoverId}/${fileName}`;
}

export function omMobileBillingUploadDir(tenantId: string): string {
  return path.join(process.cwd(), 'uploads', 'om', 'mobile-billing', tenantId);
}

export function omMobileBillingUploadRelativeUrl(tenantId: string, fileName: string): string {
  return `/uploads/om/mobile-billing/${tenantId}/${fileName}`;
}

export function saveOmMobileBillingPhoto(
  tenantId: string,
  file: { buffer: Buffer; originalname?: string },
): { fileName: string; fileUrl: string } {
  const fileName = uniqueUploadFileName(file.originalname ?? 'meter-photo.jpg');
  const dir = omMobileBillingUploadDir(tenantId);
  writeUploadFile(dir, fileName, file.buffer);
  return {
    fileName: file.originalname ?? fileName,
    fileUrl: omMobileBillingUploadRelativeUrl(tenantId, fileName),
  };
}

export function resolveOmHandoverFilePath(fileUrl: string): string {
  const normalized = fileUrl.replace(/^\/+/, '');
  return path.join(process.cwd(), normalized);
}

export function saveOmHandoverFile(
  handoverId: string,
  file: { buffer: Buffer; originalname?: string },
): { fileName: string; fileUrl: string } {
  const fileName = uniqueUploadFileName(file.originalname ?? 'document.pdf');
  const dir = omHandoverUploadDir(handoverId);
  writeUploadFile(dir, fileName, file.buffer);
  return {
    fileName: file.originalname ?? fileName,
    fileUrl: omHandoverUploadRelativeUrl(handoverId, fileName),
  };
}

export { fileExists, guessMimeType, ensureDir };
