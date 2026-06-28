export type JalMitraLang = 'en' | 'hi' | 'garhwali' | 'kumaoni';

type MsgKey =
  | 'welcome'
  | 'language_switched'
  | 'language_choose'
  | 'verify_prompt'
  | 'verify_otp_hint'
  | 'verified_ok'
  | 'bill_summary'
  | 'no_bills'
  | 'complaint_registered'
  | 'complaint_status'
  | 'no_complaints'
  | 'escalated'
  | 'fallback'
  | 'quick_actions_hint'
  | 'supply_timing'
  | 'tariff_info'
  | 'contact_division'
  | 'auth_required';

const MESSAGES: Record<JalMitraLang, Record<MsgKey, string>> = {
  en: {
    welcome: 'Namaste! I am Jal Mitra, your 24×7 water supply assistant. How may I help you today?',
    language_switched: 'Language is updated. I will reply in Indian English now.',
    language_choose: 'Kindly choose your language: Garhwali (गढ़वाली), Kumaoni (कुमाऊनी), Hindi, or English.',
    verify_prompt: 'Kindly share your FHTC number and registered mobile number to verify your account.',
    verify_otp_hint: '\n\nFor OTP: share FHTC + mobile, then request OTP in this chat.',
    verified_ok: 'Verification is done. I can now show your bill, complaint, and connection details.',
    bill_summary: 'Your latest bill is {billNo} — ₹{amount} ({status}). Due date: {dueDate}.',
    no_bills: 'No bill is showing on your account as of now.',
    complaint_registered: 'Your complaint is registered. Ticket number: {complaintNo}. Division office will update you shortly.',
    complaint_status: 'Complaint {complaintNo} status: {status} ({type}).',
    no_complaints: 'No complaint is there on your account.',
    escalated: 'I have escalated this matter to {role}. Reference number: {ref}. One officer will contact you.',
    fallback: 'I can help with bill, complaint, connection status, tariff, and water supply timing. Kindly use a quick action below or ask your question.',
    quick_actions_hint: 'Tap one quick action or type your question.',
    supply_timing: 'In gravity schemes, water is normally supplied morning 6–9 AM and evening 5–8 PM. For pumping schemes, please follow division schedule.',
    tariff_info: 'Billing is done as per approved UJS tariff slabs based on monthly consumption (KL).',
    contact_division: 'Kindly contact your division office or UJS helpline 1800-180-7777 (demo).',
    auth_required: 'Kindly login with FHTC + mobile, or verify in chat to see account details.',
  },
  hi: {
    welcome: 'नमस्ते! मैं जल मित्र हूँ — आपका 24×7 पेयजल सहायक। आज मैं आपकी क्या सहायता कर सकता/सकती हूँ?',
    language_switched: 'भाषा बदल दी गई है। अब मैं इसी भाषा में उत्तर दूँगा/दूँगी।',
    language_choose: 'भाषा चुनें: गढ़वाली, कुमाऊनी, हिंदी या English।',
    verify_prompt: 'कृपया अपना FHTC नंबर और पंजीकृत मोबाइल साझा करें।',
    verify_otp_hint: '\n\nOTP: FHTC + मोबाइल भेजें, फिर OTP माँगें।',
    verified_ok: 'सत्यापन सफल। अब मैं बिल, शिकायत और कनेक्शन विवरण दिखा सकता/सकती हूँ।',
    bill_summary: 'आपका नवीनतम बिल: {billNo} — ₹{amount} ({status})। देय तिथि: {dueDate}।',
    no_bills: 'आपके खाते पर अभी कोई बिल नहीं मिला।',
    complaint_registered: 'शिकायत दर्ज हो गई। टिकट नंबर: {complaintNo}।',
    complaint_status: 'शिकायत {complaintNo}: {status} ({type})।',
    no_complaints: 'आपके खाते पर कोई शिकायत नहीं है।',
    escalated: '{role} को भेज दिया गया है। संदर्भ: {ref}।',
    fallback: 'मैं बिल, शिकायत, कनेक्शन, टैरिफ और पानी के समय में मदद कर सकता/सकती हूँ।',
    quick_actions_hint: 'नीचे से विकल्प चुनें या अपना प्रश्न लिखें।',
    supply_timing: 'ग्रेविटी योजना: सुबह 6–9 और शाम 5–8 बजे। पंपिंग योजना division अनुसूची पर।',
    tariff_info: 'बिलिंग UJS के अनुमोदित टैरिफ स्लैब के अनुसार मासिक खपत (KL) पर।',
    contact_division: 'अपने division कार्यालय या UJS हेल्पलाइन 1800-180-7777 (demo) पर संपर्क करें।',
    auth_required: 'खाता विवरण के लिए FHTC + मोबाइल से लॉगिन करें या चैट में सत्यापित करें।',
  },
  garhwali: {
    welcome: 'नमस्कार! मैं जल मित्र — तुमारो 24×7 पाणी सहायक। कै मदद चाहिय?',
    language_switched: 'भाषा बदल गई। अब मैं गढ़वाली मां बोलूँल।',
    language_choose: 'भाषा चुनो: गढ़वाली, कुमाऊनी, हिंदी या English।',
    verify_prompt: 'अपणो FHTC नंबर अर रजिस्टर मोबाइल बताओ।',
    verify_otp_hint: '\n\nOTP: FHTC + मोबाइल बताओ, फिर OTP मँगो।',
    verified_ok: 'सत्यापन हो ग्यो। अब बिल अर शिकायत देख सकदा।',
    bill_summary: 'तुमार बिल: {billNo} — ₹{amount} ({status})।',
    no_bills: 'अभी तक कोई बिल नीं।',
    complaint_registered: 'शिकायत दर्ज। टिकट: {complaintNo}।',
    complaint_status: 'शिकायत {complaintNo}: {status}।',
    no_complaints: 'कोई शिकायत नीं।',
    escalated: '{role} कू भेज दिन्छ। संदर्भ: {ref}।',
    fallback: 'मैं समझी नीं। कृपया साफ बताओ — बिल, शिकायत, पाणी समय, टैरिफ या नया कनेक्शन? नीचे बटन भी दबा सकदा।',
    quick_actions_hint: 'नीचे बटन चुनो या लिखो।',
    supply_timing: 'ग्रेविटी योजना: सबेर 6–9, साँझ 5–8 बजे पाणी।',
    tariff_info: 'बिल UJS टैरिफ स्लैब मां बनदा।',
    contact_division: 'division office या हेल्पलाइन 1800-180-7777।',
    auth_required: 'FHTC + मोबाइल सू login करो या verify करो।',
  },
  kumaoni: {
    welcome: 'नमस्कार! मैं जल मित्र — तुमार 24×7 पाणी सहायक। की मदद चाह?',
    language_switched: 'भाषा बदल गई। अब कुमाऊनी मां बोलूँल।',
    language_choose: 'भाषा चुनो: गढ़वाली, कुमाऊनी, हिंदी या English।',
    verify_prompt: 'अपण FHTC नंबर अर मोबाइल बताउ।',
    verify_otp_hint: '\n\nOTP: FHTC + मोबाइल बताउ, फिर OTP मँग।',
    verified_ok: 'सत्यापन भयो। अब बिल अर शिकायत देख सकदा।',
    bill_summary: 'तुमार बिल: {billNo} — ₹{amount} ({status})।',
    no_bills: 'अभी कुनु बिल नी।',
    complaint_registered: 'शिकायत दर्ज। टिकट: {complaintNo}।',
    complaint_status: 'शिकायत {complaintNo}: {status}।',
    no_complaints: 'कुनु शिकायत नी।',
    escalated: '{role} कू भेज दियो। संदर्भ: {ref}।',
    fallback: 'मैं समझी नीं। कृपया साफ बताउ — बिल, शिकायत, पाणी समय, टैरिफ या नय कनेक्शन? नीचे बटन पन दबा सकदा।',
    quick_actions_hint: 'नीचे बटन चुनो या लिखो।',
    supply_timing: 'ग्रेविटी: बिहैन 6–9, साँझ 5–8 बजे।',
    tariff_info: 'बिल UJS टैरिफ स्लैब मां।',
    contact_division: 'division office या हेल्पलाइन 1800-180-7777।',
    auth_required: 'FHTC + मोबाइल सू login करो।',
  },
};

