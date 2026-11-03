# MetalliSense Kural — README draft

2026-11-03. Review draft only; README.md is unchanged. Branch: f15-overnight. No publishing, training or live provider calls in this work.

## What works and who built it

The base foundry platform is joint work by Manish and Nethra (root README). Feature attribution below follows the existing feature documents and the overnight assignment, not an inference of sole authorship.

| Feature | Opt-in flags (default off unless noted) | Builder / evidence |
|---|---|---|
| Read-only PTT: status, gate reasons, chemistry and stock | Voice panel shown by default; VITE_LANG_BRIDGE for language bridge | Nethra: F2; root README records contributions from both members |
| Shared page help/navigation and new-result HOLD announcements | VITE_VOICE_EVERYWHERE; VITE_BILINGUAL_ALERT optional | Nethra: F13 plan; saved HOLD is silent on refresh |
| Loaded Stock, Spectrometer and Grade answers | VITE_VOICE_PAGE_ANSWERS + VITE_VOICE_EVERYWHERE | Nethra-owned F13b overnight extension; reads page snapshots, no question-triggered fetch |
| Short explicit Dashboard morning briefing | VITE_MORNING_BRIEFING + VITE_VOICE_EVERYWHERE | Nethra-owned F13c overnight extension; existing shift-summary data; no load-time speech |
| Navbar onboarding, selected language and approved Tamil assets | VITE_VOICE_TOUR + VITE_VOICE_EVERYWHERE; VITE_VOICE_TOUR_APPROVED_TAMIL for assets | Nethra: F14; 22 approved WAVs preserved; optional handover changes visible length |
| Prefixed microphone tour commands | VITE_VOICE_TOUR_COMMANDS | Existing F14; per-change builder attribution unverified |
| Experimental pause-v3 activation, followed by one bounded command | VITE_WAKE_WORD + backend WAKE_WORD_ENABLED | Manish, overnight; toggle OFF on load; PTT fallback |
| Read-only shift handover | VITE_HANDOVER | Manish: F7 |
| Shift summary | VITE_SHIFT_SUMMARY | Nethra: F9 |
| Latin transcript display | VITE_TRANSLITERATE + backend GNANI_TRANSLITERATE | F10; builder unverified |
| Delivery speed/clarity/number processing | VITE_TTS_STREAM, VITE_VOICE_CLARITY, VITE_SPOKEN_NORMALIZE; corresponding backend flags | Manish: F11/F11b/F11c; Nethra: F11d pronunciation |

Existing VITE_VOICE_DATA_READS and VITE_VOICE_DASHBOARD_BRIEFING retain their earlier service-backed behavior. For reviewing the new loaded-page/short-briefing variants, leave those older opt-ins false. No feature defaults or local environment files were enabled overnight.

## Models, results and rejected experiments

| Candidate | Saved evidence / outcome | Limit |
|---|---|---|
| Prisma v3.0 general STT | Existing codemix/keyterm integration and synthetic-noise comparison in root README | Synthetic noise is not foundry validation |
| Timbre | Existing configurable TTS and cache; approved Tamil tour: Kalpana / timbre-v3.0, generated with hi-IN, default speed | Generation locale is provenance; UI Tamil routing is unchanged |
| Evon v3.3 | Root README describes mock operation; live self-hosted endpoint not configured | No live quality claim |
| English Sherpa keyword candidate | 0/6 Kural positives; official English positive controls passed | English acoustic/pronunciation mismatch remains a limitation |
| Multilingual Whisper Tiny Q5_1 | 0/6; separate cropped P02_take02 also missed | Rejected configuration; not a reliable local wake detector |
| Custom CNN v1 / v2 paired | Failed frozen qualification; paired devval strict-overlap result 0/10 | Models remain offline experimental evidence; no deployment |
| Prisma pause-v1 | FAIL: snippet truncation and conversation false wake | Old evidence preserved |
| Prisma pause-v2, with keyterm | FAIL: 20/20 paired wakes but 6/10 confusable false wakes; 0/10 no-Kural questions | Keyterm bias was a hypothesis, not proven causal isolation |
| Prisma pause-v3, no keyterms | Small-screen PASS: 10/10 wakes (8 குரல், 2 குறள்), 0/10 confusables, 0/5 conversation snippets; 4.48 calls/min | One speaker, quiet/headphones, one roughly 65 s conversation; network required; approximately 1 s latency is unverified as end-to-end latency |
| F8 bias comparison | 5/6 versus 6/6 requested for this draft; supporting artifact not located in current repository/DOCS search: **unverified** | No conclusion or builder inferred |
| F12 voice clone | Mentioned in requested experiment trail; supporting outcome/license artifact not located: **unverified** | Not enabled or represented as a working feature |

