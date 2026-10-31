import { toSpokenText } from './spokenText.js';

export const decimalDigits = {
  ta: ['ஜீரோ','ஒன்','டூ','த்ரீ','ஃபோர்','ஃபைவ்','சிக்ஸ்','செவன்','எய்ட்','நைன்'],
  hi: ['ज़ीरो','वन','टू','थ्री','फोर','फाइव','सिक्स','सेवन','एट','नाइन'],
};
export const colloquialElements = {
  copper:['காப்பர்','कॉपर'],carbon:['கார்பன்','कार्बन'],silicon:['சிலிக்கான்','सिलिकॉन'],
  manganese:['மாங்கனீஸ்','मैंगनीज़'],phosphorus:['பாஸ்பரஸ்','फॉस्फोरस'],sulphur:['சல்பர்','सल्फर'],
  sulfur:['சல்பர்','सल्फर'],chromium:['க்ரோமியம்','क्रोमियम'],nickel:['நிக்கல்','निकल'],molybdenum:['மாலிப்டினம்','मॉलिब्डेनम'],
};
export const registerLexicon = {
  ta: {
    'தனிமையில் உள்ளது':'க்வாரண்டைன்ல இருக்கு', 'தனிமைப்படுத்தப்பட்டுள்ளது':'க்வாரண்டைன்ல இருக்கு',
    'பயன்பாட்டுக் கட்டுப்பாடு':'ரிலீஸ் ஆகல', 'பயன்படுத்த அனுமதி இல்லை':'ரிலீஸ் ஆகல',
    'அளவு அதிகம்':'அதிகமா இருக்கு', 'அளவு குறைவு':'கம்மியா இருக்கு',
    'வரம்பை நெருங்குகிறது':'லிமிட்டுக்கு பக்கத்துல இருக்கு',
    'மேலும் விவரம் திரையில்':'மீதி ஸ்கிரீன்ல பாருங்க',
    'மீண்டும் சொல்லுங்கள்':'சரியா கேக்கல, திரும்ப சொல்லுங்க',
    'திரையில் பார்க்கவும்':'ஸ்கிரீன்ல பாருங்க', 'கூற்றை திரையில் சரிபார்க்கவும்':'சொன்னதை ஸ்கிரீன்ல செக் பண்ணுங்க',
    'சோதனை விவரம் திரையில்':'செக் விவரம் ஸ்கிரீன்ல', 'தடைகள் இல்லை':'பிரச்சனை இல்லை',
    'முரண்பாடுகள் இல்லை':'சொன்னதுல வித்தியாசம் இல்லை',
    'திட்டமிடப்பட்டது':'பிளான் பண்ணியிருக்கு', 'தகவல் இல்லை':'தகவல் இல்ல',
    'செம்பு':'காப்பர்','மாங்கனீசு':'மாங்கனீஸ்','குரோமியம்':'க்ரோமியம்',
    'குறைந்தபட்சம்':'மினிமம்','வரம்பு':'லிமிட்','சதவீதம்':'பர்சென்ட்',
    'இரண்டு':'ரெண்டு','மூன்று':'மூணு','நான்கு':'நாலு','ஐந்து':'அஞ்சு','ஒன்று':'ஒண்ணு',
    'இருபத்து':'இருபத்தி','முப்பத்து':'முப்பத்தி','நாற்பத்து':'நாப்பத்தி','ஐம்பத்து':'ஐம்பத்தி',
    'அறுபத்து':'அறுபத்தி','எழுபத்து':'எழுபத்தி','எண்பத்து':'எண்பத்தி','தொண்ணூற்று':'தொண்ணூத்தி',
    'உள்ளது':'இருக்கு','அதிகம்':'அதிகமா இருக்கு','குறைவு':'கம்மியா இருக்கு',
  },
  hi: {
    'क्वारंटीन में':'क्वारंटीन में है', 'उपयोग सीमित है':'रिलीज़ नहीं हुआ',
    'उपयोग की अनुमति नहीं':'रिलीज़ नहीं हुआ',
    'सीमा के पास है':'लिमिट के पास है', 'सीमा':'लिमिट','न्यूनतम':'मिनिमम','प्रतिशत':'परसेंट',
  },
};
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const boundary = body => new RegExp(`(?<![\\p{L}\\p{M}])(?:${body})(?![\\p{L}\\p{M}])`,'gu');
const digitWords = (text,lang) => [...text].map(digit => decimalDigits[lang][Number(digit)]).join(' ');

export function spokenRegister() {
  const selected=import.meta.env.VITE_VOICE_REGISTER;
  if(selected==='formal'||selected==='colloquial') return selected;
  return import.meta.env.VITE_VOICE_CLARITY==='true'?'colloquial':'formal';
}

export function colloquialInput(text,lang) {
  if(!decimalDigits[lang]) return String(text);
  // Keep exact written fractional digits before F11/provider TN can normalize.
  let output=String(text).replace(/(?<![\p{L}\p{N}.])([+-]?)(\d+)\.(\d+)(?!\d|\.\d)/gu,
    (_,sign,integer,fraction)=>`${sign==='-'?'minus ':sign==='+'?'plus ':''}${digitWords(integer,lang)} ${lang==='ta'?'பாயிண்ட்':'पॉइंट'} ${digitWords(fraction,lang)}`);
  // Existing lot label is replaced as a whole to avoid doubled 'Lot lot number'.
  output=output.replace(/(?:(?:\bLot|லாட்|लॉट)\s+)?\b([A-Z]{1,8})-(\d{1,8})\b/g,(whole,prefix,value)=>{
    if(prefix==='H') return whole;
    const number=toSpokenText('H-'+value,lang).replace(/^(?:ஹீட்|हीट)\s+/u,'');
    return `${lang==='ta'?'லாட் நம்பர்':'लॉट नंबर'} ${number}`;
  });
  return output;
}

export function colloquialWords(text,lang) {
  if(!registerLexicon[lang]) return String(text);
  let output=String(text).replace(/\s*%/g,lang==='ta'?' பர்சென்ட்':' परसेंट');
  output=output.replace(/\b(?:copper|carbon|silicon|manganese|phosphorus|sulphur|sulfur|chromium|nickel|molybdenum)\b/gi,
    word=>colloquialElements[word.toLowerCase()][lang==='ta'?0:1]);
  // Also accept an already F11-normalized decimal without changing ID cardinals.
  const formalDigits=lang==='ta'?['பூஜ்ஜியம்','ஒன்று','இரண்டு','மூன்று','நான்கு','ஐந்து','ஆறு','ஏழு','எட்டு','ஒன்பது']
    :['शून्य','एक','दो','तीन','चार','पाँच','छह','सात','आठ','नौ'];
  const token=formalDigits.map(escape).join('|');
  const point=lang==='ta'?'புள்ளி':'दशमलव';
  const decimal=boundary(`(?:${token})(?:\\s+(?:${token}))*\\s+${point}\\s+(?:${token})(?:\\s+(?:${token}))*`);
  output=output.replace(decimal,phrase=>phrase.split(/\s+/).map(word=>word===point?(lang==='ta'?'பாயிண்ட்':'पॉइंट'):decimalDigits[lang][formalDigits.indexOf(word)]).join(' '));
  const lexicon=registerLexicon[lang];
  const keys=Object.keys(lexicon).sort((a,b)=>b.length-a.length);
  output=output.replace(boundary(keys.map(escape).join('|')),phrase=>lexicon[phrase]);
  // Idempotent: don't append a second hai to an already colloquial lot status.
  if(lang==='hi') output=output.replace(/क्वारंटीन में है(?: है)+/gu,'क्वारंटीन में है');
  return output;
}
