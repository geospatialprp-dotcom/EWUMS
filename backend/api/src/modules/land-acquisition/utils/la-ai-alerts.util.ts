import {
  FOREST_OWNERSHIP,
  GOVERNMENT_OWNERSHIP,
  LA_AI_APPROVAL_VALIDITY_DAYS,
  LA_AI_HIGH_COMPENSATION_INR,
  PRIVATE_OWNERSHIP,
  getLaAiAlertDef,
  type LaAiAlertSeverity,
  type LaAiAlertType,
} from '../constants/la-ai-alerts.constants';

export type LaAiAlert = {
  id: string;
  type: LaAiAlertType;
  label: string;
  severity: LaAiAlertSeverity;
  message: string;
  laCaseId: string;
  caseNo?: string;
  caseTitle?: string;
  laParcelId?: string;
  clearanceId?: string;
  khasraNo?: string;
  village?: string;
  suggestedAction?: string;
  detectedAt: string;
};

type ParcelInput = {
  id: string;
  khasraNo?: string | null;
  khataNo?: string | null;
  village?: string | null;
  landUse?: string | null;
  landClass?: string | null;
  ownershipClassification?: string | null;
  ownershipType?: string | null;
  department?: string | null;
  ownerName?: string | null;
  currentStatus?: string | null;
  mutationStatus?: string | null;
  attributes?: Record<string, unknown> | null;
  owners?: Array<{ ownerName?: string; verificationStatus?: string }>;
};

type ClearanceInput = {
  id: string;
  clearanceType: string;
  label?: string;
  status: string;
  authority?: string | null;
  overlayLayerCode?: string | null;
  approvedAt?: Date | string | null;
  laParcelId?: string | null;
};

type CompensationInput = {
  laParcelId: string;
  totalAcquisitionCost?: number;
  totalCompensation?: number;
  totalAward?: number;
};

type DuplicateRef = {
  caseId: string;
  caseNo: string;
  khasraNo: string;
  village: string;
};

function alertId(parts: string[]): string {
  return parts.filter(Boolean).join(':');
}

function makeAlert(
  type: LaAiAlertType,
  message: string,
  ctx: {
    laCaseId: string;
    caseNo?: string;
    caseTitle?: string;
    laParcelId?: string;
    clearanceId?: string;
    khasraNo?: string;
    village?: string;
    suggestedAction?: string;
  },
): LaAiAlert {
  const def = getLaAiAlertDef(type);
  return {
    id: alertId([type, ctx.laCaseId, ctx.laParcelId ?? '', ctx.clearanceId ?? '', ctx.khasraNo ?? '']),
    type,
    label: def?.label ?? type,
    severity: def?.severity ?? 'warning',
    message,
    laCaseId: ctx.laCaseId,
    caseNo: ctx.caseNo,
    caseTitle: ctx.caseTitle,
    laParcelId: ctx.laParcelId,
    clearanceId: ctx.clearanceId,
    khasraNo: ctx.khasraNo ?? undefined,
    village: ctx.village ?? undefined,
    suggestedAction: ctx.suggestedAction,
    detectedAt: new Date().toISOString(),
  };
}

function isLitigationParcel(p: ParcelInput): boolean {
  const blob = [
    p.currentStatus,
    p.mutationStatus,
    JSON.stringify(p.attributes ?? {}),
  ].join(' ').toLowerCase();
  return /litigation|dispute|court|stay|contested/.test(blob);
}

function parcelKey(p: ParcelInput): string {
  return `${(p.village ?? '').trim().toLowerCase()}|${(p.khasraNo ?? '').trim().toLowerCase()}`;
}

function hasOwner(p: ParcelInput): boolean {
  if (p.ownerName?.trim()) return true;
  return (p.owners ?? []).some((o) => Boolean(o.ownerName?.trim()));
}

function detectOwnershipMismatch(p: ParcelInput): string | null {
  const oc = p.ownershipClassification ?? '';
  const raw = `${p.ownershipType ?? ''} ${p.landUse ?? ''} ${p.landClass ?? ''}`.toLowerCase();

  if (GOVERNMENT_OWNERSHIP.has(oc) && !p.department?.trim() && p.ownerName?.trim()
    && !/government|govt|department|revenue|municipal/i.test(p.ownerName)) {
    return `Classified as ${oc} but individual owner "${p.ownerName}" recorded without department`;
  }
  if (PRIVATE_OWNERSHIP.has(oc) && p.department?.trim()) {
    return `Classified as private land but department "${p.department}" is assigned`;
  }
  if (PRIVATE_OWNERSHIP.has(oc) && /government|govt|revenue|nazul|forest department/i.test(raw)) {
    return 'Parcel attributes suggest government land but ownership class is private';
  }
  if (FOREST_OWNERSHIP.has(oc) && /private|individual/i.test(raw) && !/forest|soyam|van/i.test(raw)) {
    return 'Parcel attributes suggest private land but classified as forest';
  }
  return null;
}

