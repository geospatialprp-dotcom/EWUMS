/** Statutory clearances for intelligent detection + proposal package generation */
export type LaStatutoryClearanceDef = {
  code: string;
  label: string;
  authority: string;
  overlayLayers: string[];
  overlayFeatureCodes: string[];
  parcelOwnership: string[];
  parcelPatterns: RegExp[];
  checklist: string[];
  forms: Array<{ code: string; name: string }>;
  documents: Array<{ code: string; name: string }>;
};

export const LA_STATUTORY_CLEARANCES: readonly LaStatutoryClearanceDef[] = [
  {
    code: 'forest_fca',
    label: 'Forest Clearance',
    authority: 'Forest Department / MoEF&CC',
    overlayLayers: ['forest_land', 'reserved_forest', 'protected_forest', 'civil_soyam_land', 'national_park'],
    overlayFeatureCodes: ['forest_land', 'reserved_forest', 'protected_forest', 'civil_soyam_land', 'van_panchayat', 'national_park'],
    parcelOwnership: ['forest_land', 'forest_department', 'civil_soyam', 'van_panchayat'],
    parcelPatterns: [/forest|soyam|van panchayat/i],
    checklist: ['Verify forest compartment map', 'Obtain DFO site inspection report', 'Prepare compensatory afforestation plan', 'Submit FCA proposal on PARIVESH'],
    forms: [{ code: 'fca_form_a', name: 'FCA Form A (Proposal)' }, { code: 'fca_form_c', name: 'FCA Form C (Work permit)' }],
    documents: [{ code: 'forest_map', name: 'Certified forest map' }, { code: 'kml_alignment', name: 'Alignment KML in forest area' }],
  },
  {
    code: 'pwd_noc',
    label: 'PWD NOC',
    authority: 'Public Works Department',
    overlayLayers: ['pwd_road'],
    overlayFeatureCodes: ['pwd_road', 'pwd_roads', 'district_road', 'state_highway', 'pmgsy_roads'],
    parcelOwnership: ['pwd'],
    parcelPatterns: [/pwd|public works/i],
    checklist: ['Submit crossing drawing', 'ROW width and depth details', 'Traffic management plan', 'Restoration bond if applicable'],
    forms: [{ code: 'pwd_crossing_noc', name: 'PWD Road Crossing NOC Application' }],
    documents: [{ code: 'cross_section', name: 'Cross-section drawing' }, { code: 'site_plan', name: 'Site plan at crossing' }],
  },
  {
    code: 'nhai_permission',
    label: 'NHAI Permission',
    authority: 'NHAI / Ministry of Road Transport',
    overlayLayers: ['national_highway'],
    overlayFeatureCodes: ['national_highway', 'nh', 'nh_network'],
    parcelOwnership: ['national_highway'],
    parcelPatterns: [/nhai|national highway|\bnh\b/i],
    checklist: ['NH crossing location chainage', 'Utility shifting plan', 'NHAI fee calculation', 'Insurance / bank guarantee'],
    forms: [{ code: 'nhai_utility_crossing', name: 'NHAI Utility Crossing Permission Form' }],
    documents: [{ code: 'nh_chainage_plan', name: 'Plan showing NH chainage' }, { code: 'structural_design', name: 'Crossing structural design' }],
  },
  {
    code: 'railway_crossing',
    label: 'Railway Crossing Approval',
    authority: 'Railway Authority / DRM Office',
    overlayLayers: ['railways'],
    overlayFeatureCodes: ['railways', 'railway', 'rail_line'],
    parcelOwnership: ['railway'],
    parcelPatterns: [/railway|rail/i],
    checklist: ['Railway zone classification', 'Crossing angle and clearance', 'RDSO drawing approval', 'Railway safety certificate'],
    forms: [{ code: 'railway_crossing_form', name: 'Railway Crossing Application (G&SR)' }],
    documents: [{ code: 'railway_alignment', name: 'Drawing w.r.t. railway alignment' }, { code: 'safety_plan', name: 'Construction safety plan' }],
  },
  {
    code: 'river_crossing',
    label: 'River Crossing Permission',
    authority: 'Irrigation / Jal Board / WRD',
    overlayLayers: ['river', 'lake', 'wetlands'],
    overlayFeatureCodes: ['river', 'rivers', 'stream', 'nadi', 'lake', 'wetlands'],
    parcelOwnership: [],
    parcelPatterns: [/river|nadi|wetland|stream/i],
    checklist: ['River bed / flood zone survey', 'Hydraulic clearance', 'Environmental safeguards', 'Monsoon construction plan'],
    forms: [{ code: 'river_crossing_noc', name: 'River / Water Body Crossing NOC' }],
    documents: [{ code: 'hydraulic_study', name: 'Hydraulic study report' }, { code: 'bathymetry', name: 'River cross-section survey' }],
  },
  {
    code: 'canal_crossing',
    label: 'Canal Crossing Permission',
    authority: 'Irrigation Department',
    overlayLayers: ['canal'],
    overlayFeatureCodes: ['canal', 'canals', 'irrigation_canal'],
    parcelOwnership: ['irrigation_department'],
    parcelPatterns: [/canal|irrigation/i],
    checklist: ['Canal ownership confirmation', 'Crossing method (HDD / open cut)', 'Canal restoration plan', 'Superintending Engineer approval'],
    forms: [{ code: 'canal_crossing_noc', name: 'Canal Crossing Permission Form' }],
    documents: [{ code: 'canal_crossing_drawing', name: 'Canal crossing drawing' }],
  },
  {
    code: 'electric_crossing',
    label: 'Electric Line Crossing Approval',
    authority: 'Power Transmission / DISCOM',
    overlayLayers: ['electric_line'],
    overlayFeatureCodes: ['electric_line', 'power_line', 'ht_line', 'lt_line'],
    parcelOwnership: [],
    parcelPatterns: [/electric|power line|ht line|discom/i],
    checklist: ['Voltage level identification', 'Vertical / horizontal clearance', 'Asset owner NOC', 'Earthing and safety plan'],
    forms: [{ code: 'electric_crossing_noc', name: 'Electric Line Crossing NOC' }],
    documents: [{ code: 'clearance_diagram', name: 'Clearance diagram' }],
  },
  {
    code: 'telecom_ofc_perm',
    label: 'Telecom OFC Permission',
    authority: 'Telecom Service Provider / DOT',
    overlayLayers: ['telecom_ofc'],
    overlayFeatureCodes: ['telecom_ofc', 'ofc', 'fiber_cable'],
    parcelOwnership: [],
    parcelPatterns: [/telecom|ofc|fiber/i],
    checklist: ['OFC route map', 'Joint trench / HDD plan', 'Service provider coordination', 'Restoration standards'],
    forms: [{ code: 'telecom_crossing_noc', name: 'Telecom OFC Crossing Permission' }],
    documents: [{ code: 'ofc_route_plan', name: 'OFC route plan' }],
  },
  {
    code: 'gas_pipeline_noc',
    label: 'Gas Pipeline NOC',
    authority: 'Gas Utility / PNGRB',
    overlayLayers: ['gas_pipeline'],
    overlayFeatureCodes: ['gas_pipeline', 'png_pipeline'],
    parcelOwnership: [],
    parcelPatterns: [/gas pipeline|png|city gas/i],
    checklist: ['Pipeline depth and alignment', 'Safety distance compliance', 'Crossing methodology', 'Emergency response plan'],
    forms: [{ code: 'gas_crossing_noc', name: 'Gas Pipeline Crossing NOC' }],
    documents: [{ code: 'gas_safety_plan', name: 'Pipeline safety plan' }],
  },
  {
    code: 'airport_noc',
    label: 'Airport Authority NOC',
    authority: 'Airport Authority of India / DGCA',
    overlayLayers: ['airport_zone', 'airport'],
    overlayFeatureCodes: ['airport_zone', 'airport', 'aai_obstacle', 'flight_path'],
    parcelOwnership: [],
    parcelPatterns: [/airport|aai|dgca|flight path/i],
    checklist: ['Obstacle limitation surface check', 'Height clearance survey', 'AAI aeronautical study', 'DGCA no-objection if applicable'],
    forms: [{ code: 'aai_noc_form', name: 'AAI NOC Application Form' }],
    documents: [{ code: 'height_certificate', name: 'Height certificate from licensed surveyor' }],
  },
  {
    code: 'municipality_permission',
    label: 'Municipality Permission',
    authority: 'Municipal Corporation / Nagar Palika',
    overlayLayers: [],
    overlayFeatureCodes: ['municipality_land', 'municipal', 'ulb_land'],
    parcelOwnership: ['municipality'],
    parcelPatterns: [/municipal|nagar palika|nagar nigam|ulb/i],
    checklist: ['Urban land use approval', 'Road cutting permission', 'Restoration deposit', 'Traffic / public utility coordination'],
    forms: [{ code: 'municipal_noc', name: 'Municipal NOC Application' }],
    documents: [{ code: 'ward_map', name: 'Ward / municipal map extract' }],
  },
  {
    code: 'gram_panchayat_resolution',
    label: 'Gram Panchayat Resolution',
    authority: 'Gram Panchayat / Gram Sabha',
    overlayLayers: ['gram_sabha_land'],
    overlayFeatureCodes: ['gram_sabha_land', 'gram_sabha', 'panchayat_land'],
    parcelOwnership: ['gram_sabha', 'van_panchayat'],
    parcelPatterns: [/gram sabha|panchayat|van panchayat/i],
    checklist: ['Gram Sabha meeting notice', 'Resolution for utility laying', 'Public hearing if required', 'Signed resolution copy'],
    forms: [{ code: 'gp_resolution', name: 'Gram Panchayat Resolution Format' }],
    documents: [{ code: 'gram_sabha_minutes', name: 'Gram Sabha meeting minutes' }],
  },
  {
    code: 'pollution_clearance',
    label: 'Pollution Clearance',
    authority: 'State Pollution Control Board',
    overlayLayers: ['eco_sensitive_zones'],
    overlayFeatureCodes: ['eco_sensitive_zones', 'esz', 'industrial_zone'],
    parcelOwnership: [],
    parcelPatterns: [/pollution|spcb|consent to establish/i],
    checklist: ['Consent to Establish / Operate applicability', 'Emission / discharge assessment', 'Construction phase pollution plan'],
    forms: [{ code: 'spcb_consent', name: 'SPCB Consent Application' }],
    documents: [{ code: 'emp_report', name: 'Environmental management plan' }],
  },
  {
    code: 'wildlife_clearance',
    label: 'Wildlife Clearance',
    authority: 'Chief Wildlife Warden / NBWL',
    overlayLayers: ['wildlife_sanctuary', 'national_park'],
    overlayFeatureCodes: ['wildlife_sanctuary', 'sanctuary', 'national_park', 'ws_boundary'],
    parcelOwnership: ['forest_land', 'forest_department'],
    parcelPatterns: [/wildlife|sanctuary|national park/i],
    checklist: ['NBWL standing committee applicability', 'Wildlife management plan', 'Mitigation measures', 'Seasonal restriction review'],
    forms: [{ code: 'wildlife_clearance', name: 'Wildlife Clearance Proposal Form' }],
    documents: [{ code: 'wildlife_map', name: 'Sanctuary / NP boundary map' }],
  },
  {
    code: 'environmental_clearance',
    label: 'Environmental Clearance',
    authority: 'SEIAA / MoEF&CC',
    overlayLayers: ['wetlands', 'eco_sensitive_zones'],
    overlayFeatureCodes: ['wetlands', 'wetland', 'eco_sensitive_zones', 'esz', 'ramsar'],
    parcelOwnership: [],
    parcelPatterns: [/environment|wetland|eco sensitive|esz/i],
    checklist: ['EIA notification category check', 'TOR from SEAC', 'Public hearing if Category A/B', 'EMP and monitoring plan'],
    forms: [{ code: 'ec_form_1', name: 'EC Application Form 1' }, { code: 'parivesh_ec', name: 'PARIVESH EC Proposal' }],
    documents: [{ code: 'eia_report', name: 'EIA / EMP report' }, { code: 'baseline_data', name: 'Baseline environmental data' }],
  },
  {
    code: 'archaeological_clearance',
    label: 'Archaeological Clearance',
    authority: 'Archaeological Survey of India (ASI)',
    overlayLayers: ['archaeological_sites', 'temples'],
    overlayFeatureCodes: ['archaeological_sites', 'asi_monument', 'heritage_site', 'temples', 'temple'],
    parcelOwnership: ['religious_trust'],
    parcelPatterns: [/asi|monument|archaeological|heritage|protected monument/i],
    checklist: ['ASI protected monument proximity check', 'NMA permission if heritage site', 'Chance find protocol', 'Buffer zone compliance'],
    forms: [{ code: 'asi_noc', name: 'ASI NOC Application' }, { code: 'nma_permission', name: 'NMA Permission (if applicable)' }],
    documents: [{ code: 'heritage_map', name: 'ASI / heritage site map' }],
  },
] as const;

