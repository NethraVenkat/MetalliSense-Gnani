# H-1053 HOLD voice demo (2–3 minutes)

Run `npm run dev:mock` in this frontend and open the URL printed by Vite. The factory
data and gate checks run in the browser. Spoken audio uses the existing Agent TTS
service (`http://localhost:8001`, or `VITE_COPILOT_BASE_URL`); have that service and
its Tamil voice available before recording. Unmute the voice panel and choose தமிழ்.
The demo transcript buttons bypass STT and microphone permissions while following
the same mapper, heat lookup, answer and speech path as a transcribed recording.
They appear only in mock mode. They still require TTS for audible replies.

1. Open **Pre-Melt Gate** in the sidebar. Click **Reset** at the top right and confirm.
   This restores the default demo stock and clears the spoken-HOLD history.
2. Select **H-1053** in the heat list. Its grade is **SG-IRON**, target **1000 kg**,
   status **PLANNED**, and charge **PIG-1053 / 1000 kg**. No gate decision is seeded.
3. In **Shop floor voice**, select **தமிழ்** and unmute if the button says
   **Unmute voice**. Click **Run pre-melt check**. Wait for **HOLD** and the Tamil
   alert. Show **Start melting — locked**, which stays disabled.
4. Show the two failed checks: **Lot release status** (PIG-1053 is quarantined)
   and **Residual (tramp) elements** (Cu **0.50%**, maximum **0.30%**).
   The actual gate engine computes both; no decision or gate result is fabricated.
5. Expand **Demo transcripts** in the voice panel. Click **Heat 1053 status என்ன**.
   Expected Tamil response: `Heat H-1053: நிலை PLANNED. Gate HOLD`.
6. Click **ஏன் HOLD**, then **why hold heat 1053**. Both speak the quarantine and
   copper-limit reasons in Tamil. Optionally switch to **English** and repeat the
   reason request to hear the original gate explanations.
7. Switch back to **தமிழ்**. Click **approve**, then **start melting**. Each replies
   `திரையில் approve செய்யவும்`. The heat remains PLANNED, the gate remains HOLD,
   and no stock is reserved or consumed by these voice actions.
8. Optionally click **Run pre-melt check** again: the gate still returns HOLD,
   with no duplicate automatic alert. A fresh Reset rearms the alert for another take.

For a microphone take, hold the microphone button, speak the same phrases and
release it. That uses the configured STT service. No STT request is needed for the
transcript-button version of this demo.

Suggested timing: Reset and charge (0:00–0:30), real HOLD check and reasons
(0:30–1:10), Tamil status/reason requests (1:10–2:00), blocked start/approval
(2:00–2:30). Leave a short pause between replies so queued speech can finish.

WARN handling uses the gate's warnings rather than its blocking list or generic
headline. Regression tests create a real WARN by releasing the test lot and reducing
its Cu to 0.27%; this test does not alter the default HOLD demo seed.
