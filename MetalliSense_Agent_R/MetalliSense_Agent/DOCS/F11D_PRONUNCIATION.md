# F11d pronunciation audition

2026-10-31 (Asia/Calcutta). Owner: Nethra. Listening sheet and colloquial-only application. No commit.

## Current decision: step 4, English digit words inside Tamil/Hindi speech

The full-sentence audition supersedes the step 2 native-script ID choice: **V2 for Tamil, H2 for Hindi**. All colloquial heat and lot IDs now use lowercase Latin English digit words, single-spaced, preserving every digit and leading zero (`1001` = `one zero zero one`). English speech is unchanged. Native labels remain ஹீட் / லாட் நம்பர் and हीट / लॉट; lot prefixes such as PIG stay omitted. Tamil/Hindi decimals and limits keep their native-script spelling. All other step 2 choices remain in effect. Earlier examples below are historical.

Only the shared colloquial ID conversion changes, so status, reasons, WARN/GO, alerts, F9 and F7 inherit the same pronunciation. Screen text, facts, intents, safety and the formal register are unchanged. The existing sentence splitting and two-reason limit remain. Step 4 uses **0 live TTS / 0 STT calls**; selected audition clips already exist.

### Step 3 full-sentence ID audition (history)

Each variant replaces both ID phrases in the exact full HOLD reason, leaving every other word unchanged. The local [listening sheet](../app/data/tts_cache/f11d_ids/index.html) contains one row of nine labelled players with exact complete texts. Generation used current Kalpana v3.0, default speed, no tags, sequential requests: **8 TTS calls, 1 cache hit, 0 STT**. All nine WAVs succeeded and are gitignored.

| Variant | Language | Heat and lot ID phrase | File | Team choice |
|---|---|---|---|---|
| V1 | Tamil | ஒன், ஜீரோ, ஃபைவ், த்ரீ | V1_ta.wav | |
| V2 | Tamil | one zero five three | V2_ta.wav | Selected |
| V3 | Tamil | டென் ஃபிஃப்டி த்ரீ | V3_ta.wav | |
| V4 | Tamil | 1053 | V4_ta.wav | |
| V5 | Tamil | ஆயிரத்து ஐம்பத்தி மூணு | V5_ta.wav | |
| H1 | Hindi | वन, ज़ीरो, फाइव, थ्री | H1_hi.wav | |
| H2 | Hindi | one zero five three | H2_hi.wav | Selected |
| H3 | Hindi | 1053 | H3_hi.wav | |
| H4 | Hindi | एक हज़ार तिरपन | H4_hi.wav | |

Files are under `app/data/tts_cache/f11d_ids/`. Team feedback was that native-script digit IDs sounded wrong in the final full-sentence clips; the team selected V2/H2 by ear. This is a pronunciation choice, not a change to numeric facts.

### Current final text

Tamil HOLD reason (actual H-1053 gate facts, with existing remainder cue):

```text
ஹீட் one zero five three, ஹோல்ட். லாட் நம்பர் one zero five three, க்வாரண்டைன்ல இருக்கு. காப்பர் அதிகமா இருக்கு. ஜீரோ பாயிண்ட் ஃபைவ் ஜீரோ பர்சென்ட். லிமிட், ஜீரோ பாயிண்ட் த்ரீ ஜீரோ. மீதி ஸ்கிரீன்ல பாருங்க.
```

Hindi HOLD reason:

```text
हीट one zero five three, होल्ड। लॉट one zero five three, क्वारंटीन में है। कॉपर ज़्यादा है। ज़ीरो पॉइंट फाइव ज़ीरो परसेंट। लिमिट, ज़ीरो पॉइंट थ्री ज़ीरो। बाकी स्क्रीन पर।
```

Tamil shift summary (same isolated 1 HOLD / 1 GO / 1 melting snapshot used in step 2):

```text
ஷிஃப்ட் சம்மரி. ஒரு ஹீட் ஹோல்ட். ஒரு ஹீட் கோ. ஒரு ஹீட் ஃபர்னஸ்ல இருக்கு. முடிந்த ஹீட்கள் கணக்கில் இல்லை. முதல்ல ஹீட் one zero five three பாருங்க. லாட் நம்பர் one zero five three: க்வாரண்டைன்ல இருக்கு.
```

### Step 4 verification

