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
