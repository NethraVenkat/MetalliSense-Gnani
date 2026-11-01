import importlib.util
import io
import json
from pathlib import Path
import subprocess
import tarfile
import tempfile
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('setup_resume',Path(__file__).parents[1]/'tools/setup_local_kural.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

def archive(files):
    output=io.BytesIO()
    with tarfile.open(fileobj=output,mode='w:bz2') as tar:
        for name,data in files.items():
            member=tarfile.TarInfo(name);member.size=len(data);tar.addfile(member,io.BytesIO(data))
    return output.getvalue()

class Environment:
    def __init__(self,root):
        self.root=root;self.calls=[];self.fetches=[];self.fail_tokens=False
        self.versions={};self.tokenizer=root/'tokenizer-venv'
        runtime=m.RUNTIME.removesuffix('.tar.bz2')
        self.runtime=archive({runtime+'/bin/sherpa-onnx-keyword-spotter.exe':b'fake-exe',runtime+'/LICENSE':b'Apache License 2.0'})
        files={'README.md':b'license: Apache License 2.0','tokens.txt':((chr(0x2581)+'KU 1\nR 2\nAL 3\n').encode()),'bpe.model':b'fake-bpe'}
        for part in ['encoder','decoder','joiner']:files[part+'-epoch-12-avg-2-chunk-16-left-64.int8.onnx']=b'fake-onnx'
        self.model=archive({m.MODEL+'/'+k:v for k,v in files.items()})
    def fetch(self,url,path):
        self.fetches.append(url);path.write_bytes(self.runtime if path.name==m.RUNTIME else self.model)
    def runner(self,args,**kwargs):
        self.calls.append(args)
        stdout=''
        if args[1:3]==['-m','venv']:
            (self.tokenizer/'Scripts').mkdir(parents=True)
            (self.tokenizer/'pyvenv.cfg').write_text('fixture')
            for name in ['python.exe','sherpa-onnx-cli.exe']:(self.tokenizer/'Scripts'/name).write_bytes(b'fixture')
        elif args[1:3]==['-c',m.PROBE]:
            names=['sherpa-onnx','click','sentencepiece','pypinyin']
            stdout=json.dumps(dict(prefix=str(self.tokenizer),versions=self.versions,missing=[n for n in names if n not in self.versions]))
        elif args[1:4]==['-m','pip','install']:
            for dep in args[5:]:
                name=dep.split('==')[0];self.versions[name]=dep.split('==')[1] if '==' in dep else 'fixture-version'
        elif args[1]=='text2token':
            if self.fail_tokens:raise subprocess.CalledProcessError(1,args)
            Path(args[-1]).write_text(chr(0x2581)+'KU R AL @KURAL\n',encoding='utf-8')
        elif args[1:4]==['-m','pip','freeze']:stdout='fixture dependencies\n'
        else:raise AssertionError(args)
        return subprocess.CompletedProcess(args,0,stdout,'')
    def setup(self,**kwargs):
        with patch.object(m,'RUNTIME_SHA',__import__('hashlib').sha256(self.runtime).hexdigest()):
            return m.setup(self.root,fetch=self.fetch,runner=self.runner,**kwargs)

class SetupTests(unittest.TestCase):
    def test_fresh_and_completed_setup_reuse(self):
        with tempfile.TemporaryDirectory() as tmp:
            env=Environment(Path(tmp)/'setup');result=env.setup()
            self.assertEqual(len(env.fetches),2)
            self.assertTrue(any('pypinyin==0.55.0' in c for c in env.calls))
            before=(env.root/'artifacts.json').read_bytes();env.calls.clear();env.fetches.clear()
            self.assertEqual(env.setup(resume=True,allow_download=False),result)
            self.assertEqual(env.fetches,[])
            self.assertEqual(len(env.calls),1) # Validate imports/versions only.
            self.assertEqual((env.root/'artifacts.json').read_bytes(),before)
    def partial(self,tmp):
        env=Environment(Path(tmp)/'setup');env.fail_tokens=True
        with self.assertRaises(subprocess.CalledProcessError):env.setup()
        self.assertFalse((env.root/'artifacts.json').exists())
        env.fail_tokens=False;env.calls.clear();env.fetches.clear();return env
    def test_partial_resume_tokenizes_without_download_or_install(self):
        with tempfile.TemporaryDirectory() as tmp:
            env=self.partial(tmp);archive_before=(env.root/m.RUNTIME).read_bytes()
            env.setup(resume=True,allow_download=False)
            self.assertEqual(env.fetches,[])
            self.assertFalse(any(c[1:4]==['-m','pip','install'] for c in env.calls))
            self.assertTrue(any(c[1]=='text2token' for c in env.calls))
            self.assertEqual((env.root/m.RUNTIME).read_bytes(),archive_before)
    def test_missing_dependency_requires_explicit_download_and_installs_only_missing(self):
        with tempfile.TemporaryDirectory() as tmp:
            env=self.partial(tmp);del env.versions['pypinyin']
            with self.assertRaisesRegex(ValueError,'pypinyin'):env.setup(resume=True,allow_download=False)
            self.assertFalse((env.root/'artifacts.json').exists())
            env.calls.clear();env.setup(resume=True,allow_download=True)
            installs=[c for c in env.calls if c[1:4]==['-m','pip','install']]
            self.assertEqual(installs[0][5:],['pypinyin==0.55.0']);self.assertEqual(env.fetches,[])
    def test_invalid_existing_extraction_or_keyword_is_not_overwritten(self):
        for target in ['model','keyword','archive']:
            with tempfile.TemporaryDirectory() as tmp:
                env=self.partial(tmp)
                path=env.root/m.MODEL/'tokens.txt' if target=='model' else env.root/'keywords.txt' if target=='keyword' else env.root/m.RUNTIME
                path.write_bytes(b'bad-existing-artifact')
                with self.assertRaises(ValueError):env.setup(resume=True,allow_download=False)
                self.assertEqual(path.read_bytes(),b'bad-existing-artifact');self.assertEqual(env.fetches,[])
                self.assertFalse((env.root/'artifacts.json').exists())
    def test_missing_extracted_file_is_restored_from_valid_archive_only(self):
        with tempfile.TemporaryDirectory() as tmp:
            env=self.partial(tmp);path=env.root/m.MODEL/'bpe.model';path.unlink()
            env.setup(resume=True,allow_download=False)
            self.assertEqual(path.read_bytes(),b'fake-bpe');self.assertEqual(env.fetches,[])
    def test_completed_setup_corruption_stops_before_dependency_actions(self):
        with tempfile.TemporaryDirectory() as tmp:
            env=Environment(Path(tmp)/'setup');env.setup();env.calls.clear();env.fetches.clear()
            path=env.root/m.MODEL/'bpe.model';path.write_bytes(b'changed')
            with self.assertRaises(ValueError):env.setup(resume=True,allow_download=False)
            self.assertEqual(env.calls,[]);self.assertEqual(env.fetches,[]);self.assertEqual(path.read_bytes(),b'changed')
    def test_invalid_generated_tokens_never_create_completion_manifest(self):
        with tempfile.TemporaryDirectory() as tmp:
            env=self.partial(tmp);original=env.runner
            def invalid(args,**kwargs):
                if args[1]=='text2token':
                    Path(args[-1]).write_text('UNKNOWN @KURAL',encoding='utf-8')
                    return subprocess.CompletedProcess(args,0,'','')
                return original(args,**kwargs)
            env.runner=invalid
            with self.assertRaises(ValueError):env.setup(resume=True,allow_download=False)
            self.assertFalse((env.root/'artifacts.json').exists());self.assertFalse((env.root/'keywords.txt').exists())
