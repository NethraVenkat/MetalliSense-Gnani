"""Pinned application vocabulary, not user/session history. Command STT only."""
import json
from pathlib import Path

TOPIC = ('Voice commands from a foundry operator using a melt-shop app: heats, '
         'spectrometer readings, gate checks, stock, approvals.')
COMMAND_PURPOSES = frozenset({'command', 'answer', 'form', 'confirmation', 'run_confirmation'})

def command_context():
    terms = json.loads(Path(__file__).with_name('command_keyterms.json').read_text(encoding='utf-8'))['keyterms']
    if not 0 < len(terms) <= 200 or len(TOPIC) > 1600:
        raise ValueError('Invalid application context limits')
    if any(not isinstance(t, str) or not t.strip() or '<|' in t or '|>' in t for t in terms):
        raise ValueError('Invalid application context term')
    return {'keyterms': json.dumps(terms, ensure_ascii=False), 'topic': TOPIC}
