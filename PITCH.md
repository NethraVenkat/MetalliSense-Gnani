# Kural (குரல்): the voice of the foundry floor

**Hands-free, Tamil-first voice copilot for foundry operators · built on Gnani Prisma v3 (STT) + Timbre v3 (TTS)**
Team of two: **Nethra Venkat · Manish Raghul S J** · Sri Eshwar College of Engineering, **Coimbatore**
🎥 Demo: https://youtu.be/KxPlBhWzNms · 💻 Repo: https://github.com/NethraVenkat/MetalliSense-Gnani · ▶️ Run it: see README → "Run the full app"

## Problem solved
Induction-foundry operators work beside a ~1,500 °C furnace with gloves on, eyes on the melt. The software that checks chemistry, gates each heat and approves purchases sits behind a keyboard, in English, while operators think and talk in **Tamil, Hindi or a mix with English**. A wrong charge or a missed HOLD means a rejected casting, re-melting energy and a safety risk.

## Target users
Furnace/melt operators, shift supervisors, unit controllers and stores staff in Indian foundries (Coimbatore is a major foundry cluster).

## Our solution
Kural adds a voice to **MetalliSense**, our 21-page foundry app (yard XRF/LIBS inspection, live spectrometer over OPC-UA, pre-melt gate, AI anomaly/correction/strategy analysis, mechanical properties, stock, forecasting, sales).
- **Say "Kural", no button needed.** Speak Tamil, Hindi, English, Tanglish or Hinglish: *"H-1053 status enna?"*, *"oru reading edu"*, *"truck receive करो"*.
- **Answers from live plant data**, spoken in the operator's language; Tamil/Hindi on-screen card labels.
- **Acts through the app's own services**: navigate, select rows, gate checks, readings, conversational forms ("receive truck"), approvals.
- **Safe by design:** safe actions get a 2-second cancel; record changes need a read-back + spoken "yes"; approvals need a **role-checked spoken 6-digit passcode** (PBKDF2, 3-strike lock) + 5-second cancel. **Normal start can never turn a HOLD into GO by voice;** the only exception is a Unit Controller override with passcode, spoken reason and the word OVERRIDE. A hash-chained audit records what was heard, matched and decided; passcodes never enter the audio log. Synthetic data only.

## Gnani models used
- **Prisma v3.0 (STT):** wake check, commands, form answers, yes/no replies, passcodes; ta-IN / hi-IN / en-IN with codemix (English nouns stay Latin inside Tamil/Hindi speech).
- **Timbre v3.0 (TTS):** every answer, read-back and prompt.
- One shared provider lease keeps every call inside the one-request-at-a-time key limit; the key stays server-side.
- Evon is not on Gnani's API, so the explanation chat uses an open-weights model (gpt-oss-120b via Groq), per Gnani's guidance.

## Award tracks: how Kural answers each
| Track | Our answer |
|---|---|
| **Main Character** (regional language) | Tamil-first: Tamil wake word (குரல்), Tamil questions and spoken answers, Tamil card labels; Hindi too |
| **Mixed Vibes** (code-mixed) | Tanglish/Hinglish commands route to real actions: "H-1053 status enna?", "gate check pannu H-1051", "truck receive करो"; real-Prisma routing improved 2/5 → 4/5 (Tanglish), 6/8 on new Hindi audio |
| **Real Deal** (real-world problem) | A real foundry workflow end to end, and a voice that *refuses* unsafe actions (HOLD), with passcodes and an audit trail a plant can trust |
| **Jugaad Genius** (creative Gnani use) | A wake word with **no wake-word model**: a local pause gate sends short bursts to Prisma + a first-word rule, after CNN, Sherpa and two Prisma variants failed. In our live wake screen: 10/10 wakes, 0/10 confusables, 0/5 conversation snippets. We A/B-tested Prisma keyterms, Timbre audio tags, streaming TTS and auto-language against real Gnani calls, and kept off anything that did not clearly help |
| **Two-Person Army** | Built by a team of two; contributions below |
| **Small Town, Big Build** | Built in Coimbatore, for the foundries around it |

## Who built what
- **Manish Raghul S J:** voice architecture and Gnani integration (Prisma/Timbre client, provider lease), wake-word research (CNN/Sherpa/Prisma pause gate), spoken-passcode security and audit log, voice capture and diagnostics, real-app test harnesses, full-stack setup.
- **Nethra Venkat:** Tamil/Hindi/Tanglish wording and command matching, page answers and action phrases, live voice testing and bug finding, demo video, pitch and LinkedIn launch.

## Verified
**2,668** frontend + **496** agent automated tests · **414/440** full-mode checks passed (**25** N/A, **1** preserved generated-wake miss) across all 21 pages · real-Prisma trials: spoken passcodes **10/10**, voice receiving form **3/3**, commands routed **5/5** under synthetic foundry noise at 5 dB SNR · demonstrated live to an audience. Honest limits are listed in the README.
