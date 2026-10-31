"""Timbre SSE -> safe browser PCM events; complete streams share the REST WAV cache."""
import asyncio
import base64
import io
import json
import os
import tempfile
import wave

import httpx
from .gnani_client import to_gnani_language, tts_text, valid_tts_pair

FIRST_AUDIO_TIMEOUT = 8
MAX_PCM_BYTES = 24_000_000


def event(kind, data):
    return f'event: {kind}\ndata: {json.dumps(data, separators=(",", ":"))}\n\n'


async def pcm_events(response):
    name, lines = '', []
    completed = False
    async for line in response.aiter_lines():
        if line.startswith('event:'): name = line[6:].strip()
        elif line.startswith('data:'): lines.append(line[5:].strip())
        elif not line and lines:
            data = json.loads('\n'.join(lines)); lines = []
            kind = name or data.get('type'); name = ''
            if kind == 'error' or data.get('type') == 'error': raise ValueError('upstream_error')
            if kind == 'chunk':
                audio = base64.b64decode(data.get('audio', ''), validate=True)
                if audio: yield audio
            elif kind == 'complete':
                completed = True
                break
    if not completed: raise ValueError('incomplete_stream')


def cache_wav(path, pcm, rate):
    output = io.BytesIO()
    with wave.open(output, 'wb') as target:
        target.setnchannels(1); target.setsampwidth(2); target.setframerate(rate); target.writeframes(pcm)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as handle:
            temporary = handle.name; handle.write(output.getvalue())
        os.replace(temporary, path)
    finally:
        if temporary and os.path.exists(temporary): os.unlink(temporary)


async def speak_events(service, text, lang, style='normal', voice=None):
    client = service.gnani
    rate = client.tts_sample_rate if client else 22050
    locale = to_gnani_language(lang, client.tts_language if client else 'ta-IN')
    sent = False
    response = None
    def audio_event(audio, path, encoding='pcm_s16le', sample_rate=None):
        return event('audio', {'audio':base64.b64encode(audio).decode(), 'encoding':encoding,
                               'sample_rate':sample_rate or rate, 'path':path})
    try:
        if not client or client.mock or service.tts_provider != 'gnani': raise ValueError('use_rest')
        from .voice_clone import load_embedding, clone_payload, CLONE_MODEL
        selected = load_embedding(locale) if voice == 'supervisor' else None
        model, selected_voice = (CLONE_MODEL,'supervisor:'+selected[1]) if selected else (client.tts_model,client.tts_voice)
        if not selected and not valid_tts_pair(model,selected_voice): raise ValueError('use_rest')
        payload = clone_payload(text,selected[0],rate,streaming=True) if selected else None
        if selected: rate = payload['audio_config']['sample_rate']
        final = payload['text'] if selected else tts_text(text, model, style, client.tts_tags)
        path = client._cache_path(final, locale, selected_voice, style, model=model)
        if path.exists():
            try:
                with wave.open(str(path),'rb') as source:
                    if source.getnchannels() != 1 or source.getsampwidth() != 2: raise ValueError('invalid_cache')
                    cached_rate = source.getframerate(); pcm = source.readframes(source.getnframes())
                if not pcm: raise ValueError('invalid_cache')
                client.stats['tts_cache_hits'] += 1
                client.last_tts_source = 'cache'; client.last_provider_used = f'gnani:{model}:supervisor' if selected else f'gnani:{model}:{selected_voice}'
                client.last_error = client.last_tts_fallback_reason = service.last_error = None
                service.last_provider_used = client.last_provider_used; service.last_media_type = 'audio/wav'
                for offset in range(0,len(pcm),8192): yield audio_event(pcm[offset:offset+8192],'cache',sample_rate=cached_rate)
                yield event('complete',{'path':'cache'}); return
            except (wave.Error, EOFError, ValueError): pass
        payload = payload or {'text':final, 'model':model, 'voice':selected_voice, 'language':locale,
                   'audio_config':{'sample_rate':rate,'num_channels':1,'sample_width':2,'encoding':'linear_pcm','container':'raw'}}
        if not selected and client.tts_speed is not None: payload['speed'] = client.tts_speed
        parts, size, carry = [], 0, b''
        async with asyncio.timeout(120):
            async with httpx.AsyncClient(timeout=8,follow_redirects=False) as http:
                try:
                    async with asyncio.timeout(FIRST_AUDIO_TIMEOUT):
                        request = http.build_request('POST',client.base_url+'/api/v1/tts/sse',headers=client._headers(json_body=True),json=payload)
                        client.stats['tts_calls'] += 1
                        response = await http.send(request,stream=True)
                        if response.status_code != 200: raise ValueError('upstream_error')
                        stream = pcm_events(response)
                        first = await anext(stream)
                    async def chunks():
                        yield first
                        async for chunk in stream: yield chunk
                    async for chunk in chunks():
                        size += len(chunk)
                        if size > MAX_PCM_BYTES: raise ValueError('audio_limit')
                        carry += chunk
                        usable = len(carry) - len(carry) % 2
                        if usable:
                            pcm, carry = carry[:usable], carry[usable:]
                            parts.append(pcm); sent = True
                            yield audio_event(pcm,'stream')
                    if carry: raise ValueError('incomplete_pcm')
                finally:
                    if response is not None: await response.aclose()
        try: cache_wav(path,b''.join(parts),rate)
        except OSError: pass  # Successful playback does not depend on cache writes.
        client.last_tts_source = 'live'; client.last_provider_used = f'gnani:{model}:supervisor' if selected else f'gnani:{model}:{selected_voice}'
        client.last_error = client.last_tts_fallback_reason = service.last_error = None
        service.last_provider_used = client.last_provider_used; service.last_media_type = 'audio/wav'
        yield event('complete',{'path':'stream'})
        return
    except asyncio.CancelledError:
        raise
    except Exception:
        # Never forward upstream start/error events: they contain text or bodies.
        if sent: yield event('reset',{'reason':'stream_fallback'})
    try:
        audio = await asyncio.to_thread(service.text_to_speech,text,lang,False,style)
        if not audio: raise ValueError('tts_unavailable')
        source = client.last_tts_source if client and (service.last_provider_used or '').startswith('gnani:') else None
        provider = service.last_provider_used or ''
        path = 'cache' if source == 'cache' else 'rest' if client and provider == f'gnani:{client.tts_model}:{client.tts_voice}' else 'fallback'
        yield audio_event(audio,path,'wav' if service.last_media_type == 'audio/wav' else 'mp3')
        yield event('complete',{'path':path})
    except Exception:
        yield event('error',{'code':'tts_unavailable'})
