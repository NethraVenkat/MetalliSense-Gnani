# API Routes Specification for Frontend Integration

## Base URL
```
http://localhost:8001
```

---

## 🆕 Copilot Endpoints (Explainable AI)

### 1. Get Explanation for Analysis
```
POST /copilot/explain
```

**Request:**
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

**Response:**
```json
{
  "explanation": "Full natural language explanation...",
  "summary": "Brief one-sentence summary",
  "action_items": [
    "Step 1: Do this",
    "Step 2: Do that"
  ],
  "risk_level": "HIGH",
  "confidence": 0.93,
  "context": {...},
  "timestamp": "2024-01-15T10:30:45.123Z"
}
```

---

### 2. Interactive Chat
```
POST /copilot/chat
```

**Request:**
```json
{
  "message": "Why do we need to add Manganese?",
  "include_context": true
}
```

**Response:**
```json
{
  "response": "Manganese is recommended because...",
  "conversation_id": "conv_12345"
}
```

---

### 3. Clear Chat History
```
DELETE /copilot/chat/history
```

**Response:**
```json
{
  "message": "Conversation history cleared",
  "success": true
}
```

---

### 4. Speech-to-Text (Voice Input)
```
POST /copilot/voice/transcribe
Content-Type: multipart/form-data
```

**Request:**
```
audio: <audio file>
language: "en" (optional)
```

**Response:**
```json
{
  "text": "Transcribed text here",
  "language": "en",
  "success": true,
  "error": null
}
```

**Supported Formats:** WAV, MP3, M4A, OGG, FLAC

---

### 5. Text-to-Speech (Voice Output)
```
POST /copilot/voice/synthesize
```

**Request:**
```json
{
  "text": "Text to convert to speech",
  "language": "en",
  "slow": false
}
```

**Response:**
Binary MP3 audio file (Content-Type: audio/mpeg)

---

### 6. Get Supported Languages
```
GET /copilot/voice/languages
```

**Response:**
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

## 🤖 ML Agent Endpoints

### 7. Agent Analysis (Main Production Endpoint)
```
POST /agents/analyze
```

**Request:**
```json
{
  "composition": {
    "Fe": 81.2,
    "C": 4.4,
    "Si": 3.1,
    "Mn": 0.4,
    "P": 0.05,
    "S": 0.02
  },
  "grade": "SG-IRON"
}
```

**Response:**
```json
{
  "anomaly_agent": {
    "agent": "AnomalyDetectionAgent",
    "anomaly_score": 0.87,
    "severity": "HIGH",
    "confidence": 0.93,
    "explanation": "..."
  },
  "alloy_agent": {
    "agent": "AlloyCorrectionAgent",
    "recommended_additions": {
      "Si": 0.22,
      "Mn": 0.15
    },
    "confidence": 0.91,
    "explanation": "..."
  },
  "final_note": "Human approval required before action",
  "timestamp": "2025-12-22T10:30:00.000Z"
}
```

---

### 8. Health Check
```
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "message": "All models loaded",
  "models_loaded": {
    "anomaly_model": true,
    "alloy_model": true,
    "agent_manager": true,
    "copilot": true,
    "voice_service": true
  }
}
```

---

### 9. Get Available Grades
```
GET /grades
```

**Response:**
```json
{
  "grades": ["GREY-IRON", "SG-IRON", "STEEL", ...],
  "count": 10
}
```

---

### 10. Get Grade Specification
```
GET /grades/{grade}
```

Example: `GET /grades/GREY-IRON`

**Response:**
```json
{
  "grade": "GREY-IRON",
  "specification": {
    "Fe": {"min": 92.0, "max": 96.0},
    "C": {"min": 2.5, "max": 4.0},
    "Si": {"min": 1.0, "max": 3.0},
    ...
  }
}
```

---

## 🔧 Legacy Endpoints (Backward Compatibility)

### 11. Anomaly Detection Only
```
POST /anomaly/predict
```

**Request:**
```json
{
  "composition": {
    "Fe": 81.2,
    "C": 4.4,
    "Si": 3.1,
    "Mn": 0.4,
    "P": 0.05,
    "S": 0.02
  }
}
```

**Response:**
```json
{
  "anomaly_score": 0.86,
  "severity": "HIGH",
  "message": "High anomaly detected..."
}
```

---

### 12. Alloy Correction Only
```
POST /alloy/recommend
```

**Request:**
```json
{
  "grade": "SG-IRON",
  "composition": {
    "Fe": 81.2,
    "C": 4.4,
    "Si": 3.1,
    "Mn": 0.4,
    "P": 0.05,
    "S": 0.02
  }
}
```

**Response:**
```json
{
  "recommended_additions": {
    "Si": 0.22,
    "Mn": 0.15
  },
  "confidence": 0.91,
  "message": "High confidence recommendation...",
  "warning": null
}
```

---

## Quick Reference Table

