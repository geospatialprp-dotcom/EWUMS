import {
  LA_COMPENSATION_ATTR_ALIASES,
  LA_COMPENSATION_RATES,
} from '../constants/la-compensation.constants';

export type ParcelCompensationInput = {
  circleRatePerSqm?: number | null;
  affectedAreaSqm?: number | null;
  acquisitionMode?: string | null;
  landUse?: string | null;
  attributes?: Record<string, unknown>;
  ownerCount?: number;
};

export type ParcelCompensationBreakdown = {
  circleRatePerSqm: number;
  marketRatePerSqm: number;
  affectedAreaSqm: number;
  landCompensation: number;
  solatium: number;
  additionalCompensation: number;
  treeCompensation: number;
  cropCompensation: number;
  structureCompensation: number;
  totalCompensation: number;
  interest: number;
  rehabilitationCost: number;
  totalAcquisitionCost: number;
  acquisitionModeFactor: number;
  rrEntitlements: Record<string, unknown>;
  calculationNotes: string[];
};

function pickNum(attrs: Record<string, unknown>, keys: readonly string[]): number {
  for (const key of keys) {
    const val = attrs[key];
    if (val !== undefined && val !== null && val !== '') {
      const n = Number(val);
      if (Number.isFinite(n) && n >= 0) return n;
    }
  }
  return 0;
}

function acquisitionFactor(mode?: string | null): number {
  const m = (mode ?? 'easement').toLowerCase();
  if (m === 'temporary') return LA_COMPENSATION_RATES.temporaryFactor;
  if (m === 'easement' || m === 'partial') return LA_COMPENSATION_RATES.easementFactor;
  return 1;
}

export function calculateParcelCompensation(input: ParcelCompensationInput): ParcelCompensationBreakdown {
  const attrs = input.attributes ?? {};
  const notes: string[] = [];

  const circleRate = Number(input.circleRatePerSqm ?? 0) || LA_COMPENSATION_RATES.defaultCircleRatePerSqm;
  const marketFromAttr = pickNum(attrs, LA_COMPENSATION_ATTR_ALIASES.marketRate);
  const marketRate = marketFromAttr > 0
    ? marketFromAttr
    : Math.round(circleRate * LA_COMPENSATION_RATES.marketRateMultiplier);

  const area = Math.max(0, Number(input.affectedAreaSqm ?? 0));
  const modeFactor = acquisitionFactor(input.acquisitionMode);

  let treeCompensation = pickNum(attrs, LA_COMPENSATION_ATTR_ALIASES.treeValue);
  let cropCompensation = pickNum(attrs, LA_COMPENSATION_ATTR_ALIASES.cropValue);
  const structureCompensation = pickNum(attrs, LA_COMPENSATION_ATTR_ALIASES.structureValue);

  if (!treeCompensation && !cropCompensation) {
    const combined = pickNum(attrs, ['trees_crops_value', 'treesCropsValue']);
    if (combined > 0) {
      treeCompensation = Math.round(combined * 0.6);
      cropCompensation = Math.round(combined * 0.4);
      notes.push('Legacy trees_crops_value split 60% trees / 40% crops');
    }
  }

  const landCompensation = Math.round(marketRate * area * modeFactor);
  const solatium = Math.round(landCompensation * LA_COMPENSATION_RATES.solatiumRate);
  const additionalCompensation = Math.round(
    landCompensation
    * LA_COMPENSATION_RATES.additionalCompAnnualRate
    * LA_COMPENSATION_RATES.additionalCompYears,
  );

  const totalCompensation = Math.round(
    landCompensation
    + solatium
    + additionalCompensation
    + treeCompensation
    + cropCompensation
    + structureCompensation,
  );

  const interest = Math.round(
    totalCompensation
    * LA_COMPENSATION_RATES.interestAnnualRate
    * LA_COMPENSATION_RATES.interestPendingYears,
  );

  const owners = Math.max(1, input.ownerCount ?? 1);
  const rehabBase = LA_COMPENSATION_RATES.rehabilitationPerOwner;
  const landUseBoost = /agricultural|agri|crop|farm/i.test(input.landUse ?? '') ? 1.2 : 1;
  const rehabilitationCost = Math.round(rehabBase * owners * landUseBoost);

  const totalAcquisitionCost = Math.round(totalCompensation + interest + rehabilitationCost);

  if (modeFactor < 1) {
    notes.push(`Acquisition mode "${input.acquisitionMode}" — land compensation × ${modeFactor}`);
  }
  if (!marketFromAttr) {
    notes.push(`Market rate derived as circle rate × ${LA_COMPENSATION_RATES.marketRateMultiplier}`);
  }

  return {
    circleRatePerSqm: circleRate,
    marketRatePerSqm: marketRate,
    affectedAreaSqm: area,
    landCompensation,
    solatium,
    additionalCompensation,
    treeCompensation,
    cropCompensation,
    structureCompensation,
    totalCompensation,
    interest,
    rehabilitationCost,
    totalAcquisitionCost,
    acquisitionModeFactor: modeFactor,
    rrEntitlements: {
      employment: owners,
      housingGrant: Math.round(rehabBase * 0.4 * owners),
      transportAllowance: Math.round(50000 * owners),
      landUse: input.landUse ?? null,
    },
    calculationNotes: notes,
  };
}

export type CompensationSummary = {
  parcelCount: number;
  totalLandCompensation: number;
  totalSolatium: number;
  totalAdditionalCompensation: number;
  totalTreeCompensation: number;
  totalCropCompensation: number;
  totalStructureCompensation: number;
  totalCompensation: number;
  totalInterest: number;
  totalRehabilitationCost: number;
  totalAcquisitionCost: number;
};

export function summarizeCompensation(rows: ParcelCompensationBreakdown[]): CompensationSummary {
  const sum = (fn: (r: ParcelCompensationBreakdown) => number) =>
    Math.round(rows.reduce((acc, r) => acc + fn(r), 0));

  return {
    parcelCount: rows.length,
    totalLandCompensation: sum((r) => r.landCompensation),
    totalSolatium: sum((r) => r.solatium),
    totalAdditionalCompensation: sum((r) => r.additionalCompensation),
    totalTreeCompensation: sum((r) => r.treeCompensation),
    totalCropCompensation: sum((r) => r.cropCompensation),
    totalStructureCompensation: sum((r) => r.structureCompensation),
    totalCompensation: sum((r) => r.totalCompensation),
    totalInterest: sum((r) => r.interest),
    totalRehabilitationCost: sum((r) => r.rehabilitationCost),
    totalAcquisitionCost: sum((r) => r.totalAcquisitionCost),
  };
}
