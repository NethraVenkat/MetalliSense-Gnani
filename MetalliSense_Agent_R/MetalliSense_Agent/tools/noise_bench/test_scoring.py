"""Local scoring regressions; all transcripts are fixtures, with no STT calls."""
import csv
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


SPEC = importlib.util.spec_from_file_location("noise_bench", Path(__file__).resolve().parents[1] / "noise_bench.py")
bench = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(bench)


def attempt(reference, transcript, intent="heat_status", success=True):
    job = {"phrase": {"file": "phrase.wav", "expected_text": reference, "expected_intent": intent},
           "noise": "none", "snr": "clean"}
    return job, {"text": transcript, "success": success}, "cache"


class ScoringTests(unittest.TestCase):
    def test_wer_and_slots_use_frontend_normalization_and_keep_raw_transcripts(self):
        cases = [
            ("Heat 1051 status enna", "heat one zero five one status என்ன?", "heat_status", "1051"),
            ("Heat 42 epdi irukku", "heat forty two எப்படி இருக்கு?", "heat_status", "42"),
            ("Heat 42 status", "heat four two நிலை?", "heat_status", "42"),
            ("Heat 1051 status", "heat ten fifty one நிலை.", "heat_status", "1051"),
            ("FeSi stock evvalavu", "FESI stock எவ்வளவு?", "stock_check", ""),
            ("Spectrometer kaattu", "Spectrometer காட்டு.", "open_screen", ""),
            ("yen hold heat 1051", "ஏன் hold heat one zero five one?", "gate_reason", "1051"),
        ]
        rows = bench.frontend_score(bench.score_attempts([
            attempt(reference, transcript, intent) for reference, transcript, intent, _ in cases
        ]))
        for row, (_, transcript, _, heat) in zip(rows, cases):
            with self.subTest(transcript=transcript):
                self.assertEqual(row["wer"], 0)
                self.assertTrue(row["exact_match"])
                self.assertEqual(row["expected_heat"], heat)
                self.assertEqual(row["actual_heat"], heat)
                self.assertTrue(row["intent_heat_correct"])
                self.assertEqual(row["transcript"], transcript)

    def test_reference_number_words_are_normalized_too(self):
        [row] = bench.score_attempts([attempt("HEAT one zero five one, status என்ன?", "heat 1051 status enna")])
        self.assertEqual(row["wer"], 0)
        self.assertEqual(row["reference_words"], 4)
        self.assertEqual(row["expected_heat"], "1051")

    def test_bare_spoken_heat_preserves_the_slot(self):
        [row] = bench.score_attempts([attempt("Heat 42 status", "four two")])
        self.assertEqual(row["actual_heat"], "42")
        self.assertTrue(row["heat_ok"])

    def test_wer_keeps_real_substitutions_even_when_intent_is_correct(self):
        [row] = bench.frontend_score(bench.score_attempts([
            attempt("Show dashboard", "So dashboard.", "open_screen")
        ]))
        self.assertEqual(row["wer"], 0.5)
        self.assertTrue(row["intent_correct"])
        self.assertEqual(json.loads(row["predicted_params"]), {"route": "/dashboard"})

    def test_failed_attempt_is_empty_for_scoring_but_preserves_raw_text(self):
        transcript = "heat one zero five one status என்ன?"
        [row] = bench.frontend_score(bench.score_attempts([
            attempt("Heat 1051 status enna", transcript, success=False)
        ]))
        self.assertEqual(row["wer"], 1)
        self.assertFalse(row["heat_ok"])
        self.assertFalse(row["intent_heat_correct"])
        self.assertEqual(row["transcript"], transcript)

    def test_rescore_both_configurations_without_audio_client_or_cache_changes(self):
        v25 = {"model": "", "language": "en-IN", "format": "transcribe"}
        v30 = {"model": "prisma-v3.0", "language": "ta-IN,en-IN", "format": "codemix"}
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            fields = ["file", "noise", "snr", "expected_text", "expected_intent", "success", "transcript",
                      "stt_model", "stt_language", "stt_format"]
            record = {"file": "phrase.wav", "noise": "none", "snr": "clean",
                      "expected_text": "Heat 1051 status enna", "expected_intent": "heat_status",
                      "success": True, "transcript": "heat one zero five one status என்ன?",
                      **{f"stt_{key}": value for key, value in v30.items()}}
            with (root / "runs.csv").open("w", encoding="utf-8", newline="") as handle:
                writer = csv.DictWriter(handle, fieldnames=fields)
                writer.writeheader()
                writer.writerow(record)
            cache = {
                bench.cache_key("phrase.wav", "none", "clean"): {"text": "heat ten fifty one status enna", "success": True},
                bench.cache_key("phrase.wav", "none", "clean", v30): {"text": record["transcript"], "success": True},
            }
            (root / "results_cache.json").write_text(json.dumps(cache), encoding="utf-8")
            original_cache = (root / "results_cache.json").read_bytes()
            original_runs = (root / "runs.csv").read_bytes()
            with patch.object(bench, "load_dotenv", side_effect=AssertionError("dotenv must not load")), \
                 patch.object(bench, "read_audio", side_effect=AssertionError("audio must not load")), \
                 patch.object(bench, "generate_noise", side_effect=AssertionError("noise must not generate")), \
                 patch("app.copilot.gnani_client.get_gnani_client", side_effect=AssertionError("no STT client")):
                for config, legacy, name in [(v25, True, "v25"), (v30, False, "v30")]:
                    output = root / name
                    bench.rescore_saved(root, config, include_legacy=legacy, output_dir=output)
                    with (output / "runs.csv").open(encoding="utf-8-sig", newline="") as handle:
                        [row] = list(csv.DictReader(handle))
                    self.assertEqual(row["stt_language"], config["language"])
                    self.assertEqual(row["stt_model"], config["model"])
                    self.assertEqual(float(row["wer"]), 0)
                    self.assertEqual(row["source"], "cache")
                    self.assertEqual(row["intent_heat_correct"], "True")
                self.assertEqual((root / "results_cache.json").read_bytes(), original_cache)
                self.assertEqual((root / "runs.csv").read_bytes(), original_runs)
                # Repeated legacy scoring must reuse its original key rather than double-count.
                (root / "v25" / "results_cache.json").write_bytes(original_cache)
                bench.rescore_saved(root / "v25", v25, include_legacy=True)
                with (root / "v25" / "runs.csv").open(encoding="utf-8-sig", newline="") as handle:
                    [row] = list(csv.DictReader(handle))
                self.assertEqual(row["source"], "cache")

    def test_legacy_identification_requires_all_three_explicit_fields(self):
        with self.assertRaisesRegex(ValueError, "requires explicit"):
            bench.rescore_saved(Path("unused"), {"model": ""}, include_legacy=True)


if __name__ == "__main__":
    unittest.main()
