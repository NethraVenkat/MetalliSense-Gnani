import axios from "axios";
import {transliterateEnabled} from './transcriptDisplay';

// Separate axios instance for copilot service (different base URL)
const copilotApi = axios.create({
  baseURL: import.meta.env.VITE_COPILOT_BASE_URL || "http://localhost:8001",
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});
let sttQueue=Promise.resolve();
function postStt(...args){
  if(!transliterateEnabled())return copilotApi.post(...args);
  const pending=sttQueue.then(()=>copilotApi.post(...args));
  sttQueue=pending.catch(()=>{});
  return pending;
}

/**
 * Get explanation for analysis results
 * @param {Object} data - { composition: {}, grade: string }
 * @returns {Promise} Explanation response
 */
export const getExplanation = (data) =>
  copilotApi.post("/copilot/explain", data);

/**
 * Send chat message to AI copilot
 * @param {string} message - User's question
 * @param {boolean} includeContext - Include latest analysis context
 * @returns {Promise} Chat response
 */
export const sendChatMessage = (message, includeContext = true) =>
  copilotApi.post("/copilot/chat", {
    message,
    include_context: includeContext,
  });

/**
 * Clear conversation history
 * @returns {Promise} Success response
 */
export const clearChatHistory = () =>
  copilotApi.delete("/copilot/chat/history");

/**
 * Transcribe audio to text (Speech-to-Text)
 * @param {File} audioFile - Audio file to transcribe
 * @param {string|null} language - Optional override; null uses the backend STT language
 * @returns {Promise} Transcription response
 */
export const transcribeAudio = (audioFile, language = null) => {
  const formData = new FormData();
  formData.append("audio", audioFile);
  if (language != null && language.trim() !== "") {
    formData.append("language", language);
  }

  return postStt("/copilot/voice/transcribe", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
};

export const transliterateAudio = (audioFile) => {
  if(!transliterateEnabled())return Promise.resolve({data:{unavailable:true}});
  const formData=new FormData();formData.append('audio',audioFile);
  return postStt('/copilot/voice/transliterate',formData,{
    headers:{'Content-Type':'multipart/form-data'},timeout:7000,
  });
};

/**
 * Synthesize text to speech (Text-to-Speech)
 * @param {string} text - Text to convert to speech
 * @param {string} language - Language code
 * @param {boolean} slow - Speak slowly
 * @returns {Promise} Audio blob
 */
export const synthesizeSpeech = async (text, language = "en", slow = false, style = "normal") => {
  const response = await copilotApi.post(
    "/copilot/voice/synthesize",
    {
      text,
      language,
      slow,
      style,
    },
    {
      responseType: "blob",
    }
  );
  return response.data;
};

/**
 * Get supported languages for voice services
 * @returns {Promise} Languages object
 */
export const getSupportedLanguages = () =>
  copilotApi.get("/copilot/voice/languages");

/**
 * Check copilot service health
 * @returns {Promise} Health status
 */
export const checkCopilotHealth = () => copilotApi.get("/health");

/**
 * TTS that also reports which provider actually spoke (elevenlabs | gtts).
 * @returns {Promise<{ blob: Blob, provider: string }>}
 */
export const synthesizeSpeechWithMeta = async (text, language = "en", style = "normal") => {
  const response = await copilotApi.post(
    "/copilot/voice/synthesize",
    { text, language, slow: false, style },
    { responseType: "blob", timeout: 45000 }
  );
  return { blob: response.data, provider: response.headers?.["x-tts-provider"] || "unknown",
    source: response.headers?.['x-tts-source'] || 'unknown' };
};

export const getVoiceStatus = () => copilotApi.get("/copilot/voice/status");

// Bound the entire phrasing attempt, including mock transports that might hang.
// A late result is discarded; the caller retains its existing template answer.
export async function phraseGateFacts(facts, kind, lang, englishSource) {
  const controller = new AbortController();
  let timer;
  try {
    const response = await Promise.race([
      copilotApi.post('/copilot/evon/phrase', { facts, kind, lang, english_source: englishSource, mode: 'translate' }, { timeout: 6000, signal: controller.signal }),
      new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('Phrase timeout')); }, 6000); }),
    ]);
    return response.data;
  } finally { clearTimeout(timer); }
}
