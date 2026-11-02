from collections import Counter
import copy
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).parents[1]/'tools'))
import kural_negative_context_experiment as repair
import kural_binary_experiment as binary
import kural_training as k


class NegativeContextTests(unittest.TestCase):
    def setUp(self):
        self.config=k.read(repair.CONFIG)
        self.group={'wake':['p'+str(i) for i in range(40)],'ordinary':['n'+str(i) for i in range(81)],'echo':['e'+str(i) for i in range(4)]}
        self.fc=k.read(k.CONFIG)

    def row(self,kind='negatives',session='S01_TRAIN',frames=40000):
        return dict(recording_id='r',session_id=session,split='train' if session=='S01_TRAIN' else 'validation',kind=kind,
                    echo_case=False,duration_seconds=frames/16000,frames=frames,
                    annotation=dict(wake_intervals=[dict(start_seconds=.3,end_seconds=.7,source='human')] if kind=='positives' else [],wake_absence_confirmed=kind!='positives'))

    def test_exact_balanced_counts_unique_sources_and_support_strata(self):
        for epoch in range(50):
            batches=repair.epoch_batches(self.group,epoch,self.config)
            self.assertEqual(len(batches),5)
            for batch in batches:
                self.assertEqual(Counter(s['label'] for s in batch),{0:8,1:8})
                self.assertEqual(sum(s['stratum']=='prefix' for s in batch),4)
                self.assertEqual(sum(s['stratum'] in ('quiet_regular','regular_rotating') for s in batch),4)
            selected=[s for batch in batches for s in batch]
            self.assertEqual(len({s['recording_id'] for s in selected}),80)
            self.assertEqual(Counter(s['stratum'] for s in selected),{'complete_wake':40,'prefix':20,'quiet_regular':10,'regular_rotating':10})
            nonwake=[s for s in selected if s['label']==0]
            self.assertEqual(sum(s['recording_id'].startswith('e') for s in nonwake),4)
            self.assertEqual(sum(s['recording_id'].startswith('n') for s in nonwake),36)
            self.assertEqual(Counter(s['prefix_seconds'] for s in selected if s['stratum']=='prefix'),{.08:5,.16:5,.5:5,1.0:5})
        self.assertEqual(repair.epoch_batches(self.group,0,self.config),repair.epoch_batches(self.group,0,self.config))
        self.assertNotEqual(repair.epoch_batches(self.group,0,self.config),repair.epoch_batches(self.group,1,self.config))

    def test_regular_first_dedup_prefix_and_no_validation_expansion(self):
        e=self.row();original=binary.candidates(e,self.fc);values=repair.contexts(e,self.fc)
        self.assertEqual(values[0]['end_sample'],original[0]['end_sample'])
        self.assertEqual(len({w['end_sample'] for w in values}),len(values))
        self.assertEqual({w['end_sample'] for w in values if not w['regular']},{1280,2560,8000,16000})
        val=repair.contexts(self.row(session='S02_VALID'),self.fc)
        self.assertTrue(all(w['regular'] and not w['prefix_seconds'] for w in val))
        short=repair.contexts(self.row(frames=8000),self.fc)
        self.assertEqual(len(short),3)
        same=next(w for w in short if w['end_sample']==8000)
        self.assertTrue(same['regular']);self.assertEqual(same['prefix_seconds'],[.5,1.0])

    def test_complete_positive_unchanged_and_absence_required_for_negatives(self):
        positive=self.row(kind='positives',frames=20000)
        actual=repair.contexts(positive,self.fc)
        self.assertEqual([(w['end_sample'],w['label']) for w in actual],[(w['end_sample'],w['label']) for w in binary.candidates(positive,self.fc)])
        self.assertTrue(all(w['regular'] and not w['prefix_seconds'] for w in actual))
        for w in actual:
            self.assertLessEqual(w['end_sample']/16000-2,.3)
            self.assertGreaterEqual(w['end_sample']/16000,.7)
        bad=self.row();bad['annotation']['wake_absence_confirmed']=False
        with self.assertRaises(ValueError):repair.contexts(bad,self.fc)
        bad=self.row();bad['annotation']['wake_intervals']=[{'start_seconds':.1,'end_seconds':.2}]
        with self.assertRaises(ValueError):repair.contexts(bad,self.fc)

    def test_selection_quiet_rank_does_not_change_labels(self):
        values=repair.contexts(self.row(),self.fc);rms=[.3,.1]+[0]*(len(values)-2)
        self.assertEqual(repair.select_context({'stratum':'quiet_regular'},values,rms,0),1)
        self.assertEqual(repair.select_context({'stratum':'regular_rotating'},values,rms,0),0)
        for seconds in repair.PREFIX_SECONDS:
            i=repair.select_context({'stratum':'prefix','prefix_seconds':seconds},values,rms,0)
            self.assertEqual(values[i]['end_sample'],round(seconds*16000))
            self.assertEqual(values[i]['label'],0)

    def test_normalization_must_equal_prior_and_limits_unchanged(self):
        class Arrays:
            @staticmethod
            def array(value,dtype=None):return value
            @staticmethod
            def array_equal(a,b):return a==b
        with patch.object(k,'read',return_value={'fitted_recordings':['S01'],'mean':[1],'std':[2]}):
            repair.verify_normalization([1],[2],['S01'],Arrays)
            with self.assertRaises(ValueError):repair.verify_normalization([1],[2],['S02'],Arrays)
            with self.assertRaises(ValueError):repair.verify_normalization([2],[2],['S01'],Arrays)
        prior=k.read(binary.CONFIG)
        for key in ('classes','seed','conv_filters','batch_size','learning_rate','augmentation','max_epochs','early_stopping_patience','stopping_monitor','wall_limit_seconds','qualification','threshold_candidates','decision_consecutive_frames','decision_cooldown_seconds','event_match_grace_seconds'):
            self.assertEqual(self.config[key],prior[key],key)

    def test_primary_evaluation_stays_ungated_all_twenty_and_allmiss_rejected(self):
        rows=[dict(recording_id=str(i),human_wakes=[dict(start_seconds=.1,end_seconds=.5)],echo_case=False,duration_seconds=1,times=[.08,.16],wake_scores=[.99,.99],context_eligible=[False,False]) for i in range(20)]
        rows.extend([dict(recording_id='n',human_wakes=[],echo_case=False,duration_seconds=275.28,times=[.08,.16],wake_scores=[.01,.01]),dict(recording_id='e',human_wakes=[],echo_case=True,duration_seconds=59.64,times=[.08,.16],wake_scores=[.01,.01])])
        accepted=binary.evaluate_predictions(rows,self.config)
        self.assertEqual(accepted['qualified_threshold'],.9)
        self.assertTrue(all(c['metrics']['annotated_human_wakes']==20 for c in accepted['candidates']))
        for r in rows[:20]:r['wake_scores']=[.01,.01]
        self.assertIsNone(binary.evaluate_predictions(rows,self.config)['qualified_threshold'])

    def test_default_off_and_isolated_worker_required(self):
        r=subprocess.run([sys.executable,str(repair.CONFIG.with_name('kural_negative_context_experiment.py'))],capture_output=True,text=True,timeout=20)
        self.assertEqual(r.returncode,0);self.assertIn('Disabled',r.stdout)


if __name__=='__main__':unittest.main()
