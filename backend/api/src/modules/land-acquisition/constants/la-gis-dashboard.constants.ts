/** GIS dashboard KPI definitions */
export const LA_GIS_DASHBOARD_METRICS = [
  { key: 'totalAffectedVillages', label: 'Total Affected Villages' },
  { key: 'totalParcels', label: 'Total Parcels' },
  { key: 'governmentLandSqm', label: 'Government Land (m²)' },
  { key: 'privateLandSqm', label: 'Private Land (m²)' },
  { key: 'forestLandSqm', label: 'Forest Land (m²)' },
  { key: 'totalAcquisitionAreaSqm', label: 'Total Acquisition Area (m²)' },
  { key: 'totalCompensationInr', label: 'Total Compensation (₹)' },
  { key: 'pendingApprovals', label: 'Pending Approvals' },
  { key: 'approvedParcels', label: 'Approved Parcels' },
  { key: 'rejectedProposals', label: 'Rejected Proposals' },
  { key: 'litigationCases', label: 'Litigation Cases' },
  { key: 'possessionCompleted', label: 'Possession Completed' },
  { key: 'mutationCompleted', label: 'Mutation Completed' },
] as const;

export const LA_GOVT_OWNERSHIP_CODES = [
  'government_land',
  'revenue_department',
  'municipality',
  'pwd',
  'national_highway',
  'railway',
  'irrigation_department',
  'defense',
  'other_department',
  'gram_sabha',
] as const;

export const LA_FOREST_OWNERSHIP_CODES = [
  'forest_land',
  'forest_department',
  'civil_soyam',
  'van_panchayat',
] as const;

export const LA_PRIVATE_OWNERSHIP_CODES = [
  'private_land',
  'private_institution',
  'religious_trust',
] as const;

export type LaGisDashboardStats = {
  totalCases: number;
  totalAffectedVillages: number;
  totalParcels: number;
  governmentLandSqm: number;
  privateLandSqm: number;
  forestLandSqm: number;
  otherLandSqm: number;
  totalAcquisitionAreaSqm: number;
  totalCompensationInr: number;
  pendingApprovals: number;
  approvedClearances: number;
  approvedParcels: number;
  rejectedProposals: number;
  litigationCases: number;
  possessionCompleted: number;
  mutationCompleted: number;
  inProgressCases: number;
  possessionCompleteCases: number;
};

export const EMPTY_LA_GIS_DASHBOARD: LaGisDashboardStats = {
  totalCases: 0,
  totalAffectedVillages: 0,
  totalParcels: 0,
  governmentLandSqm: 0,
  privateLandSqm: 0,
  forestLandSqm: 0,
  otherLandSqm: 0,
  totalAcquisitionAreaSqm: 0,
  totalCompensationInr: 0,
  pendingApprovals: 0,
  approvedClearances: 0,
  approvedParcels: 0,
  rejectedProposals: 0,
  litigationCases: 0,
  possessionCompleted: 0,
  mutationCompleted: 0,
  inProgressCases: 0,
  possessionCompleteCases: 0,
};
