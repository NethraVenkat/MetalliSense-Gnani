import json
from pathlib import Path
import sys
import unittest
sys.path.insert(0,str(Path(__file__).parents[1]/'tools'))
import f14_tamil_audition as batch
from spectrometer_audition import wav_info

class RevisionTests(unittest.TestCase):
    def test_only_mechanical_text_and_fingerprint_change(self):
        old=json.loads((batch.OUTPUT/'manifest.json').read_text(encoding='utf-8'))['rows']
        new=json.loads(batch.FIXTURE.read_text(encoding='utf-8'))
        changed=[]
        for before,after in zip(old,new):
            self.assertEqual(before['id'],after['id'])
            if batch.fingerprint(batch.settings_for(before))!=batch.fingerprint(batch.settings_for(after)):
                changed.append(after['id'])
            self.assertEqual(wav_info((batch.OUTPUT/before['file']).read_bytes())['sha256'],before['sha256'])
        self.assertEqual(changed,['mechanical-properties'])
        self.assertEqual(batch.settings_for(new[14])['language'],'hi-IN')
        self.assertNotIn('speed',batch.settings_for(new[14]))
