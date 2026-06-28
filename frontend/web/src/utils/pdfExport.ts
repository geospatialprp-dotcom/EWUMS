/** Minimal single-page PDF with one embedded JPEG (no external dependencies). */

function pageSizePoints(size: 'A4' | 'A3') {
  return size === 'A4'
    ? { width: 841.89, height: 595.28 }
    : { width: 1190.55, height: 841.89 };
}

export function jpegToPdfBlob(
  jpegBytes: Uint8Array,
  imageWidth: number,
  imageHeight: number,
  pageSize: 'A4' | 'A3',
): Blob {
  const page = pageSizePoints(pageSize);
  const encoder = new TextEncoder();

  const chunks: Uint8Array[] = [];
  const objectOffsets: number[] = [];
  let length = 0;

  const appendText = (text: string) => {
    const bytes = encoder.encode(text);
    chunks.push(bytes);
    length += bytes.length;
  };

  const appendBytes = (bytes: Uint8Array) => {
    chunks.push(bytes);
    length += bytes.length;
  };

  const startObject = (id: number, bodyStart: string) => {
    objectOffsets[id] = length;
    appendText(`${id} 0 obj\n${bodyStart}`);
  };

  const endObject = () => {
    appendText('\nendobj\n');
  };

  appendText('%PDF-1.4\n');

  startObject(1, '<< /Type /Catalog /Pages 2 0 R >>');
  endObject();

  startObject(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  endObject();

  startObject(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width} ${page.height}] /Contents 4 0 R /Resources << /XObject << /Im1 5 0 R >> >> >>`);
  endObject();

  const contentStream = `q\n${page.width} 0 0 ${page.height} 0 0 cm\n/Im1 Do\nQ\n`;
  startObject(4, `<< /Length ${contentStream.length} >>\nstream\n${contentStream}`);
  appendText('endstream');
  endObject();

  startObject(5, `<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`);
  appendBytes(jpegBytes);
  appendText('\nendstream');
  endObject();

  const xrefOffset = length;
  appendText(`xref\n0 6\n0000000000 65535 f \n`);
  for (let id = 1; id <= 5; id += 1) {
    const off = objectOffsets[id] ?? 0;
    appendText(`${String(off).padStart(10, '0')} 00000 n \n`);
  }

  appendText(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  const total = chunks.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let cursor = 0;
  chunks.forEach((part) => {
    out.set(part, cursor);
    cursor += part.length;
  });

  return new Blob([out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength)], {
    type: 'application/pdf',
  });
}
