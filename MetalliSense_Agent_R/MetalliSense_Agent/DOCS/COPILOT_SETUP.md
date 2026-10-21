# Explainable AI Copilot - Quick Setup Guide

## Overview

Transform MetalliSense into an interactive, voice-enabled AI assistant that explains WHY recommendations are made, not just WHAT they are.

---

## Prerequisites

✅ MetalliSense AI service running  
✅ ML models trained (anomaly detection + alloy correction)  
✅ Python 3.11+  
✅ Groq API key (free tier available)  

---

## Setup Steps

### 1. Get Groq API Key

1. Visit: https://console.groq.com/keys
2. Sign up / Log in (free tier available)
3. Create a new API key
4. Copy the API key

### 2. Set Environment Variable

**Windows (PowerShell):**
```powershell
$env:GROQ_API_KEY="your_groq_api_key_here"
```

**Windows (CMD):**
```cmd
set GROQ_API_KEY=your_groq_api_key_here
```

**Or create `.env` file in project root:**
```bash
GROQ_API_KEY=your_groq_api_key_here
```

### 3. Install New Dependencies

```bash
pip install groq==0.11.0 gTTS==2.5.1
```

Or reinstall all:
```bash
pip install -r requirements.txt
```

### 4. Start the API Service

```bash
cd app
python main.py
```

Or:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

### 5. Verify Copilot is Running

Visit: http://localhost:8001/health

Check that `copilot: true` and `voice_service: true`

---

## Test the Copilot

### Quick Test

```bash
python test_copilot.py
```

This will run 7 tests:
1. Health check
2. Explain analysis
3. Interactive chat
4. Clear history
5. Get languages
6. Text-to-speech
7. Speech-to-text

### Manual Test (curl)

**Test Explanation:**
```bash
curl -X POST "http://localhost:8001/copilot/explain" \
  -H "Content-Type: application/json" \
  -d '{
    "composition": {"Fe": 94.5, "C": 3.2, "Si": 2.0, "Mn": 0.4, "P": 0.05, "S": 0.10},
    "grade": "GREY-IRON"
  }'
```

**Test Chat:**
```bash
curl -X POST "http://localhost:8001/copilot/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Why do we need to add Manganese?",
    "include_context": true
  }'
```

**Test Text-to-Speech:**
```bash
curl -X POST "http://localhost:8001/copilot/voice/synthesize" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Silicon addition is recommended",
    "language": "en"
  }' \
  --output speech.mp3
```

---

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/copilot/explain` | POST | Get explanation for analysis |
| `/copilot/chat` | POST | Interactive Q&A |
| `/copilot/chat/history` | DELETE | Clear conversation |
| `/copilot/voice/transcribe` | POST | Speech-to-Text |
| `/copilot/voice/synthesize` | POST | Text-to-Speech |
| `/copilot/voice/languages` | GET | Supported languages |

**Full API documentation:** See [COPILOT_API_REFERENCE.md](COPILOT_API_REFERENCE.md)

---

## Frontend Integration

### Basic Example

```html
<script>
async function explainAnalysis(composition, grade) {
  const response = await fetch('http://localhost:8001/copilot/explain', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ composition, grade })
  });
  
  const result = await response.json();
  console.log('Explanation:', result.explanation);
  console.log('Risk Level:', result.risk_level);
  console.log('Actions:', result.action_items);
}

async function askCopilot(question) {
  const response = await fetch('http://localhost:8001/copilot/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: question, include_context: true })
  });
  
  const result = await response.json();
  console.log('Answer:', result.response);
}

async function speakText(text) {
  const response = await fetch('http://localhost:8001/copilot/voice/synthesize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language: 'en' })
  });
  
  const audioBlob = await response.blob();
  const audio = new Audio(URL.createObjectURL(audioBlob));
  audio.play();
}

// Usage
explainAnalysis(
  {Fe: 94.5, C: 3.2, Si: 2.0, Mn: 0.4, P: 0.05, S: 0.10},
  "GREY-IRON"
);

