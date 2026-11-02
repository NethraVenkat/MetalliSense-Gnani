"""Generate an offline human-alignment page; no inference or source writes."""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import struct
import uuid
import wave


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def prepare(folder):
    folder = Path(folder).resolve()
    root = Path(__file__).resolve().parent / 'local_wake_data/kural-cnn-v1'
    folder.relative_to(root.resolve())
    report = json.loads((folder / 'review.json').read_text(encoding='utf-8'))
    session = root / 'live-diagnostics' / ('session-' + report['session'])
    for name, expected in report['preserved_session_hashes'].items():
        if Path(name).name != name or digest(session / name) != expected:
            raise ValueError('Original session hash mismatch: ' + name)
    audio = session / 'capture.wav'
    with wave.open(str(audio), 'rb') as wav:
        if (wav.getnchannels(), wav.getsampwidth(), wav.getframerate(), wav.getcomptype()) != (1, 2, 16000, 'NONE'):
            raise ValueError('Expected retained mono PCM16 16k WAV')
        count = wav.getnframes()
        pcm = wav.readframes(count)
    if len(pcm) != count * 2 or not count or digest(audio) != report['audio']['sha256']:
        raise ValueError('Incomplete or mismatched original audio')
    samples = struct.unpack('<' + str(count) + 'h', pcm)
    stride = max(1, (count + 799) // 800)
    peaks = [[min(samples[i:i+stride])/32768, max(samples[i:i+stride])/32768, i/count, min(i+stride,count)/count] for i in range(0, count, stride)]
    data = dict(session=report['session'], audio=dict(sha256=digest(audio), frames=count, sample_rate=16000, duration_seconds=count/16000),
                original_hashes=report['preserved_session_hashes'], events=report['events'], peaks=peaks,
                wav_base64=base64.b64encode(audio.read_bytes()).decode('ascii'))
    template = Path(__file__).with_name('kural_session_review.html').read_text(encoding='utf-8')
    page = template.replace('/*SESSION_DATA*/null', json.dumps(data, ensure_ascii=False).replace('<', '\\u003c'))
    token = uuid.uuid4().hex
    target = folder / 'index.html'
    if target.exists():
        (folder / ('index-before-' + token + '.html')).write_bytes(target.read_bytes())
    target.write_text(page, encoding='utf-8')
    (folder / ('page-generation-' + token + '.json')).write_text(json.dumps(dict(original_hashes=data['original_hashes'], template_sha256=digest(Path(__file__).with_name('kural_session_review.html')), page_sha256=digest(target)), indent=2)+'\n', encoding='utf-8')
    return target


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--review-directory', required=True)
    print(prepare(parser.parse_args().review_directory))
