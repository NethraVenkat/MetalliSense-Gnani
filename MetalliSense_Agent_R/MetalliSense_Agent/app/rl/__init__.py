"""
Closed-Loop Reinforcement Learning module for alloy process optimization.

This package implements a contextual-bandit style RL engine that:
  - proposes several candidate alloy-correction strategies for a given
    deviated composition (conservative / balanced / aggressive),
  - scores each candidate with a learned Q-function (expected process
    outcome quality minus cost/constraint penalties),
  - NEVER auto-applies a correction — every recommendation requires
    explicit operator approval (human-in-the-loop),
  - updates its Q-function online from operator feedback and, when
    available, the measured outcome of the correction that was actually
    applied on the floor — this is the "closed loop" part.

No external network calls or API keys are required; it trains and
updates purely from local historical/production data.
"""
from .policy import get_rl_engine

__all__ = ["get_rl_engine"]
