import { hindiCardinals } from './spokenNumbers.js';

const enSmall = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(' ');
const enTens = ['', '', 'twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
const taUnits = ['பூஜ்ஜியம்','ஒன்று','இரண்டு','மூன்று','நான்கு','ஐந்து','ஆறு','ஏழு','எட்டு','ஒன்பது'];
const taTeens = ['பத்து','பதினொன்று','பன்னிரண்டு','பதின்மூன்று','பதினான்கு','பதினைந்து','பதினாறு','பதினேழு','பதினெட்டு','பத்தொன்பது'];
const taTens = ['','','இருபது','முப்பது','நாற்பது','ஐம்பது','அறுபது','எழுபது','எண்பது','தொண்ணூறு'];
const taCombine = ['','','இருபத்து','முப்பத்து','நாற்பத்து','ஐம்பத்து','அறுபத்து','எழுபத்து','எண்பத்து','தொண்ணூற்று'];
const taHundreds = ['','நூறு','இருநூறு','முந்நூறு','நானூறு','ஐந்நூறு','அறுநூறு','எழுநூறு','எண்ணூறு','தொள்ளாயிரம்'];
const hiDigits = ['शून्य','एक','दो','तीन','चार','पाँच','छह','सात','आठ','नौ'];
function cardinal(n, lang) {
  if (lang === 'hi') {
    if (n < 100) return n < 10 ? hiDigits[n] : hindiCardinals[n].split('|')[0];
    if (n < 1000) return `${hiDigits[Math.floor(n/100)]} सौ${n%100 ? ` ${cardinal(n%100,lang)}` : ''}`;
    return `${cardinal(Math.floor(n/1000),lang)} हज़ार${n%1000 ? ` ${cardinal(n%1000,lang)}` : ''}`;
  }
  if (lang === 'ta') {
    if (n < 10) return taUnits[n];
    if (n < 20) return taTeens[n-10];
    if (n < 100) return n%10 ? `${taCombine[Math.floor(n/10)]} ${taUnits[n%10]}` : taTens[n/10];
    if (n < 1000) return (n%100 ? taHundreds[Math.floor(n/100)].replace(/று$/, 'ற்று').replace(/ம்$/, 'த்து') : taHundreds[Math.floor(n/100)]) + (n%100 ? ` ${cardinal(n%100,lang)}` : '');
    const prefix = n < 2000 ? '' : `${cardinal(Math.floor(n/1000),lang)} `;
    return `${prefix}${n%1000 ? 'ஆயிரத்து' : 'ஆயிரம்'}${n%1000 ? ` ${cardinal(n%1000,lang)}` : ''}`;
  }
  if (n < 20) return enSmall[n];
  if (n < 100) return enTens[Math.floor(n/10)] + (n%10 ? `-${enSmall[n%10]}` : '');
  if (n < 1000) return `${enSmall[Math.floor(n/100)]} hundred${n%100 ? ` ${cardinal(n%100,lang)}` : ''}`;
  return `${cardinal(Math.floor(n/1000),lang)} thousand${n%1000 ? ` ${cardinal(n%1000,lang)}` : ''}`;
}
const digits = (value, lang) => [...value].map(digit => (lang === 'ta' ? taUnits : lang === 'hi' ? hiDigits : enSmall)[Number(digit)]).join(' ');
function idNumber(value, lang) {
  if (value.length > 4 || /^0\d/.test(value)) return digits(value,lang);
  const n = Number(value);
  if (lang === 'en' && value.length === 4) return `${cardinal(Math.floor(n/100),lang)} ${n%100 < 10 ? `zero ${enSmall[n%10]}` : cardinal(n%100,lang)}`;
  return cardinal(n,lang);
}

// The current provider TN already handles ordinary quantities, decimals and %.
// Only custom foundry IDs and exact trailing-zero precision override that TN.
export function toSpokenText(text, lang = 'en') {
  lang = String(lang).split('-')[0];
  if (!['ta','hi','en'].includes(lang)) return String(text);
  return String(text)
    .replace(/(?:\bHeat\s+|ஹீட்\s+|हीट\s+)(?=H-\d)/gi,'')
    .replace(/\b([A-Z]{1,8})-(\d{1,8})\b/g, (_, prefix, value) => {
      const known = { H: {ta:'ஹீட்',hi:'हीट',en:'heat'}, PIG:{ta:'பிக்',hi:'पिग',en:'pig'} };
      const name = known[prefix]?.[lang] || (/[AEIOU]/.test(prefix) ? prefix.toLowerCase() : [...prefix].join(' '));
      return `${name} ${idNumber(value,lang)}`;
    })
    .replace(/(?<![\w.])([+-]?)(\d+)\.(\d*0)(?![\d.])(\s*%)?/g, (_, sign, integer, fraction, percentage) =>
      `${sign === '-' ? 'minus ' : sign === '+' ? 'plus ' : ''}${integer.length > 4 ? digits(integer,lang) : cardinal(Number(integer),lang)} ${lang === 'ta' ? 'புள்ளி' : lang === 'hi' ? 'दशमलव' : 'point'} ${digits(fraction,lang)}${percentage ? ` ${lang === 'ta' ? 'சதவீதம்' : lang === 'hi' ? 'प्रतिशत' : 'percent'}` : ''}`);
}
