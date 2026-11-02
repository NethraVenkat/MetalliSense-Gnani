from pathlib import Path
import sys
import unittest
import tempfile
import json
sys.path.insert(0,str(Path(__file__).parents[1]/'tools'))
import kural_paired_v2_preflight as p


class PairedPreflightTests(unittest.TestCase):
    def test_forbidden_paths_and_hashes(self):
        for name in ['devval-v1/a.wav','S02_VALID/a.wav','S03_TEST_RESERVED/a.wav','live-diagnostics/x.wav','train/rejected/a.wav']:
            with self.assertRaises(ValueError):p.no_leakage([dict(wav=name,wav_sha256='a',pcm_sha256='b')],set())
        for hashes in [{'a'},{'b'}]:
            with self.assertRaises(ValueError):p.no_leakage([dict(wav='train/accepted/a.wav',wav_sha256='a',pcm_sha256='b')],hashes)
        p.no_leakage([dict(wav='S01_TRAIN/a.wav',wav_sha256='a',pcm_sha256='b')],{'c'})

    def test_content_approval_is_not_boundary_review(self):
        entry=dict(task_id='A01',wav='a.wav',wav_sha256='a',duration_seconds=3,meta=dict(label='wake',content_reviewed=True,boundary_reviewed=False,wake_intervals=[]))
        self.assertEqual(len(p.missing_boundaries([entry])),1)
        entry['meta'].update(boundary_reviewed=True,wake_intervals=[dict(start_seconds=.5,end_seconds=1,source='human')])
        self.assertEqual(p.missing_boundaries([entry]),[])

    def test_fixed_thresholds(self):
        self.assertEqual(p.THRESHOLDS,(.5,.65,.8,.9))

    def test_append_only_overlay_identity_and_no_source_mutation(self):
        with tempfile.TemporaryDirectory() as temp:
            folder=Path(temp);(folder/'manifest.json').write_text('{}');reviews=folder/'boundary-reviews/manish';reviews.mkdir(parents=True)
            original=dict(label='wake',boundary_reviewed=False,wake_intervals=[])
            entry=dict(task_id='manish-A01-wake',recording_id='clip-id',label='wake',wav_sha256='a'*64,duration_seconds=3,meta=original)
            review=dict(schema='kural-paired-boundary-review-v1',designation='train-paired-v1',speaker='manish',test_only=False,human_reviewed=True,task_id=entry['task_id'],recording_id='clip-id',audio_sha256='a'*64,manifest_sha256=p.k.digest(folder/'manifest.json'),wake_intervals=[dict(start_seconds=.3,end_seconds=.8,source='human')])
            file=reviews/'01.json';file.write_text(json.dumps(review));before=file.read_bytes()
            p.apply_boundary_reviews([entry],folder)
            self.assertTrue(entry['meta']['boundary_reviewed']);self.assertFalse(original['boundary_reviewed']);self.assertEqual(file.read_bytes(),before)
            review['audio_sha256']='b'*64;file.write_text(json.dumps(review))
            with self.assertRaisesRegex(ValueError,'provenance'):p.apply_boundary_reviews([entry],folder)


if __name__=='__main__':unittest.main()
