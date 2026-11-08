"""Isolated localhost Agent for the Round 2 browser checks. Never uses live stores.

Only symbolic reply labels cross the test-control endpoint. Credentials exist in
process memory only; request/access logging and environment-file loading are off.
"""
import os
import sys
import json
import secrets
import tempfile
from pathlib import Path
from collections import deque
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.stderr.reconfigure(encoding='utf-8', errors='replace')

if os.environ.get('ROUND2_REAL_APP_TEST') != 'true':
    raise SystemExit('Explicit isolated test mode required')

temporary = tempfile.TemporaryDirectory(prefix='round2-agent-')
os.environ.update(DATA_DIR=temporary.name, GNANI_MOCK='true', GNANI_API_KEY='',
    VOICE_USERS='[]', VOICE_ACTIONS_ENABLED='true', VOICE_AUDIT_ENABLED='true',
    VOICE_AUDIO_LOG_ENABLED='false', APP_ENV='test', STT_PROVIDER='gnani',
    TTS_PROVIDER='gnani', GROQ_API_KEY='', ELEVENLABS_API_KEY='',
    PYTHON_DOTENV_DISABLED='1')
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'app'))
from copilot.voice_auth import entry
roles = ['Supervisor', 'Manager', 'Unit Controller', 'Operator']
credentials = {role: ''.join(secrets.choice('0123456789') for _ in range(6)) for role in roles}
wrong = ''.join(secrets.choice('0123456789') for _ in range(6))
while wrong in credentials.values():
    wrong = ''.join(secrets.choice('0123456789') for _ in range(6))
os.environ['VOICE_USERS'] = json.dumps([entry('test-'+str(i), 'TEST '+role, role, credentials[role]) for i, role in enumerate(roles)])

from copilot.voice_audit import AUDIT
# Keep the real hash-chain implementation, but route test artifacts outside all
# protected/live directories, including directories named voice_audit.
AUDIT.path = lambda date: Path(temporary.name) / ('audit-' + date + '.jsonl')
from copilot.gnani_client import get_gnani_client
client = get_gnani_client()
pending = deque()
def scripted_transcribe(audio_bytes, language=None, **kwargs):
    label = pending.popleft() if pending else '@empty'
    text = credentials.get(label.removeprefix('@right:'), '') if label.startswith('@right:') else wrong if label == '@wrong' else 'pass' if label == '@word' else '' if label == '@empty' else label
    return dict(text=text, language=language or 'en-IN', success=True)
client.transcribe = scripted_transcribe
import main
from copilot.voice_service import VoiceService
main.voice_service = VoiceService()
from copilot.groq_explainer import ExplainableAICopilot
class TestHistory:
    """Use the production history-clearing method without an external LLM client."""
    clear_history = ExplainableAICopilot.clear_history
    def __init__(self):
        self.conversation_history = []
main.copilot = TestHistory()
from fastapi import Request, HTTPException
@main.app.post('/__test_voice/queue')
async def queue(request: Request):
    if request.client.host not in ('127.0.0.1', '::1'):
        raise HTTPException(404)
    body = await request.json()
    labels = body.get('replies', [])
    if not isinstance(labels, list) or any(not isinstance(x, str) or len(x)>100 for x in labels):
        raise HTTPException(422)
    pending.clear(); pending.extend(labels)
    return {'queued': len(pending)}
@main.app.get('/__test_voice/ready')
def ready():
    return {'ready': True, 'mock': client.mock, 'pending': len(pending)}

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(main.app, host='127.0.0.1', port=int(sys.argv[1]),
                lifespan='off', access_log=False, log_level='critical')
