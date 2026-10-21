from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class RLOptimizeRequest(BaseModel):
    grade: str
    composition: Dict[str, float]
    top_k: int = Field(default=3, ge=1, le=3)


class RLCandidate(BaseModel):
    strategy: str
    aggressiveness: float
    recommended_additions: Dict[str, float]
    predicted_reward: float
    estimated_cost: float
    constraint_violations: Dict[str, str]
    requires_human_approval: bool = True


class RLOptimizeResponse(BaseModel):
    grade: str
    deviation: Dict[str, float]
    base_recommendation_confidence: float
    candidates: List[RLCandidate]
    policy_status: Dict
    note: str


class RLFeedbackRequest(BaseModel):
    grade: str
    composition: Dict[str, float]
    additions: Dict[str, float]
    aggressiveness: float = 1.0
    outcome: str = Field(description="one of: accepted | modified | rejected")
    actual_result: Optional[Dict[str, float]] = None
    operator_note: Optional[str] = None


class RLFeedbackResponse(BaseModel):
    accepted: bool
    computed_reward: float
    policy_status: Dict


class RLStatusResponse(BaseModel):
    fitted: bool
    n_updates: int
    known_grades: List[str]
    avg_reward_last_100: Optional[float] = None
    reward_trend: List[float]
