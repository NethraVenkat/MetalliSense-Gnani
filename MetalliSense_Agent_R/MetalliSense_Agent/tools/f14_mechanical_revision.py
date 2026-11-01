"""One isolated revised Mechanical Properties clip; no batch regeneration."""
import argparse
import json
from pathlib import Path
from f14_tamil_audition import FIXTURE, OUTPUT, settings_for, fingerprint
from spectrometer_audition import run, post, load_config, wav_info, now

REVISION=OUTPUT.parent/'mechanical-revision-01'

def prepare():
    original=json.loads((OUTPUT/'manifest.json').read_text(encoding='utf-8'))
    draft=json.loads(FIXTURE.read_text(encoding='utf-8'))
    changed=[]
    approvals=[]
    for old,new in zip(original['rows'],draft):
        if old['id']!=new['id']: raise ValueError('Order mismatch')
        if old['proposed']!=new['proposed']: changed.append(old['id'])
        info=wav_info((OUTPUT/old['file']).read_bytes())
        if info['sha256']!=old['sha256']: raise ValueError('Original audio changed')
        approvals.append(dict(id=old['id'],original_audio_sha256=info['sha256'],
            pronunciation='user-approved complete original 22-clip set',
            content='revision and new listening pending' if old['id']=='mechanical-properties' else 'approval retained'))
    if changed!=['mechanical-properties']: raise ValueError('Only Mechanical Properties may change')
    REVISION.mkdir(parents=True,exist_ok=True)
    approval_path=REVISION/'approval-record.json'
    if not approval_path.exists():
        approval_path.write_text(json.dumps(dict(recorded_at=now(),approvals=approvals),indent=2),encoding='utf-8')
    settings=settings_for(draft[14])
    (REVISION/'requested-settings.json').write_text(json.dumps(dict(request=settings,fingerprint=fingerprint(settings),max_requests=1,listening='pending revised clip'),ensure_ascii=False,indent=2),encoding='utf-8')
    return settings

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--live',action='store_true')
    args=parser.parse_args()
    settings=prepare()
    if args.live:
        config=load_config()
        key=(config.get('GNANI_API_KEY') or '').strip()
        if not key: raise SystemExit('Backend key missing')
        if (config.get('GNANI_BASE_URL') or 'https://api.vachana.ai').rstrip('/')!='https://api.vachana.ai': raise SystemExit('Endpoint mismatch')
        result=run(REVISION/'clip',lambda p:post(p,key),candidate='A',request_settings=settings)
        print(json.dumps(result,ensure_ascii=True,indent=2))
    else:
        print('Prepared Mechanical Properties only; zero requests. Original 22 WAV hashes verified. Revised clip listening pending.')
