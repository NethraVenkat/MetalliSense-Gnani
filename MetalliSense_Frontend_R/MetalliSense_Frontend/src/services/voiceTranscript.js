import {autoReplyLanguage,autoReplyLanguageEnabled} from './autoReplyLanguage';
import {spokenOnly} from './voiceWording';
import {matchPageControl} from './voicePageControls';
import {voiceDiagnostics} from './voiceDiagnostics';
import {registeredVoiceAction} from './voiceActionRegistry';
import {voiceActionApi} from './voiceActionApi';
import {redactVoiceText} from './voiceAuditText';
import {voiceActionsEnabled,neverByVoice,screenOnly} from './voiceActions';
import {loadedHeatStatus} from './loadedHeatStatus';
import {voiceAskReply,isHistoricalVoiceAsk,isInvoiceVoiceAsk,matchVoiceAsk} from './voiceAskAnswers';
import {morningBriefingEnabled,isMorningBriefing,morningBriefing,morningUnavailable,fetchMorningRows} from './morningBriefing';
import { getAdditives, getHeats, getHeat, getShiftSummaryHeats } from './premeltService';
import { sendChatMessage, phraseGateFacts } from './copilotService';
import { gatePhraseFacts } from './gatePhraseFacts';
import { mapIntent } from './voiceIntents';
import { heatVoiceAnswer, spokenGateReasonAnswer } from './voiceGateAnswers';
import { pickReplyLanguage, blockedVoiceReplies, questionReplyLanguage as legacyQuestionReplyLanguage, hindiNotUnderstood, retryVoiceAnswer } from './languageBridge';
import { hindiHeatAnswer } from './hindiVoice';
import { voiceClarityEnabled, clarityReply } from './voiceClarity';
import { buildShiftSummary, spokenShiftSummary, isSummaryActive } from './shiftSummary';
import {voiceEverywhereEnabled,navigationAnswer,pageHelp,voicePage} from './voicePages';
import {tourRunningReply} from './voiceTour';
import {answerVoicePageQuestion} from './voicePageAnswers';
import {getDashboardBriefing} from './voicePageAnswers';
import {prefixedTourCommand,tourVoiceCommandsEnabled} from './tourVoiceCommands';
import * as stockServices from './premeltService';
import * as spectrometerServices from './spectrometerService';
import * as gradeServices from './gradeSpecService';
import * as opcServices from './opcService';
import {loadedPageAnswersEnabled,isLoadedPageQuestion,loadedPageReply,loadedUnavailable} from './loadedVoiceAnswers';

