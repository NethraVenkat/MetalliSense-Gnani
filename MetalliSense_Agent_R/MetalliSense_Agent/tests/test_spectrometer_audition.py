import importlib.util
import io
from pathlib import Path
import tempfile
import unittest
import wave
from email.message import Message
from unittest.mock import MagicMock, patch
import json

spec = importlib.util.spec_from_file_location('audition', Path(__file__).parents[1]/'tools/spectrometer_audition.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class AuditionTests(unittest.TestCase):
    def test_stock_exact_text_default_speed_one_request_and_preservation(self):
        data=io.BytesIO()
        with wave.open(data,'wb') as wav:
            wav.setparams((1,2,22050,0,'NONE','not compressed'))
            wav.writeframes(b'\x01\x00'*2205)
        calls=[]
        def sender(settings):
            calls.append(settings)
            return 200,data.getvalue(),{'content_type':'audio/wav'}
        with tempfile.TemporaryDirectory() as tmp:
            out=Path(tmp)/'stock'
            result=m.run(out,sender,candidate='stock')
            self.assertEqual(len(calls),1)
            self.assertEqual(result['max_requests'],1)
            expected=m.payload('hi-IN')
            expected['text']='இது Raw Material Stock. Pig iron, scrap, alloy — இந்த பொருட்கள் எவ்ளோ இருக்குன்னு இங்கே பாக்கலாம்.'
            self.assertEqual(calls[0],expected)
            self.assertFalse({'speed','speakingSpeed','voice_type'} & calls[0].keys())
            row=result['candidates'][0]
            self.assertEqual((out/row['response_evidence']).read_bytes(),data.getvalue())
            self.assertTrue((out/'stock_hi_default.wav').exists())
            self.assertTrue((out/'index.html').exists())
            self.assertIn('mapping unknown',result['speed_note'])

    def test_application_identity_and_A_only_transport(self):
        response=MagicMock()
        response.status=403
        response.headers={}
        response.read.return_value=b'forbidden'
        opener=MagicMock()
        opener.open.return_value.__enter__.return_value=response
        with tempfile.TemporaryDirectory() as tmp, patch.object(m.urllib.request,'build_opener',return_value=opener):
            result=m.run(Path(tmp)/'run',lambda settings:m.post(settings,'fixture-key'),candidate='A')
        opener.open.assert_called_once()
        request=opener.open.call_args.args[0]
        self.assertEqual(request.get_header('User-agent'),'MetalliSense-Kural-Pronunciation-Audition/1.0')
        self.assertEqual(request.get_header('X-api-key-id'),'fixture-key')
        self.assertEqual(request.full_url,'https://api.vachana.ai/api/v1/tts/inference')
        self.assertEqual(request.get_method(),'POST')
        self.assertEqual(opener.open.call_args.kwargs['timeout'],60)
        self.assertEqual(json.loads(request.data),m.payload('ta-IN'))
        self.assertEqual(result['actual_requests'],1)
        self.assertEqual(result['max_requests'],1)
        with patch.object(m.urllib.request,'build_opener',return_value=opener):
            m.post(m.payload('auto'),'fixture-key')
        self.assertEqual(json.loads(opener.open.call_args.args[0].data),m.payload('auto'))

    def test_payload_and_sequential_ceiling(self):
        calls=[]
        data=io.BytesIO()
        with wave.open(data,'wb') as wav:
            wav.setparams((1,2,22050,0,'NONE','not compressed'))
            wav.writeframes(b'\x01\x00'*2205)
        def sender(settings):
            calls.append(settings)
            return 200,data.getvalue()
        with tempfile.TemporaryDirectory() as tmp:
            out=Path(tmp)/'audition'
            result=m.run(out,sender,lambda seconds: calls.append('wait'))
            self.assertEqual(result['actual_requests'],2)
            self.assertEqual(calls[1],'wait')
            a,b=calls[0].copy(),calls[2].copy()
            self.assertEqual(a.pop('language'),'ta-IN')
            self.assertEqual(b.pop('language'),'auto')
            self.assertEqual(a,b)
            self.assertEqual(a['text'],m.TEXT)
            with self.assertRaises(FileExistsError): m.run(out,sender)
            self.assertEqual(len(calls),3)
    def test_failure_stops_without_retry(self):
        with tempfile.TemporaryDirectory() as tmp:
            calls=[]
            result=m.run(Path(tmp)/'audition',lambda p:(calls.append(p) or (429,b'error')))
            self.assertEqual(len(calls),1)
            self.assertEqual(result['actual_requests'],1)
    def test_redirects_disabled(self):
        self.assertIsNone(m.NoRedirect().redirect_request(None,None,None,None,None,None))

    def test_safe_socket_reason(self):
        reason=PermissionError(13,'secret text must never be copied')
        result=m.safe_error(m.urllib.error.URLError(reason))
        self.assertEqual(result['reason_type'],'PermissionError')
        self.assertEqual(result['errno'],13)
        self.assertNotIn('secret',str(result))

    def test_http_capture_is_bounded_and_sanitized(self):
        headers=Message()
        headers['Content-Type']='application/json'
        headers['X-Request-ID']='request-123'
        error=m.urllib.error.HTTPError('https://example.invalid',403,'Forbidden',headers,
            io.BytesIO(b'{"message":"denied key-value", "token":"private"}'+b'x'*10000))
        info=m.http_details(error,'key-value')
        self.assertEqual(info['status'],403)
        self.assertEqual(info['request_id'],'request-123')
        self.assertNotIn('key-value',info['body'])
        self.assertNotIn('private',info['body'])
        self.assertLessEqual(len(info['body']),4096)
        self.assertTrue(info['body_truncated'])
        with tempfile.TemporaryDirectory() as tmp:
            result=m.run(Path(tmp)/'run',lambda p:(403,b'',info))
            self.assertEqual(result['actual_requests'],1)
            self.assertEqual(result['candidates'][0]['response'],info)

    def test_explicit_config_path(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'.env'
            path.write_text('GNANI_API_KEY=fixture-key\n',encoding='utf-8')
            self.assertEqual(m.load_config(path)['GNANI_API_KEY'],'fixture-key')

    def test_A_only_has_one_request_even_on_success(self):
        data=io.BytesIO()
        with wave.open(data,'wb') as wav:
            wav.setparams((1,2,22050,0,'NONE','not compressed'))
            wav.writeframes(b'\x01\x00'*2205)
        for status in (200,403):
            with tempfile.TemporaryDirectory() as tmp:
                calls=[]
                def sender(settings):
                    calls.append(settings)
                    return status,data.getvalue()
                result=m.run(Path(tmp)/'run',sender,candidate='A')
                self.assertEqual(result['max_requests'],1)
                self.assertEqual(result['actual_requests'],1)
                self.assertEqual(len(calls),1)
                self.assertEqual(calls[0]['language'],'ta-IN')
                self.assertEqual(len(result['candidates']),1)

    def test_invalid_wav_preserves_evidence_and_exact_failure(self):
        data=io.BytesIO()
        with wave.open(data,'wb') as wav:
            wav.setparams((1,2,48000,0,'NONE','not compressed'))
            wav.writeframes(b'\x01\x00'*480)
        with tempfile.TemporaryDirectory() as tmp:
            directory=Path(tmp)/'run'
            result=m.run(directory,lambda p:(200,data.getvalue(),{'content_type':'audio/wav','request_id':'fixture'}),candidate='A')
            row=result['candidates'][0]
            self.assertEqual(row['error_details']['message'],'Invalid or unexpected WAV format')
            self.assertEqual(row['error_details']['traceback'][-1]['function'],'finalize_pcm_wav')
            self.assertIn('RIFF/WAVE detected',row['response_format'])
            self.assertEqual((directory/row['response_evidence']).read_bytes(),data.getvalue())
            self.assertFalse((directory/'spectrometer_A_tamil.wav').exists())
            self.assertEqual(result['actual_requests'],1)

    def test_streaming_placeholder_and_strict_chunk_validation(self):
        data=io.BytesIO()
        with wave.open(data,'wb') as wav:
            wav.setparams((1,2,22050,0,'NONE','not compressed'))
            wav.writeframes(b'\x01\x00'*2205)
        normal=data.getvalue()
        output,info=m.finalize_pcm_wav(normal)
        self.assertEqual(output,normal)
        self.assertFalse(info['placeholder_lengths'])
        placeholder=bytearray(normal)
        m.struct.pack_into('<I',placeholder,4,0xffffffff)
        m.struct.pack_into('<I',placeholder,40,0xffffffff)
        output,info=m.finalize_pcm_wav(bytes(placeholder))
        self.assertEqual(output,normal)
        self.assertTrue(info['placeholder_lengths'])
        malformed=bytearray(normal)
        m.struct.pack_into('<I',malformed,16,500000)
        for bad in (normal[:-2],normal[:-1],bytes(placeholder[:-1]),bytes(malformed),normal+b'x'):
            with self.assertRaises(ValueError): m.finalize_pcm_wav(bad)

    def test_separate_run_skips_matching_audio(self):
        data=io.BytesIO()
        with wave.open(data,'wb') as wav:
            wav.setparams((1,2,22050,0,'NONE','not compressed'))
            wav.writeframes(b'\x01\x00'*2205)
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            first=m.run(root/'first',lambda p:(200,data.getvalue()),lambda _:None)
            before=(root/'first/manifest.json').read_bytes()
            second=m.run(root/'second',lambda p:self.fail('matching sample must skip request'),reuse_root=root)
            self.assertEqual(second['actual_requests'],0)
            self.assertTrue(all(row['skipped_matching'] for row in second['candidates']))
            self.assertEqual(before,(root/'first/manifest.json').read_bytes())
