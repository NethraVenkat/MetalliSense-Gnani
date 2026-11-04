# Morning live-test checklist — disposable mock data only

2026-11-04. No test below was physically performed overnight. Use the existing mock frontend and mocked Agent, never production/plant data. Real-microphone STT/TTS needs separately authorized provider access; this checklist makes no such calls. In mock mode use the existing development transcript entry to exercise routing. A spoken phrase is not a substitute for the required screen preconditions, role or confirmation.

## Start and establish scope

From the Agent directory in terminal 1:

```powershell
$env:GNANI_MOCK='true'
$env:EVON_MOCK='true'
$env:VOICE_ACTIONS_ENABLED='true'
$env:VOICE_AUDIT_ENABLED='true'
.\.venv\Scripts\python.exe .\app\main.py
```

From the frontend directory in terminal 2:

```powershell
$env:VITE_VOICE_EVERYWHERE='true'
$env:VITE_VOICE_ACTIONS='true'
$env:VITE_VOICE_AUDIT='true'
npm.cmd run dev:mock -- --configLoader runner
```

Open http://localhost:5173; Agent is http://localhost:8001. These are temporary shell settings, not edits to environment files or changed defaults. Audio logging and hands-free stay off unless separately enabled by the owner. Use existing configured identities; never paste/read a passcode into the demo-transcript control, console, report or audit viewer. Privileged approval cannot be simulated by adding a name to a command. For a completely offline approval test use the existing mocked test fixtures; do not invent a working identity/code.

Select English or Tamil. Finish each read-back before responding. RUN: yes/ஆமா after read-back; no/இல்லை cancels; eight seconds without speech produces “No reply — action not done.” APPROVE: the configured authorized identity must pass the private approval step, then any stated confirmation word, then the five-second Cancel window. No action should execute early. Completed is permitted only after the same page service returns a successful result. Tamil Completed speech is “முடிஞ்சது.”

## Ordered exercises

IDs such as H-1051 and PR-7 below are examples of fixture IDs, not a guarantee that a loaded target exists. Select the corresponding loaded row first or replace the ID with the one visibly on screen. Preserve H-1053 HOLD for the refusal check. Execute the override only on a separate disposable HOLD heat, or reset the disposable demo before continuing; do not change the protected demonstration merely to obtain success.

