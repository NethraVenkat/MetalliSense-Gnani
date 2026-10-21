# 🚀 Agent System Quick Start Guide

**Get the MetalliSense Agent System running in 5 minutes**

---

## Prerequisites

- Python 3.11+
- Virtual environment activated
- Models trained (run setup if not done)

---

## Step 1: Activate Environment

```bash
cd ai-service

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate
```

---

## Step 2: Verify Models Are Trained

Check if model files exist:

```bash
# Windows
dir app\models\*.pkl

# Linux/Mac
ls -la app/models/*.pkl
```

You should see:
- `anomaly_model.pkl`
- `alloy_model.pkl`

If missing, train them:

```bash
python app/training/train_anomaly.py
python app/training/train_alloy_agent.py
```

---

## Step 3: Test Agents Individually

### Test Anomaly Agent

```bash
python app/agents/anomaly_agent_wrapper.py
```

Expected output:
```
============================================================
ANOMALY DETECTION AGENT TEST
============================================================
Metadata: {...}

Input: {'Fe': 81.2, 'C': 4.4, ...}

Output:
  agent: AnomalyDetectionAgent
  anomaly_score: 0.873
  severity: HIGH
  confidence: 0.931
  explanation: High anomaly detected...
============================================================
```

### Test Alloy Agent

```bash
python app/agents/alloy_agent_wrapper.py
```

Expected output:
```
============================================================
ALLOY CORRECTION AGENT TEST
============================================================
Metadata: {...}

Input Grade: SG-IRON
Input Composition: {...}

Output:
  agent: AlloyCorrectionAgent
  recommended_additions: {'Si': 0.22, 'Mn': 0.15}
  confidence: 0.912
  explanation: Adjusting elements toward grade midpoint...
============================================================
```

---

## Step 4: Test Agent Manager

```bash
python app/agents/agent_manager.py
```

Expected output:
```
============================================================
AGENT MANAGER TEST
============================================================
Status: {'manager_version': '1.0.0', ...}

Input Composition: {...}
Target Grade: SG-IRON

============================================================
AGENT MANAGER: Starting Analysis
============================================================
→ Running Anomaly Detection Agent...
  ✓ Anomaly Score: 0.873
  ✓ Severity: HIGH
  ✓ Confidence: 0.931
→ Running Alloy Correction Agent...
  ✓ Recommendations: 2 elements
  ✓ Confidence: 0.912
⚠ Human approval REQUIRED before any action
============================================================
AGENT MANAGER: Analysis Complete
============================================================
```

---

## Step 5: Start API Service

```bash
python app/main.py
```

Expected output:
```
============================================================
MetalliSense AI Intelligence Layer v1.0.0
============================================================
Initializing AI models...
Anomaly model loaded from: app/models/anomaly_model.pkl
✓ AI models loaded successfully
Initializing Agent Manager...
✓ Agent Manager initialized
============================================================
API Server starting on http://0.0.0.0:8000
Documentation: http://0.0.0.0:8000/docs
============================================================
```

---

## Step 6: Test API Endpoint

### Using curl

```bash
curl -X POST http://localhost:8000/agents/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "composition": {
      "Fe": 81.2,
      "C": 4.4,
      "Si": 3.1,
      "Mn": 0.4,
      "P": 0.04,
      "S": 0.02
    },
    "grade": "SG-IRON"
  }'
```

### Using Python

Create `test_agent_api.py`:

```python
import requests
import json

# Agent analysis endpoint
url = "http://localhost:8000/agents/analyze"

# Test data
data = {
    "composition": {
        "Fe": 81.2,
        "C": 4.4,
        "Si": 3.1,
        "Mn": 0.4,
        "P": 0.04,
        "S": 0.02
    },
    "grade": "SG-IRON"
}

# Make request
response = requests.post(url, json=data)

# Print results
print("Status Code:", response.status_code)
print("\nResponse:")
print(json.dumps(response.json(), indent=2))
```

Run it:
```bash
python test_agent_api.py
```

### Using the API Documentation

Open your browser and go to:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

Try the `/agents/analyze` endpoint interactively!

---

## Expected API Response