// Shared by REST push-to-talk, demo transcripts and hands-free finals. This is
// the existing read-only answer path; it exposes no approve/start mutations.
export function createTranscriptHandler({ lang: currentLang, setHeard, say: speakOutput, audit: auditTurn=voiceActionApi.audit, navigate, resolveHeat, setPhraseSource = () => {}, langBridge = false, pageContext: initialPageContext = null, getPageContext, tourControl = () => false, tourActive = () => false, pageAnswerServices = null, dashboardBriefingServices=null, actionControl=null,dashboardBriefingLifecycle={begin:()=>undefined,isCurrent:()=>true} }) {
  return async function handleTranscript(text, metadata = {}) {
    // Recording/STT can outlive many streaming refreshes. Resolve the loaded
    // snapshot when the transcript arrives, retaining the caller's scope guards.
    const pageContext = getPageContext ? getPageContext() : initialPageContext;
    const questionReplyLanguage=(value,detected,current)=>autoReplyLanguageEnabled()?autoReplyLanguage(value,detected,current,true):legacyQuestionReplyLanguage(value,detected,current);
    let reportedIntent='unmatched',actionHandled=false,reasonOverride=null,reportedLevel='ASK';
    const reportIntent=value=>{reportedIntent=value;metadata.onIntent?.(value);};
    const output=(...args)=>{
      const [display,originalSpoken=display]=args;const spoken=voiceActionsEnabled()||loadedPageAnswersEnabled()?spokenOnly(originalSpoken):originalSpoken;if(spoken!==originalSpoken)args=[display,spoken,...args.slice(2)];const playback=speakOutput(...args);
      if(import.meta.env.VITE_VOICE_AUDIT!=='true'||actionHandled)return playback;
      const event={...voiceDiagnostics(text,{winner:reportedIntent,context:pageContext,reason:reasonOverride||(reportedIntent==='blocked'?'legacy_readonly_guard':reportedIntent==='no match'?'no_match':reportedIntent==='open_screen'?'nav_matched':'executed')}),page:pageContext?.route||'/',transcript:redactVoiceText(text,{transcript:true}),intent:reportedIntent,level:reportedLevel,decision:reasonOverride&&!['nav_matched','executed'].includes(reasonOverride)||/unavailable|not loaded|not understood|screen-only|can't be done/i.test(display)?'refused':'executed',spoken_reply:redactVoiceText(spoken),summary:redactVoiceText(display)};
      return Promise.all([playback,Promise.resolve().then(()=>auditTurn(event)).catch(()=>{console.info('voice_audit',{stage:'unavailable'});})]).then(()=>undefined);
    };
    const started = performance.now();
    const dashboardRequestId=dashboardBriefingLifecycle.begin();
    const lang = autoReplyLanguageEnabled()?autoReplyLanguage(text,metadata.detected_language_code,currentLang,true):loadedPageAnswersEnabled()?questionReplyLanguage(text,metadata.detected_language_code,currentLang):pickReplyLanguage(text, metadata.detected_language_code, currentLang, langBridge);
    const dispatchAction=()=>autoReplyLanguageEnabled()?actionControl(text,pageContext,{language:lang}):actionControl(text,pageContext);
    const choose = (ta, en) => lang === 'ta' ? ta : en;
    let clarityHeat = null;
    const say = (...args) => {
      if (voiceClarityEnabled() && clarityHeat) args = [args[0],clarityReply(intent,clarityHeat,params,lang,args[1]??args[0])];
      if (metadata.voiceTiming) return output(args[0], args[1] ?? args[0], lang,
        { stt_ms: metadata.stt_ms ?? null, answer_ms: performance.now() - started });
      return langBridge||loadedPageAnswersEnabled() ? output(args[0], args[1] ?? args[0], lang) : output(...args);
    };
    setHeard(text);
    setPhraseSource(null);
    const { intent, params } = mapIntent(text, { langBridge, selected:pageContext?.selected||{}, currentRoute:pageContext?.route });
    reportIntent(intent==='ask_copilot'?'no match':intent);
    if(tourActive()&&tourVoiceCommandsEnabled()){
      // Existing global safety stays first; no spoken acknowledgement or data read.
      if(intent==='blocked'||mapIntent(text,{langBridge:true}).intent==='blocked')return;
      const action=prefixedTourCommand(text);
      if(action)return tourControl(action);
      return;
    }
    if(voiceActionsEnabled()&&!tourActive()){
      const registered=registeredVoiceAction(text,pageContext?.route);
      if(registered&&actionControl&&await dispatchAction())return;
      if(neverByVoice(text,pageContext?.route)){const replyLang=questionReplyLanguage(text,metadata.detected_language_code,currentLang);await actionControl?.(text,pageContext,{refused:true});actionHandled=Boolean(actionControl);return output(screenOnly[replyLang],screenOnly[replyLang],replyLang);}
      if(!registered&&actionControl&&await dispatchAction())return;
      const elsewhere=registered||registeredVoiceAction(text);
      if(elsewhere&&(registered||elsewhere.phrase.includes(' '))){
        reasonOverride='no_target';reportedLevel=elsewhere.level;reportIntent(elsewhere.id);
        const page=voicePage(elsewhere.page)?.pageName?.[lang]||elsewhere.page;
        const message={en:`Open ${page} and select the target first.`,ta:`முதலில் ${page} பக்கத்தைத் திறந்து இலக்கைத் தேர்ந்தெடுங்கள்.`,hi:`पहले ${page} खोलकर लक्ष्य चुनिए।`}[lang];
        return output(message,message,lang);
      }
    }
    const historicalRead=loadedPageAnswersEnabled()&&!tourActive()&&(isHistoricalVoiceAsk(text)||isInvoiceVoiceAsk(text,pageContext?.route));
    if(voiceEverywhereEnabled()&&!tourActive()&&pageContext?.controls){
      const control=matchPageControl(text);
      if(control){const replyLang=questionReplyLanguage(text,metadata.detected_language_code,currentLang);const result=await pageContext.controls({...control,lang:replyLang});reportIntent(control.id);reasonOverride=result.reason_code;await output(result.text,result.text,replyLang);result.afterReply?.();return;}
    }
    if (intent === 'blocked'&&!historicalRead) {
      if(!voiceActionsEnabled()&&registeredVoiceAction(text,pageContext?.route))reasonOverride='flag_off';
      const replyLang=questionReplyLanguage(text,metadata.detected_language_code,currentLang);
      const refusal=blockedVoiceReplies[replyLang];
      return output(refusal,refusal,replyLang,...(metadata.voiceTiming?[{stt_ms:metadata.stt_ms??null,answer_ms:performance.now()-started}]:[]));
    }
    if(loadedPageAnswersEnabled()&&!tourActive()&&pageContext?.route==='/premelt-gate'&&intent==='heat_status'&&params.heatNumber!=null){
      const replyLang=questionReplyLanguage(text,metadata.detected_language_code,currentLang);
      const answer=loadedHeatStatus(pageContext,params.heatNumber,replyLang);return output(answer,answer,replyLang,{pronunciationOnly:true});
    }
    if(loadedPageAnswersEnabled()&&!tourActive()&&(historicalRead||intent==='ask_copilot'||intent==='stock_check'||intent==='element_value'&&!params.heatNumber)&&pageContext?.route!=='/dashboard'){
      const answerLang=questionReplyLanguage(text,metadata.detected_language_code,currentLang);
      const answer=voiceAskReply(text,pageContext,answerLang);
      if(answer){reportIntent(matchVoiceAsk(text,pageContext?.route)?.intent||'draft-page-answer');return output(answer.displayText,answer.spokenText,answerLang,{pronunciationOnly:true});}
    }
    if(loadedPageAnswersEnabled()&&!tourActive()&&isLoadedPageQuestion(text,pageContext?.route)){
      const replyLang=questionReplyLanguage(text,metadata.detected_language_code,currentLang);
      if(mapIntent(text,{langBridge:true}).intent==='blocked')return output(blockedVoiceReplies[replyLang],blockedVoiceReplies[replyLang],replyLang);
      reportIntent('loaded-page-answer');
      const answer=loadedPageReply(text,pageContext,replyLang);
      return output(answer.displayText,answer.spokenText,replyLang,{pronunciationOnly:true});
    }
    if(intent==='tour_control')return tourControl(params.action,params.action==='start'?questionReplyLanguage(text,metadata.detected_language_code,currentLang):undefined);
    if(tourActive()){
      const replyLang=questionReplyLanguage(text,metadata.detected_language_code,currentLang),message=tourRunningReply[replyLang];
      return output(message,message,replyLang);
    }
    if(morningBriefingEnabled()&&pageContext?.route==='/dashboard'&&isMorningBriefing(text)) {
      const answerLang=questionReplyLanguage(text,metadata.detected_language_code,currentLang);
      if(mapIntent(text,{langBridge:true}).intent==='blocked')return output(blockedVoiceReplies[answerLang],blockedVoiceReplies[answerLang],answerLang);
      reportIntent('morning-briefing');
      let answer=morningUnavailable[answerLang];
      try {const rows=await fetchMorningRows(dashboardBriefingServices?.getShiftSummaryHeats||getShiftSummaryHeats,dashboardBriefingServices?dashboardBriefingServices.getHeat:getHeat);answer=morningBriefing(rows,answerLang);}catch {/* honest unavailable */}
      if(!dashboardBriefingLifecycle.isCurrent(dashboardRequestId,answerLang,pageContext?.scope,currentLang))return;
      return output(answer,answer,answerLang,{pronunciationOnly:true});
    }
    if(intent==='dashboard_briefing') {
      const answerLang=questionReplyLanguage(text,metadata.detected_language_code,currentLang);
      const requestScope=pageContext?.scope;
      const services=dashboardBriefingServices||{getShiftSummaryHeats,getOPCStatus:opcServices.getOPCStatus};
      const briefing=await getDashboardBriefing({services});
      if(!dashboardBriefingLifecycle.isCurrent(dashboardRequestId,answerLang,requestScope,currentLang))return;
      const answer=briefing.textByLanguage[answerLang]||briefing.textByLanguage.en;
      return output(answer,answer,answerLang,...(metadata.voiceTiming?[{stt_ms:metadata.stt_ms??null,answer_ms:performance.now()-started}]:[]));
    }
    if(['stock_lots','stock_lot_detail','spectrometer_heat_reading','grade_ranges'].includes(intent)) {
      const answerLang=questionReplyLanguage(text,metadata.detected_language_code,currentLang);
      const services=pageAnswerServices||{getLots:stockServices.getLots,getLot:stockServices.getLot,getAllReadings:spectrometerServices.getAllReadings,getAllGradeSpecs:gradeServices.getAllGradeSpecs};
      const answer=await answerVoicePageQuestion({intent,params,selected:pageContext?.selected||{},lang:answerLang,services});
      if(!dashboardBriefingLifecycle.isCurrent(dashboardRequestId,answerLang,pageContext?.scope,currentLang))return;
      return output(answer,answer,answerLang,...(metadata.voiceTiming?[{stt_ms:metadata.stt_ms??null,answer_ms:performance.now()-started}]:[]));
    }
    if(intent==='open_screen'&&params.route===pageContext?.route){
      reasonOverride='nav_matched';const replyLang=questionReplyLanguage(text,metadata.detected_language_code,currentLang);const message={en:'You are already on this page.',ta:'நீங்கள் ஏற்கனவே இந்தப் பக்கத்தில் இருக்கிறீர்கள்.',hi:'आप पहले से इसी पेज पर हैं।'}[replyLang];return output(message,message,replyLang);
    }
    if(voiceEverywhereEnabled() && (intent==='page_help'||params.pageAware)) {
      // New navigation/help language picking does not alter F2/global answers.
      const pageLang=questionReplyLanguage(text,metadata.detected_language_code,currentLang);
      const pageAnswer=intent==='page_help'?pageHelp(pageContext,pageLang):navigationAnswer(params.route,pageLang);
      output(pageAnswer,pageAnswer,pageLang,intent==='open_screen'?{navigation:params.route}:undefined);
      if(intent==='open_screen')navigate(params.route);
      return;
    }
    if (intent === 'shift_summary') {
      const unwrap = response => response.data?.data ?? response.data;
      const listed = unwrap(await getShiftSummaryHeats());
      const current = await Promise.all(listed.map(async heat => isSummaryActive(heat)?unwrap(await getHeat(heat.heatId)):heat));
      const summary = buildShiftSummary(current, Date.now());
      const summaryLang = pickReplyLanguage(text, metadata.detected_language_code, currentLang, true);
      return output(summary.display, spokenShiftSummary(summary,summaryLang), summaryLang,
        metadata.voiceTiming?{stt_ms:metadata.stt_ms??null,answer_ms:performance.now()-started}:undefined);
    }
    if(intent==='ask_copilot'&&!params.bridgeAction&&pageContext?.route){reportIntent('no match');const replyLang=questionReplyLanguage(text,metadata.detected_language_code,currentLang);return output(loadedUnavailable[replyLang],loadedUnavailable[replyLang],replyLang);}
    if (!text.trim() || params.unparsedHeat || intent === 'ask_copilot' && !params.bridgeAction) return say(retryVoiceAnswer(lang));
    if (intent==='open_screen') {
      const replyLang=questionReplyLanguage(text,metadata.detected_language_code,currentLang);
      const confirmation=navigationAnswer(params.route,replyLang);
      output(confirmation,confirmation,replyLang,...(voiceEverywhereEnabled()?[{navigation:params.route}]:[]));navigate(params.route);return;
    }
    if (lang === 'hi') {
      if (params.bridgeAction === 'help') return say('हीट का स्टेटस, होल्ड का कारण या तत्व की मात्रा पूछिए। वॉइस केवल जानकारी देती है।');
      if (params.bridgeAction === 'list_holds') {
        const response = await getHeats();
        const heats = response.data?.data ?? response.data;
        const held = heats.filter(h => (h.gateResult || h.gate)?.decision === 'HOLD');
        return say(held.length ? `होल्ड पर हीट: ${held.map(h => h.heatId).join(', ')}।` : 'कोई हीट होल्ड पर नहीं है।');
      }
      if (['heat_status', 'gate_reason', 'element_value'].includes(intent)) {
        const heat = await resolveHeat(params);
        if (!heat) return say(retryVoiceAnswer(lang));
        clarityHeat = heat;
        if (intent === 'gate_reason') setPhraseSource('template');
        return say(hindiHeatAnswer(intent, heat, params));
      }
      if (intent !== 'stock_check') return say(hindiNotUnderstood);
    }
    if (intent === 'stock_check') {
      const response = await getAdditives();
      const additives = response.data?.data ?? response.data;
      const matches = additives.filter(a => !params.alloy || a.alloyName.toLowerCase().replace(/\s/g, '').includes(params.alloy.toLowerCase()));
      return say(matches.length ? matches.map(a => `${a.alloyName}: ${a.availableKg} kg${a.lowStock ? (lang === 'hi' ? ', स्टॉक कम है' : choose(', இருப்பு குறைவு', ', low stock')) : ''}`).join('. ') : lang === 'hi' ? 'स्टॉक की जानकारी नहीं है।' : choose('இருப்பு தகவல் இல்லை', 'No stock information found'));
    }
    if (intent === 'ask_copilot') {
      const response = await sendChatMessage(text, true);
      return say(response.data.response || choose('பதில் கிடைக்கவில்லை', 'No answer available'));
    }
    const heat = await resolveHeat(params);
    if (!heat) return say(retryVoiceAnswer(lang));
    clarityHeat = heat;
    const answer = heatVoiceAnswer(intent, heat, params, lang);
    if (intent === 'gate_reason') {
      if (lang === 'ta' && ['HOLD', 'WARN'].includes(heat.gateResult?.decision)) {
        try {
          const phrased = await phraseGateFacts(gatePhraseFacts(heat), heat.gateResult.decision.toLowerCase(), lang,
            spokenGateReasonAnswer(heat.gateResult, 'en'));
          if (phrased?.source === 'evon' && typeof phrased.text === 'string' && phrased.text.trim()) {
            setPhraseSource('evon');
            return say(phrased.text, phrased.text);
          }
        } catch { /* existing template is authoritative on timeout/offline/rejection */ }
      }
      setPhraseSource('template');
    }
    return say(answer, intent === 'gate_reason' ? spokenGateReasonAnswer(heat.gateResult, lang) : answer);
  };
}
