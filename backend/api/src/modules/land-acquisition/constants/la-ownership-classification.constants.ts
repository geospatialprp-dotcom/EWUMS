/** Standard ownership classification codes for LA parcels */
export const LA_OWNERSHIP_CLASSES = [
  { code: 'government_land', label: 'Government Land', priority: 40 },
  { code: 'private_land', label: 'Private Land', priority: 5 },
  { code: 'forest_land', label: 'Forest Land', priority: 85 },
  { code: 'civil_soyam', label: 'Civil Soyam', priority: 80 },
  { code: 'van_panchayat', label: 'Van Panchayat', priority: 75 },
  { code: 'pwd', label: 'PWD', priority: 70 },
  { code: 'national_highway', label: 'National Highway', priority: 68 },
  { code: 'railway', label: 'Railway', priority: 66 },
  { code: 'gram_sabha', label: 'Gram Sabha', priority: 55 },
  { code: 'municipality', label: 'Municipality', priority: 50 },
  { code: 'defense', label: 'Defense', priority: 95 },
  { code: 'irrigation_department', label: 'Irrigation Department', priority: 65 },
  { code: 'revenue_department', label: 'Revenue Department', priority: 45 },
  { code: 'forest_department', label: 'Forest Department', priority: 82 },
  { code: 'private_institution', label: 'Private Institution', priority: 35 },
  { code: 'religious_trust', label: 'Religious Trust', priority: 38 },
  { code: 'other_department', label: 'Other Department', priority: 20 },
] as const;

export type LaOwnershipClassCode = typeof LA_OWNERSHIP_CLASSES[number]['code'];

/** GIS feature class codes → ownership classification (overlay wins by priority) */
export const LA_OWNERSHIP_LAYER_MAP: Record<string, LaOwnershipClassCode> = {
  government_land: 'government_land',
  govt_land: 'government_land',
  government: 'government_land',
  defense_land: 'defense',
  defense: 'defense',
  forest_land: 'forest_land',
  forest: 'forest_land',
  reserved_forest: 'forest_land',
  protected_forest: 'forest_department',
  civil_soyam_land: 'civil_soyam',
  civil_soyam: 'civil_soyam',
  soyam: 'civil_soyam',
  van_panchayat: 'van_panchayat',
  van_panchayat_land: 'van_panchayat',
  gram_sabha_land: 'gram_sabha',
  gram_sabha: 'gram_sabha',
  panchayat_land: 'gram_sabha',
  nazul_land: 'revenue_department',
  nazul: 'revenue_department',
  revenue_land: 'revenue_department',
  municipality_land: 'municipality',
  municipal: 'municipality',
  ulb_land: 'municipality',
  pwd_land: 'pwd',
  pwd_road: 'pwd',
  national_highway_land: 'national_highway',
  nh_land: 'national_highway',
  railway_land: 'railway',
  railways: 'railway',
  irrigation_land: 'irrigation_department',
  canal_land: 'irrigation_department',
  schools: 'private_institution',
  school: 'private_institution',
  hospitals: 'private_institution',
  hospital: 'private_institution',
  temples: 'religious_trust',
  temple: 'religious_trust',
  religious_site: 'religious_trust',
};

export function getOwnershipClassLabel(code: string | null | undefined): string {
  return LA_OWNERSHIP_CLASSES.find((c) => c.code === code)?.label ?? code ?? '—';
}

export function getOwnershipClassPriority(code: LaOwnershipClassCode): number {
  return LA_OWNERSHIP_CLASSES.find((c) => c.code === code)?.priority ?? 0;
}