| Step / page / preconditions | Exact registered English / Tamil phrase | Expected read-back/reply | Screen change only after success | Expected grouped audit fields |
|---|---|---|---|---|
| 1 Spectrometer; OPC connected | `request reading` / `ரீடிங் எடு` | Read-back says one reading from connected OPC; yes then “Completed” / “முடிஞ்சது.” | New reading appears through requestOPCReading; no invented hardware result | intent=request_reading, level=RUN, decision=executed, backend_result.status=2xx; otherwise refused/failed |
| 2 Pre-Melt; saved PLANNED charge selected | `run gate check H-1051` / `கேட் செக் பண்ணு H-1051` | Read-back ID/weight; yes; `H-1051: GO/WARN/HOLD.` from returned data | Current gate result updates; check remains required before start | intent=gate_check, RUN, executed + actual heat/gate IDs and status |
| 3a Pre-Melt; fresh GO, Supervisor/Unit Controller | `start melting H-1051` / `மெல்ட்டிங் ஸ்டார்ட் பண்ணு H-1051` | ID/kg/GO read-back, private role approval, countdown, Completed | Selected heat becomes MELTING, real mock service/stock deduction succeeds first | start_melting, APPROVE, executed; masked transcript; backend result |
| 3b Pre-Melt; separate fresh WARN | `start melting H-1052 acknowledge` / `மெல்ட்டிங் ஸ்டார்ட் பண்ணு H-1052 acknowledge` | Read-back WARN; same approval/countdown. Omitting acknowledge refuses | MELTING only on valid acknowledged WARN and successful service | start_melting executed, or refused before execution |
| 4 Pre-Melt; H-1053 HOLD | `start melting H-1053` / `மெல்ட்டிங் ஸ்டார்ட் பண்ணு H-1053` | Existing refusal: `H-1053 is on HOLD — only an engineer can override, on screen.` | H-1053 remains HOLD/PLANNED; no start/deduction | start_melting, decision=refused; no executed backend result |
| 5 Separate disposable HOLD; Unit Controller only | `hold override start` / `ஹோல்ட் ஓவர்ரைடு செய்து ஸ்டார்ட் பண்ணு` | Answer missing heat/reason prompts one at a time; reason >= configured minimum (default 20 chars). Read-back: `This overrides a HOLD gate`; private passcode; say `OVERRIDE`; five-second Cancel; Completed only on success | Fresh same HOLD gate revalidated; engineer/operator from identity; then selected disposable heat MELTING | override_start, APPROVE, confirmation_word=OVERRIDE, confirmation_word_verified=true, executed + actual result; other roles refused |
| 6a Inventory Forecast; selected PENDING_APPROVAL PR; Manager | `approve pr PR-7` / `PR அப்ரூவ் பண்ணு PR-7` | Read-back PR/kg/supplier; configured Manager approval, countdown, Completed | Actual selected PR becomes approved through approvePurchaseRequest | approve_pr, APPROVE, executed, masked transcript, actual PR ID/status |
| 6b Fresh pending PR; wrong approval once | Same phrase as 6a | `Approval refused`; no Completed. Do not repeatedly guess (three failures lock ten minutes) | Pending PR unchanged | approve_pr, refused (or locked when applicable), masked transcript, no execution |
| 7 Raw Material Stock; Operator/Supervisor | `receive truck` / `லாட் வரவு பதிவு பண்ணு` | One missing field at a time; use the values from a disposable loaded fixture. Read back ALL fields, configured role approval, countdown, Completed | Exactly one received lot from receiveLot; no service during field collection | receive_lot, APPROVE, executed with actual lot/status; cancel/skip never fabricates required fields |
| 8 Spectrometer; disposable reading selected; Supervisor/Manager | `delete reading` / `ரீடிங் நீக்கு` | Read-back exact selected target; private approval; say `DELETE`; countdown; Completed | Only selected disposable reading removed after deleteReading succeeds | delete_reading, APPROVE, confirmation_word=DELETE, verified=true, executed; mismatch cancelled, empty timeout |
| 9 Pre-Melt; Manager; destructive disposable demo only | `reset demo` / `டெமோ ரீசெட் பண்ணு` | Read-back; private approval; say `RESET`; countdown; Completed | Demo reset service result refreshes page; recheck H-1053 HOLD afterward | reset_demo, APPROVE, RESET verified, executed + actual backend result |
| 10 Anomaly or Recommendation; Supervisor/Manager | `clear chat history` / `சாட் வரலாறு நீக்கு` | Read-back; private approval; say `CLEAR`; countdown; Completed | Page chat cleared only through clearChatHistory | clear_chat, APPROVE, CLEAR verified, executed |

## Check cancellation and logs

During any APPROVE countdown press Cancel once: one Cancelled result, no backend execution, decision=cancelled. Page changes/stale gates refuse/cancel. Inspect the grouped voice log for today's local time, page, intent, decision and masked snippet. Raw audio-capture child events are not separate action outcomes. Verify chain should report `Chain OK · N events` or the broken sequence; never claim chain validity without using the verifier. Optional wake/command play buttons must never include passcode audio.

Expected fields above describe the schema, not fabricated audit events; timestamps, IDs, summaries and HTTP statuses must come from the actual run. Success does not prove hardware behavior. Record any mismatch instead of altering role/gate rules.

Sources: frontend `voiceActionRegistry.js`, `voiceFormActions.js`, `voiceActionLanguages.js`, `voiceActions.js`; Agent `app/copilot/voice_policy.py`, `voice_auth.py`, `voice_foundation.py`; existing F16/F17 documentation. No new phrase, role, endpoint or confirmation syntax is introduced by this checklist.
