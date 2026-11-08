import {gateReasonAnswer} from './voiceGateAnswers';
import {hindiGateAnswer} from './hindiVoice';
import {loadedUnavailable} from './loadedVoiceAnswers';
export function loadedHeatStatus(context,number,lang='en'){
 const data=context?.loaded,missing=loadedUnavailable[lang]||loadedUnavailable.en;
 if(!data||data.loading)return missing;
 const rows=[data.heat,...(data.heats||[])].filter(Boolean);
 const heat=rows.find(row=>Number(String(row.heatId).replace(/^H[- ]?/i,''))===number);
 const gate=heat?.gateResult||heat?.gate;
 if(!heat||!gate?.decision)return missing;
 if(lang==='hi')return `हीट ${heat.heatId}: गेट ${gate.decision}। ${hindiGateAnswer({...heat,gateResult:gate})}`;
 const lead=lang==='ta'?`ஹீட் ${heat.heatId}: கேட் ${gate.decision}.`:`Heat ${heat.heatId}: Gate ${gate.decision}.`;
 return `${lead} ${gateReasonAnswer(gate,lang)}`;
}
