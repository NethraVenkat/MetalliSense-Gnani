# MetalliSense: Intelligent Foundry Decision Support System

MetalliSense is an advanced, human-in-the-loop decision-support platform designed for metal foundries. It unites scrap inspection, pre-melt interlock verification, chemical anomaly detection, machine-learning alloy corrections, contextual-bandit strategy recommendations, and sales quality certification into a unified operational workflow.

---

## 1. System Architecture

The platform operates as a coordinated multi-service architecture:

| Service | Technology | Default Port | Responsibility |
|---|---|---|---|
| **Frontend** | React 18, Vite, Tailwind CSS | `5173` | Operator workflows (22 screens), MeltFlowContext, real-time charts |
| **Backend** | Node.js, Express | `3000` | REST API (101 endpoints), Pre-Melt Gate engine, in-memory business stores |
| **Spectrometer Sim** | Node.js (node-opcua) | `4334` | Simulated OPC UA optical emission spectrometer |
| **Handheld Gun Sim** | Node.js (node-opcua) | `4335` | Simulated handheld XRF/LIBS yard inspection gun |
| **AI Service** | Python 3.11, FastAPI | `8000` | IsolationForest anomaly detection, GradientBoosting alloy correction, mechanical models |
| **Agent Service** | Python 3.11, FastAPI | `8001` | Pre-melt HistGradientBoosting deviation risk, contextual-bandit RL policy, Copilot chat & voice |
| **Vector Search** | Python 3.11, FastAPI | `8002` | Standalone semantic heat memory (sentence-transformers / cosine fallback) |

---

## 2. Dual-Mode Operation

MetalliSense supports two operational deployment modes:

### Mode A: Full Multi-Service Microstack
Connects the React frontend to the live Node.js and Python microservices on `localhost:3000`, `8000`, `8001`, and `8002`.

### Mode B: Static Browser Demonstration Mode
The frontend includes an integrated in-browser mock engine (`src/mock/server.js`) that intercepts all Axios and fetch calls. It executes:
- In-browser simulated Pre-Melt Gate interlocks and SHA-1 fingerprinting.
- In-browser serialized scikit-learn decision trees for anomaly detection and alloy recommendations (`src/mock/models/*.json`).
- Linear programming charge mix optimizer using `javascript-lp-solver`.
- Runs completely offline without any Node backend or Python services running.

To launch the static demo:
```bash
cd MetalliSense_Frontend_R/MetalliSense_Frontend
npm install
npm run dev:mock
```

---

## 3. Getting Started & Startup Instructions

### Prerequisites
- **Node.js**: `v20.19.0+` or `v22.12.0+` (Node 22 LTS recommended)
- **Python**: `3.11.x` (Python 3.11 is required for scikit-learn and joblib binary compatibility)
- **Git**

### Installation

1. **Backend**:
   ```bash
   cd MetalliSense_Backend_Simple
   npm install
   cp config.env.example config.env
   npm start
   ```
2. **AI Service**:
   ```bash
   cd MetalliSense_AI_R/MetalliSense_AI
   py -3.11 -m venv venv
   .\venv\Scripts\python.exe -m pip install -r requirements.txt
   .\venv\Scripts\python.exe -X utf8 app\main.py
   ```
3. **Agent Service**:
   ```bash
   cd MetalliSense_Agent_R/MetalliSense_Agent
   py -3.11 -m venv venv
   .\venv\Scripts\python.exe -m pip install -r requirements.txt
   cp .env.example .env  # Add your Groq / ElevenLabs API keys if using Copilot
   .\venv\Scripts\python.exe -X utf8 app\main.py
   ```
4. **VectorSearch Service (Optional)**:
   ```bash
   cd MetalliSense_VectorSearch
   py -3.11 -m venv venv
   .\venv\Scripts\python.exe -m pip install -r requirements.txt
   .\venv\Scripts\python.exe -X utf8 main.py
   ```
5. **Frontend**:
   ```bash
   cd MetalliSense_Frontend_R/MetalliSense_Frontend
   npm install
   npm run dev
   ```

---

## 4. Retrospective Import Dating Disclosure

This repository history has been imported and structured across **19 October 2026 through 22 October 2026 (Asia/Kolkata, UTC+05:30)**. These commit dates reflect structured retrospective publication import milestones organizing the multi-tier codebase into reviewable architectural stages, rather than chronological evidence that development occurred on those specific dates.

---

## 5. Contributor Attribution & License

- **Lead Author & System Architect**: Manish Rahul (<manish.skillnxt@gmail.com>)
- **Bundled Fonts**: JetBrains Mono and Montserrat are licensed under the SIL Open Font License (OFL). See `src/assets/demo-fonts/` for license terms.
