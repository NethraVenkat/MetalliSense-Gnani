    # Evon gate-fact phrasing verification

    2026-10-31. Live Evon requests: **6 / 10 authorized**. Gnani requests: **0**. No further live requests were made.

    All requests used model alias `evon`, temperature 0.6, top_p 0.95, max_tokens 100, enable_thinking=false, and user -> assistant -> user messages without a system role. Each route attempt has a six-second deadline and no retry.

    ## Outcome

    No generated reply passed validation. HOLD replies copied the generic example action and omitted the actual reasons. One Tamil WARN reply was English and included false limit comparisons; the revised WARN request timed out. Every attempt returned a template safely. This verifies rejection/fallback, not successful live phrasing. Accepted-source behavior is verified by mocked tests.

    H-1053 HOLD facts came from the unchanged actual seed and gate engine. For H-1052 WARN, an isolated in-memory scenario used the H-1053 charge with the lot released and Cu=0.27, then ran the same existing gate engine. This follows the existing WARN regression scenario; it does not claim that an untouched H-1052 reset seed produces these warnings. No seed files, real browser storage, approvals, or stock movements changed.

    Rounds: the first three model requests used the initial facts-only prompt. The next three used a fact-only draft in the final user message and explicit in-range warning risk flags. The strict validator was not weakened. Tampered input was tested in each round and rejected before the model, consuming zero requests.

    | Case | Source | Reject reason | Latency (ms) | Live requests |
    |---|---|---|---:|---:|
    | H-1053 HOLD Tamil | template | missing_reason | 3943.5 | 1 |
    | H-1052 WARN Tamil (isolated real gate-engine fixture) | template | missing_tamil | 4243.6 | 1 |
    | H-1053 HOLD English | template | missing_reason | 2686.9 | 1 |
    | Tampered facts | template | invalid_facts | 0.0 | 0 |
    | Revised H-1053 HOLD Tamil | template | missing_reason | 2985.7 | 1 |
    | Revised H-1052 WARN Tamil (isolated gate-engine fixture) | template | timeout | 6012.2 | 1 |
    | Revised H-1053 HOLD English | template | missing_reason | 2327.1 | 1 |
    | Revised tampered facts | template | invalid_facts | 0.0 | 0 |

    ## H-1053 HOLD Tamil

    Returned text:

    ```text
    Heat H-1053: Gate HOLD. PIG-1053: தனிமைப்படுத்தப்பட்டுள்ளது; காப்பர் 0.5 சதவீதம், அதிகம்.
    ```

    Source: `template`. Reject reason: `missing_reason`. Latency: 3943.5 ms.

    Raw model reply (request 1, HTTP 200):

    ```text
    Heat H-1053 HOLD. தேவையான சேர்க்கையை திரையில் approve செய்த பிறகு மீண்டும் சோதிக்கவும்.
    ```


    ## H-1052 WARN Tamil (isolated real gate-engine fixture)

    Returned text:

    ```text
    Heat H-1052: Gate WARN. கார்பன் 3.456 சதவீதம், குறைவு; காப்பர் 0.27 சதவீதம், அதிகம்.
    ```

    Source: `template`. Reject reason: `missing_tamil`. Latency: 4243.6 ms.

    Raw model reply (request 2, HTTP 200):

    ```text
    Heat H-1052 WARN. The carbon value 3.456 is above the minimum 3 and below the maximum 4, so it is within limits. The copper value 0.27 is above the maximum 0.3, so it is a warning.
    ```


    ## H-1053 HOLD English

    Returned text:

    ```text
    Heat H-1053: Gate HOLD. PIG-1053: QUARANTINED; Cu 0.5 percent, high.
    ```

    Source: `template`. Reject reason: `missing_reason`. Latency: 2686.9 ms.

    Raw model reply (request 3, HTTP 200):

    ```text
    Heat H-1053 HOLD. Approve on screen the required addition, then check again.
    ```


    ## Tampered facts

    Returned text:

    ```text
    திரையில் விவரங்களைப் பார்க்கவும்
    ```

    Source: `template`. Reject reason: `invalid_facts`. Latency: 0.0 ms.

    No raw reply: input rejected locally or the six-second deadline elapsed.


    ## Revised H-1053 HOLD Tamil

    Returned text:

    ```text
    Heat H-1053: Gate HOLD. PIG-1053: தனிமைப்படுத்தப்பட்டுள்ளது; காப்பர் 0.5 சதவீதம், அதிகம்.
    ```

    Source: `template`. Reject reason: `missing_reason`. Latency: 2985.7 ms.

    Raw model reply (request 4, HTTP 200):

    ```text
    Heat H-1053 HOLD. தேவையான சேர்க்கையை திரையில் approve செய்த பிறகு மீண்டும் சோதிக்கவும்.
    ```


    ## Revised H-1052 WARN Tamil (isolated gate-engine fixture)

    Returned text:

    ```text
    Heat H-1052: Gate WARN. கார்பன் 3.456 சதவீதம், குறைவதற்கான அபாயம்; காப்பர் 0.27 சதவீதம், அதிகரிக்கும் அபாயம்.
    ```

    Source: `template`. Reject reason: `timeout`. Latency: 6012.2 ms.

    No raw reply: input rejected locally or the six-second deadline elapsed.


    ## Revised H-1053 HOLD English

    Returned text:

    ```text
    Heat H-1053: Gate HOLD. PIG-1053: QUARANTINED; Cu 0.5 percent, high.
    ```

    Source: `template`. Reject reason: `missing_reason`. Latency: 2327.1 ms.

    Raw model reply (request 6, HTTP 200):

    ```text
    Heat H-1053 HOLD. Approve on screen the required addition, then check again.
    ```


    ## Revised tampered facts

    Returned text:

    ```text
    திரையில் விவரங்களைப் பார்க்கவும்
    ```

    Source: `template`. Reject reason: `invalid_facts`. Latency: 0.0 ms.

    No raw reply: input rejected locally or the six-second deadline elapsed.

    ## Validation

    Agent: 115 pytest tests passed, including 35 new phrasing cases. Frontend: 242 Vitest tests passed, including all 231 prior tests and 11 new cases. The frontend keeps its exact existing full/spoken template answers for rejected, disabled, offline or late requests; it does not display the server fallback text. Automatic HOLD announcements remain template-only.

    The current voice-panel flag and its local hidden value are unchanged. Browser microphone/manual UI verification was not performed. The route validates structured fact consistency and output grounding; it cannot authenticate an arbitrary caller's factory measurements. It never recomputes the gate or grants approvals.

    ## Translate mode (Oct 31)

    This is a separate verification run: **4 / 8 authorized live Evon requests**, **0 Gnani requests**. The six earlier phrase-mode requests above belong to the prior task. No additional translation requests were made.

    Translate is now the default EVON_PHRASE_MODE. Legacy phrase mode remains available explicitly. Tamil gate_reason requests send exactly the existing English spoken template and the corresponding structured facts; English gate_reason stays on its English template. Automatic HOLD alerts, blocked-intent handling and the local voice-panel flag are unchanged.

    The measured prompt is sent unchanged as one user message, with no system role or example: temperature 0.2, top_p 0.9, max_tokens 120, enable_thinking=false. Each attempt retains the six-second deadline and no automatic retry. The repeat HOLD request below was one explicit verification repeat, not route retry behavior.

    Validation requires exact source ID/number strings and their occurrence counts, Tamil script, non-echo output, and no more than one sentence beyond the source. Thus 0.50 cannot become 0.5. Surrounding quotes are stripped; ??????? H- and ??????? (H- are deterministically corrected to ???? H- and ???? (H-. Existing element and approval-wording safety guards also remain in force. No new comparisons or decisions are requested from Evon.

    Rounded English spoken values are checked against the original fact values rounded to two decimals. The remaining_reasons field carries the existing N more on screen count so that it is validated and preserved, rather than silently dropped.

    ### Results

    One WARN translation passed. Both HOLD attempts echoed English and fell back; the blocked-style translation used approval wording outside the fixed allowlist and fell back. The tampered number was rejected before a model request. These measurements do not establish that HOLD translation is reliable.

    | Case | Source | Reject reason | Latency (ms) | Live requests |
    |---|---|---|---:|---:|
    | H-1053 HOLD | template | english_echo | 3222.6 | 1 |
    | H-1052 WARN (isolated engine fixture) | evon | none | 3439.5 | 1 |
    | Blocked-style sentence (route test only) | template | unsafe_instruction | 1318.8 | 1 |
    | Tampered source number | template | invalid_english_source | 0.4 | 0 |
    | H-1053 HOLD repeat, unchanged translation prompt | template | english_echo | 1563.3 | 1 |

    ### H-1053 HOLD

    Exact English source:

    ```text
    PIG-1053: quarantined. Cu 0.50 percent, high. 1 more on screen
    ```

    Route returned:

    ```text
    Heat H-1053: Gate HOLD. PIG-1053: தனிமைப்படுத்தப்பட்டுள்ளது; காப்பர் 0.5 சதவீதம், அதிகம்.
    ```

    Source: `template`. Reject reason: `english_echo`. Latency: 3222.6 ms.

    Raw model reply (translation request 1, HTTP 200):

    ```text
    PIG-1053: quarantined. Cu 0.50 percent, high. 1 more on screen
    ```

    The frontend discards the server fallback text and keeps its unchanged Tamil spoken template:

    ```text
    PIG-1053: தனிமைப்படுத்தப்பட்டுள்ளது. செம்பு 0.50 சதவீதம், அதிகம். மேலும் 1 விவரங்கள் திரையில்
    ```


    ### H-1052 WARN (isolated engine fixture)

    Exact English source:

    ```text
    C 3.46 percent, low. Cu 0.27 percent, high
    ```

    Route returned:

    ```text
    C 3.46 சதவீதம், குறைவு. Cu 0.27 சதவீதம், அதிகம்.
    ```

    Source: `evon`. Reject reason: `none`. Latency: 3439.5 ms.

    Raw model reply (translation request 2, HTTP 200):

    ```text
    C 3.46 சதவீதம், குறைவு. Cu 0.27 சதவீதம், அதிகம்.
    ```


    ### Blocked-style sentence (route test only)

    Exact English source:

    ```text
    Please approve on screen
    ```

    Route returned:

    ```text
    Heat H-1053: Gate HOLD. திரையில் விவரங்களைப் பார்க்கவும்.
    ```

    Source: `template`. Reject reason: `unsafe_instruction`. Latency: 1318.8 ms.

    Raw model reply (translation request 3, HTTP 200):

    ```text
    தயவு செய்து திரையில் ஒப்புதல்
    ```


    ### Tampered source number

    Exact English source:

    ```text
    PIG-1053: quarantined. Cu 9.99 percent, high. 1 more on screen
    ```

    Route returned:

    ```text
    Heat H-1053: Gate HOLD. PIG-1053: தனிமைப்படுத்தப்பட்டுள்ளது; காப்பர் 0.5 சதவீதம், அதிகம்.
    ```

    Source: `template`. Reject reason: `invalid_english_source`. Latency: 0.4 ms.

    The frontend discards the server fallback text and keeps its unchanged Tamil spoken template:

    ```text
    PIG-1053: தனிமைப்படுத்தப்பட்டுள்ளது. செம்பு 0.50 சதவீதம், அதிகம். மேலும் 1 விவரங்கள் திரையில்
    ```


    ### H-1053 HOLD repeat, unchanged translation prompt

    Exact English source:

    ```text
    PIG-1053: quarantined. Cu 0.50 percent, high. 1 more on screen
    ```

    Route returned:

    ```text
    Heat H-1053: Gate HOLD. PIG-1053: தனிமைப்படுத்தப்பட்டுள்ளது; காப்பர் 0.5 சதவீதம், அதிகம்.
    ```

    Source: `template`. Reject reason: `english_echo`. Latency: 1563.3 ms.

    Raw model reply (translation request 4, HTTP 200):

    ```text
    PIG-1053: quarantined. Cu 0.50 percent, high. 1 more on screen
    ```

    The frontend discards the server fallback text and keeps its unchanged Tamil spoken template:

    ```text
    PIG-1053: தனிமைப்படுத்தப்பட்டுள்ளது. செம்பு 0.50 சதவீதம், அதிகம். மேலும் 1 விவரங்கள் திரையில்
    ```

    The blocked-style sentence was a route-only translation test using the existing English blocked reply. Actual blocked commands continue to return ???????? approve ????????? directly and never call Evon. The WARN input remains an isolated in-memory gate-engine fixture, as described above; seed files and real browser storage were not changed.

    Validation for this change: **130 Agent pytest tests passed** (15 added translation cases); **243 frontend Vitest tests passed**, retaining all 242 previous tests (one added English-template test plus updated translation assertions). Production build passed: 2,804 modules in 13.46 seconds. API keys, .env, .env.local, README, benchmark results, gate logic, seeds, intents, STT/TTS, streaming and the voice-panel flag were not changed.

    Physical microphone/browser verification was not performed. Accepted live translation is verified for the WARN sample only; HOLD fallback remains necessary.

## Translate mode v2

2026-10-31. This task used **4 / 4 authorized live Evon requests**, **0 Gnani requests**. The budget is exhausted; no retries or additional requests were made. All four upstream responses were HTTP 200.

The backend now builds full English sentences from validated structured facts, ignoring caller-supplied English text. It includes the heat decision, at most two reasons, their supplied direction and limits, and the count of remaining reasons. Element names are written in full. In-range WARN risk flags retain risk wording instead of falsely claiming a limit violation. No gate decisions or comparisons are delegated to Evon. The prompt and generation settings are unchanged from translate v1: one user message, no example or system role, temperature 0.2, top_p 0.9, max_tokens 120, enable_thinking=false, six-second timeout and no automatic retry.

The validator now requires the exact IDs and number strings (including limits and remaining-reason count) from this full source. Both Tamil temperature-word variants are normalized to the foundry heat term before validation. All prior echo, Tamil-script, extra-number and unsafe-instruction guards remain. The frontend still uses its existing Tamil template on rejection, and automatic HOLD alerts remain template-only.

These requests used explicit structured fixtures. H-1053 uses the existing quarantine/Cu gate facts. H-1052 uses the user-provided WARN example (C=2.57, minimum=3.0; Si=1.13, minimum=1.8), not a claim about the untouched reset seed. The third reason in the final HOLD fixture is the existing carbon risk warning; only its count enters the source. No seed, gate engine, browser storage or approvals changed.

### Live summary

Two translations passed: WARN and the repeated HOLD. The first HOLD echoed its source; the three-reason HOLD translated the reasons but omitted the numeric count `1`. Both were correctly rejected and returned templates. Full sentences improve the observed result over the two earlier terse HOLD echoes, but four samples do not establish reliability; fallback remains necessary.

| Case | Source | Reject reason | Latency (ms) | Live requests |
|---|---|---|---:|---:|
| H-1053 HOLD | template | english_echo | 2312.6 | 1 |
| H-1052 WARN (user-provided fixture) | evon | none | 2298.6 | 1 |
| H-1053 HOLD repeat | evon | none | 1940.3 | 1 |
| Three-reason H-1053 HOLD | template | missing_number | 2638.1 | 1 |

### H-1053 HOLD

Exact English source sent:

```text
Heat H-1053 is on HOLD. Lot PIG-1053 is in quarantine. Copper is 0.50 percent, which is above the 0.30 percent limit.
```

Raw model output:

```text
Heat H-1053 is on HOLD. Lot PIG-1053 is in quarantine. Copper is 0.50 percent, which is above the 0.30 percent limit.
```

Source: `template`. Reject reason: `english_echo`. Latency: 2312.6 ms.

Route returned:

```text
Heat H-1053: Gate HOLD. PIG-1053: தனிமைப்படுத்தப்பட்டுள்ளது; காப்பர் 0.5 சதவீதம், அதிகம்.
```

### H-1052 WARN (user-provided fixture)

Exact English source sent:

```text
Heat H-1052 has a warning. Carbon is 2.57 percent, which is below the 3.0 percent minimum. Silicon is 1.13 percent, which is below the 1.8 percent minimum.
```

Raw model output:

```text
ஹீட் H-1052-க்கு எச்சரிக்கை. கார்பன் 2.57 சதவீதம் உள்ளது, இது 3.0 சதவீத குறைந்தபட்ச அளவை விட குறைவு. சிலிக்கான் 1.13 சதவீதம் உள்ளது, இது 1.8 சதவீத குறைந்தபட்ச அளவை விட குறைவு.
```

Source: `evon`. Reject reason: `none`. Latency: 2298.6 ms.

Route returned:

```text
ஹீட் H-1052-க்கு எச்சரிக்கை. கார்பன் 2.57 சதவீதம் உள்ளது, இது 3.0 சதவீத குறைந்தபட்ச அளவை விட குறைவு. சிலிக்கான் 1.13 சதவீதம் உள்ளது, இது 1.8 சதவீத குறைந்தபட்ச அளவை விட குறைவு.
```

### H-1053 HOLD repeat

Exact English source sent:

```text
Heat H-1053 is on HOLD. Lot PIG-1053 is in quarantine. Copper is 0.50 percent, which is above the 0.30 percent limit.
```

Raw model output:

```text
ஹீட் H-1053 ஹோல்ட் நிலையில் உள்ளது. லாட் PIG-1053 குவாரண்டைன் நிலையில் உள்ளது. தாமிரம் 0.50 சதவீதம், இது 0.30 சதவீத வரம்பை விட அதிகம்.
```

Source: `evon`. Reject reason: `none`. Latency: 1940.3 ms.

Route returned:

```text
ஹீட் H-1053 ஹோல்ட் நிலையில் உள்ளது. லாட் PIG-1053 குவாரண்டைன் நிலையில் உள்ளது. தாமிரம் 0.50 சதவீதம், இது 0.30 சதவீத வரம்பை விட அதிகம்.
```

### Three-reason H-1053 HOLD

Exact English source sent:

```text
Heat H-1053 is on HOLD. Lot PIG-1053 is in quarantine. Copper is 0.50 percent, which is above the 0.30 percent limit. 1 more details are on the screen.
```

Raw model output:

```text
ஹீட் H-1053 ஹோல்ட்-ல் உள்ளது. லாட் PIG-1053 குவாரண்டைன்-ல் உள்ளது. செம்பு 0.50 சதவீதம் உள்ளது, இது 0.30 சதவீதம் என்ற வரம்பை மீறியுள்ளது. மேலும் விவரங்கள் திரையில் காட்டப்பட்டுள்ளன.
```

Source: `template`. Reject reason: `missing_number`. Latency: 2638.1 ms.

Route returned:

```text
Heat H-1053: Gate HOLD. PIG-1053: தனிமைப்படுத்தப்பட்டுள்ளது; காப்பர் 0.5 சதவீதம், அதிகம்.
```

### Verification

Agent: **150 pytest tests passed** (20 added cases beyond the prior 130), with 12 existing deprecation warnings. New coverage includes exact HOLD/WARN source construction, quarantine/hold/restricted lots, all nine requested full element names, above/below limits, risk wording, precise limits, two-reason capping and remaining counts, ignored caller text, exact limit preservation, and both temperature-word post-fixes. Frontend: **243 Vitest tests passed**, unchanged. Production build passed: **2,804 modules, 5.63 seconds**. Vitest and Vite build used `--configLoader runner` for this Windows environment.

No frontend source changes were needed for v2. No API keys, .env, .env.local, README, benchmark results, gate logic, seeds, intents, STT/TTS, streaming or voice-panel flag were changed by this task. No commit was made. Physical browser/microphone verification was not performed.
