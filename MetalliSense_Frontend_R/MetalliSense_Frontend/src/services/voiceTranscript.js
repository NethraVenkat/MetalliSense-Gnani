import { getAdditives, getHeats, getHeat, getShiftSummaryHeats } from './premeltService';
import { sendChatMessage, phraseGateFacts } from './copilotService';
import { gatePhraseFacts } from './gatePhraseFacts';
import { mapIntent } from './voiceIntents';
import { heatVoiceAnswer, spokenGateReasonAnswer } from './voiceGateAnswers';
import { pickReplyLanguage, blockedVoiceReplies, questionReplyLanguage, hindiNotUnderstood, retryVoiceAnswer } from './languageBridge';
import { hindiHeatAnswer } from './hindiVoice';
import { voiceClarityEnabled, clarityReply } from './voiceClarity';
import { buildShiftSummary, spokenShiftSummary, isSummaryActive } from './shiftSummary';
import {voiceEverywhereEnabled,navigationAnswer,pageHelp} from './voicePages';
import {tourRunningReply} from './voiceTour';
import {answerVoicePageQuestion} from './voicePageAnswers';
import {getDashboardBriefing} from './voicePageAnswers';
import {prefixedTourCommand,tourVoiceCommandsEnabled} from './tourVoiceCommands';
import * as stockServices from './premeltService';
import * as spectrometerServices from './spectrometerService';
import * as gradeServices from './gradeSpecService';
import * as opcServices from './opcService';

// Shared by REST push-to-talk, demo transcripts and hands-free finals. This is
// the existing read-only answer path; it exposes no approve/start mutations.
export function createTranscriptHandler({ lang: currentLang, setHeard, say: output, navigate, resolveHeat, setPhraseSource = () => {}, langBridge = false, pageContext = null, tourControl = () => false, tourActive = () => false, pageAnswerServices = null, dashboardBriefingServices=null, dashboardBriefingLifecycle={begin:()=>undefined,isCurrent:()=>true} }) {
  return async function handleTranscript(text, metadata = {}) {
    const started = performance.now();
    const dashboardRequestId=dashboardBriefingLifecycle.begin();
    const lang = pickReplyLanguage(text, metadata.detected_language_code, currentLang, langBridge);
    const choose = (ta, en) => lang === 'ta' ? ta : en;
    let clarityHeat = null;
    const say = (...args) => {
      if (voiceClarityEnabled() && clarityHeat) args = [args[0],clarityReply(intent,clarityHeat,params,lang,args[1]??args[0])];
      if (metadata.voiceTiming) return output(args[0], args[1] ?? args[0], lang,
        { stt_ms: metadata.stt_ms ?? null, answer_ms: performance.now() - started });
      return langBridge ? output(args[0], args[1] ?? args[0], lang) : output(...args);
    };
    setHeard(text);
    setPhraseSource(null);
    const { intent, params } = mapIntent(text, { langBridge, selected:pageContext?.selected||{} });
    if(tourActive()&&tourVoiceCommandsEnabled()){
      // Existing global safety stays first; no spoken acknowledgement or data read.
      if(intent==='blocked'||mapIntent(text,{langBridge:true}).intent==='blocked')return;
      const action=prefixedTourCommand(text);
      if(action)return tourControl(action);
      return;
    }
    if (intent === 'blocked') {
      const replyLang=questionReplyLanguage(text,metadata.detected_language_code,currentLang);
      const refusal=blockedVoiceReplies[replyLang];
      return output(refusal,refusal,replyLang,...(metadata.voiceTiming?[{stt_ms:metadata.stt_ms??null,answer_ms:performance.now()-started}]:[]));
    }
    if(intent==='tour_control')return tourControl(params.action,params.action==='start'?questionReplyLanguage(text,metadata.detected_language_code,currentLang):undefined);
    if(tourActive()){
      const replyLang=questionReplyLanguage(text,metadata.detected_language_code,currentLang),message=tourRunningReply[replyLang];
      return output(message,message,replyLang);
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
