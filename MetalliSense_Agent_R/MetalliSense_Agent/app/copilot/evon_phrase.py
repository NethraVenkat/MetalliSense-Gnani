"""Optional phrasing of caller-supplied gate facts. No gate or mutation APIs.

The browser owns the factory snapshot; validation checks its schema and output
grounding, not the authenticity of the underlying factory measurements.
"""
import asyncio
from decimal import Decimal
import json
import math
import os
import re
import time
import unicodedata

import httpx

TIMEOUT_SECONDS = 6
ELEMENT_NAMES = {
    'C': ('carbon', 'கார்பன்'), 'Si': ('silicon', 'சிலிக்கான்'),
    'Mn': ('manganese', 'மாங்கனீசு'), 'P': ('phosphorus', 'பாஸ்பரஸ்'),
    'S': ('sulfur', 'sulphur', 'சல்பர்'), 'Cu': ('copper', 'செம்பு', 'காப்பர்'),
    'Cr': ('chromium', 'குரோமியம்'), 'Ni': ('nickel', 'நிக்கல்'),
    'Mo': ('molybdenum', 'மாலிப்டினம்'), 'Fe': ('iron', 'இரும்பு'), 'Sn': ('tin', 'தகரம்'),
}
CHECKS = {'lot_status', 'spec_prediction', 'residuals', 'stock', 'charge_weight', 'yard_inspection', 'dri_quality'}
NUMBER = re.compile(r'(?<!\w)[+-]?(?:\d+(?:\.\d+)?|\.\d+)')
ID = re.compile(r'\b[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+\b')
LABEL = re.compile(r'(?:Reason|காரணம்)\s*\d+\s*[:：.\-)]?\s*', re.I)
_last = {'mode': 'offline', 'last_latency_ms': None, 'last_reject_reason': None}


def _on(name):
    return os.getenv(name, '').strip().lower() in {'on', 'true', '1', 'yes'}


def phrase_status():
    enabled = _on('EVON_PHRASE_ENABLED')
    mode = ('mock' if not enabled or _on('EVON_MOCK') else
            'offline' if not os.getenv('EVON_BASE_URL', '').strip() else _last['mode'])
    return {'enabled': enabled, 'mode': mode, **{k: _last[k] for k in ('last_latency_ms', 'last_reject_reason')}}


def validate_facts(facts, kind, lang):
    if kind not in {'hold', 'warn', 'status'} or lang not in {'ta', 'en'} or not isinstance(facts, dict):
        return False
    if set(facts) - {'heat_id', 'decision', 'status', 'reasons'}:
        return False
    if not re.fullmatch(r'H-\d{1,8}', str(facts.get('heat_id', ''))):
        return False
    decision = facts.get('decision')
    if decision not in {'HOLD', 'WARN', 'GO'} or kind != 'status' and decision != kind.upper():
        return False
    if 'status' in facts and not re.fullmatch(r'[A-Z_]{1,32}', str(facts['status'])):
        return False
    reasons = facts.get('reasons', [])
    if not isinstance(reasons, list) or len(reasons) > 2:
        return False
    for reason in reasons:
        if not isinstance(reason, dict) or set(reason) - {'check', 'status', 'element', 'value', 'min', 'max', 'direction', 'risk', 'lot_id', 'lot_status'}:
            return False
        if reason.get('check') not in CHECKS or reason.get('status') not in {'FAIL', 'WARN'}:
            return False
        if decision == 'WARN' and reason['status'] != 'WARN' or decision == 'GO':
            return False
        for name in ('value', 'min', 'max'):
            if name in reason and (isinstance(reason[name], bool) or not isinstance(reason[name], (float, int)) or not math.isfinite(reason[name])):
                return False
        if 'element' in reason and (reason['element'] not in ELEMENT_NAMES or 'value' not in reason):
            return False
        if 'direction' in reason and reason['direction'] not in {'low', 'high', 'review'}:
            return False
        if 'risk' in reason and (not isinstance(reason['risk'], bool) or reason['status'] != 'WARN'):
            return False
        if 'lot_id' in reason and not re.fullmatch(r'[A-Z][A-Z0-9]*-\d{1,8}', str(reason['lot_id'])):
            return False
        if 'lot_status' in reason and reason['lot_status'] not in {'QUARANTINED', 'RESTRICTED', 'HOLD', 'RELEASED', 'UNRELEASED'}:
            return False
    return True


