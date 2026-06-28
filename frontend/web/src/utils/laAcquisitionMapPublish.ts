import { LA_GIS_VIZ_LEGEND } from '../constants/laGisVisualization';

export type AcquisitionMapPublishMeta = {
  caseNo: string;
  title: string;
  schemeType?: string;
  parcelCount?: number;
  alignmentLengthM?: number;
  rowWidthM?: number;
  segmentCount?: number;
  villageCount?: number;
  villages?: string[];
  startCoord?: string;
  endCoord?: string;
  importSourceName?: string;
  importedSegmentCount?: number;
  appliedAt?: string;
  affectedAuthorities?: string[];
  clearances?: Array<{ label: string; authority?: string; status: string; overlayLayer?: string }>;
};

function esc(v: unknown): string {
  return String(v ?? '—')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function legendSwatch(color: string, variant: 'square' | 'circle' | 'line'): string {
  if (variant === 'line') {
    return `<span class="swatch line" style="background:${color}"></span>`;
  }
  const radius = variant === 'circle' ? '50%' : '2px';
  return `<span class="swatch" style="background:${color};border-radius:${radius}"></span>`;
}

export function buildAcquisitionMapPublishHtml(
  mapImageDataUrl: string | null,
  meta: AcquisitionMapPublishMeta,
): string {
  const generatedAt = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  const mapBlock = mapImageDataUrl
    ? `<img class="map-image" src="${mapImageDataUrl}" alt="Acquisition map" />`
    : '<p class="map-missing"><em>Map snapshot unavailable — use OpenStreetMap basemap and retry publish.</em></p>';

  const pipelineLegend = [
    { label: 'Pipeline Cover (ROW)', color: '#3b82f6', variant: 'square' as const },
    { label: 'Pipeline Centerline', color: '#1e40af', variant: 'line' as const },
    ...(meta.importSourceName
      ? [{ label: 'Imported Network (first)', color: '#ea580c', variant: 'line' as const }]
      : []),
    { label: 'Network Start', color: '#16a34a', variant: 'circle' as const },
    { label: 'Network End', color: '#dc2626', variant: 'circle' as const },
  ];

  const authorityLegend = LA_GIS_VIZ_LEGEND.map(({ label, color }) => ({
    label,
    color,
    variant: 'square' as const,
  }));

  const clearanceRows = (meta.clearances ?? []).map((c) => [
    esc(c.label),
    esc(c.authority),
    esc(c.overlayLayer),
    esc(c.status),
  ]);

  const authorityList = (meta.affectedAuthorities ?? []).filter(Boolean);
  const villageList = (meta.villages ?? []).filter(Boolean);
  const villageSummary = villageList.length
    ? `${villageList.slice(0, 5).join(', ')}${villageList.length > 5 ? '…' : ''}`
    : '';

  const pipelineDetailsRows = [
    ['Total length', meta.alignmentLengthM ? `${Math.round(meta.alignmentLengthM).toLocaleString('en-IN')} m` : '—'],
    ['ROW width', meta.rowWidthM ? `${meta.rowWidthM} m` : '—'],
    ['Segments', meta.segmentCount != null ? String(meta.segmentCount) : '—'],
    ['Start', esc(meta.startCoord)],
    ['End', esc(meta.endCoord)],
    ['Villages crossed', meta.villageCount
      ? `${meta.villageCount}${villageSummary ? ` (${esc(villageSummary)})` : ''}`
      : '—'],
  ];

  const importedDetailsRows = meta.importSourceName
    ? [
        ['Source file', esc(meta.importSourceName)],
        ['Line segments', meta.importedSegmentCount != null ? String(meta.importedSegmentCount) : '—'],
        ['Note', 'Orange overlay = imported first; blue line = applied & saved'],
      ]
    : [];

  const appliedAtLabel = meta.appliedAt
    ? new Date(meta.appliedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : null;

  const appliedDetailsRows = appliedAtLabel
    ? [['Applied on', esc(appliedAtLabel)]]
    : [];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Acquisition Map — ${esc(meta.caseNo)}</title>
  <style>
    @page { margin: 12mm; size: A4 landscape; }
    body { font-family: "Segoe UI", Arial, sans-serif; color: #1e293b; margin: 0; padding: 20px; font-size: 11px; }
    .letterhead { text-align: center; border-bottom: 2px solid #1a3558; padding-bottom: 10px; margin-bottom: 14px; }
    .org { font-size: 16px; font-weight: 700; color: #1a3558; margin: 0; }
    .title { font-size: 18px; font-weight: 700; text-align: center; margin: 12px 0 4px; }
    .subtitle { text-align: center; color: #64748b; margin: 0 0 14px; }
    .meta { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 10px; }
    .meta td { border: 1px solid #cbd5e1; padding: 4px 8px; }
    .meta td:first-child { width: 22%; background: #f8fafc; font-weight: 600; }
    .layout { display: grid; grid-template-columns: 1fr 220px; gap: 14px; align-items: start; }
    .map-wrap { border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; background: #f1f5f9; min-height: 320px; }
    .map-image { display: block; width: 100%; height: auto; }
    .map-missing { padding: 24px; text-align: center; color: #64748b; }
    .legend-panel h3 { font-size: 11px; color: #1a3558; margin: 0 0 6px; }
    .legend-item { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; font-size: 10px; }
    .swatch { display: inline-block; width: 12px; height: 12px; flex-shrink: 0; }
    .swatch.line { width: 16px; height: 3px; border-radius: 2px; }
    .legend-section { margin-bottom: 12px; }
    .data { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 10px; }
    .data th, .data td { border: 1px solid #cbd5e1; padding: 4px 6px; text-align: left; }
    .data th { background: #e8eef5; }
    .details-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; margin-top: 12px; }
    .details-card { border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 10px; background: #f8fafc; }
    .details-card h3 { font-size: 11px; color: #1a3558; margin: 0 0 6px; }
    .details-row { display: flex; justify-content: space-between; gap: 8px; font-size: 10px; margin-bottom: 3px; }
    .details-row span:first-child { color: #64748b; }
    .details-row span:last-child { font-weight: 600; text-align: right; }
    .authority-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
    .authority-tag { font-size: 9px; padding: 2px 6px; border-radius: 999px; border: 1px solid #cbd5e1; background: #fff; }
    .footer { margin-top: 14px; font-size: 9px; color: #94a3b8; text-align: right; }
    @media print { body { padding: 0; } .layout { grid-template-columns: 1fr 200px; } }
  </style>
</head>
<body>
  <header class="letterhead">
    <p class="org">Uttarakhand Peyjal Nigam / EGIP Platform</p>
  </header>
  <h1 class="title">Published Acquisition Map</h1>
  <p class="subtitle">${esc(meta.title)} · ${esc(meta.caseNo)}</p>
  <table class="meta">
    <tr><td>Scheme Type</td><td>${esc(meta.schemeType)}</td></tr>
    <tr><td>Affected Parcels</td><td>${meta.parcelCount ?? 0}</td></tr>
    <tr><td>Alignment Length</td><td>${meta.alignmentLengthM ? `${Math.round(meta.alignmentLengthM).toLocaleString('en-IN')} m` : 'See centerline'}</td></tr>
    <tr><td>ROW Width</td><td>${meta.rowWidthM ? `${meta.rowWidthM} m` : '—'}</td></tr>
    <tr><td>Pipeline Segments</td><td>${meta.segmentCount ?? '—'}</td></tr>
    <tr><td>Villages Crossed</td><td>${meta.villageCount ?? villageList.length ?? 0}${villageList.length ? ` (${esc(villageList.slice(0, 5).join(', '))}${villageList.length > 5 ? '…' : ''})` : ''}</td></tr>
    <tr><td>Network Start</td><td>${esc(meta.startCoord)}</td></tr>
    <tr><td>Network End</td><td>${esc(meta.endCoord)}</td></tr>
    ${meta.importSourceName ? `<tr><td>Imported Network (first)</td><td>${esc(meta.importSourceName)}${meta.importedSegmentCount ? ` · ${meta.importedSegmentCount} segment(s)` : ''}</td></tr>` : ''}
    ${meta.appliedAt ? `<tr><td>Applied Alignment</td><td>Saved ${esc(appliedAtLabel ?? meta.appliedAt)}</td></tr>` : ''}
    <tr><td>Clearances Detected</td><td>${meta.clearances?.length ?? 0}</td></tr>
    ${authorityList.length ? `<tr><td>Affected Authorities</td><td>${esc(authorityList.join(' · '))}</td></tr>` : ''}
  </table>
  <div class="layout">
    <div class="map-wrap">${mapBlock}</div>
    <aside class="legend-panel">
      <div class="legend-section">
        <h3>Pipeline Network</h3>
        ${pipelineLegend.map(({ label, color, variant }) =>
          `<div class="legend-item">${legendSwatch(color, variant)}<span>${esc(label)}</span></div>`,
        ).join('')}
      </div>
      <div class="legend-section">
        <h3>Authority / Land Layers</h3>
        ${authorityLegend.map(({ label, color, variant }) =>
          `<div class="legend-item">${legendSwatch(color, variant)}<span>${esc(label)}</span></div>`,
        ).join('')}
      </div>
    </aside>
  </div>
  <div class="details-grid">
    <section class="details-card">
      <h3>Pipeline Details</h3>
      ${pipelineDetailsRows.map(([label, value]) =>
        `<div class="details-row"><span>${esc(label)}</span><span>${value}</span></div>`,
      ).join('')}
    </section>
    ${importedDetailsRows.length ? `
    <section class="details-card">
      <h3>Imported Network (first)</h3>
      ${importedDetailsRows.map(([label, value]) =>
        `<div class="details-row"><span>${esc(label)}</span><span>${value}</span></div>`,
      ).join('')}
    </section>` : ''}
    ${appliedDetailsRows.length ? `
    <section class="details-card">
      <h3>Applied Pipeline</h3>
      ${appliedDetailsRows.map(([label, value]) =>
        `<div class="details-row"><span>${esc(label)}</span><span>${value}</span></div>`,
      ).join('')}
    </section>` : ''}
    ${authorityList.length ? `
    <section class="details-card">
      <h3>Affected Authorities</h3>
      <div class="authority-tags">${authorityList.map((a) => `<span class="authority-tag">${esc(a)}</span>`).join('')}</div>
    </section>` : ''}
  </div>
  ${clearanceRows.length ? `
    <h3 style="font-size:12px;color:#1a3558;margin:14px 0 6px">Detected Statutory Clearances</h3>
    <table class="data">
      <thead><tr><th>Clearance</th><th>Authority</th><th>GIS Layer</th><th>Status</th></tr></thead>
      <tbody>${clearanceRows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>` : ''}
  <div class="footer">Published ${esc(generatedAt)} · EGIP Land Acquisition · Full pipeline network, ROW cover, imported overlay, and authority labels captured at publish</div>
</body>
</html>`;
}
