# Explainable AI Copilot - API Reference

## Overview

The Explainable AI Copilot transforms MetalliSense from a black-box ML system into an interactive, voice-enabled assistant that explains **WHY** recommendations are made, not just **WHAT** they are.

### Key Features

✅ **Natural Language Explanations** - ML predictions converted to human-readable insights  
✅ **Interactive Chatbot** - Ask follow-up questions about analysis  
✅ **Voice Input** - Speech-to-Text via Groq Whisper  
✅ **Voice Output** - Text-to-Speech via gTTS  
✅ **Multi-Language Support** - 12 languages supported  
✅ **Conversation History** - Context-aware responses  

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Application                      │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ├─── /copilot/explain (Analysis Explanation)
                 ├─── /copilot/chat (Interactive Q&A)
                 ├─── /copilot/voice/transcribe (Speech-to-Text)
                 └─── /copilot/voice/synthesize (Text-to-Speech)
                 │
┌────────────────▼────────────────────────────────────────────┐
│              FastAPI Backend (Port 8001)                     │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         Explainable AI Copilot (Groq LLM)            │  │
│  │  - llama-3.3-70b-versatile                           │  │
│  │  - Natural language generation                        │  │
│  │  - Conversation history                               │  │
│  └───────────────┬───────────────────────────────────────┘  │
│                  │                                           │
│  ┌───────────────▼───────────────────────────────────────┐  │
│  │         Agent Manager (ML Orchestration)             │  │
│  │  ┌──────────────────┐  ┌──────────────────┐         │  │
│  │  │ Anomaly Agent    │  │ Alloy Agent      │         │  │
│  │  │ (Isolation Forest)│  │ (Gradient Boost) │         │  │
│  │  └──────────────────┘  └──────────────────┘         │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Data Flow:**
1. Composition → ML Models → Numeric predictions
2. Numeric predictions → Groq LLM → Human explanation
3. User questions → Chatbot → Context-aware answers
4. Voice input → Whisper STT → Text
5. Text → gTTS → Voice output

---

## API Endpoints

### Base URL

```
http://localhost:8001
```

---

## 1. Explain Analysis

**Endpoint:** `POST /copilot/explain`

**Purpose:** Get human-readable explanation for ML predictions

**Description:**
Takes composition and grade, runs full ML agent analysis (anomaly detection + alloy correction), and generates natural language explanation using Groq LLM.

### Request

```json
POST /copilot/explain
Content-Type: application/json

{
  "composition": {
    "Fe": 94.5,
    "C": 3.2,
    "Si": 2.0,
    "Mn": 0.4,
    "P": 0.05,
    "S": 0.10
  },
  "grade": "GREY-IRON"
}
```

### Response

```json
{
  "explanation": "Analysis of your GREY-IRON melt shows a HIGH severity anomaly (score: 0.87)...",
  "summary": "HIGH severity anomaly detected. Immediate correction required.",
  "action_items": [
    "Add 0.22% Silicon to reach target range",
    "Add 0.15% Manganese for tensile strength",
    "Re-test composition after additions",
    "Monitor temperature stability"
  ],
  "risk_level": "HIGH",
  "confidence": 0.93,
  "context": {
    "composition": {"Fe": 94.5, "C": 3.2, ...},
    "grade": "GREY-IRON",
    "anomaly_score": 0.87,
    "severity": "HIGH",
    "recommended_additions": {"Si": 0.22, "Mn": 0.15}
  },
  "timestamp": "2024-01-15T10:30:45.123Z"
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `explanation` | string | Full natural language explanation (200-500 words) |
| `summary` | string | Brief one-sentence summary |
| `action_items` | array | List of operator action steps |
| `risk_level` | string | `LOW`, `MEDIUM`, or `HIGH` |
| `confidence` | float | ML model confidence (0.0-1.0) |
| `context` | object | Analysis context (ML predictions) |
| `timestamp` | string | ISO 8601 timestamp |

### Frontend Integration Example

```javascript
async function explainAnalysis(composition, grade) {
  const response = await fetch('http://localhost:8001/copilot/explain', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ composition, grade })
  });
  
  const result = await response.json();
  
  // Display explanation
  document.getElementById('explanation').textContent = result.explanation;
  
  // Display action items
  const actionList = document.getElementById('actions');
  result.action_items.forEach(action => {
    const li = document.createElement('li');
    li.textContent = action;
    actionList.appendChild(li);
  });
  
  // Show risk badge
  document.getElementById('risk-badge').textContent = result.risk_level;
  document.getElementById('risk-badge').className = `badge badge-${result.risk_level.toLowerCase()}`;
}
```

---

## 2. Chat with Copilot

**Endpoint:** `POST /copilot/chat`

**Purpose:** Interactive Q&A about analysis

**Description:**
Ask follow-up questions about the latest analysis, metallurgical concepts, or get clarification on recommendations. Maintains conversation history for context-aware responses.

### Request

```json
POST /copilot/chat
Content-Type: application/json