def template(facts, lang):
    """Safe structured fallback; UI keeps its original full/spoken templates."""
    parts = [f"Heat {facts['heat_id']}: Gate {facts['decision']}"]
    reasons = []
    for reason in facts.get('reasons', []):
        if reason.get('element'):
            element = reason['element']
            name = ELEMENT_NAMES[element][-1] if lang == 'ta' else element
            direction = reason.get('direction', 'review')
            word = {'low': 'குறைவு', 'high': 'அதிகம்', 'review': 'சரிபார்க்கவும்'}[direction] if lang == 'ta' else direction
            if reason.get('risk'):
                word = ('குறைவதற்கான அபாயம்' if direction == 'low' else 'அதிகரிக்கும் அபாயம்') if lang == 'ta' else direction + ' risk'
            reasons.append(f"{name} {reason['value']} {'சதவீதம்' if lang == 'ta' else 'percent'}, {word}")
        elif reason.get('lot_id'):
            reasons.append(f"{reason['lot_id']}: " + ('தனிமைப்படுத்தப்பட்டுள்ளது' if lang == 'ta' and reason.get('lot_status') == 'QUARANTINED' else 'பயன்பாட்டுக் கட்டுப்பாடு' if lang == 'ta' else reason.get('lot_status', 'restricted')))
        else:
            reasons.append('திரையில் சோதனை விவரங்களைப் பார்க்கவும்' if lang == 'ta' else 'Check gate details on screen')
    parts.append('; '.join(reasons) if reasons else ('திரையில் விவரங்களைப் பார்க்கவும்' if lang == 'ta' else 'Check the screen'))
    return '. '.join(parts) + '.'


def prompt_messages(facts, kind, lang):
    example_facts = {'heat_id': 'H-2001', 'decision': 'HOLD', 'reasons': []}
    example = ('Heat H-2001 HOLD. தேவையான சேர்க்கையை திரையில் approve செய்த பிறகு மீண்டும் சோதிக்கவும்.' if lang == 'ta'
               else 'Heat H-2001 HOLD. Approve on screen the required addition, then check again.')
    instructions = (
        'Phrase only the supplied verified gate facts, in at most two short sentences. '
        + ('Write Tamil script; keep heat IDs, lot IDs and element symbols unchanged. ' if lang == 'ta' else 'Write English. ')
        + 'Include the actual heat ID and gate decision. Use only the supplied reasons, values and limits; '
        'never invent an element, number, lot, addition, recommendation, or decision. Write numbers as digits. '
        'Do not copy facts from the example. No headings, labels, JSON, or explanation of these instructions. '
        'No commands to approve, release, override, deduct or start melting. The only permitted approval '
        'wording is "திரையில் approve" in Tamil or "approve on screen" in English. '
        'Include both supplied reasons. Start an element reason with its symbol and actual value, '
        'then its direction and limit if needed. A low value stays low, a high value stays high. Output the answer only.\n'
    )
    return [
        {'role': 'user', 'content': instructions + 'Example facts: ' + json.dumps(example_facts, ensure_ascii=False)},
        {'role': 'assistant', 'content': example},
        {'role': 'user', 'content': 'Actual facts (' + kind + '): ' + json.dumps(facts, ensure_ascii=False)
         + '\n' + ('இந்த உண்மைகளை மட்டும் தமிழில் எழுதவும். எடுத்துக்காட்டின் செயலை நகலெடுக்க வேண்டாம். ' if lang == 'ta'
                   else 'Phrase ONLY this factual draft in English. Do not copy the example action. ')
         + 'An in-range WARN marked risk=true is a risk, not an assertion that the measured value exceeds a limit. '
         + 'Keep both actual reasons and numbers. Factual draft: ' + template(facts, lang)},
    ]


def _numbers(text):
    text = ''.join(str(unicodedata.digit(c)) if c.isdigit() else c for c in text)
    return {Decimal(match.group()) for match in NUMBER.finditer(text)}


