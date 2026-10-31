# F8 live context bias

2026-10-31 (Asia/Calcutta). Recognition hints only; no commit. Both flags default off. This measurement did **not** demonstrate improved heat-number accuracy: an out-of-context heat was changed to an on-screen heat.

## Documentation checked before code

- [Prisma v3.0 context](https://docs.gnani.ai/api/STT/models/prisma-v3.md): keyterms are “up to 200 items”; REST accepts a JSON array or comma-separated words/short phrases. Static foundry terms come first. The page does not specify a per-keyterm character limit. Our **64-character per-client-term limit is a local input safeguard**, not a provider specification. Over-limit context can return INVALID_CONTEXT. No topic, previous_text, substitution or speaker hints are added here.
- [Realtime STT](https://docs.gnani.ai/api/STT/stt-websocket.md): “On Prisma v3.0 the keyterms list is changed through the `bias` key.” An update takes effect from the next segment; an invalid update is ignored as a whole. The documented control frame is `{"type":"update_settings","bias":{"list":[...],"score":1.0}}`; allowed scores are 0.0, 0.5, 1.0, 1.5, 2.0. A successful update returns settings_updated. Prisma v3.0 uses keyterms and **ignores bias_score**, so the configurable score is not a measured strength control for this model. The 100 letters-only single-word restriction belongs to v2.5 word boosting, not v3.0 keyterms.
- [Limits](https://docs.gnani.ai/api/STT/limits.md): REST audio is limited to 30 seconds; keyterms allow “Up to 200 words or short phrases”. The streaming provider cap is 15 minutes; our existing proxy retains its shorter 60-second session and 10-second client-audio idle limit.

## Design and flags

`VITE_CONTEXT_BIAS=false` and `GNANI_CONTEXT_BIAS=off` preserve the previous STT upload fields. Neither local env file was edited. Example env files document opt-in flags and `GNANI_CONTEXT_BIAS_SCORE=1.0` (invalid scores fall back to 1.0). STT model/language/format defaults, F2 locale handling and hands-free single-locale behavior remain unchanged.

The pure frontend builder reads only heatId/status/charge.lotId from the existing factory GET responses. It chooses the selected heat first (even if outside the current active list), then numerically sorted planned/active heats, up to ten total. Variants are `H-1053`, `heat 1053`, `1053`, plus sorted lot IDs such as `PIG-1053`. Completed heats are otherwise excluded. Known in-progress states are included. Arbitrary descriptions, transcript text, operators and element prose are never used as hints. IDs are validated against fixed ID patterns. Terms are deduped case-insensitively and deterministic; static default terms are reserved first under the 200-item budget. The Agent independently merges its actual configured static terms first, so customized static lists also win.

While a voice panel is mounted and the frontend flag is on, a read-only GET refresh checks the current list/selected heat once per second without overlapping requests. No new gate checks or writes are performed. PTT uses the latest context ref at upload time. A list-fetch failure clears dynamic hints rather than retaining stale IDs. With the flag off the polling effect does not run and no context_terms form field/control frame is sent.

REST carries context_terms as JSON in multipart form data. The Agent accepts only lists, at most 200 entries, at most 64 characters each, charset `[A-Za-z0-9- ]`, collapses spaces and removes duplicates/invalid entries. Payload JSON is bounded to 16 KiB. The final Prisma keyterms list includes existing static terms first, then validated dynamic terms, capped at 200. When the Agent flag is off, even supplied hints are ignored and the old request parameters are identical. Omitted hints also preserve the old request.

For hands-free, the browser sends only our control `{type:"context_terms",terms:[...]}` when the set changes and after connection/reconnection. The Agent never forwards raw client settings: it validates and rebuilds one provider update_settings frame after a **one-second trailing-edge debounce**, merging static terms. Audio frames retain their existing pacing, queue, echo guard, stop/commit and reconnection behavior. No reconnect is needed for a hint update. Provider settings_updated is reduced to a safe type/count response; echoed provider config is discarded. Missing confirmation after three seconds logs ignored/unconfirmed, which is **not proof** that the provider rejected it. Invalid client entries and send failures log an ignored outcome. No term text/provider error body is logged.

GET `/copilot/voice/status` adds `context_bias` (boolean) and `context_bias_last_term_count` (last merged/attempted total, zero when off). Counts are diagnostic, not proof of recognition accuracy or provider acceptance.

## REST A/B measurement

**24 / 24 REST STT calls, 2 / 6 allowed TTS calls**, no retries. Four existing clips were reused; two H-1052 clips were synthesized with the currently configured Timbre voice. No existing noise-bench result/cache/report or README number was edited. The new standalone tool keeps audio/results in ignored `app/data/tts_cache/f8_context_bias/` with a durable attempt budget. Default call budgets are zero; completed attempts are not retried.

Both arms use Prisma v3.0, ta-IN,en-IN, codemix, and the same configured static foundry keyterms. The WITH arm appends variants for H-1051, H-1052, H-1053 and PIG-1053 (24 total terms). Pair order alternates; each pair receives byte-identical audio. Noise is the existing deterministic `synthetic_clanks.wav` mixed by the unchanged noise-bench mixer at 0 and 5 dB. This is a **synthetic factory-like clank test**, not real foundry audio or a repeated statistical study.

Six independent reference phrases:

| Clip | Expected text | Heat | Source |
|---|---|---:|---|
| heat_1051_english | What is the status of heat 1051 | 1051 | existing noise-bench clean WAV |
| heat_42_tanglish | Heat 42 epdi irukku | 42 | existing noise-bench clean WAV; deliberately outside context |
| heat_1053_tanglish | heat 1053 status enna | 1053 | existing F2 cached Tamil clip 07 |
| heat_1053_reason | 1053 en hold | 1053 | existing F2 cached Tamil clip 08 |
| heat_1052_tamil | ஹீட் ஆயிரத்து ஐம்பத்தி ரெண்டு நிலை என்ன | 1052 | new TTS |
| heat_1052_english | What is the status of heat 1052 | 1052 | new TTS |

Heat accuracy requires successful STT and the exact expected heatNumber extracted by the unchanged actual frontend mapper/number parser. It is **heat-only**, not intent accuracy, WER, or a manual correction of transcript numbers. HTTP failures would count as incorrect; all 24 requests succeeded.

| SNR | WITHOUT context | WITH context | Difference |
|---|---:|---:|---:|
| 0 dB | 6/6 (100.0%) | 5/6 (83.3%) | -16.7 pp |
| 5 dB | 6/6 (100.0%) | 5/6 (83.3%) | -16.7 pp |
| Combined | 12/12 (100.0%) | 10/12 (83.3%) | -16.7 pp |

All five in-context clips retained correct heat numbers in both arms at both SNRs. The out-of-context heat-42 clip regressed at **both** SNRs: WITH hints falsely returned **1052**. Context must not be treated as a closed list of permitted IDs or a reason to override what a worker said. Defaults stay off; these results do not justify enabling it for general operation.

### Raw paired transcripts (no corrections)

| Clip | dB | WITHOUT | WITH |
|---|---:|---|---|
| heat_1051_english | 0 | What is the status of sheet 1051? | What is the status of heat 1051? |
| heat_1051_english | 5 | What is the status of heat 1051? | What is the status of heat 1051? |
| heat_42_tanglish | 0 | heat forty two எப்படி இருக்கு? | heat 1052 எப்படி இருக்கு? |
| heat_42_tanglish | 5 | heat forty two எப்படி இருக்கு? | heat 1052 எப்படி இருக்கு? |
| heat_1053_tanglish | 0 | heat ஆயிரத்தி ஐம்பத்து மூன்று status என்ன? | heat 1053 ரு state என்ன? |
| heat_1053_tanglish | 5 | heat ஆயிரத்தி ஐம்பத்து மூன்று status என்ன? | heat 1053 ரு state என்ன? |
| heat_1053_reason | 0 | ஆயிரத்தி ஐம்பத்து மூன்று, N hold. | ஆயிரத்தி ஐம்பத்து மூன்று, N hold. |
| heat_1053_reason | 5 | ஆயிரத்தி ஐம்பத்து மூன்று, என் hold. | ஆயிரத்தி ஐம்பத்து மூன்று, என் hold. |
| heat_1052_tamil | 0 | heat ஆயிரத்தி ஐம்பத்தி ரெண்டு நிலை என்ன? | heat 1052 நிலை என்ன? |
| heat_1052_tamil | 5 | heat ஆயிரத்தி ஐம்பத்தி ரெண்டு நிலை என்ன? | heat 1052 நிலை என்ன? |
| heat_1052_english | 0 | What is the status of heat one thousand fifty two? | What is the status of heat 1052? |
| heat_1052_english | 5 | What is the status of heat one thousand fifty two? | What is the status of heat 1052? |

Some WITH transcripts rendered IDs as digits but also changed nearby wording (e.g. status to ரு state). Digit formatting is not an accuracy gain when the existing parser already understands spoken numbers. Intent/normalization rules were not changed to improve this report.

## Streaming smoke: separate from REST results

**1 / 1 session**, **3.9467 seconds of cached audio**, no retry. The tool served the actual Agent proxy handler on a temporary loopback port, without restarting the user's Agent or initializing unrelated models. It loaded existing configuration in its own process and enabled context/stream flags there only. Browser-side transport was exercised via a WebSocket client with the required localhost:5173 Origin, not a physical microphone.

Observed safe message sequence:

```text
connected
settings_updated (term_count=24)
final
closed (code=stopped)
```

Final transcript: `heat forty two எப்படி இருக்கு?`. The same context set was acknowledged, but this **one streaming clip** did not exhibit the REST heat-42 substitution. Do not combine this streaming outcome with the REST accuracy table. It confirms live update acceptance and clean stop, not broad streaming accuracy.

Total usage: **24 REST STT requests + 2 TTS requests + 1 realtime session**. No additional live requests are needed or authorized by this report.

## Tests and remaining verification

- `python -m pytest tests -q`: **220 passed**, 12 existing warnings, **27.83 s**. All 205 previous cases retained; 15 added cases cover the F8 backend/proxy behavior.
- `npx vitest run --configLoader runner`: **685 passed**, 13 files, **11.80 s**. All 676 previous cases retained; nine added context-builder/transport cases.
- `npm run build -- --configLoader runner`: **passed**, 2,817 modules, **34.64 s**.
- `git diff --check`: passed. No commit.

Tests cover ID variants/order/dedupe/limits, selected heat and active filtering, flag-off form/control behavior, fresh store changes, static-first server merging, input sanitizing, score validation, one debounced provider frame, sanitized acknowledgement, unconfirmed/ignored updates, raw-settings rejection and read-only route/status fields. Existing gate, intent, safety, F2/F7/F9/F11 code remains unchanged except for attaching optional recognition context at capture boundaries.

Manual browser/microphone testing remains with the team. The one-second list refresh plus one-second server debounce adds update latency; a segment already in progress keeps its old hints. Acknowledgement does not imply the recognizer will use every hint correctly. Multiple panels still share the existing hands-free owner, although enabled panels may each perform read-only context polling. No automatic retry or cross-session cache substitution is used in this measurement.

## Changed files

Agent: `.env.example`; `app/main.py`; `app/copilot/context_bias.py` (new), `gnani_client.py`, `gnani_stream.py`, `voice_service.py`; `tests/test_context_bias.py` (new), `tests/test_gnani_stream.py`; `tools/f8_context_bias_bench.py` (new), `tools/f8_stream_smoke.py` (new); this report (new).

Frontend: `.env.example`; `vite.config.js`; `vitest.config.js`; `src/services/contextTerms.js` (new), `copilotService.js`; `src/hooks/useContextTerms.js` (new), `useHandsFree.js`; `src/components/voice/PushToTalk.jsx`; `tests/context-bias.test.js` (new).

No commits, local env edits, README edits, existing benchmark result edits, gate/seed changes, intent/parser/safety changes, TTS changes or Evon changes.