export function buildLaAiAlerts(input: {
  laCaseId: string;
  caseNo?: string;
  caseTitle?: string;
  hasAlignment?: boolean;
  parcels: ParcelInput[];
  clearances: ClearanceInput[];
  compensations?: CompensationInput[];
  duplicateRefs?: DuplicateRef[];
}): LaAiAlert[] {
  const alerts: LaAiAlert[] = [];
  const ctx = { laCaseId: input.laCaseId, caseNo: input.caseNo, caseTitle: input.caseTitle };
  const compByParcel = new Map(
    (input.compensations ?? []).map((c) => [c.laParcelId, c]),
  );

  const forestParcels = input.parcels.filter((p) =>
    FOREST_OWNERSHIP.has(p.ownershipClassification ?? '')
    || /forest|soyam|van panchayat/i.test(`${p.landUse ?? ''} ${p.landClass ?? ''}`));
  if (forestParcels.length > 0 && input.hasAlignment !== false) {
    const sample = forestParcels[0];
    alerts.push(makeAlert(
      'pipeline_entering_forest',
      `Pipeline corridor intersects ${forestParcels.length} forest parcel(s) — FCA / forest clearance likely required`,
      {
        ...ctx,
        laParcelId: sample.id,
        khasraNo: sample.khasraNo ?? undefined,
        village: sample.village ?? undefined,
        suggestedAction: 'Review forest route alternatives or initiate Forest (FCA) proposal',
      },
    ));
  }

  const privateParcels = input.parcels.filter((p) =>
    PRIVATE_OWNERSHIP.has(p.ownershipClassification ?? '')
    || (!p.ownershipClassification && !GOVERNMENT_OWNERSHIP.has(p.ownershipClassification ?? '')
      && !FOREST_OWNERSHIP.has(p.ownershipClassification ?? '')));
  if (privateParcels.length > 0 && input.hasAlignment !== false) {
    alerts.push(makeAlert(
      'pipeline_entering_private_land',
      `Pipeline enters ${privateParcels.length} private land parcel(s) — RFCTLARR acquisition & owner consent required`,
      {
        ...ctx,
        laParcelId: privateParcels[0].id,
        khasraNo: privateParcels[0].khasraNo ?? undefined,
        village: privateParcels[0].village ?? undefined,
        suggestedAction: 'Verify ownership records and prepare private land acquisition schedule',
      },
    ));
  }

  const railwayClearances = input.clearances.filter((c) =>
    /railway/.test(c.clearanceType) || c.overlayLayerCode === 'railways');
  const railwayParcels = input.parcels.filter((p) =>
    p.ownershipClassification === 'railway' || /railway|rail/i.test(`${p.landUse ?? ''} ${p.landClass ?? ''}`));
  if (railwayClearances.length > 0 || railwayParcels.length > 0) {
    alerts.push(makeAlert(
      'pipeline_crossing_railway',
      'Pipeline alignment crosses railway corridor — Railway Board / DRM NOC required',
      {
        ...ctx,
        clearanceId: railwayClearances[0]?.id,
        laParcelId: railwayParcels[0]?.id,
        suggestedAction: 'Submit railway crossing proposal and obtain DRM / Railway NOC',
      },
    ));
  }

  const riverClearances = input.clearances.filter((c) =>
    /river|water|wetland|lake/.test(c.clearanceType)
    || ['river', 'lake', 'wetlands'].includes(c.overlayLayerCode ?? ''));
  const riverParcels = input.parcels.filter((p) =>
    /river|nadi|stream|wetland|lake|water/i.test(`${p.landUse ?? ''} ${p.landClass ?? ''} ${JSON.stringify(p.attributes ?? {})}`));
  if (riverClearances.length > 0 || riverParcels.length > 0) {
    alerts.push(makeAlert(
      'pipeline_crossing_river',
      'Pipeline crosses river / water body — hydrology & irrigation NOC may be required',
      {
        ...ctx,
        clearanceId: riverClearances[0]?.id,
        laParcelId: riverParcels[0]?.id,
        suggestedAction: 'Obtain river crossing NOC from Irrigation / WRD and assess HDD option',
      },
    ));
  }

  for (const p of input.parcels) {
    const comp = compByParcel.get(p.id);
    const cost = Number(comp?.totalAcquisitionCost ?? comp?.totalAward ?? comp?.totalCompensation ?? 0);
    if (cost >= LA_AI_HIGH_COMPENSATION_INR) {
      alerts.push(makeAlert(
        'high_compensation_area',
        `Khasra ${p.khasraNo ?? '—'} (${p.village ?? '—'}) — estimated acquisition cost ₹ ${cost.toLocaleString('en-IN')} exceeds threshold`,
        {
          ...ctx,
          laParcelId: p.id,
          khasraNo: p.khasraNo ?? undefined,
          village: p.village ?? undefined,
          suggestedAction: 'Review market rate, structure valuation, and consider route shift to reduce cost',
        },
      ));
    }

    if (isLitigationParcel(p)) {
      alerts.push(makeAlert(
        'litigation_parcel',
        `Khasra ${p.khasraNo ?? '—'} (${p.village ?? '—'}) is flagged for litigation / dispute`,
        {
          ...ctx,
          laParcelId: p.id,
          khasraNo: p.khasraNo ?? undefined,
          village: p.village ?? undefined,
          suggestedAction: 'Hold award until court / revenue dispute is resolved',
        },
      ));
    }

    if (!hasOwner(p)) {
      alerts.push(makeAlert(
        'missing_owner',
        `Khasra ${p.khasraNo ?? '—'} (${p.village ?? '—'}) has no recorded owner — notification cannot proceed`,
        {
          ...ctx,
          laParcelId: p.id,
          khasraNo: p.khasraNo ?? undefined,
          village: p.village ?? undefined,
          suggestedAction: 'Verify khata / ownership from revenue records and add primary owner',
        },
      ));
    }

    const mismatch = detectOwnershipMismatch(p);
    if (mismatch) {
      alerts.push(makeAlert(
        'ownership_mismatch',
        `Khasra ${p.khasraNo ?? '—'}: ${mismatch}`,
        {
          ...ctx,
          laParcelId: p.id,
          khasraNo: p.khasraNo ?? undefined,
          village: p.village ?? undefined,
          suggestedAction: 'Reconcile GIS overlay, revenue records, and ownership classification',
        },
      ));
    }
  }

  const seenInCase = new Map<string, ParcelInput>();
  for (const p of input.parcels) {
    const key = parcelKey(p);
    if (!key.replace('|', '').trim()) continue;
    if (seenInCase.has(key)) {
      alerts.push(makeAlert(
        'duplicate_acquisition',
        `Duplicate parcel in case: Khasra ${p.khasraNo} / ${p.village} appears more than once`,
        {
          ...ctx,
          laParcelId: p.id,
          khasraNo: p.khasraNo ?? undefined,
          village: p.village ?? undefined,
          suggestedAction: 'Remove duplicate parcel entry before notification',
        },
      ));
    } else {
      seenInCase.set(key, p);
    }
  }

  for (const ref of input.duplicateRefs ?? []) {
    alerts.push(makeAlert(
      'duplicate_acquisition',
      `Khasra ${ref.khasraNo} / ${ref.village} already acquired in case ${ref.caseNo}`,
      {
        ...ctx,
        khasraNo: ref.khasraNo,
        village: ref.village,
        suggestedAction: 'Verify if parcel is already under acquisition in another LA case',
      },
    ));
  }

  for (const c of input.clearances) {
    if (c.status === 'required' || c.status === 'applied') {
      alerts.push(makeAlert(
        'pending_noc',
        `${c.label ?? c.clearanceType} NOC is ${c.status === 'applied' ? 'applied — awaiting approval' : 'pending application'} (${c.authority ?? 'authority TBD'})`,
        {
          ...ctx,
          clearanceId: c.id,
          laParcelId: c.laParcelId ?? undefined,
          suggestedAction: 'Track NOC application and upload approval reference',
        },
      ));
    }

    if (c.status === 'approved' && c.approvedAt) {
      const approved = new Date(c.approvedAt);
      const expiry = new Date(approved);
      expiry.setDate(expiry.getDate() + LA_AI_APPROVAL_VALIDITY_DAYS);
      if (expiry < new Date()) {
        alerts.push(makeAlert(
          'expired_approval',
          `${c.label ?? c.clearanceType} approval expired on ${expiry.toLocaleDateString('en-IN')} — renewal required`,
          {
            ...ctx,
            clearanceId: c.id,
            suggestedAction: 'Re-apply for NOC / clearance before proceeding with notification',
          },
        ));
      }
    }
  }

  return alerts;
}

export function summarizeLaAiAlerts(alerts: LaAiAlert[]) {
  const byType: Record<string, number> = {};
  const bySeverity: Record<LaAiAlertSeverity, number> = { critical: 0, warning: 0, info: 0 };
  for (const a of alerts) {
    byType[a.type] = (byType[a.type] ?? 0) + 1;
    bySeverity[a.severity] += 1;
  }
  return {
    total: alerts.length,
    critical: bySeverity.critical,
    warning: bySeverity.warning,
    info: bySeverity.info,
    byType,
  };
}
