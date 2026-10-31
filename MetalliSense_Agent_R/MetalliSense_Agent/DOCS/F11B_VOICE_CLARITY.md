# F11b voice clarity audition

2026-10-31 (Asia/Calcutta). Owner: Manish. Branch `f11b-voice-clarity`. No commit.

## Documentation checked before code

- [Audio tags](https://docs.gnani.ai/api/TTS/tts-audio-tags.md) says tags use exact, case-sensitive `<tag>` syntax. **"There is no closing tag."** Scope is from insertion to the next tag or end of input. Supported v3.0 tags: `<laugh>`, `<giggle>`, `<sigh>`, `<exhales>`, `<sniffles>`, `<yawns>`, `<coughs>`, `<clears throat>`, `<whispers>`, `<shouting>`, `<excited>`, `<slow>`, `<pauses>`.
- The same page says **"Audio tags work identically on the SSE streaming endpoint."** `<pauses>` inserts silence and is not spoken. v2.5 strips tags; unknown tags are stripped. Tags count as billable characters. We use only documented slow and pauses, with no invented close/reset tag or volume parameter.
- Both [REST](https://docs.gnani.ai/api/TTS/tts-inference.md) and [SSE](https://docs.gnani.ai/api/TTS/tts-sse.md) document **speed**, default **1.0**, range **0.85–1.15**, and slow/medium/fast aliases. We expose a validated numeric override and audition 0.9; blank/unset preserves the provider default.
- [Voices](https://docs.gnani.ai/api/TTS/available-voices.md): every v3.0 voice speaks all ten languages. Kalpana is female, warm/empathetic, described as composed. Avinash is male/professional with deliberate pacing; Prakash is male/professional, steady and deliberate; Harshad is male/professional and firm. These catalog descriptions motivated the audition set; they are not a subjective clarity ranking.
- [Normalization guide](https://docs.gnani.ai/api/TTS/tts-input-formating.md): automatic normalization runs on every synthesis request; ordinary numbers, percentages and common abbreviations need not be globally rewritten. F11's targeted custom ID/trailing-zero rules remain. F11b additionally supplies native-script foundry words and short fact sentences; it does not replace the provider's entire normalization engine.

**Difference from the request's phrasing:** a slow tag cannot be wrapped/closed around only a number phrase because the API has no documented closing or neutral-reset tag. We slow each short fact sentence (including its number) and reapply slow after the pause that separates sentences. Neither voice/model nor pitch/volume is changed. Clearer perception must be chosen by listening, not inferred from successful HTTP responses.

## Flags and behavior

- Frontend `VITE_VOICE_CLARITY=false` default. Exposed in mock mode; disabled tests preserve the prior F11 payload byte for byte. When enabled, facts-based spoken builders select at most two gate reasons and add `மேலும் விவரம் திரையில்` / `बाकी स्क्रीन पर` when more remain. Structured values and limits come from the same gate snapshot as the screen.
- Agent `GNANI_TTS_CLARITY=off` default. When enabled on v3.0, final provider text gets `<slow>` at sentence start and `<pauses>` between sentences. v2.5 fallback uses plain text. Tags are inserted only server-side and never reach display text.
- `GNANI_TTS_SPEED` is optional, blank by default. With Agent clarity on, accepted numeric values are 0.85–1.15; invalid values fail configuration instead of silently choosing a pace. With clarity off, the speed override is ignored and omitted, retaining F11 behavior.
- The existing cache key retains its old bytes when speed is unset. With speed set, the effective speed joins the key. The actual final tagged text is already in the key, and both SSE and REST use the same preparation/key. Changing tags or speed therefore cannot reuse a differently delivered clip.
- Frontend clarity works independently of VITE_SPOKEN_NORMALIZE. With clarity enabled it uses the existing custom ID/trailing-zero helper, then whole-word native replacements and sentence splitting. Exact IDs are expanded before word/symbol replacement; substrings in unrelated words remain intact. Element symbols become native names and redundant symbol brackets are removed. Screen text is never passed through this function.
- Status, gate reasons, WARN/GO and element answers use dedicated structured speech; blocked/retry/help/general replies use bounded sentence formatting at the last TTS boundary. HOLD alerts remain once-only and preserve Tamil-then-Hindi ordering when F2 is enabled. The F7 speak button gets a dedicated short fact summary, without changing F7 cross-checks or display. Sentences contain at most eight whitespace-separated words after ID/number expansion; unusually long sentences are split rather than truncated, preserving all content.
- Existing near-limit WARN facts keep risk wording, rather than falsely saying a value exceeds a limit. Quarantined/restricted/unreleased lots retain their actual statuses. Extra reasons are not spoken. Existing safety replies remain blocked on screen and read-only; native pronunciation of approve is not approval authorization.

## Requested screen number consistency fix

Only numeric formatting in detailed Tamil gate reasons changed: value `toFixed(2)`, maximum limit at least two decimals, minimum at least one, extra precision preserved using the same helper as Hindi/full-sentence source. Thus H-1053 displays **செம்பு (Cu) 0.50 சதவீதம்; அதிகபட்ச வரம்பு 0.30 ...**. All words, brackets and reason content on screen are otherwise unchanged. A minimum of 3 becomes 3.0. Corresponding screen regression assertions were updated. Speech removes the redundant (Cu), but the screen keeps it.

## Before -> after examples

These use the identical H-1053 facts: HOLD, PIG-1053 quarantined, Cu value 0.50/max 0.30. No gate calculation is delegated to speech code. English examples are deterministic text-only; the live audition is Tamil/Hindi only.

Tamil before (F11 speech input):

```text
ஹீட் ஆயிரத்து ஐம்பத்து மூன்று HOLD. பிக் ஆயிரத்து ஐம்பத்து மூன்று: தனிமைப்படுத்தப்பட்டுள்ளது. செம்பு பூஜ்ஜியம் புள்ளி ஐந்து பூஜ்ஜியம் சதவீதம், அதிகம்.
```

Tamil clarity:

```text
ஹீட் ஆயிரத்து ஐம்பத்து மூன்று, ஹோல்ட். லாட் பிக் ஆயிரத்து ஐம்பத்து மூன்று, தனிமையில் உள்ளது. செம்பு அளவு அதிகம். பூஜ்ஜியம் புள்ளி ஐந்து பூஜ்ஜியம் சதவீதம். வரம்பு, பூஜ்ஜியம் புள்ளி மூன்று பூஜ்ஜியம்.
```

Hindi before (F11 speech input):

```text
हीट एक हज़ार तिरपन होल्ड पर है। लॉट पिग एक हज़ार तिरपन क्वारंटीन में है। कॉपर शून्य दशमलव पाँच शून्य प्रतिशत है, सीमा शून्य दशमलव तीन शून्य से ज़्यादा।
```

Hindi clarity:

```text
हीट एक हज़ार तिरपन, होल्ड। लॉट पिग एक हज़ार तिरपन, क्वारंटीन में। कॉपर ज़्यादा है। शून्य दशमलव पाँच शून्य प्रतिशत। सीमा, शून्य दशमलव तीन शून्य।
```

English before:

```text
heat ten fifty-three: PLANNED. Gate HOLD. Cu zero point five zero percent, high.
```

English clarity (same HOLD/reason facts):

```text
heat ten fifty-three, HOLD. Lot pig ten fifty-three, in quarantine. Cu is high. zero point five zero percent. Limit, zero point three zero.
```

Examples of native substitutions: HOLD -> ஹோல்ட் / होल्ड; WARN/warning -> எச்சரிக்கை / चेतावनी; GO -> கோ / गो; Gate -> கேட் / गेट; status -> நிலை / स्थिति; PLANNED -> திட்டமிடப்பட்டது / योजना में; approve -> அப்ரூவ் / अप्रूव. Native element names are copied from the app's existing Tamil/Hindi terminology. No speculative foundry-word aliases were added to the intent mapper.

Tagged delivery shape (server-only, illustrative):

```text
<slow> ஹீட் ஆயிரத்து ஐம்பத்து மூன்று, ஹோல்ட். <pauses> <slow> செம்பு அளவு அதிகம். <pauses> <slow> பூஜ்ஜியம் புள்ளி ஐந்து பூஜ்ஜியம் சதவீதம்.
```

## Live audition: 10 / 12 TTS requests, 0 STT

`python tools/f11b_voice_audition.py --max-calls 12` generated eight clarity clips and two Kalpana before clips. All ten succeeded, no fallback, no retry. One initial local import error occurred before any HTTP call and consumed zero requests. Remaining two spare calls were not used. The configured voice and all env files remain unchanged; the audition uses per-process/per-instance delivery settings only.

Clarity clips use v3.0, speed **0.9**, documented pause/slow tags, current sample rate and the exact builder outputs above. Kalpana before clips use the current F11 voice text, provider-default speed and clarity off. The original tag flag is respected by the production client; these normal-style before clips have no alert tags. Before/after therefore compare the combined wording + pause + pacing change, not an isolated voice variable.

All WAVs are local and gitignored under `app/data/tts_cache/f11b_audition/`. The tool prints absolute paths, persists its attempt count before I/O, caps at 12, disables fallback and does not automatically retry a failed trial. Default max-calls=0 is cache-only. These are synthetic examples, not a microphone recording or a human subjective evaluation.

| Voice | Tamil clarity WAV | Hindi clarity WAV | Persona basis |
|---|---|---|---|
| Kalpana | [Kalpana_ta.wav](../app/data/tts_cache/f11b_audition/Kalpana_ta.wav) | [Kalpana_hi.wav](../app/data/tts_cache/f11b_audition/Kalpana_hi.wav) | Current composed voice |
| Avinash | [Avinash_ta.wav](../app/data/tts_cache/f11b_audition/Avinash_ta.wav) | [Avinash_hi.wav](../app/data/tts_cache/f11b_audition/Avinash_hi.wav) | Deliberate professional pacing |
| Prakash | [Prakash_ta.wav](../app/data/tts_cache/f11b_audition/Prakash_ta.wav) | [Prakash_hi.wav](../app/data/tts_cache/f11b_audition/Prakash_hi.wav) | Steady professional delivery |
| Harshad | [Harshad_ta.wav](../app/data/tts_cache/f11b_audition/Harshad_ta.wav) | [Harshad_hi.wav](../app/data/tts_cache/f11b_audition/Harshad_hi.wav) | Firm professional delivery |

Kalpana before: [Tamil](../app/data/tts_cache/f11b_audition/Kalpana_ta_before.wav), [Hindi](../app/data/tts_cache/f11b_audition/Kalpana_hi_before.wav).

| Voice / variant | Tamil generation ms / audio seconds | Hindi generation ms / audio seconds |
|---|---|---|
| Kalpana clarity | 2466.7 / 20.06 | 2202.0 / 18.64 |
| Avinash clarity | 2864.0 / 19.42 | 2800.4 / 18.37 |
| Prakash clarity | 2407.8 / 18.55 | 2657.6 / 17.46 |
| Harshad clarity | 1762.3 / 19.08 | 1898.5 / 18.52 |
| Kalpana before | 3913.3 / 11.68 | 4647.7 / 12.48 |

These are REST full-generation times, not first-audio SSE latency. The clarity clips are intentionally longer because facts are separated, numbers/limits spoken explicitly and delivery slowed. Do not interpret shorter generation time as proof of clearer audio. Listen to the local WAVs to choose; no listening-based ranking, manual playback or real-factory intelligibility result is claimed.

## Verification

- `python -m pytest tests -q`: **205 passed**, 12 existing deprecation warnings, **19.53 s**. All 197 prior cases retained; eight added cases cover exact supported tag syntax, no closing tags/v2.5 stripping, 0.9 REST speed passthrough and separate cache identity, blank/off speed omission, four invalid speeds, and SSE tags/speed with the identical REST cache key. All HTTP in tests is mocked.
- `npx vitest run --configLoader runner`: **497 passed**, ten files, **5.97 s**. All 466 prior cases retained; 31 added cases cover native replacements/boundaries/ID preservation, short fact builders for ta/hi/en, exact gate value/limit strings and immutable facts/display, two-reason cap/remainder, status/WARN/GO/alert/blocked/retry sentences, risk handling, handover summaries, flag-off F11 payload identity and stripping speech tags. Existing Tamil screen assertions were updated only for the requested numeric precision.
- `npm run build -- --configLoader runner`: **passed**, **2,813 modules**, **9.45 s**.
- `git diff --check` passed. Example flags remain off/false and speed blank. Existing `.env`, `.env.local`, configured model/voice, README, STT, intents/safety, Evon, seeds, gate calculations and F2/F7 logic were not edited. The only F7 component edit is the flagged optional spoken summary, not cross-check behavior.

## Files changed

Agent (`MetalliSense_Agent_R/MetalliSense_Agent`):

- `.env.example`
- `app/copilot/gnani_client.py`
- `app/copilot/gnani_tts_stream.py`
- `tests/test_gnani_tts.py`
- `tests/test_tts_stream.py`
- `tools/f11b_voice_audition.py` (new)
- `DOCS/F11B_VOICE_CLARITY.md` (new)

Frontend (`MetalliSense_Frontend_R/MetalliSense_Frontend`):

- `.env.example`
- `vite.config.js`
- `vitest.config.js`
- `src/services/voiceClarity.js` (new)
- `src/services/voiceGateAnswers.js`
- `src/services/voiceTranscript.js`
- `src/hooks/useSpeak.js`
- `src/components/voice/ShiftHandover.jsx` (speech-only flag)
- `tests/voice-clarity.test.js` (new)
- `tests/mock-unit.test.js` (numeric-format assertions)

## Remaining manual checks / limits

- Pick the preferred voice by listening. This task did not select or configure a new voice and did not measure actual factory-floor intelligibility. Native wording should be reviewed by the team before a recorded demo.
- The eight-word boundary is based on whitespace and is a speech-layout heuristic, not a linguistic sentence parser. A long arbitrary non-template answer may be divided mid-clause; the complete display text is unchanged. Structured gate builders already emit one fact per short sentence.
- This audition measures the combined phrasing/tags/speed settings, not a controlled subjective study of each setting. Extra pauses and a slower speed lengthen playback, even though SSE can begin quickly.
- Live audition used REST WAV. SSE tag/speed behavior is documented and tested with mocked upstream PCM; no extra SSE tag-check request was spent. No microphone recording, human voice sample, browser playback or STT call was made.
- Generated WAVs, cache files, locally bundled text helper and attempt journal remain under the gitignored TTS cache. No keys or real names/phone numbers are included. Unrelated `.claude/` files remain untouched. No commit.
