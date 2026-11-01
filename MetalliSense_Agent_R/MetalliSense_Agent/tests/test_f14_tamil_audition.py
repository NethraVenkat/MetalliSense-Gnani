import importlib.util
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
import wave

sys.path.insert(0,str(Path(__file__).parents[1]/'tools'))
import f14_tamil_audition as m

def audio():
    data=io.BytesIO()
    with wave.open(data,'wb') as wav:
        wav.setparams((1,2,22050,0,'NONE','not compressed'))
        wav.writeframes(b'\x01\x00'*2205)
    return data.getvalue()

class BatchTests(unittest.TestCase):
    def test_sequence_ceiling_resume_and_provenance(self):
        calls=[]
        with tempfile.TemporaryDirectory() as tmp:
            out=Path(tmp)/'isolated'
            def sender(settings):
                calls.append(settings)
                return 200,audio()
            stock=lambda settings:(audio(),{'fixture':'approved exact match'})
            result=m.batch(out,True,sender,lambda n:None,stock)
            self.assertEqual(result['actual_requests'],21)
            self.assertEqual(len(calls),21)
            self.assertEqual(sum(r['status']=='reused' for r in result['rows']),1)
            self.assertTrue(all(p['language']=='hi-IN' and 'speed' not in p for p in calls))
            m.batch(out,True,lambda _:self.fail('must skip complete'),stock=stock)
            self.assertTrue((out/'step-01/response_A_tamil.bin').exists())
            self.assertEqual(json.loads((out/'step-01/manifest.json').read_text(encoding='utf-8'))['candidates'][0]['request'],calls[0])
    def test_failure_no_retry_and_exact_fixture_resume(self):
        with tempfile.TemporaryDirectory() as tmp:
            out=Path(tmp)/'isolated'
            stock=lambda settings:(audio(),{})
            result=m.batch(out,True,lambda p:(403,b''),stock=stock)
            self.assertEqual(result['actual_requests'],1)
            self.assertEqual(result['rows'][0]['status'],'failed')
            result=m.batch(out,True,lambda _:self.fail('no retry'),stock=stock)
            self.assertEqual(result['actual_requests'],1)
            path=out/'manifest.json'
            data=json.loads(path.read_text(encoding='utf-8'));data['batch_fingerprint']='changed';path.write_text(json.dumps(data),encoding='utf-8')
            with self.assertRaises(ValueError):m.batch(out,stock=stock)
    def test_dry_run_and_standalone_technical_words(self):
        import re
        with tempfile.TemporaryDirectory() as tmp:
            result=m.batch(Path(tmp)/'isolated',stock=lambda p:(audio(),{}))
            self.assertEqual(result['actual_requests'],0)
            self.assertEqual(len(result['rows']),22)
            self.assertEqual(result['rows'][1]['id'],'spectrometer')
            self.assertEqual(result['rows'][-1]['id'],'finish')
            self.assertTrue(all(not re.search(r'[A-Za-z][\u0b80-\u0bff]',r['proposed']) for r in result['rows']))
    def test_actual_stock_provenance(self):
        row=json.loads(m.FIXTURE.read_text(encoding='utf-8'))[4]
        data,provenance=m.stock_source(m.settings_for(row))
        self.assertEqual(m.wav_info(data)['duration_seconds'],7.2)
        wrong=m.settings_for(row);wrong['language']='ta-IN'
        with self.assertRaises(ValueError):m.stock_source(wrong)
