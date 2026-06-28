export const LA_SCHEME_TYPES = [

  { code: 'gravity', label: 'Gravity Water Supply Scheme' },

  { code: 'pumping', label: 'Pumping Water Supply Scheme' },

  { code: 'sewer', label: 'Sewerage Project' },

  { code: 'transmission', label: 'Transmission Main' },

  { code: 'distribution', label: 'Distribution Network' },

  { code: 'combined', label: 'Combined Utility Infrastructure' },

] as const;



export const LA_ASSET_TYPES = [

  { code: 'transmission_main', label: 'Transmission Main', geometry: 'LineString', defaultRowM: 6 },

  { code: 'distribution_main', label: 'Distribution Main', geometry: 'LineString', defaultRowM: 3 },

  { code: 'sewer_trunk', label: 'Sewer Trunk Line', geometry: 'LineString', defaultRowM: 5 },

  { code: 'rising_main', label: 'Rising Main', geometry: 'LineString', defaultRowM: 6 },

  { code: 'reservoir', label: 'Reservoir / ESR / CWR', geometry: 'Polygon', defaultRowM: 10 },

  { code: 'pump_house', label: 'Pump House', geometry: 'Point', defaultRowM: 15 },

  { code: 'intake', label: 'Intake Structure', geometry: 'Point', defaultRowM: 20 },

  { code: 'wtp', label: 'Treatment Plant', geometry: 'Polygon', defaultRowM: 10 },

  { code: 'valve_chamber', label: 'Valve Chamber', geometry: 'Point', defaultRowM: 5 },

] as const;



export const LA_ALIGNMENT_FEATURE_CODES = [

  'la_alignment',

  'pipeline_alignment',

  'transmission_main',

  'distribution_main',

  'sewer_line',

  'sewer_trunk',

  'rising_main',

  'pipeline',

] as const;



export const LA_PARCEL_FEATURE_CODES = [

  'la_parcels',

  'cadastral_parcels',

  'land_parcels',

  'revenue_parcels',

  'khasra_boundary',

  'khata_boundary',

  'land_ownership',

] as const;



export {

  LA_STATUSES,

  LA_STATUS_ORDER,

  LA_WORKFLOW_PIPELINE,

  LA_WORKFLOW_TRANSITIONS,

  LA_DPR_STAGE3_MIN_STATUS,

  LA_DPR_STAGE8_MIN_STATUS,

  LA_LEGACY_STATUS_MAP,

  buildLaWorkflowProgress,

  getLaStatusLabel,

  getLaStageForStatus,

  laStatusAtLeast,

  normalizeLaStatus,

} from './la-workflow.constants';



export const LA_PARCEL_STATUSES = [

  'identified', 'surveyed', 'notified', 'awarded', 'paid', 'possession',

] as const;



import { LA_CLEARANCE_TYPES as LA_STATUTORY_CLEARANCE_TYPES } from './la-statutory-clearances.constants';



/** Statutory + supplemental clearance types exposed in catalog and UI */

export const LA_CLEARANCE_TYPES = [

  ...LA_STATUTORY_CLEARANCE_TYPES,

  { code: 'revenue', label: 'Revenue / Nazul / Government Land', authority: 'District Collector' },

  { code: 'state_highway', label: 'State Highway / PMGSY Crossing', authority: 'PWD / PMGSY' },

  { code: 'sensitive_site', label: 'Sensitive Institution (School / Hospital)', authority: 'District Administration' },

  { code: 'religious_site', label: 'Religious Site Buffer', authority: 'Local Body / Trust' },

  { code: 'structure_impact', label: 'Building / Structure Impact', authority: 'District Administration' },

  { code: 'landslide_risk', label: 'Landslide Risk Zone Review', authority: 'Disaster Management / Geology' },

] as const;