- `python -m pytest tests -q`: **214 passed**, 12 existing warnings, **13.70 s**. The initial concurrent run failed an unchanged WebSocket silent-stop test with a 40 ms idle limit; the unchanged suite passed when rerun separately.
- `npx vitest run --configLoader runner`: **704 passed**, 13 files, **4.01 s**. Expectations now require Latin English digit words in all languages, all ten digits and leading zeros (including 1001), repeat-safe shared builders, unchanged native decimals/limits and screen/facts, and the existing 30 byte-identical formal snapshots.
- `npm run build -- --configLoader runner`: **passed**, 2,816 modules, **12.47 s**.
- `git diff --check`: passed. Step 4 changes only `src/services/voiceRegister.js`, `tests/voice-register.test.js`, `tests/shift-summary.test.js`, and this report. Earlier uncommitted step 2/3 files remain intact. No live calls and no commit.

## Settings and scope

The settings, generation counts and verification below describe the step 1 listening sheet. The supplied team choices are applied in step 2, documented at the end of this file. Step 2 changes only the colloquial speech layer; it does not change the original audition WAVs or production TTS settings.

The tool reads the current production configuration and requires timbre-v3.0 / Kalpana, clarity off, default speed (unset), and tags off. It never edits configuration or runs the production lexicon/normalizer over these supplied variant sentences. Each variant is one synthesis request; the supplied two-sentence refusals are kept verbatim. Explicit languages are ta-IN / hi-IN / en-IN.

Output sample rate: 22050 Hz, mono PCM16 WAV. The existing finalized-WAV cache and its exact model/voice/language/text/settings key are reused first. Sheet copies, HTML and the budget journal are under ignored app/data/tts_cache/f11d_sheet/.

Some variants differ in precision or meaning (half vs digit-preserving decimal, furnace vs melting, pig-iron lot description, and refusal wording). They are audition candidates only. No choice here is automatically adopted into production, and no factual/safety equivalence or subjective winner is claimed.

## Run

```powershell
python tools/f11d_pronunciation_sheet.py --max-calls 40
# Cache-only regeneration; makes no provider requests:
python tools/f11d_pronunciation_sheet.py --max-calls 0
```

Calls are strictly sequential; there are no STT calls, provider retries or fallback voices. The durable counter records an attempt before HTTP, including failures. A failed variant is not automatically retried on a later run. Budget is cumulative for this sheet, capped at 40; default is zero calls.

## Terms and choices

Open the local index.html for labelled players. The Team choice column records the supplied by-ear decisions for step 2. Each cell lists the exact full sentence and WAV filename.

