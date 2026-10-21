"""Schemas for the Pre-Melt Gate AI assessment."""
from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class PredictedComposition(BaseModel):
    Fe: float = Field(..., ge=0, le=100, description="Balance element; not used for the risk score")
    C: float = Field(..., ge=0, le=100)
    Si: float = Field(..., ge=0, le=100)
    Mn: float = Field(..., ge=0, le=100)
    P: float = Field(..., ge=0, le=100)
    S: float = Field(..., ge=0, le=100)


class PreMeltAssessRequest(BaseModel):
    grade: str = Field(..., description="Target grade, e.g. SG-IRON")
    composition: PredictedComposition = Field(..., description="Predicted melt-down chemistry of the charge")
    uncertainty: Optional[Dict[str, float]] = Field(
        None, description="1-sigma uncertainty per element (percentage points)"
    )


class RiskDriver(BaseModel):
    element: str
    value: float
    normal_mean: float
    z_score: float
    risk_drop_if_normal: float
    risk_if_only_this: float = 0.0
    impact: float = 0.0


class RiskResult(BaseModel):
    risk: float = Field(..., ge=0, le=1, description="Mean P(off-spec heat) over the uncertainty")
    risk_nominal: float = Field(..., ge=0, le=1)
    risk_band_p10_p90: List[float]
    drivers: List[RiskDriver]


class CorrectionResult(BaseModel):
    recommended_additions: Dict[str, float] = Field(
        ..., description="Percentage points to add, limited to elements a furnace can add (C, Si, Mn)"
    )
    ignored_additions: Dict[str, float] = Field(
        default_factory=dict, description="Model suggestions for elements that are not added in practice"
    )
    corrected_composition: Dict[str, float]
    confidence: float
    message: str
    warning: Optional[str] = None


class PreMeltAssessResponse(BaseModel):
    grade: str
    before_correction: RiskResult
    correction: Optional[CorrectionResult] = None
    after_correction: Optional[RiskResult] = None
    model: Dict
    note: str = "Advisory. The Pre-Melt Gate combines this with lot status, QA and inspection checks."
