# F11c natural spoken words

2026-10-31 (Asia/Calcutta). Owner: Manish. Branch `f11c-spoken-words`. No commit.

## Scope and documentation

This changes **spoken text only**, under the existing `VITE_VOICE_CLARITY=true` flag. `VITE_VOICE_REGISTER=colloquial|formal` selects the register. When clarity is on and register is unset/invalid, colloquial is the default. `formal` reproduces F11b's original text exactly, including its existing blocked/retry wording. With clarity off, the actual app never invokes the register transformations; F11/F2/F7 paths remain unchanged. The example env and mock envPrefix document/expose the register. `.env`, `.env.local` and README were not edited.

[Gnani's normalization guide](https://docs.gnani.ai/api/TTS/tts-input-formating.md) was read before implementation. It says **"Text normalization (TN) is an automatic step"** on every synthesis. It also says **"When you set a language explicitly, they localize"**: Hindi point/percent becomes formal दशमलव/प्रतिशत, whereas auto uses English point/percent. Entirely Latin input under auto resolves to English. The guide warns that `hinglish` is not a valid language parameter. Therefore we retain explicit `ta-IN` / `hi-IN` and author the requested English loanwords in Tamil/Devanagari script. No new language code, TN parameter, speed, audio tag, voice or model is introduced.

The app's screen text, gate facts, mapper/safety rules, stock and approval behavior are unchanged. Colloquial speech is a pronunciation/layout layer; it does not approve anything or recompute a decision. Formal remains selectable. The configured Agent model/voice/speed/tag behavior is reused without production Agent code edits.

## Register rules

- Lot IDs with any supported uppercase prefix are spoken as lot number + unchanged numeric identifier. PIG-1053, DRI-1053 or SCRAP-1053 all become `லாட் நம்பர் ஆயிரத்து ஐம்பத்தி மூணு` / `लॉट नंबर एक हज़ार तिरपन`; screen IDs retain their distinct prefixes. H- remains a heat, not a lot. An existing lot label is not doubled.
- Tamil cardinals use ஒண்ணு/ரெண்டு/மூணு/நாலு/அஞ்சு and combining forms such as இருபத்தி/ஐம்பத்தி. Thousands and the established numeric grammar remain the existing F11 helper, with only the spoken lexicon changed. English register output is otherwise unchanged, apart from colloquial refusal/retry phrasing at the spoken boundary.
- Every decimal (including 0.5 and 0.50) is rendered digit-for-digit in native-script English digit words, with பாயிண்ட் / पॉइंट. All written fractional zeros are retained. Percentage becomes பர்சென்ட் / परसेंट. ID cardinal numbers are not accidentally converted into decimal digit names. Already-expanded F11 decimals are also accepted without double transformation.
- Quarantine, hold, restricted and unreleased lot states keep their supplied facts; near-limit WARN stays risk wording (`லிமிட்டுக்கு பக்கத்துல இருக்கு` / `लिमिट के पास है`), never an invented exceedance. HOLD lot wording reads the existing lot-status detail only; no factory state changes.
- Element names use the requested professional loanwords. Full English names and element symbols map only at word boundaries; unrelated words are not altered. Tamil `செம்பு` becomes `காப்பர்`, but the full screen reason still says செம்பு and retains `(Cu)` as before.
- Status, reasons, WARN/GO, HOLD alert and handover summaries share the register selection. Generic speech, blocked and retry texts use the same last speech boundary. Colloquial blocked text explicitly refuses voice approval/melting rather than telling a worker to approve. On-screen safety text and actual intent blocking are unchanged.
- At most two reasons are spoken, then `மீதி ஸ்கிரீன்ல பாருங்க` / `बाकी स्क्रीन पर`. No fact is truncated to enforce sentence length: sentences are split at eight whitespace words after expansion. The supplied HOLD targets fit without extra splitting.
- The register transform is idempotent: a structured answer can pass through the generic useSpeak boundary without duplicating Hindi है or changing decimal digits. Final spoken text naturally changes the existing cache key; no cache format change is required.

## Exact HOLD examples

Same facts: heat H-1053, HOLD; lot PIG-1053 quarantined; Cu value 0.50, maximum 0.30. Only speech changes.

Tamil colloquial:

```text
ஹீட் ஆயிரத்து ஐம்பத்தி மூணு, ஹோல்ட். லாட் நம்பர் ஆயிரத்து ஐம்பத்தி மூணு, க்வாரண்டைன்ல இருக்கு. காப்பர் அதிகமா இருக்கு. ஜீரோ பாயிண்ட் ஃபைவ் ஜீரோ பர்சென்ட். லிமிட், ஜீரோ பாயிண்ட் த்ரீ ஜீரோ.
```

Tamil formal (unchanged F11b):

```text
ஹீட் ஆயிரத்து ஐம்பத்து மூன்று, ஹோல்ட். லாட் பிக் ஆயிரத்து ஐம்பத்து மூன்று, தனிமையில் உள்ளது. செம்பு அளவு அதிகம். பூஜ்ஜியம் புள்ளி ஐந்து பூஜ்ஜியம் சதவீதம். வரம்பு, பூஜ்ஜியம் புள்ளி மூன்று பூஜ்ஜியம்.
```

Hindi colloquial:

```text
हीट एक हज़ार तिरपन, होल्ड। लॉट नंबर एक हज़ार तिरपन, क्वारंटीन में है। कॉपर ज़्यादा है। ज़ीरो पॉइंट फाइव ज़ीरो परसेंट। लिमिट, ज़ीरो पॉइंट थ्री ज़ीरो।
```

Hindi formal (unchanged F11b):

```text
हीट एक हज़ार तिरपन, होल्ड। लॉट पिग एक हज़ार तिरपन, क्वारंटीन में। कॉपर ज़्यादा है। शून्य दशमलव पाँच शून्य प्रतिशत। सीमा, शून्य दशमलव तीन शून्य।
```

Tamil refusal: `வாய்ஸ்ல அப்ரூவ் பண்ண முடியாது. மெல்டிங் ஆரம்பிக்க முடியாது.` Retry: `சரியா கேக்கல, திரும்ப சொல்லுங்க.` Hindi refusal: `वॉइस से अप्रूव नहीं होगा। मेल्टिंग नहीं होगी।` Retry: `समझ नहीं आया, फिर से बोलिए।`

## Live audition

**4 / 4 authorized TTS calls; 0 STT calls.** All four succeeded, no retry/fallback. Delivery settings read from existing configuration: **timbre-v3.0 / Kalpana**, **speed 0.9**, **GNANI_TTS_CLARITY on**, legacy GNANI_TTS_TAGS false, 22050 Hz. Clarity's existing slow/pause preparation still applies; no tag/speed setting was changed by this task.

`python tools/f11c_voice_audition.py --max-calls 4` imports/bundles the actual pure builders and uses the same facts above. The status clips additionally speak the current PLANNED status in the selected register and retain the two reasons, matching the existing status builder's behavior. The tool defaults to zero network calls, journals attempts before sending, disables fallback and never automatically repeats a marked trial. Audio and its journal are gitignored.

| WAV | Generation ms | Audio seconds | Source |
|---|---:|---:|---|
| [ta_hold_reason.wav](../app/data/tts_cache/f11c_audition/ta_hold_reason.wav) | 2200.7 | 18.14 | live |
| [hi_hold_reason.wav](../app/data/tts_cache/f11c_audition/hi_hold_reason.wav) | 2663.5 | 17.31 | live |
| [ta_status.wav](../app/data/tts_cache/f11c_audition/ta_status.wav) | 2133.5 | 20.63 | live |
| [hi_status.wav](../app/data/tts_cache/f11c_audition/hi_status.wav) | 2127.0 | 18.83 | live |

Base folder: `MetalliSense_Agent_R/MetalliSense_Agent/app/data/tts_cache/f11c_audition/`. Paths were printed by the tool. No subjective listening, browser playback or factory-floor intelligibility claim is made. Generation time is full REST synthesis, not first-audio latency. Listen before choosing which register to use for a recorded demo.

## Self-review word inventory

The following **single word table** lists distinct native-script tokens emitted by the bounded spoken builders in both registers. It includes all 1000–9999 heat-number outputs, zero-padded IDs/digit words, decimal digit sequences, all supported element/status/reason branches, GO/unknown/status/alert, handover summaries, blocked/retry/help templates and register vocabulary. Rows are grouped for readability, not ranked. Raw arbitrary user/model answer text, dynamic alloy names and externally supplied unrecognized statuses are open-ended and cannot have a finite exhaustive vocabulary; those remain visible for review in their actual answer. The inventory is a generated team-review aid, not a claim of linguistic approval.

| Language | Register | Words (Unicode-sorted groups) |
|---|---|---|
| ta | formal | அதிகம், அனுமதி, அப்ரூவ், அறுநூறு, அறுநூற்று, அறுபது, அறுபத்து, அளவு, ஆயிரத்து, ஆயிரம், ஆறு, இரண்டு |
| ta | formal | இருநூறு, இருநூற்று, இருபது, இருபத்து, இருப்பு, இரும்பு, இல்லை, உள்ளது, எச்சரிக்கை, எட்டு, எண்ணூறு, எண்ணூற்று |
| ta | formal | எண்பது, எண்பத்து, எழுநூறு, எழுநூற்று, எழுபது, எழுபத்து, ஏழு, ஐந்து, ஐந்நூறு, ஐந்நூற்று, ஐம்பது, ஐம்பத்து |
| ta | formal | ஒன்பது, ஒன்று, கட்டுப்பாடு, கார்பன், கிடைக்கவில்லை, குரோமியம், குறைந்தபட்சம், குறைவு, கூற்றை, கேட், கோ, சதவீதம் |
| ta | formal | சரிபார்க்கவும், சல்பர், சிலிக்கான், செம்பு, சொல்லுங்கள், சோதனை, தகரம், தகவல், தடைகள், தனிமைப்படுத்தப்பட்டுள்ளது, தனிமையில், திட்டமிடப்பட்டது |
| ta | formal | திரை, திரையில், திறக்கப்படுகிறது, தொண்ணூறு, தொண்ணூற்று, தொள்ளாயிரத்து, தொள்ளாயிரம், நானூறு, நானூற்று, நான்கு, நாற்பது, நாற்பத்து |
| ta | formal | நிக்கல், நிலை, நூறு, நூற்று, நெருங்குகிறது, பதினான்கு, பதினாறு, பதினெட்டு, பதினேழு, பதினைந்து, பதினொன்று, பதின்மூன்று |
| ta | formal | பதில், பத்து, பத்தொன்பது, பன்னிரண்டு, பயன்படுத்த, பயன்பாட்டுக், பார்க்கவும், பாஸ்பரஸ், பிக், புள்ளி, பூஜ்ஜியம், மாங்கனீசு |
| ta | formal | மாலிப்டினம், மீண்டும், முந்நூறு, முந்நூற்று, முப்பது, முப்பத்து, முரண்பாடுகள், மூன்று, மேலும், லாட், வரம்பு, வரம்பை |
| ta | formal | விவரம், ஹீட், ஹோல்ட் |
| ta | colloquial | ஃபைவ், ஃபோர், அஞ்சு, அதிகமா, அப்ரூவ், அறுநூறு, அறுநூற்று, அறுபது, அறுபத்தி, ஆகல, ஆயிரத்து, ஆயிரம் |
| ta | colloquial | ஆரம்பிக்க, ஆறு, இருக்கு, இருநூறு, இருநூற்று, இருபது, இருபத்தி, இருப்பு, இரும்பு, இல்ல, இல்லை, எச்சரிக்கை |
| ta | colloquial | எட்டு, எண்ணூறு, எண்ணூற்று, எண்பது, எண்பத்தி, எய்ட், எழுநூறு, எழுநூற்று, எழுபது, எழுபத்தி, ஏழு, ஐந்நூறு |
| ta | colloquial | ஐந்நூற்று, ஐம்பது, ஐம்பத்தி, ஒண்ணு, ஒன், ஒன்பது, கம்மியா, காப்பர், கார்பன், கிடைக்கவில்லை, கேக்கல, கேட் |
| ta | colloquial | கோ, க்ரோமியம், க்வாரண்டைன்ல, சரியா, சல்பர், சிக்ஸ், சிலிக்கான், செக், செவன், சொன்னதுல, சொன்னதை, சொல்லுங்க |
| ta | colloquial | ஜீரோ, டூ, தகரம், தகவல், திரும்ப, திரை, திறக்கப்படுகிறது, தொண்ணூத்தி, தொண்ணூறு, தொள்ளாயிரத்து, தொள்ளாயிரம், த்ரீ |
| ta | colloquial | நம்பர், நானூறு, நானூற்று, நாப்பத்தி, நாற்பது, நாலு, நிக்கல், நிலை, நூறு, நூற்று, நைன், பக்கத்துல |
| ta | colloquial | பண்ண, பண்ணியிருக்கு, பண்ணுங்க, பதினான்கு, பதினாறு, பதினெட்டு, பதினேழு, பதினைந்து, பதினொன்று, பதின்மூன்று, பதில், பத்து |
| ta | colloquial | பத்தொன்பது, பன்னிரண்டு, பர்சென்ட், பாயிண்ட், பாருங்க, பாஸ்பரஸ், பிக், பிரச்சனை, பிளான், பூஜ்ஜியம், மாங்கனீஸ், மாலிப்டினம் |
| ta | colloquial | மினிமம், மீதி, முடியாது, முந்நூறு, முந்நூற்று, முப்பது, முப்பத்தி, மூணு, மெல்டிங், ரிலீஸ், ரெண்டு, லாட் |
| ta | colloquial | லிமிட், லிமிட்டுக்கு, வாய்ஸ்ல, வித்தியாசம், விவரம், ஸ்கிரீன்ல, ஹீட், ஹோல்ட், ஹோல்ட்ல |
| hi | formal | अंतर, अट्ठाईस, अट्ठानवे, अट्ठावन, अट्ठासी, अठहत्तर, अठारह, अड़तालीस, अड़तीस, अड़सठ, अनुमति, अप्रूव |
| hi | formal | अस्सी, आठ, आया, इकतालीस, इकतीस, इकसठ, इकहत्तर, इक्कीस, इक्यानवे, इक्यावन, इक्यासी, उनचास |
| hi | formal | उनतालीस, उनतीस, उनसठ, उनहत्तर, उनासी, उन्नीस, उपयोग, उपलब्ध, एक, कम, करें, का |
| hi | formal | कारण, कार्बन, की, कृपया, के, केवल, कॉपर, कोई, क्रोमियम, क्वारंटीन, खुल, गेट |
| hi | formal | गो, ग्यारह, चवालीस, चार, चालीस, चेतावनी, चौंतीस, चौंसठ, चौदह, चौबीस, चौरानवे, चौरासी |
| hi | formal | चौवन, चौहत्तर, छत्तीस, छप्पन, छब्बीस, छह, छियानवे, छियालीस, छियासठ, छियासी, छिहत्तर, ज़्यादा |
| hi | formal | जाँच, जाँचें, जानकारी, जारी, टिन, तत्व, तिरपन, तिरसठ, तिरानवे, तिरासी, तिहत्तर, तीन |
| hi | formal | तीस, तेईस, तेरह, तैंतालीस, तैंतीस, दशमलव, दस, देखें, देती, दो, नब्बे, नवासी |
| hi | formal | नहीं, निकल, निन्यानवे, नौ, न्यूनतम, पंचानवे, पंद्रह, पचपन, पचहत्तर, पचास, पचासी, पच्चीस |
| hi | formal | पर, पाँच, पास, पिग, पूछिए, पैंतालीस, पैंतीस, पैंसठ, प्रतिशत, फिर, फॉस्फोरस, बत्तीस |
| hi | formal | बयालीस, बयासी, बहत्तर, बाईस, बाकी, बात, बानवे, बारह, बावन, बासठ, बीस, बोलिए |
| hi | formal | मात्रा, में, मेल्टिंग, मैंगनीज़, मॉलिब्डेनम, यह, या, योजना, रही, रुकावट, लिए, लॉट |
| hi | formal | लोहा, विवरण, वॉइस, शून्य, सड़सठ, सतहत्तर, सत्तर, सत्ताईस, सत्तानवे, सत्तावन, सत्तासी, सत्रह |
| hi | formal | समझ, सल्फर, साठ, सात, सिलिकॉन, सीमा, सीमित, से, सैंतालीस, सैंतीस, सोलह, सौ |
| hi | formal | स्क्रीन, स्टेटस, स्टॉक, स्थिति, हज़ार, हीट, है, होगी, होल्ड |
| hi | colloquial | अंतर, अट्ठाईस, अट्ठानवे, अट्ठावन, अट्ठासी, अठहत्तर, अठारह, अड़तालीस, अड़तीस, अड़सठ, अप्रूव, अस्सी |
| hi | colloquial | आठ, आया, इकतालीस, इकतीस, इकसठ, इकहत्तर, इक्कीस, इक्यानवे, इक्यावन, इक्यासी, उनचास, उनतालीस |
| hi | colloquial | उनतीस, उनसठ, उनहत्तर, उनासी, उन्नीस, उपयोग, उपलब्ध, एक, एट, कम, करें, का |
| hi | colloquial | कारण, कार्बन, की, कृपया, के, केवल, कॉपर, कोई, क्रोमियम, क्वारंटीन, खुल, गेट |
| hi | colloquial | गो, ग्यारह, चवालीस, चार, चालीस, चेतावनी, चौंतीस, चौंसठ, चौदह, चौबीस, चौरानवे, चौरासी |
| hi | colloquial | चौवन, चौहत्तर, छत्तीस, छप्पन, छब्बीस, छह, छियानवे, छियालीस, छियासठ, छियासी, छिहत्तर, ज़ीरो |
| hi | colloquial | ज़्यादा, जाँच, जाँचें, जानकारी, जारी, टिन, टू, तत्व, तिरपन, तिरसठ, तिरानवे, तिरासी |
| hi | colloquial | तिहत्तर, तीन, तीस, तेईस, तेरह, तैंतालीस, तैंतीस, थ्री, दस, देखें, देती, दो |
| hi | colloquial | नंबर, नब्बे, नवासी, नहीं, नाइन, निकल, निन्यानवे, नौ, पंचानवे, पंद्रह, पचपन, पचहत्तर |
| hi | colloquial | पचास, पचासी, पच्चीस, पर, परसेंट, पाँच, पास, पिग, पूछिए, पैंतालीस, पैंतीस, पैंसठ |
| hi | colloquial | पॉइंट, फाइव, फिर, फॉस्फोरस, फोर, बत्तीस, बयालीस, बयासी, बहत्तर, बाईस, बाकी, बात |
| hi | colloquial | बानवे, बारह, बावन, बासठ, बीस, बोलिए, मात्रा, मिनिमम, में, मेल्टिंग, मैंगनीज़, मॉलिब्डेनम |
| hi | colloquial | यह, या, योजना, रही, रिलीज़, रुकावट, लिए, लिमिट, लॉट, लोहा, वन, विवरण |
| hi | colloquial | वॉइस, शून्य, सड़सठ, सतहत्तर, सत्तर, सत्ताईस, सत्तानवे, सत्तावन, सत्तासी, सत्रह, समझ, सल्फर |
| hi | colloquial | साठ, सात, सिक्स, सिलिकॉन, से, सेवन, सैंतालीस, सैंतीस, सोलह, सौ, स्क्रीन, स्टेटस |
| hi | colloquial | स्टॉक, स्थिति, हज़ार, हीट, हुआ, है, होगा, होगी, होल्ड |


## Verification

- `python -m pytest tests -q`: **205 passed**, 12 existing deprecation warnings, **16.89 s**. No Agent production code was changed. Two existing SSE cache assertions initially inherited the locally enabled Agent clarity setting; their mock fixture now explicitly selects clarity off / speed unset, while the separate clarity-enabled test still verifies tags/speed. This isolates test defaults without editing any env file or changing delivery.
- `npx vitest run --configLoader runner`: **590 passed**, 11 files, **4.66 s**. All prior 497 tests retained; **93 added cases** cover every register lexicon entry, exact target sentences/formal snapshots, all decimal digits/trailing zeros/percentage spacing, lot prefixes/statuses, symbols/full English element names and boundaries, Tamil combining number forms, common builders/short sentences/idempotency, WARN risk, refusals/retries and immutable display/facts. F11b formal tests now explicitly select formal; a separate test verifies colloquial is the clarity-on default.
- `npm run build -- --configLoader runner`: **passed**, **2,814 modules**, **11.41 s**.
- `git diff --check` passed. WAVs/journal/generated word-review helper modules are under the ignored TTS cache. No live calls beyond the four successful requests; no STT.

## Files changed

Frontend (`MetalliSense_Frontend_R/MetalliSense_Frontend`):

- `.env.example`
- `vite.config.js` (mock register exposure)
- `vitest.config.js` (new test file)
- `src/services/voiceClarity.js`
- `src/services/voiceRegister.js` (new)
- `tests/voice-clarity.test.js` (explicit formal regression selection)
- `tests/voice-register.test.js` (new)

Agent (`MetalliSense_Agent_R/MetalliSense_Agent`):

- `tools/f11c_voice_audition.py` (new, standalone budgeted audition)
- `tests/test_tts_stream.py` (mock fixture isolation only)
- `DOCS/F11C_SPOKEN_WORDS.md` (new)

## Limits and work not performed

- No manual audio listening, browser playback, microphone test or noisy-factory evaluation. This is a word/register change, not a proven intelligibility improvement or a new pronunciation model.
- Dropping the lot prefix is intentional per the request. Two lots with the same numeric suffix will sound alike; the full prefixed ID remains visible on screen. Do not treat spoken lot numbers alone as unique inventory identifiers.
- Formal reproduces F11b's existing vocabulary/output; it intentionally does not acquire colloquial refusal or retry wording. Actual safety blocks and screen text are unchanged in either register. Colloquial spoken refusals contain no approval instruction.
- The word table covers the bounded templates/numeric grammar and their native register outputs; arbitrary external/model text and runtime alloy labels can contain additional words. Source/phrase inventory and generated review modules remain local in the audition cache for inspection.
- Long arbitrary fallback text can be split mid-clause to respect eight whitespace words; structured facts are already separate short lines. No fact is truncated. Neither register changes reason ordering/count, gate decisions, stock, approvals, F2/F7 processing, STT, Evon, tags/speed/model/voice, `.env`, `.env.local` or README.
- Unrelated `.claude/` files were left untouched. No commit.
