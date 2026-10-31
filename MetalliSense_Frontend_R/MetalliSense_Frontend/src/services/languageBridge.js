export const langBridgeEnabled = () => import.meta.env.VITE_LANG_BRIDGE === 'true';

export function pickReplyLanguage(text, detected, current = 'ta', enabled = false) {
  if (!enabled) return current;
  if (/^hi/i.test(detected || '') || /[\u0900-\u097f]/u.test(text)
    || (!/[\u0b80-\u0bff]/u.test(text) && /\b(?:kya|kyun|kyu|kitna|hai|batao|karo|kro|kaun|madad)\b/i.test(text))) return 'hi';
  if (/^ta/i.test(detected || '') || /[\u0b80-\u0bff]/u.test(text)
    || /\b(?:enna|yen|evvalavu|kaattu|epdi|enna|en\s+hold)\b/i.test(text)) return 'ta';
  return current;
}

// Only navigation/help/refusals use this picker. Existing data answers retain
// pickReplyLanguage's F2 contract and toggle behavior.
export function questionReplyLanguage(text, detected, current='ta') {
  const value=String(text||'');
  const hinted=/\b(?:dikhao|kholo|yahan|pooch|kijiye|nahi)\b/i.test(value)?`${value} hai`
    :/\b(?:po|ponga|sollu|pannu|panna|thira|thirakku)\b/i.test(value)?`${value} enna`:value;
  const native=pickReplyLanguage(hinted,null,null,true);
  if(native)return native;
  if(/\b(?:what|can|ask|here|open|show|go|page|help|approve|approval|confirm|release|deduct|start|melt|melting|override|invoice|delete|stock)\b/i.test(value))return 'en';
  return /[\p{L}\p{N}]/u.test(value)?pickReplyLanguage(value,detected,current,true):current;
}
export const blockedVoiceReplies = {
  ta:'இது வாய்ஸ்ல செய்ய முடியாது. ஸ்கிரீன்ல செய்யுங்க.',
  hi:'यह वॉइस से नहीं हो सकता। स्क्रीन पर कीजिए।',
  en:"This can't be done by voice. Please use the screen.",
};
export const hindiBlocked = blockedVoiceReplies.hi;
export const hindiNotUnderstood = 'समझ नहीं आया, कृपया फिर से बोलिए।';
export const retryVoiceAnswer = lang => lang === 'hi' ? hindiNotUnderstood : lang === 'ta' ? 'மீண்டும் சொல்லுங்கள்' : 'Could not hear you. Tap a suggestion below.';
export const hindiHoldAlert = id => `ध्यान दें, हीट ${id} होल्ड पर है। स्क्रीन देखें।`;