| Term | Topic | A | B | C | Team choice |
|---|---|---|---|---|---|
| T1 | Heat number (ta) | ஹீட் ஆயிரத்து ஐம்பத்தி மூணு ஹோல்ட்ல இருக்கு.<br>[T1_A_ta.wav](../app/data/tts_cache/f11d_sheet/T1_A_ta.wav) | ஹீட் டென் ஃபிஃப்டி த்ரீ ஹோல்ட்ல இருக்கு.<br>[T1_B_ta.wav](../app/data/tts_cache/f11d_sheet/T1_B_ta.wav) | ஹீட் ஒன் ஜீரோ ஃபைவ் த்ரீ ஹோல்ட்ல இருக்கு.<br>[T1_C_ta.wav](../app/data/tts_cache/f11d_sheet/T1_C_ta.wav) | C |
| T2 | Decimal (ta) | காப்பர் ஜீரோ பாயிண்ட் ஃபைவ் ஜீரோ பர்சென்ட்.<br>[T2_A_ta.wav](../app/data/tts_cache/f11d_sheet/T2_A_ta.wav) | காப்பர் பாயிண்ட் ஃபைவ் ஜீரோ பர்சென்ட்.<br>[T2_B_ta.wav](../app/data/tts_cache/f11d_sheet/T2_B_ta.wav) | காப்பர் அரை பர்சென்ட்.<br>[T2_C_ta.wav](../app/data/tts_cache/f11d_sheet/T2_C_ta.wav) | A |
| T3 | Limit (ta) | லிமிட் ஜீரோ பாயிண்ட் த்ரீ ஜீரோ.<br>[T3_A_ta.wav](../app/data/tts_cache/f11d_sheet/T3_A_ta.wav) | லிமிட் பாயிண்ட் த்ரீ.<br>[T3_B_ta.wav](../app/data/tts_cache/f11d_sheet/T3_B_ta.wav) | — | A |
| T4 | Lot (ta) | லாட் நம்பர் ஆயிரத்து ஐம்பத்தி மூணு, க்வாரண்டைன்ல இருக்கு.<br>[T4_A_ta.wav](../app/data/tts_cache/f11d_sheet/T4_A_ta.wav) | லாட் டென் ஃபிஃப்டி த்ரீ, க்வாரண்டைன்ல இருக்கு.<br>[T4_B_ta.wav](../app/data/tts_cache/f11d_sheet/T4_B_ta.wav) | பிக் அயர்ன் லாட் டென் ஃபிஃப்டி த்ரீ, க்வாரண்டைன்ல இருக்கு.<br>[T4_C_ta.wav](../app/data/tts_cache/f11d_sheet/T4_C_ta.wav) | A + digit IDs |
| T5 | Melting (ta) | ஒரு ஹீட் மெல்டிங்ல இருக்கு.<br>[T5_A_ta.wav](../app/data/tts_cache/f11d_sheet/T5_A_ta.wav) | ஒரு ஹீட் உருகிட்டு இருக்கு.<br>[T5_B_ta.wav](../app/data/tts_cache/f11d_sheet/T5_B_ta.wav) | ஒரு ஹீட் ஃபர்னஸ்ல இருக்கு.<br>[T5_C_ta.wav](../app/data/tts_cache/f11d_sheet/T5_C_ta.wav) | C |
| T6 | Not checked (ta) | ஒரு ஹீட் இன்னும் செக் பண்ணல.<br>[T6_A_ta.wav](../app/data/tts_cache/f11d_sheet/T6_A_ta.wav) | ஒரு ஹீட் செக் பெண்டிங்.<br>[T6_B_ta.wav](../app/data/tts_cache/f11d_sheet/T6_B_ta.wav) | — | B |
| T7 | Summary opener (ta) | ஷிஃப்ட் சுருக்கம்.<br>[T7_A_ta.wav](../app/data/tts_cache/f11d_sheet/T7_A_ta.wav) | ஷிஃப்ட் சம்மரி.<br>[T7_B_ta.wav](../app/data/tts_cache/f11d_sheet/T7_B_ta.wav) | இந்த ஷிஃப்ட் நிலைமை.<br>[T7_C_ta.wav](../app/data/tts_cache/f11d_sheet/T7_C_ta.wav) | B |
| T8 | Counts (ta) | ஒண்ணு கோ, ரெண்டு ஹோல்ட்.<br>[T8_A_ta.wav](../app/data/tts_cache/f11d_sheet/T8_A_ta.wav) | ஒரு ஹீட் கோ, ரெண்டு ஹீட் ஹோல்ட்.<br>[T8_B_ta.wav](../app/data/tts_cache/f11d_sheet/T8_B_ta.wav) | — | B |
| T9 | Blocked (ta) | வாய்ஸ்ல அப்ரூவ் பண்ண முடியாது. ஸ்கிரீன்ல பண்ணுங்க.<br>[T9_A_ta.wav](../app/data/tts_cache/f11d_sheet/T9_A_ta.wav) | இது வாய்ஸ்ல செய்ய முடியாது. ஸ்கிரீன்ல அப்ரூவ் பண்ணுங்க.<br>[T9_B_ta.wav](../app/data/tts_cache/f11d_sheet/T9_B_ta.wav) | — | B |
| T10 | Retry (ta) | சரியா கேக்கல, திரும்ப சொல்லுங்க.<br>[T10_A_ta.wav](../app/data/tts_cache/f11d_sheet/T10_A_ta.wav) | மன்னிக்கணும், இன்னொரு தடவை சொல்லுங்க.<br>[T10_B_ta.wav](../app/data/tts_cache/f11d_sheet/T10_B_ta.wav) | — | A |
| H1 | Heat number (hi) | हीट एक हज़ार तिरपन होल्ड पर है।<br>[H1_A_hi.wav](../app/data/tts_cache/f11d_sheet/H1_A_hi.wav) | हीट टेन फिफ्टी थ्री होल्ड पर है।<br>[H1_B_hi.wav](../app/data/tts_cache/f11d_sheet/H1_B_hi.wav) | हीट वन ज़ीरो फाइव थ्री होल्ड पर है।<br>[H1_C_hi.wav](../app/data/tts_cache/f11d_sheet/H1_C_hi.wav) | C |
| H2 | Decimal (hi) | कॉपर ज़ीरो पॉइंट फाइव ज़ीरो परसेंट।<br>[H2_A_hi.wav](../app/data/tts_cache/f11d_sheet/H2_A_hi.wav) | कॉपर पॉइंट फाइव ज़ीरो परसेंट।<br>[H2_B_hi.wav](../app/data/tts_cache/f11d_sheet/H2_B_hi.wav) | — | A |
| H3 | Lot (hi) | लॉट नंबर एक हज़ार तिरपन, क्वारंटीन में है।<br>[H3_A_hi.wav](../app/data/tts_cache/f11d_sheet/H3_A_hi.wav) | लॉट टेन फिफ्टी थ्री, क्वारंटीन में है।<br>[H3_B_hi.wav](../app/data/tts_cache/f11d_sheet/H3_B_hi.wav) | — | B + digit IDs |
| H4 | Melting (hi) | एक हीट मेल्टिंग में है।<br>[H4_A_hi.wav](../app/data/tts_cache/f11d_sheet/H4_A_hi.wav) | एक हीट भट्टी में है।<br>[H4_B_hi.wav](../app/data/tts_cache/f11d_sheet/H4_B_hi.wav) | — | B |
| E1 | Heat number (en) | Heat ten fifty-three is on hold.<br>[E1_A_en.wav](../app/data/tts_cache/f11d_sheet/E1_A_en.wav) | Heat one zero five three is on hold.<br>[E1_B_en.wav](../app/data/tts_cache/f11d_sheet/E1_B_en.wav) | Heat one thousand fifty-three is on hold.<br>[E1_C_en.wav](../app/data/tts_cache/f11d_sheet/E1_C_en.wav) | B |

