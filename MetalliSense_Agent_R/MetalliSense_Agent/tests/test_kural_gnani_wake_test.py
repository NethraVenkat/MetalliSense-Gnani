from array import array
import copy
import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest
import io
import wave
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).parents[1]/'tools'))
import kural_gnani_wake_test as t

def pcm(values):
    x=array('h',values)
    if sys.byteorder!='little':x.byteswap()
    return x.tobytes()

class PauseTests(unittest.TestCase):
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
