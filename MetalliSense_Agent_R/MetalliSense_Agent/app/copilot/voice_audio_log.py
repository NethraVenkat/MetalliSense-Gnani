"""Local WAV evidence; secret captures are refused even if a client mislabels them."""
import datetime as dt,io,json,os,re,shutil,threading,wave,zipfile
from .voice_audit import data_root,day,today,LOCK
class AudioLog:
    def folder(self,date):return data_root()/'voice_audio'/day(date)
    def store(self,audio,event_id,session,purpose='command',no_store=False,sensitive=False):
        if no_store or sensitive or purpose not in ('wake','command'):return {'stored':False}
        if not re.fullmatch(r'[a-zA-Z0-9_-]{8,100}',event_id):raise ValueError('Invalid event ID')
        with wave.open(io.BytesIO(audio)) as w:
            frames=w.getnframes()
            if (w.getnchannels(),w.getsampwidth(),w.getframerate(),w.getcomptype())!=(1,2,16000,'NONE') or not 0<frames<=960000 or len(w.readframes(frames))!=frames*2:raise ValueError('Expected complete mono PCM16 16kHz WAV')
        import hashlib
        with LOCK:
            folder=self.folder(today());folder.mkdir(parents=True,exist_ok=True);p=folder/(event_id+'.wav');meta=folder/(event_id+'.json')
            if p.exists() or meta.exists():raise ValueError('Audio event exists')
            record={'event_id':event_id,'session_id':session,'date':today(),'purpose':purpose,'duration':frames/16000,'sha256':hashlib.sha256(audio).hexdigest()}
            with p.open('xb') as out:out.write(audio)
            with meta.open('x',encoding='utf-8') as out:json.dump(record,out)
            return {'stored':True,**record}
    def listing(self,date,session):
        folder=self.folder(date)
        if folder.is_symlink():raise ValueError('Invalid audio path')
        return [r for p in folder.glob('*.json') if not p.is_symlink() for r in [json.loads(p.read_text())] if r['session_id']==session]
    def file(self,date,event,session):
        if not re.fullmatch(r'[a-zA-Z0-9_-]{8,100}',event):raise ValueError('Invalid event ID')
        if not any(r['event_id']==event for r in self.listing(date,session)):raise FileNotFoundError()
        p=self.folder(date)/(event+'.wav')
        if p.is_symlink():raise ValueError('Invalid audio path')
        return p
    def delete(self,date):
        p=self.folder(date)
        if p.exists():
            if p.is_symlink():raise ValueError('Invalid audio path')
            shutil.rmtree(p)
    def purge(self):
        days=max(1,int(os.getenv('VOICE_AUDIO_RETENTION_DAYS','7')));cut=dt.date.fromisoformat(today())-dt.timedelta(days=days)
        for p in (data_root()/'voice_audio').glob('*'):
            try:
                if p.is_dir() and not p.is_symlink() and dt.date.fromisoformat(p.name)<cut:self.delete(p.name)
            except ValueError:continue
    def export(self,date,session):
        out=io.BytesIO()
        with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
            for row in self.listing(date,session):
                p=self.file(date,row['event_id'],session);z.write(p,p.name);z.writestr(row['event_id']+'.json',json.dumps(row))
        return out.getvalue()
AUDIO=AudioLog()
