# 🤖 MetalliSense Agent Architecture

**Production-Grade AI Agent System for Industrial Metallurgy**

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Principles](#architecture-principles)
3. [Agent Components](#agent-components)
4. [Agent Workflow](#agent-workflow)
5. [Decision Policy](#decision-policy)
6. [Safety & Governance](#safety--governance)
7. [API Contract](#api-contract)
8. [Testing Agents](#testing-agents)

---

## Overview

MetalliSense implements a **production-grade agentic architecture** that wraps trained ML models into advisory AI agents. The system is designed for industrial metal quality control, providing intelligent decision support for spectrometer analysis and alloy correction.

### Core Design Philosophy

✅ **Advisory, Not Autonomous**  
Agents provide recommendations, never take actions

✅ **Stateless by Design**  
Each prediction is independent, no memory between calls

✅ **Deterministic**  
Same input always produces same output

✅ **Explainable**  
Every decision includes human-readable reasoning

✅ **Safe by Default**  
Multiple layers of safety constraints

---

## Architecture Principles

### 1. Agent Encapsulation

Each agent encapsulates **ONE responsibility**:

- **Anomaly Detection Agent**: "Is this reading abnormal?"
- **Alloy Correction Agent**: "What additions will correct the deviation?"

Agents are **wrappers around trained ML models**, not the models themselves.

### 2. Separation of Concerns

```
┌─────────────────────────────────────────┐
│  ML Model (anomaly_agent.py)           │  ← Training & Inference
│  • Isolation Forest                    │
│  • Model persistence                   │
└─────────────────────────────────────────┘
                  ↓ wrapped by
┌─────────────────────────────────────────┐
│  Agent Wrapper (anomaly_agent_wrapper.py)│ ← Production Interface
│  • Input/output contracts              │
│  • Confidence calculation              │
│  • Explanation generation              │
│  • Error handling                      │
└─────────────────────────────────────────┘
                  ↓ managed by
┌─────────────────────────────────────────┐
│  Agent Manager (agent_manager.py)      │  ← Orchestration
│  • Agent coordination                  │
│  • Policy enforcement                  │
│  • Safety rules                        │
└─────────────────────────────────────────┘
                  ↓ controlled by
┌─────────────────────────────────────────┐
│  Decision Policy (decision_policy.py)  │  ← Business Logic
│  • When to invoke agents               │
│  • Execution order                     │
│  • Approval requirements               │
└─────────────────────────────────────────┘
```

### 3. Never Direct Agent-to-Agent Communication

❌ **WRONG:**
```python
# Agents calling each other directly
anomaly_result = anomaly_agent.analyze(composition)
if anomaly_result['severity'] == 'HIGH':
    alloy_result = alloy_agent.recommend(grade, composition)  # WRONG!
```

✅ **CORRECT:**
```python
# Agent Manager orchestrates
result = agent_manager.analyze(composition, grade)
# Manager decides which agents to invoke based on policy
```

---

## Agent Components

### Component 1: Anomaly Detection Agent

**File**: `app/agents/anomaly_agent_wrapper.py`

**Purpose**: Detect abnormal spectrometer behavior

**Input Schema**:
```python
{
    "composition": {
        "Fe": 81.2,
        "C": 4.4,
        "Si": 3.1,
        "Mn": 0.4,
        "P": 0.04,
        "S": 0.02
    }
}
```

**Output Schema**:
```python
{
    "agent": "AnomalyDetectionAgent",
    "anomaly_score": 0.87,        # 0-1 scale
    "severity": "HIGH",           # LOW, MEDIUM, HIGH
    "confidence": 0.93,           # 0-1 scale
    "explanation": "High anomaly detected - composition significantly deviates..."
}
```

**Key Methods**:
- `analyze(composition)` - Main agent interface
- `is_ready()` - Health check
- `get_metadata()` - Agent information

**Confidence Calculation**:
```python
# Distance from uncertainty (0.5)
confidence = 2 * abs(anomaly_score - 0.5)
# High confidence when score is near 0 or 1
# Low confidence when score is near 0.5
```

---

### Component 2: Alloy Correction Agent

**File**: `app/agents/alloy_agent_wrapper.py`

**Purpose**: Recommend alloy additions to correct deviations

**Input Schema**:
```python
{
    "grade": "SG-IRON",
    "composition": {
        "Fe": 81.2,
        "C": 4.4,
        "Si": 3.1,
        "Mn": 0.4,
        "P": 0.04,
        "S": 0.02
    }
}
```

**Output Schema**:
```python
{
    "agent": "AlloyCorrectionAgent",
    "recommended_additions": {
        "Si": 0.22,
        "Mn": 0.15
    },
    "confidence": 0.91,
    "explanation": "Adjusting elements toward SG-IRON grade midpoint..."
}
```

**Key Methods**:
- `recommend(grade, composition)` - Main agent interface
- `is_ready()` - Health check
- `get_metadata()` - Agent information
- `get_available_grades()` - List supported grades
- `get_grade_spec(grade)` - Grade specifications

**Addition Filtering**:
- Only positive additions (≥ 0.01%)
- Maximum 5% per element
- Elements below threshold excluded

---

### Component 3: Agent Manager

**File**: `app/agents/agent_manager.py`

**Purpose**: Orchestrate agent invocation and enforce policies

**Responsibilities**:
1. Coordinate agent invocation
2. Enforce decision policies
3. Aggregate agent responses
4. Ensure safety rules
5. Provide audit trail

**Main Method**:
```python
def analyze(composition: Dict, grade: str) -> Dict:
    """
    Orchestrate full agent analysis
    
    Workflow:
    1. Run Anomaly Detection Agent (ALWAYS)
    2. Check severity
    3. If HIGH, run Alloy Correction Agent
    4. Aggregate results
    5. Add safety notes
    """
```

**Output Schema**:
```python
{
    "anomaly_agent": { ... },     # Always present
    "alloy_agent": { ... },       # Conditional
    "final_note": "Human approval required before action",
    "timestamp": "2025-12-22T10:30:00.000Z"
}
```

---

### Component 4: Decision Policy

**File**: `app/policies/decision_policy.py`

**Purpose**: Define when and how agents are invoked

**Policy Rules**:

```python
# Policy 1: Always check for anomalies
should_check_anomaly(composition) -> True (always)

# Policy 2: Recommend alloy only for HIGH severity
should_recommend_alloy(anomaly_result, grade):
    if anomaly_result['severity'] == 'HIGH':
        return True
    return False

# Policy 3: Execution order (anomaly first)
get_execution_order() -> ["AnomalyDetectionAgent", "AlloyCorrectionAgent"]

# Policy 4: Always require human approval
requires_human_approval() -> True (always)

# Policy 5: No autonomous actions
is_action_allowed(action) -> False (always)
```

---

## Agent Workflow

### Flow Diagram

```
┌──────────────────────────────────────────────────────┐
│ 1. Incoming Request                                  │
│    POST /agents/analyze                              │
│    {composition, grade}                              │
└──────────────────┬───────────────────────────────────┘
                   ▼
┌──────────────────────────────────────────────────────┐
│ 2. Agent Manager Receives Request                    │
│    • Validates inputs                                │
│    • Checks agent readiness                          │
└──────────────────┬───────────────────────────────────┘
                   ▼
┌──────────────────────────────────────────────────────┐
│ 3. Decision Policy: Should Check Anomaly?            │
│    ✓ YES (always)                                    │
└──────────────────┬───────────────────────────────────┘
                   ▼
┌──────────────────────────────────────────────────────┐
│ 4. Run Anomaly Detection Agent                       │
│    • Analyze composition                             │
│    • Calculate anomaly score                         │
│    • Determine severity                              │
│    • Generate explanation                            │
└──────────────────┬───────────────────────────────────┘
                   ▼
┌──────────────────────────────────────────────────────┐
│ 5. Decision Policy: Should Recommend Alloy?          │
│    • If severity == HIGH → YES                       │
│    • Otherwise → NO                                  │
└──────────────────┬───────────────────────────────────┘
                   ▼
        ┌──────────┴──────────┐
        ▼                     ▼
┌──────────────┐      ┌──────────────┐
│ 6a. Run      │      │ 6b. Skip     │
│ Alloy Agent  │      │ Alloy Agent  │
└──────┬───────┘      └──────┬───────┘
       └──────────┬───────────┘
                  ▼
┌──────────────────────────────────────────────────────┐
│ 7. Aggregate Results                                 │
│    • Combine agent outputs                           │
│    • Add safety note                                 │
│    • Add timestamp                                   │
└──────────────────┬───────────────────────────────────┘
                   ▼
┌──────────────────────────────────────────────────────┐
│ 8. Return Response                                   │
│    {anomaly_agent, alloy_agent, final_note}          │
└──────────────────────────────────────────────────────┘
```

### Execution Example

**Input:**
```json
{
  "composition": {"Fe": 81.2, "C": 4.4, "Si": 3.1, "Mn": 0.4, "P": 0.04, "S": 0.02},
  "grade": "SG-IRON"
}
```

**Console Output:**
```
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

**Output:**
```json
{
  "anomaly_agent": {
    "agent": "AnomalyDetectionAgent",
    "anomaly_score": 0.873,
    "severity": "HIGH",
    "confidence": 0.931,
    "explanation": "High anomaly detected..."
  },
  "alloy_agent": {
    "agent": "AlloyCorrectionAgent",
    "recommended_additions": {"Si": 0.22, "Mn": 0.15},
    "confidence": 0.912,
    "explanation": "Adjusting elements toward grade midpoint..."
  },
  "final_note": "Human approval required before action",
  "timestamp": "2025-12-22T10:30:00.000Z"
}
```

---

## Decision Policy

### Policy Configuration

The decision policy is **centralized** in `decision_policy.py` for:
- Easy modification
- Audit trail
- Regulatory compliance
- A/B testing different strategies

### Customizing Policies

To change when agents are invoked, edit `decision_policy.py`:

```python
@staticmethod
def should_recommend_alloy(anomaly_result, grade):
    """
    Current Policy: Invoke on HIGH severity
    
    Alternative Policies:
    - Invoke on MEDIUM or HIGH
    - Invoke based on specific elements
    - Invoke based on grade
    """
    severity = anomaly_result.get("severity", "LOW")
    
    # Current implementation
    if severity == "HIGH":
        return True
    
    # Alternative: Also invoke on MEDIUM
    # if severity in ["MEDIUM", "HIGH"]:
    #     return True
    
    return False
```

---

## Safety & Governance

### Safety Layers

1. **Agent Level**: No autonomous actions
2. **Manager Level**: Policy enforcement
3. **API Level**: Human approval required
4. **Integration Level**: Operator confirmation

### Audit Trail

Every decision is logged:
```python
self.policy.log_decision(
    decision="ANOMALY_CHECK",
    reason=f"Severity: {result['severity']}, Score: {result['anomaly_score']:.3f}"
)
```

### Validation

All agent responses are validated:
```python
def validate_agent_response(agent_name, response):
    # Check required fields
    # Verify agent name
    # Validate confidence range
    # Ensure explanation present
```

### Error Handling

Agents never crash - they return error states:
```python
{
    "agent": "AnomalyDetectionAgent",
    "anomaly_score": 0.0,
    "severity": "ERROR",
    "confidence": 0.0,
    "explanation": "Agent error: ..."
}
```

---

## API Contract

### Request Schema

```python
class AgentAnalysisRequest(BaseModel):
    composition: AgentComposition
    grade: str
```

### Response Schema

```python
class AgentAnalysisResponse(BaseModel):
    anomaly_agent: Optional[AnomalyAgentOutput]
    alloy_agent: Optional[AlloyAgentOutput]
    final_note: str
    timestamp: Optional[str]
```

### Error Responses

```json
{
  "error": "Agent Manager not ready",
  "status_code": 503
}
```

---

## Testing Agents

### Test Individual Agents

```bash
# Test Anomaly Agent
python app/agents/anomaly_agent_wrapper.py

# Test Alloy Agent
python app/agents/alloy_agent_wrapper.py

# Test Agent Manager
python app/agents/agent_manager.py

# Test Decision Policy
python app/policies/decision_policy.py
```

### Test API Endpoint

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

### Unit Test Examples

```python
def test_anomaly_agent():
    agent = get_anomaly_agent()
    assert agent.is_ready()
    
    result = agent.analyze(test_composition)
    assert "anomaly_score" in result
    assert 0 <= result["anomaly_score"] <= 1
    assert result["severity"] in ["LOW", "MEDIUM", "HIGH"]

def test_agent_manager():
    manager = get_agent_manager()
    assert manager.is_ready()
    
    result = manager.analyze(test_composition, "SG-IRON")
    assert "anomaly_agent" in result
    assert result["final_note"] == "Human approval required before action"
```

---

## Summary

MetalliSense implements a **production-grade agent architecture** with:

✅ Clear separation of concerns  
✅ Policy-based orchestration  
✅ Multiple safety layers  
✅ Deterministic behavior  
✅ Full explainability  
✅ No autonomous actions  
✅ Human-in-the-loop design  

This architecture ensures that AI recommendations are **safe, reliable, and always subject to human oversight**.
