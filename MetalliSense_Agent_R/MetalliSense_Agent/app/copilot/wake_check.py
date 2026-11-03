"""Opt-in bounded no-keyterm Prisma check. No command execution."""
import asyncio
from collections import deque
import io
import json
import logging
import re
import os
import threading
import time
import wave
from fastapi import HTTPException
from .provider_calls import post as provider_post
from .wake_rules import payload_fields,wake_parts

logger=logging.getLogger('uvicorn.error')

def failure(kind,status,message,started,*,path='provider',lease='not_rejected'):
    key=os.getenv('GNANI_API_KEY','').strip()
    text=str(message)
    if key:text=text.replace(key,'[REDACTED]')
    text=re.sub(r'(?i)(bearer\s+|x-api-key-id[\s:=]+)\S+',r'\1[REDACTED]',text)
    text=re.sub(r'[A-Za-z0-9+/=]{80,}','[omitted]',text)
    text=' '.join(text.split())[:200]
    logger.warning('wake_check_failure type=%s http_status=%s message=%s elapsed_ms=%.0f path=%s lease=%s spacing=not_rejected rate_limit=%s',
        kind,status,json.dumps(text,ensure_ascii=True),1000*(time.monotonic()-started),path,lease,'rejected' if path=='rate_limit' else 'not_rejected')

def enabled():return os.getenv('WAKE_WORD_ENABLED','false').lower()=='true'

class WakeChecker:
    def __init__(self,clock=time.monotonic,sleep=asyncio.sleep):
        self.lock=threading.Lock();self.clock=clock;self.sleep=sleep;self.starts=deque();self.last=-float('inf')
    async def check(self,audio,send=None):
        if not enabled():raise HTTPException(404,detail={'code':'wake_disabled'})
        try:
            with wave.open(io.BytesIO(audio)) as w:
                if (w.getnchannels(),w.getsampwidth(),w.getframerate(),w.getcomptype(),w.getnframes())!=(1,2,16000,'NONE',24000) or len(w.readframes(24000))!=48000:raise ValueError()
        except Exception:raise HTTPException(422,detail={'code':'wake_audio_format'}) from None
        started=time.monotonic()
        if not self.lock.acquire(False):
            failure('WakeBusy',429,'One wake check already in flight',started,path='in_flight',lease='not_entered')
            raise HTTPException(429,detail={'code':'wake_busy'})
        try:
            now=self.clock()
            while self.starts and now-self.starts[0]>=60:self.starts.popleft()
            if len(self.starts)>=15:
                failure('WakeRateLimit',429,'15 checks per minute limit',started,path='rate_limit',lease='not_entered')
                raise HTTPException(429,detail={'code':'wake_rate_limit'})
            delay=max(0,1.1-(now-self.last))
            if delay:await self.sleep(delay)
            try:
                text=await asyncio.to_thread(send or self.send,audio)
                return wake_parts(text)
            finally:
                # Completion times conservatively bound provider starts even
                # when another provider path held the shared lease first.
                self.last=self.clock();self.starts.append(self.last)
        finally:self.lock.release()
    @staticmethod
    def send(audio):
        import requests
        from .gnani_client import DEFAULT_BASE_URL
        if os.getenv('GNANI_MOCK','').lower()=='true':return ''
        key=os.getenv('GNANI_API_KEY','').strip()
        base=os.getenv('GNANI_BASE_URL',DEFAULT_BASE_URL).rstrip('/')
        started=time.monotonic();response=None;body=None
        if not key or base!='https://api.vachana.ai':
            failure('ConfigurationError',503,'Missing backend key or unverified endpoint',started,path='configuration',lease='not_entered')
            raise HTTPException(503,detail={'code':'wake_unavailable'})
        try:
            response=provider_post(base+'/stt/v3',headers={'X-API-Key-ID':key,'User-Agent':'MetalliSense-Kural-Pause-Audition/1.0'},files={'audio_file':('snippet.wav',audio,'audio/wav')},data=payload_fields('v3'),timeout=5,allow_redirects=False)
            body=response.json()
            if response.status_code!=200 or not isinstance(body,dict) or body.get('success') is not True or not isinstance(body.get('transcript'),str):raise ValueError('ProviderFailure')
            if body.get('model') not in (None,'prisma-v3.0'):raise ValueError('UnexpectedModel')
            return body['transcript'].replace(key,'[REDACTED]')
        except Exception as error:
            detail=body.get('error',body) if isinstance(body,dict) else {}
            if isinstance(detail,dict):detail={k:detail[k] for k in ('code','message','error_code','error_message') if k in detail}
            message=json.dumps(detail,ensure_ascii=True) if detail else str(error)
            content_type=getattr(response,'headers',{}).get('Content-Type','').lower()
            if body is None and response is not None and response.status_code!=200 and content_type.startswith('text/'):
                # Failed gateway responses may be HTML, not JSON. Never inspect
                # successful non-JSON/audio bytes for logging.
                message=re.sub(r'<[^>]*>',' ',getattr(response,'text','')[:4000]) or message
            failure(type(error).__name__,getattr(response,'status_code','none'),message,started)
            raise HTTPException(502,detail={'code':'wake_unavailable'}) from None

checker=WakeChecker()
