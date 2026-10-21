# MetalliSense AI Service - Frontend Integration Guide
## Explainable AI Copilot & Voice Services

---

## 🎯 Overview

This document describes the **NEW Explainable AI Copilot features** added to the MetalliSense AI Service. These endpoints transform raw ML predictions into human-readable explanations and enable voice-based interactions.

**Base URL:** `http://localhost:8001`

---

## 🆕 New Features Added

### 1. **Explainable AI Copilot**
   - Converts ML predictions into natural language explanations
   - Interactive chatbot for Q&A about analysis results
   - Risk assessment and operator guidance
   - Powered by Groq LLM (llama-3.3-70b-versatile)

### 2. **Voice Services**
   - Speech-to-Text (voice input recognition)
   - Text-to-Speech (voice output generation)
   - Multi-language support (12 languages)
   - Powered by Groq Whisper & Google TTS

---

## 📡 API Endpoints

### **1. Get Explanation for Analysis**

**Endpoint:** `POST /copilot/explain`

**Purpose:** Get human-readable explanation of ML analysis results

**Input:**
```json
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

**Output:**
```json
{
  "explanation": "Full natural language explanation of the analysis...",
  "summary": "Brief 2-3 sentence summary",
  "action_items": [
    "Add 0.15% Manganese to improve tensile strength",
    "Monitor sulfur levels - currently at upper limit",
    "Retest composition after adjustments"
  ],
  "risk_level": "MEDIUM",
  "confidence": 0.89,
  "context": {
    "anomaly_detected": true,
    "severity": "MEDIUM",
    "alloy_invoked": true,
    "recommendations": {
      "Mn": 0.15,
      "Si": 0.10
    }
  },
  "timestamp": "2024-01-15T10:30:45.123Z"
}
```

**Response Fields:**
- `explanation` (string): Detailed natural language explanation (3-5 paragraphs)
- `summary` (string): Brief summary for quick reading
- `action_items` (array): Step-by-step operator instructions
- `risk_level` (string): "LOW", "MEDIUM", or "HIGH"
- `confidence` (float): 0.0 to 1.0 confidence score
- `context` (object): Raw ML analysis data for reference
- `timestamp` (string): ISO 8601 timestamp

**Use Cases:**
- Display explanation in results dashboard
- Show action items in operator checklist
- Display risk badge with color coding
- Log explanations for audit trail

---

### **2. Interactive Chat**

**Endpoint:** `POST /copilot/chat`

**Purpose:** Ask questions about the latest analysis or metallurgical concepts

**Input:**
```json
{
  "message": "Why do we need to add Manganese?",
  "include_context": true
}
```

**Parameters:**
- `message` (string, required): User's question
- `include_context` (boolean, optional, default: true): Include latest analysis context in response

**Output:**
```json
{
  "response": "Manganese is recommended because your current composition shows 0.4% Mn, which is below the ideal range for GREY-IRON (0.5-0.8%). Adding 0.15% Manganese will:\n\n1. Improve tensile strength by 8-12%\n2. Enhance hardenability\n3. Neutralize sulfur effects\n4. Reduce brittleness\n\nSkipping this addition could result in reduced mechanical properties and increased rejection probability.",
  "conversation_id": "conv_1737543045_abc123",
  "timestamp": "2024-01-15T10:31:15.456Z"
}
```

**Response Fields:**
- `response` (string): Natural language answer to the question
- `conversation_id` (string): Unique conversation session ID
- `timestamp` (string): ISO 8601 timestamp

**Example Questions:**
- "Why do we need to add Manganese?"
- "What happens if we don't make this correction?"
- "Explain the risk level"
- "What is the confidence score?"
- "How accurate is this prediction?"
- "What are the consequences of high sulfur?"

**Chat Features:**
- Maintains conversation history (remembers previous questions)
- References latest analysis context automatically
- Provides metallurgical expertise explanations
- Conversational and operator-friendly tone

---

### **3. Clear Chat History**

**Endpoint:** `DELETE /copilot/chat/history`

**Purpose:** Clear conversation history for a fresh start

**Input:** None (no request body required)

**Output:**
```json
{
  "message": "Conversation history cleared",
  "success": true
}
```

**Use Cases:**
- Clear history when starting new analysis session
- Reset conversation when switching operators
- Clean up after completing a batch

---

### **4. Speech-to-Text (Voice Input)**

**Endpoint:** `POST /copilot/voice/transcribe`

**Purpose:** Convert voice recording to text

**Input:** 
- **Type:** `multipart/form-data` (file upload)
- **Field:** `audio` (file, required)
- **Field:** `language` (string, optional, e.g., "en", "es", "fr")

**Supported Audio Formats:**
- WAV
- MP3
- M4A
- OGG
- FLAC

**Output:**
```json
{
  "text": "Why do we need to add manganese to this batch?",
  "language": "en",
  "success": true,
  "duration": 2.5
}
```

**Response Fields:**
- `text` (string): Transcribed text from audio
- `language` (string): Detected/specified language code
- `success` (boolean): Transcription success status
- `duration` (float): Audio duration in seconds

**Use Cases:**
- Voice input for chat questions
- Hands-free operator queries in noisy foundry environment
- Accessibility features for operators
- Mobile voice commands

**Frontend Implementation Notes:**
- Use HTML5 MediaRecorder API or file upload
- Send recorded blob as multipart/form-data
- Display transcribed text before sending to chat
- Add "recording" and "processing" UI states

---

### **5. Text-to-Speech (Voice Output)**

**Endpoint:** `POST /copilot/voice/synthesize`

**Purpose:** Convert text to voice audio

**Input:**
```json
{
  "text": "Manganese addition of 0.15% is recommended to improve tensile strength. The current composition is below specification.",
  "language": "en",
  "slow": false
}
```

**Parameters:**
- `text` (string, required): Text to convert to speech
- `language` (string, required): Language code (e.g., "en", "es", "fr")
- `slow` (boolean, optional, default: false): Speak slowly for clarity

**Output:** 
- **Content-Type:** `audio/mpeg`
- **Format:** MP3 audio file (binary data)

**Response Headers:**
```
Content-Type: audio/mpeg
Content-Disposition: inline; filename=speech.mp3
```

**Use Cases:**
- Read explanations aloud to operators
- Audio alerts for critical warnings
- Hands-free operation guidance
- Accessibility for visually impaired operators

**Frontend Implementation Notes:**
- Response is binary audio data (not JSON)
- Create audio blob and play using HTML5 Audio API
- Add "play", "pause", "stop" controls
- Show audio waveform or progress bar
- Cache audio for repeated playback

**Example JavaScript:**
```javascript
const response = await fetch('/copilot/voice/synthesize', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    text: "Manganese addition recommended",
    language: "en",
    slow: false
  })
});