askCopilot("Why do we need to add Manganese?");
speakText("Silicon addition is recommended");
</script>
```

**Complete example:** See [COPILOT_API_REFERENCE.md](COPILOT_API_REFERENCE.md#complete-frontend-integration-example)

---

## Supported Languages

✅ English (en)  
✅ Spanish (es)  
✅ French (fr)  
✅ German (de)  
✅ Italian (it)  
✅ Portuguese (pt)  
✅ Russian (ru)  
✅ Japanese (ja)  
✅ Korean (ko)  
✅ Chinese (zh)  
✅ Hindi (hi)  
✅ Arabic (ar)  

---

## Features

### 1. Natural Language Explanations

Converts ML predictions into human-readable insights:
- Situation summary
- Deviation analysis
- Alloy justification
- Risk assessment
- Operator action items

### 2. Interactive Chatbot

Ask follow-up questions:
- "Why do we need to add Manganese?"
- "What happens if we don't correct this?"
- "Explain the risk level"
- "What is the confidence score?"

### 3. Voice Input (Speech-to-Text)

- Upload audio files (WAV, MP3, M4A, OGG, FLAC)
- Powered by Groq Whisper large-v3
- High accuracy transcription
- Multi-language support

### 4. Voice Output (Text-to-Speech)

- Convert explanations to speech
- Natural voice output (gTTS)
- MP3 format
- Multi-language support

---

## Troubleshooting

### Copilot not initializing

**Problem:** `Explainable AI Copilot not initialized`

**Solution:**
```bash
# Check environment variable
echo $env:GROQ_API_KEY  # PowerShell
echo %GROQ_API_KEY%     # CMD

# Set it if missing
$env:GROQ_API_KEY="your_key_here"  # PowerShell
set GROQ_API_KEY=your_key_here     # CMD
```

### API Key Error

**Problem:** `Invalid API key`

**Solution:**
- Verify key is correct
- Check key has not expired
- Generate new key at https://console.groq.com/keys

### Import Error

**Problem:** `ModuleNotFoundError: No module named 'groq'`

**Solution:**
```bash
pip install groq==0.11.0 gTTS==2.5.1
```

### Health Check Shows copilot: false

**Problem:** Copilot not loaded in health check

**Solution:**
1. Check logs for errors
2. Verify GROQ_API_KEY is set
3. Restart the API service
4. Check network connectivity to Groq API

---

## Architecture

```
Frontend (Browser/App)
    ↓
FastAPI (Port 8001)
    ↓
┌─────────────────────────────────────┐
│   Explainable AI Copilot (New)     │
│   - Groq LLM (llama-3.3-70b)       │
│   - Conversation History            │
│   - Voice Services                  │
└─────────────┬───────────────────────┘
              ↓
┌─────────────────────────────────────┐
│      Agent Manager (Existing)       │
│  ┌────────────┐  ┌────────────┐    │
│  │ Anomaly    │  │ Alloy      │    │
│  │ Agent      │  │ Agent      │    │
│  └────────────┘  └────────────┘    │
└─────────────────────────────────────┘
```

**Design:**
- Groq LLM explains, ML models predict
- LLM sits on TOP of ML models (doesn't replace them)
- ML models remain deterministic
- Voice interface for factory floor accessibility

---

## Performance

- **First Explanation:** ~2-3 seconds (LLM processing)
- **Subsequent Chat:** ~1-2 seconds (with history)
- **Voice Transcription:** ~1-2 seconds
- **Voice Synthesis:** ~500ms

---

## Security

✅ API key stored in environment variable (not in code)  
✅ Input validation via Pydantic schemas  
✅ File upload limits for audio  
✅ CORS configured  
✅ No sensitive data in responses  

**Production checklist:**
- Use secrets manager for API key
- Implement rate limiting
- Add authentication/authorization
- Configure CORS properly
- Enable HTTPS

---

## Next Steps

1. ✅ Install dependencies
2. ✅ Set GROQ_API_KEY
3. ✅ Start API service
4. ✅ Run test_copilot.py
5. 🔨 Integrate with frontend
6. 🔨 Customize system prompts (optional)
7. 🔨 Add authentication (production)

---

## Resources

- **Full API Documentation:** [COPILOT_API_REFERENCE.md](COPILOT_API_REFERENCE.md)
- **Groq Console:** https://console.groq.com
- **Groq Docs:** https://console.groq.com/docs
- **API Docs (Interactive):** http://localhost:8001/docs

---

## Support

Questions? Issues?

1. Check health endpoint: http://localhost:8001/health
2. Review API docs: http://localhost:8001/docs
3. Check logs in terminal
4. See [COPILOT_API_REFERENCE.md](COPILOT_API_REFERENCE.md) for troubleshooting

---

**Ready to use!** 🚀

Start with:
```bash
python test_copilot.py
```