{
  "message": "Why do we need to add Manganese?",
  "include_context": true
}
```

### Request Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | Yes | User's question or message |
| `include_context` | boolean | No | Include latest analysis context (default: true) |

### Response

```json
{
  "response": "Manganese is recommended (0.15% addition) for several critical reasons:\n\n1. **Tensile Strength**: Your current Mn level (0.4%) is below the GREY-IRON specification (0.5-0.9%). Manganese is a carbide stabilizer that significantly improves tensile strength.\n\n2. **Deoxidation**: Mn acts as a deoxidizer, removing harmful oxygen from the melt, which improves casting quality.\n\n3. **Sulfur Neutralization**: Manganese combines with sulfur (you have 0.10% S) to form MnS, preventing iron sulfide formation which causes hot shortness.\n\nThe 0.15% addition will bring you to 0.55%, safely within the target range.",
  "conversation_id": "conv_12345"
}
```

### Example Questions

```
"Why do we need to add Manganese?"
"What happens if we don't correct this deviation?"
"Explain the risk level"
"What is the confidence score?"
"How much Silicon should we add?"
"Can you explain the anomaly score?"
"What is hot shortness?"
```

### Frontend Integration Example

```javascript
// Chat interface
async function sendMessage(message) {
  const response = await fetch('http://localhost:8001/copilot/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      message,
      include_context: true 
    })
  });
  
  const result = await response.json();
  
  // Display response
  addMessageToChat('user', message);
  addMessageToChat('assistant', result.response);
}

// Clear conversation
async function clearHistory() {
  await fetch('http://localhost:8001/copilot/chat/history', {
    method: 'DELETE'
  });
  console.log('Conversation history cleared');
}
```

---

## 3. Clear Chat History

**Endpoint:** `DELETE /copilot/chat/history`

**Purpose:** Clear conversation history

**Description:**
Clears conversation history for a fresh start. Useful when starting a new analysis session.

### Request

```http
DELETE /copilot/chat/history
```

### Response

```json
{
  "message": "Conversation history cleared",
  "success": true
}
```

---

## 4. Transcribe Audio (Speech-to-Text)

**Endpoint:** `POST /copilot/voice/transcribe`

**Purpose:** Convert voice input to text

**Description:**
Upload audio file and get transcribed text. Uses Groq Whisper large-v3 model for high accuracy.

### Request

```http
POST /copilot/voice/transcribe
Content-Type: multipart/form-data

audio=@recording.wav
language=en (optional)
```

### Supported Formats

- WAV
- MP3
- M4A
- OGG
- FLAC

### Response

```json
{
  "text": "Why do we need to add manganese?",
  "language": "en",
  "success": true,
  "error": null
}
```

### Frontend Integration Example

```javascript
// Record and transcribe audio
async function transcribeAudio(audioBlob) {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.wav');
  formData.append('language', 'en');
  
  const response = await fetch('http://localhost:8001/copilot/voice/transcribe', {
    method: 'POST',
    body: formData
  });
  
  const result = await response.json();
  
  if (result.success) {
    // Use transcribed text for chat
    sendMessage(result.text);
  } else {
    console.error('Transcription failed:', result.error);
  }
}

// Example: Record audio using MediaRecorder API
let mediaRecorder;
let audioChunks = [];

async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);
  
  mediaRecorder.ondataavailable = (event) => {
    audioChunks.push(event.data);
  };
  
  mediaRecorder.onstop = async () => {
    const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
    await transcribeAudio(audioBlob);
    audioChunks = [];
  };
  
  mediaRecorder.start();
}

function stopRecording() {
  mediaRecorder.stop();
}
```

---

## 5. Synthesize Speech (Text-to-Speech)

**Endpoint:** `POST /copilot/voice/synthesize`

**Purpose:** Convert text to voice

**Description:**
Convert text to speech audio (MP3 format). Uses Google Text-to-Speech (gTTS) for natural voice output.

### Request

```json
POST /copilot/voice/synthesize
Content-Type: application/json

