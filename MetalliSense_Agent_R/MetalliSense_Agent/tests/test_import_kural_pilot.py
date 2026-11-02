import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
import wave

spec = importlib.util.spec_from_file_location('pilot_import', Path(__file__).parents[1] / 'tools/import_kural_pilot.py')
pilot = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pilot)


class ImportTests(unittest.TestCase):
    def fixture(self, root):
        source = root / 'Downloads'
        source.mkdir()
        converter = root / 'converter.exe'
        converter.write_bytes(b'mock converter')
        row = dict(pilot_id='kural-personal-pilot-v1', recording_id='id1', original_recording_id='id1',
                   speaker_id='SPK01', session_id='S01_TRAIN', split='train', kind='positives', prompt_id='KP01',
                   prompt='Kural', condition='quiet', echo_playback=False, consent=dict(granted=True, at='now'),
                   filename='id1.webm', heard_wake_intervals=None, annotation_status='pending listening annotation')
        (source / 'id1.webm').write_bytes(b'mock original')
        (source / 'id1.json').write_text(json.dumps(row))
        journal = source / 'journal.json'
        journal.write_text(json.dumps(dict(pilot_id='kural-personal-pilot-v1', records=[row])))
        return source, converter, row, journal

    def runner(self, args, **kwargs):
        self.assertEqual(kwargs['timeout'], 60)
        self.assertIn('-n', args)
        with wave.open(args[-1], 'wb') as out:
            out.setparams((1, 2, 16000, 0, 'NONE', 'not compressed'))
            out.writeframes(b'\0\0' * 16000)
        return subprocess.CompletedProcess(args, 0, '', '')

    def test_preservation_reuse_and_labels_not_accepted(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source, converter, row, journal = self.fixture(root)
            before = {p.name: p.read_bytes() for p in source.iterdir()}
            report, evidence = pilot.run(journal, source, root / 'dest', converter, self.runner)
            self.assertEqual(report['summary']['matched_positives'], 1)
            self.assertEqual(report['summary']['accepted_ground_truth_labels'], 0)
            self.assertEqual(report['summary']['annotations_present'], 0)
            self.assertTrue((evidence / 'index.html').is_file())
            self.assertEqual({p.name:p.read_bytes() for p in source.iterdir()}, before)
            second, next_evidence = pilot.run(journal, source, root / 'dest', converter, self.runner)
            self.assertNotEqual(next_evidence, evidence)
            self.assertEqual(second['summary']['valid_audio_pairs'], 1)

    def test_missing_pair_not_guessed(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source, converter, _, journal = self.fixture(root)
            (source / 'id1.json').unlink()
            report, _ = pilot.run(journal, source, root / 'dest', converter,
                                  lambda *a, **kw:self.fail('must not decode'))
            self.assertEqual(report['summary']['matched_positives'], 0)
            self.assertIn('missing_pair', report['results'][0]['issues'][0])

    def test_duplicate_ids_not_counted_twice(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source, converter, row, journal = self.fixture(root)
            journal.write_text(json.dumps(dict(pilot_id='kural-personal-pilot-v1', records=[row, row])))
            report, _ = pilot.run(journal, source, root / 'dest', converter,
                                  lambda *a, **kw:self.fail('must not decode'))
            self.assertEqual(report['summary']['duplicate_manifest_ids'], {'id1':2})
            self.assertEqual(report['summary']['valid_audio_pairs'], 0)

    def test_conflicting_destination_preflight_preserves_everything(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source, converter, _, journal = self.fixture(root)
            target = root / 'dest/originals/id1.webm'
            target.parent.mkdir(parents=True)
            target.write_bytes(b'existing different recording')
            with self.assertRaisesRegex(ValueError, 'Conflicting destination'):
                pilot.run(journal, source, root / 'dest', converter, self.runner)
            self.assertEqual(target.read_bytes(), b'existing different recording')
            self.assertEqual((source / 'id1.webm').read_bytes(), b'mock original')
            self.assertFalse(list((root / 'dest').glob('validation-*')))

    def test_validation_session_excluded(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source, converter, row, journal = self.fixture(root)
            row.update(session_id='S02_VALID', split='validation')
            journal.write_text(json.dumps(dict(pilot_id='kural-personal-pilot-v1', records=[row])))
            report, _ = pilot.run(journal, source, root / 'dest', converter,
                                  lambda *a, **kw:self.fail('must not decode'))
            self.assertEqual(report['summary']['excluded_records'], 1)
            self.assertFalse((root / 'dest/originals/id1.webm').exists())

    def test_explicit_s02_import_keeps_validation_split(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source, converter, row, journal = self.fixture(root)
            row.update(session_id='S02_VALID', split='validation')
            (source / 'id1.json').write_text(json.dumps(row))
            journal.write_text(json.dumps(dict(pilot_id='kural-personal-pilot-v1', records=[row])))
            report, evidence = pilot.run(journal, source, root / 'S02_VALID', converter, self.runner,
                                        session_id='S02_VALID', split='validation')
            self.assertEqual(report['summary']['target_positives'], 20)
            self.assertEqual(report['results'][0]['record']['split'], 'validation')
            self.assertIn('SPK01 / S02_VALID', (evidence / 'index.html').read_text(encoding='utf-8'))

    def test_invalid_pcm_and_annotation_bounds(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source, converter, row, journal = self.fixture(root)
            annotation = dict(row, heard_wake_intervals=[dict(start_seconds=0.5, end_seconds=2)])
            (source / 'id1.annotation.json').write_text(json.dumps(annotation))
            report, _ = pilot.run(journal, source, root / 'dest', converter, self.runner)
            self.assertIn('annotation_intervals_invalid_or_unvalidated', report['results'][0]['issues'])
            def bad(args, **kwargs):
                Path(args[-1]).write_bytes(b'not a WAV')
                return subprocess.CompletedProcess(args, 0, '', '')
            report, _ = pilot.run(journal, source, root / 'dest', converter, bad)
            self.assertEqual(report['summary']['decode_errors'], 1)

    def test_topup_relationships_and_separate_batch_targets(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source, converter, row, journal = self.fixture(root)
            row.update(collection_type='s01_topup_v1', topup_batch_id='batch1', prompt_id='TP01',
                       capture_requirement_met=True, replaces_recording_id='aff7301e-74b4-40f4-ab27-fd41140ec8a7')
            data = dict(pilot_id='kural-personal-pilot-v1', collection_type='s01_topup_v1',
                        topup_batch_id='batch1', complete=False, records=[row])
            (source / 'id1.json').write_text(json.dumps(row))
            journal.write_text(json.dumps(data))
            report, _ = pilot.run(journal, source, root / 'dest', converter, self.runner)
            self.assertEqual(report['summary']['target_positives'], 1)
            self.assertEqual(report['summary']['target_background_seconds'], 10)
            self.assertEqual(report['summary']['accepted_ground_truth_labels'], 0)
            self.assertEqual(report['results'][0]['record']['replaces_recording_id'], row['replaces_recording_id'])
            self.assertFalse(report['results'][0]['issues'])
            row['replaces_recording_id'] = 'wrong'
            _, selected, _ = pilot.inspect(journal, source)  # original journal still valid
            self.assertFalse(selected[0]['issues'])
            journal.write_text(json.dumps(data))
            _, selected, _ = pilot.inspect(journal, source)
            self.assertIn('topup_relationship_mismatch', selected[0]['issues'])

    def test_topup_background_actual_duration_rechecked(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source, converter, row, journal = self.fixture(root)
            row.update(collection_type='s01_topup_v1', topup_batch_id='batch1', prompt_id='TB01',
                       kind='background_seconds', capture_requirement_met=True)
            (source / 'id1.json').write_text(json.dumps(row))
            journal.write_text(json.dumps(dict(pilot_id='kural-personal-pilot-v1',
                collection_type='s01_topup_v1', topup_batch_id='batch1', records=[row])))
            report, _ = pilot.run(journal, source, root / 'dest', converter, self.runner)
            self.assertIn('topup_background_below_10_decoded_seconds', report['results'][0]['issues'])
            self.assertEqual(report['summary']['decoded_background_seconds'], 1)
