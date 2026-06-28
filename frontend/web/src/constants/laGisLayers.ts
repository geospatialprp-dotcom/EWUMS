export const LA_GIS_LAYER_CATEGORY_LABELS: Record<string, string> = {
  administrative: 'Administrative Boundaries',
  cadastral: 'Cadastral & Ownership',
  land_tenure: 'Land Tenure',
  infrastructure: 'Infrastructure Crossings',
  sensitive_sites: 'Sensitive Sites',
  environment: 'Environment & Forest',
  terrain: 'Terrain & Hazard',
};

export type LaLayerReadinessRow = {
  code: string;
  label: string;
  category: string;
  geometryTypes: string[];
  featureClassCodes: string[];
  clearanceType?: string | null;
  requiredForOverlay: boolean;
  analysisMode: string;
  configured: boolean;
  featureClassCode?: string | null;
  featureClassName?: string | null;
  suggestedCode: string;
};

export function layerReadinessSummary(rows: LaLayerReadinessRow[]) {
  const required = rows.filter((r) => r.requiredForOverlay);
  const configuredRequired = required.filter((r) => r.configured);
  return {
    total: rows.length,
    configured: rows.filter((r) => r.configured).length,
    requiredTotal: required.length,
    requiredConfigured: configuredRequired.length,
    missingRequired: required.filter((r) => !r.configured),
  };
}
