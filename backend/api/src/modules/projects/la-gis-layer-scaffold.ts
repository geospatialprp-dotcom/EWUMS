import type { AttributeField, GeometryType } from './entities/project-feature-class.entity';
import {
  LA_GIS_LAYER_CATEGORIES,
  LA_GIS_OVERLAY_LAYERS,
  type LaGisLayerDef,
  type LaGisLayerCategory,
} from '../land-acquisition/constants/la-gis-layers.constants';

const CATEGORY_SORT: Record<LaGisLayerCategory, number> = {
  administrative: 100,
  cadastral: 200,
  land_tenure: 300,
  infrastructure: 400,
  sensitive_sites: 500,
  environment: 600,
  terrain: 700,
};

export type LaGisScaffoldTemplate = {
  code: string;
  name: string;
  description: string;
  geometryType: GeometryType;
  attributeSchema: AttributeField[];
  sortOrder: number;
  laLayerCode?: string;
};

export function resolveLaLayerGeometryType(
  types: Array<'Point' | 'LineString' | 'Polygon'>,
): GeometryType {
  if (types.length === 1) return types[0];
  return 'Any';
}

function attributeSchemaForLayer(layer: LaGisLayerDef): AttributeField[] {
  if (layer.category === 'cadastral' || ['khasra_boundary', 'land_ownership', 'khata_boundary'].includes(layer.code)) {
    return [
      { name: 'khasra_no', label: 'Khasra No.', type: 'text' },
      { name: 'khata_no', label: 'Khata No.', type: 'text' },
      { name: 'village', label: 'Village', type: 'text' },
      { name: 'tehsil', label: 'Tehsil', type: 'text' },
      { name: 'district', label: 'District', type: 'text' },
      { name: 'owner_name', label: 'Owner Name', type: 'text' },
      { name: 'land_use', label: 'Land Use', type: 'text' },
      { name: 'land_class', label: 'Land Class', type: 'text' },
      { name: 'circle_rate', label: 'Circle Rate (₹/m²)', type: 'number' },
    ];
  }
  if (layer.category === 'land_tenure') {
    return [
      { name: 'name', label: 'Name', type: 'text' },
      { name: 'tenure_type', label: 'Tenure Type', type: 'text' },
      { name: 'land_use', label: 'Land Use', type: 'text' },
    ];
  }
  if (layer.category === 'administrative') {
    return [
      { name: 'name', label: 'Name', type: 'text' },
      { name: 'admin_code', label: 'Admin Code', type: 'text' },
    ];
  }
  if (layer.category === 'infrastructure') {
    return [
      { name: 'name', label: 'Name', type: 'text' },
      { name: 'asset_owner', label: 'Asset Owner', type: 'text' },
    ];
  }
  return [{ name: 'name', label: 'Name', type: 'text' }];
}

export function buildLaGisScaffoldTemplates(): LaGisScaffoldTemplate[] {
  const templates: LaGisScaffoldTemplate[] = [
    {
      code: 'la_alignment',
      name: 'LA Pipeline Alignment',
      description: 'Pipeline / transmission route for land acquisition (digitize manually or use Auto Route)',
      geometryType: 'LineString',
      attributeSchema: [
        { name: 'source', label: 'Source', type: 'text' },
        { name: 'chainage_from', label: 'Chainage From (m)', type: 'number' },
        { name: 'chainage_to', label: 'Chainage To (m)', type: 'number' },
      ],
      sortOrder: 10,
      laLayerCode: 'la_alignment',
    },
  ];

  let index = 0;
  for (const category of LA_GIS_LAYER_CATEGORIES) {
    const layers = LA_GIS_OVERLAY_LAYERS.filter((l) => l.category === category.code);
    for (const layer of layers) {
      index += 1;
      templates.push({
        code: layer.featureClassCodes[0],
        name: layer.label,
        description: `Land Acquisition GIS overlay — ${layer.label} (${category.label})`,
        geometryType: resolveLaLayerGeometryType(layer.geometryTypes),
        attributeSchema: attributeSchemaForLayer(layer),
        sortOrder: CATEGORY_SORT[layer.category] + index,
        laLayerCode: layer.code,
      });
    }
  }

  return templates;
}

export function findExistingLaLayerAlias(
  layer: LaGisLayerDef,
  existingCodes: Set<string>,
): string | null {
  for (const alias of layer.featureClassCodes) {
    if (existingCodes.has(alias.toLowerCase())) return alias;
  }
  return null;
}
