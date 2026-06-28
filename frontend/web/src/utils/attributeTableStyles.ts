import type { AttributeField } from '../services/api';

export const ATTRIBUTE_TABLE_INDEX_WIDTH = 40;
export const ATTRIBUTE_TABLE_LOC_WIDTH = 52;
export const ATTRIBUTE_TABLE_IMAGE_WIDTH = 56;

export function isIconAttributeField(field: AttributeField) {
  return field.type === 'image' || field.type === 'boolean';
}

export function attributeColumnWidth(
  field: AttributeField,
  coordFieldNames?: Set<string>,
): number {
  if (field.type === 'image') return ATTRIBUTE_TABLE_IMAGE_WIDTH;
  if (field.type === 'boolean') return 52;
  if (field.type === 'date') return 108;
  if (field.type === 'number' || field.type === 'integer') return 88;
  if (field.type === 'select') return 120;
  if (coordFieldNames?.has(field.name)) return 100;

  const label = (field.label || field.name).toLowerCase();
  const name = field.name.toLowerCase();
  if (label.includes('remark') || name.includes('remark') || name.includes('description')) {
    return 168;
  }
  if (label.length <= 5 || name.length <= 5) return 88;
  return 128;
}

export function isFlexibleAttributeColumn(
  field: AttributeField,
  coordFieldNames?: Set<string>,
): boolean {
  if (field.type === 'image' || field.type === 'boolean') return false;
  if (coordFieldNames?.has(field.name)) return false;

  const label = (field.label || field.name).toLowerCase();
  const name = field.name.toLowerCase();
  return label.includes('remark')
    || name.includes('remark')
    || name.includes('description')
    || name.includes('name')
    || label.includes('name');
}

export function pickFlexibleAttributeField(
  schema: AttributeField[],
  coordFieldNames?: Set<string>,
): AttributeField | null {
  const explicit = schema.find((field) => isFlexibleAttributeColumn(field, coordFieldNames));
  if (explicit) return explicit;

  const textFields = schema.filter(
    (field) => field.type === 'text' || field.type === 'select',
  );
  return textFields[textFields.length - 1] ?? null;
}

export const attributeTableSx = {
  tableLayout: 'auto' as const,
  width: 'max-content',
  minWidth: '100%',
};

export type LayerGeometryTheme = {
  headerBg: string;
  headerColor: string;
  headerBorder: string;
  accent: string;
  panelBg: string;
  panelBorder: string;
};

export function attributeTableTheme(geometryType?: string): LayerGeometryTheme {
  switch (geometryType) {
    case 'Point':
      return {
        headerBg: 'linear-gradient(180deg, #fff7ed 0%, #ffedd5 100%)',
        headerColor: '#9a3412',
        headerBorder: '#fb923c',
        accent: '#ea580c',
        panelBg: 'linear-gradient(90deg, #fff7ed 0%, #fafbfc 48%)',
        panelBorder: '#fdba74',
      };
    case 'LineString':
      return {
        headerBg: 'linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%)',
        headerColor: '#1e3a8a',
        headerBorder: '#60a5fa',
        accent: '#2563eb',
        panelBg: 'linear-gradient(90deg, #eff6ff 0%, #fafbfc 48%)',
        panelBorder: '#93c5fd',
      };
    case 'Polygon':
      return {
        headerBg: 'linear-gradient(180deg, #ecfdf5 0%, #d1fae5 100%)',
        headerColor: '#065f46',
        headerBorder: '#34d399',
        accent: '#059669',
        panelBg: 'linear-gradient(90deg, #ecfdf5 0%, #fafbfc 48%)',
        panelBorder: '#6ee7b7',
      };
    default:
      return {
        headerBg: 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)',
        headerColor: '#334155',
        headerBorder: '#94a3b8',
        accent: '#64748b',
        panelBg: '#fafbfc',
        panelBorder: '#cbd5e1',
      };
  }
}

export function attributeHeaderCellSxForGeometry(geometryType?: string) {
  const theme = attributeTableTheme(geometryType);
  return {
    fontWeight: 700,
    fontSize: '0.6875rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.055em',
    color: theme.headerColor,
    background: theme.headerBg,
    borderBottom: `2px solid ${theme.headerBorder}`,
    py: 0.9,
    px: 1,
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.65)',
  };
}

export function attributePanelHeaderSx(geometryType?: string) {
  const theme = attributeTableTheme(geometryType);
  return {
    borderBottom: 1,
    borderColor: 'divider',
    background: theme.panelBg,
    minHeight: 44,
    borderLeft: `4px solid ${theme.accent}`,
    boxShadow: `inset 0 -1px 0 ${theme.panelBorder}33`,
  };
}

export function attributeHeaderCellWidth(
  field: AttributeField,
  coordFieldNames?: Set<string>,
  _flexibleFieldName?: string | null,
) {
  const width = attributeColumnWidth(field, coordFieldNames);
  return { width, maxWidth: width, minWidth: width };
}

export const attributeHeaderCellSx = {
  fontWeight: 600,
  fontSize: '0.7rem',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.04em',
  color: 'text.secondary',
  bgcolor: '#f1f5f9',
  borderBottom: 1,
  borderColor: 'divider',
  py: 0.5,
  px: 1,
  whiteSpace: 'nowrap' as const,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

export const attributeIconCellSx = {
  px: 0.75,
  py: 0.5,
  textAlign: 'center' as const,
  verticalAlign: 'middle' as const,
};

export const attributeTableRowSx = {
  '& td': {
    borderColor: 'divider',
    py: 0.5,
    verticalAlign: 'middle',
    height: 36,
  },
};

export function attributeBodyCellSx(
  field: AttributeField,
  coordFieldNames?: Set<string>,
  extra?: Record<string, unknown>,
  _flexibleFieldName?: string | null,
) {
  const width = attributeColumnWidth(field, coordFieldNames);
  return {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    px: 1,
    py: 0.5,
    verticalAlign: 'middle' as const,
    width,
    maxWidth: width,
    minWidth: width,
    ...extra,
  };
}

export const attributeCellFieldSx = {
  '& .MuiOutlinedInput-root': {
    fontSize: '0.8125rem',
    bgcolor: 'transparent',
    borderRadius: 1,
    minHeight: 28,
  },
  '& .MuiOutlinedInput-input': {
    paddingTop: '4px',
    paddingBottom: '4px',
    paddingLeft: '2px',
    paddingRight: '2px',
    textOverflow: 'ellipsis',
  },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' },
  '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: 'divider',
  },
  '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: 'primary.main',
    borderWidth: 1,
  },
  width: '100%',
  maxWidth: '100%',
};