const audioBlob = await response.blob();
const audioUrl = URL.createObjectURL(audioBlob);
const audio = new Audio(audioUrl);
audio.play();
```

---

### **6. Get Supported Languages**

**Endpoint:** `GET /copilot/voice/languages`

**Purpose:** Get list of supported languages for voice services

**Input:** None

**Output:**
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

**Response Fields:**
- `languages` (object): Key-value pairs of language code and name

**Use Cases:**
- Populate language selector dropdown
- Display supported languages in settings
- Validate language selection before API calls

---

## 🎨 UI/UX Recommendations

### **Explanation Display**
- **Card Layout:** Display explanation in expandable card
- **Summary Badge:** Show summary at top with expand arrow
- **Action Checklist:** Display action items as checkboxes
- **Risk Indicator:** Color-coded badge (🟢 LOW, 🟡 MEDIUM, 🔴 HIGH)
- **Confidence Bar:** Visual progress bar showing confidence score
- **Timestamp:** Show "Analyzed 2 minutes ago"

### **Chat Interface**
- **Chat Bubble Design:** User messages on right, AI responses on left
- **Typing Indicator:** Show "AI is thinking..." while processing
- **Conversation History:** Scrollable chat history
- **Clear Button:** Button to clear history and start fresh
- **Context Toggle:** Checkbox to include/exclude analysis context
- **Suggested Questions:** Show clickable question suggestions

### **Voice Controls**
- **Record Button:** Red circular button with waveform animation
- **Play/Pause Button:** Standard audio controls for TTS
- **Language Selector:** Dropdown or flag icons for language selection
- **Volume Slider:** Control voice output volume
- **Transcript Display:** Show transcribed text before sending
- **Voice Indicator:** Visual feedback during recording/playback

---

## 🔐 Security & Safety

### **Advisory Only**
- All explanations are advisory, not commands
- Display "Human approval required" message
- Log all AI interactions for audit

### **Confidence Thresholds**
- Show warnings when confidence < 0.7
- Highlight low-confidence recommendations
- Suggest human expert review for critical cases

### **Data Privacy**
- Voice recordings are temporary (deleted after transcription)
- Chat history stored in memory only (cleared on restart)
- No PII collected or stored

---

## 🚨 Error Handling

### **Common Errors**

**503 Service Unavailable:**
```json
{
  "error": "Explainable AI Copilot not initialized",
  "status_code": 503
}
```
**Cause:** Groq API key not configured or copilot failed to load

**Solution:** Display "AI features unavailable. Contact administrator."

---

**500 Internal Server Error:**
```json
{
  "error": "Explanation generation error: Rate limit exceeded",
  "status_code": 500
}
```
**Cause:** Groq API rate limit reached or network error

**Solution:** Display "AI service temporarily unavailable. Please try again."

---

**422 Unprocessable Entity (Voice):**
```json
{
  "detail": "Invalid audio format. Supported: WAV, MP3, M4A, OGG, FLAC"
}
```
**Cause:** Uploaded audio file in unsupported format

**Solution:** Display format error and list supported formats

---

## 📊 Integration Workflow

### **Complete Analysis Flow:**

1. **User submits composition** → `POST /agents/analyze`
2. **Get ML results** → Anomaly score, severity, recommendations
3. **Get explanation** → `POST /copilot/explain` (auto-triggered)
4. **Display results:**
   - Show ML metrics (anomaly score, severity)
   - Display explanation card
   - List action items
   - Show risk indicator
5. **Enable voice output** → Add "🔊 Read Aloud" button
6. **Enable chat** → Add "💬 Ask AI" button for questions

### **Voice-First Workflow:**

1. **User clicks mic button** → Start recording
2. **User speaks question** → Stop recording
3. **Upload audio** → `POST /copilot/voice/transcribe`
4. **Display transcribed text** → Show "You asked: ..."
5. **Send to chat** → `POST /copilot/chat`
6. **Get response** → Display chat response
7. **Auto-play audio** → `POST /copilot/voice/synthesize` (optional)

---

## 🎯 Key Differentiators

### **Why This is NOT Just a Chatbot:**

1. **Decision Intelligence:** Explains WHY recommendations are made
2. **Risk Assessment:** Quantifies consequences of actions/inactions
3. **Operator Guidance:** Provides step-by-step action items
4. **Metallurgical Expertise:** Domain-specific knowledge
5. **Multi-Modal:** Voice + Text + Visual explanations
6. **Production-Ready:** Advisory-only, audit-logged, safe

### **Value Proposition for Operators:**

- ❌ **Before:** "Add 0.15% Mn" (black box, no trust)
- ✅ **After:** "Add 0.15% Mn because current level is below spec. This improves tensile strength by 8-12% and reduces rejection probability. Skipping this increases brittleness risk." (explainable, trustworthy)

---

## 📱 Mobile Considerations

- **Voice features ideal for mobile** (hands-free operation)
- **Chat interface optimized for touch** (large tap targets)
- **Responsive text size** (readable in foundry lighting)
- **Offline fallback** (show cached explanations)
- **Push notifications** (for critical risk alerts)

---

## 🧪 Testing Checklist

- [ ] Test explanation generation with various compositions
- [ ] Test chat with follow-up questions
- [ ] Test clear chat history
- [ ] Test voice transcription with different accents
- [ ] Test TTS playback in browser
- [ ] Test language switching
- [ ] Test error handling (invalid input, API failures)
- [ ] Test confidence thresholds display
- [ ] Test risk level color coding
- [ ] Test audit logging

---

## 📞 Support

For API issues or feature requests, contact the backend team.

**Health Check:** `GET /health` - Verify all services are running

**Documentation:** `http://localhost:8001/docs` - Interactive API docs

---

**End of Integration Guide**
