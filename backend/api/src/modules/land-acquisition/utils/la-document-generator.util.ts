import { LA_AUTO_DOCUMENTS, type LaDocumentDef } from '../constants/la-documents.constants';

export type LaDocumentParcel = {
  id: string;
  village?: string | null;
  tehsil?: string | null;
  district?: string | null;
  khasraNo?: string | null;
  khataNo?: string | null;
  landUse?: string | null;
  landClass?: string | null;
  affectedAreaSqm?: number;
  totalAreaSqm?: number;
  ownershipType?: string | null;
  ownershipClassification?: string | null;
  department?: string | null;
  ownerName?: string | null;
  acquisitionMode?: string | null;
  mutationStatus?: string | null;
  circleRatePerSqm?: number;
  status?: string | null;
  owners?: Array<{ ownerName: string; sharePct: number }>;
};

export type LaDocumentContext = {
  caseNo: string;
  title: string;
  schemeType: string;
  status: string;
  statusLabel: string;
  totalParcels: number;
  totalAreaSqm: number;
  totalCompensationEst: number;
  clearanceStatus: string;
  possessionStatus: string;
  generatedAt: string;
  parcels: LaDocumentParcel[];
  clearances: Array<{ clearanceType: string; label: string; authority?: string; status: string }>;
  compensations: Array<{
    laParcelId: string;
    circleRatePerSqm: number;
    marketRatePerSqm: number;
    affectedAreaSqm: number;
    landCompensation: number;
    solatiumAmount: number;
    additionalCompensation: number;
    treeCompensation: number;
    cropCompensation: number;
    structureCompensation: number;
    totalCompensation: number;
    interestAmount: number;
    rehabilitationCost: number;
    totalAcquisitionCost: number;
  }>;
  alignmentLengthM?: number;
};

