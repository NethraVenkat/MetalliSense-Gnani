"""Consent-gated, one-request embedding builder. Never prints provider payloads."""
import argparse
import io
import json
import shutil
import subprocess
import sys
import wave
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app.copilot import voice_clone as clone


def prepare_audio(path):
    path = Path(path)
    if path.suffix.lower() not in ('.wav','.m4a','.mp4'):
        raise ValueError('unsupported_audio_format')
    if path.suffix.lower() == '.wav':
        try:
            with wave.open(str(path),'rb') as source:
                if source.getnchannels()==1 and source.getsampwidth()==2 and source.getframerate()==16000:
                    audio=path.read_bytes()
                else: audio=None
        except (wave.Error,EOFError): audio=None
    else: audio=None
    if audio is None:
        binary=shutil.which('ffmpeg')
        if not binary:
            import imageio_ffmpeg
            binary=imageio_ffmpeg.get_ffmpeg_exe()
        result=subprocess.run([binary,'-v','error','-i',str(path),'-t','31','-ac','1','-ar','16000',
                               '-c:a','pcm_s16le','-f','wav','pipe:1'],capture_output=True,check=True)
        # Pipe WAV lengths may be placeholders: rewrite a normal seekable WAV.
        with wave.open(io.BytesIO(result.stdout),'rb') as source:
            pcm=source.readframes(16000*31)
        target=io.BytesIO()
        with wave.open(target,'wb') as dest:
            dest.setnchannels(1);dest.setsampwidth(2);dest.setframerate(16000);dest.writeframes(pcm)
        audio=target.getvalue()
    with wave.open(io.BytesIO(audio),'rb') as source:
        duration=source.getnframes()/source.getframerate()
    if not 5<=duration<=30:
        raise ValueError('reference_duration_must_be_5_to_30_seconds')
    return audio


def make_embedding(audio_path,out,client):
    if not clone.consented(): raise ValueError('consent_required')
    name=Path(out).name
    if name not in ('embedding','embedding_en','embedding_hi','embedding_ta','embedding.json','embedding_en.json','embedding_hi.json','embedding_ta.json') or str(out)!=name:
        raise ValueError('invalid_output_name')
    audio=prepare_audio(audio_path)
    if client.mock or not client.api_key: raise ValueError('live_api_key_required')
    import requests
    try:
        response=requests.post(client.base_url+'/api/v1/tts/voice-clone/embeddings',headers=client._headers(),
                               files={'audio_file':('reference.wav',audio,'audio/wav')},timeout=60)
        if response.status_code!=200: raise ValueError('embedding_request_failed')
        value=clone.embedding_object(response.json()['data']['voice_clone_embedding'])
    except Exception:
        raise ValueError('embedding_request_failed') from None
    target=clone.CLONE_DIR/(name if name.endswith('.json') else name+'.json')
    target.parent.mkdir(parents=True,exist_ok=True)
    temporary=target.with_suffix('.json.tmp')
    temporary.write_text(json.dumps(value),encoding='utf-8');temporary.replace(target)
    return target


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--audio',required=True);parser.add_argument('--out',required=True)
    args=parser.parse_args()
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parents[1]/'.env')
    from app.copilot.gnani_client import GnaniClient
    try:
        make_embedding(args.audio,args.out,GnaniClient())
    except Exception:
        print('Embedding not created; check consent, audio format/duration and service availability.',file=sys.stderr)
        return 1
    print('Embedding saved privately.')
    return 0


if __name__=='__main__': sys.exit(main())
