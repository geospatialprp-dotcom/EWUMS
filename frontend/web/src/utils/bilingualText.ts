export type BilingualText = {
  en: string;
  hi: string;
};

export const EMPTY_BILINGUAL: BilingualText = { en: '', hi: '' };

export function parseBilingualText(raw: string): BilingualText {
  const text = raw?.trim() ?? '';
  if (!text) return { ...EMPTY_BILINGUAL };

  const hiMarker = '\n\n[HI]\n';
  const hiIndex = text.indexOf(hiMarker);
  if (hiIndex >= 0) {
    return {
      en: text.slice(0, hiIndex).trim(),
      hi: text.slice(hiIndex + hiMarker.length).trim(),
    };
  }

  if (text.startsWith('[HI] ')) {
    return { en: '', hi: text.slice(5).trim() };
  }

  return { en: text, hi: '' };
}

export function serializeBilingualText(value: BilingualText): string {
  const en = value.en.trim();
  const hi = value.hi.trim();
  if (!en && !hi) return '';
  if (!en) return `[HI] ${hi}`;
  if (!hi) return en;
  return `${en}${'\n\n[HI]\n'}${hi}`;
}

export function hasBilingualContent(value: BilingualText): boolean {
  return Boolean(value.en.trim() || value.hi.trim());
}
