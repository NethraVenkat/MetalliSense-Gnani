"""One process-wide provider lease shared by sync, async and stream clients.

Run one Agent worker: separate OS processes need an external coordinator.
Cancellation of an async waiter never acquires/leaks the lease.
"""
import asyncio
from contextlib import asynccontextmanager
import sys
import threading
import requests
from types import SimpleNamespace

# main and tooling can import copilot under two package spellings.
_state = sys.modules.setdefault('_metallisense_gnani_lease', SimpleNamespace(lock=threading.Lock()))

if not hasattr(_state,'session'):
    _state.session=requests.Session()
    _state.session.mount('https://',requests.adapters.HTTPAdapter(max_retries=0,pool_connections=4,pool_maxsize=4))
    _state.default_post=requests.post

@asynccontextmanager
async def provider_slot():
    while not _state.lock.acquire(False):
        await asyncio.sleep(.01)
    try:
        yield
    finally:
        _state.lock.release()

def post(*args, **kwargs):
    with _state.lock:
        # Offline audition tools install cumulative-budget guards on this
        # public transport. Preserve those guards instead of bypassing them.
        if requests.post is not _state.default_post:
            return requests.post(*args, **kwargs)
        return _state.session.post(*args, **kwargs)


def provider_busy():
    """Read-only availability for optional features; never waits for the lease."""
    return _state.lock.locked()
