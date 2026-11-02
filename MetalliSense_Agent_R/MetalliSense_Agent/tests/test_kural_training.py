import copy
import json
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import unittest
import wave

TOOLS = Path(__file__).parents[1] / 'tools'
sys.path.insert(0, str(TOOLS))
import kural_training as pipeline


class PipelineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.audio_temp = tempfile.TemporaryDirectory()
        cls.audio = Path(cls.audio_temp.name)
        cls.config = pipeline.read(pipeline.CONFIG)
        cls.manifests, cls.annotations = {}, {}
        serial = 0
        for session, split, positives, negatives in [('S01_TRAIN', 'train', 40, 60), ('S02_VALID', 'validation', 20, 30)]:
            entries, records = [], {}
            for kind, count in [('positives', positives), ('negatives', negatives), ('background_seconds', 10)]:
                for index in range(count):
                    serial += 1
                    rid = f'{session}-{kind}-{index}'
                    wav = cls.audio / (rid + '.wav')
                    duration = 30 if kind == 'background_seconds' else 2
                    with wave.open(str(wav), 'wb') as audio:
                        audio.setparams((1,2,16000,0,'NONE','not compressed'))
                        audio.writeframes(struct.pack('<h', serial)*int(duration*16000))
                    entry = dict(recording_id=rid, original_recording_id=rid, session_id=session, split=split, speaker_id='SPK01',
                        kind=kind, echo_case=kind=='background_seconds' and index==0,
                        consent={'granted':True,'at':'fixture'}, content_approved=True, review_source='user',
                        wav=str(wav), wav_sha256=pipeline.digest(wav), **pipeline.pcm_info(wav))
                    entries.append(entry)
                    records[rid] = dict(human_reviewed=True, content_approved=True,
                        wake_intervals=[dict(start_seconds=0.4,end_seconds=0.8,source='human')] if kind=='positives' else [],
                        wake_absence_confirmed=kind!='positives')
            manifest = dict(session_id=session, split=split, speaker_id='SPK01', excluded_recording_ids=[pipeline.EXCLUDED], entries=entries)
            cls.manifests[session] = manifest
            cls.annotations[session] = dict(dataset_fingerprint=pipeline.fingerprint(manifest), records=records)

    @classmethod
    def tearDownClass(cls):
        cls.audio_temp.cleanup()

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.manifests = copy.deepcopy(type(self).manifests)
        self.annotations = copy.deepcopy(type(self).annotations)
        self.publish()

    def publish(self):
        for folder in ['datasets','annotations']:
            (self.root/folder).mkdir(exist_ok=True)
        for session, manifest in self.manifests.items():
            (self.root/'datasets'/(session+'.json')).write_text(json.dumps(manifest))
            ann = self.annotations[session]
            ann['dataset_fingerprint'] = pipeline.fingerprint(manifest)
            (self.root/'annotations'/(session+'.annotations.json')).write_text(json.dumps(ann))

    def test_shared_context_pads_left_and_matches_offline_replay(self):
        from kural_audio_features import causal_context, offline_context
        class Arrays:
            @staticmethod
            def pad(values, pads):
                return [0]*pads[0]+list(values)+[0]*pads[1]
        config=dict(sample_rate=1,window_samples=4)
        self.assertEqual(causal_context([1,2],2,4,Arrays),[0,0,1,2])
        for samples,start in [([],0),([1,2],0),(list(range(10)),2),(list(range(10)),9)]:
            end=min(round(start)+4,len(samples))
            self.assertEqual(offline_context(samples,start,config,Arrays),causal_context(samples,end,4,Arrays))
        with self.assertRaises(ValueError):causal_context([1],2,4,Arrays)
        with self.assertRaises(ValueError):causal_context([1],-1,4,Arrays)

    def test_overfit_diagnostic_is_default_off(self):
        result=subprocess.run([sys.executable,str(TOOLS/'kural_overfit_diagnostic.py')],capture_output=True,text=True,timeout=20)
        self.assertEqual(result.returncode,0)
        self.assertIn('Disabled',result.stdout)

    def test_preprocessing_check_is_default_off_and_refuses_agent_environment(self):
        tool = TOOLS / 'check_kural_preprocessing.py'
        off = subprocess.run([sys.executable, str(tool)], capture_output=True, text=True, timeout=20)
        self.assertEqual(off.returncode, 0)
        self.assertIn('Disabled', off.stdout)
        wrong = subprocess.run([sys.executable, str(tool), '--check'], capture_output=True, text=True, timeout=20)
        self.assertNotEqual(wrong.returncode, 0)
        self.assertIn('isolated training interpreter', wrong.stderr)

    def test_rms_proposals_use_pcm_padding_and_preserve_ambiguity(self):
        silence = [0] * 16000
        speech = [4000, -4000] * 2400
        self.assertEqual(pipeline.suggest_speech_regions(silence), [])
        samples = silence + speech + silence
        regions = pipeline.suggest_speech_regions(samples)
        self.assertEqual(len(regions), 1)
        self.assertLessEqual(regions[0]['start_seconds'], 0.8)
        self.assertGreaterEqual(regions[0]['end_seconds'], 1.55)
        multiple = pipeline.suggest_speech_regions(samples + speech + silence)
        self.assertEqual(len(multiple), 2)
        self.assertTrue(all(0 <= r['start_seconds'] < r['end_seconds'] <= len(samples + speech + silence)/16000 for r in multiple))
        self.assertEqual(pipeline.suggest_speech_regions([3000]*32000), [])

    def test_annotation_resume_updates_same_path_without_changing_dataset_or_prior_page(self):
        manifest = copy.deepcopy(self.manifests['S01_TRAIN'])
        manifest['entries'] = manifest['entries'][:3]
        before = pipeline.fingerprint(manifest)
        page = pipeline.annotation_page(manifest, self.root)
        old = page.read_bytes()
        checkpoint, following = [e['recording_id'] for e in manifest['entries'][:2]]
        result = pipeline.annotation_page(manifest, self.root, resume_after=checkpoint,
                                          resume_next=following, update_page=page)
        self.assertEqual(result, page)
        self.assertEqual(pipeline.fingerprint(manifest), before)
        self.assertEqual(next(self.root.glob('*.bak')).read_bytes(), old)
        import re
        payload = json.loads(re.search(r'const DATA=(.*?);\s*const q=', page.read_text(), re.S).group(1))
        self.assertEqual(payload['dataset_fingerprint'], before)
        self.assertEqual(payload['navigation_resume']['after_recording_id'], checkpoint)
        self.assertNotIn('records', payload)
        self.assertTrue(all('speech_suggestions' in e for e in payload['entries']))
        self.assertNotIn('navigation_resume', manifest)
        current = page.read_bytes()
        with self.assertRaisesRegex(ValueError, 'dataset order'):
            pipeline.annotation_page(manifest, self.root, resume_after=checkpoint,
                                     resume_next=manifest['entries'][2]['recording_id'], update_page=page)
        self.assertEqual(page.read_bytes(), current)
        changed = copy.deepcopy(manifest)
        changed['speaker_id'] = 'changed'
        with self.assertRaisesRegex(ValueError, 'dataset mismatch'):
            pipeline.annotation_page(changed, self.root, update_page=page)
        self.assertEqual(page.read_bytes(), current)

    def test_complete_data_is_ready_but_missing_s02_cannot_launch(self):
        self.assertTrue(pipeline.validate(self.config,self.root)['ready'])
        (self.root/'datasets/S02_VALID.json').unlink()
        audit = pipeline.validate(self.config,self.root)
        self.assertFalse(audit['ready'])
        self.assertTrue(any('Missing separate' in s for s in audit['missing']))
        with self.assertRaisesRegex(ValueError,'gate blocked'):
            pipeline.launch(self.config,audit,{},self.root,runner=lambda *a,**kw:self.fail('must not train'))
        self.assertFalse((self.root/'baseline-reservation.json').exists())

    def test_unapproved_missing_boundaries_and_unconfirmed_absence_block(self):
        records = self.annotations['S01_TRAIN']['records']
        records['S01_TRAIN-positives-0']['human_reviewed'] = False
        records['S01_TRAIN-positives-1']['wake_intervals'] = None
        records['S01_TRAIN-negatives-0']['wake_absence_confirmed'] = False
        self.publish()
        audit = pipeline.validate(self.config,self.root)
        self.assertFalse(audit['ready'])
        self.assertTrue(any('explicit wake intervals' in s for s in audit['missing']))
        self.assertTrue(any('explicit no-wake' in s for s in audit['missing']))

    def test_excluded_recording_and_lineage_rejected(self):
        for field in ['recording_id','original_recording_id']:
            original = self.manifests['S01_TRAIN']['entries'][0][field]
            self.manifests['S01_TRAIN']['entries'][0][field] = pipeline.EXCLUDED
            self.annotations['S01_TRAIN']['records'] = {}  # isolate exclusion check from stale annotation keys
            self.publish()
            with self.assertRaisesRegex(ValueError,'Excluded'):
                pipeline.validate(self.config,self.root)
            self.manifests['S01_TRAIN']['entries'][0][field] = original

    def test_split_and_duplicate_pcm_leakage_rejected(self):
        train = self.manifests['S01_TRAIN']['entries'][0]
        val = self.manifests['S02_VALID']['entries'][0]
        val.update(wav=train['wav'],wav_sha256=train['wav_sha256'],pcm_sha256=train['pcm_sha256'])
        self.publish()
        with self.assertRaisesRegex(ValueError,'Cross-split duplicate PCM'):
            pipeline.validate(self.config,self.root)
        val['session_id']='S01_TRAIN'
        self.publish()
        with self.assertRaisesRegex(ValueError,'Cross-session'):
            pipeline.validate(self.config,self.root)

    def test_consent_and_annotation_snapshot_identity_rejected(self):
        self.manifests['S01_TRAIN']['entries'][0]['consent']['granted']=False
        self.publish()
        with self.assertRaisesRegex(ValueError,'consent'):
            pipeline.validate(self.config,self.root)
        self.manifests['S01_TRAIN']['entries'][0]['consent']['granted']=True
        self.publish()
        path=self.root/'annotations/S01_TRAIN.annotations.json'
        ann=pipeline.read(path);ann['dataset_fingerprint']='wrong';path.write_text(json.dumps(ann))
        with self.assertRaisesRegex(ValueError,'different dataset'):
            pipeline.validate(self.config,self.root)

    def test_positive_windows_only_contain_verified_complete_wake(self):
        row=copy.deepcopy(self.manifests['S01_TRAIN']['entries'][0])
        row['duration_seconds']=8
        row['annotation']=dict(wake_intervals=[dict(start_seconds=3.5,end_seconds=4.0,source='human')])
        windows=pipeline.windows(row,self.config)
        self.assertEqual(len(windows),1)
        self.assertLessEqual(windows[0]['start_seconds'],3.5)
        self.assertGreaterEqual(windows[0]['start_seconds']+2,4)
        self.assertEqual(windows[0]['label'],1)
        row.update(kind='background_seconds',echo_case=True)
        self.assertTrue(all(w['label']==2 for w in pipeline.windows(row,self.config)))

    def test_missing_dependency_and_wrong_interpreter_rejected(self):
        python=self.root/'environment/Scripts/python.exe'
        def runner(args,**kwargs):
            return subprocess.CompletedProcess(args,0,json.dumps(dict(prefix=str(python.parent.parent),versions={})), '')
        with self.assertRaisesRegex(ValueError,'dependency'):
            pipeline.dependency_probe(python,runner)
        def wrong(args,**kwargs):
            return subprocess.CompletedProcess(args,0,json.dumps(dict(prefix='C:/wrong',versions=pipeline.PINS)), '')
        with self.assertRaisesRegex(ValueError,'prefix'):
            pipeline.dependency_probe(python,wrong)

    def test_config_limits_and_resume_mismatches(self):
        for field,value in [('max_epochs',51),('training_wall_limit_seconds',3601)]:
            config=dict(self.config,**{field:value})
            with self.assertRaisesRegex(ValueError,'limits'):
                pipeline.validate(config,self.root)
        with self.assertRaisesRegex(ValueError,'mismatch'):
            pipeline.resume_check({'identity':{'config':'old'}},{'config':'new'})
        for state in [dict(epochs=50),dict(training_elapsed_seconds=3600),dict(status='complete')]:
            with self.assertRaises(ValueError):
                pipeline.resume_check(dict(identity={},**state),{})

    def test_best_checkpoint_not_overwritten_by_worse_epoch(self):
        (self.root/'best.keras').write_bytes(b'best checkpoint')
        (self.root/'later.keras').write_bytes(b'new checkpoint')
        state=dict(best_loss=None,wait=0)
        pipeline.checkpoint_progress(state,self.root,'best.keras',0.2,1,10)
        pipeline.checkpoint_progress(state,self.root,'later.keras',0.5,2,20)
        self.assertEqual(state['best_checkpoint'],'best.keras')
        self.assertEqual((self.root/'best.keras').read_bytes(),b'best checkpoint')
        self.assertEqual(state['wait'],1)

    def test_timeout_preserves_checkpoint_and_forbids_second_baseline(self):
        audit=dict(ready=True,entries=[],dataset_fingerprint='fixture')
        def timeout(args,**kwargs):
            self.assertLessEqual(kwargs['timeout'],3600)
            run=Path(args[-1]);(run/'best.keras').write_bytes(b'preserve')
            state=pipeline.read(run/'state.json');state.update(best_checkpoint='best.keras',best_checkpoint_sha256=pipeline.digest(run/'best.keras'))
            pipeline.atomic_json(run/'state.json',state)
            raise subprocess.TimeoutExpired(args,kwargs['timeout'])
        with self.assertRaises(subprocess.TimeoutExpired):
            pipeline.launch(self.config,audit,{},self.root,runner=timeout)
        run=Path(pipeline.read(self.root/'baseline-reservation.json')['run'])
        self.assertEqual((run/'best.keras').read_bytes(),b'preserve')
        self.assertEqual(pipeline.read(run/'state.json')['status'],'interrupted')
        with self.assertRaisesRegex(ValueError,'already reserved'):
            pipeline.launch(self.config,audit,{},self.root,runner=lambda *a,**kw:self.fail('no repeat'))

    def test_saved_prediction_denominators_and_echo_are_separate(self):
        predictions=[dict(recording_id='p',duration_seconds=3,echo_case=False,human_wakes=[dict(start_seconds=1,end_seconds=1.2)],times=[1.2,1.28],wake_scores=[.9,.9]),
                     dict(recording_id='n',duration_seconds=60,echo_case=False,human_wakes=[],times=[1,1.08],wake_scores=[.9,.9]),
                     dict(recording_id='e',duration_seconds=30,echo_case=True,human_wakes=[],times=[1,1.08],wake_scores=[.9,.9])]
        metrics=pipeline.metrics(predictions,.8,self.config)
        self.assertEqual(metrics['missed_wakes'],0)
        self.assertEqual(metrics['false_events_per_hour'],60)
        self.assertEqual(metrics['echo_events_per_hour'],120)
        self.assertFalse(metrics['streaming_latency_measured'])
        metrics=pipeline.metrics(predictions[:1],.8,self.config)
        self.assertIsNone(metrics['false_events_per_hour'])

    def test_isolated_setup_wrong_prefix_never_installs_and_failed_pip_no_retry(self):
        python=self.root/'environment/Scripts/python.exe'
        python.parent.mkdir(parents=True);python.write_bytes(b'mock launcher')
        calls=[]
        def wrong(args,**kwargs):
            calls.append(args)
            return subprocess.CompletedProcess(args,0,json.dumps(dict(prefix='C:/Agent',versions={})), '')
        with self.assertRaisesRegex(ValueError,'prefix'):
            pipeline.setup(self.root,wrong)
        self.assertEqual(len(calls),1)
        calls.clear()
        def blocked(args,**kwargs):
            calls.append(args)
            if '-c' in args:
                return subprocess.CompletedProcess(args,0,json.dumps(dict(prefix=str(python.parent.parent),versions={})), '')
            self.assertIn('--retries',args)
            self.assertEqual(args[args.index('--retries')+1],'0')
            self.assertNotIn(str(Path(sys.executable)) + ' -m pip',' '.join(args))
            return subprocess.CompletedProcess(args,1,'','socket blocked')
        with self.assertRaisesRegex(ValueError,'no retries'):
            pipeline.setup(self.root,blocked)
        self.assertEqual(sum('-m' in args and 'pip' in args for args in calls),1)
        self.assertTrue(list(self.root.glob('setup-*.log')))

    def test_saved_predictions_freeze_without_inference_and_reject_changes(self):
        config=self.config
        prediction=dict(evaluation_split='S02_VALID',dataset_fingerprint='fixture',model_loading_seconds=.1,
                        inference_processing_seconds=.2,records=[dict(recording_id='p',duration_seconds=3,echo_case=False,
                        human_wakes=[dict(start_seconds=1,end_seconds=1.2)],times=[1.2,1.28],wake_scores=[.9,.9])])
        pipeline.write_new(self.root/'config.json',config)
        pipeline.write_new(self.root/'dataset.json',dict(dataset_fingerprint='fixture'))
        pipeline.write_new(self.root/'predictions.json',prediction)
        pipeline.write_new(self.root/'state.json',dict(identity={'config':config},predictions_sha256=pipeline.digest(self.root/'predictions.json')))
        result=pipeline.evaluate(self.root)
        self.assertFalse(result['final_test'])
        self.assertFalse(result['live_activation_approved'])
        self.assertIsNone(result['metrics']['false_events_per_hour'])
        before=(self.root/'validation-decision-frozen.json').read_bytes()
        pipeline.evaluate(self.root)
        self.assertEqual((self.root/'validation-decision-frozen.json').read_bytes(),before)
        (self.root/'predictions.json').write_text('{}')
        with self.assertRaisesRegex(ValueError,'integrity'):
            pipeline.evaluate(self.root)
