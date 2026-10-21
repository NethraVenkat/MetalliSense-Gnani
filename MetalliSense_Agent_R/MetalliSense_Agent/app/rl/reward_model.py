"""
Q-function approximator for the closed-loop RL alloy optimization engine.

Uses scikit-learn's SGDRegressor because it supports `partial_fit`, which
lets us update the model incrementally, one feedback event at a time,
without ever needing to refit on the full history. That incremental
update is what makes the loop "closed": every operator decision and every
measured outcome nudges future recommendations, in production, with no
retraining pipeline required.

State-action features (all local, no external data source needed):
  - per-element deviation from the grade's target midpoint (6 floats)
  - grade, one-hot encoded
  - action = the candidate correction, expressed as per-element addition
    amounts, plus a scalar "aggressiveness" (0.5 / 1.0 / 1.5x of the
    supervised model's base recommendation)
  - a cost term (sum of absolute additions) so the policy learns to
    prefer minimal, cheaper interventions when they work equally well
"""
from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Dict, List, Optional

import joblib
import numpy as np
from sklearn.linear_model import SGDRegressor

from config import ELEMENTS, MODELS_DIR

RL_MODEL_PATH = MODELS_DIR / "rl_reward_model.pkl"
RL_STATE_PATH = MODELS_DIR / "rl_reward_model_state.json"


def _grade_onehot(grade: str, known_grades: List[str]) -> List[float]:
    return [1.0 if grade == g else 0.0 for g in known_grades]


class RewardModel:
    """Incrementally-trained Q(state, action) -> expected reward estimator."""

    def __init__(self, known_grades: Optional[List[str]] = None):
        self.known_grades = known_grades or []
        self.model = SGDRegressor(
            loss="squared_error",
            penalty="l2",
            alpha=1e-4,
            learning_rate="invscaling",
            eta0=0.01,
            random_state=42,
        )
        self.n_updates = 0
        self.reward_history: List[float] = []
        self._fitted = False

    # ---- feature engineering ---------------------------------------
    def _features(
        self,
        deviation: Dict[str, float],
        grade: str,
        additions: Dict[str, float],
        aggressiveness: float,
    ) -> np.ndarray:
        dev_vec = [float(deviation.get(el, 0.0)) for el in ELEMENTS]
        add_vec = [float(additions.get(el, 0.0)) for el in ELEMENTS]
        grade_vec = _grade_onehot(grade, self.known_grades)
        cost = sum(abs(v) for v in add_vec)
        feats = dev_vec + add_vec + grade_vec + [aggressiveness, cost]
        return np.array(feats, dtype=float).reshape(1, -1)

    # ---- inference ----------------------------------------------------
    def predict(
        self,
        deviation: Dict[str, float],
        grade: str,
        additions: Dict[str, float],
        aggressiveness: float,
    ) -> float:
        if not self._fitted:
            # Cold start: fall back to a simple heuristic (prefer smaller,
            # more moderate corrections) until the model has seen data.
            cost = sum(abs(v) for v in additions.values())
            return max(0.0, 1.0 - 0.15 * cost - 0.05 * abs(aggressiveness - 1.0))
        x = self._features(deviation, grade, additions, aggressiveness)
        return float(self.model.predict(x)[0])

    # ---- online learning -----------------------------------------------
    def update(
        self,
        deviation: Dict[str, float],
        grade: str,
        additions: Dict[str, float],
        aggressiveness: float,
        reward: float,
    ) -> None:
        if grade not in self.known_grades:
            self.known_grades.append(grade)
        x = self._features(deviation, grade, additions, aggressiveness)
        y = np.array([reward], dtype=float)
        if not self._fitted:
            self.model.partial_fit(x, y)
            self._fitted = True
        else:
            self.model.partial_fit(x, y)
        self.n_updates += 1
        self.reward_history.append(float(reward))
        if len(self.reward_history) > 2000:
            self.reward_history = self.reward_history[-2000:]

    # ---- persistence -----------------------------------------------
    def save(self, path: Path = RL_MODEL_PATH, state_path: Path = RL_STATE_PATH):
        joblib.dump(self.model, path)
        state = {
            "known_grades": self.known_grades,
            "n_updates": self.n_updates,
            "fitted": self._fitted,
            "reward_history": self.reward_history[-500:],
        }
        with open(state_path, "w") as f:
            json.dump(state, f)

    @classmethod
    def load(cls, path: Path = RL_MODEL_PATH, state_path: Path = RL_STATE_PATH) -> "RewardModel":
        inst = cls()
        if path.exists() and state_path.exists():
            inst.model = joblib.load(path)
            with open(state_path) as f:
                state = json.load(f)
            inst.known_grades = state.get("known_grades", [])
            inst.n_updates = state.get("n_updates", 0)
            inst._fitted = state.get("fitted", False)
            inst.reward_history = state.get("reward_history", [])
        return inst

    def status(self) -> Dict:
        recent = self.reward_history[-100:]
        avg_recent = sum(recent) / len(recent) if recent else None
        return {
            "fitted": self._fitted,
            "n_updates": self.n_updates,
            "known_grades": self.known_grades,
            "avg_reward_last_100": avg_recent,
            "reward_trend": self.reward_history[-50:],
        }
