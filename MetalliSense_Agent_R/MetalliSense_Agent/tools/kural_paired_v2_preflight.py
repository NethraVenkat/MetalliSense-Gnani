"""Read-only paired-v2 data gate. No TensorFlow import, inference or training."""
import argparse
import json
from pathlib import Path
import uuid
import wave
import kural_training as k

V1=k.ROOT/'negative-context-runs/negative-context-3eabdac026d44b05aa60c393515a3a12'
SETS=k.TOOLS/'local_wake_data/kural-paired-collections-v1'
THRESHOLDS=(.5,.65,.8,.9)


def snapshot(folder):
    return {str(p.resolve()):k.digest(p) for p in folder.rglob('*') if p.is_file()}


def no_leakage(training, forbidden):
    for entry in training:
        path=str(entry['wav']).replace('\\','/').casefold()
        if any(part in path for part in ('devval-v1','s02','s03','live-diagnostic','/rejected/')):
            raise ValueError('Forbidden training path: '+str(entry['wav']))
        if entry['wav_sha256'] in forbidden or entry['pcm_sha256'] in forbidden:
            raise ValueError('Forbidden evaluation/rejected audio hash: '+str(entry['wav']))


def apply_boundary_reviews(entries,folder):
    """Merge validated append-only reviews in memory; never update source sidecars."""
    by_task={e['task_id']:e for e in entries}
    known_manifests={k.digest(folder/'manifest.json')}
    known_manifests.update(k.digest(p) for p in (folder/'manifest-history').glob('*.json'))
    for path in sorted((folder/'boundary-reviews/manish').glob('*.json')):
        review=k.read(path);entry=by_task.get(review.get('task_id'))
        if not entry or entry['label']!='wake' or review.get('schema')!='kural-paired-boundary-review-v1' or review.get('designation')!='train-paired-v1' or review.get('speaker')!='manish' or review.get('test_only') is not False or review.get('human_reviewed') is not True or review.get('recording_id')!=entry['recording_id'] or review.get('audio_sha256')!=entry['wav_sha256'] or review.get('manifest_sha256') not in known_manifests:
            raise ValueError('Invalid boundary-review identity/provenance: '+str(path))
        intervals=review.get('wake_intervals')
        if not isinstance(intervals,list) or len(intervals)!=1:raise ValueError('Expected one reviewed wake interval')
        interval=intervals[0];start=interval.get('start_seconds');end=interval.get('end_seconds')
        if type(start) not in (int,float) or type(end) not in (int,float) or not 0<=start<end<=entry['duration_seconds'] or end-start>2.000000001 or interval.get('source')!='human':
            raise ValueError('Invalid reviewed interval: '+str(path))
        entry['meta']={**entry['meta'], 'boundary_reviewed':True,'wake_intervals':intervals}
        entry['boundary_review_source']=dict(path=str(path.resolve()),sha256=k.digest(path))
    return entries


def accepted(mode):
    folder=SETS/mode
    manifest=k.read(folder/'manifest.json')
    if manifest['designation']!=mode or manifest['test_only'] is not False:
        raise ValueError('Wrong designation or test set')
    result=[];ids=set()
    for take in manifest['takes']:
        if take['meta']['status']!='accepted':continue
        meta=take['meta']
        if meta['speaker']!='manish' or meta['test_only'] is not False or meta['consent']['granted'] is not True or meta['content_reviewed'] is not True:
            raise ValueError('Invalid speaker/consent/content review')
        if meta['task_id'] in ids:raise ValueError('Duplicate task')
        ids.add(meta['task_id'])
        for key in ('wav','sidecar'):
            p=(folder/take[key]).resolve();p.relative_to(folder.resolve())
        wav=folder/take['wav'];sidecar=k.read(folder/take['sidecar'])
        if sidecar!=meta or k.digest(wav)!=meta['sha256']:raise ValueError('Manifest/sidecar/hash mismatch')
        with wave.open(str(wav)) as audio:
            if (audio.getframerate(),audio.getnchannels(),audio.getsampwidth(),audio.getcomptype())!=(16000,1,2,'NONE'):raise ValueError('Wrong WAV format')
            frames=audio.getnframes();pcm=audio.readframes(frames)
        if len(pcm)!=frames*2 or frames/16000!=meta['duration']:raise ValueError('Incomplete WAV/duration')
        import hashlib
        result.append(dict(task_id=meta['task_id'],recording_id=meta['recording_id'],wav=str(wav.resolve()),wav_sha256=meta['sha256'],pcm_sha256=hashlib.sha256(pcm).hexdigest(),frames=frames,duration_seconds=meta['duration'],label=meta['label'],meta=meta))
    if mode=='train-paired-v1':apply_boundary_reviews(result,folder)
    return result,manifest


