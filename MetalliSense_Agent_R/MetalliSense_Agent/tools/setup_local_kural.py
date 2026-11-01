"""Explicit local setup for first candidate only. No inference or cloud STT."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tarfile
import urllib.request

ROOT=Path(__file__).resolve().parent/'local_wake_data/sherpa-2.0.1'
MODEL='sherpa-onnx-kws-zipformer-gigaspeech-3.3M-2024-01-01'
RUNTIME='sherpa-onnx-v2.0.1-win-x64-shared-MT-Release-no-tts.tar.bz2'
RUNTIME_SHA='a644dfe2f7944afec9a356d2557c0452380f20ffcf2f8c704653cfce37558596'

def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for data in iter(lambda:f.read(1024*1024),b''):h.update(data)
    return h.hexdigest()

def download(url,path):
    request=urllib.request.Request(url,headers={'User-Agent':'MetalliSense-Kural-Local-Benchmark-Setup/1.0'})
    with urllib.request.urlopen(request,timeout=120) as response,path.open('xb') as target:
        while data:=response.read(1024*1024):target.write(data)

def extract(archive,root,verify_only=False):
    """Verify all existing members first, then extract missing regular files only."""
    root=Path(root).resolve()
    with tarfile.open(archive,'r:bz2') as tar:
        members=tar.getmembers()
        for member in members:
            dest=(root/member.name).resolve()
            if not dest.is_relative_to(root) or not (member.isfile() or member.isdir()):
                raise ValueError('Unsafe archive member')
            if dest.exists():
                if member.isdir() and not dest.is_dir():raise ValueError('Archive directory conflict')
                if member.isfile():
                    if not dest.is_file():raise ValueError('Archive file conflict')
                    expected=hashlib.sha256(tar.extractfile(member).read()).hexdigest()
                    if dest.stat().st_size!=member.size or sha(dest)!=expected:
                        raise ValueError('Existing extracted artifact differs from archive: '+member.name)
        if verify_only:return [member.name for member in members if not (root/member.name).exists()]
        for member in members:
            dest=root/member.name
            if member.isdir():dest.mkdir(parents=True,exist_ok=True)
            elif not dest.exists():
                dest.parent.mkdir(parents=True,exist_ok=True)
                with dest.open('xb') as target:target.write(tar.extractfile(member).read())

DEPENDENCIES=['sherpa-onnx==2.0.1','click','sentencepiece','pypinyin==0.55.0']
PROBE = """import importlib, importlib.metadata as m, json, sys
names={'sherpa-onnx':'sherpa_onnx.cli','click':'click','sentencepiece':'sentencepiece','pypinyin':'pypinyin'}
versions={}; missing=[]; import_errors=[]
for package,module in names.items():
 try:
  versions[package]=m.version(package)
 except m.PackageNotFoundError:
  missing.append(package);continue
 try:importlib.import_module(module)
 except Exception:import_errors.append(package)
