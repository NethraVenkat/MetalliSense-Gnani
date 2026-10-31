import { getAdditives } from './premeltService';
import { sendChatMessage, phraseGateFacts } from './copilotService';
import { gatePhraseFacts } from './gatePhraseFacts';
import { mapIntent } from './voiceIntents';
import { heatVoiceAnswer, spokenGateReasonAnswer } from './voiceGateAnswers';

// Shared by REST push-to-talk, demo transcripts and hands-free finals. This is
// the existing read-only answer path; it exposes no approve/start mutations.
export function createTranscriptHandler({ lang, setHeard, say, navigate, resolveHeat, setPhraseSource = () => {} }) {
  const choose = (ta, en) => lang === 'ta' ? ta : en;
  return async function handleTranscript(text) {
    setHeard(text);
    setPhraseSource(null);
    const { intent, params, reply } = mapIntent(text);
    if (intent === 'blocked') return say(reply[lang]);
    if (intent === 'open_screen') { say(choose('திரை திறக்கப்படுகிறது', 'Opening screen')); navigate(params.route); return; }
    if (intent === 'stock_check') {
      const response = await getAdditives();
      const additives = response.data?.data ?? response.data;
      const matches = additives.filter(a => !params.alloy || a.alloyName.toLowerCase().replace(/\s/g, '').includes(params.alloy.toLowerCase()));
      return say(matches.length ? matches.map(a => `${a.alloyName}: ${a.availableKg} kg${a.lowStock ? choose(', இருப்பு குறைவு', ', low stock') : ''}`).join('. ') : choose('இருப்பு தகவல் இல்லை', 'No stock information found'));
    }
    if (intent === 'ask_copilot') {
      const response = await sendChatMessage(text, true);
      return say(response.data.response || choose('பதில் கிடைக்கவில்லை', 'No answer available'));
    }
    const heat = await resolveHeat(params);
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
