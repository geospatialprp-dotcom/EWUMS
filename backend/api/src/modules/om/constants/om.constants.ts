export const OM_WORKFLOW_STAGES = [
  { stage: 1, key: 'handover', name: 'Asset Handover & O&M Init' },
  { stage: 2, key: 'asset-registration', name: 'Asset Registration & GIS' },
  { stage: 3, key: 'inspections', name: 'Routine Inspections' },
  { stage: 4, key: 'preventive-maintenance', name: 'Preventive Maintenance' },
  { stage: 5, key: 'breakdown', name: 'Breakdown Maintenance' },
  { stage: 6, key: 'water-quality', name: 'Water Quality Monitoring' },
  { stage: 7, key: 'energy', name: 'Energy Management' },
  { stage: 8, key: 'scada-iot', name: 'SCADA & IoT Integration' },
  { stage: 9, key: 'consumer-service', name: 'Consumer Service' },
  { stage: 10, key: 'complaints', name: 'Complaint Management' },
  { stage: 11, key: 'contracts', name: 'O&M Contract Management' },
  { stage: 12, key: 'lifecycle', name: 'Asset Lifecycle & Renewal' },
  { stage: 13, key: 'dashboard', name: 'GIS O&M Dashboard' },
  { stage: 14, key: 'reports', name: 'Reports & Outputs' },
] as const;

export const OM_AGENCY_TYPES = [
  'department',
  'contractor',
  'vwsc',
  'user_committee',
  'third_party_operator',
] as const;

export const OM_AGENCY_LABELS: Record<string, string> = {
  department: 'Department',
  contractor: 'Contractor',
  vwsc: 'Village Water & Sanitation Committee (VWSC)',
  user_committee: 'User Committee',
  third_party_operator: 'Third Party Operator',
};

export const HANDOVER_VERIFICATION_ITEMS = [
  { key: 'completionVerified', label: 'Completion Certificate' },
  { key: 'commissioningVerified', label: 'Commissioning Certificate' },
  { key: 'asBuiltVerified', label: 'As-Built Drawings' },
  { key: 'gisMappingVerified', label: 'GIS Asset Mapping' },
  { key: 'assetRegisterVerified', label: 'Asset Register' },
  { key: 'fhtcVerified', label: 'FHTC Completion' },
  { key: 'omManualVerified', label: 'O&M Manuals' },
] as const;

export const HANDOVER_STATUS_BY_STEP: Record<number, string> = {
  1: 'je_review',
  2: 'ae_review',
  3: 'handed_over',
};

export const OM_MATRIX_ACTIVITIES = [
  'Daily Operations & Pumping',
  'Routine Inspections (Daily / Weekly / Monthly)',
  'Preventive Maintenance',
  'Breakdown Response & Repairs',
  'Water Quality Monitoring',
  'Energy Management',
  'Consumer Service & Complaints',
  'Asset Lifecycle & Renewal Planning',
] as const;

export const HANDOVER_DOCUMENT_TYPES = [
  { type: 'completion_certificate', label: 'Completion Certificate', category: 'required', verificationKey: 'completionVerified' },
  { type: 'commissioning_certificate', label: 'Commissioning Certificate', category: 'required', verificationKey: 'commissioningVerified' },
  { type: 'as_built_drawings', label: 'As-Built Drawings', category: 'required', verificationKey: 'asBuiltVerified' },
  { type: 'gis_asset_mapping', label: 'GIS Asset Mapping', category: 'required', verificationKey: 'gisMappingVerified' },
  { type: 'asset_register', label: 'Asset Register', category: 'required', verificationKey: 'assetRegisterVerified' },
  { type: 'fhtc_completion', label: 'FHTC Completion Report', category: 'required', verificationKey: 'fhtcVerified' },
  { type: 'om_manuals', label: 'O&M Manuals', category: 'required', verificationKey: 'omManualVerified' },
  { type: 'handover_certificate', label: 'Asset Handover Certificate', category: 'generated' },
  { type: 'responsibility_matrix', label: 'O&M Responsibility Matrix', category: 'generated' },
  { type: 'asset_inventory_register', label: 'Asset Inventory Register', category: 'generated' },
  { type: 'gis_asset_register', label: 'GIS Asset Register', category: 'generated' },
] as const;

export const BREAKDOWN_CATEGORIES = [
  'pump_failure',
  'motor_failure',
  'flow_meter_failure',
  'transformer_failure',
  'panel_failure',
  'power_failure',
  'pipe_burst',
  'leakage',
  'valve_failure',
  'no_water_supply',
  'low_pressure',
  'water_quality',
] as const;
