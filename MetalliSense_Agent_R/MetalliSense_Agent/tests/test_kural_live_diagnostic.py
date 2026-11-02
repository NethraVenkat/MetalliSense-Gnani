from array import array
from io import BytesIO
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import wave
sys.path.insert(0,str(Path(__file__).parents[1]/'tools'))
import kural_live_diagnostic as live
import kural_training as k


def pcm(frames,value=100):
    result=array('h',[value]*frames)
    if sys.byteorder!='little':result.byteswap()
    return result.tobytes()


class LiveDiagnosticTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup);self.clock=[0.0]
        self.ends=[]
        def scorer(samples,end):self.ends.append(end);return .95
        self.engine=live.DiagnosticEngine(scorer,Path(self.temp.name),lambda:self.clock[0])
        self.addCleanup(self.engine.shutdown)

    def start(self):return self.engine.start({'consent':True,'condition':'fixture'})

    def test_default_off(self):
        r=subprocess.run([sys.executable,str(Path(live.__file__))],capture_output=True,text=True,timeout=20)
        self.assertEqual(r.returncode,0);self.assertIn('Disabled',r.stdout)

    def test_scorer_refuses_wrong_interpreter_before_dependency_import(self):
        with patch.object(sys,'prefix','C:/not-the-isolated-environment'):
            with self.assertRaisesRegex(ValueError,'isolated training interpreter'):live.CheckpointScorer()

    def test_explicit_consent_single_owner_and_sequence(self):
        with self.assertRaises(live.DiagnosticError):self.engine.start({'consent':False})
        first=self.start()
        with self.assertRaises(live.DiagnosticError):self.start()
        with self.assertRaises(live.DiagnosticError):self.engine.audio(first['session'],1,pcm(1280))
        result=self.engine.audio(first['session'],0,pcm(1280))
        self.assertEqual(result['audio_time'],.08);self.assertEqual(self.ends,[1280])
        with self.assertRaises(live.DiagnosticError):self.engine.audio(first['session'],0,pcm(1280))

    def test_exact_hops_final_partial_and_fixed_event_parity(self):
        session=self.start()['session']
        points=[];events=[]
        for sequence,frames in enumerate((333,947,1600,1000,1280)):
            response=self.engine.audio(session,sequence,pcm(frames));points.extend(response['points']);events.extend(response['events'])
        final=self.engine.stop(session);points.extend(final['points']);events.extend(final['events'])
        total=333+947+1600+1000+1280
        self.assertEqual(self.ends,[1280,2560,3840,5120,total])
        self.assertEqual([p['audio_time'] for p in points],[end/16000 for end in self.ends])
        for threshold in live.THRESHOLDS:
            actual=[e['audio_time'] for e in events if e['threshold']==threshold]
            expected=k.events([p['audio_time'] for p in points],[p['score'] for p in points],threshold,2,1)
            self.assertEqual(actual,expected)
        self.assertEqual(points[0]['context_real_samples'],1280)
        self.assertEqual(points[0]['padded_samples'],30720)
        self.assertTrue(all('processing_seconds' in p and 'wall_time_utc' in p for p in points))
        with wave.open(str(Path(final['log_directory'])/'capture.wav')) as wav:
            self.assertEqual((wav.getframerate(),wav.getnchannels(),wav.getsampwidth(),wav.getnframes()),(16000,1,2,total))
        self.assertTrue(self.engine.stop(session)['idempotent'])
        with self.assertRaises(live.DiagnosticError):self.engine.audio(session,5,pcm(1280))

    def test_new_session_isolated_from_old_stop_and_state(self):
        old=self.start()['session'];self.engine.audio(old,0,pcm(2560));self.engine.stop(old)
        new=self.start()['session'];self.engine.stop(old)
        self.assertEqual(self.engine.status()['active_session'],new)
        result=self.engine.audio(new,0,pcm(1280));self.assertEqual(result['events'],[])

    def test_manual_expected_markers_bounded_and_kept_separate(self):
        session=self.start()['session'];self.engine.audio(session,0,pcm(2560))
        marker=self.engine.expected(dict(session=session,start_seconds=.08,end_seconds=.16,label='Kural alone',notes='manual expectation'))
        self.assertTrue(marker['saved'])
        for payload in [dict(start_seconds=.2),dict(start_seconds=.08,end_seconds=.3),dict(start_seconds=float('nan')),dict(start_seconds=True),dict(start_seconds=.1,end_seconds=.05)]:
            with self.assertRaises(live.DiagnosticError):self.engine.expected(dict(session=session,label='test',**payload))
        self.assertEqual(len((self.engine.active['folder']/'expected.jsonl').read_text().splitlines()),1)
        self.assertIn('not verified',marker['marker']['source'])

    def test_packet_bounds(self):
        session=self.start()['session']
        for payload in (b'',b'a',b'x'*(live.MAX_PACKET_BYTES+2)):
            with self.assertRaises(live.DiagnosticError):self.engine.audio(session,0,payload)
        self.assertEqual(self.engine.active['next_sequence'],0)

    def test_audio_cap_finalizes_without_extra_audio(self):
        with patch.object(live,'LIMIT_FRAMES',2560):
            session=self.start()['session'];r=self.engine.audio(session,0,pcm(3840))
            self.assertTrue(r['stopped']);self.assertEqual(r['reason'],'audio_limit');self.assertEqual(r['audio_time'],.16)
            self.assertIsNone(self.engine.active)
            with wave.open(str(Path(r['log_directory'])/'capture.wav')) as wav:self.assertEqual(wav.getnframes(),2560)

    def test_error_idle_and_shutdown_close_wav(self):
        def failure(samples,end):raise ValueError('fixture failure')
        self.engine.scorer=failure;session=self.start()['session'];folder=self.engine.active['folder']
        with self.assertRaises(live.DiagnosticError) as raised:self.engine.audio(session,0,pcm(1280))
        self.assertEqual(raised.exception.status,500);self.assertIsNone(self.engine.active)
        with wave.open(str(folder/'capture.wav')) as wav:self.assertEqual(wav.getnframes(),1280)
        self.assertEqual(json.loads((folder/'finished.json').read_text())['reason'],'inference_error')
        self.engine.scorer=lambda samples,end:.2
        session=self.start()['session'];self.clock[0]=31;self.assertEqual(self.engine.expire()['reason'],'idle_timeout')
        self.assertIsNone(self.engine.active)
        self.start();self.assertEqual(self.engine.shutdown()['reason'],'server_shutdown')

    def test_loopback_origin_enforcement_and_fixed_routes(self):
        handler=live.make_handler(self.engine,8777);obj=object.__new__(handler)
        obj.headers={'Host':'127.0.0.1:8777','Origin':'http://127.0.0.1:8777'};obj._allowed()
        obj.headers['Origin']='https://unrelated.example'
        with self.assertRaises(live.DiagnosticError):obj._allowed()
        obj.headers={'Host':'unrelated.example:8777'}
        with self.assertRaises(live.DiagnosticError):obj._allowed()
        root=Path(self.temp.name);(root/'page.html').write_text('fixture');(root/'kural_live_capture.js').write_text('fixture JS')
        obj.headers={'Host':'localhost:8777'};obj.path='/kural_live_capture.js';sent=[];obj._send=lambda *args:sent.append(args)
        with patch.object(live,'PAGE',root/'page.html'):obj.do_GET()
        self.assertEqual(sent[0][1],b'fixture JS');self.assertIn('javascript',sent[0][2])


if __name__=='__main__':unittest.main()
