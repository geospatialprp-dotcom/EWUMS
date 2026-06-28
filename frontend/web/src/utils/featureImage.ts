import type { AttributeField } from '../services/api';

export const FEATURE_IMAGE_DEFAULT_FIELD = 'feature_image';
export const MAX_FEATURE_IMAGE_BYTES = 2 * 1024 * 1024;

export function resolveFeatureImageField(schema?: AttributeField[]) {
  return schema?.find((field) => field.type === 'image') ?? null;
}

export function resolveFeatureImageFieldName(schema?: AttributeField[]) {
  return resolveFeatureImageField(schema)?.name ?? FEATURE_IMAGE_DEFAULT_FIELD;
}

export function getFeatureImageUrl(
  attributes: Record<string, unknown>,
  schema?: AttributeField[],
): string | null {
  const imageField = resolveFeatureImageField(schema);
  if (imageField) {
    const value = attributes[imageField.name];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }

  const fallbackKeys = [
    FEATURE_IMAGE_DEFAULT_FIELD,
    'image',
    'photo',
    'picture',
    'img',
    'image_url',
    'photo_url',
    'thumbnail',
  ];
  for (const key of fallbackKeys) {
    const value = attributes[key];
    if (typeof value === 'string' && value.trim()) {
      const trimmed = value.trim();
      if (trimmed.startsWith('http') || trimmed.startsWith('data:image/')) {
        return trimmed;
      }
    }
  }

  for (const [key, value] of Object.entries(attributes)) {
    if (typeof value !== 'string' || !value.trim()) continue;
    if (/image|photo|picture|img/i.test(key)) {
      const trimmed = value.trim();
      if (trimmed.startsWith('http') || trimmed.startsWith('data:image/')) {
        return trimmed;
      }
    }
  }

  return null;
}

export function readImageFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    return Promise.reject(new Error('Please choose an image file (JPG, PNG, WebP, etc.).'));
  }
  if (file.size > MAX_FEATURE_IMAGE_BYTES) {
    return Promise.reject(new Error('Image must be 2 MB or smaller.'));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Could not read image file.'));
    };
    reader.onerror = () => reject(new Error('Could not read image file.'));
    reader.readAsDataURL(file);
  });
}

export function isValidImageValue(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false;
  const trimmed = value.trim();
  return trimmed.startsWith('http://')
    || trimmed.startsWith('https://')
    || trimmed.startsWith('data:image/');
}
