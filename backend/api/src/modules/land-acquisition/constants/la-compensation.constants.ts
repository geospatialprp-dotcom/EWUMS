/** Statutory compensation parameters (RFCTLARR Act 2013 aligned) */
export const LA_COMPENSATION_RATES = {
  /** Default circle / guideline rate per m² when not on parcel */
  defaultCircleRatePerSqm: 500,
  /** Market rate = circle rate × multiplier when market rate not supplied */
  marketRateMultiplier: 1.25,
  /** Solatium = 100% of land compensation */
  solatiumRate: 1.0,
  /** Additional compensation: 12% per annum for 3 years */
  additionalCompAnnualRate: 0.12,
  additionalCompYears: 3,
  /** Statutory interest on delayed payment (9% p.a.) */
  interestAnnualRate: 0.09,
  /** Assumed pending period (years) for interest estimate */
  interestPendingYears: 1,
  /** Rehabilitation & resettlement base per affected owner (INR) */
  rehabilitationPerOwner: 500000,
  /** Easement ROW compensation factor (partial acquisition) */
  easementFactor: 0.35,
  /** Temporary acquisition compensation factor */
  temporaryFactor: 0.25,
} as const;

export const LA_COMPENSATION_ATTR_ALIASES = {
  marketRate: ['market_rate', 'marketRate', 'market_value_per_sqm', 'collector_rate'],
  treeValue: ['tree_value', 'treeValue', 'tree_compensation', 'trees_value', 'treesValue'],
  cropValue: ['crop_value', 'cropValue', 'crop_compensation', 'crops_value', 'cropsValue'],
  structureValue: ['structure_value', 'structureValue', 'building_value', 'buildingValue', 'structure_compensation'],
  treeCount: ['tree_count', 'treeCount', 'no_of_trees'],
  cropArea: ['crop_area', 'cropArea', 'crop_area_sqm'],
} as const;

export const LA_COMPENSATION_COMPONENTS = [
  { code: 'circle_rate', label: 'Circle Rate (₹/m²)' },
  { code: 'market_rate', label: 'Market Rate (₹/m²)' },
  { code: 'area', label: 'Affected Area (m²)' },
  { code: 'land_compensation', label: 'Land Compensation' },
  { code: 'solatium', label: 'Solatium (100%)' },
  { code: 'additional_compensation', label: 'Additional Compensation (12% × 3 yr)' },
  { code: 'tree_compensation', label: 'Tree Compensation' },
  { code: 'crop_compensation', label: 'Crop Compensation' },
  { code: 'structure_compensation', label: 'Structure Compensation' },
  { code: 'total_compensation', label: 'Total Compensation' },
  { code: 'interest', label: 'Interest (9% p.a.)' },
  { code: 'rehabilitation_cost', label: 'Rehabilitation Cost' },
  { code: 'total_acquisition_cost', label: 'Total Acquisition Cost' },
] as const;