Pause-v3 evidence: Agent tools/local_wake_data/kural-prisma-pause-v3/evaluation/2c520de30585837d26bb/{plan,journal,results}.json. Failed runs remain preserved. None of these small development screens establishes long-term false-activation rates, factory noise performance or playback-says-Kural resistance.

## Local review setup

Use the existing installed dependencies. Commands below start services; they do not train or synthesize a batch. From the repository root, start the Agent in one PowerShell terminal:

```powershell
Set-Location .\MetalliSense_Agent_R\MetalliSense_Agent
.\.venv\Scripts\python.exe .\app\main.py
```

Keep credentials only in the existing backend .env. For live review, its speech provider configuration must already be valid. Add the opt-in below there and restart the Agent:

```dotenv
WAKE_WORD_ENABLED=true
```

In the frontend's ignored .env.local, add only the features being reviewed:

```dotenv
VITE_SHOW_VOICE_PANEL=true
VITE_COPILOT_BASE_URL=http://localhost:8001
VITE_VOICE_EVERYWHERE=true
VITE_WAKE_WORD=true
VITE_VOICE_PAGE_ANSWERS=true
VITE_MORNING_BRIEFING=true
```

Restart Vite after editing. In a second terminal, from the repository root:

```powershell
Set-Location .\MetalliSense_Frontend_R\MetalliSense_Frontend
npm.cmd run dev:mock -- --configLoader runner
```

Open the printed local URL; choose a language, unmute and allow the mic. The new **Hands-free (Kural)** toggle remains OFF until clicked. Say Kural after at least half a second of silence. Only pause-triggered 1.5 s snippets are sent to Gnani for the wake check; wake-only recognition then captures one command (maximum 30 s). This is cloud-assisted activation, not an always-local wake detector. Activation pauses for TTS, PTT, tours and hidden tabs. Three consecutive errors switch it off; use Hold to talk.

For offline mocked review use GNANI_MOCK=true in the existing backend configuration; it makes no live speech calls and does not demonstrate recognition. Empty credentials also select existing mock speech. No key belongs in VITE_* variables.

To disable new features, remove the added lines or set all four new flags false and restart both services. Existing PTT, tour and page behavior remain available.

## Serialization and safety

Run a **single Agent worker**. All application Gnani STT/TTS, transliteration, handover, wake-check and live-stream transports share one process-wide provider lease. It is not a distributed lock across OS workers. An open legacy STT WebSocket holds the lease until it closes (up to the existing session limit); other provider work may wait or time out. Do not run that legacy continuous stream alongside this wake-mode review. Wake-check also enforces one in flight, spacing of at least 1.1 s after completion, and no more than 15 attempts per minute, conservatively counted from completion. Offline audition tools are not activated by this application and must not be launched concurrently with live review.

Voice is read-only (R5): approvals, overrides, furnace starts, stock/data writes and checks stay manual. Wake remainders and captured commands use the existing safety-first PTT handler and unchanged neutral refusal. H-1053 becomes HOLD after the manual pre-melt check; saved HOLD never speaks merely on refresh. Numbers are from loaded/saved data; unavailable data is stated plainly. Synthetic fixtures alone were used in overnight tests. No approved tour script or WAV was changed.

## Verification and manual limits

Use the exact per-task and final results in [OVERNIGHT_REPORT.md](OVERNIGHT_REPORT.md). The automated provider boundaries are mocked. Live mic ownership, browser permissions, headphones/echo, real Gnani availability, latency and spoken quality require owner review. No overnight live calls were made. The original README and its historical results remain unchanged.
