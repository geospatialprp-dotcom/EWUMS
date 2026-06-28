import * as path from 'path';
import {
  ensureDir,
  fileExists,
  guessMimeType,
  uniqueUploadFileName,
  writeUploadFile,
} from '../../construction/utils/construction-files.util';

export function dprProposalUploadDir(proposalId: string): string {
  return path.join(process.cwd(), 'uploads', 'dpr-planning', proposalId);
}

export function dprProposalUploadRelativeUrl(proposalId: string, fileName: string): string {
  return `/uploads/dpr-planning/${proposalId}/${fileName}`;
}

export function saveDprProposalFile(
  proposalId: string,
  file: { buffer: Buffer; originalname?: string },
): { fileName: string; fileUrl: string } {
  const fileName = uniqueUploadFileName(file.originalname ?? 'document.pdf');
  const dir = dprProposalUploadDir(proposalId);
  writeUploadFile(dir, fileName, file.buffer);
  return {
    fileName: file.originalname ?? fileName,
    fileUrl: dprProposalUploadRelativeUrl(proposalId, fileName),
  };
}

export function resolveDprProposalFilePath(fileUrl: string): string {
  const normalized = fileUrl.replace(/^\/+/, '');
  return path.join(process.cwd(), normalized);
}

export { fileExists, guessMimeType, ensureDir };