def validate_output(raw, facts, lang):
    if not isinstance(raw, str) or not raw.strip() or len(raw) > 2000:
        return '', 'invalid_output'
    text = LABEL.sub('', unicodedata.normalize('NFKC', raw)).strip()
    if re.search(r'[{}<>`]|\b(?:system|assistant|user|instructions|heat_id|Example facts|Actual facts|Output the answer|Phrase only|Do not copy|Use only the supplied|Write Tamil|Write English)\b', text, re.I):
        return '', 'prompt_echo'
    if lang == 'ta' and not re.search(r'[\u0b80-\u0bff]', text):
        return '', 'missing_tamil'
    allowed_ids = {facts['heat_id'], *[r['lot_id'] for r in facts.get('reasons', []) if r.get('lot_id')]}
    if set(ID.findall(text)) - allowed_ids:
        return '', 'invented_id'
    if facts['heat_id'] not in text:
        return '', 'missing_heat'
    decisions = set(re.findall(r'\b(?:HOLD|WARN|GO)\b', text, re.I))
    if {d.upper() for d in decisions} != {facts['decision']}:
        return '', 'decision_mismatch'
    allowed_elements = {r['element'] for r in facts.get('reasons', []) if r.get('element')}
    mentions = []
    for element, names in ELEMENT_NAMES.items():
        for alias in [element, *names]:
            mentions.extend((match.start(), match.end(), element) for match in
                            re.finditer(r'(?<!\w)' + re.escape(alias) + r'(?!\w)', text, 0 if alias == element else re.I))
    for element, names in ELEMENT_NAMES.items():
        aliases = [element, *names]
        for alias in aliases:
            flags = 0 if alias == element else re.I
            found = re.search(r'(?<!\w)' + re.escape(alias) + r'(?!\w)', text, flags)
            if found and element not in allowed_elements:
                return '', 'invented_element'
            if found:
                # Bind any numeric claim following the element to that element's
                # own verified value/limits, not another reason's allowed numbers.
                number = re.match(r'[^\d.;!?]{0,30}([+-]?\d+(?:\.\d+)?)', text[found.end():])
                if number:
                    allowed = {Decimal(str(r['value'])) for r in facts['reasons'] if r.get('element') == element}
                    if Decimal(number.group(1)) not in allowed:
                        return '', 'element_value_mismatch'
    if _numbers(text) - _numbers(json.dumps(facts, ensure_ascii=False)):
        return '', 'invented_number'
    word_numbers = {'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
                    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
                    'ஒன்று': 1, 'இரண்டு': 2, 'மூன்று': 3}
    allowed_numbers = _numbers(json.dumps(facts, ensure_ascii=False))
    for word, value in word_numbers.items():
        if re.search(r'(?<!\w)' + word + r'(?!\w)', text, re.I) and Decimal(value) not in allowed_numbers:
            return '', 'invented_number'
    actions = re.sub(r'திரையில்\s+approve|approve\s+on\s+screen', '', text, flags=re.I)
    if re.search(r'\b(?:approv\w*|confirm\w*|releas\w*|deduct\w*|override\w*|melt\w*|start|stop)\b|அனுமதி|ஒப்புதல்|உருக்க|தொடங்கு|ஆரம்பி', actions, re.I):
        return '', 'unsafe_instruction'
    for reason in facts.get('reasons', []):
        element = reason.get('element')
        if element:
            found = next((m for m in sorted(mentions) if m[2] == element), None)
            if not found:
                return '', 'missing_reason'
            end = min((m[0] for m in mentions if m[0] > found[0] and m[2] != element), default=len(text))
            region = re.split(r'[;!?]|\.(?!\d)', text[found[1]:end], maxsplit=1)[0]
            # Split decimal-aware; preserve the fractional value for membership.
            if Decimal(str(reason['value'])) not in _numbers(text[found[1]:end]):
                return '', 'missing_reason'
            opposite = r'\b(?:high|above|exceed\w*)\b|அதிகம்' if reason.get('direction') == 'low' else r'\b(?:low|below)\b|குறைவு' if reason.get('direction') == 'high' else None
            if opposite and re.search(opposite, region, re.I):
                return '', 'direction_mismatch'
            if reason.get('risk') and not re.search(r'\b(?:risk|near|could|may)\b|அபாய|வாய்ப்பு|நெருக்க', region, re.I):
                return '', 'risk_claim_mismatch'
            # Even with all numbers preserved, "0.27 is above 0.3" is false.
            conditional = re.search(r'\b(?:could|may)\b|கூடும்|வாய்ப்பு', region, re.I)
            if not conditional:
                if reason.get('max') is not None and reason['value'] <= reason['max'] and re.search(r'\b(?:above|exceed\w*)\b|மீறிய|மீறுகிறது', region, re.I):
                    return '', 'limit_comparison_mismatch'
                if reason.get('min') is not None and reason['value'] >= reason['min'] and re.search(r'\bbelow\b|விடக் குறை', region, re.I):
                    return '', 'limit_comparison_mismatch'
        elif reason.get('lot_id'):
            if reason['lot_id'] not in text:
                return '', 'missing_reason'
            if reason.get('lot_status') == 'QUARANTINED' and not re.search(r'quarantin\w*|தனிமைப்படுத்த', text, re.I):
                return '', 'lot_status_mismatch'
        else:
            return '', 'unstructured_reason'
    # Validate ALL generated content first: trimming must never hide an invention.
    sentences = [s.strip() for s in re.split(r'(?<=[.!?।])\s+|\n+', text) if s.strip()]
    trimmed = ' '.join(sentences[:2])
    if len(sentences) > 2:
        # Also validate the retained text: do not trim away a required reason.
        return validate_output(trimmed, facts, lang)
    return trimmed, None


