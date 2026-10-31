"""Cache-first pronunciation listening sheet; <=40 sequential TTS attempts, no retries.

Default --max-calls 0 never calls a provider. No production speech transforms,
configuration writes, STT, fallback voices or automatic retries are used.
"""
import argparse
import hashlib
import html
import io
import json
from pathlib import Path
import sys
import time
import wave

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
OUTPUT=ROOT/'app/data/tts_cache/f11d_sheet'
DOC=ROOT/'DOCS/F11D_PRONUNCIATION.md'

# One provider request per supplied variant, including the two-sentence refusals.
TERMS=[
 ('T1','ta','Heat number','ஹீட் {} ஹோல்ட்ல இருக்கு.',[
  'ஆயிரத்து ஐம்பத்தி மூணு','டென் ஃபிஃப்டி த்ரீ','ஒன் ஜீரோ ஃபைவ் த்ரீ']),
 ('T2','ta','Decimal','காப்பர் {} பர்சென்ட்.',[
  'ஜீரோ பாயிண்ட் ஃபைவ் ஜீரோ','பாயிண்ட் ஃபைவ் ஜீரோ','அரை']),
 ('T3','ta','Limit','லிமிட் {}.',[
  'ஜீரோ பாயிண்ட் த்ரீ ஜீரோ','பாயிண்ட் த்ரீ']),
 ('T4','ta','Lot','{}, க்வாரண்டைன்ல இருக்கு.',[
  'லாட் நம்பர் ஆயிரத்து ஐம்பத்தி மூணு','லாட் டென் ஃபிஃப்டி த்ரீ','பிக் அயர்ன் லாட் டென் ஃபிஃப்டி த்ரீ']),
 ('T5','ta','Melting','{}',[
  'ஒரு ஹீட் மெல்டிங்ல இருக்கு.','ஒரு ஹீட் உருகிட்டு இருக்கு.','ஒரு ஹீட் ஃபர்னஸ்ல இருக்கு.']),
 ('T6','ta','Not checked','{}',[
  'ஒரு ஹீட் இன்னும் செக் பண்ணல.','ஒரு ஹீட் செக் பெண்டிங்.']),
 ('T7','ta','Summary opener','{}',[
  'ஷிஃப்ட் சுருக்கம்.','ஷிஃப்ட் சம்மரி.','இந்த ஷிஃப்ட் நிலைமை.']),
 ('T8','ta','Counts','{}',[
  'ஒண்ணு கோ, ரெண்டு ஹோல்ட்.','ஒரு ஹீட் கோ, ரெண்டு ஹீட் ஹோல்ட்.']),
 ('T9','ta','Blocked','{}',[
  'வாய்ஸ்ல அப்ரூவ் பண்ண முடியாது. ஸ்கிரீன்ல பண்ணுங்க.',
  'இது வாய்ஸ்ல செய்ய முடியாது. ஸ்கிரீன்ல அப்ரூவ் பண்ணுங்க.']),
 ('T10','ta','Retry','{}',[
  'சரியா கேக்கல, திரும்ப சொல்லுங்க.','மன்னிக்கணும், இன்னொரு தடவை சொல்லுங்க.']),
 ('H1','hi','Heat number','हीट {} होल्ड पर है।',[
  'एक हज़ार तिरपन','टेन फिफ्टी थ्री','वन ज़ीरो फाइव थ्री']),
 ('H2','hi','Decimal','कॉपर {} परसेंट।',[
  'ज़ीरो पॉइंट फाइव ज़ीरो','पॉइंट फाइव ज़ीरो']),
 ('H3','hi','Lot','{}, क्वारंटीन में है।',[
  'लॉट नंबर एक हज़ार तिरपन','लॉट टेन फिफ्टी थ्री']),
 ('H4','hi','Melting','{}',[
  'एक हीट मेल्टिंग में है।','एक हीट भट्टी में है।']),
 ('E1','en','Heat number','Heat {} is on hold.',[
  'ten fifty-three','one zero five three','one thousand fifty-three']),
]

def variants():
    return [{'term':term,'lang':lang,'title':title,'variant':chr(65+i),
             'text':frame.format(text),'file':f'{term}_{chr(65+i)}_{lang}.wav'}
            for term,lang,title,frame,choices in TERMS for i,text in enumerate(choices)]

def valid_wav(audio,rate):
    try:
        with wave.open(io.BytesIO(audio),'rb') as source:
            return (source.getnchannels()==1 and source.getsampwidth()==2
                    and source.getframerate()==rate and source.getnframes()>0)
    except (wave.Error,EOFError):return False

