"""
Pre-Melt assessment = charge risk model + existing Alloy Correction Agent.

1. Risk of an off-spec heat for the predicted melt-down chemistry.
2. What the Alloy Correction Agent would add to bring it to target.
3. Risk again after those additions.

If the risk stays high after correction, the problem is something an
addition cannot fix (an element already above its maximum, or P/S too
high). An induction furnace does almost no refining, so the only fix is
a different charge mix. That is exactly what the gate should catch.
"""
from typing import Dict, Optional

from .risk_model import FEATURES, get_charge_risk_model

# Elements a melt shop corrects by adding material (recarburiser, FeSi, FeMn).
ADDABLE = ("C", "Si", "Mn")


def _alloy_model_input(alloy_predictor, grade: str, composition: Dict[str, float]) -> Dict[str, float]:
    """
    The Alloy Correction model was trained on dataset.csv, where Fe is not
    the balance element (e.g. SG-IRON Fe ~86%). A real predicted melt has
    Fe as balance (~93%). Passing the real value would push the model out
    of its training range and distort its output, so Fe is set to the
    grade's Fe midpoint. Fe is never recommended as an addition anyway.
    """
    model_input = dict(composition)
    try:
        lo, hi = alloy_predictor.get_grade_spec(grade)["composition_ranges"]["Fe"]
        model_input["Fe"] = (lo + hi) / 2
    except Exception:
        pass
    return model_input


def assess_charge(
    grade: str,
    composition: Dict[str, float],
    uncertainty: Optional[Dict[str, float]],
    alloy_predictor=None,
) -> Dict:
    grade = grade.upper()
    risk_model = get_charge_risk_model()
    before = risk_model.assess(grade, composition, uncertainty)

    correction = None
    after = None
    if alloy_predictor is not None:
        rec = alloy_predictor.predict(grade, _alloy_model_input(alloy_predictor, grade, composition))
        raw = rec.get("recommended_additions", {}) or {}
        additions = {el: round(float(v), 4) for el, v in raw.items() if el in ADDABLE and v > 0}
        ignored = {el: round(float(v), 4) for el, v in raw.items() if el not in ADDABLE}
        corrected = {el: round(composition[el] + additions.get(el, 0.0), 4) for el in ["Fe", *FEATURES]}
        after = risk_model.assess(grade, corrected, uncertainty)
        correction = {
            "recommended_additions": additions,
            "ignored_additions": ignored,
            "corrected_composition": corrected,
            "confidence": round(float(rec.get("confidence", 0.0)), 4),
            "message": rec.get("message", ""),
            "warning": rec.get("warning"),
        }

    return {
        "grade": grade,
        "before_correction": before,
        "correction": correction,
        "after_correction": after,
        "model": {
            "name": "Pre-melt charge risk model",
            "type": "HistGradientBoostingClassifier, one per grade",
            "features": FEATURES,
            "trained_on": "dataset.csv (is_deviated labels)",
            "metrics": risk_model.metrics.get(grade, {}),
            "alloy_agent_used": alloy_predictor is not None,
        },
    }
