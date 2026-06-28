import {
  getOwnershipClassLabel,
  getOwnershipClassPriority,
  LA_OWNERSHIP_LAYER_MAP,
  type LaOwnershipClassCode,
} from '../constants/la-ownership-classification.constants';
import type { ExtractedLaParcelFields } from './la-parcel-attributes.util';

export type OwnershipClassificationResult = {
  code: LaOwnershipClassCode;
  label: string;
  source: 'overlay' | 'attribute' | 'default';
  matchedLayers: string[];
  matchedRule?: string;
};

type TextRule = {
  code: LaOwnershipClassCode;
  patterns: RegExp[];
};

const TEXT_RULES: TextRule[] = [
  { code: 'defense', patterns: [/defence|defense|military|army|air force|navy|\bmod\b/i] },
  { code: 'railway', patterns: [/railway|rail land|indian railway|ir land/i] },
  { code: 'national_highway', patterns: [/national highway|nhai|nh land|nh\d/i] },
  { code: 'pwd', patterns: [/\bpwd\b|public works|public work department/i] },
  { code: 'irrigation_department', patterns: [/irrigation|canal department|jal nigam|minor irrigation/i] },
  { code: 'forest_department', patterns: [/forest department|forest dept|vana vibhag/i] },
  { code: 'revenue_department', patterns: [/revenue department|revenue dept|collector|nazul|tehsildar land/i] },
  { code: 'forest_land', patterns: [/forest land|reserved forest|protected forest|\brf\b|\bpf\b/i] },
  { code: 'civil_soyam', patterns: [/civil soyam|soyam/i] },
  { code: 'van_panchayat', patterns: [/van panchayat/i] },
  { code: 'gram_sabha', patterns: [/gram sabha|panchayat land|village common/i] },
  { code: 'municipality', patterns: [/municipal|municipality|nagar palika|nagar nigam|ulb|city council/i] },
  { code: 'government_land', patterns: [/government|govt|state land|central land|public land|sarkar/i] },
  { code: 'religious_trust', patterns: [/temple|mosque|church|gurudwara|waqf|trust|religious|mandir|masjid/i] },
  { code: 'private_institution', patterns: [/school|college|hospital|university|institution|trust society/i] },
  { code: 'other_department', patterns: [/department|dept\.|board|corporation|authority/i] },
];

function classifyFromText(fields: ExtractedLaParcelFields): { code: LaOwnershipClassCode; rule: string } | null {
  const blob = [
    fields.ownershipType,
    fields.department,
    fields.landCategory,
    fields.landClass,
    fields.landUse,
    fields.ownerName,
  ].join(' ').toLowerCase();

  if (!blob.trim()) return null;

  for (const rule of TEXT_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(blob)) {
        return { code: rule.code, rule: pattern.source };
      }
    }
  }

  return null;
}

function classifyFromOverlays(layerCodes: string[]): LaOwnershipClassCode | null {
  let best: LaOwnershipClassCode | null = null;
  let bestPriority = -1;

  for (const raw of layerCodes) {
    const normalized = raw.trim().toLowerCase();
    const mapped = LA_OWNERSHIP_LAYER_MAP[normalized];
    if (!mapped) continue;
    const priority = getOwnershipClassPriority(mapped);
    if (priority > bestPriority) {
      best = mapped;
      bestPriority = priority;
    }
  }

  return best;
}

function defaultPrivateOrOther(fields: ExtractedLaParcelFields): LaOwnershipClassCode {
  if (fields.department.trim()) return 'other_department';
  return 'private_land';
}

export function classifyParcelOwnership(
  fields: ExtractedLaParcelFields,
  overlayLayerCodes: string[] = [],
): OwnershipClassificationResult {
  const matchedLayers = overlayLayerCodes
    .map((c) => c.trim().toLowerCase())
    .filter((c) => LA_OWNERSHIP_LAYER_MAP[c]);

  const overlayCode = classifyFromOverlays(overlayLayerCodes);
  if (overlayCode) {
    return {
      code: overlayCode,
      label: getOwnershipClassLabel(overlayCode),
      source: 'overlay',
      matchedLayers,
      matchedRule: 'gis_overlay',
    };
  }

  const textHit = classifyFromText(fields);
  if (textHit) {
    return {
      code: textHit.code,
      label: getOwnershipClassLabel(textHit.code),
      source: 'attribute',
      matchedLayers: [],
      matchedRule: textHit.rule,
    };
  }

  const fallback = defaultPrivateOrOther(fields);
  return {
    code: fallback,
    label: getOwnershipClassLabel(fallback),
    source: 'default',
    matchedLayers: [],
  };
}