def write_sheet(rows,saved,settings):
    lookup={(row['term'],row['variant']):row for row in rows}
    escape=html.escape
    body=[]
    for term,lang,title,_,choices in TERMS:
        cells=[]
        for label in 'ABC':
            row=lookup.get((term,label))
            if not row:cells.append('<td class="empty">—</td>');continue
            audio=(f'<audio controls preload="none" src="{escape(row["file"],quote=True)}"></audio>'
                   if row['success'] else f'<p class="missing">{escape(row["status"])}</p>')
            cells.append(f'<td><strong>{label}</strong><p lang="{lang}">{escape(row["text"])}</p>{audio}'
                         f'<small>{escape(row["file"])} · {escape(row["source"] or row["status"])}</small></td>')
        body.append(f'<tr><th scope="row">{term}<br>{escape(title)}<br><small>{lang}</small></th>{"".join(cells)}'
                    f'<td><input aria-label="Team choice for {term}" placeholder="A / B / C" maxlength="20"></td></tr>')
    page='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>F11d pronunciation listening sheet</title><style>
body{font-family:system-ui,sans-serif;margin:24px;color:#18262a;background:#f6f8f8}h1{font-size:1.6rem}
.scroll{overflow:auto}table{border-collapse:collapse;width:100%;background:white}th,td{padding:16px;border:1px solid #d9e1e1;vertical-align:top;text-align:left}
thead{background:#e5efeb}td p{line-height:1.7;min-height:3em}audio{display:block;width:260px;max-width:100%;margin:8px 0}small{display:block;color:#596769;font-size:.75rem}
.missing{color:#a32626}.empty{color:#777}input{width:90px;padding:8px}caption{text-align:left;margin:12px 0}footer{margin-top:20px;color:#596769}
</style><h1>F11d pronunciation listening sheet</h1>
<p>Timbre v3.0 · Kalpana · default speed · no tags. One row per term; compare A/B/C by ear.</p>
<p>Audition only: no production wording or decisions changed. Team choices are blank; inputs are not saved on refresh. Record final choices in the Markdown sheet.</p>
'''
    count=sum(row['success'] for row in rows)
    page+=f'<p>{count}/{len(rows)} WAVs available. Live TTS attempts used: {saved["calls"]}/40. STT: 0.</p>'
    page+='<div class="scroll"><table><thead><tr><th>Term</th><th>Variant A</th><th>Variant B</th><th>Variant C</th><th>Team choice</th></tr></thead><tbody>'
    page+=''.join(body)+'</tbody></table></div><footer>Listen locally. No external scripts, fonts, autoplay or uploads.</footer></html>'
    (OUTPUT/'index.html').write_text(page,encoding='utf-8')
    # Preserve any team choices if the cache-only sheet is regenerated later.
    previous={}
    if DOC.exists():
        for line in DOC.read_text(encoding='utf-8').splitlines():
            cells=line.split('|')
            if len(cells)==8 and cells[1].strip() in {term[0] for term in TERMS}:
                previous[cells[1].strip()]=cells[-2].strip()
    document=['# F11d pronunciation audition','',
        '2026-10-31 (Asia/Calcutta). Owner: Nethra. Listening choices only; no production behavior change. No commit.','',
        '## Settings and scope','',
        'The tool reads the current production configuration and requires timbre-v3.0 / Kalpana, clarity off, default speed (unset), and tags off. It never edits configuration or runs the production lexicon/normalizer over these supplied variant sentences. Each variant is one synthesis request; the supplied two-sentence refusals are kept verbatim. Explicit languages are ta-IN / hi-IN / en-IN.','',
        f'Output sample rate: {settings["sample_rate"]} Hz, mono PCM16 WAV. The existing finalized-WAV cache and its exact model/voice/language/text/settings key are reused first. Sheet copies, HTML and the budget journal are under ignored app/data/tts_cache/f11d_sheet/.','',
        'Some variants differ in precision or meaning (half vs digit-preserving decimal, furnace vs melting, pig-iron lot description, and refusal wording). They are audition candidates only. No choice here is automatically adopted into production, and no factual/safety equivalence or subjective winner is claimed.','',
        '## Run','',
        '```powershell','python tools/f11d_pronunciation_sheet.py --max-calls 40',
        '# Cache-only regeneration; makes no provider requests:',
        'python tools/f11d_pronunciation_sheet.py --max-calls 0','```','',
        'Calls are strictly sequential; there are no STT calls, provider retries or fallback voices. The durable counter records an attempt before HTTP, including failures. A failed variant is not automatically retried on a later run. Budget is cumulative for this sheet, capped at 40; default is zero calls.','',
        '## Terms and choices','',
        'Open the local index.html for labelled players. The Team choice column is intentionally blank. Each cell lists the exact full sentence and WAV filename.','',
        '| Term | Topic | A | B | C | Team choice |','|---|---|---|---|---|---|']
    for term,lang,title,_,choices in TERMS:
        cells=[]
        for label in 'ABC':
            row=lookup.get((term,label))
            cells.append((row['text']+'<br>['+row['file']+'](../app/data/tts_cache/f11d_sheet/'+row['file']+')') if row else '—')
        document.append(f'| {term} | {title} ({lang}) | '+ ' | '.join(cells)+f' | {previous.get(term, "")} |')
    failed=[row['term']+'-'+row['variant'] for row in rows if row['status']=='failed']
    pending=[row['term']+'-'+row['variant'] for row in rows if row['status']=='not generated']
    document+=['','## Generation results','',
        f'37 variants (25 Tamil, 9 Hindi, 3 English). WAVs available: **{count}/37**. Cumulative live TTS calls: **{saved["calls"]}/40**. STT calls: **0**.',
        '',f'Failed variants: {", ".join(failed) or "none"}. Not yet generated: {", ".join(pending) or "none"}.','',
        'Listening page: app/data/tts_cache/f11d_sheet/index.html (local, gitignored). No browser/manual listening or pronunciation ranking has been performed. The team chooses by ear; production changes are a later step.']
    DOC.parent.mkdir(parents=True,exist_ok=True)
    DOC.write_text('\n'.join(document)+'\n',encoding='utf-8')

def main():
    sys.stdout.reconfigure(encoding='utf-8')
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--max-calls',type=int,default=0,choices=range(41))
    args=parser.parse_args()
    from dotenv import load_dotenv
    load_dotenv(ROOT/'.env')
    from app.copilot.gnani_client import GnaniClient,_env_bool,tts_text
    client=GnaniClient()
    if (client.tts_model,client.tts_voice,client.tts_speed,client.tts_tags,_env_bool('GNANI_TTS_CLARITY'))!=('timbre-v3.0','Kalpana',None,False,False):
        raise RuntimeError('Requires current Kalpana v3.0, clarity off, default speed, no tags; configuration was not changed')
    if client.mock:raise RuntimeError('Real cache/live configuration required; do not create mock audition WAVs')
    OUTPUT.mkdir(parents=True,exist_ok=True)
    journal=OUTPUT/'manifest.json'
    saved=json.loads(journal.read_text(encoding='utf-8')) if journal.exists() else {'calls':0,'attempted':[],'records':{}}
    def save():
        temporary=journal.with_suffix('.json.tmp')
        temporary.write_text(json.dumps(saved,ensure_ascii=False,indent=2),encoding='utf-8');temporary.replace(journal)
    settings={'model':client.tts_model,'voice':client.tts_voice,'speed':None,'tags':False,'clarity':False,'sample_rate':client.tts_sample_rate}
    import requests
    original=requests.post
    in_flight=False
    def guarded(url,**kwargs):
        nonlocal in_flight
        payload=kwargs.get('json',{})
        if (in_flight or url!=client.base_url+'/api/v1/tts/inference'
            or saved['calls']>=min(args.max_calls,40) or payload.get('model')!='timbre-v3.0'
            or payload.get('voice')!='Kalpana' or 'speed' in payload or '<' in payload.get('text','')):
            raise RuntimeError('F11d call/settings guard refused request')
        saved['calls']+=1;save();in_flight=True
        try:return original(url,**kwargs)
        finally:in_flight=False
    requests.post=guarded
    rows=[]
    for variant in variants():
        fingerprint=hashlib.sha256(json.dumps({**settings,'lang':variant['lang'],'text':variant['text']},ensure_ascii=False,sort_keys=True).encode()).hexdigest()
        target=OUTPUT/variant['file'];record=saved['records'].get(fingerprint,{})
        audio=None;source=None
        if record.get('success') and target.exists():
            candidate=target.read_bytes()
            if valid_wav(candidate,client.tts_sample_rate):audio=candidate;source='sheet cache'
        started=time.perf_counter()
        if audio is None:
            # First consult the real shared production disk cache, with HTTP forbidden.
            audio=client.synthesize(variant['text'],variant['lang'],allow_fallback=False,max_calls=0)
            if audio:source='disk cache'
        if audio is None and fingerprint not in saved['attempted'] and saved['calls']<min(args.max_calls,40):
            saved['attempted'].append(fingerprint);save()
            audio=client.synthesize(variant['text'],variant['lang'],allow_fallback=False,max_calls=1)
            if audio:source=client.last_tts_source
        success=bool(audio and valid_wav(audio,client.tts_sample_rate))
        if success:target.write_bytes(audio)
        status='ready' if success else 'failed' if fingerprint in saved['attempted'] else 'not generated'
        row={**variant,'success':success,'status':status,'source':source,'latency_ms':round((time.perf_counter()-started)*1000,1)}
        saved['records'][fingerprint]=row;save();rows.append(row)
        print(f'{variant["term"]}-{variant["variant"]}: {status} ({source or "no request/retry"})',flush=True)
    saved['settings']=settings;save();write_sheet(rows,saved,settings)
    print(json.dumps({'variants':len(rows),'available':sum(row['success'] for row in rows),'live_tts_calls':saved['calls'],'stt_calls':0}),flush=True)
    print(str((OUTPUT/'index.html').resolve()),flush=True)
    return 0 if all(row['success'] for row in rows) else 1

if __name__=='__main__':sys.exit(main())
