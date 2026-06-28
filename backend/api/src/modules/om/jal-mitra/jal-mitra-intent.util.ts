export type JalMitraIntent =
  | 'greeting'
  | 'language_switch'
  | 'verify'
  | 'bill_status'
  | 'complaint_register'
  | 'complaint_status'
  | 'supply_timing'
  | 'tariff'
  | 'connection_info'
  | 'contact'
  | 'escalate'
  | 'quick_action'
  | 'unknown';

export const INTENT_KB_CATEGORY: Partial<Record<JalMitraIntent, string>> = {
  bill_status: 'billing',
  complaint_register: 'complaint',
  complaint_status: 'complaint',
  supply_timing: 'supply',
  tariff: 'tariff',
  connection_info: 'connection',
  contact: 'contact',
};

export function isGreetingOnly(text: string): boolean {
  const s = text.trim();
  if (!s || s.length > 48) return false;
  return /^(hi|hello|hey|namaste|नमस्ते|नमस्कार|jal\s*mitra|जल\s*मित्र)[!.?\s]*$/i.test(s);
}

function scoreIntent(text: string): Array<{ intent: JalMitraIntent; score: number }> {
  const s = text.toLowerCase();
  const scores: Partial<Record<JalMitraIntent, number>> = {};

  const add = (intent: JalMitraIntent, score: number) => {
    scores[intent] = (scores[intent] ?? 0) + score;
  };

  if (/complaint status|शिकायत.*स्थिति|ticket status|टिकट.*स्थिति/i.test(s)) add('complaint_status', 20);
  if (/bill|बिल|बैर|बकाया|outstanding|due date|देय|भुगतान|payment|मेरो बिल|मेरा बिल|मेरो बैर/i.test(s)) {
    add('bill_status', 15);
  }
  if (/पाणी कब|पानी कब|supply timing|पाणी समय|पानी समय|supply hour|कब मिलू|कब मिले/i.test(s)) {
    add('supply_timing', 14);
  }
  if (/tariff|टैरिफ|rate|दर|slab|खपत/i.test(s)) add('tariff', 14);
  if (/new connection|नयो कनेक्शन|नय कनेक्शन|नया कनेक्शन|fhtc.*application|आवेदन/i.test(s)) {
    add('connection_info', 14);
  }
  if (/verify|otp|fhtc|सत्यापन|रजिस्टर.*मोबाइल/i.test(s)) add('verify', 13);
  if (/escalat|अधिकारी|officer|je|ae|ee|engineer|इंजीनियर/i.test(s)) add('escalate', 12);
  if (/helpline|संपर्क|call centre|फोन नंबर|phone number/i.test(s)) add('contact', 12);
  if (/language|भाषा|english|hindi|garhwali|kumaoni|गढ़वाली|कुमाऊनी/i.test(s)) {
    add('language_switch', 12);
  }
  if (/no water|पानी नहीं|पाणी नी|पाणी नीं|पाणी नाही|पाणी ना मिल|leak|leakage|टपक|पाइप|पाइपा|टंकी|pressure|दबाव/i.test(s)) {
    add('complaint_register', 11);
  }
  if (/शिकायत|complaint|register complaint/i.test(s)) add('complaint_register', 10);

  return Object.entries(scores)
    .map(([intent, score]) => ({ intent: intent as JalMitraIntent, score }))
    .sort((a, b) => b.score - a.score);
}

export function detectIntent(text: string, quickActionId?: string): JalMitraIntent {
  if (quickActionId) {
    const map: Record<string, JalMitraIntent> = {
      bill: 'bill_status',
      complaint: 'complaint_register',
      complaint_status: 'complaint_status',
      supply: 'supply_timing',
      tariff: 'tariff',
      connection: 'connection_info',
      escalate: 'escalate',
      language: 'language_switch',
    };
    return map[quickActionId] ?? 'unknown';
  }

  if (isGreetingOnly(text)) return 'greeting';

  const ranked = scoreIntent(text);
  if (ranked.length > 0 && ranked[0].score >= 10) return ranked[0].intent;

  if (/मदद|सहायता|help|कै मदद|की मदद/i.test(text) && ranked.length === 0) return 'unknown';

  return ranked[0]?.intent ?? 'unknown';
}

export function mapComplaintType(text: string): string {
  const s = text.toLowerCase();
  if (/no water|पानी नहीं|पाणी नी|पाणी नीं|पाणी नाही|supply band|पाणी ना मिल|पाणी ना आन्द/i.test(s)) {
    return 'no_water_supply';
  }
  if (/pressure|दबाव|kam daba|कम दबाव/i.test(s)) return 'low_pressure';
  if (/leak|टपक|pipe|पाइप|पाइपा|नळ/i.test(s)) return 'leakage';
  if (/quality|गंदा|dirty|contamin|गन्दा/i.test(s)) return 'water_quality_issue';
  if (/bill|बिल|बैर|billing/i.test(s)) return 'billing_issue';
  if (/meter|मीटर/i.test(s)) return 'meter_issue';
  return 'no_water_supply';
}
