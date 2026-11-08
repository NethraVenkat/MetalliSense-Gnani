# Live test log (real voice, mock data)

Tester: Nethra · Laptop: own · Browser: Edge/Chrome · Lang: ta-IN
Legend: PASS / FAIL / BLOCKED / TODO

## Setup
| Date | Item | Result | Notes |
|---|---|---|---|
| Nov 5 | Clone + branch f17-voice-actions (3222a88) | PASS | |
| Nov 5 | Agent install | PASS | Python 3.14 failed (scikit-learn), used 3.12 |
| Nov 5 | Frontend install | PASS | had to approve esbuild script |
| Nov 5 | App loads | PASS | |

## Spectrometer
| Date | Say | Expected | Result | Notes |
|---|---|---|---|---|
| Nov 5 | Kural ... what is the latest reading | speaks C/Si/Mn | PASS | C 3.48% Si 2.29% Mn 0.65% |
| Nov 5 | Kural ... request reading + yes | read-back, ask yes/no, new reading, Completed | FAIL | no yes/no prompt, no Listening, no 2nd transcribe -> "No reply". Fix prompt sent |
| | delete reading + passcode + DELETE | selected reading removed | TODO | needs VOICE_USERS |

## Pre-Melt
| Date | Say | Expected | Result | Notes |
|---|---|---|---|---|
| | run gate check H-1051 + yes | GO/WARN/HOLD spoken | TODO | |
| | start melting H-1051 (GO) + passcode | MELTING | TODO | |
| | start melting H-1052 acknowledge (WARN) | MELTING | TODO | |
| | start melting H-1053 (HOLD) | refused | TODO | |
| | hold override start + Unit Controller code + OVERRIDE | MELTING on disposable heat | TODO | |
| | reset demo + Manager code + RESET | reset, H-1053 still HOLD | TODO | |

## Inventory Forecast
| Date | Say | Expected | Result | Notes |
|---|---|---|---|---|
| | approve pr PR-7 + Manager code | approved | TODO | |
| | approve pr + wrong code | Approval refused, PR unchanged | TODO | |

## Raw Material Stock
| Date | Say | Expected | Result | Notes |
|---|---|---|---|---|
| | receive truck (form) | one lot received | TODO | |

## Anomaly / Recommendation
| Date | Say | Expected | Result | Notes |
|---|---|---|---|---|
| | clear chat history + code + CLEAR | chat cleared | TODO | |

## Cross-checks
| Date | Check | Result | Notes |
|---|---|---|---|
| | Cancel during APPROVE countdown | TODO | |
| | Voice log viewer + Verify chain OK | TODO | |
| | No passcode audio in audio log | TODO | |