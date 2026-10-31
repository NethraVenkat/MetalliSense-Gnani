# F9 spoken shift summary

2026-10-31 (Asia/Calcutta). Owner: Nethra. Branch `f9-shift-summary`. No commit.

## Follow-up fixes: melting and zero-count speech

No live calls or new audio in this follow-up. In-progress heats have a separate `melting` bucket before any gate freshness/decision check; they cannot be HOLD/WARN priority candidates, even with a saved HOLD result. Supported in-progress states are MELTING, ACTIVE, IN_PROGRESS, MELT_IN_PROGRESS, MELTING_IN_PROGRESS and IN_PROGRESS_MELT (case, spaces and hyphens normalized). Completed heats remain excluded.

Zero-count categories are omitted from speech. The existing no-HOLD sentence is spoken only when both HOLD and WARN are zero. Screen text retains all five category counts and their IDs.

`premeltService.js` only adds a read-only GET `/premelt/heats?all=1` for F9 to include history for explicit exclusion; existing `getHeats()`, gate logic and all writes are unchanged, so no revert was needed.

The checked-in reset seed still has H-1052 PLANNED. To test the requested in-progress snapshot without changing seeds, the actual-store regression checks H-1053/H-1051 using the existing engine and sets H-1052 to MELTING in its isolated test store. It then verifies **1 HOLD, 0 WARN, 1 GO, 1 melting, 0 not checked**, H-1053 priority, unchanged stock and no builder mutations. A real store with H-1052 still PLANNED must truthfully report it unchecked. The original live samples below are historical and have not been regenerated.

Current spoken examples for that in-progress snapshot, generated locally as text only:

Tamil:

```text
ஷிஃப்ட் சுருக்கம். ஒரு ஹீட் ஹோல்ட்ல இருக்கு. ஒண்ணு கோ. ஒண்ணு மெல்டிங்ல இருக்கு. முடிந்த ஹீட்கள் கணக்கில் இல்லை. முதல்ல ஹீட் ஆயிரத்து ஐம்பத்தி மூணு பாருங்க. லாட் நம்பர் ஆயிரத்து ஐம்பத்தி மூணு: க்வாரண்டைன்ல இருக்கு.
```

Hindi:

```text
शिफ्ट सारांश। एक हीट होल्ड पर है। एक गो। एक मेल्टिंग में है। पूरे हुए हीट गिनती में नहीं। पहले हीट एक हज़ार तिरपन देखिए। लॉट नंबर एक हज़ार तिरपन: क्वारंटीन में है।
```

English:

```text
Shift summary. one heat on HOLD. one GO. one melting. Completed heats excluded. Check heat ten fifty-three first. Lot pig ten fifty-three: quarantined.
```

Follow-up verification: Agent **205 passed**, 12 existing warnings, **10.45 s**; frontend **649 passed**, 12 files, **5.15 s**; production build **passed**, 2,815 modules, **7.48 s**. Nine new cases cover in-progress states with absent/expired/GO/HOLD/WARN gates, priority exclusion, all three spoken languages, zero-category omission, WARN-only suppression of the no-HOLD sentence, and sentence lengths. Existing seed regression now explicitly tests the melting snapshot. Changed in this follow-up: `shiftSummary.js`, `shift-summary.test.js`, `mock-unit.test.js`, and this report. No commit.

## Feature flag and aliases

`VITE_SHIFT_SUMMARY=false` is the default, documented in the frontend example env and exposed in mock mode. `.env` and `.env.local` were not edited. With the flag off, no shift_summary intent or demo chip is added; existing mapping/answers remain unchanged.

The read-only `shift_summary` intent is checked **after** the existing action safety blocks, before heat/stock/navigation slots. Matching now uses Unicode word tokens after existing case/punctuation/spoken-number normalization, in any order and script. Match either a SHIFT word plus a SUMMARY word, or a SUMMARY word plus an ask verb:

