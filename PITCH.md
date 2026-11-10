# Kural (குரல்): a hands-free voice copilot for foundry operators

**Team:** Nethra Venkat · Manish Rahul · **Built on:** Gnani Prisma v3 (STT) + Timbre (TTS)

## The real problem on a foundry floor
- **Hands and eyes are busy.** Melting crews work beside an induction furnace at around 1,500 °C, in gloves and face shields. Checking chemistry or a heat's status means walking to a terminal, taking gloves off and typing.
- **Decisions are fast and costly.** Scrap charge, spectrometer readings and additions decide whether a heat meets its grade. A wrong charge or a missed HOLD can mean a rejected casting, re-melting energy and a safety risk.
- **The workforce speaks Tamil and Hindi, the software speaks English.** Floor operators often think and talk in their own language, while plant screens are English-only, dense and built for an office desk.
- **Approvals wait for the screen.** Purchase requests, lot releases and tap approvals queue until a supervisor gets back to a desk.

## Our solution
Kural puts the foundry's plant software (MetalliSense, 21 pages) behind a voice the operator already uses: **say "Kural" and talk in Tamil, Hindi or English.**
- Answers come **from the live page data**: chemistry, gate status, stock, supplier scores and forecasts.
- Actions call **the same services as the screen buttons**. Navigation, row selection, reading, tabs and forms work by voice too.
- Safety is built in: safe actions run with a 2-second cancel; record changes need a spoken yes/no; approvals, deletes and overrides need a **spoken 6-digit passcode** and a 5-second cancel. **A HOLD gate can never be bypassed by voice.** Every turn is logged with what was heard, matched and decided.

## A shift with Kural
1. **Shift start:** "Kural, morning briefing" gives heats planned, HOLDs and stock alerts, spoken.
2. **At the furnace:** "கடைசி ரீடிங் என்ன?" (what's the last reading?) gives carbon, silicon and manganese in Tamil, with no walk to the terminal.
3. **Before charging:** "run gate check H-1051" gives GO or WARN. "start melting H-1053" is **refused: HOLD, residuals over the limit.**
4. **From the floor:** the supervisor says "approve the selected PR" plus a passcode, and it's approved without going back to the desk.
5. **Truck arrives:** "receive truck"; Kural asks one field at a time, reads everything back, then records the lot.

## How Gnani is used
Prisma v3 hears the wake word, commands, replies and passcodes (ta-IN / hi-IN / en-IN, codemix for digits). Timbre speaks every answer and read-back. One shared provider lease respects per-key limits; the API key stays server-side.

## Status (v22)
Working end to end on synthetic foundry data: **2,630** frontend tests, **470** agent tests, a **597-case** page sweep and **435** real-app checks on all 21 pages. Wake word chosen after five approaches (pause-v3: 10/10 wakes, 0 false wakes in our test). Evon isn't on Gnani's API yet, so the LLM path uses open weights per Gnani's guidance.

**Repo:** https://github.com/NethraVenkat/MetalliSense-Gnani · **Demo:** https://youtu.be/H5LXI3kne8Y?si=fl90HqAnqw3JpU81
