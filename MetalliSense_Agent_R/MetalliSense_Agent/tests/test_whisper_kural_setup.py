import hashlib
import importlib.util
import io
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import zipfile
import json
import wave
import urllib.error

TOOLS = Path(__file__).parents[1] / 'tools'
sys.path.insert(0, str(TOOLS))
import setup_whisper_kural as ws
import local_kural_benchmark as bench


class WhisperSetupTests(unittest.TestCase):
    def artifacts(self):
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, 'w') as z:
            z.writestr('bin/whisper-cli.exe', b'mock-executable')
        data = {'runtime.zip': buffer.getvalue(), 'ggml-tiny-q5_1.bin': b'mock-model',
                'LICENSE.txt': b'MIT License\nPermission is hereby granted'}
        specs = [(name, 'https://official.invalid/' + name, 'sha256' if name != 'LICENSE.txt' else None,
                  hashlib.sha256(value).hexdigest() if name != 'LICENSE.txt' else None)
                 for name, value in data.items()]
        return data, specs

    def runner(self, args, **kwargs):
        self.assertEqual(kwargs['timeout'], 30)
        return subprocess.CompletedProcess(args, 0, '', '--language --no-gpu --no-timestamps')

    def test_validated_reuse_and_preserved_partials(self):
        data, specs = self.artifacts()
        with tempfile.TemporaryDirectory() as tmp, patch.object(ws, 'FILES', specs):
            root = Path(tmp)
            (root / 'runtime.zip.incomplete.partial').write_bytes(b'partial')
            calls = []
            def fetch(url, path):
                calls.append(url)
                path.write_bytes(data[url.rsplit('/', 1)[1]])
            first = ws.setup(root, True, fetch, self.runner)
            second = ws.setup(root, False, lambda *args: self.fail('must reuse'), self.runner)
            self.assertEqual(first['executable_sha256'], second['executable_sha256'])
            self.assertEqual(len(calls), 3)
            self.assertEqual((root / 'runtime.zip.incomplete.partial').read_bytes(), b'partial')
            (root / 'runtime/bin/whisper-cli.exe').write_bytes(b'changed')
            with self.assertRaisesRegex(ValueError, 'differs'):
                ws.setup(root, False, runner=self.runner)

    def test_checksum_failure_never_executes(self):
        _, specs = self.artifacts()
        with tempfile.TemporaryDirectory() as tmp, patch.object(ws, 'FILES', specs):
            with self.assertRaisesRegex(ValueError, 'invalid'):
                ws.setup(tmp, True, lambda url, path: path.write_bytes(b'bad'),
                         lambda *args, **kwargs: self.fail('must not execute'))
            self.assertTrue(list(Path(tmp).glob('*.partial')))
            self.assertFalse((Path(tmp) / 'runtime.zip').exists())

    def test_manually_placed_files_validate_without_network(self):
        data, specs = self.artifacts()
        with tempfile.TemporaryDirectory() as tmp, patch.object(ws, 'FILES', specs):
            root = Path(tmp)
            for name, value in data.items():
                (root / name).write_bytes(value)
            ws.setup(root, False, lambda *args: self.fail('no network'), self.runner)
            for name, value in data.items():
                self.assertEqual((root / name).read_bytes(), value)
            (root / 'runtime.zip').write_bytes(b'wrong manually placed file')
            with self.assertRaisesRegex(ValueError, 'Existing artifact invalid'):
                ws.setup(root, False, lambda *args: self.fail('no network'),
                         lambda *args, **kwargs: self.fail('no execution'))
            self.assertEqual((root / 'runtime.zip').read_bytes(), b'wrong manually placed file')

    def test_failure_captures_public_url_and_saved_bytes_without_secrets(self):
        _, specs = self.artifacts()
        for received in [False, True]:
            with tempfile.TemporaryDirectory() as tmp, patch.object(ws, 'FILES', specs):
                def fail(url, path):
                    if received:
                        path.write_bytes(b'part')
                    raise urllib.error.URLError('blocked https://user:secret@host.invalid/path?token=private')
                with self.assertRaises(urllib.error.URLError) as caught:
                    ws.setup(tmp, True, fail, lambda *args: self.fail('no execution'))
                detail = ws.failure_details(caught.exception)
                self.assertEqual(detail['requested_url'], specs[0][1])
                self.assertEqual(detail['artifact'], 'runtime.zip')
                self.assertEqual(detail['saved_bytes'], 4 if received else 0)
                self.assertEqual(detail['partial_exists'], received)
                for secret in ['secret', 'private', 'token=']:
                    self.assertNotIn(secret, json.dumps(detail))
                if received:
                    self.assertEqual(Path(detail['partial_file']).read_bytes(), b'part')

    def test_loading_failure_and_timeout_never_complete(self):
        data, specs = self.artifacts()
        for timeout in [False, True]:
            with tempfile.TemporaryDirectory() as tmp, patch.object(ws, 'FILES', specs):
                def runner(*args, **kwargs):
                    if timeout:
                        raise subprocess.TimeoutExpired('mock', 30)
                    return subprocess.CompletedProcess(args, 1, '', 'missing DLL')
                with self.assertRaises((ValueError, subprocess.TimeoutExpired)):
                    ws.setup(tmp, True, lambda url, path: path.write_bytes(data[url.rsplit('/', 1)[1]]), runner)
                self.assertFalse(list(Path(tmp).glob('setup-*.json')))

    def test_tamil_and_latin_preserved_without_suffix_matches(self):
        tamil = '\u0b95\u0bc1\u0bb0\u0bb2\u0bcd'
        self.assertEqual(bench.kural_matches(tamil + ' / KURAL'), [tamil, 'KURAL'])
        self.assertEqual(bench.detections('whisper', tamil)[0]['matched_text'], tamil)
        self.assertFalse(bench.has_kural(tamil + '\u0b95\u0bb3\u0bcd'))
        self.assertFalse(bench.has_kural('kurals'))

    def test_no_hint_translation_or_gpu_flags(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'cli.exe').write_bytes(b'mock')
            (root / bench.WHISPER_MODEL).write_bytes(b'mock')
            args, _ = bench.command('whisper', root / 'cli.exe', root, root / 'clip.wav')
            self.assertEqual(args[args.index('-l') + 1], 'ta')
            for forbidden in ['--prompt', '--translate', '-tr']:
                self.assertNotIn(forbidden, args)
            self.assertIn('--no-gpu', args)

    def test_failed_process_and_timeout_preserve_streams_stop_without_retry(self):
        for timeout in [False, True]:
            with tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                (root / 'cli.exe').write_bytes(b'mock')
                (root / bench.WHISPER_MODEL).write_bytes(b'mock')
                with wave.open(str(root / 'clip.wav'), 'wb') as audio:
                    audio.setparams((1, 2, 16000, 0, 'NONE', 'not compressed'))
                    audio.writeframes(b'\0\0' * 16000)
                (root / 'samples.csv').write_text('id,wav,expected_wakes\none,clip.wav,1\ntwo,clip.wav,1\n')
                calls = []
                def runner(args, **kwargs):
                    calls.append(args)
                    self.assertEqual(kwargs['timeout'], 60)
                    if timeout:
                        raise subprocess.TimeoutExpired(args, 60, output=b'partial', stderr=b'timeout detail')
                    raise subprocess.CalledProcessError(1, args, output='partial', stderr='load failed')
                report = bench.benchmark('whisper', root / 'cli.exe', root, root / 'samples.csv', root / 'out', runner=runner)
                self.assertEqual(len(calls), 1)
                self.assertEqual(report['results'][0]['status'], 'engine_failed')
                raw = json.loads((root / 'out/one-raw.json').read_text())
                self.assertEqual(raw['stdout'], 'partial')
                self.assertIn('detail' if timeout else 'failed', raw['stderr'])