```json
{
  "anomaly_agent": {
    "agent": "AnomalyDetectionAgent",
    "anomaly_score": 0.873,
    "severity": "HIGH",
    "confidence": 0.931,
    "explanation": "High anomaly detected - composition significantly deviates from historical patterns..."
  },
  "alloy_agent": {
    "agent": "AlloyCorrectionAgent",
    "recommended_additions": {
      "Si": 0.22,
      "Mn": 0.15
    },
    "confidence": 0.912,
    "explanation": "Adjusting elements toward SG-IRON grade midpoint..."
  },
  "final_note": "Human approval required before action",
  "timestamp": "2025-12-22T10:30:00.000Z"
}
```

---

## Understanding the Response

### Anomaly Agent Output

- **anomaly_score** (0-1): How abnormal the reading is
  - 0.0-0.3 → LOW severity
  - 0.3-0.7 → MEDIUM severity
  - 0.7-1.0 → HIGH severity

- **severity**: LOW, MEDIUM, or HIGH

- **confidence** (0-1): How certain the agent is
  - > 0.9: Very confident
  - 0.7-0.9: Moderately confident
  - < 0.7: Low confidence

### Alloy Agent Output

- **recommended_additions**: Elements to add (percentage)
  - Only shown if severity is HIGH
  - Empty dict if not invoked

- **confidence** (0-1): Confidence in recommendation

- **explanation**: Why these additions are recommended

### Important Note

**final_note**: "Human approval required before action"

✅ This is NOT optional  
✅ No action should be taken automatically  
✅ Operator must review and approve  

---

## Testing Different Scenarios

### Scenario 1: Normal Composition (LOW Severity)

```json
{
  "composition": {
    "Fe": 82.5,
    "C": 3.8,
    "Si": 2.5,
    "Mn": 0.5,
    "P": 0.04,
    "S": 0.02
  },
  "grade": "SG-IRON"
}
```

Expected: 
- Anomaly severity: LOW
- Alloy agent: SKIPPED

### Scenario 2: Deviated Composition (HIGH Severity)

```json
{
  "composition": {
    "Fe": 81.2,
    "C": 4.4,
    "Si": 3.1,
    "Mn": 0.4,
    "P": 0.04,
    "S": 0.02
  },
  "grade": "SG-IRON"
}
```

Expected:
- Anomaly severity: HIGH
- Alloy agent: INVOKED
- Recommendations provided

### Scenario 3: Different Grade

```json
{
  "composition": {
    "Fe": 97.5,
    "C": 0.2,
    "Si": 0.1,
    "Mn": 1.0,
    "P": 0.03,
    "S": 0.02
  },
  "grade": "LOW-CARBON-STEEL"
}
```

---

## Troubleshooting

### ❌ "Model file not found"

**Solution**: Train the models first
```bash
python app/training/train_anomaly.py
python app/training/train_alloy_agent.py
```

### ❌ "Agent Manager not initialized"

**Solution**: Check that models are trained and loaded correctly

### ❌ "Module not found"

**Solution**: Make sure virtual environment is activated
```bash
# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate
```

### ❌ "Unknown grade"

**Solution**: Use one of these grades:
- SG-IRON
- GREY-IRON
- LOW-CARBON-STEEL
- MEDIUM-CARBON-STEEL
- HIGH-CARBON-STEEL

---

## Next Steps

1. ✅ **Integrate with Node.js Backend**
   - See `README.md` for integration examples

2. ✅ **Customize Decision Policy**
   - Edit `app/policies/decision_policy.py`

3. ✅ **Add Logging**
   - Implement proper logging for audit trail

4. ✅ **Deploy to Production**
   - Set up reverse proxy (nginx)
   - Configure CORS properly
   - Enable HTTPS

---

## Health Check

Verify everything is working:

```bash
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "healthy",
  "message": "All models loaded",
  "models_loaded": {
    "anomaly_model": true,
    "alloy_model": true,
    "agent_manager": true
  }
}
```

All `true` = System ready! 🚀

---

## Getting Help

- **Architecture Details**: See `DOCS/AGENT_ARCHITECTURE.md`
- **API Documentation**: http://localhost:8000/docs
- **Configuration**: Edit `app/config.py`

---

**🎉 Congratulations! Your agent system is now running!**
