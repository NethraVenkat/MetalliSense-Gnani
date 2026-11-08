# Manual live test log (Nethra, real voice, mock data)
Do not let AI tools overwrite this file.

| Date | Time | Page | What I said | Expected | Result | Notes |
|---|---|---|---|---|---|---|
| Nov 5 | 13:42 | Spectrometer | Kural ... what is the latest reading | speaks C/Si/Mn | PASS | C 3.48% Si 2.29% Mn 0.65% |
| Nov 5 | 13:43 | Spectrometer | Kural ... request reading + yes | asks yes/no, waits, runs | FAIL | no prompt, no 2nd transcribe -> "No reply". Fixed by AI (run-confirm fix) |
| Nov 5 | 13:54 | Pre-Melt | Kural ... what's the status of H-1053 | HOLD + reason | FAIL | answered S 0.015% PASS + Tamil words. Fixed by AI (master fix, Part 3/4) |
| Nov 5 | 14:00 | Spectrometer | request reading while OPC disconnected | refuses | PASS | "Spectrometer OPC is not connected." |
| Nov 5 | 18:17 | Spectrometer | (page after restart) | data loads | PASS | needed Ctrl+Shift+R (stale cache) |
| Nov 5 | 18:18 | Spectrometer | Kural ... connect the spectrometer | OPC connect read-back | FAIL | opened Spectrometer page instead (navigation won over action) |