import { clarityText, nativeSpeech, voiceClarityEnabled } from './voiceClarity.js';
import { spokenRegister } from './voiceRegister.js';
import { formatGateLimit } from './hindiVoice.js';

export const shiftSummaryEnabled = () => import.meta.env.VITE_SHIFT_SUMMARY === 'true';
const summaryStatus = heat => String(heat.status || '').trim().toUpperCase().replace(/[\s-]+/g,'_');
export const isSummaryMelting = heat => ['MELTING','ACTIVE','IN_PROGRESS','MELT_IN_PROGRESS','MELTING_IN_PROGRESS','IN_PROGRESS_MELT'].includes(summaryStatus(heat));
export const isSummaryActive = heat => summaryStatus(heat)==='PLANNED' || isSummaryMelting(heat);
export function currentSummaryDecision(heat, now=Date.now()) {
  if(isSummaryMelting(heat)) return 'melting';
  const gate=heat.gateResult||heat.gate;
  const expiry=gate?.validUntil ?? heat.gate?.validUntil;
  if(!gate || gate.stale || heat.gate?.stale || gate.expired || expiry != null && (!Number.isFinite(Date.parse(expiry)) || Date.parse(expiry)<=now)) return 'not_checked';
  return ['HOLD','WARN','GO'].includes(gate.decision)?gate.decision:'not_checked';
}

function firstReason(heat) {
  const gate=heat?.gateResult||heat?.gate;
  const status=gate?.decision==='HOLD'?'FAIL':'WARN';
  const check=gate?.checks?.find(check=>check.id!=='ai_assessment'&&check.status===status);
  const detail=check?.details?.find(detail=>detail.status===status);
  if(detail?.lotId) return {type:'lot',lotId:detail.lotId,state:/QUARANTINED/.test(detail.text||'')?'quarantined':/\bHOLD\b/.test(detail.text||'')?'on hold':'use restricted'};
  if(detail?.element && Number.isFinite(detail.value)) return {type:'element',element:detail.element,value:detail.value,min:detail.min,max:detail.max,status,
    direction:detail.value<detail.min?'low':detail.value>detail.max?'high':'risk'};
  const saved=(gate?.decision==='HOLD'?gate?.blocking:gate?.warnings)||[];
  const text=saved.map(item=>typeof item==='string'?item:item.title||item.message||item.text).find(Boolean);
  return {type:'text',checkId:check?.id,text:check?.summary||check?.title||text||'See gate details on screen'};
}
function reasonDisplay(reason) {
  if(reason.type==='lot') return `${reason.lotId} ${reason.state}`;
  if(reason.type==='element') return `${reason.element} ${reason.value.toFixed(2)} percent${Number.isFinite(reason.max)?`, max ${formatGateLimit(reason.max)}`:''}${Number.isFinite(reason.min)?`, min ${formatGateLimit(reason.min,true)}`:''}`;
  return reason.text;
}

export function buildShiftSummary(heats,now=Date.now()) {
  const groups={HOLD:[],WARN:[],GO:[],melting:[],not_checked:[]};
  const active=heats.filter(isSummaryActive).slice().sort((a,b)=>String(a.heatId).localeCompare(String(b.heatId),undefined,{numeric:true}));
  for(const heat of active) groups[currentSummaryDecision(heat,now)].push(heat.heatId);
  const priorityId=groups.HOLD[0]||groups.WARN[0]||null;
  const priorityHeat=active.find(heat=>heat.heatId===priorityId)||null;
  const counts=Object.fromEntries(Object.entries(groups).map(([name,rows])=>[name,rows.length]));
  const excludedCompleted=heats.filter(heat=>heat.status==='COMPLETED').length;
  const excludedOther=heats.length-active.length-excludedCompleted;
  const reason=priorityHeat?firstReason(priorityHeat):null;
  const display='Shift summary: '+Object.entries(groups).map(([name,rows])=>`${rows.length} ${name==='not_checked'?'not checked / expired':name}${rows.length?` (${rows.join(', ')})`:''}`).join(', ')
    +`. Completed heats excluded: ${excludedCompleted}.`+(excludedOther?` Other inactive heats excluded: ${excludedOther}.`:'')
    +(priorityId?` Check ${priorityId} first: ${reasonDisplay(reason)}.`:' No HOLD or WARN heat to prioritize.');
  return {counts,groups,priorityId,priorityHeat,firstReason:reason,excludedCompleted,excludedOther,display};
}

function countWords(count,lang,register) {
  if(count===0) return lang==='ta'?'பூஜ்ஜியம்':lang==='hi'?'शून्य':'zero';
  // Reuse the ID cardinal grammar without heat labels; supports arbitrary counts.
  if(count<10000) return nativeSpeech(`H-${count}`,lang,register).replace(/^(?:ஹீட்|हीट|heat)\s+/u,'');
  return String(count); // Provider TN handles large counts without truncating them.
}

