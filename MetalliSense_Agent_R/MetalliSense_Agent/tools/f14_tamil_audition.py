"""Separate Tamil listening batch. Dry-run default; cumulative 22-call ceiling."""
import argparse
import hashlib
import html
import json
from pathlib import Path
import time
import sys
from spectrometer_audition import ROOT, payload, post, run, wav_info, load_config, now

FIXTURE=ROOT/'tests/fixtures/f14_tamil_audition_drafts.json'
OUTPUT=ROOT/'app/data/tts_cache/f14_tamil_hi_audition/run-01'
STOCK=ROOT/'app/data/tts_cache/stock_pronunciation_audition/run-20261101T172546009819Z'

def fingerprint(settings):
    return hashlib.sha256(json.dumps(settings,sort_keys=True,ensure_ascii=False).encode()).hexdigest()

def settings_for(row):
    settings=payload('hi-IN')
    settings['text']=row['proposed']
    return settings

def stock_source(settings, source=STOCK):
    recovery=json.loads((source/'offline-recovery/recovery-manifest.json').read_text(encoding='utf-8'))
    original_bytes=(source/'manifest.json').read_bytes()
    original=json.loads(original_bytes)
    if hashlib.sha256(original_bytes).hexdigest()!=recovery['original_manifest_sha256']:
        raise ValueError('Stock provenance manifest changed')
    if original['candidates'][0]['request']!=settings:
        raise ValueError('Stock text/settings mismatch')
    audio=(source/'offline-recovery'/recovery['file']).read_bytes()
    info=wav_info(audio)
    if info['sha256']!=recovery['sha256']: raise ValueError('Stock hash mismatch')
    return audio,dict(source=str(source),recovery_sha256=info['sha256'],original_manifest_sha256=recovery['original_manifest_sha256'])

def review(directory,manifest):
    cards=[]
    for row in manifest['rows']:
        player='<audio controls preload="none" src="'+html.escape(row['file'])+'"></audio>' if row.get('file') else ''
        cards.append('<section><h2>'+str(row['number'])+'. '+html.escape(row['page'])+'</h2><p>'+html.escape(row['proposed'])+'</p><details><summary>Original / wording review</summary><p>'+html.escape(row['original_caption'])+'</p><p>'+html.escape(row['wording_status'])+'</p></details><p>'+html.escape(row['status'])+'; duration: '+str(row.get('duration_seconds','unavailable'))+'</p>'+player+'<label>Listening status <select data-id="'+row['id']+'">'+''.join('<option'+(' selected' if v==row['listening'] else '')+'>'+v+'</option>' for v in ['pending','approved','needs-change'])+'</select></label></section>')
    (directory/'index.html').write_text('<!doctype html><meta charset="utf-8"><title>Tamil tour audition</title><style>body{font:16px/1.8 system-ui;max-width:900px;margin:auto;padding:20px}section{border-bottom:1px solid #ccc;padding:16px}audio{display:block;width:100%}</style><h1>Tamil tour — separate listening review</h1><p>Kalpana / timbre-v3.0 / hi-IN / default speed. Only reused Stock is initially approved. Dropdown notes stay in this browser; export feedback separately.</p>'+''.join(cards)+'''<script>for(const s of document.querySelectorAll('select')){const k='f14-audition-'+s.dataset.id;try{s.value=localStorage.getItem(k)||s.value}catch{}s.onchange=()=>{try{localStorage.setItem(k,s.value)}catch{}}}</script>''',encoding='utf-8')

def batch(directory=OUTPUT,live=False,sender=None,pause=time.sleep,stock=stock_source):
    directory=Path(directory)
    rows=json.loads(FIXTURE.read_text(encoding='utf-8'))
    if len(rows)!=22 or len({r['id'] for r in rows})!=22: raise ValueError('Expected 22 unique steps')
    digest=fingerprint([settings_for(r) for r in rows])
    directory.mkdir(parents=True,exist_ok=True)
    path=directory/'manifest.json'
    if path.exists():
        manifest=json.loads(path.read_text(encoding='utf-8'))
        if manifest['batch_fingerprint']!=digest: raise ValueError('Fixture/settings changed; refusing resume')
    else:
        manifest=dict(created_at=now(),batch_fingerprint=digest,max_requests=22,actual_requests=0,
            settings_note='Default public speed omitted; playground 0.5 mapping unknown',
            rows=[dict(r,status='pending',fingerprint=fingerprint(settings_for(r))) for r in rows])
    def save():
        manifest['updated_at']=now()
        path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
        review(directory,manifest)
    # Import only the specifically approved exact-match Stock recovery.
    row=manifest['rows'][4]
    if row['status']=='pending':
        audio,provenance=stock(settings_for(row))
        filename='05_stock.wav'
        with (directory/filename).open('xb') as target: target.write(audio)
        row.update(status='reused',file=filename,provenance=provenance,**wav_info(audio))
    save()
    for row in manifest['rows']:
        if row['status'] in ('generated','reused'):
            info=wav_info((directory/row['file']).read_bytes())
            if info['sha256']!=row['sha256']: raise ValueError('Completed audio hash mismatch; no regeneration')
            continue
        if row['status']!='pending': break # Failed/uncertain attempts never retry.
        if not live: continue
        if manifest['actual_requests']>=22: break
        if sender is None: raise ValueError('Live sender required')
        if manifest['actual_requests']: pause(1.1)
        row['status']='attempt_reserved'
        manifest['actual_requests']+=1
        save()
        step_dir=directory/('step-'+str(row['number']).zfill(2))
        settings=settings_for(row)
        result=run(step_dir,sender,candidate='A',request_settings=settings)
        outcome=result['candidates'][0]
        if not outcome.get('file'):
            row.update(status='failed',evidence=str(step_dir.relative_to(directory)))
            save()
            break
        row.update(status='generated',file=str((step_dir/outcome['file']).relative_to(directory)),
                   duration_seconds=outcome['duration_seconds'],sha256=outcome['sha256'])
        save()
    return manifest

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--live',action='store_true')
    args=parser.parse_args()
    sender=None
    if args.live:
        config=load_config()
        key=(config.get('GNANI_API_KEY') or '').strip()
        if not key: raise SystemExit('Backend key missing; zero requests')
        if (config.get('GNANI_BASE_URL') or 'https://api.vachana.ai').rstrip('/')!='https://api.vachana.ai': raise SystemExit('Endpoint mismatch')
        sender=lambda settings:post(settings,key)
    result=batch(live=args.live,sender=sender)
    print(json.dumps(dict(actual_requests=result['actual_requests'],counts={s:sum(r['status']==s for r in result['rows']) for s in ['pending','generated','reused','failed','attempt_reserved']},review=str(OUTPUT/'index.html')),indent=2))