- SHIFT: shift, swift, sift, ஷிஃப்ட், ஷிப்ட், शिफ्ट, शिफ़्ट.
- SUMMARY: summary, samari, summery, சுருக்கம், சம்மரி, सारांश, समरी.
- Ask: sollu, சொல், சொல்லு, சொல்லுங்க, batao, बताओ, बताइए, बता, tell, give.

The existing count questions (`எத்தனை ஹோல்ட்`, `kitne hold hai`, `कितने होल्ड`, `how many heats on hold`) match as bounded phrases within an utterance. The original Tamil shift-status phrase remains supported. Any normalized numeric token prevents shift_summary, leaving heat/element/reason handling unchanged; this includes Tamil/Hindi/English spoken numbers and native digits. Matching uses original normalized script before bridge-specific alias rewriting, so batao remains an ask verb. Tokens do not match inside unrelated longer words (e.g. swiftly/storyteller).

Original supported examples remain valid:

- shift summary
- summary sollu
- இந்த ஷிஃப்ட் சுருக்கம் / இந்த ஷிஃப்ட் சுருக்கம் சொல்லு
- ஷிஃப்ட் நிலைமை என்ன
- எத்தனை ஹோல்ட்
- shift summary batao
- kitne hold hai
- आज की शिफ्ट का सारांश
- how many heats on hold

Punctuation/case normalization uses the current mapper. `summary approve karo`, melting/override/permission phrases still hit safety first. No approval, gate check, charge, stock movement, release or start operation is exposed by this intent. Existing safety conditions were not widened or weakened.

### Real-mic matching follow-up

Both failed real-mic transcripts now map to shift_summary with the flag enabled: `இந்த shift சுருக்கம் சொல்.` and `swift summary बताओ।`. Twenty-seven additional regression cases cover these, other Tamil/Latin/Devanagari mixes and word orders, punctuation, flag-off behavior, keyword boundaries, safety precedence and numeric heat exclusions. `1053 summary` retains the existing heat_status result; other numbered requests are tested against their exact flag-off mapper result. No live STT/TTS calls or new audio were used. Only the mapper, its shift-summary tests and this report changed in this follow-up; no commit.

Verification for this matching fix: `python -m pytest tests -q` **205 passed**, 12 existing warnings, **20.62 s**; `npx vitest run --configLoader runner` **676 passed**, 12 files, **6.45 s**; `npm run build -- --configLoader runner` **passed**, 2,815 modules, **14.78 s**. All 649 preceding frontend tests remain passing. Manual microphone verification remains with the team.

## Store-derived counts and priority

The handler calls the existing read-only heat list with `all=1`, so completed/history records are available for explicit exclusion. It then GETs current details for each planned/active heat. It does not use a prior answer, cached summary, model response or synthetic fixture to produce the UI summary.

Included statuses: PLANNED, MELTING, ACTIVE and IN_PROGRESS. COMPLETED is excluded and stated on screen and in speech; other inactive statuses are excluded and counted separately on screen. This is a summary of current planned/active heats, not a calendar/time-range shift-history query: the factory store has no new shift-boundary filter in this task.

Each included heat belongs to exactly one bucket: HOLD, WARN, GO, melting, or not checked / expired. In-progress status takes precedence over gate data. For planned heats, missing/unrecognized decisions, stale summaries or detailed results, explicit expired markers, and elapsed/invalid validUntil are counted as not checked. Equality at the expiry boundary is expired. An expired GO is never counted as GO.

Priority is the numerically ordered first HOLD heat; if none, first WARN. This deterministic order is documented rather than suggesting a severity score. Only its first non-AI blocking/warning check/detail is summarized. Lot state, element value/direction, or a short known check explanation comes from that same result. Remaining reasons are not spoken. With no HOLD/WARN, no heat is invented as a priority.

The list/detail GETs fetch current data at each asking. They are read-only sequential snapshots, not a backend-wide atomic transaction. Counts use the completed detail reads and one current time value. A decision can change after the response, especially during speech; the feature never authorizes an action based on the summary.

