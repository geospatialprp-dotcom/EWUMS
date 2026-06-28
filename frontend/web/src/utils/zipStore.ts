type ZipEntry = { path: string; data: Uint8Array };

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc ^= bytes[i];
    for (let j = 0; j < 8; j += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}

function u32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value, true);
}

export function createZipArchive(entries: ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  entries.forEach((entry) => {
    const nameBytes = encoder.encode(entry.path);
    const data = entry.data;
    const local = new Uint8Array(30 + nameBytes.length + data.length);
    const view = new DataView(local.buffer);
    u32(view, 0, 0x04034b50);
    u16(view, 4, 20);
    u16(view, 26, nameBytes.length);
    u32(view, 30 + nameBytes.length, crc32(data));
    u32(view, 18, data.length);
    u32(view, 22, data.length);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    localParts.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const cview = new DataView(central.buffer);
    u32(cview, 0, 0x02014b50);
    u16(cview, 4, 20);
    u16(cview, 6, 20);
    u16(cview, 28, nameBytes.length);
    u32(cview, 16, crc32(data));
    u32(cview, 20, data.length);
    u32(cview, 24, data.length);
    u32(cview, 42, offset);
    central.set(nameBytes, 46);
    centralParts.push(central);

    offset += local.length;
  });

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const centralOffset = offset;
  const end = new Uint8Array(22);
  const eview = new DataView(end.buffer);
  u32(eview, 0, 0x06054b50);
  u16(eview, 8, entries.length);
  u16(eview, 10, entries.length);
  u32(eview, 12, centralSize);
  u32(eview, 16, centralOffset);

  const total = offset + centralSize + end.length;
  const out = new Uint8Array(total);
  let cursor = 0;
  localParts.forEach((part) => { out.set(part, cursor); cursor += part.length; });
  centralParts.forEach((part) => { out.set(part, cursor); cursor += part.length; });
  out.set(end, cursor);
  return out;
}
