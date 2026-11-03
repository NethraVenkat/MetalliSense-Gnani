import {buildShiftSummary,isSummaryActive} from './shiftSummary';
export const morningBriefingEnabled=()=>import.meta.env.VITE_MORNING_BRIEFING==='true';
export const isMorningBriefing=text=>/\bbrief(?:ing)?\b|\u0baa\u0bcd\u0bb0\u0bc0\u0b83\u0baa\u0bbf\u0b99\u0bcd|\u0b87\u0ba9\u0bcd\u0ba9\u0bc8\u0b95\u0bcd\u0b95\u0bc1|\u092c\u094d\u0930\u0940\u092b\u093f\u0902\u0917|\u0906\u091c/iu.test(String(text).normalize('NFKC'));
export const morningUnavailable={ta:'இப்போ ஹீட் தகவல் கிடைக்கல; எண்ணிக்கை சொல்ல முடியல.',hi:'अभी हीट जानकारी नहीं मिली; गिनती नहीं बता सकते।',en:'Heat data is unavailable; counts cannot be reported.'};
// Status answers report the saved gate decision, not permission to start melting.
// Only this display copy ignores expiry; the gate engine and F9 stay unchanged.
export function morningBriefing(rows,lang='en',now=Date.now()) {
 if(!Array.isArray(rows)||!rows.length||rows.some(r=>!r||typeof r.heatId!=='string'||typeof r.status!=='string'))return morningUnavailable[lang]||morningUnavailable.en;
 const copies=rows.map(r=>{const g=r.gateResult||r.gate;return {...r,gate:g?{...g,validUntil:undefined,stale:false,expired:false}:null,gateResult:g?{...g,validUntil:undefined,stale:false,expired:false}:null};});
 const s=buildShiftSummary(copies,now),c=s.counts;
 const counts=`${lang==='ta'?'இன்னைக்கு':lang==='hi'?'आज':'Today'}: HOLD ${c.HOLD}, WARN ${c.WARN}, GO ${c.GO}. ${lang==='ta'?'மெல்டிங்ல':lang==='hi'?'मेल्टिंग':'Melting'} ${c.melting}. ${lang==='ta'?'செக் பண்ணாத ஹீட்':lang==='hi'?'अनचेक हीट':'Unchecked heats'} ${c.not_checked}`;
 if(!c.HOLD)return `${counts}.`;
 const heat=rows.find(r=>r.heatId===s.groups.HOLD[0]),gate=heat.gateResult||heat.gate;
 const element=(gate.checks||[]).flatMap(c=>c.details||[]).find(d=>d.status==='FAIL'&&d.element&&Number.isFinite(d.value));
 const r=element?{type:'element',element:element.element,direction:element.value<element.min?'low':'high'}:s.firstReason;
 const descriptions={stock:['கையிருப்பு போதவில்லை','स्टॉक कम है','Insufficient stock'],charge_weight:['சார்ஜ் எடை பொருந்தவில்லை','चार्ज का वजन मेल नहीं खाता','Charge weight mismatch'],yard_inspection:['ஆய்வு முழுமையாக இல்லை','जाँच पूरी नहीं है','Inspection incomplete'],dri_quality:['தர சோதனை தேவை','गुणवत्ता की जाँच चाहिए','Quality check required']};
 const name=r.element==='Cu'?{ta:'காப்பர்',hi:'कॉपर',en:'Copper'}[lang]:r.element;
 const direction=r.direction==='low'?{ta:'லிமிட்டுக்கு கீழ',hi:'सीमा से नीचे',en:'below limit'}[lang]:{ta:'லிமிட்டுக்கு மேல',hi:'सीमा से ऊपर',en:'above limit'}[lang];
 const reason=r.type==='element'?`${name} ${direction}`:r.type==='lot'?`Lot ${r.lotId}: ${r.state}`:descriptions[r.checkId]?.[lang==='ta'?0:lang==='hi'?1:2]||r.text;
 return `${counts}. ${lang==='ta'?'முதல் HOLD':lang==='hi'?'पहला HOLD':'First HOLD'}: ${s.groups.HOLD[0]}, ${reason}.`;
}
export async function fetchMorningRows(list,detail){const response=await list();const rows=response.data?.data??response.data;if(!Array.isArray(rows))return rows;const full=[];for(const row of rows)full.push(isSummaryActive(row)&&detail?(await detail(row.heatId)).data:row);return full.map(r=>r?.data??r);}
