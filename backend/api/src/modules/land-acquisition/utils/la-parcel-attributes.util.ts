/** Cadastral attribute aliases for automatic parcel detection from GIS imports */
export const LA_PARCEL_ATTR_ALIASES = {
  village: ['village', 'Village', 'village_name', 'villageName', 'rev_village', 'revenue_village', 'gram'],
  tehsil: ['tehsil', 'Tehsil', 'tehsil_name', 'sub_district'],
  district: ['district', 'District', 'district_name', 'dist'],
  khasraNo: ['khasra_no', 'khasraNo', 'Khasra', 'khasra', 'survey_no', 'surveyNo', 'plot_no', 'plotNo'],
  khataNo: ['khata_no', 'khataNo', 'Khata', 'khata', 'account_no'],
  landUse: ['land_use', 'landUse', 'LandUse', 'use', 'usage'],
  landCategory: ['land_category', 'landCategory', 'category', 'land_class', 'landClass', 'LandClass', 'tenure'],
  ownershipType: ['ownership_type', 'ownershipType', 'ownership', 'tenure_type', 'title_type'],
  department: ['department', 'Department', 'dept', 'owning_department', 'govt_department'],
  ownerName: ['owner_name', 'ownerName', 'Owner', 'owner', 'name_of_owner', 'landholder', 'pattadar'],
  currentStatus: ['current_status', 'currentStatus', 'parcel_status', 'status_cadastral', 'land_status'],
  mutationStatus: ['mutation_status', 'mutationStatus', 'mutation', 'intkal_status', 'transfer_status'],
  circleRate: ['circle_rate', 'circleRate', 'guideline_value', 'rate_per_sqm'],
} as const;

export type ExtractedLaParcelFields = {
  village: string;
  tehsil: string;
  district: string;
  khasraNo: string;
  khataNo: string;
  landUse: string;
  landCategory: string;
  landClass: string;
  ownershipType: string;
  department: string;
  ownerName: string;
  currentStatus: string;
  mutationStatus: string;
  circleRatePerSqm: number;
};

function pickAttr(attrs: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const val = attrs[key];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      return String(val).trim();
    }
  }
  return '';
}

export function extractLaParcelFields(attrs: Record<string, unknown> = {}): ExtractedLaParcelFields {
  const landCategory = pickAttr(attrs, LA_PARCEL_ATTR_ALIASES.landCategory);
  const landUse = pickAttr(attrs, LA_PARCEL_ATTR_ALIASES.landUse);
  const circleRaw = pickAttr(attrs, LA_PARCEL_ATTR_ALIASES.circleRate);
  const circleRatePerSqm = circleRaw ? Number(circleRaw) : 500;

  return {
    village: pickAttr(attrs, LA_PARCEL_ATTR_ALIASES.village),
    tehsil: pickAttr(attrs, LA_PARCEL_ATTR_ALIASES.tehsil),
    district: pickAttr(attrs, LA_PARCEL_ATTR_ALIASES.district),
    khasraNo: pickAttr(attrs, LA_PARCEL_ATTR_ALIASES.khasraNo),
    khataNo: pickAttr(attrs, LA_PARCEL_ATTR_ALIASES.khataNo),
    landUse,
    landCategory: landCategory || landUse,
    landClass: landCategory || pickAttr(attrs, ['land_class', 'landClass']),
    ownershipType: pickAttr(attrs, LA_PARCEL_ATTR_ALIASES.ownershipType),
    department: pickAttr(attrs, LA_PARCEL_ATTR_ALIASES.department),
    ownerName: pickAttr(attrs, LA_PARCEL_ATTR_ALIASES.ownerName),
    currentStatus: pickAttr(attrs, LA_PARCEL_ATTR_ALIASES.currentStatus),
    mutationStatus: pickAttr(attrs, LA_PARCEL_ATTR_ALIASES.mutationStatus),
    circleRatePerSqm: Number.isFinite(circleRatePerSqm) ? circleRatePerSqm : 500,
  };
}

export type AcquisitionSplit = {
  acquisitionMode: 'full' | 'partial' | 'easement' | 'temporary';
  temporaryAreaSqm: number;
  permanentAreaSqm: number;
};

/** Classify temporary vs permanent acquisition from affected geometry */
export function classifyAcquisition(
  affectedAreaSqm: number,
  totalAreaSqm: number,
  affectedLengthM: number,
): AcquisitionSplit {
  const total = Math.max(totalAreaSqm, affectedAreaSqm, 1);
  const ratio = affectedAreaSqm / total;

  if (ratio >= 0.85) {
    return {
      acquisitionMode: 'full',
      temporaryAreaSqm: 0,
      permanentAreaSqm: affectedAreaSqm,
    };
  }

  if (affectedLengthM > 0 && ratio < 0.85) {
    return {
      acquisitionMode: 'easement',
      temporaryAreaSqm: affectedAreaSqm,
      permanentAreaSqm: 0,
    };
  }

  return {
    acquisitionMode: 'partial',
    temporaryAreaSqm: Math.round(affectedAreaSqm * 0.3 * 100) / 100,
    permanentAreaSqm: Math.round(affectedAreaSqm * 0.7 * 100) / 100,
  };
}

export const LA_PARCEL_DETECTION_FIELDS = [
  { code: 'village', label: 'Village' },
  { code: 'khasraNo', label: 'Khasra Number' },
  { code: 'khataNo', label: 'Khata Number' },
  { code: 'affectedAreaSqm', label: 'Area Affected (m²)' },
  { code: 'affectedLengthM', label: 'Length Inside Parcel (m)' },
  { code: 'rowWidthM', label: 'Width Required (m)' },
  { code: 'temporaryAreaSqm', label: 'Temporary Acquisition (m²)' },
  { code: 'permanentAreaSqm', label: 'Permanent Acquisition (m²)' },
  { code: 'totalAreaSqm', label: 'Total Area (m²)' },
  { code: 'ownershipClassificationLabel', label: 'Ownership Classification' },
  { code: 'ownershipType', label: 'Ownership Type (Raw)' },
  { code: 'department', label: 'Department' },
  { code: 'ownerName', label: 'Owner Name' },
  { code: 'landCategory', label: 'Land Category' },
  { code: 'landUse', label: 'Land Use' },
  { code: 'currentStatus', label: 'Current Status' },
  { code: 'mutationStatus', label: 'Mutation Status' },
] as const;
