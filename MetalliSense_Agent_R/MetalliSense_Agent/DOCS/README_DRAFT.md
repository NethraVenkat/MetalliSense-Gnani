# MetalliSense Kural — README review draft

2026-11-04. This is DOCS/README_DRAFT.md, not the root README. Local draft; nothing published or committed.

## What Kural is

Kural is the foundry application's opt-in Tamil/Hindi/English voice interface. ASK reads loaded page facts and explanations. RUN and APPROVE use the same existing service functions as screen buttons, with explicit confirmation, role checks, target freshness and audit evidence. Spoken predictions are estimates, not measurements. Voice never turns H-1053 HOLD into GO or bypasses safety by recognizing a phrase.

## Features and flags

All optional feature flags below are off by default; existing flags/defaults were not changed. The hands-free switch requires explicit opt-in. Restart the relevant process after changing its temporary shell configuration. Never put credentials into VITE_*.

| Feature | Frontend flags | Agent flags / notes |
|---|---|---|
| Page voice context, read-only help | VITE_VOICE_EVERYWHERE | Existing page snapshots; no invented data |
| Approved loaded-page wording / briefing | VITE_VOICE_PAGE_ANSWERS / VITE_MORNING_BRIEFING | Selected/current data and read-only answers |
| Navbar tour / approved Tamil playback | VITE_VOICE_TOUR / VITE_VOICE_TOUR_APPROVED_TAMIL, with VITE_VOICE_EVERYWHERE | 22 packaged WAVs; no synthesis for approved-asset path |
| Experimental pause-v3 hands-free | VITE_WAKE_WORD | WAKE_WORD_ENABLED; command-only activation is an experiment, not qualified local detection |
| Voice actions | VITE_VOICE_ACTIONS | VOICE_ACTIONS_ENABLED plus VOICE_AUDIT_ENABLED; configured identities required |
| Grouped audit viewer | VITE_VOICE_AUDIT | VOICE_AUDIT_ENABLED |
| Optional local wake/command audio evidence | VITE_VOICE_AUDIO_LOG | VOICE_AUDIO_LOG_ENABLED; excludes secret captures |
| Timing diagnostics | VITE_VOICE_TIMING | Development timing, not a guaranteed latency |
| New live-word plumbing | VITE_LIVE_WORDS | LIVE_WORDS_ENABLED; currently returns unavailable, no provider stream |
| Explicit final-transcript mock replay | VITE_LIVE_WORDS_MOCK, with VITE_LIVE_WORDS | Clearly labelled MOCK; no extra mic/socket/provider calls in mock replay |
| New pronunciation input pass | VITE_PRONOUNCE_PASS | TTS text only; reviewed pronunciationOnly payloads/approved assets bypass it |

See [LIVE_WORDS.md](LIVE_WORDS.md), [PRONUNCIATION_TABLE.md](PRONUNCIATION_TABLE.md), [F17_VOICE_ACTIONS.md](F17_VOICE_ACTIONS.md) and [F14_VOICE_TOUR.md](F14_VOICE_TOUR.md). No active tour WAV, narration order or global language mapping was changed.

## Run locally

Agent terminal, from MetalliSense_Agent_R/MetalliSense_Agent:

```powershell
$env:GNANI_MOCK='true'
$env:EVON_MOCK='true'
.\.venv\Scripts\python.exe .\app\main.py
```

Frontend terminal, from MetalliSense_Frontend_R/MetalliSense_Frontend:

```powershell
npm.cmd run dev:mock -- --configLoader runner
```

Agent: http://localhost:8001. UI: http://localhost:5173. Mock mode is for disposable local data. Existing provisioned backend-only credentials/identities remain owner-managed; this draft contains no key or passcode and no setup that overwrites local configuration. For actions enable the temporary flags and follow [LIVE_TEST_CHECKLIST.md](LIVE_TEST_CHECKLIST.md). With no selected/loaded target, missing identity or disabled audit, expect refusal rather than guessed execution. No live provider access was exercised overnight.

## R5 and spoken approvals

The earlier read-only voice scope now has explicit tiers. ASK remains read-only. RUN reads back then captures yes/no once after playback; eight seconds without words is timeout, with no execution. APPROVE reads all relevant facts, requests a private spoken passcode, checks the server-owned role and a one-use target-bound approval token, then allows five seconds to Cancel. Destructive DELETE/RESET/CLEAR and HOLD OVERRIDE require their exact additional word. The server and page service remain final authority. Unit Controller is the only HOLD override role; normal start still refuses HOLD. CSV/file ingestion stays screen-only.

This is not voice biometrics, unrestricted authorization or production access control certification. Local approval/session state is single-Agent-process scope; stale targets, insufficient role, backend failures and cancellation must never display success. See F16_VOICE_FOUNDATION.md, F17_VOICE_ACTIONS.md and app/copilot/voice_auth.py / voice_policy.py.

