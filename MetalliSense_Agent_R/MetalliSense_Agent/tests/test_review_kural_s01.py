import copy
import importlib.util
from pathlib import Path
import sys
import unittest

TOOLS = Path(__file__).parents[1] / 'tools'
sys.path.insert(0, str(TOOLS))
import review_kural_s01 as review


class ReviewTests(unittest.TestCase):
    def row(self, rid, kind='positives', **extra):
        record = dict(recording_id=rid, original_recording_id=rid, speaker_id='SPK01', session_id='S01_TRAIN',
                      split='train', kind=kind, prompt_id='KP03', prompt='prompt only', consent={'granted':True})
        record.update(extra)
        return dict(record=record, file_status='valid_audio_pair', issues=[], duration_seconds=12 if kind == 'background_seconds' else 3,
                    echo_case=kind == 'background_seconds', wav=rid + '.wav', wav_sha256='fixture')

    def fixture(self):
        original = dict(results=[self.row(rid) for rid in sorted(review.WAKE_ONLY)] +
                        [self.row(review.EXCLUDED), self.row(review.AND_ONLY, 'negatives'),
                         self.row('remaining-positive'), self.row('echo', 'background_seconds')])
        topup = dict(summary={'topup_batch_id':review.BATCH}, results=[
            self.row('new-positive', prompt_id='TP01', topup_batch_id=review.BATCH, replaces_recording_id=review.EXCLUDED),
            self.row('new-negative', 'negatives', prompt_id='TN01', topup_batch_id=review.BATCH, supplements_recording_id=review.AND_ONLY),
            self.row('new-background', 'background_seconds', prompt_id='TB01', topup_batch_id=review.BATCH)])
        topup['results'][2]['echo_case'] = False
        return original, topup

    def test_user_content_review_preserves_sources_and_pending_topup(self):
        original, topup = self.fixture()
        before = copy.deepcopy((original, topup))
        result = review.overlay(original, topup)
        self.assertEqual((original, topup), before)
        by_id = {r['recording_id']:r for r in result['entries']}
        for rid in review.WAKE_ONLY:
            self.assertEqual(by_id[rid]['utterance_type'], 'wake_only')
            self.assertTrue(by_id[rid]['usable_after_content_review'])
        self.assertTrue(by_id[review.EXCLUDED]['excluded_from_training'])
        self.assertFalse(by_id[review.EXCLUDED]['usable_after_content_review'])
        self.assertEqual(by_id[review.AND_ONLY]['user_reported_content'], 'and')
        self.assertEqual(by_id[review.AND_ONLY]['kind'], 'negatives')
        self.assertTrue(by_id['echo']['echo_case'])
        for rid in ['new-positive','new-negative','new-background']:
            self.assertEqual(by_id[rid]['content_status'], 'pending user listening review')
            self.assertFalse(by_id[rid]['usable_after_content_review'])
        self.assertTrue(all(r['wake_intervals'] is None for r in result['entries']))
        self.assertEqual(result['summary']['approved_content_counts']['positives'], 5)
        self.assertEqual(result['summary']['provisional_counts_including_pending_topup']['positives'], 6)
        self.assertEqual(result['summary']['topup_pending_review'], 3)
        self.assertFalse(result['summary']['training_ready'])

    def test_missing_duplicate_or_wrong_split_rejected(self):
        original, topup = self.fixture()
        with self.assertRaisesRegex(ValueError, 'absent/ambiguous'):
            review.overlay(dict(results=original['results'][1:]), topup)
        with self.assertRaisesRegex(ValueError, 'absent/ambiguous'):
            review.overlay(dict(results=original['results'] + [original['results'][0]]), topup)
        original['results'][0]['record']['split'] = 'validation'
        with self.assertRaisesRegex(ValueError, 'Cross-session'):
            review.overlay(original, topup)

    def test_explicit_topup_content_approval_supplies_no_timings(self):
        original, topup = self.fixture()
        before = copy.deepcopy((original, topup))
        result = review.overlay(original, topup, approve_topup=True)
        self.assertEqual((original, topup), before)
        self.assertEqual(result['summary']['topup_pending_review'], 0)
        self.assertEqual(result['summary']['user_approved_topup_content'], 3)
        self.assertEqual(result['summary']['approved_content_counts'],
                         result['summary']['provisional_counts_including_pending_topup'])
        self.assertTrue(all(r['wake_intervals'] is None for r in result['entries']))
        self.assertEqual(result['summary']['excluded_originals'], 1)
        self.assertEqual(result['summary']['echo_cases'], 1)
        self.assertFalse(result['summary']['training_ready'])

    def test_wrong_batch_relationship_or_invalid_file_not_approved(self):
        original, topup = self.fixture()
        topup['summary']['topup_batch_id'] = 'wrong'
        with self.assertRaisesRegex(ValueError, 'Wrong top-up'):
            review.overlay(original, topup)
        topup['summary']['topup_batch_id'] = review.BATCH
        topup['results'][0]['record']['replaces_recording_id'] = 'wrong'
        with self.assertRaisesRegex(ValueError, 'Wrong replacement'):
            review.overlay(original, topup)
        topup['results'][0]['record']['replaces_recording_id'] = review.EXCLUDED
        topup['results'][0]['issues'] = ['decode mismatch']
        with self.assertRaisesRegex(ValueError, 'Resolve file'):
            review.overlay(original, topup)
