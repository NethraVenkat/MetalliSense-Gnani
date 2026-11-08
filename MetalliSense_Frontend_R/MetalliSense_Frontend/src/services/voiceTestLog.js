import {redactVoiceText} from './voiceAuditText';
import {localLogDate,localLogTime} from './voiceLogView';
const cell=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('|','\\|').replace(/[\r\n]+/g,' ');
export function voiceTestLog(rows,date=localLogDate()){
 const lines=[`# Live voice test log — ${date}`,'','Times: Asia/Calcutta. Outcomes are client-reported; Result is reserved for a human live check.','','| Time | Page | Heard | Intent | Level | Decision | Spoken reply | Result | Matched | Reason | Normalized | Target |','|---|---|---|---|---|---|---|---|---|---|---|---|'];
 for(const row of rows){const privateTurn=row.confirmation==='passcode';lines.push('| '+[localLogTime(row.ts),redactVoiceText(row.page||'Legacy capture (page unavailable)'),privateTurn?'[passcode masked]':redactVoiceText(row.heard||row.transcript,{transcript:!row.heard}),redactVoiceText(row.intent),row.level||'ASK',redactVoiceText(row.decision),redactVoiceText(row.spoken_reply||'',{privateTurn}),'',redactVoiceText(row.winner||row.intent),redactVoiceText(row.reason_code),privateTurn?'[passcode masked]':redactVoiceText(row.normalized_text),redactVoiceText(row.target)].map(cell).join(' | ')+' |');}
 return lines.join('\n')+'\n';
}
export function downloadVoiceTestLog(rows,date=localLogDate()){
 const url=URL.createObjectURL(new Blob([voiceTestLog(rows,date)],{type:'text/markdown;charset=utf-8'}));
 const link=document.createElement('a');link.href=url;link.download=`LIVE_TEST_${date}.md`;link.click();setTimeout(()=>URL.revokeObjectURL(url),0);
}