print(json.dumps({'prefix':sys.prefix,'versions':versions,'missing':missing,'import_errors':import_errors}))
"""

def probe_tokenizer(tokenizer,runner):
    result=runner([str(tokenizer/'Scripts/python.exe'),'-c',PROBE],check=True,capture_output=True,text=True)
    data=json.loads(result.stdout)
    if Path(data['prefix']).resolve()!=tokenizer.resolve():raise ValueError('Wrong tokenizer environment prefix')
    return data

def validate_keywords(path,models):
    lines=[line.split() for line in path.read_text(encoding='utf-8-sig').splitlines() if line.strip()]
    if len(lines)!=1 or lines[0][-1]!='@KURAL':raise ValueError('Expected one labelled KURAL keyword')
    pieces=lines[0][:-1]
    vocabulary={line.rsplit(maxsplit=1)[0] for line in (models/'tokens.txt').read_text(encoding='utf-8').splitlines() if line.strip()}
    if not pieces or any(piece not in vocabulary for piece in pieces):raise ValueError('Unknown keyword token')
    if ''.join(pieces).replace(chr(0x2581),'').strip()!='KURAL':raise ValueError('Keyword tokens do not reconstruct KURAL')

def setup(root=ROOT,fetch=download,runner=subprocess.run,resume=False,allow_download=True):
    root=Path(root).resolve()
    if root.exists():
        if not resume:raise FileExistsError('Setup exists; use --resume to validate and continue')
    else:
        if resume:raise ValueError('Resume directory missing')
        root.mkdir(parents=True,exist_ok=False)
    manifest=root/'artifacts.json'
    previous=None
    if manifest.exists():
        previous=json.loads(manifest.read_text(encoding='utf-8-sig'))
        if previous.get('runtime')!='sherpa-onnx 2.0.1' or previous.get('model')!=MODEL or not previous.get('files'):
            raise ValueError('Invalid completed setup manifest')
        for item in previous['files']:
            path=Path(item['path']).resolve()
            if not path.is_relative_to(root) or path.stat().st_size!=item['bytes'] or sha(path)!=item['sha256']:raise ValueError('Completed setup manifest artifact mismatch')
    runtime=root/RUNTIME;model_archive=root/(MODEL+'.tar.bz2')
    for path,url in [(runtime,'https://github.com/k2-fsa/sherpa-onnx/releases/download/v2.0.1/'+RUNTIME),
                     (model_archive,'https://github.com/k2-fsa/sherpa-onnx/releases/download/kws-models/'+MODEL+'.tar.bz2')]:
        if not path.exists():
            if not allow_download:raise ValueError('Missing archive; --resume --download permits fetching only missing files')
            fetch(url,path)
        if path==runtime and sha(runtime)!=RUNTIME_SHA:raise ValueError('Official runtime digest mismatch')
    for archive in [runtime,model_archive]:extract(archive,root)
    models=root/MODEL
    card=(models/'README.md').read_text(encoding='utf-8')
    if 'Apache' not in card or '2.0' not in card:raise ValueError('Model-specific Apache-2.0 notice missing; stop')
    runtime_root=root/RUNTIME.removesuffix('.tar.bz2')
    notices=[p for p in runtime_root.rglob('*') if p.is_file() and p.name.upper().startswith(('LICENSE','COPYING','NOTICE'))]
    # This official Windows archive omits LICENSE/NOTICE. Its published digest
    # anchors identity; retain explicit upstream license evidence in the manifest.
    executables=list(runtime_root.rglob('sherpa-onnx-keyword-spotter.exe'))
    if len(executables)!=1:raise ValueError('Expected exactly one native KWS executable')
    required=[models/(part+'-epoch-12-avg-2-chunk-16-left-64.int8.onnx') for part in ['encoder','decoder','joiner']]
    required += [models/'tokens.txt',models/'bpe.model']
    if any(not p.is_file() or not p.stat().st_size for p in required):raise ValueError('Required model artifact missing or empty')
    raw=root/'keywords_raw.txt';keywords=root/'keywords.txt'
    if raw.exists() and raw.read_text(encoding='utf-8-sig').strip()!='KURAL @KURAL':raise ValueError('Existing raw keyword differs; preserved')
    if keywords.exists():validate_keywords(keywords,models)
    tokenizer=root/'tokenizer-venv'
    if not tokenizer.exists():
        if not allow_download:raise ValueError('Tokenizer environment missing; use --resume --download')
        runner([sys.executable,'-m','venv',str(tokenizer)],check=True)
    if not (tokenizer/'pyvenv.cfg').is_file() or not (tokenizer/'Scripts/python.exe').is_file():raise ValueError('Invalid tokenizer environment; preserved for inspection')
    probe=probe_tokenizer(tokenizer,runner)
    missing=list(probe['missing'])
    for package,version in [('sherpa-onnx','2.0.1'),('pypinyin','0.55.0')]:
        if package in probe['versions'] and probe['versions'][package]!=version:raise ValueError('Unexpected installed '+package+' version; will not overwrite')
    if missing:
        if not allow_download:raise ValueError('Missing tokenizer dependencies: '+', '.join(missing)+'; use --resume --download to install missing packages')
        needed=[dep for dep in DEPENDENCIES if dep.split('==')[0] in missing]
        runner([str(tokenizer/'Scripts/python.exe'),'-m','pip','install','--only-binary=:all:',*needed],check=True)
        probe=probe_tokenizer(tokenizer,runner)
        if probe['missing']:raise ValueError('Tokenizer dependencies still unavailable')
        if probe['versions'].get('sherpa-onnx')!='2.0.1' or probe['versions'].get('pypinyin')!='0.55.0':raise ValueError('Installed tokenizer versions do not match requested versions')
    if probe.get('import_errors'):raise ValueError('Tokenizer import validation failed: '+', '.join(probe['import_errors']))
    cli=tokenizer/'Scripts/sherpa-onnx-cli.exe'
    if not cli.is_file():raise ValueError('Tokenizer CLI entry point missing')
    if raw.exists():
        if raw.read_text(encoding='utf-8-sig').strip()!='KURAL @KURAL':raise ValueError('Existing raw keyword differs; preserved')
    else:
        with raw.open('x',encoding='utf-8') as target:target.write('KURAL @KURAL\n')
    if keywords.exists():validate_keywords(keywords,models)
    else:
        import uuid
        pending=root/('keywords-'+uuid.uuid4().hex+'.pending.txt')
        runner([str(cli),'text2token','--tokens',str(models/'tokens.txt'),'--tokens-type','bpe','--bpe-model',str(models/'bpe.model'),str(raw),str(pending)],check=True)
        validate_keywords(pending,models)
        with keywords.open('xb') as target:target.write(pending.read_bytes())
        # Pending output retained as evidence, not deleted or overwritten.
    files=[runtime,model_archive,executables[0],keywords,raw,models/'README.md',*required,*notices]
    record=dict(runtime='sherpa-onnx 2.0.1',model=MODEL,executable=str(executables[0]),models=str(models),keywords=str(keywords),
                runtime_license=dict(spdx='Apache-2.0',source='https://github.com/k2-fsa/sherpa-onnx/blob/v2.0.1/LICENSE',bundled_notices=len(notices),note='Retain upstream LICENSE and third-party notices when redistributing'),
                inference='not run',tokenizer_versions=probe['versions'],files=[dict(path=str(p),bytes=p.stat().st_size,sha256=sha(p)) for p in files])
    if previous is not None:
        return previous
    versions=runner([str(tokenizer/'Scripts/python.exe'),'-m','pip','freeze'],check=True,capture_output=True,text=True)
    version_path=root/'tokenizer-versions.txt'
    if not version_path.exists():
        with version_path.open('x',encoding='utf-8') as target:target.write(versions.stdout)
    with manifest.open('x',encoding='utf-8') as target:json.dump(record,target,indent=2)
    return record

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--download',action='store_true')
    parser.add_argument('--resume',action='store_true',help='Validate and resume existing setup; no downloads/install unless --download is also set')
    args=parser.parse_args()
    if not args.download and not args.resume:print('Disabled. No downloads, installation, model loading or inference.')
    else:
        record=setup(resume=args.resume,allow_download=args.download)
        print('First candidate only. Exact local sizes/hashes: '+str(ROOT/'artifacts.json'))
        print('No tour integration or second model was run.')
