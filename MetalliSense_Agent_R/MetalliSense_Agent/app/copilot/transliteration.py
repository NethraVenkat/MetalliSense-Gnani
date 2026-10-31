"""Standalone optional display request. Never starts or waits for primary STT."""
import asyncio
import os

LATIN_TIMEOUT_S=6.0

def transliteration_enabled():return os.getenv('GNANI_TRANSLITERATE','off').lower()=='on'

async def transliterate_display(service,audio):
    client=getattr(service,'gnani',None)
    if service is None or service.stt_provider!='gnani' or client is None or client.mock:
        return None
    try:
        async with asyncio.timeout(LATIN_TIMEOUT_S):
            return await client.transliterate(audio)
    except Exception:
        return None
