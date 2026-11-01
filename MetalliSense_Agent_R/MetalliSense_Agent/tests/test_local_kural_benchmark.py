import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest
import wave
import io
import tarfile

spec=importlib.util.spec_from_file_location('bench',Path(__file__).parents[1]/'tools/local_kural_benchmark.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
setup_spec=importlib.util.spec_from_file_location('local_setup',Path(__file__).parents[1]/'tools/setup_local_kural.py')
setup_tools=importlib.util.module_from_spec(setup_spec);setup_spec.loader.exec_module(setup_tools)

class BenchmarkTests(unittest.TestCase):
    def test_setup_rejects_runtime_digest_before_install_or_model_download(self):
        with tempfile.TemporaryDirectory() as tmp:
            calls=[]
            def fetch(url,path):calls.append(url);path.write_bytes(b'bad digest')
            with self.assertRaises(ValueError):setup_tools.setup(Path(tmp)/'setup',fetch=fetch,runner=lambda *a,**kw:self.fail('must not install'))
            self.assertEqual(len(calls),1)
            self.assertIn('v2.0.1',calls[0])
    def test_setup_preserves_existing_data_and_rejects_archive_escape(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            with self.assertRaises(FileExistsError):setup_tools.setup(root,fetch=lambda *a:self.fail('must not download'))
            archive=root/'unsafe.tar.bz2'
            with tarfile.open(archive,'w:bz2') as tar:
                member=tarfile.TarInfo('../escape.txt');member.size=1;tar.addfile(member,io.BytesIO(b'x'))
            with self.assertRaises(ValueError):setup_tools.extract(archive,root/'output')
    def test_activation_consumed_once_and_cleanup(self):
        class Model:
            closed=False
            def close(self):self.closed=True
        gate=m.WakeBoundary();self.assertFalse(gate.wake('before'))
        model=Model();gate.load(lambda:model);self.assertTrue(gate.wake('one'));self.assertFalse(gate.wake('duplicate'))
        self.assertTrue(gate.consume());self.assertFalse(gate.consume());self.assertFalse(gate.wake('one'))
        self.assertTrue(gate.wake('two'));gate.close();self.assertTrue(model.closed);self.assertFalse(gate.consume())
    def test_load_failure_never_arms(self):
        gate=m.WakeBoundary()
        def fail():raise ValueError('load failed')
        with self.assertRaises(ValueError):gate.load(fail)
        self.assertEqual(gate.state,'error');self.assertFalse(gate.wake('one'));gate.close()
    def test_whole_word_and_kws_json(self):
        for text in ['Kural','குரல் அடுத்து','say KURAL please']:self.assertTrue(m.has_kural(text))
        for text in ['neural','kurals','குரல்கள்']:self.assertFalse(m.has_kural(text))
        self.assertEqual(len(m.detections('sherpa','log\n{"keyword":"KURAL","timestamps":[1.2]}')),1)
        self.assertEqual(m.detections('sherpa','{"keyword":"OTHER"}'),[])
    def fixture(self,root):
        exe=root/'cli.exe';exe.write_bytes(b'fixture-not-runtime')
        models=root/'models';models.mkdir();(models/m.WHISPER_MODEL).write_bytes(b'fixture-not-model')
        with wave.open(str(root/'sample.wav'),'wb') as w:w.setparams((1,2,16000,0,'NONE','not compressed'));w.writeframes(b'\0\0'*1600)
        dataset=root/'samples.csv';dataset.write_text('id,wav,expected_wakes,condition\npositive,sample.wav,1,quiet\n',encoding='utf-8')
        return exe,models,dataset
    def test_offline_metrics_and_timeout_cleanup(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);exe,models,dataset=self.fixture(root);calls=[]
            def runner(args,**kw):calls.append((args,kw));return subprocess.CompletedProcess(args,0,'குரல்','')
            report=m.benchmark('whisper',exe,models,dataset,root/'out',runner=runner)
            self.assertEqual(report['summary']['missed_wake_clips'],0);self.assertEqual(report['provider_requests'],0)
            self.assertEqual(calls[0][1]['timeout'],60);self.assertIn('--no-gpu',calls[0][0])
            def timeout(*a,**kw):raise subprocess.TimeoutExpired('fixture',60)
            report=m.benchmark('whisper',exe,models,dataset,root/'failed',runner=timeout)
            self.assertEqual(report['results'][0]['status'],'engine_failed')
            self.assertTrue((root/'failed/results.json').exists())
    def test_missing_artifact_prevents_inference_and_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);exe,models,dataset=self.fixture(root);(models/m.WHISPER_MODEL).unlink()
            with self.assertRaises(ValueError):m.benchmark('whisper',exe,models,dataset,root/'out',runner=lambda *a,**kw:self.fail('must not execute'))
            self.assertFalse((root/'out').exists())
    def test_sherpa_first_candidate_uses_exact_int8_artifacts(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);exe,models,dataset=self.fixture(root)
            for name in m.SHERPA_FILES.values():(models/name).write_bytes(b'fixture')
            (models/'tokens.txt').write_text('fixture',encoding='utf-8')
            keywords=root/'keywords.txt';keywords.write_text('fixture @KURAL',encoding='utf-8')
            calls=[]
            def runner(args,**kw):
                calls.append(args)
                return subprocess.CompletedProcess(args,0,'{"keyword":"KURAL","timestamps":[0.05]}','')
            result=m.benchmark('sherpa',exe,models,dataset,root/'first',keywords,runner=runner)
            self.assertEqual(result['results'][0]['detected_wakes'],1)
            self.assertEqual(len(calls),1)
            self.assertTrue(all(any(name in arg for arg in calls[0]) for name in m.SHERPA_FILES.values()))
            self.assertEqual(result['provider_requests'],0)
