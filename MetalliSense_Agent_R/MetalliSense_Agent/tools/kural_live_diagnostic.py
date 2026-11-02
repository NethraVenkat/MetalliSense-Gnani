"""Explicit localhost microphone diagnostic. No training, app actions or cloud calls."""
from array import array
import argparse
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import math
import os
from pathlib import Path
import signal
import sys
import threading
import time
from urllib.parse import parse_qs, urlsplit
import uuid
import wave

import kural_training as k

RUN=k.ROOT/'negative-context-runs/negative-context-3eabdac026d44b05aa60c393515a3a12'
PAGE=Path(__file__).with_name('kural_live_diagnostic.html')
RATE=16000
HOP=1280
LIMIT_FRAMES=RATE*300
MAX_PACKET_BYTES=RATE*2
THRESHOLDS=(.5,.65,.8,.9)


def now():
    return datetime.now(timezone.utc).isoformat()


def finite_time(value):
    return isinstance(value,(int,float)) and not isinstance(value,bool) and math.isfinite(value)


class DiagnosticError(ValueError):
    def __init__(self,message,status=400):
        super().__init__(message);self.status=status


class CheckpointScorer:
    def __init__(self):
        if Path(sys.prefix).resolve()!=(k.ROOT/'environment').resolve():
            raise ValueError('Use the isolated training interpreter; no installation is performed')
        manifest=k.read(RUN/'artifact-hashes.json')
        for name in ('config.json','feature-config.json','normalization.json','state.json'):
            if k.digest(RUN/name)!=manifest.get(name):raise ValueError('Frozen run metadata hash mismatch: '+name)
        os.environ.update(CUDA_VISIBLE_DEVICES='-1',TF_ENABLE_ONEDNN_OPTS='0',TF_DETERMINISTIC_OPS='1')
        import tensorflow as tf
        import numpy as np
        from kural_audio_features import build_feature_extractor,causal_context
        tf.config.threading.set_intra_op_parallelism_threads(4)
        tf.config.threading.set_inter_op_parallelism_threads(1)
        config=k.read(RUN/'config.json');fc=k.read(RUN/'feature-config.json');state=k.read(RUN/'state.json');norm=k.read(RUN/'normalization.json')
        if tuple(config['threshold_candidates'])!=THRESHOLDS or (fc['sample_rate'],fc['window_samples'],fc['replay_hop_samples'])!=(RATE,32000,HOP):
            raise ValueError('Frozen preprocessing/threshold contract mismatch')
        if (config['decision_consecutive_frames'],config['decision_cooldown_seconds'])!=(2,1.0):
            raise ValueError('Frozen event contract mismatch')
        checkpoint=RUN/state['best_checkpoint']
        if k.digest(checkpoint)!=state['best_checkpoint_sha256']:
            raise ValueError('Checkpoint hash mismatch')
        began=time.perf_counter()
        self.model=tf.keras.models.load_model(checkpoint,compile=False)
        self.loading_seconds=time.perf_counter()-began
        self.np=np;self.context=causal_context;self.feature=build_feature_extractor(fc,tf,np)
        self.mean=np.array(norm['mean'],dtype='float32');self.std=np.array(norm['std'],dtype='float32')
        self.metadata=dict(checkpoint=str(checkpoint),checkpoint_sha256=state['best_checkpoint_sha256'],normalization_sha256=k.digest(RUN/'normalization.json'),feature_config_sha256=k.digest(RUN/'feature-config.json'),model_loading_seconds=self.loading_seconds,qualified_threshold=None,thresholds=list(THRESHOLDS),gate='ungated primary event logic; history support is diagnostic metadata only',versions=dict(tensorflow=tf.__version__,numpy=np.__version__),sample_rate=RATE,chunk_frames=HOP,limit_seconds=300)

    def __call__(self,samples,end):
        np=self.np
        segment=np.array(samples[max(0,end-32000):end],dtype='float32')/32768
        features=self.feature(self.context(segment,len(segment),32000,np))
        x=(((features-self.mean[0])/self.std[0])[None,...,None])
        probabilities=self.model(x,training=False).numpy()[0]
        if not np.isfinite(probabilities).all():raise ValueError('Nonfinite model output')
        return float(probabilities[1])


