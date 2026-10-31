// One deterministic grammar for English, Tamil and Hindi cardinal/dictated IDs.
const words = new Map();
const key = word => word.normalize('NFKC').toLowerCase();
const add = (value, aliases) => aliases.split('|').forEach(word => words.set(key(word), value));
['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'].forEach((word, n) => add(n, word));
['twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'].forEach((word, n) => add((n + 2) * 10, word));
add(100, 'hundred|சதம்|நூறு|நூற்று|सौ|sau');
add(1000, 'thousand|ஆயிரம்|ஆயிரத்து|ஆயிரத்தி|हजार|हज़ार|hazar|hazaar|hajar|hajaar');
export const tamilUnits = ['பூஜ்ஜியம்|ஜீரோ','ஒன்று|ஒண்ணு|ஒன்னு','இரண்டு|ரெண்டு','மூன்று|மூணு','நான்கு|நாலு','ஐந்து|அஞ்சு','ஆறு','ஏழு','எட்டு','ஒன்பது'];
tamilUnits.forEach((aliases, n) => add(n, aliases));
export const tamilTens = ['பத்து','இருபது|இருபத்து|இருபத்தி','முப்பது|முப்பத்து|முப்பத்தி','நாற்பது|நாற்பத்து|நாப்பத்தி','ஐம்பது|ஐம்பத்து|ஐம்பத்தி','அறுபது|அறுபத்து|அறுபத்தி','எழுபது|எழுபத்து|எழுபத்தி','எண்பது|எண்பத்து|எண்பத்தி','தொண்ணூறு|தொண்ணூற்று|தொண்ணூத்தி'];
tamilTens.forEach((aliases, n) => add((n + 1) * 10, aliases));
['பதினொன்று|பதினொண்ணு|பதினொன்னு','பன்னிரண்டு|பன்னிரெண்டு|பனிரெண்டு','பதின்மூன்று|பதிமூன்று|பதிமூணு|பதின்மூணு','பதினான்கு|பதினாலு','பதினைந்து|பதினஞ்சு','பதினாறு','பதினேழு','பதினெட்டு','பத்தொன்பது|பத்தொம்பது'].forEach((aliases, n) => add(n + 11, aliases));
// Hindi cardinals are irregular: keep the complete 0–99 table explicit.
export const hindiCardinals = [
  'शून्य|जीरो|ज़ीरो','एक','दो','तीन','चार','पांच|पाँच','छह|छः|छे','सात','आठ','नौ',
  'दस','ग्यारह','बारह','तेरह','चौदह','पंद्रह|पन्द्रह','सोलह','सत्रह','अठारह','उन्नीस',
  'बीस','इक्कीस','बाईस','तेईस','चौबीस','पच्चीस','छब्बीस','सत्ताईस','अट्ठाईस|अठाईस','उनतीस',
  'तीस','इकतीस','बत्तीस','तैंतीस','चौंतीस','पैंतीस','छत्तीस','सैंतीस','अड़तीस|अड़तीस','उनतालीस',
  'चालीस','इकतालीस','बयालीस','तैंतालीस','चवालीस','पैंतालीस','छियालीस','सैंतालीस','अड़तालीस|अड़तालीस','उनचास',
  'पचास','इक्यावन','बावन','तिरपन|तिरेपन','चौवन','पचपन','छप्पन','सत्तावन','अट्ठावन|अठावन','उनसठ',
  'साठ','इकसठ','बासठ','तिरसठ','चौंसठ','पैंसठ','छियासठ','सड़सठ|सड़सठ','अड़सठ|अड़सठ','उनहत्तर',
  'सत्तर','इकहत्तर','बहत्तर','तिहत्तर','चौहत्तर','पचहत्तर','छिहत्तर','सतहत्तर','अठहत्तर','उनासी|उन्यासी|उन्नासी',
  'अस्सी','इक्यासी','बयासी','तिरासी','चौरासी','पचासी','छियासी','सत्तासी','अट्ठासी|अठासी','नवासी',
  'नब्बे','इक्यानवे','बानवे','तिरानवे','चौरानवे','पंचानवे|पचानवे','छियानवे','सत्तानवे','अट्ठानवे|अठानवे','निन्यानवे',
];
hindiCardinals.forEach((aliases, n) => add(n, aliases));
const hinglish = [
  'shunya|zero','ek','do','teen','char|chaar','panch|paanch','chhe|chhah|che','saat','aath','nau',
  'das','gyarah','barah','terah','chaudah','pandrah','solah','satrah','atharah','unnis|unnees',
  'bees','ikkis|ikkees','bais|baees','teis','chaubis','pachis','chhabbis','sattais','atthais','untis',
  'tees','ikatis|iktees','battis','taintis','chauntis','paintis','chhattis','saintis','adtis','untalis',
  'chalis|chaalis','iktalis','bayalis','taintalis','chavalis','paintalis','chhiyalis','saintalis','adtalis','unchas',
  'pachas|pachaas','ikyavan','bavan|bawan','tirpan|tirepan','chauvan|chauwan','pachpan','chhappan','sattavan','atthavan','unsath',
  'saath','iksath','basath','tirsath','chaunsath','painsath','chhiyasath','sadsath','adsath','unhattar',
  'sattar','ikhattar','bahattar','tihattar','chauhattar','pachhattar','chhihattar','satahattar','athhattar','unasi',
  'assi','ikyasi','bayasi','tirasi','chaurasi','pachasi','chhiyasi','sattasi','atthasi','navasi',
  'nabbe','ikyanve','banve','tiranve','chauranve','panchanve','chhiyanve','sattanve','atthanve','ninyanve',
];
hinglish.forEach((aliases, n) => add(n, aliases));
const clean = text => key(String(text ?? '')).replace(/[०-९]/g, digit => String(digit.charCodeAt(0) - 0x966)).replace(/[௦-௯]/g, digit => String(digit.charCodeAt(0) - 0xbe6));
const valueOf = word => /^\d+$/.test(word) ? Number(word) : words.get(word);

export function parseSpokenNumber(text) {
  const tokens = clean(text).trim().split(/[\s-]+/).filter(word => word && word !== 'and');
  const values = tokens.map(valueOf);
  if (!values.length || values.some(value => value == null)) return null;
  if (values.every(value => value < 10)) return Number(values.join(''));
  if (!values.includes(100) && !values.includes(1000) && values.length > 1
      && values[0] >= 10 && values[0] < 100 && values[1] >= 20 && values[1] < 100) {
    return values[0] * 100 + values.slice(1).reduce((a, b) => a + b, 0);
  }
  let total = 0, group = 0;
  for (const value of values) {
    if (value === 100) group = (group || 1) * 100;
    else if (value === 1000) { total += (group || 1) * 1000; group = 0; }
    else group += value;
  }
  return total + group;
}

export function normalizeSpokenNumbers(text) {
  const tokens = clean(text).split(/\s+/);
  const output = [];
  for (let i = 0; i < tokens.length;) {
    if (valueOf(tokens[i]) == null) { output.push(tokens[i++]); continue; }
    const start = i++;
    while (i < tokens.length && (valueOf(tokens[i]) != null || tokens[i] === 'and' && valueOf(tokens[i + 1] || '') != null)) i++;
    const span = tokens.slice(start, i).filter(word => word !== 'and');
    output.push(span.length === 1 && /^\d+$/.test(span[0]) ? span[0]
      : span.every(word => valueOf(word) < 10) ? span.map(word => /^\d+$/.test(word) ? word : String(valueOf(word))).join('')
        : String(parseSpokenNumber(span.join(' '))));
  }
  return output.join(' ');
}
