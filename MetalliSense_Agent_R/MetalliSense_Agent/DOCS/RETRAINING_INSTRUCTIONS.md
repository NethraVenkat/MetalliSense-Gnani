# Model Retraining Guide

## Quick Start (One Command)

For a new laptop or to retrain models, simply run:

```bash
python retrain_models.py
```

This single command will:
- ✓ Verify dataset exists and is valid
- ✓ Train anomaly detection model with all optimizations
- ✓ Train alloy correction model
- ✓ Run comprehensive verification tests
- ✓ Ensure deterministic predictions
- ✓ Validate all improvements are working

## What Gets Fixed Automatically

The retraining script incorporates ALL the improvements we've developed:

### 1. **Deterministic Predictions** ✓
- **Issue**: Same input gave different outputs each time
- **Fix**: Score statistics (min/max) now stored during training
- **Result**: Identical input → Identical output (always)

### 2. **Single-Element Detection** ✓
- **Issue**: Required both Fe AND C to be out of range
- **Fix**: Trained on tightly filtered normal samples (within 1.5σ)
- **Result**: Detects when ANY element deviates

### 3. **Sensitive Anomaly Detection** ✓
- **Issue**: Fe=85% or C=6% not detected as anomalies
- **Fix**: 
  - Contamination reduced to 0.05 (5% anomalies)
  - Training on filtered normal samples only
- **Result**: Much more sensitive to deviations

### 4. **Alloy Agent Invocation** ✓
- **Issue**: Alloy agent only invoked for HIGH severity
- **Fix**: Decision policy updated to invoke for MEDIUM & HIGH
- **Result**: Recommendations provided for all significant anomalies

### 5. **Proper Training Data** ✓
- **Issue**: Training on mixed normal+deviated samples
- **Fix**: Train ONLY on normal samples, then filter to 1.5σ
- **Result**: Model learns true "normal" distribution

## Requirements

Before running, ensure:

1. **Dataset exists**: `app/data/dataset.csv`
2. **Python environment**: Virtual environment activated
3. **Dependencies installed**: All packages in `requirements.txt`

## What the Script Does

### Step 1: Dataset Verification
```
✓ Checks dataset.csv exists
✓ Validates all required columns present
✓ Shows dataset statistics
✓ Displays element ranges
```

### Step 2: Anomaly Model Training
```
✓ Filters to normal samples only (is_deviated=False)
✓ Further filters to 1.5σ from mean (tight normal distribution)
✓ Trains Isolation Forest with contamination=0.05
✓ Stores score statistics for deterministic predictions
✓ Saves model to app/models/anomaly_model.pkl
```

### Step 3: Alloy Model Training
```
✓ Trains Gradient Boosting multi-output regressor
✓ Learns element recommendations for each grade
✓ Saves model to app/models/alloy_model.pkl
```

### Step 4: Verification & Testing
```
✓ Verifies all model files exist
✓ Tests inference with normal composition
✓ Tests inference with deviated composition
✓ Runs determinism check (3 identical inputs)
✓ Tests alloy recommendations
✓ Confirms all improvements are active
```

## Expected Output

### Successful Training
```
============================================================
 METALLISENSE AI - MODEL RETRAINING
============================================================

🕐 Started: 2025-12-25 10:30:00
📂 Working Directory: K:\Metallisense-Agent

--------------------------------------------------------------------
📌 STEP 1: Dataset Verification
--------------------------------------------------------------------
✓ Dataset loaded: 200,000 samples
✓ All required columns present
✓ Normal samples: 130,000 (65.0%)
✓ Deviated samples: 70,000 (35.0%)

--------------------------------------------------------------------
📌 STEP 2: Anomaly Detection Model Training
--------------------------------------------------------------------
⚠️  TRAINING ON TIGHTLY FILTERED NORMAL SAMPLES
Original dataset: 200,000 samples
Normal samples: 130,000 samples (65.0%)
Tightly filtered (within 1.5σ): 75,662 samples (58.2%)

Training Results:
  Anomalies detected: 3,784 (5.00%)
  Score range: [-0.6901, -0.3784]

✅ SUCCESS: Model saved
✓ Score statistics stored: [-0.6901, -0.3784]
✓ Predictions will be DETERMINISTIC

--------------------------------------------------------------------
📌 STEP 3: Alloy Correction Model Training
--------------------------------------------------------------------
✅ SUCCESS: Model saved

--------------------------------------------------------------------
📌 STEP 4: Model Verification & Testing
--------------------------------------------------------------------
📁 File Verification:
   ✓ Dataset
   ✓ Anomaly Model
   ✓ Alloy Model

🧪 Testing Model Inference:
   Test 1: Normal Composition
      Severity: LOW
   Test 2: Deviated Composition
      Severity: HIGH
      ✓ Correctly detected deviation
   Test 3: Determinism (3x)
      Run 1: 0.12345678
      Run 2: 0.12345678
      Run 3: 0.12345678
      ✓ DETERMINISTIC: All predictions identical
   Test 4: Alloy Recommendations
      ✓ Alloy agent working correctly

============================================================
 RETRAINING COMPLETE!
============================================================

✅ Status: SUCCESS

🎯 Key Improvements Applied:
   ✓ Deterministic predictions (no randomness)
   ✓ Trained on tightly filtered normal samples
   ✓ Sensitive single-element deviation detection
   ✓ Alloy agent invokes for MEDIUM & HIGH severity
   ✓ Contamination: 0.05 for high sensitivity

🚀 Next Steps:
   1. Start API server:
      python app/main.py
   2. Test the system:
      python test_determinism.py
   3. Access API docs:
      http://localhost:8001/docs
```

