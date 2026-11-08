# Local phone recording handover

Builder: Manish. This is a separate development exercise, not qualification or training data. Do not copy S02/S03 or live sessions into this folder.

Collect 20 clips locally with consent: 10 natural wakes (Kural alone or a short question), five similar words without Kural, five ordinary conversation clips without Kural. Include other consenting speakers; note speaker/session, language, device, room and intended content in a separate local note. Use colloquial Tamil (குரல், இன்னைக்கு நிலை என்ன?), Tanglish (Kural, stock evlo?), and Hindi (Kural, स्थिति क्या है?). Preserve phone originals. Never record passcodes or private conversations.

Export separate copies as mono PCM16 WAV, 16000 Hz using an already installed local converter. Name them wake_01.wav ... wake_10.wav, conf_01.wav ... conf_05.wav and conv_01.wav ... conv_05.wav. Add approximately one second of real silence before and after speaking. Human-listen to confirm the filename label; names are intended labels, not verified word intervals.

From the Agent directory, dry run (zero provider calls):

```powershell
.\.venv\Scripts\python.exe .\tools\wake_eval_folder.py .\tools\local_wake_data\phone-handover
```

Inspect plan.json before any separately authorized live run. Explicit user-run live mode adds `--live --max-calls 30` and requires the existing backend WAKE_WORD_ENABLED setting. The tool loads existing backend configuration, uses the unchanged app WakeChecker (no-keyterm pause-v3, shared lease, one in flight, 1.1-second spacing, 15/minute limit), stops on the first error, and never retries. The minute limit is not bypassed: a longer run may stop with a rate-limit error. No calls were made while preparing this tool.

Every local onset uses the unchanged pause-v3 onset rule and a zero-padded 1.5-second snippet. All onsets are planned; an over-budget plan fails before output/calls. Output is a new ignored folder under local_wake_data, with snippet copies, plan/hash evidence, CSV and totals. An explicit --output must not already exist. Failed runs cannot be resumed or overwritten; inspect evidence before separately authorizing another run.

CSV got is true if any onset snippet returned wake, false if none did, not_run for dry runs, error on failure. No-onset files cause zero calls. Latency is accumulated check wall time (including spacing), not word/event latency. Totals are clip-level intended-label comparisons; multiple snippets are not separate spoken words. No event qualification, training import, app integration or long-term accuracy claim follows.

## Two-person handover and other-speaker script

Separately record one two-person handover, with both speakers' consent and a local note of turns. Use wake_handover.wav if it contains a literal intended Kural, otherwise conv_handover.wav. Suggested wake-free exchange: Tamil: “H-1053 இன்னும் ஹோல்ட்ல இருக்கு. அடுத்த ஷிஃப்ட்ல செக் பண்ணுங்க.” / “சரி, ஸ்டாக் பார்த்துட்டு சொல்றேன்.” Tanglish: “H-1053 hold la irukku, next shift check pannunga.” / “Stock paathuttu solren.” Hindi: “H-1053 होल्ड पर है, अगली शिफ्ट में जाँच करिए।” / “ठीक है, स्टॉक देखकर बताता हूँ।” These are recording prompts, not app commands.

For other speakers, use separate folders per speaker/session and the same 20-clip design. Wake examples: “குரல்”, “Kural, stock evlo?”, “Kural, आज की स्थिति क्या है?” Confusables: coral, curl, cooler, குரங்கு, கூரை. Ordinary talk: discuss a meal, a journey or room conditions without saying Kural. Do not merge outputs across people into a reliability claim. The handover and other-speaker folders require their own dry-run plan and separately authorized provider use; this preparation made zero calls.