## Security and local evidence

Gnani credentials remain server-side. Approval records use salted PBKDF2-HMAC-SHA256 (300,000 iterations in voice_auth.py), with server role policy and lockout. Audit events form a hash chain for tamper evidence, not a claim that local files cannot be deleted. APPROVE text is masked. AudioLog accepts only wake/command purposes and refuses no_store/sensitive captures, so passcodes/secret confirmations are not retained by that path. Optional audio has a default seven-day retention and startup/periodic purge (voice_audio_log.py, voice_foundation.py). This is audio retention, not a promise that all audit/configuration files expire in seven days. Keys and raw passcodes must not appear in transcripts, logs, browser storage, Git or screenshots.

## Wake-word journey — development evidence

| Candidate / screen | Actual recorded result | Source |
|---|---|---|
| English Sherpa-ONNX 2.0.1 / GigaSpeech 3.3M | KURAL 0/6 positives; both official English controls passed; false activations unmeasured. Unchanged keyword threshold .25, score 1 | F14_LIVE_KURAL_DIAGNOSTIC.md, “Existing Sherpa benchmark”; F14_LOCAL_KURAL_PROTOTYPE.md |
| Original CNN baseline | All 20 S02 wakes missed; best checkpoint also predicts the majority nonwake class on training windows | F14_KURAL_BASELINE_DIAGNOSIS.md |
| Binary/negative-context v1 checkpoint | At .50: 12/20 S02 wake misses, 109 ordinary false events, 52 echo events; no qualified threshold | F14_KURAL_CONTEXT_VALIDITY.md, “Single negative-context v2 experiment completed” |
| Paired CNN v2 vs v1 | Both 0/10 strict-overlap devval matches at every fixed threshold. At .50, v1 conversation/confusable events 69/0; v2 71/3. S02 fails for both at all four thresholds; rejected | F14_LIVE_KURAL_DIAGNOSTIC.md, “Single authorized paired-v2 experiment completed — FAIL”; F14_KURAL_PAIRED_V2_EXPERIMENT.md |
| Prisma pause-v1 | FAIL: 14 successful calls before interruption; truncated wake snippets and a conversation false wake; incomplete negatives | F14_LIVE_KURAL_DIAGNOSTIC.md, pause-v1 result |
| Prisma pause-v2 with keyterm | FAIL: 20/20 wake clips, but 6/10 confusables transcribed as Kural; keyterm bias was a hypothesis, not isolated causal proof | F14_LIVE_KURAL_DIAGNOSTIC.md, pause-v2 paired result |
| Prisma pause-v3, no keyterm | Small predeclared screen PASS: 25 successful calls, 10/10 wakes, 0/10 confusables, 0/5 conversation snippets; 4.48 onsets/min on that conversation | F14_LIVE_KURAL_DIAGNOSTIC.md, user-run plan 2c520de30585837d26bb |

These are short, inspected development/validation screens, not a reliable long-term false-activation bound or unseen-speaker generalization. Pause-v3 requires network STT and the existing local pause gate; it does not run a qualified local keyword model. CNN experiments remain rejected, original evidence is preserved, S03 remains reserved; its last recorded status is “S03 not available, not evaluated.” No S03 recording was accessed for this work.

## Known limits

Repository integration treats Evon as an optional self-hosted/open-weights path behind an OpenAI-compatible chat endpoint, rather than inventing a public Gnani Evon API. See app/copilot/evon_explainer.py (default model gnani/gnani-evon-v3.3-30B-A3B, locally configured base) and existing deployment notes. This is the repository's integration choice, not a new external availability claim. Empty base defaults to mock; no weights were downloaded and no endpoint probed.

Streaming STT uses one locale per session (ta-IN, hi-IN or en-IN). Existing gnani_stream.py documents final utterance transcripts and processing acknowledgements, not verified interim-word emission. The new /ws/live-words therefore honestly reports unavailable and does not forward ambient audio or hold the shared lease. Final REST speech/answer behavior stays unchanged. The mock replay starts only from a real final transcript and is labelled MOCK. Missing interim message semantics and lease-compatible provider behavior must be verified before real live words can be enabled.

Pronunciation spelling changes are input corrections only; human listening is still required. No new requests, SSML or language tags are added. Approved tour playback bypasses the pass. Other languages/unknown grade IDs/slash-date ambiguity are not guessed.

## Who built what

- Application and foundry workflow: TODO
- ASK wording and page answers: TODO
- Voice interaction, actions and approvals: TODO
- Tour and approved narration: TODO
- Experimental wake research and evidence: TODO
- Review and testing: TODO
