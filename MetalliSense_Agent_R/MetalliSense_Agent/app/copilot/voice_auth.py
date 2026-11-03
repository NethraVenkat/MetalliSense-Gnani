"""Opaque local sessions and PBKDF2 approval tokens; single Agent worker only."""
import hashlib,json,os,re,secrets,threading,time,unicodedata
from collections import deque
from .voice_audit import DIGITS,AUDIT,MASK,data_root,canonical
from .voice_policy import ROLES,ACTIONS,forbidden
from .voice_numbers import NUMBERS
ITERATIONS=300_000

def normalize_code(text):
    normalized=unicodedata.normalize('NFKC',str(text)).lower()
    normalized=''.join(' ' if unicodedata.category(c).startswith('P') else c for c in normalized)
    normalized=''.join(str(unicodedata.digit(c)) if c.isdecimal() else c for c in normalized)
    tokens=[t for t in re.split(r'[\s-]+',normalized.strip()) if t and t!='and']
    values=[int(t) if t.isascii() and t.isdigit() else NUMBERS.get(t) for t in tokens]
    if not values or any(v is None for v in values):return None
    if all(v<10 for v in values):result=''.join(str(v) for v in values)
    elif len(tokens)==1 and tokens[0].isdigit():result=tokens[0]
    elif 100 not in values and 1000 not in values and len(values)>1 and 10<=values[0]<100 and 20<=values[1]<100:result=str(values[0]*100+sum(values[1:]))
    else:
        total=group=0
        for value in values:
            if value==100:group=(group or 1)*100
            elif value==1000:total+=(group or 1)*1000;group=0
            else:group+=value
        result=str(total+group)
    return result if re.fullmatch(r'\d{6}',result) else None


def entry(user_id,name,role,code):
    if role not in ROLES or not re.fullmatch(r'\d{6}',code):raise ValueError('A valid role and six digits are required')
    salt=secrets.token_bytes(16)
    return dict(id=user_id,name=name,role=role,salt=salt.hex(),hash=hashlib.pbkdf2_hmac('sha256',code.encode(),salt,ITERATIONS).hex(),iterations=ITERATIONS)

def users():
    try:
        rows=json.loads(os.getenv('VOICE_USERS','[]'));ids=set()
        if not isinstance(rows,list) or len(rows)>32:raise ValueError()
        for u in rows:
            if not all(isinstance(u.get(k),str) and u[k] for k in ['id','name','role','salt','hash']) or u['role'] not in ROLES or u['id'] in ids:raise ValueError()
            ids.add(u['id']);rounds=u.get('iterations',ITERATIONS)
            if not isinstance(rounds,int) or not 200_000<=rounds<=1_000_000 or len(bytes.fromhex(u['salt']))<16 or len(bytes.fromhex(u['hash']))!=32:raise ValueError()
        return rows
    except (ValueError,TypeError,KeyError):raise ValueError('Invalid VOICE_USERS configuration') from None

class VoiceAuth:
    def __init__(self,clock=time.time,persist=False):self.clock=clock;self.persist=persist;self.loaded_path=None;self.lock=threading.RLock();self.sessions={};self.readbacks={};self.tokens={};self.identities={};self.private_until={};self.failures=deque();self.locked_until=0
    def load_lock(self):
        if not self.persist:return
        path=data_root()/'voice_auth'/'lock.json'
        if self.loaded_path==path:return
        self.loaded_path=path
        if path.exists():
            try:
                row=json.loads(path.read_text());self.locked_until=float(row['locked_until']);self.failures=deque(float(t) for t in row['failures'])
            except (ValueError,KeyError,TypeError):self.locked_until=self.clock()+600
    def save_lock(self):
        if not self.persist:return
        path=data_root()/'voice_auth'/'lock.json';path.parent.mkdir(parents=True,exist_ok=True);temp=path.with_suffix('.tmp')
        with temp.open('wb') as stream:stream.write(canonical({'locked_until':self.locked_until,'failures':list(self.failures)}));stream.flush();os.fsync(stream.fileno())
        os.replace(temp,path)
    def session(self):
        with self.lock:
            now=self.clock();self.sessions={s:v for s,v in self.sessions.items() if now-v<86400};key=secrets.token_urlsafe(32);self.sessions[key]=now;return key
    def valid_session(self,session):return session in self.sessions and self.clock()-self.sessions[session]<86400
    def readback(self,session,action,summary,page):
        with self.lock:
            policy=ACTIONS.get(action)
            if not self.valid_session(session) or not policy or forbidden(action,summary) or policy['level']=='APPROVE' and re.search(r'\bHOLD\b',str(summary),re.I):return False
            if policy['level']=='APPROVE':self.private_until[session]=self.clock()+75
            self.readbacks[session]={'action':action,'ts':self.clock(),'summary':str(summary)[:500],'page':str(page)[:200],'level':policy['level']};return True
    def sensitive(self,session):return self.clock()<self.private_until.get(session,0)
    def authorize(self,session,action,roles,text):
        with self.lock:
            self.load_lock();now=self.clock();rb=self.readbacks.get(session);policy=ACTIONS.get(action)
            if now<self.locked_until:return {'ok':False,'locked':True,'retry_after':int(self.locked_until-now)+1}
            if not self.valid_session(session) or not rb or rb['action']!=action or now-rb['ts']>15 or not policy or policy['level']!='APPROVE' or forbidden(action,rb['summary']):return {'ok':False}
            # The caller cannot lower the registered server-side role requirement.
            required=set(policy['roles'])
            if not required or set(roles)!=required:return {'ok':False}
            code=normalize_code(text);match=None
            for u in users():
                derived=hashlib.pbkdf2_hmac('sha256',(code or 'invalid').encode(),bytes.fromhex(u['salt']),u.get('iterations',ITERATIONS))
                equal=secrets.compare_digest(derived,bytes.fromhex(u['hash']))
                if equal and u['role'] in required:match={k:u[k] for k in ['id','name','role']}
            if not match:
                while self.failures and now-self.failures[0]>=600:self.failures.popleft()
                self.failures.append(now);locked=len(self.failures)>=3
                if locked:self.locked_until=now+600
                self.save_lock()
                AUDIT.append(dict(level='APPROVE',intent=action,confirmation='passcode',decision='locked' if locked else 'refused',transcript=MASK),session)
                return {'ok':False,**({'locked':True,'retry_after':600} if locked else {})}
            del self.readbacks[session];self.failures.clear();self.save_lock();token=secrets.token_urlsafe(32);self.tokens[hashlib.sha256(token.encode()).hexdigest()]={'session':session,'action':action,'expires':now+60,'user':match}
            AUDIT.append(dict(level='APPROVE',intent=action,user=match,confirmation='passcode',decision='executed',summary='Approval credential verified; no plant execution'),session)
            return {'ok':True,'user':match,'token':token}
    def consume(self,session,token,action):
        with self.lock:
            key=hashlib.sha256(str(token).encode()).hexdigest();value=self.tokens.get(key)
            if not value or value['session']!=session or value['action']!=action or self.clock()>=value['expires']:return {'ok':False}
            del self.tokens[key];self.identities[session]=value['user'];return {'ok':True,'user':value['user']}
    def cancel(self,session):
        with self.lock:
            self.readbacks.pop(session,None)
            for k in [k for k,v in self.tokens.items() if v['session']==session]:del self.tokens[k]
AUTH=VoiceAuth(persist=True)
