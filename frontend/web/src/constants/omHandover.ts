export const HANDOVER_VERIFICATIONS = [
  { key: 'completionVerified', label: 'Completion Certificate' },
  { key: 'commissioningVerified', label: 'Commissioning Certificate' },
  { key: 'asBuiltVerified', label: 'As-Built Drawings' },
  { key: 'gisMappingVerified', label: 'GIS Asset Mapping' },
  { key: 'assetRegisterVerified', label: 'Asset Register' },
  { key: 'fhtcVerified', label: 'FHTC Completion' },
  { key: 'omManualVerified', label: 'O&M Manuals' },
] as const;

export const OM_AGENCY_OPTIONS = [
  { value: 'department', label: 'Department' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'vwsc', label: 'Village Water & Sanitation Committee (VWSC)' },
  { value: 'user_committee', label: 'User Committee' },
  { value: 'third_party_operator', label: 'Third Party Operator' },
] as const;

export const HANDOVER_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  je_review: 'JE Review',
  ae_review: 'AE Review',
  handed_over: 'Handed Over',
  rejected: 'Rejected',
};

export type HandoverFormState = {
  schemeName: string;
  projectId: string;
  omAgencyType: string;
  omAgencyName: string;
  completionVerified: boolean;
  commissioningVerified: boolean;
  asBuiltVerified: boolean;
  gisMappingVerified: boolean;
  assetRegisterVerified: boolean;
  fhtcVerified: boolean;
  omManualVerified: boolean;
};

export const emptyHandoverForm = (): HandoverFormState => ({
  schemeName: '',
  projectId: '',
  omAgencyType: 'department',
  omAgencyName: '',
  completionVerified: false,
  commissioningVerified: false,
  asBuiltVerified: false,
  gisMappingVerified: false,
  assetRegisterVerified: false,
  fhtcVerified: false,
  omManualVerified: false,
});
