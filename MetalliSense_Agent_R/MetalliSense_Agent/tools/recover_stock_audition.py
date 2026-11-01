"""Offline recovery only. Never loads credentials or invokes HTTP."""
import hashlib
import json
from pathlib import Path
import sys
from spectrometer_audition import finalize_pcm_wav, wav_info, now

def recover(run):
    run=Path(run).resolve()
    source=run/'response_stock_hi_default.bin'
    original=source.read_bytes()
    manifest=(run/'manifest.json').read_bytes()
    audio,details=finalize_pcm_wav(original)
    info=wav_info(audio)
    output=run/'offline-recovery'
    output.mkdir(exist_ok=False)
    name='stock_hi_default_finalized.wav'
    (output/name).write_bytes(audio)
    report=dict(recovered_at=now(),provider_requests=0,source=str(source),
        source_sha256=hashlib.sha256(original).hexdigest(),
        original_manifest_sha256=hashlib.sha256(manifest).hexdigest(),
        file=name,details=details,**info,
        listening_status='pending; header repair does not prove sentence completeness')
    (output/'recovery-manifest.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    (output/'index.html').write_text('<!doctype html><meta charset="utf-8"><title>Stock audition recovery</title><h1>Stock audition — listening pending</h1><audio controls src="'+name+'"></audio>',encoding='utf-8')
    assert source.read_bytes()==original and (run/'manifest.json').read_bytes()==manifest
    return report

if __name__=='__main__':
    print(json.dumps(recover(sys.argv[1]),indent=2))
