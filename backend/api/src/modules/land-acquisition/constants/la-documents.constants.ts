export type LaDocumentDef = {
  code: string;
  label: string;
  category: 'proposal' | 'letter' | 'register' | 'map' | 'certificate' | 'summary';
  requiresParcels?: boolean;
  requiresCompensation?: boolean;
  requiresClearanceType?: string;
};

export const LA_AUTO_DOCUMENTS: readonly LaDocumentDef[] = [
  { code: 'la_proposal', label: 'Land Acquisition Proposal', category: 'proposal', requiresParcels: true },
  { code: 'dm_letter', label: 'District Magistrate Letter', category: 'letter', requiresParcels: true },
  { code: 'revenue_letter', label: 'Revenue Department Letter', category: 'letter', requiresClearanceType: 'revenue' },
  { code: 'forest_proposal', label: 'Forest Proposal', category: 'proposal', requiresClearanceType: 'forest_fca' },
  { code: 'pwd_noc_request', label: 'PWD NOC Request', category: 'letter', requiresClearanceType: 'pwd_noc' },
  { code: 'railway_crossing_proposal', label: 'Railway Crossing Proposal', category: 'proposal', requiresClearanceType: 'railway_crossing' },
  { code: 'gram_sabha_resolution', label: 'Gram Sabha Resolution', category: 'letter', requiresClearanceType: 'gram_panchayat_resolution' },
  { code: 'land_schedule', label: 'Land Schedule', category: 'register', requiresParcels: true },
  { code: 'affected_owner_list', label: 'Affected Owner List', category: 'register', requiresParcels: true },
  { code: 'compensation_register', label: 'Compensation Register', category: 'register', requiresCompensation: true },
  { code: 'parcel_map', label: 'Parcel Map', category: 'map', requiresParcels: true },
  { code: 'acquisition_map', label: 'Acquisition Map', category: 'map', requiresParcels: true },
  { code: 'village_wise_summary', label: 'Village Wise Summary', category: 'summary', requiresParcels: true },
  { code: 'department_wise_summary', label: 'Department Wise Summary', category: 'summary', requiresParcels: true },
  { code: 'land_register', label: 'Land Register', category: 'register', requiresParcels: true },
  { code: 'award_register', label: 'Award Register', category: 'register', requiresCompensation: true },
  { code: 'possession_certificate', label: 'Possession Certificate', category: 'certificate', requiresCompensation: true },
  { code: 'mutation_status', label: 'Mutation Status', category: 'register', requiresParcels: true },
] as const;

export function findLaDocument(code: string) {
  return LA_AUTO_DOCUMENTS.find((d) => d.code === code);
}
