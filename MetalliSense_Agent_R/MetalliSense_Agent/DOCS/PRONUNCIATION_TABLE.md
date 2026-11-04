# Opt-in TTS pronunciation review

2026-11-04. Input spellings only; synthesized pronunciation still requires listening. No audio generated, provider calls or approved narration changes.

`VITE_PRONOUNCE_PASS=false` by default. When true, useSpeak applies speakableText only to ordinary TTS input, before either existing REST or stream delivery. It replaces the optional clarity/number pass for that input to avoid double normalization. Display/karaoke source strings remain unchanged. `pronunciationOnly` reviewed payloads (including tour and approved ASK wording) and approved asset playback bypass this pass. The 22 packaged WAVs are never processed. No API parameter, SSML or phoneme syntax is added.

| Term | en | ta | hi |
|---|---|---|---|
| H-1053 | H ten fifty-three | எச் ஆயிரத்து ஐம்பத்து மூன்று | एच एक हज़ार तिरपन |
| Cu | copper | காப்பர் | कॉपर |
| Sn | tin | டின் | टिन |
| Mn | manganese | மாங்கனீஸ் | मैंगनीज़ |
| C | carbon | கார்பன் | कार्बन |
| Si | silicon | சிலிக்கான் | सिलिकॉन |
| P | phosphorus | பாஸ்பரஸ் | फॉस्फोरस |
| S | sulfur | சல்பர் | सल्फर |
| CO2 | carbon dioxide | கார்பன் டை ஆக்சைடு | कार्बन डाइऑक्साइड |
| MPa | megapascal | மெகாபாஸ்கல் | मेगापास्कल |
| °C | degrees | டிகிரி | डिग्री |
| % | percent | சதவீதம் | प्रतिशत |
| ppm | parts per million | பார்ட்ஸ் பெர் மில்லியன் | पार्ट्स पर मिलियन |
| rupees / ₹ before amount | rupees | ரூபாய் | रुपये |
| MetalliSense | Metalli Sense | மெட்டல்லி சென்ஸ் | मेटल्ली सेंस |
| SGI / SG Iron | S G iron | எஸ் ஜி அயர்ன் | एस जी आयरन |
| 2026-11-07 | 7 November 2026 | 7 நவம்பர் 2026 | 7 नवंबर 2026 |

## Source inventory and limits

The scan covers frontend source JS/JSX/JSON and finds 674 candidate lines (including non-spoken references); complete local source/line evidence is `.overnight_backup/pronunciation-source-inventory.json`. Spoken entry points: voiceAskContent/voiceAskFormatters/voiceAskAnswers (chemistry, grades, units, money, dates), voiceGateAnswers/voiceDashboardBriefing/morningBriefing (heat IDs and limits), voiceActionRegistry/voiceFormActions/voiceActionLanguages (readbacks), shiftSummary/voiceTranscript (response delivery), voiceTour and approvedTourTamil.json (protected, bypassed). Runtime values cannot be exhaustively enumerated as static strings; token-aware rules handle them at the TTS boundary. This is not a rewrite of arbitrary grade names or invented pronunciations for unseen IDs.

Element replacements are case-sensitive complete tokens, never substrings or ID fragments; C cannot consume CO2. Unknown grade IDs remain unchanged. ISO dates are converted only when valid and unambiguous; slash dates are deliberately not guessed, and existing localized month/day wording is preserved. Numbers/decimal precision are not reformatted. No claim of correct provider pronunciation is made until human listening with the opt-in flag.