export function spokenShiftSummary(summary,lang='ta', options={}) {
  const clarity=options.clarity ?? voiceClarityEnabled();
  const register=clarity?(options.register||spokenRegister()):'formal';
  const colloquial=register==='colloquial';
  const lines=[lang==='ta'?'ஷிஃப்ட் சுருக்கம்':lang==='hi'?'शिफ्ट सारांश':'Shift summary'];
  const n=key=>countWords(summary.counts[key],lang,register);
  if(summary.counts.HOLD) lines.push(lang==='ta'?`${summary.counts.HOLD===1&&colloquial?'ஒரு':n('HOLD')} ஹீட் ${colloquial?'ஹோல்ட்ல இருக்கு':'ஹோல்டில் உள்ளது'}`:lang==='hi'?`${n('HOLD')} हीट होल्ड पर है`:`${n('HOLD')} heat${summary.counts.HOLD===1?'':'s'} on HOLD`);
  else if(!summary.counts.WARN) lines.push(lang==='ta'?'எந்த ஹீட்டும் ஹோல்ட்ல இல்ல':lang==='hi'?'कोई हीट होल्ड पर नहीं है':'No heats on hold');
  if(summary.counts.WARN) lines.push(lang==='ta'?`${n('WARN')} எச்சரிக்கை`:lang==='hi'?`${n('WARN')} चेतावनी`:`${n('WARN')} WARN`);
  if(summary.counts.GO) lines.push(`${n('GO')} ${lang==='ta'?'கோ':lang==='hi'?'गो':'GO'}`);
  if(summary.counts.melting) lines.push(lang==='ta'?`${n('melting')} ${colloquial?'மெல்டிங்ல இருக்கு':'உருக்கத்தில் உள்ளது'}`:lang==='hi'?`${n('melting')} मेल्टिंग में है`:`${n('melting')} melting`);
  if(summary.counts.not_checked) lines.push(lang==='ta'?`${n('not_checked')} ${colloquial?'இன்னும் செக் பண்ணல':'இன்னும் சோதிக்கப்படவில்லை'}`:lang==='hi'?`${n('not_checked')} अभी चेक नहीं हुआ`:`${n('not_checked')} not checked`);
  lines.push(lang==='ta'?'முடிந்த ஹீட்கள் கணக்கில் இல்லை':lang==='hi'?'पूरे हुए हीट गिनती में नहीं':'Completed heats excluded');
  if(summary.priorityId) {
    lines.push(lang==='ta'?`முதல்ல Heat ${summary.priorityId} பாருங்க`:lang==='hi'?`पहले Heat ${summary.priorityId} देखिए`:`Check Heat ${summary.priorityId} first`);
    const reason=summary.firstReason;
    if(reason.type==='lot') lines.push(`Lot ${reason.lotId}: ${lang==='ta'?(reason.state==='quarantined'?'தனிமையில் உள்ளது':reason.state==='on hold'?'ஹோல்ட்ல இருக்கு':'பயன்படுத்த அனுமதி இல்லை'):lang==='hi'?(reason.state==='quarantined'?'क्वारंटीन में':reason.state==='on hold'?'होल्ड पर है':'उपयोग की अनुमति नहीं'):reason.state}`);
    else if(reason.type==='element') {
      lines.push(`${reason.element} ${lang==='ta'?(reason.direction==='low'?'அளவு குறைவு':reason.direction==='high'?'அளவு அதிகம்':'வரம்பை நெருங்குகிறது')
        :lang==='hi'?(reason.direction==='low'?'कम है':reason.direction==='high'?'ज़्यादा है':'सीमा के पास है')
          :reason.direction==='low'?'is low':reason.direction==='high'?'is high':'near the limit'}`);
      lines.push(`${reason.element}: ${reason.value.toFixed(2)} ${lang==='ta'?'சதவீதம்':lang==='hi'?'प्रतिशत':'percent'}`);
    } else {
      const reasons={stock:['கையிருப்பு போதவில்லை','स्टॉक कम है','Insufficient stock'],charge_weight:['சார்ஜ் எடை பொருந்தவில்லை','चार्ज का वजन मेल नहीं खाता','Charge weight mismatch'],
        yard_inspection:['ஆய்வு முழுமையாக இல்லை','जाँच पूरी नहीं है','Inspection incomplete'],dri_quality:['தர சோதனை தேவை','गुणवत्ता की जाँच चाहिए','Quality check required']};
      lines.push(reasons[reason.checkId]?.[lang==='ta'?0:lang==='hi'?1:2]||reason.text);
    }
  }
  return clarityText(lines.join(lang==='hi'?'। ':'. '),lang,register);
}