class DiagnosticEngine:
    def __init__(self,scorer,root=None,clock=time.monotonic):
        self.scorer=scorer;self.root=Path(root) if root is not None else k.ROOT/'live-diagnostics'
        self.clock=clock;self.lock=threading.RLock();self.active=None;self.completed={}
        self.metadata=getattr(scorer,'metadata',dict(thresholds=list(THRESHOLDS),qualified_threshold=None,sample_rate=RATE,chunk_frames=HOP,limit_seconds=300))

    def _append(self,name,value):
        with (self.active['folder']/name).open('a',encoding='utf-8') as log:log.write(json.dumps(value)+'\n')

    def start(self,data):
        with self.lock:
            if self.active:raise DiagnosticError('A microphone session is already active',409)
            if data.get('consent') is not True:raise DiagnosticError('Explicit local-recording consent required')
            capture=data.get('browser_capture')
            if capture is not None and (not isinstance(capture,dict) or len(json.dumps(capture))>4000):raise DiagnosticError('Invalid browser capture metadata')
            condition=data.get('condition','unspecified')
            if not isinstance(condition,str) or len(condition)>200:raise DiagnosticError('Invalid condition')
            session=uuid.uuid4().hex;folder=self.root/('session-'+session);folder.mkdir(parents=True)
            output=wave.open(str(folder/'capture.wav'),'wb');output.setparams((1,2,RATE,0,'NONE','not compressed'))
            self.active=dict(session=session,folder=folder,output=output,samples=array('h'),next_sequence=0,times=[],scores=[],event_counts={t:0 for t in THRESHOLDS},last_scored=0,last_received=self.clock(),started=self.clock(),created_at=now())
            k.write_new(folder/'session.json',dict(session=session,created_at=self.active['created_at'],consent=True,condition=condition,browser_capture=capture,model=self.metadata,scope='Exploratory development only; no dataset import, app actions or activation approval',audio_format=dict(sample_rate=RATE,channels=1,bits=16,encoding='PCM16 little-endian'),timing='Audio timestamps count received16k samples; wall/processing time recorded separately; manual labels are not verified ground truth'))
            return dict(session=session,audio_time=0,sample_rate=RATE,chunk_frames=HOP,thresholds=list(THRESHOLDS),limit_seconds=300,log_directory=str(folder),stopped=False)

    def status(self):
        with self.lock:
            session=self.active
            return dict(model_ready=True,model=self.metadata,active_session=session['session'] if session else None,audio_time=len(session['samples'])/RATE if session else 0,diagnostic_only=True)

    def _process(self,flush=False):
        a=self.active;points=[];events=[]
        ends=list(range((a['last_scored']//HOP+1)*HOP,len(a['samples'])+1,HOP))
        if flush and len(a['samples'])>a['last_scored'] and (not ends or ends[-1]!=len(a['samples'])):ends.append(len(a['samples']))
        for end in ends:
            began=time.perf_counter();score=self.scorer(a['samples'],end);processing=time.perf_counter()-began
            if not math.isfinite(score) or not 0<=score<=1:raise ValueError('Invalid wake probability')
            timestamp=end/RATE;a['times'].append(timestamp);a['scores'].append(score);a['last_scored']=end
            point=dict(audio_time=timestamp,score=score,processing_seconds=processing,context_real_samples=min(end,32000),padded_samples=max(0,32000-end),wall_time_utc=now())
            points.append(point);self._append('scores.jsonl',point)
            for threshold in THRESHOLDS:
                emitted=k.events(a['times'],a['scores'],threshold,2,1.0)
                for audio_time in emitted[a['event_counts'][threshold]:]:
                    event=dict(threshold=threshold,audio_time=audio_time,wall_time_utc=now(),score=score,diagnostic_only=True)
                    events.append(event);self._append('events.jsonl',event)
                a['event_counts'][threshold]=len(emitted)
        return points,events

    def audio(self,session,sequence,payload):
        with self.lock:
            if not self.active or self.active['session']!=session:raise DiagnosticError('No matching active session',409)
            a=self.active
            if sequence!=a['next_sequence']:raise DiagnosticError('Audio sequence out of order; stop and preserve this session',409)
            if not payload or len(payload)%2 or len(payload)>MAX_PACKET_BYTES:raise DiagnosticError('Expected nonempty PCM16 packet of at most1 second')
            data=array('h');data.frombytes(payload)
            if sys.byteorder!='little':data.byteswap()
            remaining=LIMIT_FRAMES-len(a['samples']);data=data[:remaining]
            a['samples'].extend(data)
            wire=data.tobytes()
            if sys.byteorder!='little':copy=array('h',data);copy.byteswap();wire=copy.tobytes()
            a['output'].writeframes(wire);a['next_sequence']+=1;a['last_received']=self.clock()
            try:
                points,events=self._process()
            except Exception as error:
                self._append('errors.jsonl',dict(wall_time_utc=now(),type=type(error).__name__,message=str(error)[:1000]))
                self._finish('inference_error',flush=False)
                raise DiagnosticError('Inference failed; session stopped and evidence preserved',500) from error
            response=dict(session=session,sequence=sequence,audio_time=len(a['samples'])/RATE,points=points,events=events,stopped=False)
            if len(a['samples'])>=LIMIT_FRAMES:
                final=self._finish('audio_limit',flush=True);response.update(stopped=True,reason='audio_limit',log_directory=final['log_directory'])
            return response

    def expected(self,data):
        with self.lock:
            session=data.get('session')
            if not self.active or self.active['session']!=session:raise DiagnosticError('Manual markers require matching active session',409)
            start=data.get('start_seconds');end=data.get('end_seconds');label=data.get('label');notes=data.get('notes','')
            duration=len(self.active['samples'])/RATE
            if not finite_time(start) or not 0<=start<=duration:raise DiagnosticError('Marker start outside captured audio')
            if end is not None and (not finite_time(end) or not start<=end<=duration):raise DiagnosticError('Marker end outside captured audio')
            if not isinstance(label,str) or not label.strip() or len(label)>120 or not isinstance(notes,str) or len(notes)>1000:raise DiagnosticError('Invalid marker label or notes')
            row=dict(session=session,start_seconds=start,end_seconds=end,label=label,notes=notes,wall_time_utc=now(),source='manual expectation, not verified listening ground truth')
            self._append('expected.jsonl',row)
            return dict(saved=True,marker=row)

    def _finish(self,reason,flush=True):
        a=self.active
        if not a:return None
        points=[];events=[]
        try:
            if flush:points,events=self._process(flush=True)
        finally:
            a['output'].close()
            result=dict(session=a['session'],audio_time=len(a['samples'])/RATE,points=points,events=events,stopped=True,reason=reason,log_directory=str(a['folder']),wall_elapsed_seconds=self.clock()-a['started'])
            k.write_new(a['folder']/'finished.json',result)
            self.completed[a['session']]=result;self.active=None
        return result

    def stop(self,session,reason='user_stop'):
        with self.lock:
            if self.active and self.active['session']==session:return self._finish(reason)
            if session in self.completed:return dict(self.completed[session],idempotent=True)
            raise DiagnosticError('Unknown or stale session',409)

    def expire(self):
        with self.lock:
            if self.active and self.clock()-self.active['last_received']>=30:return self._finish('idle_timeout')

    def shutdown(self):
        with self.lock:
            if self.active:return self._finish('server_shutdown')


def make_handler(engine,port):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self,*args):pass
        def _allowed(self):
            hosts={f'127.0.0.1:{port}',f'localhost:{port}'}
            if self.headers.get('Host') not in hosts:raise DiagnosticError('Loopback host required',403)
            origin=self.headers.get('Origin')
            if origin is not None and origin not in {'http://'+h for h in hosts}:raise DiagnosticError('Same-loopback origin required',403)
        def _send(self,status,data,content_type='application/json'):
            body=json.dumps(data).encode() if content_type=='application/json' else data
            self.send_response(status);self.send_header('Content-Type',content_type);self.send_header('Content-Length',str(len(body)));self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');self.end_headers();self.wfile.write(body)
        def do_GET(self):
            try:
                self._allowed();path=urlsplit(self.path).path
                if path=='/status':self._send(200,engine.status())
                elif path=='/':self._send(200,PAGE.read_bytes(),'text/html; charset=utf-8')
                elif path in ('/kural_live_capture.js','/kural_live_diagnostic.js'):
                    self._send(200,PAGE.with_name(path[1:]).read_bytes(),'application/javascript; charset=utf-8')
                elif path=='/favicon.ico':self._send(204,b'','image/x-icon')
                else:raise DiagnosticError('Not found',404)
            except DiagnosticError as e:self._send(e.status,dict(error=str(e)))
        def do_POST(self):
            try:
                self._allowed();url=urlsplit(self.path);limit=MAX_PACKET_BYTES if url.path=='/audio' else 8192
                try:size=int(self.headers.get('Content-Length','0'))
                except ValueError:raise DiagnosticError('Invalid Content-Length')
                if not 0<size<=limit:raise DiagnosticError('Payload size invalid',413)
                body=self.rfile.read(size)
                if len(body)!=size:raise DiagnosticError('Incomplete body')
                if url.path=='/audio':
                    query=parse_qs(url.query)
                    try:session=query['session'][0];sequence=int(query['sequence'][0])
                    except (KeyError,ValueError):raise DiagnosticError('Missing session/sequence')
                    result=engine.audio(session,sequence,body)
                else:
                    try:data=json.loads(body)
                    except (ValueError,UnicodeError):raise DiagnosticError('Invalid JSON')
                    if not isinstance(data,dict):raise DiagnosticError('JSON object required')
                    if url.path=='/start':result=engine.start(data)
                    elif url.path=='/expected':result=engine.expected(data)
                    elif url.path=='/stop':result=engine.stop(data.get('session'))
                    else:raise DiagnosticError('Not found',404)
                self._send(200,result)
            except DiagnosticError as e:self._send(e.status,dict(error=str(e)))
            except Exception as e:
                engine.shutdown();self._send(500,dict(error='Local diagnostic error; capture stopped',type=type(e).__name__))
    return Handler


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--serve',action='store_true');parser.add_argument('--port',type=int,default=8777);args=parser.parse_args()
    if not args.serve:print('Disabled. Use --serve for explicit local microphone diagnostic.');return
    if not 1024<=args.port<=65535:raise ValueError('Use an unprivileged local port')
    scorer=CheckpointScorer();engine=DiagnosticEngine(scorer)
    server=ThreadingHTTPServer(('127.0.0.1',args.port),make_handler(engine,args.port));server.daemon_threads=True
    def watch():
        while not stopped.wait(1):engine.expire()
    stopped=threading.Event();threading.Thread(target=watch,daemon=True).start()
    print(f'Exploratory diagnostic ready: http://127.0.0.1:{args.port}/',flush=True)
    print('Microphone off until explicit Start; no app/cloud actions. Ctrl+C stops server.',flush=True)
    try:server.serve_forever(poll_interval=.3)
    except KeyboardInterrupt:pass
    finally:stopped.set();engine.shutdown();server.server_close()


if __name__=='__main__':main()
