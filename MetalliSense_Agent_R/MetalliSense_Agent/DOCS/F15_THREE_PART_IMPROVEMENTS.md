# Page answers, wake capture/timing and Kural panel improvements

2026-11-03, Asia/Calcutta. Current branch preserved. Builders: Part A Nethra; Parts B+C Manish. No stage, commit or push. No training, model/threshold changes, tour integration changes or approved-audio edits.

## Part A — Nethra

Stock uses the approved Tamil opening, whole quantities without .00, real decimal quantities retained, localized kg and RELEASED/QUARANTINE labels in ta/hi/en. QUARANTINED is also recognized because that is the actual mock lot status; other statuses remain unchanged. IDs remain English digits. Spectrometer element values retain the existing two-decimal formatting.

Root causes and fixes:
- **Spectrometer:** “Latest readings.” already matched the old /latest|reading/ pattern; plural/case/punctuation were not its primary defect. Browser instrument readings explicitly have heatId=null when no heat is melting. The answer rejected the entire loaded reading for that missing field. It now gives its real chemistry/time and states that the heat ID is unavailable. Existing loaded data also stays usable during the page's periodic refresh loading state. Added all requested aliases; an empty reading list clears the page's stale latestReading.
- **Grades:** old substring matching required the exact SG-IRON spelling, and no default grade was selected unless the detail view was open. Case/space/hyphen variants and SGI now resolve to the real spec. A question without an explicit match uses the selected or first visible grade. Registration follows the page's filtered list. No new fetch is triggered by these answers.
- **Briefing:** the list endpoint returns only a gate summary; the detail endpoint additionally returns the complete gateResult. Morning briefing used F9's expiry-aware decision grouping, whereas status answers displayed the saved gateResult decision without applying expiry. The new morning path reads active heat details through the same getHeat service as status answers, and groups copies by that saved status. The F9 summary, gate expiry/fingerprint checks, furnace permissions, HOLD enforcement and original objects remain unchanged. This is a status report, not authorization to melt. Reasons come from the returned checks, including the actual failing copper value/limit when present; no H-1053 result is hard-coded. Removed the inactive/completed-exclusion sentence from the spoken briefing.

Final approved remainder lines, including the user's correction:
- Tamil: **மீதி ஸ்கிரீன்ல பாருங்க**.
- Hindi: **बाकी जानकारी स्क्रीन पर देखें।**
- English: **See the rest on screen.**

Files (F = MetalliSense_Frontend_R/MetalliSense_Frontend):
- F/src/services/loadedVoiceAnswers.js; morningBriefing.js; voiceTranscript.js.
- F/src/services/hindiVoice.js; voiceClarity.js; voiceGateAnswers.js (remainder wording only).
- F/src/pages/Spectrometer.jsx; GradeSpecs.jsx.
- F/tests/page-answer-improvements.test.js (new: seven ta/hi/en, saved-status and detail-source checks).
- F/tests/loaded-page-answers.test.js; language-bridge.test.js; mock-unit.test.js; voice-clarity.test.js; voice-register.test.js (approved wording/quantity expectations; safety/reason-cap assertions retained).
- F/tests/morning-briefing.test.js received UTF-8 normalization only; its assertions remain.

Existing flags: VITE_VOICE_PAGE_ANSWERS, VITE_MORNING_BRIEFING and shared VITE_VOICE_EVERYWHERE; defaults unchanged. These answers still run after the global write/refusal guard.

## Part B — Manish

The validated local onset rule remains 20 ms / RMS .01 / preceding 0.5 s silence / 100 ms speech / initial silence credit, with the same first 1.5 s snippet, no keyterms and the same first-word matches. Its frame observer now retains PCM locally while the wake response is pending. If speech continues at the snippet boundary, confirmed wake takes one full-utterance STT path from that same onset, after 0.8 s quiet or the 30 s cap, and strips the leading wake word with the existing rule. It never also submits the partial remainder. If speech ended within the snippet, the remainder is used directly, with no second STT. Failed checks never query or enter Thinking. Wake-only still displays Listening and silently returns to Waiting after six seconds without speech.

A short local Web Audio tone accompanies Listening unless muted. It creates no TTS request or audio file. Real speaker/echo behavior remains a manual check.

The server now reuses one process-wide Requests Session for synchronous wake-check, REST STT/TTS and optional Evon calls, inside the unchanged provider lease. Session adapters have zero retries. Legacy offline audition budget guards on requests.post remain honored instead of being bypassed by pooling. Async streaming/transliteration/batch transports retain their existing HTTP client lifecycles and shared lease. Wake timeout stays 15 seconds; all other configured timeouts and the one-in-flight / 1.1 s / 15-per-minute wake limits are unchanged. Use one Agent worker as before.

Console events `kural_timing` contain turn/stage/ms/observed_ms only, with no transcript/audio: speech_onset, wake_request_sent, wake_response, command_end, answer_received and actual first_audio_played. Onset/end estimates use the existing 20 ms local audio frames; short-utterance command_end may precede response time even though it is reported after the response. observed_ms makes that distinction explicit. No audible first-audio event is fabricated when muted or playback fails. This is diagnostic timing, not a benchmark or industrial latency guarantee.

