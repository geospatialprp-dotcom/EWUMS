export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadText(content: string, filename: string, mimeType: string) {
  downloadBlob(new Blob([content], { type: mimeType }), filename);
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const anchor = document.createElement('a');
  anchor.href = dataUrl;
  anchor.download = filename;
  anchor.click();
}

export function sanitizeExportFileName(name: string) {
  return name.replace(/[<>:"/\\|?*]+/g, '_').replace(/\s+/g, '_').slice(0, 64) || 'layer';
}

export function timestampForFile() {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
}
