"""Offline default; explicit user-run sequential Prisma snippet experiment."""
import argparse
from array import array
from datetime import datetime,timezone
import hashlib
import io
import json
import math
from pathlib import Path
import sys
import time
import unicodedata
import uuid
import wave

ROOT=Path(__file__).resolve().parents[1]
OUTPUT=ROOT/'tools/local_wake_data/kural-prisma-pause-v1'
FIELDS={'model':'prisma-v3.0','language_code':'ta-IN,en-IN','format':'codemix','keyterms':'["குரல்"]'}
RULE={'frame_samples':320,'rms_threshold':.01,'silence_frames':25,'snippet_samples':24000,'initial_silence_credit':False,'transcript_match':'NFC casefold substring: குரல் | குறள் | kural'}
RULE_V2={**RULE,'initial_silence_credit':True,'minimum_speech_frames':5,'pad_snippets_to_samples':24000,'transcript_match':'NFC casefold first word, punctuation stripped: குரல் | குறள் | kural'}
def now():return datetime.now(timezone.utc).isoformat()
def sha(data):return hashlib.sha256(data).hexdigest()
def read(p):return json.loads(Path(p).read_text(encoding='utf-8'))
def write(p,value):
    p=Path(p);tmp=p.with_suffix('.tmp');tmp.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');tmp.replace(p)
def wake(text):
    text=unicodedata.normalize('NFC',text).casefold()
    return any(term in text for term in ('குரல்','குறள்','kural'))
def first_word_wake(text):
    text=unicodedata.normalize('NFC',text).casefold()
    # Punctuation becomes separators; Tamil combining marks remain part of words.
    text=''.join(' ' if unicodedata.category(c).startswith('P') else c for c in text)
    words=text.split()
    return bool(words and words[0] in ('குரல்','குறள்','kural'))
def onsets_v2(pcm):
    samples=array('h');samples.frombytes(pcm)
    if sys.byteorder!='little':samples.byteswap()
    silence=25;streak=0;candidate=None;result=[]
    for start in range(0,len(samples),320):
        frame=samples[start:start+320]
        speech=len(frame)==320 and math.sqrt(sum((v/32768)**2 for v in frame)/len(frame))>=.01
        if speech:
            if streak==0:candidate=start if silence>=25 else None
            streak+=1
            if streak==5 and candidate is not None:result.append(candidate);candidate=None
        else:
            # A sub100ms burst is ignored, not credited as speech or silence.
            if streak>=5:silence=0
            silence+=1;streak=0;candidate=None
    return result
def snippet_v2(pcm,start):
    available=pcm[start*2:(start+24000)*2]
    return wav_bytes(available+b'\0'*(48000-len(available)))
def onsets(pcm):
    samples=array('h');samples.frombytes(pcm)
    if sys.byteorder!='little':samples.byteswap()
    silence=0;result=[]
    for start in range(0,len(samples),320):
        frame=samples[start:start+320];rms=math.sqrt(sum((v/32768)**2 for v in frame)/len(frame))
        if rms>=.01:
            if silence>=25:result.append(start)
            silence=0
        else:silence+=1
    return result
def wav_bytes(pcm):
    b=io.BytesIO()
    with wave.open(b,'wb') as w:w.setparams((1,2,16000,0,'NONE','not compressed'));w.writeframes(pcm)
    return b.getvalue()
