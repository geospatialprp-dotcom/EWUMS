export const PROJECT_COMPONENTS = [
  'source_development',
  'gravity_main',
  'pumping_main',
  'reservoir',
  'distribution',
  'fhtc',
] as const;

export type ProjectComponent = typeof PROJECT_COMPONENTS[number];

export const COMPONENT_LABELS: Record<ProjectComponent, string> = {
  source_development: 'Source Development',
  gravity_main: 'Gravity Main Pipeline',
  pumping_main: 'Pumping Main Pipeline',
  reservoir: 'Reservoir Construction',
  distribution: 'Distribution Network',
  fhtc: 'FHTC Connections',
};

export const GIS_ASSET_TYPES = [
  'source', 'intake', 'gravity_main', 'pumping_main', 'reservoir',
  'valve_chamber', 'gate_valve', 'air_valve', 'scour_valve',
  'pump_house', 'transformer', 'distribution_main', 'fhtc',
] as const;

export type GisAssetType = typeof GIS_ASSET_TYPES[number];

export const GIS_ASSET_LABELS: Record<GisAssetType, string> = {
  source: 'Source',
  intake: 'Intake Structure',
  gravity_main: 'Gravity Main',
  pumping_main: 'Pumping Main',
  reservoir: 'Reservoir',
  valve_chamber: 'Valve Chambers',
  gate_valve: 'Gate Valves',
  air_valve: 'Air Valves',
  scour_valve: 'Scour Valves',
  pump_house: 'Pump House',
  transformer: 'Transformer',
  distribution_main: 'Distribution Network',
  fhtc: 'FHTC Connections',
};

export const WORKFLOW_STAGES = [
  { stage: 1, name: 'Work Planning', steps: ['DPR Upload', 'Admin Approval', 'Technical Sanction', 'BOQ Upload', 'Work Package', 'GIS Alignment'] },
  { stage: 2, name: 'Daily Construction', steps: ['Contractor DPR', 'GPS + Photos', 'Material/Labour', 'Progress Qty'] },
  { stage: 3, name: 'Measurement Book', steps: ['JE Site Inspection', 'Measurement', 'GPS Verify', 'Photo Verify'] },
  { stage: 4, name: 'Verification', steps: ['Contractor', 'Site Engineer', 'JE', 'AE', 'EE'] },
  { stage: 5, name: 'BOQ Reconciliation', steps: ['Quantity Comparison', 'Variance Report', 'Excess & Savings', 'Deviation Statement'] },
  { stage: 6, name: 'RA Bills', steps: ['Auto-generate', 'JE', 'AE', 'EE', 'Finance'] },
  { stage: 7, name: 'Final Bill', steps: ['100% MB', 'As-Built', 'GIS Mapping', 'FHTC', 'Commissioning'] },
  { stage: 8, name: 'GIS Integration', steps: ['Asset Mapping', 'GPS Capture', 'MB Reference'] },
  { stage: 9, name: 'Dashboard & Reporting', steps: ['Physical %', 'Financial %', 'Pending Items'] },
  { stage: 10, name: 'Final Outputs', steps: ['MB Register', 'BOQ Abstract', 'RA Bills', 'Certificates'] },
];

const RA_STATUS_BY_STEP: Record<number, string> = {
  1: 'je_review',
  2: 'ae_checked',
  3: 'ee_checked',
  4: 'accounts_verification',
};

export { RA_STATUS_BY_STEP };