{
  "text": "Manganese addition of 0.15% is recommended to improve tensile strength.",
  "language": "en",
  "slow": false
}
```

### Request Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | string | Yes | Text to convert (max 5000 chars) |
| `language` | string | No | Language code (default: "en") |
| `slow` | boolean | No | Speak slowly (default: false) |

### Response

Returns MP3 audio file with `Content-Type: audio/mpeg`

### Frontend Integration Example

```javascript
// Text-to-Speech
async function speakText(text, language = 'en') {
  const response = await fetch('http://localhost:8001/copilot/voice/synthesize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language, slow: false })
  });
  
  const audioBlob = await response.blob();
  const audioUrl = URL.createObjectURL(audioBlob);
  
  // Play audio
  const audio = new Audio(audioUrl);
  audio.play();
  
  // Clean up after playing
  audio.onended = () => {
    URL.revokeObjectURL(audioUrl);
  };
}

// Speak explanation
async function speakExplanation() {
  const explanation = document.getElementById('explanation').textContent;
  await speakText(explanation);
}
```

---

## 6. Get Supported Languages

**Endpoint:** `GET /copilot/voice/languages`

**Purpose:** Get supported languages

**Description:**
Returns list of language codes and names supported by both Speech-to-Text and Text-to-Speech services.

### Request

```http
GET /copilot/voice/languages
```

### Response

```json
{
  "languages": {
    "en": "English",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "it": "Italian",
    "pt": "Portuguese",
    "ru": "Russian",
    "ja": "Japanese",
    "ko": "Korean",
    "zh": "Chinese",
    "hi": "Hindi",
    "ar": "Arabic"
  }
}
```

---

## Complete Frontend Integration Example

### HTML

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>MetalliSense Copilot</title>
  <style>
    .risk-high { background: #ff4444; color: white; }
    .risk-medium { background: #ffaa00; color: white; }
    .risk-low { background: #44ff44; color: black; }
    .chat-user { text-align: right; background: #e3f2fd; }
    .chat-assistant { text-align: left; background: #f5f5f5; }
  </style>
</head>
<body>
  <div id="app">
    <!-- Composition Input -->
    <h2>Composition Analysis</h2>
    <div>
      <input type="number" id="Fe" placeholder="Fe %" value="94.5">
      <input type="number" id="C" placeholder="C %" value="3.2">
      <input type="number" id="Si" placeholder="Si %" value="2.0">
      <input type="number" id="Mn" placeholder="Mn %" value="0.4">
      <input type="number" id="P" placeholder="P %" value="0.05">
      <input type="number" id="S" placeholder="S %" value="0.10">
      <select id="grade">
        <option>GREY-IRON</option>
        <option>SG-IRON</option>
        <option>STEEL</option>
      </select>
      <button onclick="analyzeComposition()">Analyze</button>
    </div>

    <!-- Explanation -->
    <div id="results">
      <h3>Analysis Results</h3>
      <span id="risk-badge" class="badge"></span>
      <p id="explanation"></p>
      <button onclick="speakExplanation()">🔊 Read Aloud</button>
      
      <h4>Action Items</h4>
      <ul id="actions"></ul>
    </div>

    <!-- Chat Interface -->
    <div id="chat-container">
      <h3>Ask Copilot</h3>
      <div id="messages"></div>
      <input type="text" id="chat-input" placeholder="Ask a question...">
      <button onclick="sendChatMessage()">Send</button>
      <button onclick="startVoiceInput()">🎤 Voice Input</button>
      <button onclick="clearChat()">Clear History</button>
    </div>
  </div>

  <script src="copilot-client.js"></script>
</body>
</html>
```

### JavaScript Client

```javascript
// copilot-client.js

const API_BASE = 'http://localhost:8001';

// Analyze composition
async function analyzeComposition() {
  const composition = {
    Fe: parseFloat(document.getElementById('Fe').value),
    C: parseFloat(document.getElementById('C').value),
    Si: parseFloat(document.getElementById('Si').value),
    Mn: parseFloat(document.getElementById('Mn').value),
    P: parseFloat(document.getElementById('P').value),
    S: parseFloat(document.getElementById('S').value)
  };
  
  const grade = document.getElementById('grade').value;
  
  const response = await fetch(`${API_BASE}/copilot/explain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ composition, grade })
  });
  
  const result = await response.json();
  
  // Display results
  document.getElementById('explanation').textContent = result.explanation;
  document.getElementById('risk-badge').textContent = result.risk_level;
  document.getElementById('risk-badge').className = `badge risk-${result.risk_level.toLowerCase()}`;
  
  // Display actions
  const actionList = document.getElementById('actions');
  actionList.innerHTML = '';
  result.action_items.forEach(action => {
    const li = document.createElement('li');
    li.textContent = action;
    actionList.appendChild(li);
  });
}