def prepare(dataset='devval-v1',version=1,timing_only=False):
    if dataset not in ('devval-v1','devval-v2') or version not in (1,2):raise ValueError('Unknown set/version')
    if version==2 and dataset=='devval-v1' and not timing_only:raise ValueError('Old set allowed only for offline timing-check')
    if timing_only and version!=2:raise ValueError('Timing check is pause-v2 only')
    folder=ROOT/'tools/local_wake_data/kural-paired-collections-v1'/dataset;manifest=read(folder/'manifest.json');source_hashes={str(folder/'manifest.json'):sha((folder/'manifest.json').read_bytes())};clips=[];snippets=[]
    if manifest.get('designation')!=dataset or manifest.get('test_only') is not False:raise ValueError('Wrong dataset designation')
    old_hashes=set()
    if dataset=='devval-v2':
        old=ROOT/'tools/local_wake_data/kural-paired-collections-v1/devval-v1'
        for take in read(old/'manifest.json')['takes']:
            old_hashes.add(take['meta']['sha256'])
            old_hashes.add(sha((old/take['wav']).read_bytes()[44:]))
    accepted=[t for t in manifest['takes'] if t['meta']['status']=='accepted']
    if len(accepted)!=21:raise ValueError('Expected21 accepted devval recordings')
    for take in accepted:
        m=take['meta'];task=m['task_id'];p=(folder/take['wav']).resolve();p.relative_to(folder.resolve());side=(folder/take['sidecar']).resolve();side.relative_to(folder.resolve())
        if read(side)!=m or m['designation']!=dataset or m['speaker']!='manish' or m['consent']['granted'] is not True or m['content_reviewed'] is not True or m['test_only']:raise ValueError('Invalid accepted metadata')
        raw=p.read_bytes()
        if sha(raw)!=m['sha256']:raise ValueError('Source hash mismatch')
        with wave.open(io.BytesIO(raw)) as w:
            if (w.getnchannels(),w.getsampwidth(),w.getframerate(),w.getcomptype())!=(1,2,16000,'NONE'):raise ValueError('WAV format')
            frames=w.getnframes();pcm=w.readframes(frames)
        if len(pcm)!=frames*2 or frames/16000!=m['duration']:raise ValueError('Incomplete audio')
        if sha(raw) in old_hashes or sha(pcm) in old_hashes:raise ValueError('Fresh devval-v2 must not reuse devval-v1 audio')
        if m['label']=='wake':
            if not m['boundary_reviewed'] or len(m['wake_intervals'])!=1:raise ValueError('DW review missing')
            interval=m['wake_intervals'][0];s=interval['start_seconds'];e=interval['end_seconds']
            if type(s) not in (int,float) or type(e) not in (int,float) or not 0<=s<e<=m['duration'] or e-s>2.000000001 or interval['source']!='human':raise ValueError('Invalid DW review interval')
        if m['label']=='nonwake' and not m['wake_absence_confirmed']:raise ValueError('Absence unconfirmed')
        if task=='manish-DC01' and m['duration']<60:raise ValueError('Conversation below60s')
        source_hashes[str(p)]=sha(raw);source_hashes[str(side)]=sha(side.read_bytes());starts=onsets_v2(pcm) if version==2 else onsets(pcm);selected=starts[:10] if task=='manish-DC01' else starts[:1]
        clips.append(dict(task_id=task,duration_seconds=frames/16000,onset_count=len(starts),selected_calls=len(selected),onset_times=[s/16000 for s in starts],human_intervals=m['wake_intervals'],source_sha256=m['sha256']))
        for index,start in enumerate(selected):
            audio=snippet_v2(pcm,start) if version==2 else wav_bytes(pcm[start*2:min(start+24000,frames)*2]);name=task+'-'+str(index+1).zfill(2)+'.wav';spec=dict(id=name[:-4],task_id=task,file=name,start_sample=start,end_sample=min(start+24000,frames),sha256=sha(audio),duration_seconds=1.5 if version==2 else (min(start+24000,frames)-start)/16000)
            if version==2:spec.update(real_audio_samples=min(24000,frames-start),padded_samples=max(0,24000-(frames-start)))
            snippets.append((spec,audio))
    plan=dict(schema='kural-prisma-pause-v1',builder='Manish',rule=RULE,fields=FIELDS,endpoint='https://api.vachana.ai/stt/v3',clips=clips,snippets=[s for s,a in snippets],calls=len(snippets),source_hashes=source_hashes,dc01_onsets_per_minute=next(c['onset_count']/(c['duration_seconds']/60) for c in clips if c['task_id']=='manish-DC01'),dc01_selected_calls_per_minute=next(c['selected_calls']/(c['duration_seconds']/60) for c in clips if c['task_id']=='manish-DC01'))
    if version==2:plan.update(schema='kural-prisma-pause-v2',rule=RULE_V2,dataset=dataset,timing_only=timing_only)
    expected={'manish-DW'+str(i).zfill(2) for i in range(1,11)}|{'manish-DN'+str(i).zfill(2) for i in range(1,11)}|{'manish-DC01'}
    if {c['task_id'] for c in clips}!=expected:raise ValueError('Missing/duplicate required task IDs')
    if plan['calls']>30:raise ValueError('Plan exceeds30 calls')
    fingerprint=sha(json.dumps(plan,sort_keys=True,ensure_ascii=False).encode());base=OUTPUT if version==1 else ROOT/'tools/local_wake_data/kural-prisma-pause-v2'/('timing-only' if timing_only else 'evaluation');out=base/fingerprint[:20];out.mkdir(parents=True,exist_ok=True)
    for spec,audio in snippets:
        target=out/spec['file']
        if target.exists() and target.read_bytes()!=audio:raise ValueError('Existing snippet differs')
        if not target.exists():target.write_bytes(audio)
    if (out/'plan.json').exists() and read(out/'plan.json')!=plan:raise ValueError('Plan mismatch')
    if not (out/'plan.json').exists():write(out/'plan.json',plan)
    return out,plan
