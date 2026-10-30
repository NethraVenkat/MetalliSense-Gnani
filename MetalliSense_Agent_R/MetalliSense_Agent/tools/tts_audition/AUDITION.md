# Live Tamil HOLD audition

2026-10-30. Live TTS calls: **9/10**. STT calls: **0**. All nine requests succeeded.

Provider WAVs used streaming length placeholders. Headers were finalized locally without changing PCM samples or making further API calls. All files and their disk-cache entries match.

| File | Model / voice | Bytes | Seconds | Source |
|---|---|---:|---:|---|
| [timbre-v3.0_Shivani_plain.wav](timbre-v3.0_Shivani_plain.wav) | timbre-v3.0 / Shivani | 557468 | 12.64 | live |
| [timbre-v3.0_Shivani_tags.wav](timbre-v3.0_Shivani_tags.wav) | timbre-v3.0 / Shivani | 612812 | 13.89 | live |
| [timbre-v3.0_Kalpana_plain.wav](timbre-v3.0_Kalpana_plain.wav) | timbre-v3.0 / Kalpana | 610388 | 13.84 | live |
| [timbre-v3.0_Kalpana_tags.wav](timbre-v3.0_Kalpana_tags.wav) | timbre-v3.0 / Kalpana | 617776 | 14.01 | live |
| [timbre-v3.0_Avinash_plain.wav](timbre-v3.0_Avinash_plain.wav) | timbre-v3.0 / Avinash | 550412 | 12.48 | live |
| [timbre-v3.0_Avinash_tags.wav](timbre-v3.0_Avinash_tags.wav) | timbre-v3.0 / Avinash | 564172 | 12.79 | live |
| [timbre-v3.0_Harshad_plain.wav](timbre-v3.0_Harshad_plain.wav) | timbre-v3.0 / Harshad | 575108 | 13.04 | live |
| [timbre-v3.0_Harshad_tags.wav](timbre-v3.0_Harshad_tags.wav) | timbre-v3.0 / Harshad | 620042 | 14.06 | live |
| [timbre-v2.5_Kamakshi_plain.wav](timbre-v2.5_Kamakshi_plain.wav) | timbre-v2.5 / Kamakshi | 585692 | 13.28 | live |

Kamakshi was accepted by the live v2.5 API even though it is absent from the current public catalog.

All nine exact model/voice/style/text combinations were verified from the real disk cache with HTTP explicitly blocked and zero calls used. An invalid `Nobody` primary voice was also verified to use the cached v2.5/Kamakshi fallback. Hard call budgets are covered by mocked tests. No second live audition was run.

Listen to the linked WAVs to choose your preferred voice and compare plain/tagged delivery. No subjective voice ranking or manual browser playback check has been claimed.