// Chat
async function sendChatMessage() {
  const message = document.getElementById('chat-input').value;
  if (!message) return;
  
  addMessage('user', message);
  document.getElementById('chat-input').value = '';
  
  const response = await fetch(`${API_BASE}/copilot/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, include_context: true })
  });
  
  const result = await response.json();
  addMessage('assistant', result.response);
}

function addMessage(role, text) {
  const messagesDiv = document.getElementById('messages');
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-${role}`;
  messageDiv.textContent = text;
  messagesDiv.appendChild(messageDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Voice input
let mediaRecorder;
let audioChunks = [];

async function startVoiceInput() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);
  
  mediaRecorder.ondataavailable = (event) => {
    audioChunks.push(event.data);
  };
  
  mediaRecorder.onstop = async () => {
    const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
    audioChunks = [];
    
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.wav');
    
    const response = await fetch(`${API_BASE}/copilot/voice/transcribe`, {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    if (result.success) {
      document.getElementById('chat-input').value = result.text;
    }
  };
  
  mediaRecorder.start();
  alert('Recording... Click OK to stop.');
  setTimeout(() => mediaRecorder.stop(), 5000); // Auto-stop after 5s
}

// Text-to-speech
async function speakExplanation() {
  const text = document.getElementById('explanation').textContent;
  
  const response = await fetch(`${API_BASE}/copilot/voice/synthesize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language: 'en', slow: false })
  });
  
  const audioBlob = await response.blob();
  const audioUrl = URL.createObjectURL(audioBlob);
  const audio = new Audio(audioUrl);
  audio.play();
  audio.onended = () => URL.revokeObjectURL(audioUrl);
}

// Clear chat
async function clearChat() {
  await fetch(`${API_BASE}/copilot/chat/history`, { method: 'DELETE' });
  document.getElementById('messages').innerHTML = '';
}
```

---

## Setup Instructions

### 1. Environment Variables

Create a `.env` file in the project root:

```bash
# Groq API Key (required for Copilot)
GROQ_API_KEY=your_groq_api_key_here
```

Get your Groq API key from: https://console.groq.com/keys

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

New dependencies added:
- `groq==0.11.0` - Groq Python SDK
- `gTTS==2.5.1` - Google Text-to-Speech

### 3. Start the API Service

```bash
cd app
python main.py
```

Or use uvicorn:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

### 4. Test Endpoints

Visit: http://localhost:8001/docs

---

## Error Handling

All endpoints return standard HTTP status codes:

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad Request (invalid input) |
| 503 | Service Unavailable (model not loaded) |
| 500 | Internal Server Error |

### Error Response Format

```json
{
  "error": "Error message",
  "detail": "Detailed error information",
  "status_code": 500
}
```

---

## Performance Considerations

1. **First Request Latency**: ~2-3 seconds (LLM processing)
2. **Subsequent Requests**: ~1-2 seconds (with conversation history)
3. **Voice Transcription**: ~1-2 seconds (depends on audio length)
4. **Voice Synthesis**: ~500ms (depends on text length)

### Optimization Tips

- Cache explanations for identical compositions
- Use streaming for long explanations
- Implement rate limiting for voice services
- Pre-load models on startup

---

## Security Considerations

1. **API Key Protection**: Never expose GROQ_API_KEY in frontend code
2. **Input Validation**: All inputs are validated via Pydantic schemas
3. **File Upload Limits**: Audio files limited to reasonable sizes
4. **Rate Limiting**: Implement rate limiting in production
5. **CORS Configuration**: Configure CORS appropriately for production

---

## Troubleshooting

### Copilot not initializing

**Error:** `Explainable AI Copilot not initialized`

**Solution:**
- Check GROQ_API_KEY environment variable
- Verify API key is valid
- Check network connectivity to Groq API

### Voice transcription fails

**Error:** `Transcription error`

**Solution:**
- Check audio file format (WAV, MP3, M4A, OGG, FLAC)
- Verify audio file is not corrupted
- Check file size is reasonable (<10MB)

### Text-to-speech fails

**Error:** `Speech synthesis error`

**Solution:**
- Check text length (<5000 characters)
- Verify language code is supported
- Check gTTS installation

---

## Support

For issues or questions:
- Check API documentation: http://localhost:8001/docs
- Review error messages in console
- Check logs in terminal where API is running

---

## Changelog

### v1.0.0 (2024-01-15)
- Initial release
- Groq LLM integration (llama-3.3-70b-versatile)
- Voice services (Whisper STT + gTTS TTS)
- Interactive chatbot with conversation history
- Multi-language support (12 languages)
