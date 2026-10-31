"""Private, consent-gated supervisor embedding selection. Never expose tensors."""
import hashlib
import json
import os
from pathlib import Path

CLONE_DIR = Path(__file__).resolve().parents[1] / 'data' / 'voice_clone'
CLONE_MODEL = 'vachana-vc-v1'


def consented():
    try:
        return bool((CLONE_DIR / 'CONSENT.txt').read_text(encoding='utf-8').strip())
    except (OSError, UnicodeError):
        return False


def embedding_object(value):
    if not isinstance(value, dict):
        raise ValueError('invalid_embedding')
    if not isinstance(value.get('embedding'), str) or not value['embedding']:
        raise ValueError('invalid_embedding')
    if not isinstance(value.get('shape'), list) or not value['shape'] or not all(type(n) is int and n > 0 for n in value['shape']):
        raise ValueError('invalid_embedding')
    if not isinstance(value.get('dtype'), str) or not value['dtype']:
        raise ValueError('invalid_embedding')
    return {key:value[key] for key in ('embedding','shape','dtype')}


def load_embedding(language, *, mode=None, require_enabled=True):
    if require_enabled and os.getenv('GNANI_VOICE_CLONE','off').lower() != 'on':
        return None
    if not consented():
        return None
    mode = mode or os.getenv('GNANI_CLONE_EMBEDDING_MODE','per_language')
    code = (language or '').split('-')[0].lower()
    names = ([f'embedding_{code}.json'] if mode != 'single' and code in ('ta','hi','en') else []) + ['embedding.json']
    for name in names:
        try:
            value = embedding_object(json.loads((CLONE_DIR / name).read_text(encoding='utf-8')))
            digest = hashlib.sha256(json.dumps(value,sort_keys=True).encode()).hexdigest()[:16]
            return value, digest
        except (OSError, UnicodeError, ValueError, TypeError):
            continue
    return None


def clone_status():
    available = [lang for lang in ('ta','en','hi') if load_embedding(lang,require_enabled=False)]
    return {'enabled':os.getenv('GNANI_VOICE_CLONE','off').lower()=='on',
            'state':'configured' if available else 'not configured','languages':available}


def clone_text(text):
    # Clone schema does not document Timbre audio tags, speed or language fields.
    from .gnani_client import tts_text
    return tts_text(text,CLONE_MODEL,'normal',False)


def clone_payload(text, embedding, rate, *, streaming=False):
    return {'text':clone_text(text),'model':CLONE_MODEL,'speaker_embedding':embedding,
            'audio_config':{'sample_rate':min(rate,44100),'num_channels':1,'sample_width':2,
                            'encoding':'linear_pcm','container':'raw' if streaming else 'wav'}}
