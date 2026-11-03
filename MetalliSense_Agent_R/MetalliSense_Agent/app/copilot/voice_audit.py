"""Single-worker append-only daily SHA-256 chains; not an external trust anchor."""
import datetime as dt
import hashlib,json,os,re,threading
from pathlib import Path
from .voice_numbers import NUMBERS
LOCK=threading.RLock()
MASK='\u2022'*6
# Dictated digit aliases are shared with the browser grammar by a generated fixture.
DIGIT_GROUPS=[["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"], ["\u0baa\u0bc2\u0b9c\u0bcd\u0b9c\u0bbf\u0baf\u0bae\u0bcd|\u0b9c\u0bc0\u0bb0\u0bcb", "\u0b92\u0ba9\u0bcd\u0bb1\u0bc1|\u0b92\u0ba3\u0bcd\u0ba3\u0bc1|\u0b92\u0ba9\u0bcd\u0ba9\u0bc1", "\u0b87\u0bb0\u0ba3\u0bcd\u0b9f\u0bc1|\u0bb0\u0bc6\u0ba3\u0bcd\u0b9f\u0bc1", "\u0bae\u0bc2\u0ba9\u0bcd\u0bb1\u0bc1|\u0bae\u0bc2\u0ba3\u0bc1", "\u0ba8\u0bbe\u0ba9\u0bcd\u0b95\u0bc1|\u0ba8\u0bbe\u0bb2\u0bc1", "\u0b90\u0ba8\u0bcd\u0ba4\u0bc1|\u0b85\u0b9e\u0bcd\u0b9a\u0bc1", "\u0b86\u0bb1\u0bc1", "\u0b8f\u0bb4\u0bc1", "\u0b8e\u0b9f\u0bcd\u0b9f\u0bc1", "\u0b92\u0ba9\u0bcd\u0baa\u0ba4\u0bc1"], ["\u0936\u0942\u0928\u094d\u092f|\u091c\u0940\u0930\u094b|\u091c\u093c\u0940\u0930\u094b", "\u090f\u0915", "\u0926\u094b", "\u0924\u0940\u0928", "\u091a\u093e\u0930", "\u092a\u093e\u0902\u091a|\u092a\u093e\u0901\u091a", "\u091b\u0939|\u091b\u0903|\u091b\u0947", "\u0938\u093e\u0924", "\u0906\u0920", "\u0928\u094c"]]
DIGITS={a:str(i) for group in DIGIT_GROUPS for i,word in enumerate(group) for a in word.split('|')}
def data_root():return Path(os.getenv('DATA_DIR',str(Path(__file__).resolve().parents[1]/'data'))).resolve()
def flag(name):return os.getenv(name,'false').lower()=='true'
def today():return dt.datetime.now(dt.timezone.utc).date().isoformat()
def day(value):
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}',value):raise ValueError('Invalid date')
    dt.date.fromisoformat(value);return value
def canonical(row):return json.dumps(row,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()
def mask(text):
    # Passcode interaction transcripts are always wholly redacted by the caller.
    tokens=re.split(r'(\s+)',str(text or ''))
    return ''.join(MASK if re.search(r'\d',t) or t.lower().strip('.,!?;:') in NUMBERS else t for t in tokens)
def safe(value):
    if isinstance(value,dict):return {k:safe(v) for k,v in value.items() if not re.search('code|token|secret|password|audio',k,re.I)}
    if isinstance(value,list):return [safe(v) for v in value[:50]]
    if isinstance(value,str):return re.sub(r'(?<![A-Za-z0-9])\d{6}(?![A-Za-z0-9])',MASK,value)[:1000]
    return value if value is None or isinstance(value,(int,float,bool)) else None
class AuditDamage(ValueError):
    def __init__(self,seq):self.seq=seq
class Audit:
    def path(self,date):return data_root()/'voice_audit'/(day(date)+'.jsonl')
    def rows(self,date):
        with LOCK:return self._rows(date)
    def _rows(self,date):
        p=self.path(date)
        if p.is_symlink():raise ValueError('Invalid audit path')
        rows=[]
        if p.exists():
            for seq,line in enumerate(p.read_text(encoding='utf-8').splitlines(),1):
                try:rows.append(json.loads(line))
                except ValueError:raise AuditDamage(seq) from None
        return rows
    def verify(self,date):
        with LOCK:return self._verify(date)
    def _verify(self,date):
        try:
            rows=self.rows(date);prev='0'*64
            for seq,row in enumerate(rows,1):
                if not isinstance(row,dict):return {'ok':False,'first_broken_seq':seq}
                body={k:v for k,v in row.items() if k!='hash'}
                if row.get('seq')!=seq or row.get('prev_hash')!=prev or row.get('hash')!=hashlib.sha256(canonical(body)).hexdigest():return {'ok':False,'first_broken_seq':seq}
                prev=row['hash']
            return {'ok':True,'count':len(rows),'head':prev}
        except AuditDamage as error:return {'ok':False,'first_broken_seq':error.seq}
        except (ValueError,OSError,TypeError):return {'ok':False,'first_broken_seq':1}
    def append(self,event,session):
        if not flag('VOICE_AUDIT_ENABLED'):return None
        date=today()
        with LOCK:
            if not self.verify(date)['ok']:raise ValueError('Audit chain damaged; append refused')
            rows=self.rows(date);row={k:safe(event.get(k)) for k in ['page','user','level','intent','summary','confirmation','decision','backend_result','error','event_id','confirmation_word','confirmation_word_verified']}
            row.update(ts=dt.datetime.now(dt.timezone.utc).isoformat(),seq=len(rows)+1,session_id=session,transcript=MASK if event.get('confirmation')=='passcode' else mask(event.get('transcript')),prev_hash=rows[-1]['hash'] if rows else '0'*64)
            row['hash']=hashlib.sha256(canonical(row)).hexdigest();p=self.path(date);p.parent.mkdir(parents=True,exist_ok=True)
            with p.open('a',encoding='utf-8',newline='\n') as stream:stream.write(json.dumps(row,ensure_ascii=False)+'\n');stream.flush();os.fsync(stream.fileno())
            return row
AUDIT=Audit()
