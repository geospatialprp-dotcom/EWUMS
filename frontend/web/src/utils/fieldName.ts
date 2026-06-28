import type { AttributeField } from '../services/api';

/** Convert user text to a valid lowercase snake_case identifier for API fields. */
export function toSnakeCaseIdentifier(value: string, fallback = 'field'): string {
  let id = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!id) return fallback;
  if (!/^[a-z]/.test(id)) {
    id = `${fallback}_${id}`.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  }
  return id || fallback;
}

/** Normalize attribute schema before create/update so backend validation always passes. */
export function prepareAttributeSchema(fields: AttributeField[]): AttributeField[] {
  const used = new Set<string>();
  const prepared: AttributeField[] = [];

  fields.forEach((field, index) => {
    const label = field.label.trim();
    const rawName = field.name.trim();
    if (!label && !rawName) return;

    let name = rawName
      ? toSnakeCaseIdentifier(rawName, `field_${index + 1}`)
      : toSnakeCaseIdentifier(label, `field_${index + 1}`);

    let candidate = name;
    let suffix = 2;
    while (used.has(candidate)) {
      candidate = `${name}_${suffix}`;
      suffix += 1;
    }
    used.add(candidate);

    prepared.push({
      ...field,
      name: candidate,
      label: label || rawName,
    });
  });

  return prepared;
}
