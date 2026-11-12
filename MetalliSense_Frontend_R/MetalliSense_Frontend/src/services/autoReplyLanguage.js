// Detection labels describe transcript script, not guaranteed spoken language.
export const autoReplyLanguageEnabled=()=>import.meta.env.VITE_STT_AUTO_LANGUAGE==='true';
export function autoReplyLanguage(text,detected,current='ta',enabled=autoReplyLanguageEnabled()){
 if(!enabled)return current;
 const value=String(text||'').normalize('NFKC');
 const tokens=value.match(/[\p{L}\p{M}\p{N}]+/gu)||[];
 const code=String(detected||'').toLowerCase().split('-')[0];
 if(tokens.length<3||!['ta','hi','en'].includes(code))return current;
 // Devanagari alone does not distinguish Hindi from Marathi.
 if(/\b(?:ahe|aahe|mala|majha|majhi)\b|आहे|मला|माझ|पाहिजे/u.test(value.toLowerCase()))return current;
 const tamil=/[\u0b80-\u0bff]/u.test(value)||/\b(?:enna|nilai|kudu|edu|po|ponga|pannu|evvalavu|sollu)\b/i.test(value);
 if(tamil)return 'ta';
 const hindi=/क्या|क्यों|कितना|है|करो|कीजिए|दिखाओ|खोलो|लो|जाओ|स्थिति|शुरू|चुना/u.test(value)||/\b(?:kya|kyun|kitna|hai|karo|kijiye|dikhao|kholo|sthiti|shuru|batao)\b/i.test(value);
 if(code==='hi')return hindi?'hi':current;
 if(hindi)return 'hi';
 if(code==='ta')return current; // No Tamil cue: do not override on tag alone.
 return 'en';
}
