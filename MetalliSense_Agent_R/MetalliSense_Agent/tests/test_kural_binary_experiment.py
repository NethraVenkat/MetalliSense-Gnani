import copy
import json
from pathlib import Path
import subprocess
import sys
import unittest
sys.path.insert(0,str(Path(__file__).parents[1]/'tools'))
import kural_binary_experiment as binary


class BinaryTests(unittest.TestCase):
    def setUp(self):
        self.config=binary.k.read(binary.CONFIG)
        self.groups={'wake':['p'+str(i) for i in range(40)],'ordinary':['n'+str(i) for i in range(81)],'echo':['e'+str(i) for i in range(4)]}

    def test_balanced_batches_unique_recordings_deterministic_and_rotating(self):
        first=binary.epoch_batches(self.groups,0,self.config)
        self.assertEqual(first,binary.epoch_batches(self.groups,0,self.config))
        self.assertNotEqual(first,binary.epoch_batches(self.groups,1,self.config))
        self.assertEqual(len(first),5)
        for batch in first:
            self.assertEqual(sum(label for rid,label in batch),8)
            self.assertEqual(len(batch),16)
        flat=[pair for batch in first for pair in batch]
        self.assertEqual(len(set(rid for rid,label in flat)),80)
        self.assertEqual(sum(rid.startswith('e') for rid,label in flat),4)
        self.assertEqual(sum(rid.startswith('n') for rid,label in flat),36)

    def test_short_tail_endpoint_dedup_and_binary_echo_label(self):
        entry=dict(recording_id='echo',kind='background_seconds',echo_case=True,duration_seconds=2.5,frames=40000,annotation={'wake_intervals':[]})
        fc=binary.k.read(binary.k.CONFIG)
        values=binary.candidates(entry,fc)
        self.assertEqual([w['end_sample'] for w in values],[32000,40000])
        self.assertTrue(all(w['label']==0 for w in values))

    def test_split_and_echo_absence_gates(self):
        e=dict(recording_id='x',session_id='S01_TRAIN',split='train',kind='background_seconds',echo_case=True,annotation={'wake_intervals':[],'wake_absence_confirmed':True})
        self.assertEqual(binary.groups([e],'S01_TRAIN')['echo'],['x'])
        changed=copy.deepcopy(e);changed['annotation']['wake_intervals']=[{'source':'playback'}]
        with self.assertRaises(ValueError):binary.groups([changed],'S01_TRAIN')
        changed=copy.deepcopy(e);changed['split']='validation'
        with self.assertRaises(ValueError):binary.groups([changed],'S01_TRAIN')
        self.assertEqual(binary.groups([e],'S02_VALID')['echo'],[])

    def predictions(self,wake_score=.99,negative_score=.01,echo_score=.01):
        rows=[dict(recording_id='p'+str(i),human_wakes=[{'start_seconds':.1,'end_seconds':.7}],echo_case=False,duration_seconds=2,times=[.5,.6],wake_scores=[wake_score,wake_score]) for i in range(20)]
        rows.extend([dict(recording_id='n',human_wakes=[],echo_case=False,duration_seconds=275.28,times=[.5,.6],wake_scores=[negative_score,negative_score]),dict(recording_id='e',human_wakes=[],echo_case=True,duration_seconds=59.64,times=[.5,.6],wake_scores=[echo_score,echo_score])])
        return rows

    def test_allmiss_has_no_qualified_threshold(self):
        r=binary.evaluate_predictions(self.predictions(wake_score=.01),self.config)
        self.assertIsNone(r['qualified_threshold'])
        self.assertTrue(all(not c['qualified'] for c in r['candidates']))

    def test_recall_false_event_and_duration_limits(self):
        self.assertEqual(binary.evaluate_predictions(self.predictions(),self.config)['qualified_threshold'],.9)
        self.assertIsNone(binary.evaluate_predictions(self.predictions(negative_score=.99),self.config)['qualified_threshold'])
        self.assertIsNone(binary.evaluate_predictions(self.predictions(echo_score=.99),self.config)['qualified_threshold'])
        rows=self.predictions();rows[-1]['duration_seconds']=2
        self.assertIsNone(binary.evaluate_predictions(rows,self.config)['qualified_threshold'])
        rows=self.predictions()
        for row in rows[:3]:row['wake_scores']=[.01,.01]
        self.assertIsNone(binary.evaluate_predictions(rows,self.config)['qualified_threshold'])

    def test_frozen_limits_and_default_off(self):
        self.assertEqual((self.config['seed'],self.config['max_epochs'],self.config['wall_limit_seconds']),(1729,50,3600))
        r=subprocess.run([sys.executable,str(binary.CONFIG.with_name('kural_binary_experiment.py'))],capture_output=True,text=True,timeout=20)
        self.assertEqual(r.returncode,0);self.assertIn('Disabled',r.stdout)


if __name__=='__main__':unittest.main()
