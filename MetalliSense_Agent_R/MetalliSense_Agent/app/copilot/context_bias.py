"""Bounded ID hints; telemetry contains counts/outcomes only."""
import asyncio
import json
import logging
import os
import re

MAX_TERMS=200
MAX_TERM_LENGTH=64  # Local guard: docs specify no per-term character limit.
DEBOUNCE_SECONDS=1.0
ACK_SECONDS=3.0
_last_count=0
logger=logging.getLogger(__name__)

def enabled():return os.getenv('GNANI_CONTEXT_BIAS','off').lower()=='on'

def validate_terms(value):
    if not isinstance(value,list):return []
    result=[];seen=set()
    for term in value[:MAX_TERMS]:
        if not isinstance(term,str) or not 1<=len(term)<=MAX_TERM_LENGTH or not re.fullmatch(r'[A-Za-z0-9 -]+',term):continue
        term=' '.join(term.split())
        if term and term.casefold() not in seen:
            seen.add(term.casefold());result.append(term)
    return result

def parse_context(value):
    if not enabled() or value is None:return None
    try:return validate_terms(json.loads(value)) if isinstance(value,str) and len(value)<=16384 else []
    except (ValueError,TypeError):return []

def merge_terms(static,context):
    global _last_count
    if isinstance(static,str):
        try:static=json.loads(static) if static.lstrip().startswith('[') else static.split(',')
        except ValueError:static=[]
    result=[];seen=set()
    for term in list(static or [])+validate_terms(context):
        if not isinstance(term,str):continue
        term=term.strip()
        if term and term.casefold() not in seen:
            seen.add(term.casefold());result.append(term)
        if len(result)>=MAX_TERMS:break
    _last_count=len(result)
    return result

def bias_score():
    try:score=float(os.getenv('GNANI_CONTEXT_BIAS_SCORE','1.0'))
    except ValueError:return 1.0
    return score if score in (0.0,0.5,1.0,1.5,2.0) else 1.0

def bias_status():return {'context_bias':enabled(),'context_bias_last_term_count':_last_count if enabled() else 0}

class BiasUpdates:
    """Trailing-edge debounce; never forward raw client settings."""
    def __init__(self,upstream,client,static):
        self.upstream,self.client,self.static=upstream,client,static
        self.task=self.ack_task=None
        self.last=None;self.count=0

    def update(self,value):
        if not enabled():return
        terms=validate_terms(value)
        if not isinstance(value,list) or len(terms)!=len(value):logger.info('context_bias update=ignored')
        merged=merge_terms(self.static,terms)
        if merged==self.last:return
        self.last=merged
        if self.task:self.task.cancel()
        self.task=asyncio.create_task(self._send(merged))

    async def _send(self,terms):
        await asyncio.sleep(DEBOUNCE_SECONDS)
        try:
            self.count=len(terms)
            if self.ack_task:self.ack_task.cancel()
            self.ack_task=asyncio.create_task(self._unconfirmed())
            await self.upstream.send(json.dumps({'type':'update_settings','bias':{'list':terms,'score':bias_score()}}))
        except Exception:
            if self.ack_task:self.ack_task.cancel();self.ack_task=None
            logger.info('context_bias update=ignored')

    async def _unconfirmed(self):
        await asyncio.sleep(ACK_SECONDS)
        logger.info('context_bias update=ignored confirmation=missing')
        await self.client.send_json({'type':'context_bias','code':'ignored','term_count':self.count})

    async def acknowledged(self):
        if not enabled():return
        if self.ack_task:self.ack_task.cancel();self.ack_task=None
        logger.info('context_bias update=settings_updated term_count=%d',self.count)
        await self.client.send_json({'type':'settings_updated','term_count':self.count})

    async def close(self):
        tasks=[task for task in (self.task,self.ack_task) if task]
        for task in tasks:task.cancel()
        await asyncio.gather(*tasks,return_exceptions=True)