export const LA_CLEARANCE_TYPES = LA_STATUTORY_CLEARANCES.map((c) => ({
  code: c.code,
  label: c.label,
  authority: c.authority,
}));

export function findStatutoryClearance(code: string) {
  return LA_STATUTORY_CLEARANCES.find((c) => c.code === code);
}

export function mapOverlayToClearance(layerCode: string, featureClassCode?: string): string | null {
  const normalized = layerCode.toLowerCase();
  const fc = featureClassCode?.toLowerCase() ?? '';
  for (const def of LA_STATUTORY_CLEARANCES) {
    if (def.overlayLayers.includes(normalized)) return def.code;
    if (def.overlayFeatureCodes.some((a) => a === fc || a === normalized)) return def.code;
  }
  return null;
}

export function mapLegacyClearanceType(code: string): string {
  const legacy: Record<string, string> = {
    nh_crossing: 'nhai_permission',
    pwd_crossing: 'pwd_noc',
    railway: 'railway_crossing',
    irrigation: 'canal_crossing',
    panchayat: 'gram_panchayat_resolution',
    asi_monument: 'archaeological_clearance',
    environment: 'environmental_clearance',
    wildlife_protected: 'wildlife_clearance',
    utility_crossing: 'electric_crossing',
    river_crossing: 'river_crossing',
    forest_fca: 'forest_fca',
  };
  return legacy[code] ?? code;
}
