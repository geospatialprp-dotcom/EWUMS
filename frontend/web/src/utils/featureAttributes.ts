import type { AttributeField } from '../services/api';

export function coerceAttributeValue(field: AttributeField, raw: string | boolean): unknown {
  if (field.type === 'number' || field.type === 'integer') return Number(raw);
  if (field.type === 'boolean') return raw === true || raw === 'true';
  if (field.type === 'image') return String(raw);
  return raw;
}

export function emptyAttributesForSchema(schema: AttributeField[]): Record<string, unknown> {
  const attrs: Record<string, unknown> = {};
  schema.forEach((field) => {
    attrs[field.name] = field.type === 'boolean' ? false : '';
  });
  return attrs;
}
