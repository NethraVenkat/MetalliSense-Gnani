"""Pure shared frozen Prisma audition/application rules; no tooling imports."""
import unicodedata

FIELDS={'model':'prisma-v3.0','language_code':'ta-IN,en-IN','format':'codemix','keyterms':'["குரல்"]'}
def payload_fields(variant='v2'):
    if variant not in ('v2','v3'):raise ValueError('Unknown variant')
    return {k:v for k,v in FIELDS.items() if variant!='v3' or k!='keyterms'}
RULE={'frame_samples':320,'rms_threshold':.01,'silence_frames':25,'snippet_samples':24000,'initial_silence_credit':False,'transcript_match':'NFC casefold substring: குரல் | குறள் | kural'}
RULE_V2={**RULE,'initial_silence_credit':True,'minimum_speech_frames':5,'pad_snippets_to_samples':24000,'transcript_match':'NFC casefold first word, punctuation stripped: குரல் | குறள் | kural'}

def wake(text):
    text=unicodedata.normalize('NFC',text).casefold()
    return any(term in text for term in ('குரல்','குறள்','kural'))
def first_word_wake(text):
    return wake_parts(text)['wake']
def wake_parts(text):
    original=unicodedata.normalize('NFC',text);text=original.casefold()
    # Punctuation becomes separators; Tamil combining marks remain part of words.
    text=''.join(' ' if unicodedata.category(c).startswith('P') else c for c in text)
    words=text.split()
    matched=bool(words and words[0] in ('குரல்','குறள்','kural'))
    return {'wake':matched,'transcript':original,'remainder':' '.join(words[1:]) if matched else ''}