## Generation results

37 variants (25 Tamil, 9 Hindi, 3 English). WAVs available: **37/37**. Cumulative live TTS calls: **35/40**. STT calls: **0**.

Failed variants: none. Not yet generated: none.

Listening page: app/data/tts_cache/f11d_sheet/index.html (local, gitignored). No browser/manual listening or pronunciation ranking has been performed. The team chooses by ear; production changes are a later step.

## Verification

- `python -m pytest tests -q`: **214 passed**, 12 existing warnings, **18.57 s**. The initial run hit the pre-existing 30 ms WebSocket audio-idle timing test failure; an unchanged full-suite rerun passed. No tests or production code were edited.
- Live generation: **35 TTS calls**, **2 existing cache hits**, **37/37 WAVs ready**, **0 STT**, no failures, retries or fallback.
- Cache-only rerun: all 37 variants ready with **zero additional provider calls**.
- HTML/file checks: **15 term rows, 37 audio players, 15 blank choices**, all linked WAVs exist and are valid mono PCM16 22,050 Hz with nonzero duration. index.html exists and its audio paths remain inside the sheet folder.
- `git check-ignore` confirms index.html and WAVs are ignored by the existing app/data/tts_cache rule. Only this document and tools/f11d_pronunciation_sheet.py were added; unrelated .claude files were left untouched. No commit.

## Step 2: team-selected colloquial register

The Team choice column above is filled from the team's by-ear decisions. **Consistency decision: all heat and lot IDs are digit-by-digit in Tamil, Hindi and English**, retaining every written digit, including leading zeros. Lot prefixes such as PIG/DRI/SCRAP are dropped only in colloquial speech. Labels are ஹீட் / லாட் நம்பர், हीट / लॉट, and heat / lot. T4 A and H3 B therefore retain their selected lot-label style but use digit IDs consistently. Counts remain cardinal quantities (ஒரு, ரெண்டு, एक, one), not digit-spelled identifiers.

Tamil summary speech uses ஷிஃப்ட் சம்மரி, quantity + ஹீட் + status, ஃபர்னஸ்ல இருக்கு and செக் பெண்டிங். Hindi melting speech uses भट्टी में है. Tamil refusal speech is exactly `இது வாய்ஸ்ல செய்ய முடியாது. ஸ்கிரீன்ல அப்ரூவ் பண்ணுங்க.` Retry is unchanged. Decimal/limit spelling keeps each written digit: 0.50 stays distinct from 0.5, and 0.30 retains its final zero. Only speech changes; the screen still shows exact IDs, numbers and existing text. No mapper, safety enforcement, gate/seed, stock, approval or TTS model/voice/speed/tag setting changes were made.

