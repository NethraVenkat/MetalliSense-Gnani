import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
import wave

sys.path.insert(0, str(Path(__file__).parents[1]/'tools'))
import prepare_kural_session_review as review


class SessionReviewTests(unittest.TestCase):
    def test_generation_preserves_sources_and_previous_page(self):
        with tempfile.TemporaryDirectory() as temporary:
            tools=Path(temporary)/'tools';tools.mkdir()
            template=Path(review.__file__).with_name('kural_session_review.html').read_bytes()
            (tools/'kural_session_review.html').write_bytes(template)
            root=tools/'local_wake_data/kural-cnn-v1'
            session=root/'live-diagnostics/session-fixture';session.mkdir(parents=True)
            audio=session/'capture.wav'
            with wave.open(str(audio),'wb') as wav:
                wav.setparams((1,2,16000,0,'NONE','not compressed'));wav.writeframes(b'\x01\x00'*16001)
            (session/'scores.jsonl').write_text('original scores')
            hashes={p.name:review.digest(p) for p in session.iterdir()}
            folder=root/'review';folder.mkdir();(folder/'index.html').write_text('previous page')
            (folder/'review.json').write_text(json.dumps(dict(session='fixture',audio=dict(sha256=review.digest(audio)),preserved_session_hashes=hashes,events=[])))
            with patch.object(review,'__file__',str(tools/'prepare_kural_session_review.py')):
                result=review.prepare(folder)
                self.assertIn('குரல்',result.read_text(encoding='utf-8'))
                self.assertEqual(next(folder.glob('index-before-*')).read_text(),'previous page')
                self.assertEqual(hashes,{p.name:review.digest(p) for p in session.iterdir()})
                (session/'scores.jsonl').write_text('changed')
                before=result.read_bytes()
                with self.assertRaisesRegex(ValueError,'hash mismatch'):review.prepare(folder)
                self.assertEqual(result.read_bytes(),before)


if __name__=='__main__':unittest.main()
