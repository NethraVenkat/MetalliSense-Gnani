# MetalliSense AI - Quick Reference

## 🚀 For New Laptop Setup

### Step 1: Install Python & Create Environment
```bash
# Ensure Python 3.11+ is installed
python --version

# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Activate (Linux/Mac)
source venv/bin/activate
```

### Step 2: Install Dependencies
```bash
pip install -r requirements.txt
```

### Step 3: Train Models (ONE COMMAND)
```bash
python retrain_models.py
```

**OR on Windows**:
```bash
retrain.bat
```

That's it! The script handles everything automatically.

---

## 📊 What Gets Trained

### Anomaly Detection Model
- **Type**: Isolation Forest
- **Training**: Filtered normal samples (1.5σ)
- **Features**: Deterministic predictions, high sensitivity
- **Output**: Anomaly score (0-1) and severity (NORMAL/LOW/MEDIUM/HIGH)

### Alloy Correction Model
- **Type**: Gradient Boosting
- **Training**: All samples (normal + deviated)
- **Features**: Multi-element recommendations
- **Output**: Recommended additions per element

---

## ✅ Verification Tests

The script automatically runs:
1. **File Check**: All models exist
2. **Load Test**: Models load without errors
3. **Prediction Test**: Normal vs deviated compositions
4. **Determinism Test**: Same input = same output (3x)
5. **Integration Test**: Alloy recommendations work

---

## 🎯 Success Indicators

You'll see:
```
✅ Status: SUCCESS
✓ Deterministic predictions (no randomness)
✓ Trained on tightly filtered normal samples
✓ Sensitive single-element deviation detection
✓ Alloy agent invokes for MEDIUM & HIGH severity
```

---

## 🔧 Configuration

Current optimized settings:

| Setting | Value | Purpose |
|---------|-------|---------|
| Contamination | 0.05 | 5% expected anomalies (high sensitivity) |
| Filtering | 1.5σ | Tight normal distribution |
| Training Data | Normal only | Learn true "normal" behavior |
| Score Storage | Yes | Deterministic predictions |
| Port | 8001 | API endpoint |

---

## 📝 Common Commands

### Retrain Models
```bash
python retrain_models.py
```

### Start API Server
```bash
python app/main.py
```

### Test Determinism
```bash
python test_determinism.py
```

### Test Single Element Detection
```bash
python test_single_element.py
```

### Access API Docs
```
http://localhost:8001/docs
```

---

## 🔍 Troubleshooting

### Issue: Dataset not found
**Solution**: Ensure `app/data/dataset.csv` exists (200k samples)

### Issue: Dependencies missing
**Solution**: `pip install -r requirements.txt`

### Issue: Non-deterministic predictions
**Solution**: Delete models and retrain: `python retrain_models.py`

### Issue: Low sensitivity
**Solution**: Check contamination in `app/config.py` (should be 0.05)

---

## 📁 File Structure

```
Metallisense-Agent/
├── app/
│   ├── data/
│   │   └── dataset.csv              # 200k training samples
│   ├── models/
│   │   ├── anomaly_model.pkl       # Trained model
│   │   └── alloy_model.pkl         # Trained model
│   ├── agents/                      # Agent wrappers
│   ├── inference/                   # Prediction logic
│   └── training/                    # Training scripts
├── retrain_models.py               # ⭐ MAIN RETRAINING SCRIPT
├── retrain.bat                      # Windows batch file
├── setup.py                         # Alternative setup
└── requirements.txt                 # Dependencies
```

---

## 🎓 Understanding the Training

### Why Filtered Normal Samples?
Original dataset has Fe: [79.52, 99.72] - too wide!
After filtering (1.5σ): Fe: [85.48, 99.57] - tighter definition of "normal"
Result: Any deviation from this range is detected

### Why Contamination = 0.05?
Expects only 5% anomalies in training data
Makes model very sensitive to outliers
Previously 0.15 (15%) was too lenient

### Why Store Score Statistics?
Without: Uses random samples → different results each time
With: Uses stored min/max → same result every time

---

## 📈 Performance Expectations

After retraining:
- **Determinism**: 100% (identical input → identical output)
- **Single element detection**: Working
- **Fe=85% detection**: MEDIUM/HIGH (was NORMAL)
- **C=6% detection**: MEDIUM/HIGH (was LOW)
- **Training time**: ~100 seconds on modern CPU
- **Model size**: ~1MB (anomaly) + ~50MB (alloy)

---

## 🚨 Critical Points

1. **Always retrain on new laptop** - Don't copy model files
2. **Dataset required** - Must have 200k samples with proper columns
3. **Verify determinism** - Run test after training
4. **Check all tests pass** - Script does this automatically
5. **Use virtual environment** - Avoid dependency conflicts

---

## 💡 Tips

- Training takes ~2 minutes on modern hardware
- If interrupted, just run again (no partial state saved)
- Models automatically saved to `app/models/`
- Old models automatically overwritten
- No manual configuration needed - all optimizations applied
- Script is idempotent - safe to run multiple times

---

## 📞 Support Checklist

Before asking for help, verify:
- [ ] Python 3.11+ installed
- [ ] Virtual environment activated
- [ ] Dependencies installed (`pip list`)
- [ ] Dataset exists (200k samples)
- [ ] Dataset has columns: Fe, C, Si, Mn, P, S, grade, is_deviated
- [ ] Sufficient disk space (~100MB)
- [ ] Read error messages in script output

---

## 🎉 You're Ready!

With one command, you get:
✓ Properly trained models
✓ All optimizations applied
✓ Verified and tested
✓ Production-ready system

Just run: `python retrain_models.py`