| Endpoint | Method | Purpose | New Feature |
|----------|--------|---------|-------------|
| `/copilot/explain` | POST | Get human explanation | ✅ |
| `/copilot/chat` | POST | Interactive Q&A | ✅ |
| `/copilot/chat/history` | DELETE | Clear conversation | ✅ |
| `/copilot/voice/transcribe` | POST | Speech-to-Text | ✅ |
| `/copilot/voice/synthesize` | POST | Text-to-Speech | ✅ |
| `/copilot/voice/languages` | GET | Supported languages | ✅ |
| `/agents/analyze` | POST | Main ML analysis | ⭐ Recommended |
| `/health` | GET | Health check | ⭐ Check first |
| `/grades` | GET | List grades | |
| `/grades/{grade}` | GET | Grade specification | |
| `/anomaly/predict` | POST | Anomaly only | Legacy |
| `/alloy/recommend` | POST | Alloy only | Legacy |

---

## Frontend Integration Examples

### JavaScript/React

```javascript
const API_BASE = 'http://localhost:8001';

// 1. Get explanation
async function explainAnalysis(composition, grade) {
  const response = await fetch(`${API_BASE}/copilot/explain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ composition, grade })
  });
  return await response.json();
}

// 2. Chat
async function askCopilot(message) {
  const response = await fetch(`${API_BASE}/copilot/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, include_context: true })
  });
  return await response.json();
}

// 3. Voice input (Speech-to-Text)
async function transcribeAudio(audioBlob) {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.wav');
  
  const response = await fetch(`${API_BASE}/copilot/voice/transcribe`, {
    method: 'POST',
    body: formData
  });
  return await response.json();
}

// 4. Voice output (Text-to-Speech)
async function speakText(text, language = 'en') {
  const response = await fetch(`${API_BASE}/copilot/voice/synthesize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language, slow: false })
  });
  
  const audioBlob = await response.blob();
  const audioUrl = URL.createObjectURL(audioBlob);
  const audio = new Audio(audioUrl);
  audio.play();
}

// 5. Run ML analysis
async function analyzeComposition(composition, grade) {
  const response = await fetch(`${API_BASE}/agents/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ composition, grade })
  });
  return await response.json();
}

// Usage
const result = await explainAnalysis(
  {Fe: 94.5, C: 3.2, Si: 2.0, Mn: 0.4, P: 0.05, S: 0.10},
  "GREY-IRON"
);

console.log(result.explanation);
console.log(result.action_items);

await askCopilot("Why do we need to add Manganese?");
await speakText("Silicon addition is recommended");
```

---

### Python (for testing)

```python
import requests

API_BASE = "http://localhost:8001"

# 1. Get explanation
response = requests.post(f"{API_BASE}/copilot/explain", json={
    "composition": {"Fe": 94.5, "C": 3.2, "Si": 2.0, "Mn": 0.4, "P": 0.05, "S": 0.10},
    "grade": "GREY-IRON"
})
result = response.json()
print(result["explanation"])

# 2. Chat
response = requests.post(f"{API_BASE}/copilot/chat", json={
    "message": "Why do we need to add Manganese?",
    "include_context": True
})
print(response.json()["response"])

# 3. Voice output
response = requests.post(f"{API_BASE}/copilot/voice/synthesize", json={
    "text": "Silicon addition is recommended",
    "language": "en"
})
with open("speech.mp3", "wb") as f:
    f.write(response.content)

# 4. Health check
response = requests.get(f"{API_BASE}/health")
print(response.json())
```

---

### cURL (for testing)

```bash
# 1. Get explanation
curl -X POST "http://localhost:8001/copilot/explain" \
  -H "Content-Type: application/json" \
  -d '{"composition":{"Fe":94.5,"C":3.2,"Si":2.0,"Mn":0.4,"P":0.05,"S":0.10},"grade":"GREY-IRON"}'

# 2. Chat
curl -X POST "http://localhost:8001/copilot/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"Why do we need to add Manganese?","include_context":true}'

# 3. Voice output
curl -X POST "http://localhost:8001/copilot/voice/synthesize" \
  -H "Content-Type: application/json" \
  -d '{"text":"Silicon addition is recommended","language":"en"}' \
  --output speech.mp3

# 4. Health check
curl -X GET "http://localhost:8001/health"
```

---

## Error Handling

All endpoints return standard HTTP status codes:

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad Request (invalid input) |
| 503 | Service Unavailable (model not loaded) |
| 500 | Internal Server Error |

**Error Response Format:**
```json
{
  "error": "Error message",
  "detail": "Detailed error information",
  "status_code": 500
}
```

---

## Testing

### Quick Test
```bash
python test_copilot.py
```

### Interactive API Docs
Visit: http://localhost:8001/docs

---

## Complete Documentation

- **Full API Reference:** [COPILOT_API_REFERENCE.md](COPILOT_API_REFERENCE.md)
- **Setup Guide:** [COPILOT_SETUP.md](COPILOT_SETUP.md)
- **Implementation Summary:** [COPILOT_IMPLEMENTATION_SUMMARY.md](COPILOT_IMPLEMENTATION_SUMMARY.md)

---

**All routes are live and ready for frontend integration!** 🚀
