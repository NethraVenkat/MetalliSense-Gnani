"""Explicit isolated Whisper setup/benchmark; no capture, upload or cloud STT."""
import argparse
import csv
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import re
from urllib.parse import urlsplit, urlunsplit
import urllib.request
import uuid
import zipfile

from local_kural_benchmark import benchmark, digest

ROOT = Path(__file__).resolve().parent / 'local_wake_data'
DEST = ROOT / 'whisper-tiny-q5_1-v1.8.3'
FILES = [
    ('runtime.zip', 'https://github.com/ggml-org/whisper.cpp/releases/download/v1.8.3/whisper-bin-x64.zip', 'sha256', 'd824b1e37599f882b396e73f1ee0bfd5d0529f700314c48311dcbd00b803321d'),
    ('ggml-tiny-q5_1.bin', 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny-q5_1.bin', 'sha1', '2827a03e495b1ed3048ef28a6a4620537db4ee51'),
    ('LICENSE-whisper-cpp.txt', 'https://raw.githubusercontent.com/ggml-org/whisper.cpp/v1.8.3/LICENSE', None, None),
    ('LICENSE-OpenAI-Whisper.txt', 'https://raw.githubusercontent.com/openai/whisper/main/LICENSE', None, None),
    ('MODEL-CARD.md', 'https://huggingface.co/ggerganov/whisper.cpp/raw/main/README.md', None, None),
]
CLIPS = [
    'smoke-P01-20261102-01/P01_take01.wav',
    'smoke-P02-P03-20261102-01/P02_take01.wav',
    'smoke-P02-P03-20261102-01/P03_take01.wav',
    'P02-takes02-04-20261102-01/P02_take02.wav',
    'P02-takes02-04-20261102-01/P02_take03.wav',
    'P02-takes02-04-20261102-01/P02_take04.wav',
]


def fetch(url, path):
    request = urllib.request.Request(url, headers={'User-Agent': 'MetalliSense-Kural-Local-Benchmark/1.0'})
    # One attempt. Unique partial files survive interruptions; no TLS bypass.
    with urllib.request.urlopen(request, timeout=120) as response, path.open('xb') as target:
        while chunk := response.read(1024 * 1024):
            target.write(chunk)


def valid(path, algorithm, expected):
    if not path.is_file() or not path.stat().st_size:
        return False
    if algorithm:
        return hashlib.new(algorithm, path.read_bytes()).hexdigest() == expected
    text = path.read_text(encoding='utf-8')
    return ('license: mit' in text.lower() if path.name.startswith('MODEL-CARD')
            else 'MIT License' in text and 'Permission is hereby granted' in text)


def failure_details(error):
    def safe(value):
        def redact(match):
            url = urlsplit(match.group())
            return urlunsplit((url.scheme, url.hostname or '', url.path, '', ''))
        return re.sub(r'https?://[^\s<>"\x27]+', redact, str(value))[:2000]
    detail = dict(error_type=type(error).__name__, error=safe(error),
                  reason=safe(getattr(error, 'reason', '')), provider_requests=0)
    detail.update(getattr(error, 'download_context', {}))
    return detail


def setup(dest=DEST, download=False, fetcher=fetch, runner=subprocess.run):
    dest = Path(dest).resolve()
    dest.mkdir(parents=True, exist_ok=True)
    records = []
    for name, url, algorithm, expected in FILES:
        target = dest / name
        if target.exists() and not valid(target, algorithm, expected):
            raise ValueError('Existing artifact invalid; preserved: ' + name)
        if not target.exists():
            # A fully received but not installed checksum-verified partial is reusable.
            reusable = next((p for p in dest.glob(name + '.*.partial')
                             if algorithm and valid(p, algorithm, expected)), None)
            if reusable is None:
                if not download:
                    raise ValueError('Missing artifact; explicit --download required: ' + name)
                reusable = dest / (name + '.' + uuid.uuid4().hex + '.partial')
                try:
                    fetcher(url, reusable)
                except Exception as error:
                    # Record the public requested URL, never a signed redirect URL.
                    error.download_context = dict(artifact=name, requested_url=url,
                        partial_file=str(reusable), partial_exists=reusable.is_file(),
                        saved_bytes=reusable.stat().st_size if reusable.is_file() else 0)
                    raise
                if not valid(reusable, algorithm, expected):
                    raise ValueError('Downloaded artifact invalid; partial preserved: ' + name)
            # Keep the partial as evidence, never overwrite an existing target.
            with target.open('xb') as output:
                output.write(reusable.read_bytes())
        records.append(dict(file=name, url=url, bytes=target.stat().st_size,
                            sha256=digest(target), published_algorithm=algorithm,
                            published_digest=expected))
    runtime = dest / 'runtime'
    with zipfile.ZipFile(dest / 'runtime.zip') as archive:
        pending = []
        for member in archive.infolist():
            path = (runtime / member.filename).resolve()
            if not path.is_relative_to(runtime) or member.external_attr >> 16 & 0o170000 == 0o120000:
                raise ValueError('Unsafe runtime archive member')
            if member.is_dir():
                continue
            data = archive.read(member)  # CRC validation before reuse/extraction
            if path.exists() and path.read_bytes() != data:
                raise ValueError('Existing runtime differs; preserved: ' + member.filename)
            pending.append((path, data))
        for path, data in pending:
            if not path.exists():
                path.parent.mkdir(parents=True, exist_ok=True)
                with path.open('xb') as output:
                    output.write(data)
    executables = list(runtime.rglob('whisper-cli.exe'))
    if len(executables) != 1:
        raise ValueError('Expected one whisper-cli.exe')
    result = runner([str(executables[0]), '--help'], capture_output=True,
                    text=True, encoding='utf-8', errors='replace', timeout=30)
    help_text = result.stdout + result.stderr
    if result.returncode != 0 or not all(flag in help_text for flag in ['--language', '--no-gpu', '--no-timestamps']):
        raise ValueError('CLI load/options validation failed: ' + help_text[-2000:])
    record = dict(runtime='whisper.cpp v1.8.3 CPU x64', model='multilingual tiny Q5_1',
                  files=records, executable=str(executables[0]), executable_sha256=digest(executables[0]),
                  extracted_bytes=sum(p.stat().st_size for p in runtime.rglob('*') if p.is_file()),
                  runtime_members=[str(p.relative_to(runtime)) for p in runtime.rglob('*') if p.is_file()],
                  provider_requests=0, help=help_text)
    # Fresh journal per verification, preserving previous completed manifests.
    journal = dest / ('setup-' + uuid.uuid4().hex + '.json')
    journal.write_text(json.dumps(record, indent=2), encoding='utf-8')
    return record


def run_benchmark(record, dest=DEST, recordings=ROOT):
    dest = Path(dest)
    run = dest / ('run-' + uuid.uuid4().hex)
    run.mkdir()
    rows = []
    for relative in CLIPS:
        source = Path(recordings) / relative
        target = run / source.name
        shutil.copy2(source, target)
        assert digest(source) == digest(target)
        rows.append(dict(id=source.stem, wav=target.name, expected_wakes=1,
                         condition='existing prompted positive; human listening annotation pending'))
    with (run / 'samples.csv').open('w', newline='', encoding='utf-8') as output:
        writer = csv.DictWriter(output, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    report = benchmark('whisper', record['executable'], dest, run / 'samples.csv', run / 'results')
    (run / 'settings.json').write_text(json.dumps(record, indent=2), encoding='utf-8')
    print(str(run))
    print(json.dumps(report['summary'], indent=2))
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--download', action='store_true')
    parser.add_argument('--benchmark', action='store_true')
    args = parser.parse_args()
    if not args.download and not args.benchmark:
        print('Disabled; no downloads or inference.')
    else:
        try:
            record = setup(download=args.download)
            if args.benchmark:
                run_benchmark(record)
        except Exception as error:
            DEST.mkdir(parents=True, exist_ok=True)
            detail = failure_details(error)
            (DEST / ('failure-' + uuid.uuid4().hex + '.json')).write_text(json.dumps(detail, indent=2), encoding='utf-8')
            print(json.dumps(detail, indent=2))
            raise SystemExit(1)
