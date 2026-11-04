"""Guarded live-word plumbing; the repository contract documents final utterances only.

No provider connection/audio is opened until a provisional-word contract is known.
See gnani_stream.py: documented URL/auth/PCM/final events are already implemented
there, but processing acknowledgements contain no text and are not partial words.
"""
import asyncio
import os
from fastapi import APIRouter,WebSocket
from .provider_calls import provider_busy
router=APIRouter()
LOCALES=frozenset({'ta-IN','hi-IN','en-IN'})

@router.websocket('/ws/live-words')
async def live_words(client:WebSocket):
    if client.headers.get('origin') not in {'http://localhost:5173','http://127.0.0.1:5173'}:
        await client.close(code=1008);return
    await client.accept()
    code='disabled'
    if os.getenv('LIVE_WORDS_ENABLED','false').lower()=='true':
        try:
            raw=await asyncio.wait_for(client.receive_text(),2)
            import json
            start=json.loads(raw) if len(raw)<=4096 else {}
            if not isinstance(start,dict) or start.get('type')!='start' or start.get('locale') not in LOCALES or start.get('sample_rate')!=16000:code='invalid_start'
            else:code='lease_busy' if provider_busy() else 'partial_words_not_documented'
        except Exception:code='invalid_start'
    # Fixed status only: no key, transcript, headers or captured PCM is echoed.
    await client.send_json({'type':'unavailable','code':code})
    await client.close(code=1000)
