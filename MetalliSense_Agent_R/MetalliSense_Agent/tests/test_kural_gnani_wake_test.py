from array import array
import copy
import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest
import io
import wave
import json
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).parents[1]/'tools'))
import kural_gnani_wake_test as t

def pcm(values):
    x=array('h',values)
    if sys.byteorder!='little':x.byteswap()
    return x.tobytes()

class PauseTests(unittest.TestCase):
    def test_v3_payload_and_journal_isolation(self):
        original=dict(t.FIELDS)
        self.assertEqual(t.payload_fields('v2'),original);self.assertIn('keyterms',t.payload_fields('v2'));self.assertNotIn('keyterms',t.payload_fields('v3'));self.assertEqual(t.payload_fields('v3'),{k:v for k,v in original.items() if k!='keyterms'})
        with tempfile.TemporaryDirectory() as tmp,patch.object(t,'ROOT',Path(tmp)):
            v2=dict(schema='kural-prisma-pause-v2',dataset='devval-v2',timing_only=False);v3={**v2,'schema':'kural-prisma-pause-v3'}
            self.assertNotEqual(t.evaluation_root(v2),t.evaluation_root(v3));t.reserve_v2(v3,Path(tmp)/'v3');self.assertFalse((t.evaluation_root(v2)/'single-evaluation.json').exists());self.assertTrue((t.evaluation_root(v3)/'single-evaluation.json').exists())
            with self.assertRaisesRegex(ValueError,'waiting for devval-v2 recording'):t.prepare('devval-v2',2,False,'v3')
            with self.assertRaisesRegex(ValueError,'fresh devval-v2'):t.prepare('train-paired-v1',2,False,'v3')
        self.assertEqual(t.FIELDS,original)
    def test_v3_missing_recording_never_constructs_sender(self):
        with tempfile.TemporaryDirectory() as tmp,patch.object(t,'ROOT',Path(tmp)),patch.object(sys,'argv',['tool','--variant','v3','--dry-run','--set','devval-v2']),patch.object(t,'sender',side_effect=AssertionError('No provider')):t.main()
    def test_sender_omits_v3_keyterms_in_actual_mock_request(self):
        from unittest.mock import MagicMock
        response=MagicMock(status_code=200,headers={});response.json.return_value={'success':True,'model':'prisma-v3.0','transcript':'test'}
        with patch('dotenv.dotenv_values',return_value={'GNANI_API_KEY':'mock-test-key'}),patch('requests.Session') as factory:
            factory.return_value.post.return_value=response
            t.sender('v3')(b'fixture');fields=factory.return_value.post.call_args.kwargs['data'];self.assertNotIn('keyterms',fields);self.assertEqual(fields,t.payload_fields('v3'))
            t.sender('v2')(b'fixture');self.assertEqual(factory.return_value.post.call_args.kwargs['data'],t.FIELDS)
    def test_v3_confusable_limit_is_one_not_two(self):
        with tempfile.TemporaryDirectory() as tmp,patch.object(t,'ROOT',Path(tmp)):
            folder=Path(tmp)/'result';folder.mkdir();docs=Path(tmp)/'DOCS';docs.mkdir();(docs/'F14_LIVE_KURAL_DIAGNOSTIC.md').write_text('fixture')
            clips=[dict(task_id='manish-DW'+str(i),selected_calls=1) for i in range(10)]+[dict(task_id='manish-DN'+str(i),selected_calls=1) for i in range(10)]+[dict(task_id='manish-DC01',selected_calls=1)]
            snippets=[dict(id=c['task_id'],task_id=c['task_id']) for c in clips];plan=dict(schema='kural-prisma-pause-v3',clips=clips,snippets=snippets,calls=21,dc01_onsets_per_minute=1,dc01_selected_calls_per_minute=1)
            rows=[dict(id=c['task_id'],status='success',wake=i<9 or i==10) for i,c in enumerate(clips)];journal=dict(rows=rows,attempts=21)
            self.assertEqual(t.results(folder,plan,journal)['status'],'PASS');rows[11]['wake']=True;self.assertEqual(t.results(folder,plan,journal)['status'],'FAIL')
    def test_paired_selection_isolation_and_cap(self):
        import kural_paired_v2_preflight as preflight
        with tempfile.TemporaryDirectory() as tmp,patch.object(t,'ROOT',Path(tmp)):
            folder=Path(tmp)/'tools/local_wake_data/kural-paired-collections-v1/train-paired-v1';folder.mkdir(parents=True)
            takes=[];raw=t.wav_bytes(pcm([0]*8000+[1000]*4800+[0]*8000))
            for kind in ['A','B']:
                for index in range(1,11):
                    for member in ['wake','nonwake']:
                        task=f'manish-{kind}{index:02}-{member}';wav=task+'.wav';side=task+'.json';(folder/wav).write_bytes(raw)
                        meta=dict(task_id=task,recording_id=task,speaker='manish',designation='train-paired-v1',consent={'granted':True},content_reviewed=True,test_only=False,sha256=t.sha(raw),duration=(len(raw)-44)/32000,label=member,member=member,pair_type='A_word' if kind=='A' else 'B_question',boundary_reviewed=False,wake_intervals=[],wake_absence_confirmed=member=='nonwake')
                        (folder/side).write_text(json.dumps(meta));takes.append(dict(meta=meta,wav=wav,sidecar=side));meta['status']='accepted';(folder/side).write_text(json.dumps(meta))
            takes.append(dict(meta={'status':'rejected'},wav='must-not-open.wav',sidecar='must-not-open.json'))
            (folder/'manifest.json').write_text(json.dumps(dict(designation='train-paired-v1',test_only=False,takes=takes)))
            def overlay(entries,path):
                for e in entries:
                    if e['label']=='wake':e['meta']={**e['meta'],'boundary_reviewed':True,'wake_intervals':[dict(start_seconds=.5,end_seconds=.8,source='human')]}
            with patch.object(preflight,'apply_boundary_reviews',side_effect=overlay):out,plan=t.prepare('train-paired-v1',2)
            self.assertEqual(len(plan['clips']),40);self.assertEqual(plan['calls'],40);self.assertEqual(len(t.timing_report(plan)['checks']),20);self.assertTrue(t.timing_report(plan)['PASS']);self.assertIn('kural-prisma-pause-v2-paired',str(out))
            self.assertNotEqual(t.evaluation_root(plan),t.evaluation_root(dict(dataset='devval-v2')))
            t.reserve_v2(plan,out);self.assertTrue((t.evaluation_root(plan)/'single-evaluation.json').exists());self.assertFalse((t.evaluation_root(dict(dataset='devval-v2'))/'single-evaluation.json').exists())
            with self.assertRaises(ValueError):t.run_live(out,plan,46,lambda _:self.fail('no call'),sleep=lambda _:None)
            calls=[];j=t.run_live(out,plan,45,lambda _:calls.append(1) or dict(status='success',transcript='குரல்'),sleep=lambda _:None);self.assertEqual(len(calls),40);self.assertEqual(j['attempts'],40)
            docs=Path(tmp)/'DOCS';docs.mkdir();(docs/'F14_LIVE_KURAL_DIAGNOSTIC.md').write_text('fixture')
            report=t.results(out,plan,j);self.assertEqual(report['status'],'FAIL');self.assertEqual(report['groups']['confusables']['wake'],10);self.assertEqual(report['groups']['no_kural_questions']['wake'],10)
            for row in j['rows']:
                spec=next(s for s in plan['snippets'] if s['id']==row['id']);row['wake']=spec['task_id'].endswith('-wake')
            report=t.results(out,plan,j);self.assertEqual(report['status'],'PASS');self.assertFalse(report['conversation_tested']);self.assertEqual(report['historical_pause_v1_calls_per_minute'],7.2)
    def test_v2_onset_short_click_and_padding(self):
        # 0.27s start falls in the .26s frame;100ms confirmation retains onset.
        onset=t.onsets_v2(pcm([0]*4320+[1000]*3200))[0]
        self.assertLessEqual(abs(onset/16000-.27),.02)
        self.assertEqual(t.onsets_v2(pcm([0]*4320+[1000]*800+[0]*8000)),[])
        self.assertEqual(t.onsets_v2(pcm([1000]*3200)),[0])
        raw=t.snippet_v2(pcm([1000]*3200),0)
        with wave.open(io.BytesIO(raw)) as w:
            self.assertEqual(w.getnframes(),24000);self.assertEqual(w.getframerate(),16000);self.assertEqual(w.readframes(24000)[6400:],b'\0'*41600)
    def test_first_word_rule(self):
        for text in ['குரல்','“குரல்,” அடுத்து','...KURAL!','குறள்.']:self.assertTrue(t.first_word_wake(text))
        for text in ['...இவ்வளவு குரல்','குரங்கு','coral','kuralish','']:self.assertFalse(t.first_word_wake(text))
    def test_timing_plan_cannot_send_and_one_evaluation_reservation(self):
        with self.assertRaisesRegex(ValueError,'Timing-only'):t.validate_plan(Path('.'),dict(rule=t.RULE_V2,fields=t.FIELDS,endpoint='https://api.vachana.ai/stt/v3',timing_only=True))
        with tempfile.TemporaryDirectory() as tmp,patch.object(t,'ROOT',Path(tmp)):
            plan=dict(schema='kural-prisma-pause-v2',dataset='devval-v2',timing_only=False)
            t.reserve_v2(plan,Path(tmp));t.reserve_v2(plan,Path(tmp))
            with self.assertRaisesRegex(ValueError,'already reserved'):t.reserve_v2({**plan,'different':True},Path(tmp))
            with self.assertRaisesRegex(ValueError,'Fresh'):t.reserve_v2({**plan,'dataset':'devval-v1'},Path(tmp))
    def test_onset_requires_actual_half_second_silence(self):
        self.assertEqual(t.onsets(pcm([1000]*320+[0]*8000+[1000]*320)),[8320])
        self.assertEqual(t.onsets(pcm([0]*7680+[1000]*320)),[])
        self.assertEqual(t.onsets(pcm([0]*8000+[1000]*320)),[8000])
    def test_unicode_matching(self):
        for text in ['குரல்','குறள்','KURAL!','say kural']:self.assertTrue(t.wake(text))
        for text in ['குரங்கு','coral','']:self.assertFalse(t.wake(text))
    def test_resume_ceiling_spacing_failure(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder=Path(tmp);snips=[]
            for i in range(3):
                name=str(i)+'.wav';raw=t.wav_bytes(pcm([0]*320));(folder/name).write_bytes(raw);snips.append(dict(id=str(i),file=name,sha256=t.sha(raw)))
            plan=dict(rule=t.RULE,fields=t.FIELDS,endpoint='https://api.vachana.ai/stt/v3',source_hashes={},snippets=snips)
            calls=[];sleeps=[]
            def send(audio):calls.append(audio);return dict(status='success',transcript='குரல்')
            j=t.run_live(folder,plan,1,send,sleep=sleeps.append);self.assertEqual(j['attempts'],1)
            j=t.run_live(folder,plan,3,send,sleep=sleeps.append);self.assertEqual(j['attempts'],3);self.assertEqual(len(calls),3);self.assertTrue(all(s>=1.1 for s in sleeps));t.run_live(folder,plan,3,send,sleep=sleeps.append);self.assertEqual(len(calls),3)
        with tempfile.TemporaryDirectory() as tmp:
            folder=Path(tmp);raw=t.wav_bytes(pcm([0]*320));(folder/'x.wav').write_bytes(raw);plan['snippets']=[dict(id='x',file='x.wav',sha256=t.sha(raw))]
            j=t.run_live(folder,plan,30,lambda _:dict(status='error'),sleep=lambda _:None);self.assertEqual(j['attempts'],1)
            t.run_live(folder,plan,30,lambda _:self.fail('no retry'),sleep=lambda _:None)
    def test_dry_run_does_not_create_sender(self):
        with patch.object(sys,'argv',['tool','--dry-run']),patch.object(t,'prepare',return_value=(Path('fixture'),dict(calls=0,clips=[],dc01_onsets_per_minute=0))),patch.object(t,'sender',side_effect=AssertionError('network factory')):t.main()

if __name__=='__main__':unittest.main()
