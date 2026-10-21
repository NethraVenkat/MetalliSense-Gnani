"""
Append-only feedback log for the closed-loop RL engine.

Every operator decision (accepted / modified / rejected) and every
measured post-correction outcome is appended here as one JSON line.
This gives you:
  - a full audit trail of human-in-the-loop decisions (required for
    traceability in a regulated manufacturing setting),
  - a dataset you can replay through `training/train_rl.py` to rebuild
    the Q-function from scratch at any time, independent of the live
    incremental updates.
"""
from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Dict, Iterator

from config import DATA_DIR

FEEDBACK_LOG_PATH = DATA_DIR / "rl_feedback_log.jsonl"


def append_feedback(record: Dict) -> None:
    record = dict(record)
    record.setdefault("timestamp", time.time())
    FEEDBACK_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(FEEDBACK_LOG_PATH, "a") as f:
        f.write(json.dumps(record) + "\n")


def iter_feedback() -> Iterator[Dict]:
    if not FEEDBACK_LOG_PATH.exists():
        return
    with open(FEEDBACK_LOG_PATH) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                continue


def count_feedback() -> int:
    return sum(1 for _ in iter_feedback())
