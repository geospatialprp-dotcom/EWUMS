import qrcodeFactory from './qrcode.js';

type QrCode = {
  addData: (data: string) => void;
  make: () => void;
  getModuleCount: () => number;
  isDark: (row: number, col: number) => boolean;
};

export function renderQrSvg(text: string, size = 220): string {
  const qr = (qrcodeFactory as (typeNumber: number, errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H') => QrCode)(0, 'M');
  qr.addData(text);
  qr.make();

  const count = qr.getModuleCount();
  const cell = size / count;
  const rects: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="QR code">`,
    `<rect width="100%" height="100%" fill="#ffffff"/>`,
  ];

  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (qr.isDark(row, col)) {
        rects.push(
          `<rect x="${(col * cell).toFixed(3)}" y="${(row * cell).toFixed(3)}" width="${cell.toFixed(3)}" height="${cell.toFixed(3)}" fill="#0f172a"/>`,
        );
      }
    }
  }

  rects.push('</svg>');
  return rects.join('');
}

export function renderQrDataUrl(text: string, size = 220): string {
  const svg = renderQrSvg(text, size);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
