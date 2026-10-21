"""
Train the Pre-Melt charge risk model (one classifier per grade).

    python app/training/train_premelt_risk.py

The service also trains it automatically on first use if the .pkl is missing.
"""
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent.parent))

from premelt.risk_model import MODEL_PATH, train_and_save  # noqa: E402

if __name__ == "__main__":
    print("Training pre-melt charge risk model...")
    model = train_and_save()
    for grade, m in model.metrics.items():
        print(f"  {grade:22s} rows={m['rows']:6d}  holdout AUC={m['holdout_auc']:.3f}")
    print(f"Saved to {MODEL_PATH}")