def validate_plan(folder,plan):
    if plan['rule'] not in (RULE,RULE_V2) or plan['fields']!=FIELDS or plan['endpoint']!='https://api.vachana.ai/stt/v3':raise ValueError('Frozen protocol mismatch')
    if plan.get('timing_only'):raise ValueError('Timing-only plan cannot call provider')
    for p,h in plan['source_hashes'].items():
        if sha(Path(p).read_bytes())!=h:raise ValueError('Source changed')
    for s in plan['snippets']:
        if Path(s['file']).name!=s['file'] or sha((folder/s['file']).read_bytes())!=s['sha256']:raise ValueError('Snippet changed')
def results(folder,plan,journal):
    byid={r['id']:r for r in journal['rows'] if r['status']=='success'};groups={}
    for prefix in ['manish-DW','manish-DN','manish-DC']:
        entries=[c for c in plan['clips'] if c['task_id'].startswith(prefix)];sent=[s for s in plan['snippets'] if s['task_id'].startswith(prefix)];groups[prefix]=dict(clips=len(entries),sent=len(sent),unsent=sum(c['selected_calls']==0 for c in entries),completed=sum(s['id'] in byid for s in sent),wake=sum(byid.get(s['id'],{}).get('wake',False) for s in sent))
    complete=len(byid)==plan['calls'] and all(r['status']=='success' for r in journal['rows']);passed=complete and groups['manish-DW']['clips']==10 and groups['manish-DN']['clips']==10 and groups['manish-DW']['wake']>=9 and groups['manish-DN']['wake']==0 and groups['manish-DC']['wake']==0
    report=dict(status=('PASS' if passed else 'FAIL') if complete else 'INCOMPLETE',groups=groups,attempts=journal['attempts'],dc01_onsets_per_minute=plan['dc01_onsets_per_minute'],dc01_selected_calls_per_minute=plan['dc01_selected_calls_per_minute'],deployment_approved=False)
    write(folder/'results.json',report)
    md='\n\n### User-run Prisma pause test results\n\nPlan `'+str(folder.relative_to(ROOT)).replace('\\','/')+'`; status **'+report['status']+'**. Attempts '+str(report['attempts'])+'.\n\n| Group | Clips | Sent | Completed | Wake | Unsent |\n|---|---:|---:|---:|---:|---:|\n'+''.join('| '+g+' | '+' | '.join(str(r[k]) for k in ['clips','sent','completed','wake','unsent'])+' |\n' for g,r in groups.items())+'\nDC01 onsets/min '+str(report['dc01_onsets_per_minute'])+'. No activation approval. Failed complete evaluation is a rejected experiment.\n'
    # Preserve the existing DOCS file; append only once per immutable result fingerprint.
    marker='<!-- prisma-result-'+sha(json.dumps(report,sort_keys=True).encode())+' -->'
    doc=ROOT/'DOCS/F14_LIVE_KURAL_DIAGNOSTIC.md'
    if marker not in doc.read_text(encoding='utf-8'):
        with doc.open('a',encoding='utf-8') as f:f.write(md+marker+'\n')
    return report
def run_live(folder,plan,max_calls,send,clock=time.monotonic,sleep=time.sleep):
    if not 1<=max_calls<=30:raise ValueError('max-calls must be1..30')
    validate_plan(folder,plan);path=folder/'journal.json';fingerprint=sha(json.dumps(plan,sort_keys=True).encode());j=read(path) if path.exists() else dict(plan_fingerprint=fingerprint,attempts=0,rows=[])
    if j['plan_fingerprint']!=fingerprint:raise ValueError('Journal protocol mismatch')
    completed={r['id'] for r in j['rows']}
    for spec in plan['snippets']:
        if spec['id'] in completed:continue
        if any(r['status']!='success' for r in j['rows']):break
        if j['attempts']>=max_calls:break
        sleep(1.1) # also enforces spacing when resuming in another process
        row=dict(id=spec['id'],status='attempt_reserved',started_at=now());j['attempts']+=1;j['rows'].append(row);write(path,j)
        try:
            value=send((folder/spec['file']).read_bytes());row.update(value)
            if value.get('status')=='success':row['wake']=(first_word_wake if plan['rule']==RULE_V2 else wake)(value['transcript'])
        except (Exception,KeyboardInterrupt) as error:row.update(status='error',error_type=type(error).__name__)
        row['ended_at']=now();write(path,j)
        if row['status']!='success':break
    return j
