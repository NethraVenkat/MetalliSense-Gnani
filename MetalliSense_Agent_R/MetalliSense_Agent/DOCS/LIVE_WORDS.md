# Live words: guarded plumbing

4 November 2026. Default OFF: `VITE_LIVE_WORDS=false`, `LIVE_WORDS_ENABLED=false`, `VITE_LIVE_WORDS_MOCK=false`.

Repository evidence: `app/copilot/gnani_stream.py` documents the existing `/stt/v3/stream` URL, `x-api-key-id`, one `language_code`, PCM16 mono with 1024-byte frames, a connected event, processing acknowledgements, final transcript events and commit. Its source reference is https://docs.gnani.ai/api/STT/stt-websocket.md. Existing docs F13_VOICE_EVERYWHERE_PLAN.md describe this single-locale path. No new provider request was made to verify current behavior.

**Missing:** verified interim word-transcript support/message contract, provisional revision semantics and word timing. The repository explicitly says Prisma currently returns final utterances; processing events contain no words. Defensive parsing of a hypothetical `is_final=false` event is not evidence that the provider produces it. The existing continuous stream also holds the shared lease and cannot safely run alongside the unchanged REST command call merely to guess at live words.

Safest decision: PARTIAL. `/ws/live-words` is a bounded, local-origin, flag-guarded endpoint returning `unavailable` (`disabled`, `lease_busy`, `invalid_start`, or `partial_words_not_documented`). It never opens a provider connection, retains PCM, waits for the lease or changes REST. The browser sends only a start envelope with one selected locale (ta-IN / hi-IN / en-IN), then silently falls back. No extra microphone owner exists.

For an explicitly labelled offline UI demonstration, enable only the two frontend flags `VITE_LIVE_WORDS=true` and `VITE_LIVE_WORDS_MOCK=true` in the local shell before starting Vite; do not edit stored environment values during this run. The existing REST result is replayed word by word, **after it exists**, with the label `MOCK — final transcript replay`. This is not recognition while speaking and is not provider latency evidence. It is suppressed for action/private capture, hidden panels and tours; session/language changes and unmount cancel timers/sockets. Real card status remains driven by the existing capture/request/playback controller.

Human next step: obtain a verified provisional-word contract before adding provider forwarding or claiming live partials. URL/auth/audio/final-event details are known; those are not the missing items. No Gnani endpoint, parameter or behavior was invented.
