import copy
from pathlib import Path
import subprocess
import sys
import unittest

sys.path.insert(0, str(Path(__file__).parents[1]/'tools'))
import kural_training as k
from kural_context_policy import support, wake_coverage
from replay_kural_context_policy import replay_saved


class ContextPolicyTests(unittest.TestCase):
    def row(self, times, scores, duration=3, wakes=None):
        return dict(recording_id='p',times=times,wake_scores=scores,duration_seconds=duration,
                    human_wakes=wakes or [],echo_case=False)

    def test_ineligible_high_scores_cannot_prime_streak_or_cooldown(self):
        times=[.08,.16,.24,.32]
        scores=[.9]*4
        self.assertEqual(k.events(times,scores,.65,2,1),[.16])
        self.assertEqual(k.events(times,scores,.65,2,1,eligible=[False,False,True,True]),[.32])
        self.assertEqual(scores,[.9]*4)
        self.assertEqual(k.events(times,scores,.65,2,1,eligible=[False,False,True,False]),[])

    def test_ineligible_gap_breaks_streak_without_clearing_real_cooldown(self):
        times=[.08,.16,.24,.32,.4,1.2]
        scores=[.9]*len(times)
        self.assertEqual(k.events(times,scores,.65,2,1,eligible=[True,True,False,True,True,True]),[.16,1.2])
        self.assertEqual(k.events([.08,.16,.24,.32],[.9]*4,.65,2,1,eligible=[True,False,True,True]),[.32])

    def test_empty_all_ineligible_and_full_context_silence(self):
        self.assertEqual(k.events([],[],.65,2,1,eligible=[]),[])
        row=self.row([.08,.16,2,2.08],[.721558]*4)
        frames=support(row)
        self.assertEqual([f['eligible'] for f in frames],[False,False,True,True])
        self.assertEqual(frames[0]['synthetic_left_padding_samples'],30720)
        self.assertEqual(k.events(row['times'],row['wake_scores'],.65,2,1,eligible=[f['eligible'] for f in frames]),[2.08])

    def test_fail_closed_for_malformed_masks_and_timestamps(self):
        with self.assertRaises(ValueError):k.events([.08],[.8,.9],.5,2,1)
        with self.assertRaises(ValueError):k.events([.08],[.8],.5,2,1,eligible=[])
        with self.assertRaises(ValueError):k.events([.08],[.8],.5,2,1,eligible=[1])
        for times,scores in [([.08,.08],[.8,.9]),([.08001],[.8]),([4],[.8]),([.08],[float('nan')])]:
            with self.assertRaises(ValueError):support(self.row(times,scores))

    def test_coverage_short_single_frame_and_expired_match_window(self):
        wake=dict(start_seconds=.2,end_seconds=.6)
        short=self.row([.08,.16,1.5],[.9]*3,duration=1.5,wakes=[wake])
        coverage=wake_coverage(short,support(short))
        self.assertEqual(coverage[0]['status'],'clip_shorter_than_required_real_history')
        self.assertTrue(coverage[0]['retained_in_wake_denominator'])
        single=self.row([2],[.9],duration=2,wakes=[wake])
        self.assertEqual(wake_coverage(single,support(single))[0]['status'],'insufficient_consecutive_eligible_frames')
        late=self.row([2,2.08,3],[.9]*3,wakes=[wake])
        self.assertEqual(wake_coverage(late,support(late))[0]['status'],'matching_deadline_before_eligible_detection_opportunity')
        possible=self.row([2,2.08],[.9]*2,duration=2.08,wakes=[dict(start_seconds=1,end_seconds=1.5)])
        self.assertEqual(wake_coverage(possible,support(possible))[0]['status'],'eligible_detection_opportunity')

    def test_replay_keeps_all_twenty_wakes_raw_scores_and_limits(self):
        import kural_binary_experiment as b
        config=k.read(b.CONFIG)
        rows=[dict(self.row([.08,.16,1.5],[.99]*3,duration=1.5,wakes=[dict(start_seconds=.3,end_seconds=.7)]),recording_id=str(i)) for i in range(20)]
        rows.extend([dict(self.row([2,2.08],[.1,.1],duration=275.28),recording_id='n'),dict(self.row([2,2.08],[.1,.1],duration=59.64),recording_id='e',echo_case=True)])
        original=copy.deepcopy(rows)
        result,_=replay_saved(rows,config)
        self.assertEqual(rows,original)
        self.assertEqual(result['all_wakes_retained'],20)
        self.assertEqual(result['qualification_unchanged'],config['qualification'])
        self.assertIsNone(result['qualified_threshold'])
        self.assertEqual(result['wake_coverage_counts'],{'clip_shorter_than_required_real_history':20})
        for candidate in result['thresholds']:
            self.assertEqual(candidate['context_gated_metrics']['missed_wakes'],20)
            self.assertEqual(candidate['context_gated_metrics']['annotated_human_wakes'],20)

    def test_primary_binary_evaluation_does_not_apply_diagnostic_gate(self):
        import kural_binary_experiment as b
        config=k.read(b.CONFIG)
        rows=[dict(self.row([.08,.16],[.99,.99],duration=1.5,wakes=[dict(start_seconds=.1,end_seconds=.7)]),recording_id=str(i),context_eligible=[False,False]) for i in range(20)]
        rows.extend([dict(self.row([2,2.08],[.1,.1],duration=275.28),recording_id='n'),dict(self.row([2,2.08],[.1,.1],duration=59.64),recording_id='e',echo_case=True)])
        self.assertEqual(b.evaluate_predictions(rows,config)['qualified_threshold'],.9)
        self.assertIsNone(replay_saved(rows,config)[0]['qualified_threshold'])

    def test_replay_default_off(self):
        result=subprocess.run([sys.executable,str(Path(__file__).parents[1]/'tools/replay_kural_context_policy.py')],capture_output=True,text=True,timeout=20)
        self.assertEqual(result.returncode,0)
        self.assertIn('Disabled',result.stdout)


if __name__=='__main__':unittest.main()