def missing_boundaries(entries):
    result=[]
    for entry in entries:
        meta=entry['meta']
        if meta['label']=='nonwake':
            if meta.get('wake_absence_confirmed') is not True:raise ValueError('Missing nonwake absence confirmation')
            continue
        intervals=meta.get('wake_intervals',[])
        if meta.get('boundary_reviewed') is not True or not intervals:
            result.append(dict(task_id=entry['task_id'],wav=entry['wav'],sha256=entry['wav_sha256'],duration_seconds=entry['duration_seconds'],reason='Human wake boundaries absent; no positive window inferred'))
            continue
        for w in intervals:
            if w['source']!='human' or not 0<=w['start_seconds']<w['end_seconds']<=entry['duration_seconds'] or w['end_seconds']-w['start_seconds']>2:
                raise ValueError('Invalid/incompatible reviewed interval')
    return result


def check():
    protected={}
    for folder in (V1,SETS/'train-paired-v1',SETS/'devval-v1'):
        protected.update(snapshot(folder))
    identity=k.read(V1/'identity.json');config=k.read(V1/'config.json');state=k.read(V1/'state.json')
    if tuple(config['threshold_candidates'])!=THRESHOLDS or config['seed']!=1729 or config['max_epochs']!=50 or config['wall_limit_seconds']!=3600:raise ValueError('Frozen config changed')
    if k.digest(V1/state['best_checkpoint'])!=state['best_checkpoint_sha256']:raise ValueError('v1 checkpoint hash mismatch')
    for session,digest in identity['annotation_hashes'].items():
        p=k.ROOT/'annotations'/(session+'.annotations.json')
        if k.digest(p)!=digest:raise ValueError('Annotation changed')
        protected[str(p.resolve())]=digest
    frontend=k.TOOLS.parents[2]/'MetalliSense_Frontend_R/MetalliSense_Frontend'
    assets=k.read(frontend/'src/assets/approvedTourTamil.json')
    if len(assets)!=22:raise ValueError('Approved asset count')
    for row in assets:
        p=frontend/'public/audio/kural-tour-ta-v1'/row['file']
        if k.digest(p)!=row['sha256']:raise ValueError('Tour audio changed')
        protected[str(p.resolve())]=row['sha256']
    prior=k.read(V1/'dataset.json')['entries'];original=[e for e in prior if e['session_id']=='S01_TRAIN'];s02=[e for e in prior if e['session_id']=='S02_VALID']
    if len(original)!=125 or len(s02)!=61:raise ValueError('Frozen dataset counts')
    for e in original+s02:
        if k.digest(e['wav'])!=e['wav_sha256']:raise ValueError('Prior data changed')
    train,tm=accepted('train-paired-v1');dev,dm=accepted('devval-v1')
    if len(train)!=40 or len(dev)!=21:raise ValueError('Incomplete accepted sets')
    if sum(e['label']=='wake' for e in train)!=20 or sum(e['label']=='wake' for e in dev)!=10:raise ValueError('Class counts')
    forbidden={h for e in s02+dev for h in (e['wav_sha256'],e['pcm_sha256'])}
    for manifest,mode in ((tm,'train-paired-v1'),(dm,'devval-v1')):
        for take in manifest['takes']:
            if take['meta']['status']=='rejected':forbidden.add(take['meta']['sha256'])
    for p in (k.ROOT/'live-diagnostics').glob('session-*/capture.wav'):forbidden.add(k.digest(p))
    no_leakage(original+train,forbidden)
    missing=missing_boundaries(train);dev_missing=missing_boundaries(dev)
    if dev_missing:raise ValueError('Devval boundaries missing')
    if not any(e['task_id']=='manish-DC01' and e['duration_seconds']>=60 for e in dev):raise ValueError('Conversation missing/short')
    out=k.TOOLS/'local_wake_data/kural-cnn-v2-paired'/('preflight-'+uuid.uuid4().hex)
    report=dict(builder='Manish',status='BLOCKED' if missing else 'DATA_CHECK_PASSED_NOT_TRAINED',training_ran=False,inference_ran=False,training_counts=dict(original=125,paired=40,total=165,wake=60,nonwake=105),devval_counts=dict(wakes=10,conversation=1,confusables=10),missing_training_boundaries=missing,thresholds=list(THRESHOLDS),checkpoint_sha256=state['best_checkpoint_sha256'],v1_normalization_sha256=k.digest(V1/'normalization.json'),predeclaration_sha256=k.digest(k.TOOLS.parent/'DOCS/F14_KURAL_PAIRED_V2_EXPERIMENT.md'),s03='S03 not available, not evaluated',leakage_check='PASS',training_list=original+train,protected_hashes=protected)
    for p,digest in protected.items():
        if k.digest(p)!=digest:raise ValueError('Protected data changed')
    k.write_new(out/'preflight.json',report)
    print(json.dumps(dict(report=str(out/'preflight.json'),status=report['status'],missing_boundaries=len(missing),counts=report['training_counts'],leakage='PASS',protected_files=len(protected)),indent=2))
    return report


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');args=parser.parse_args()
    if args.check:check()
    else:print('Disabled; --check validates data only. No training entry point.')