The new handler returns screen text and separate spoken text through the existing `say`/useSpeak path. No Evon/chat/Gnani LLM call is made. The summary-only language pick uses the current script/Hinglish picker: Tamil/Hindi questions can be answered in that language without altering the F2 handler behavior for any other intent. Plain English follows the current voice toggle. Existing STT and TTS settings and streaming paths are untouched.

## Spoken layout

Counts are deterministic number words from the existing spoken-number grammar. Priority IDs use the current clarity/register pipeline, so a clarity-enabled colloquial Tamil summary uses ஆயிரத்து ஐம்பத்தி மூணு and a spoken lot number rather than changing the screen ID. `formal` remains available; with clarity off, F9 uses formal speech formatting without changing any existing intent's speech. Sentences are bounded to eight whitespace-separated words after expansion. No count or reason is truncated.

Only nonzero bucket counts are spoken. When HOLD and WARN are both zero, speech uses the requested explicit no-HOLD wording: `எந்த ஹீட்டும் ஹோல்ட்ல இல்ல` / `कोई हीट होल्ड पर नहीं है` / `No heats on hold`. Completed exclusion is also spoken. The first priority reason is an extra short fact sentence, not every reason of that heat.

## Original seed verification and live sample (before follow-up)

Fresh Reset does **not** contain precomputed gate decisions. H-1051, H-1052 and H-1053 are PLANNED with gate=null; H-1043 is COMPLETED and excluded. The initial summary is therefore **0 HOLD, 0 WARN, 0 GO, 3 not checked**. H-1053's charge is designed to return HOLD **when its existing gate check runs**, not before.

For the audition, an isolated in-memory copy of the real mock store was reset and the existing unmodified gate engine checked H-1053 and H-1051. Results: H-1053 HOLD, H-1051 GO, H-1052 unchecked. No seed file, real browser storage or production factory state was modified. Historical completed and other inactive seed records are excluded as normal.

Exact screen text from that store:

```text
Shift summary: 1 HOLD (H-1053), 0 WARN, 1 GO (H-1051), 1 not checked / expired (H-1052). Completed heats excluded: 32. Other inactive heats excluded: 6. Check H-1053 first: PIG-1053 quarantined.
```

These 32 completed / 6 other inactive records come from the unchanged existing history seeds; they are not added to inflate the summary. The integration test independently checks active counts, H-1043 exclusion, unchanged stock/gates, and a later WARN decision set only in the isolated test store.

Tamil colloquial spoken sample:

```text
ஷிஃப்ட் சுருக்கம். ஒரு ஹீட் ஹோல்ட்ல இருக்கு. பூஜ்ஜியம் எச்சரிக்கை. ஒண்ணு கோ. ஒண்ணு இன்னும் செக் பண்ணல. முடிந்த ஹீட்கள் கணக்கில் இல்லை. முதல்ல ஹீட் ஆயிரத்து ஐம்பத்தி மூணு பாருங்க. லாட் நம்பர் ஆயிரத்து ஐம்பத்தி மூணு: க்வாரண்டைன்ல இருக்கு.
```

Hindi spoken sample:

```text
शिफ्ट सारांश। एक हीट होल्ड पर है। शून्य चेतावनी। एक गो। एक अभी चेक नहीं हुआ। पूरे हुए हीट गिनती में नहीं। पहले हीट एक हज़ार तिरपन देखिए। लॉट नंबर एक हज़ार तिरपन: क्वारंटीन में है।
```

English spoken sample:

```text
Shift summary. one heat on HOLD. zero WARN. one GO. one not checked. Completed heats excluded. Check heat ten fifty-three first. Lot pig ten fifty-three: quarantined.
```

The examples retain all counts and the first quarantine reason. They do not speak the second Cu blocker. Zero-state, WARN-only priority, expired checks, unknown decisions and completed-only/empty stores are tested without any provider requests.

## Live audition: 3 / 3 TTS calls, 0 STT