function esc(v: unknown): string {
  return String(v ?? '—')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inr(n: number): string {
  return `₹ ${Math.round(n).toLocaleString('en-IN')}`;
}

function table(headers: string[], rows: string[][]): string {
  if (!rows.length) return '<p><em>No records.</em></p>';
  return `<table class="data">
    <thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>`;
}

function letterBody(salutation: string, paragraphs: string[], closing: string): string {
  return `
    <p class="salutation">${esc(salutation)}</p>
    ${paragraphs.map((p) => `<p class="para">${esc(p)}</p>`).join('')}
    <p class="closing">${esc(closing)}</p>
    <p class="signature">_________________________<br/>Authorised Signatory<br/>EGIP Land Acquisition Module</p>`;
}

export function renderLaDocumentShell(title: string, subtitle: string, bodyHtml: string, generatedAt: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(title)}</title>
  <style>
    @page { margin: 14mm; }
    body { font-family: "Segoe UI", Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 24px; font-size: 12px; line-height: 1.5; }
    .letterhead { text-align: center; border-bottom: 2px solid #1a3558; padding-bottom: 12px; margin-bottom: 16px; }
    .org-en { font-size: 17px; font-weight: 700; color: #1a3558; margin: 0; }
    .org-hi { font-size: 14px; font-weight: 700; color: #0369a1; margin: 4px 0 0; }
    .doc-title { font-size: 18px; font-weight: 700; text-align: center; margin: 0 0 4px; }
    .doc-subtitle { text-align: center; color: #475569; margin: 0 0 16px; font-size: 13px; }
    .meta { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11px; }
    .meta td { border: 1px solid #cbd5e1; padding: 5px 8px; }
    .meta td:first-child { width: 28%; background: #f8fafc; font-weight: 600; }
    .data { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 11px; }
    .data th, .data td { border: 1px solid #cbd5e1; padding: 5px 7px; text-align: left; }
    .data th { background: #e8eef5; font-weight: 600; }
    .salutation { margin-top: 16px; font-weight: 600; }
    .para { text-align: justify; margin: 10px 0; }
    .closing { margin-top: 20px; }
    .signature { margin-top: 32px; font-size: 11px; }
    .footer { margin-top: 24px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #64748b; text-align: right; }
    h3 { font-size: 13px; color: #1a3558; margin: 16px 0 8px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <header class="letterhead">
    <p class="org-en">Uttarakhand Peyjal Nigam / EGIP Platform</p>
    <p class="org-hi">भूमि अधिग्रहण प्रबंधन प्रणाली</p>
  </header>
  <h1 class="doc-title">${esc(title)}</h1>
  <p class="doc-subtitle">${esc(subtitle)}</p>
  ${bodyHtml}
  <div class="footer">Auto-generated: ${esc(generatedAt)} · EGIP Land Acquisition</div>
</body>
</html>`;
}

function caseMeta(ctx: LaDocumentContext): string {
  return `<table class="meta">
    <tr><td>Case No.</td><td>${esc(ctx.caseNo)}</td></tr>
    <tr><td>Scheme</td><td>${esc(ctx.title)} (${esc(ctx.schemeType)})</td></tr>
    <tr><td>Status</td><td>${esc(ctx.statusLabel)}</td></tr>
    <tr><td>Total Parcels</td><td>${ctx.totalParcels}</td></tr>
    <tr><td>Affected Area</td><td>${ctx.totalAreaSqm.toLocaleString('en-IN')} m²</td></tr>
    <tr><td>Est. Compensation</td><td>${inr(ctx.totalCompensationEst)}</td></tr>
  </table>`;
}

function parcelRows(ctx: LaDocumentContext) {
  return ctx.parcels.map((p, i) => [
    String(i + 1),
    esc(p.khasraNo),
    esc(p.village),
    esc(p.tehsil),
    esc(p.district),
    esc(p.landUse),
    esc(p.ownershipClassification ?? p.ownershipType),
    esc(p.department),
    String(Number(p.affectedAreaSqm ?? 0).toFixed(2)),
    esc(p.acquisitionMode),
  ]);
}

function ownerRows(ctx: LaDocumentContext) {
  const rows: string[][] = [];
  let sn = 1;
  for (const p of ctx.parcels) {
    const owners = p.owners?.length ? p.owners : [{ ownerName: p.ownerName ?? '—', sharePct: 100 }];
    for (const o of owners) {
      rows.push([
        String(sn++),
        esc(p.khasraNo),
        esc(p.village),
        esc(o.ownerName),
        `${o.sharePct}%`,
        esc(p.mutationStatus),
        esc(p.status),
      ]);
    }
  }
  return rows;
}

function compensationRows(ctx: LaDocumentContext) {
  const parcelMap = new Map(ctx.parcels.map((p) => [p.id, p]));
  return ctx.compensations.map((c, i) => {
    const p = parcelMap.get(c.laParcelId);
    return [
      String(i + 1),
      esc(p?.khasraNo),
      esc(p?.village),
      String(c.affectedAreaSqm),
      inr(c.landCompensation),
      inr(c.solatiumAmount),
      inr(c.additionalCompensation),
      inr(c.treeCompensation + c.cropCompensation),
      inr(c.structureCompensation),
      inr(c.totalCompensation),
      inr(c.totalAcquisitionCost),
    ];
  });
}

function villageSummary(ctx: LaDocumentContext) {
  const map = new Map<string, { parcels: number; area: number; owners: number }>();
  for (const p of ctx.parcels) {
    const v = p.village || 'Unknown';
    const e = map.get(v) ?? { parcels: 0, area: 0, owners: 0 };
    e.parcels += 1;
    e.area += Number(p.affectedAreaSqm ?? 0);
    e.owners += p.owners?.length || 1;
    map.set(v, e);
  }
  return [...map.entries()].map(([v, s], i) => [
    String(i + 1),
    esc(v),
    String(s.parcels),
    s.area.toFixed(2),
    String(s.owners),
  ]);
}

function departmentSummary(ctx: LaDocumentContext) {
  const map = new Map<string, { parcels: number; area: number }>();
  for (const p of ctx.parcels) {
    const d = p.department || p.ownershipClassification || 'Private / Revenue';
    const e = map.get(d) ?? { parcels: 0, area: 0 };
    e.parcels += 1;
    e.area += Number(p.affectedAreaSqm ?? 0);
    map.set(d, e);
  }
  return [...map.entries()].map(([d, s], i) => [
    String(i + 1),
    esc(d),
    String(s.parcels),
    s.area.toFixed(2),
  ]);
}

const GENERATORS: Record<string, (ctx: LaDocumentContext) => string> = {
  la_proposal: (ctx) => {
    const body = `${caseMeta(ctx)}
      <h3>Executive Summary</h3>
      ${letterBody(
        'To Whom It May Concern,',
        [
          `This Land Acquisition Proposal is submitted for scheme "${ctx.title}" (${ctx.caseNo}) under the Right to Fair Compensation and Transparency in Land Acquisition, Rehabilitation and Resettlement Act, 2013.`,
          `The pipeline alignment affects ${ctx.totalParcels} parcel(s) covering ${ctx.totalAreaSqm.toLocaleString('en-IN')} m². Estimated total acquisition cost is ${inr(ctx.totalCompensationEst)}.`,
          `${ctx.clearances.length} statutory clearance(s) have been identified. Clearance status: ${ctx.clearanceStatus}.`,
          'Detailed land schedule, owner list, compensation register, and village-wise summary are annexed as auto-generated documents from the EGIP GIS platform.',
        ],
        'Submitted for approval and further action.',
      )}
      <h3>Annexure — Land Schedule (abridged)</h3>
      ${table(['S.No.', 'Khasra', 'Village', 'Tehsil', 'District', 'Land Use', 'Ownership', 'Department', 'Area m²', 'Mode'], parcelRows(ctx).slice(0, 50))}`;
    return renderLaDocumentShell('Land Acquisition Proposal', ctx.caseNo, body, ctx.generatedAt);
  },

  dm_letter: (ctx) => {
    const body = `${caseMeta(ctx)}
      ${letterBody(
        'The District Magistrate,\nDistrict Administration',
        [
          `Sub: Request for land acquisition proceedings — ${ctx.title} (${ctx.caseNo}).`,
          `We request your office to initiate revenue proceedings for acquisition/easement of ${ctx.totalParcels} parcel(s) (${ctx.totalAreaSqm.toLocaleString('en-IN')} m²) for the above water supply infrastructure scheme.`,
          `Affected villages and khasra details are enclosed in the Land Schedule. Estimated compensation liability: ${inr(ctx.totalCompensationEst)}.`,
          'Kindly direct the Sub-Divisional Magistrate and Tehsildar for survey verification and notification as per RFCTLARR Act.',
        ],
        'Respectfully submitted.',
      )}`;
    return renderLaDocumentShell('Letter to District Magistrate', ctx.caseNo, body, ctx.generatedAt);
  },

  revenue_letter: (ctx) => {
    const body = `${caseMeta(ctx)}
      ${letterBody(
        'The District Revenue Officer / Collectorate',
        [
          `Sub: Revenue clearance and land records verification — ${ctx.caseNo}.`,
          `Pipeline ROW affects ${ctx.totalParcels} revenue parcels. Request verification of khata/khasra, mutation status, and circle rates.`,
          'Enclosed: Land Register, Mutation Status Report, and Affected Owner List generated from GIS cadastral intersection.',
        ],
        'For necessary action.',
      )}`;
    return renderLaDocumentShell('Revenue Department Letter', ctx.caseNo, body, ctx.generatedAt);
  },

  forest_proposal: (ctx) => {
    const forest = ctx.clearances.filter((c) => /forest/i.test(c.clearanceType));
    const body = `${caseMeta(ctx)}
      ${letterBody(
        'The Divisional Forest Officer / Nodal Officer, MoEF&CC (PARIVESH)',
        [
          `Sub: Forest Clearance (FCA) proposal — ${ctx.title}.`,
          `Forest land / reserved forest intersection detected. ${forest.length} forest-related clearance item(s) on record.`,
          'Request diversion proposal under Forest (Conservation) Act with compensatory afforestation plan and KML alignment.',
        ],
        'Submitted for forest clearance.',
      )}
      <h3>Forest-affected parcels</h3>
      ${table(['Khasra', 'Village', 'Land Use', 'Area m²'], ctx.parcels.filter((p) => /forest/i.test(`${p.landUse} ${p.landClass} ${p.ownershipClassification}`)).map((p) => [esc(p.khasraNo), esc(p.village), esc(p.landUse), String(p.affectedAreaSqm ?? 0)]))}`;
    return renderLaDocumentShell('Forest Clearance Proposal', ctx.caseNo, body, ctx.generatedAt);
  },

  pwd_noc_request: (ctx) => {
    const body = `${caseMeta(ctx)}
      ${letterBody(
        'The Executive Engineer, PWD (Roads)',
        [
          `Sub: NOC for utility crossing of PWD road — ${ctx.caseNo}.`,
          'Request permission to lay water supply pipeline across PWD road corridor with trenching/restoration plan.',
          'Crossing location coordinates and ROW width are available in the Acquisition Map annexure.',
        ],
        'For NOC and technical approval.',
      )}`;
    return renderLaDocumentShell('PWD NOC Request', ctx.caseNo, body, ctx.generatedAt);
  },

  railway_crossing_proposal: (ctx) => {
    const body = `${caseMeta(ctx)}
      ${letterBody(
        'The Divisional Railway Manager / Engineering Department',
        [
          `Sub: Railway crossing proposal — ${ctx.caseNo}.`,
          'Request approval for pipeline crossing of railway alignment per G&SR provisions.',
          'Proposed method: HDD / pipe jacking as per EGIP route recommendation. Safety plan enclosed.',
        ],
        'For railway crossing sanction.',
      )}`;
    return renderLaDocumentShell('Railway Crossing Proposal', ctx.caseNo, body, ctx.generatedAt);
  },

  gram_sabha_resolution: (ctx) => {
    const gpParcels = ctx.parcels.filter((p) => /gram|panchayat/i.test(`${p.ownershipClassification} ${p.landUse} ${p.village}`));
    const body = `${caseMeta(ctx)}
      <h3>Gram Sabha Resolution Format</h3>
      <p class="para">Resolved that the Gram Sabha of _______________ village, tehsil _______________, district _______________, in its meeting dated _______________, hereby grants consent for laying of water supply pipeline / acquisition of land/easement rights for ${ctx.title} (${ctx.caseNo}).</p>
      <p class="para">Total ${gpParcels.length || ctx.totalParcels} parcel(s) in the jurisdiction are affected. The Sabha authorises the Pradhan to sign necessary documents and cooperate with the department.</p>
      <h3>Affected Gram Sabha / Panchayat parcels</h3>
      ${table(['Khasra', 'Village', 'Owner', 'Area m²'], (gpParcels.length ? gpParcels : ctx.parcels).map((p) => [esc(p.khasraNo), esc(p.village), esc(p.ownerName), String(p.affectedAreaSqm ?? 0)]))}
      <p class="signature">Pradhan, Gram Panchayat _______________<br/>Date: _______________</p>`;
    return renderLaDocumentShell('Gram Sabha Resolution', ctx.caseNo, body, ctx.generatedAt);
  },

  land_schedule: (ctx) => {
    const body = `${caseMeta(ctx)}
      <h3>Schedule of Lands</h3>
      ${table(['S.No.', 'Khasra', 'Village', 'Tehsil', 'District', 'Land Use', 'Ownership', 'Department', 'Area m²', 'Acquisition Mode'], parcelRows(ctx))}`;
    return renderLaDocumentShell('Land Schedule', ctx.caseNo, body, ctx.generatedAt);
  },

  affected_owner_list: (ctx) => {
    const body = `${caseMeta(ctx)}
      <h3>List of Affected Owners / Pattadars</h3>
      ${table(['S.No.', 'Khasra', 'Village', 'Owner Name', 'Share', 'Mutation', 'Parcel Status'], ownerRows(ctx))}`;
    return renderLaDocumentShell('Affected Owner List', ctx.caseNo, body, ctx.generatedAt);
  },

  compensation_register: (ctx) => {
    const body = `${caseMeta(ctx)}
      <h3>Compensation Register (RFCTLARR Act 2013)</h3>
      ${table(['S.No.', 'Khasra', 'Village', 'Area m²', 'Land Comp.', 'Solatium', 'Additional', 'Trees/Crops', 'Structure', 'Total Comp.', 'Total Acq. Cost'], compensationRows(ctx))}
      <p><strong>Case Total Acquisition Cost: ${inr(ctx.totalCompensationEst)}</strong></p>`;
    return renderLaDocumentShell('Compensation Register', ctx.caseNo, body, ctx.generatedAt);
  },

  parcel_map: (ctx) => {
    const body = `${caseMeta(ctx)}
      <h3>Parcel Map Index</h3>
      <p class="para">GIS parcel map is maintained in the EGIP Map Explorer for case ${esc(ctx.caseNo)}. Export GeoJSON from the Acquisition Map tab or use the attached coordinate list below.</p>
      ${table(['Khasra', 'Village', 'Affected Area m²', 'Ownership'], ctx.parcels.map((p) => [esc(p.khasraNo), esc(p.village), String(p.affectedAreaSqm ?? 0), esc(p.ownershipClassification)]))}`;
    return renderLaDocumentShell('Parcel Map', ctx.caseNo, body, ctx.generatedAt);
  },

  acquisition_map: (ctx) => {
    const body = `${caseMeta(ctx)}
      <h3>Acquisition Map — Alignment & ROW</h3>
      <p class="para">Pipeline alignment length: ${ctx.alignmentLengthM ? `${ctx.alignmentLengthM.toFixed(0)} m` : 'See GIS alignment layer'}. Corridor buffer (pipeline cover), centerline, and start/end circle markers are shown on the EGIP Acquisition Map tab. Use <strong>Publish Acquisition Map</strong> for a printable map with legend and detected clearances.</p>
      <h3>Parcels intersecting acquisition corridor</h3>
      ${table(['Khasra', 'Village', 'Area m²', 'Mode'], ctx.parcels.map((p) => [esc(p.khasraNo), esc(p.village), String(p.affectedAreaSqm ?? 0), esc(p.acquisitionMode)]))}`;
    return renderLaDocumentShell('Acquisition Map', ctx.caseNo, body, ctx.generatedAt);
  },

  village_wise_summary: (ctx) => {
    const body = `${caseMeta(ctx)}
      <h3>Village-wise Summary</h3>
      ${table(['S.No.', 'Village', 'Parcels', 'Total Area m²', 'Owners'], villageSummary(ctx))}`;
    return renderLaDocumentShell('Village Wise Summary', ctx.caseNo, body, ctx.generatedAt);
  },

  department_wise_summary: (ctx) => {
    const body = `${caseMeta(ctx)}
      <h3>Department / Tenure-wise Summary</h3>
      ${table(['S.No.', 'Department / Tenure', 'Parcels', 'Area m²'], departmentSummary(ctx))}`;
    return renderLaDocumentShell('Department Wise Summary', ctx.caseNo, body, ctx.generatedAt);
  },

  land_register: (ctx) => {
    const body = `${caseMeta(ctx)}
      <h3>Land Register</h3>
      ${table(['S.No.', 'Khasra', 'Khata', 'Village', 'Tehsil', 'District', 'Land Class', 'Total m²', 'Affected m²', 'Circle Rate'], ctx.parcels.map((p, i) => [
        String(i + 1), esc(p.khasraNo), esc(p.khataNo), esc(p.village), esc(p.tehsil), esc(p.district),
        esc(p.landClass ?? p.landUse), String(p.totalAreaSqm ?? '—'), String(p.affectedAreaSqm ?? 0),
        inr(Number(p.circleRatePerSqm ?? 0)),
      ]))}`;
    return renderLaDocumentShell('Land Register', ctx.caseNo, body, ctx.generatedAt);
  },

  award_register: (ctx) => {
    const body = `${caseMeta(ctx)}
      <h3>Award Register</h3>
      <p class="para">Draft award amounts computed per RFCTLARR Act. Final award subject to Collector approval.</p>
      ${table(['Khasra', 'Village', 'Land Award', 'Solatium', 'Total Comp.', 'Total Acq.'], compensationRows(ctx).map((r) => [r[1], r[2], r[4], r[5], r[9], r[10]]))}`;
    return renderLaDocumentShell('Award Register', ctx.caseNo, body, ctx.generatedAt);
  },

  possession_certificate: (ctx) => {
    const possessed = ctx.parcels.filter((p) => p.status === 'possession');
    const body = `${caseMeta(ctx)}
      <h3>Possession Certificate (Draft)</h3>
      <p class="para">Certified that possession of land described below has been / shall be taken for ${esc(ctx.title)} upon payment of compensation as per award register.</p>
      ${table(['Khasra', 'Village', 'Area m²', 'Status'], (possessed.length ? possessed : ctx.parcels).map((p) => [esc(p.khasraNo), esc(p.village), String(p.affectedAreaSqm ?? 0), esc(p.status)]))}
      <p class="signature">Land Acquisition Officer<br/>Date: _______________</p>`;
    return renderLaDocumentShell('Possession Certificate', ctx.caseNo, body, ctx.generatedAt);
  },

  mutation_status: (ctx) => {
    const body = `${caseMeta(ctx)}
      <h3>Mutation / Intkal Status</h3>
      ${table(['Khasra', 'Village', 'Khata', 'Owner', 'Mutation Status', 'Parcel Status'], ctx.parcels.map((p) => [
        esc(p.khasraNo), esc(p.village), esc(p.khataNo), esc(p.ownerName), esc(p.mutationStatus), esc(p.status),
      ]))}`;
    return renderLaDocumentShell('Mutation Status Report', ctx.caseNo, body, ctx.generatedAt);
  },
};

export function canGenerateDocument(def: LaDocumentDef, ctx: LaDocumentContext): { ok: boolean; reason?: string } {
  if (def.requiresParcels && !ctx.parcels.length) {
    return { ok: false, reason: 'Identify parcels first' };
  }
  if (def.requiresCompensation && !ctx.compensations.length) {
    return { ok: false, reason: 'Run Estimate Compensation first' };
  }
  if (def.requiresClearanceType) {
    const hit = ctx.clearances.some((c) => c.clearanceType === def.requiresClearanceType);
    if (!hit) return { ok: false, reason: `Requires ${def.requiresClearanceType} clearance detection` };
  }
  return { ok: true };
}

export function generateLaDocumentHtml(code: string, ctx: LaDocumentContext): string | null {
  const gen = GENERATORS[code];
  if (!gen) return null;
  return gen(ctx);
}

export function generateAllLaDocuments(ctx: LaDocumentContext): Array<{
  code: string;
  label: string;
  category: string;
  status: 'generated' | 'skipped';
  reason?: string;
  contentHtml?: string;
}> {
  return LA_AUTO_DOCUMENTS.map((def) => {
    const check = canGenerateDocument(def, ctx);
    if (!check.ok) {
      return { code: def.code, label: def.label, category: def.category, status: 'skipped' as const, reason: check.reason };
    }
    const html = generateLaDocumentHtml(def.code, ctx);
    return { code: def.code, label: def.label, category: def.category, status: 'generated' as const, contentHtml: html ?? '' };
  });
}