The shared colloquial input boundary handles IDs before existing formal normalization, so status, reasons, WARN/GO, alerts and F7 handover summaries inherit the same spelling. F9 quantities use the original cardinal grammar separately so changing ID pronunciation does not turn a count into digit words. Formal output is protected by 30 pre-change HEAD snapshots across ten outputs in each of ta/hi/en. Sentences still use the existing eight-word split, and gate speech still selects at most two reasons plus its existing remainder cue.

### Three final samples

**3/3 authorized TTS calls, 0 STT, all successful, sequential, no retry/fallback.** The durable journal confirms completion before the turn interruption; resuming work made no additional calls. Current delivery remains timbre-v3.0 / Kalpana, clarity off, default speed, tags off, mono PCM16 22,050 Hz.

The tool `tools/f11d_final_audition.py` imports the actual updated speech builders. It uses an isolated reset of the existing mock factory, runs its existing gate checks for H-1053 (HOLD) and H-1051 (GO), and sets H-1052 to MELTING **only in that in-memory audition snapshot**, as in the F9 regression fixture. No seed file or browser/factory state changed. The snapshot has 1 HOLD, 1 GO, 1 melting, 0 unchecked; completed heats remain excluded. The extra gate remainder cue comes from the actual checked H-1053 facts, not an invented third spoken reason.

Tamil HOLD reason:

```text
ஹீட் ஒன் ஜீரோ ஃபைவ் த்ரீ, ஹோல்ட். லாட் நம்பர் ஒன் ஜீரோ ஃபைவ் த்ரீ, க்வாரண்டைன்ல இருக்கு. காப்பர் அதிகமா இருக்கு. ஜீரோ பாயிண்ட் ஃபைவ் ஜீரோ பர்சென்ட். லிமிட், ஜீரோ பாயிண்ட் த்ரீ ஜீரோ. மீதி ஸ்கிரீன்ல பாருங்க.
```

Hindi HOLD reason:

```text
हीट वन ज़ीरो फाइव थ्री, होल्ड। लॉट वन ज़ीरो फाइव थ्री, क्वारंटीन में है। कॉपर ज़्यादा है। ज़ीरो पॉइंट फाइव ज़ीरो परसेंट। लिमिट, ज़ीरो पॉइंट थ्री ज़ीरो। बाकी स्क्रीन पर।
```

Tamil shift summary:

```text
ஷிஃப்ட் சம்மரி. ஒரு ஹீட் ஹோல்ட். ஒரு ஹீட் கோ. ஒரு ஹீட் ஃபர்னஸ்ல இருக்கு. முடிந்த ஹீட்கள் கணக்கில் இல்லை. முதல்ல ஹீட் ஒன் ஜீரோ ஃபைவ் த்ரீ பாருங்க. லாட் நம்பர் ஒன் ஜீரோ ஃபைவ் த்ரீ: க்வாரண்டைன்ல இருக்கு.
```

| WAV (gitignored) | Generation ms | Audio seconds |
|---|---:|---:|
| [ta_hold_reason.wav](../app/data/tts_cache/f11d_final/ta_hold_reason.wav) | 3938.0 | 13.12 |
| [hi_hold_reason.wav](../app/data/tts_cache/f11d_final/hi_hold_reason.wav) | 4322.3 | 13.12 |
| [ta_shift_summary.wav](../app/data/tts_cache/f11d_final/ta_shift_summary.wav) | 3067.6 | 14.24 |

All three WAVs exist, have valid headers/nonzero audio and their exact input texts have at most eight words per sentence. No assistant listening/ranking or manual browser/microphone check is claimed.

### Step 2 files and checks

Frontend: src/services/voiceRegister.js, voiceClarity.js, shiftSummary.js; tests/voice-register.test.js, shift-summary.test.js; tests/f11d-formal-baseline.json (new). Agent: tools/f11d_final_audition.py (new, standalone); this document. The step 1 audition tool remains unchanged.

Final verification:

- `python -m pytest tests -q`: **214 passed**, 12 existing warnings, **18.65 s**.
- `npx vitest run --configLoader runner`: **704 passed**, 13 files, **6.20 s**. Updated colloquial expectations plus tests for the exact refusal/retry, ID digit/leading-zero preservation in all languages, quantity-vs-ID separation, unchanged screen/factory data, 30 byte-identical formal outputs, and sentence/reason limits.
- `npm run build -- --configLoader runner`: **passed**, 2,816 modules, **13.68 s**.
- `git diff --check`: passed. All 15 Team choice entries match the supplied choices. The three final WAVs are gitignored. No commit.
