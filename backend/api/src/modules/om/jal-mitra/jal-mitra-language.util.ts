import { JalMitraLang } from './jal-mitra-i18n';

const GARHWALI_MARKERS = [
  'मेरो', 'तुमारो', 'छौ', 'छै', 'कै', 'काँ', 'गढ़वाल', 'गढवाल', 'पाणी', 'बताओ', 'हो ग्यो', 'हो गयो',
  'नीं', 'चाहिय', 'बोलूँल', 'बोलूंल', 'कू', 'मां', 'आन्दै', 'खिल्यो', 'ह्वै', 'कित्ती', 'कित्तु',
  'तुमार', 'मदद', 'सहायता', 'बैर', 'टंकी', 'नळ', 'पाइप',
];

const KUMAONI_MARKERS = [
  'तुमार', 'भयो', 'बताउ', 'कुमाऊ', 'कुमाउनी', 'पाणी', 'नी', 'चाह', 'ह्वै', 'कियो', 'मिल्यो',
  'कछु', 'बोलूँल', 'बोलूंल', 'कू', 'मां', 'मेरो', 'बैर', 'टंकी', 'आन्दै', 'खिल्यो',
];

function scoreMarkers(text: string, markers: string[]): number {
  let score = 0;
  for (const marker of markers) {
    if (text.includes(marker)) score += 1;
  }
  return score;
}

export function detectLanguage(text: string, current?: JalMitraLang): JalMitraLang {
  const switched = parseLanguageSwitch(text);
  if (switched) return switched;

  const lower = text.toLowerCase().trim();
  if (/^(english|en)\b/i.test(lower)) return 'en';
  if (/^(hindi|hi|हिंदी|हिन्दी)\b/i.test(lower)) return 'hi';
  if (/^(garhwali|गढ़वाली|gadhwali)\b/i.test(lower)) return 'garhwali';
  if (/^(kumaoni|कुमाऊनी|kumauni)\b/i.test(lower)) return 'kumaoni';

  if (/[\u0900-\u097F]/.test(text)) {
    const garhwaliScore = scoreMarkers(text, GARHWALI_MARKERS);
    const kumaoniScore = scoreMarkers(text, KUMAONI_MARKERS);
    if (garhwaliScore > kumaoniScore && garhwaliScore > 0) return 'garhwali';
    if (kumaoniScore > garhwaliScore && kumaoniScore > 0) return 'kumaoni';
    if (current === 'garhwali' || current === 'kumaoni') return current;
    return 'hi';
  }
  if (/[a-z]/i.test(text)) return 'en';
  return current ?? 'garhwali';
}

/** Keeps Garhwali/Kumaoni when consumer chose that language in the chat UI. */
export function resolveSessionLanguage(
  text: string,
  current: JalMitraLang,
  clientLanguage?: JalMitraLang,
): JalMitraLang {
  const switched = parseLanguageSwitch(text);
  if (switched) return switched;

  const lower = text.toLowerCase().trim();
  if (/^(english|en)\b/i.test(lower)) return 'en';
  if (/^(hindi|hi|हिंदी|हिन्दी)\b/i.test(lower)) return 'hi';

  const preferred = clientLanguage && isLocalDialect(clientLanguage) ? clientLanguage : current;
  if (isLocalDialect(preferred)) {
    return detectLanguage(text, preferred);
  }
  return detectLanguage(text, current);
}

export function parseLanguageSwitch(text: string): JalMitraLang | null {
  const m = text.trim().toLowerCase();
  if (m.includes('english') || m === 'en') return 'en';
  if (m.includes('hindi') || m === 'hi' || m.includes('हिंदी') || m.includes('हिन्दी')) return 'hi';
  if (m.includes('garhwali') || m.includes('गढ़वाली') || m.includes('गढवाली')) return 'garhwali';
  if (m.includes('kumaoni') || m.includes('कुमाऊनी') || m.includes('कुमाउनी')) return 'kumaoni';
  return null;
}

export function isLocalDialect(language: JalMitraLang): boolean {
  return language === 'garhwali' || language === 'kumaoni';
}