`python tools/f9_shift_summary_audition.py --max-calls 3` built the real isolated mock snapshot and generated one sample per language. All three succeeded with no fallback/retry. Three local setup commands failed before any synthesis while adapting the standalone runner to Vite's import.meta.glob/CJS loader; those consumed zero provider calls. The final tool uses Vite's module loader in middleware mode, a network-blocked in-memory factory snapshot, and a durable three-attempt journal for TTS.

The text samples explicitly demonstrate colloquial clarity formatting. Delivery reused the current configuration at execution: timbre-v3.0 / Kalpana, provider-default speed (unset), Agent clarity off, legacy tags false. This task did not enable or alter those settings. No TTS latency optimization or speech-quality comparison is claimed.

| File | Generation ms | Audio seconds | Source |
|---|---:|---:|---|
| [ta_summary.wav](../app/data/tts_cache/f9_shift_summary/ta_summary.wav) | 2680.0 | 16.96 | live |
| [hi_summary.wav](../app/data/tts_cache/f9_shift_summary/hi_summary.wav) | 4125.9 | 15.36 | live |
| [en_summary.wav](../app/data/tts_cache/f9_shift_summary/en_summary.wav) | 3203.9 | 12.64 | live |

WAVs and the journal are gitignored in `app/data/tts_cache/f9_shift_summary/`. The tool prints the absolute paths. Default max-calls=0 is cache-only; recorded trials are not automatically retried. No further TTS calls or STT calls were made. No listening-based intelligibility, manual microphone or browser playback verification was performed.

## Reproduction

1. Externally enable VITE_SHIFT_SUMMARY and restart Vite; this task did not edit a local env file. For the spoken colloquial sample, use the existing clarity/register flags as desired.
2. Pre-Melt Gate -> Reset. Ask for shift summary: three active heats should be unchecked, not already HOLD/GO.
3. Select H-1053 -> Run pre-melt check. Select H-1051 -> Run pre-melt check. These are existing manual clicks, not voice actions.
4. Ask `இந்த ஷிஃப்ட் சுருக்கம் சொல்லு`, `shift summary batao`, or `shift summary`, or use the new **Shift summary** chip in mock Demo transcripts. Expect one HOLD, zero WARN, one GO, one unchecked, priority H-1053 and only its quarantine reason.
5. A subsequent ask rereads the store. Expired checks move to unchecked; completed heats never join the active buckets.

## Verification

- `python -m pytest tests -q`: **205 passed**, 12 existing deprecation warnings, **8.77 s**. No Agent production or test changes for F9.
- `npx vitest run --configLoader runner`: **640 passed**, 12 files, **3.93 s**. All 590 prior cases retained; **50 added** cover all ten aliases/flag defaults, no collisions, safety precedence, counts/IDs/exclusions, stale and expired boundaries, priority, mutable store snapshots, ta/hi/en short speech/zero cases, first WARN reason, fresh GET-only handler/no LLM or mutation, actual reset/check seed integration, and the flag-gated demo chip.
- `npm run build -- --configLoader runner`: **passed**, **2,815 modules**, **5.93 s**.
- `git diff --check` passed. No commit. No changes to gate logic, seeds, prior intent/answer behavior when the flag is off, safety blocks, F2/F7/F11 implementations, STT/TTS settings, Evon, `.env`, `.env.local` or README.

## Files changed

Frontend (`MetalliSense_Frontend_R/MetalliSense_Frontend`):

- `.env.example`
- `vite.config.js`
- `vitest.config.js`
- `src/services/voiceIntents.js`
- `src/services/premeltService.js`
- `src/services/voiceTranscript.js`
- `src/services/shiftSummary.js` (new)
- `src/components/voice/PushToTalk.jsx`
- `tests/shift-summary.test.js` (new)
- `tests/mock-unit.test.js`
- `tests/voice-panel.test.jsx`

Agent (`MetalliSense_Agent_R/MetalliSense_Agent`):

- `tools/f9_shift_summary_audition.py` (new, standalone tool only)
- `DOCS/F9_SHIFT_SUMMARY.md` (new)

Unrelated `.claude/` files were left untouched. Remaining manual work is real microphone/browser/speaker review by the team; the three-call live budget is fully used.
