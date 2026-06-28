export const HANDOVER_DOCUMENT_SLOTS = [
  { type: 'completion_certificate', label: 'Completion Certificate', category: 'required' as const, verificationKey: 'completionVerified' },
  { type: 'commissioning_certificate', label: 'Commissioning Certificate', category: 'required' as const, verificationKey: 'commissioningVerified' },
  { type: 'as_built_drawings', label: 'As-Built Drawings', category: 'required' as const, verificationKey: 'asBuiltVerified' },
  { type: 'gis_asset_mapping', label: 'GIS Asset Mapping', category: 'required' as const, verificationKey: 'gisMappingVerified' },
  { type: 'asset_register', label: 'Asset Register', category: 'required' as const, verificationKey: 'assetRegisterVerified' },
  { type: 'fhtc_completion', label: 'FHTC Completion Report', category: 'required' as const, verificationKey: 'fhtcVerified' },
  { type: 'om_manuals', label: 'O&M Manuals', category: 'required' as const, verificationKey: 'omManualVerified' },
  { type: 'handover_certificate', label: 'Asset Handover Certificate', category: 'generated' as const },
  { type: 'responsibility_matrix', label: 'O&M Responsibility Matrix', category: 'generated' as const },
  { type: 'asset_inventory_register', label: 'Asset Inventory Register', category: 'generated' as const },
  { type: 'gis_asset_register', label: 'GIS Asset Register', category: 'generated' as const },
];

export const DOC_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending Upload',
  submitted: 'Awaiting Department Approval',
  approved: 'Approved',
  rejected: 'Rejected',
};