Expected improvement: the quiet tail is 200 ms shorter than the former 1.0 s rule. Keep-alive can avoid repeated connection/TLS setup when the provider permits reuse; no measured network speedup is claimed. Long commands become complete, but require one sequential full-utterance STT after wake confirmation; short commands avoid that extra call. The mandatory 1.5 s wake snippet is unchanged.

Files (A = MetalliSense_Agent_R/MetalliSense_Agent):
- A/app/copilot/provider_calls.py.
- A/tests/test_provider_calls.py (keep-alive/zero-retry and legacy budget-guard regressions).
- A/tests/conftest.py (new suite-wide Requests network prohibition).
- A/tests/test_gnani_tts.py; test_language_bridge.py; test_transliterate.py; test_wake_check.py; test_wake_runtime_import.py; test_evon_phrase.py (mock transport target follows the reused session; assertions retained).
- F/src/services/wakeWord.js; new wakeTiming.js; src/hooks/useWakeWord.js; src/hooks/useSpeak.js.
- F/src/components/voice/PushToTalk.jsx (timing context and first-playback callback; shared with Part C).
- F/tests/wake-experience.test.js (new: long/short routing, retained onset PCM, wake stripping, timing order and muted cue); tests/wake-word.test.js (0.8 s endpoint and timing-context expectations, existing cancellation/refusal checks retained).
- F/.env.example; vite.config.js; vitest.config.js (development badge flag/test registration).

During the initial transport-mock migration, one timeout test still patched requests.post rather than the pooled session. It reached a blocked socket and got no provider response. The mock was corrected and an autouse Requests network guard was added before the successful rerun. No successful live provider request occurred; no cloud response or audio was generated. The first failed logs remain as evidence.

## Part C — Manish

New KuralWakePanel is mounted only behind the existing VITE_WAKE_WORD flag. Default Off is grey/static; Waiting pulses softly; Listening uses actual capture RMS for its ring; Thinking uses an arc; Speaking follows actual playback (separate from the echo guard); Error is amber with the existing note. Tamil/Hindi/English primary labels, a small English state, highlighted wake in Heard, an answer card, explicit toggle and privacy copy are present. No library was added. Message area has a fixed internal scroll region to avoid content-driven page shifts; width is bounded. Dark colours and reduced-motion rules are scoped to the panel. Reduced motion disables animation/transform/opacity modulation.

Files:
- F/src/components/voice/KuralWakePanel.jsx and KuralWakePanel.css (new).
- F/tests/kural-wake-panel.test.jsx (new: state mapping, UTF-8/highlight, explicit off toggle, reduced-motion/bounds styles).
- F/src/components/voice/PushToTalk.jsx; src/hooks/useWakeWord.js; src/hooks/useSpeak.js (shared B/C: panel placement, real RMS and actual playing state). Old PTT, legacy hands-free, language/mute controls and tour hiding remain.

Styled local Chromium component fixture, with all external requests aborted and no microphone requested: desktop 1280 px panel bounds x=332,width=616; narrow 360 px panel x=12,width=336, no horizontal overflow. Default toggle was false before click. Narrow dark/reduced-motion Listening had animationName=none. Final dark colours after theme settling: background rgb(21,38,30), foreground rgb(224,241,231), opacity 1. Screenshots inspected: orb-desktop.png; orb-narrow-dark-reduced.png. This is a synthetic component/layout check, not actual microphone, audible playback or full-app validation.

## Flags, review and verification

No local .env or flag defaults were changed. Optional **development-only** timing badge:

```dotenv
VITE_VOICE_TIMING=true
```

Put that in the existing ignored frontend .env.local and restart Vite. The documented default is false; the badge is omitted from production even if set. Existing wake opt-ins remain backend WAKE_WORD_ENABLED=true and frontend VITE_WAKE_WORD=true; existing page-answer and morning flags still gate Part A. Console timing is emitted only by active wake sessions, independently of showing the badge. Restart the Agent to load the pooled transport and reload the page to clear any old capture session.

Focused results: 23 frontend feature checks passed; 257 remainder/safety/register checks passed; 67 provider-focused checks passed; 32 guard/audition/telephony checks passed. The first full run surfaced old approved-wording expectations, a UTF-8 BOM/import-analysis issue, and offline tooling hooks that pooling must preserve. Those were corrected without dropping or weakening safety, reason limits, request caps or audio checks. Final full sequence and protected-hash result are appended below.

Evidence root: tools/local_wake_data/kural-three-parts-20fc4b42f51f4a27a13056a69159080c/. All generated browser bundles/screenshots/logs remain ignored. Remaining manual checks: real mic onset/continuation, audible cue and echo/headphones, live keep-alive/latency, long and short commands, and full-app narrow/dark placement. No training, S03 use, deployment, staging, commit or push.

Final sequential results: **1,298 Vitest tests passed (26 files), 34.84 s; 372 mocked Agent pytest tests passed, 12 existing warnings, 114.93 s; production build passed in 29.90 s**. All 919 protected file hashes remain unchanged, including tour WAVs, devval-v1/v2, paired data, CNN artifacts and pause-v3 journals. All 22 built production tour WAV hashes match the approved manifest. Staged and unstaged diff checks pass. No commit or push.