def reserve_v2(plan,folder):
    if plan.get('schema')!='kural-prisma-pause-v2' or plan.get('dataset')!='devval-v2' or plan.get('timing_only') is not False:raise ValueError('Fresh devval-v2 evaluation only')
    path=ROOT/'tools/local_wake_data/kural-prisma-pause-v2/single-evaluation.json';value=dict(plan_sha256=sha(json.dumps(plan,sort_keys=True).encode()),directory=str(folder.resolve()))
    if path.exists():
        if read(path)!=value:raise ValueError('Pause-v2 already reserved for another immutable plan; no second evaluation')
    else:
        path.parent.mkdir(parents=True,exist_ok=True)
        with path.open('x',encoding='utf-8') as f:json.dump(value,f,ensure_ascii=False,indent=2)
def sender():
    from dotenv import dotenv_values
    import requests
    config=dotenv_values(ROOT/'.env');key=(config.get('GNANI_API_KEY') or '').strip()
    if not key:raise ValueError('Backend .env GNANI_API_KEY missing')
    base=(config.get('GNANI_BASE_URL') or 'https://api.vachana.ai').rstrip('/')
    if base!='https://api.vachana.ai':raise ValueError('Configured base differs from verified endpoint')
    session=requests.Session();session.mount('https://',requests.adapters.HTTPAdapter(max_retries=0))
    def send(audio):
        response=session.post(base+'/stt/v3',headers={'X-API-Key-ID':key,'User-Agent':'MetalliSense-Kural-Pause-Audition/1.0'},data=FIELDS,files={'audio_file':('snippet.wav',audio,'audio/wav')},timeout=60,allow_redirects=False)
        row=dict(http_status=response.status_code,content_type=response.headers.get('Content-Type','')[:200])
        try:body=response.json()
        except ValueError:return dict(row,status='error',error_type='NonJSONResponse')
        row['request_id']=str(body.get('request_id','')).replace(key,'[REDACTED]')[:256]
        if response.status_code!=200 or body.get('success') is not True or not isinstance(body.get('transcript'),str):return dict(row,status='error',error_type='ProviderFailure')
        if body.get('model') not in (None,'prisma-v3.0'):return dict(row,status='error',error_type='UnexpectedModel')
        return dict(row,status='success',transcript=body['transcript'].replace(key,'[REDACTED]'))
    return send
def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--dry-run',action='store_true');p.add_argument('--live',action='store_true');p.add_argument('--max-calls',type=int,default=30);p.add_argument('--set',choices=['devval-v1','devval-v2'],default='devval-v2',dest='dataset');p.add_argument('--timing-check',action='store_true');args=p.parse_args()
    if args.live and args.dry_run:p.error('Choose dry-run or live')
    if args.live and (args.dataset!='devval-v2' or args.timing_check):p.error('Live is fresh devval-v2 only; timing-check is offline')
    out,plan=prepare(args.dataset,2,args.timing_check);print(json.dumps(dict(plan=str(out/'plan.json'),calls=plan['calls'],per_clip=[{k:c[k] for k in ['task_id','onset_count','selected_calls']} for c in plan['clips']],dc01_onsets_per_minute=plan['dc01_onsets_per_minute'],network_calls=0),ensure_ascii=False,indent=2))
    if args.timing_check:
        checks=[]
        for clip in plan['clips']:
            if not clip['task_id'].startswith('manish-DW'):continue
            spec=next((s for s in plan['snippets'] if s['task_id']==clip['task_id']),None);offset=spec['start_sample']/16000-clip['human_intervals'][0]['start_seconds'] if spec else None
            checks.append(dict(task_id=clip['task_id'],start_offset_seconds=offset,duration_seconds=spec['duration_seconds'] if spec else None,PASS=offset is not None and abs(offset)<=.2 and spec['duration_seconds']==1.5))
        write(out/'timing-check.json',dict(checks=checks,PASS=all(c['PASS'] for c in checks),network_calls=0,transcripts_evaluated=False));print(json.dumps(checks,indent=2));return
    if args.live:
        reservation_lock=ROOT/'tools/local_wake_data/kural-prisma-pause-v2';reservation_lock.mkdir(parents=True,exist_ok=True);lock=reservation_lock/'live.lock'
        with lock.open('x') as f:f.write(now())
        try:
            validate_plan(out,plan);send=sender();reserve_v2(plan,out);j=run_live(out,plan,args.max_calls,send);print(json.dumps(results(out,plan,j),indent=2))
        finally:lock.unlink()
if __name__=='__main__':main()
