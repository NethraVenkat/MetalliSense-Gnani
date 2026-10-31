export const langBridgeEnabled = () => import.meta.env.VITE_LANG_BRIDGE === 'true';

export function pickReplyLanguage(text, detected, current = 'ta', enabled = false) {
  if (!enabled) return current;
  if (/^hi/i.test(detected || '') || /[\u0900-\u097f]/u.test(text)
    || (!/[\u0b80-\u0bff]/u.test(text) && /\b(?:kya|kyun|kyu|kitna|hai|batao|karo|kro|kaun|madad)\b/i.test(text))) return 'hi';
  if (/^ta/i.test(detected || '') || /[\u0b80-\u0bff]/u.test(text)
    || /\b(?:enna|yen|evvalavu|kaattu|epdi|enna|en\s+hold)\b/i.test(text)) return 'ta';
  return current;
}

export const hindiBlocked = 'वॉइस से अप्रूव या मेल्टिंग नहीं होगी। यह स्क्रीन पर करें।';
export const hindiNotUnderstood = 'समझ नहीं आया, कृपया फिर से बोलिए।';
export const retryVoiceAnswer = lang => lang === 'hi' ? hindiNotUnderstood : lang === 'ta' ? 'மீண்டும் சொல்லுங்கள்' : 'Could not hear you. Tap a suggestion below.';
export const hindiHoldAlert = id => `ध्यान दें, हीट ${id} होल्ड पर है। स्क्रीन देखें।`;