export function t(lang: JalMitraLang, key: MsgKey, vars?: Record<string, string | number>): string {
  let text = MESSAGES[lang]?.[key] ?? MESSAGES.hi[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return text;
}

export const QUICK_ACTIONS: Array<{ id: string; labels: Record<JalMitraLang, string> }> = [
  { id: 'bill', labels: { en: 'My bill details', hi: 'मेरा बिल', garhwali: 'मेरो बिल', kumaoni: 'मेरो बिल' } },
  { id: 'complaint', labels: { en: 'Lodge complaint', hi: 'शिकायत दर्ज', garhwali: 'शिकायत दर्ज करो', kumaoni: 'शिकायत दर्ज करो' } },
  { id: 'complaint_status', labels: { en: 'Complaint status', hi: 'शिकायत स्थिति', garhwali: 'शिकायत की स्थिति', kumaoni: 'शिकायत की स्थिति' } },
  { id: 'supply', labels: { en: 'Water supply timing', hi: 'पानी समय', garhwali: 'पाणी कब मिलू?', kumaoni: 'पाणी कब मिलू?' } },
  { id: 'tariff', labels: { en: 'Tariff details', hi: 'टैरिफ जानकारी', garhwali: 'टैरिफ जाणकारी', kumaoni: 'टैरिफ जाणकारी' } },
  { id: 'connection', labels: { en: 'New connection', hi: 'नया कनेक्शन', garhwali: 'नयो कनेक्शन', kumaoni: 'नय कनेक्शन' } },
  { id: 'escalate', labels: { en: 'Talk to officer', hi: 'अधिकारी से बात', garhwali: 'अधिकारी सू बात', kumaoni: 'अधिकारी सू बात' } },
  { id: 'language', labels: { en: 'Change language', hi: 'भाषा बदलें', garhwali: 'भाषा बदलो', kumaoni: 'भाषा बदलो' } },
];