## Alternative: Using setup.py

You can also run:
```bash
python setup.py
```

This does the same thing but with slightly different output formatting.

## Troubleshooting

### Error: Dataset not found
```
❌ Dataset not found: app/data/dataset.csv
```
**Solution**: Ensure `dataset.csv` exists in `app/data/` directory

### Error: Missing columns
```
❌ Missing required columns: ['is_deviated']
```
**Solution**: Dataset must have: Fe, C, Si, Mn, P, S, grade, is_deviated

### Error: Training failed
**Solution**: 
1. Check Python version (3.11+ recommended)
2. Verify all dependencies installed: `pip install -r requirements.txt`
3. Ensure sufficient disk space for models

### Error: Non-deterministic predictions
If verification shows varying predictions:
1. Delete `app/models/anomaly_model.pkl`
2. Re-run `python retrain_models.py`
3. Verify `score_min` and `score_max` are stored

## File Structure After Training

```
Metallisense-Agent/
├── app/
│   ├── data/
│   │   └── dataset.csv          # Input data (200k samples)
│   └── models/
│       ├── anomaly_model.pkl    # Trained anomaly detection model
│       └── alloy_model.pkl      # Trained alloy correction model
├── retrain_models.py            # Main retraining script
└── setup.py                     # Alternative setup script
```

## Training Configuration

Current optimized settings (in `app/config.py`):

```python
ANOMALY_CONTAMINATION = 0.05  # 5% expected anomalies (high sensitivity)
```

Current filtering (in `app/training/train_anomaly.py`):
```python
# Train only on normal samples
df_normal = df[df['is_deviated'] == False]

# Further filter to 1.5 standard deviations
# Result: ~75k samples from 130k normal samples
```

## Performance Metrics

After retraining with optimizations:

| Metric | Before | After |
|--------|--------|-------|
| Determinism | ✗ Random | ✓ 100% deterministic |
| Single-element detection | ✗ Failed | ✓ Working |
| Fe=85% detection | NORMAL | MEDIUM/HIGH |
| C=6% detection | LOW | MEDIUM/HIGH |
| Alloy invocation | HIGH only | MEDIUM + HIGH |

## For Production Deployment

1. **Copy these files to new laptop**:
   - All Python code
   - `app/data/dataset.csv`
   - `requirements.txt`

2. **Setup environment**:
   ```bash
   python -m venv venv
   venv\Scripts\activate  # Windows
   pip install -r requirements.txt
   ```

3. **Train models**:
   ```bash
   python retrain_models.py
   ```

4. **Start API**:
   ```bash
   python app/main.py
   ```

5. **Test**:
   ```bash
   python test_determinism.py
   ```

## Success Criteria

Training is successful when:
- ✓ Both models saved without errors
- ✓ All verification tests pass
- ✓ Determinism check shows identical scores
- ✓ Deviated compositions detected as MEDIUM/HIGH
- ✓ Normal compositions show LOW/NORMAL severity

## Support

If issues persist:
1. Check Python version: `python --version` (should be 3.11+)
2. Verify dependencies: `pip list`
3. Check disk space: Models need ~50MB
4. Review error messages in training output
5. Ensure dataset has 200k samples with proper columns

## Summary

The retraining process is now:
1. **Simple**: One command (`python retrain_models.py`)
2. **Comprehensive**: All optimizations included automatically
3. **Validated**: Self-testing ensures correctness
4. **Deterministic**: Same input always gives same output
5. **Production-ready**: Tested and verified before completion