async def phrase(facts: dict, kind: str, lang: str):
    began = time.perf_counter()
    fallback = 'திரையில் விவரங்களைப் பார்க்கவும்' if lang == 'ta' else 'Check the screen'
    def finish(text, source, reason=None, mode=None):
        latency = round((time.perf_counter() - began) * 1000, 1)
        _last.update(last_latency_ms=latency, last_reject_reason=reason)
        if mode:
            _last['mode'] = mode
        result = {'text': text, 'source': source, 'latency_ms': latency}
        if reason:
            result['reject_reason'] = reason
        return result
    try:
        if not validate_facts(facts, kind, lang):
            return finish(fallback, 'template', 'invalid_facts')
        fallback = template(facts, lang)
        if not _on('EVON_PHRASE_ENABLED'):
            return finish(fallback, 'template', 'disabled', 'mock')
        if _on('EVON_MOCK'):
            return finish(fallback, 'template', 'mock', 'mock')
        base = os.getenv('EVON_BASE_URL', '').strip().rstrip('/')
        if not base:
            return finish(fallback, 'template', 'offline', 'offline')
        from urllib.parse import urlsplit
        url = urlsplit(base)
        if url.scheme not in {'https', 'http'} or not url.netloc or url.username or url.password or url.query or url.fragment:
            return finish(fallback, 'template', 'invalid_config', 'offline')
        key = os.getenv('EVON_API_KEY', '').strip()
        headers = {'Authorization': 'Bearer ' + key} if key else {}
        payload = {'model': os.getenv('EVON_MODEL', '').strip() or 'evon',
                   'messages': prompt_messages(facts, kind, lang), 'temperature': 0.6,
                   'top_p': 0.95, 'max_tokens': 100, 'chat_template_kwargs': {'enable_thinking': False}}
        async with asyncio.timeout(TIMEOUT_SECONDS):
            async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS, follow_redirects=False) as client:
                response = await client.post(base + '/chat/completions', headers=headers, json=payload)
                if response.status_code != 200:
                    return finish(fallback, 'template', f'http_{response.status_code}', 'offline')
                raw = response.json()['choices'][0]['message']['content']
        if key and key in str(raw):
            return finish(fallback, 'template', 'secret_in_output', 'live')
        text, reason = validate_output(raw, facts, lang)
        return finish(fallback if reason else text, 'template' if reason else 'evon', reason, 'live')
    except (TimeoutError, httpx.TimeoutException):
        return finish(fallback, 'template', 'timeout', 'offline')
    except Exception:
        # Fixed codes only. Never expose provider bodies, exception repr or keys.
        return finish(fallback, 'template', 'unavailable', 'offline')
