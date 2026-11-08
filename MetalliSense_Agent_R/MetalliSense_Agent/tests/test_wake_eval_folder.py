import asyncio
import csv
import struct
import pytest
from tools.kural_gnani_wake_test import wav_bytes
from tools.wake_eval_folder import prepare, evaluate


def source(tmp_path):
    folder = tmp_path / 'input'; folder.mkdir()
    pcm = b'\0\0' * 8000 + struct.pack('<h', 2000) * 3200 + b'\0\0' * 8000
    for name in ['wake_one.wav', 'conf_coral.wav', 'conv_talk.wav']:
        (folder / name).write_bytes(wav_bytes(pcm))
    return folder


def test_synthetic_labels_csv_and_no_network(tmp_path):
    rows = prepare(source(tmp_path))
    class Forbidden:
        async def check(self, audio):
            raise AssertionError('Dry run must never call checker')
    output = tmp_path / 'result'
    totals = asyncio.run(evaluate(rows, output, checker=Forbidden()))
    assert totals['actual_attempts'] == 0 and totals['planned_calls'] == 3
    records = list(csv.DictReader((output / 'results.csv').open()))
    assert [r['expected'] for r in records] == ['False', 'False', 'True']
    assert all(r['got'] == 'not_run' for r in records)
    assert len(list(output.glob('*.wav'))) == 3


def test_ceiling_before_output_or_calls(tmp_path):
    rows = prepare(source(tmp_path))
    with pytest.raises(ValueError, match='ceiling'):
        asyncio.run(evaluate(rows, tmp_path / 'result', live=True, max_calls=2))
    assert not (tmp_path / 'result').exists()


def test_live_sequential_mock_and_failure_stops(tmp_path):
    rows = prepare(source(tmp_path)); calls = []
    class Checker:
        async def check(self, audio):
            calls.append(audio)
            if len(calls) == 2:
                raise RuntimeError('mock failure')
            return {'wake': False}
    with pytest.raises(RuntimeError):
        asyncio.run(evaluate(rows, tmp_path / 'result', live=True, checker=Checker()))
    assert len(calls) == 2
    assert 'error' in (tmp_path / 'result/results.csv').read_text()


def test_unknown_label_rejected(tmp_path):
    folder = source(tmp_path)
    (folder / 'wake_one.wav').rename(folder / 'unknown.wav')
    with pytest.raises(ValueError, match='label'):
        prepare(folder)
