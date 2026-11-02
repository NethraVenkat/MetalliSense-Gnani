import copy
from pathlib import Path
import sys
import unittest
sys.path.insert(0,str(Path(__file__).parents[1]/'tools'))
import kural_paired_v2_experiment as p


class PairedExperimentTests(unittest.TestCase):
    def setUp(self):self.config=p.k.read(p.gate.V1/'config.json')

    def test_original_sampler_parity_and_added_record_rotation(self):
        group=dict(wake=['w'+str(i) for i in range(40)],ordinary=['n'+str(i) for i in range(101)],echo=['e'+str(i) for i in range(4)])
        self.assertEqual(p.epoch_batches(group,0,self.config),p.previous.epoch_batches(group,0,self.config))
        group['wake']+=['new'+str(i) for i in range(20)];selected=set()
        for epoch in range(3):
            batches=p.epoch_batches(group,epoch,self.config);self.assertEqual(len(batches),5)
            for batch in batches:
                self.assertEqual(len(batch),16);self.assertEqual(sum(i['label']==1 for i in batch),8);self.assertEqual(sum(i['stratum']=='prefix' for i in batch),4)
            selected.update(i['recording_id'] for batch in batches for i in batch if i['label']==1)
        self.assertEqual(selected,set(group['wake']))

    def test_dev_matching_has_no_grace_and_thresholds_fixed(self):
        dev=[dict(recording_id=str(i),task_id='manish-DW'+str(i),duration_seconds=2,echo_case=False,human_wakes=[dict(start_seconds=.2,end_seconds=.4)],times=[.4,.48],wake_scores=[.99,.99]) for i in range(10)]
        dev += [dict(recording_id='n',task_id='manish-DC01',duration_seconds=75,echo_case=False,human_wakes=[],times=[.1,.2],wake_scores=[0,0])]
        s02=[dict(recording_id=str(i),duration_seconds=2,echo_case=False,human_wakes=[dict(start_seconds=.2,end_seconds=.4)],times=[.3,.38],wake_scores=[.99,.99]) for i in range(20)]
        s02 += [dict(recording_id='n',duration_seconds=275.28,echo_case=False,human_wakes=[],times=[.1,.2],wake_scores=[0,0]),dict(recording_id='e',duration_seconds=59.64,echo_case=True,human_wakes=[],times=[.1,.2],wake_scores=[0,0])]
        rows=p.table_rows(dev,s02,self.config);self.assertEqual([r['threshold'] for r in rows],[.5,.65,.8,.9]);self.assertTrue(all(r['devval_wakes_detected']==0 and not r['PASS'] for r in rows))
        bad=copy.deepcopy(self.config);bad['threshold_candidates']=[.4]
        with self.assertRaises(ValueError):p.table_rows(dev,s02,bad)

    def test_evaluation_sessions_excluded_from_fitting_groups(self):
        rows=[dict(recording_id='w',session_id='S01_TRAIN',split='train',kind='positives',echo_case=False,annotation={'wake_intervals':[{'start_seconds':.1,'end_seconds':.2}]}),dict(recording_id='p',session_id='TRAIN_PAIRED_V1',split='train',kind='speech_negatives',echo_case=False,annotation={'wake_intervals':[],'wake_absence_confirmed':True}),dict(recording_id='dev',session_id='DEVVAL_V1'),dict(recording_id='s02',session_id='S02_VALID')]
        g=p.training_groups(rows);self.assertEqual(g['wake'],['w']);self.assertEqual(g['ordinary'],['p']);self.assertNotIn('dev',str(g));self.assertNotIn('s02',str(g))


if __name__=='__main__':unittest.main()
