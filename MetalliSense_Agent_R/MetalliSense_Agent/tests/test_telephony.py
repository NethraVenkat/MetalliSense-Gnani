"""Phone tracks are isolated; all provider requests here are mocked."""
import csv
import io
import json
from pathlib import Path
import sys
from types import SimpleNamespace
from unittest.mock import Mock
import wave

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from tools import noise_bench as bench
from tools import telephony_bench as phone

CONFIG = {"model": "prisma-v3.0", "language": "ta-IN,en-IN", "format": "codemix", "keyterms": "heat,carbon,stock"}


def _csv(path, records):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["file", "expected_text", "expected_intent"])
        writer.writeheader()
        writer.writerows(records)


def test_phone_band_filter_output_is_8k_mono_16bit():
    time = np.arange(16000) / 16000
    audio = .2 * np.sin(2 * np.pi * 1000 * time) + .2 * np.sin(2 * np.pi * 100 * time) + .2 * np.sin(2 * np.pi * 5000 * time)
    data = phone.phone_band_wav(bench.wav_bytes(audio))
    with wave.open(io.BytesIO(data), "rb") as wav:
        assert (wav.getframerate(), wav.getnchannels(), wav.getsampwidth()) == (8000, 1, 2)
        assert wav.getnframes() == 8000
        values = np.frombuffer(wav.readframes(wav.getnframes()), dtype="<i2")
    spectrum = np.abs(np.fft.rfft(values[800:]))
    frequencies = np.fft.rfftfreq(len(values[800:]), 1 / 8000)
    peak = lambda hz: np.max(spectrum[np.abs(frequencies - hz) < 10])
    assert peak(1000) > peak(100) * 20
    assert peak(1000) > peak(3000) * 20  # 5 kHz must not alias into the 8 kHz recording.


def test_telephony_cache_key_differs_from_16k():
    original = bench.cache_key("same.wav", "none", "clean", CONFIG)
    synthetic = bench.cache_key("same.wav", "none", "clean", {**CONFIG, "telephony": "8k", "track": phone.SYNTHETIC})
    real = bench.cache_key("same.wav", "none", "clean", {**CONFIG, "telephony": "8k", "track": phone.REAL})
    assert len({original, synthetic, real}) == 3
    assert json.loads(original) == ["same.wav", "none", "clean", "prisma-v3.0", "ta-IN,en-IN", "codemix"]
    assert "telephony=8k" in json.loads(synthetic)


def test_real_calls_skips_missing_files_and_runs_with_zero(tmp_path, monkeypatch, capsys):
    root = tmp_path / "real_calls"
    _csv(root / "phrases.csv", [{"file": "real_manish_01.m4a", "expected_text": "Heat 1053 status enna", "expected_intent": "heat_status"}])
    monkeypatch.setattr(bench, "BENCH", tmp_path)
    monkeypatch.setattr(bench, "load_dotenv", Mock())
    monkeypatch.setattr(bench, "get_stt_config", lambda: CONFIG)
    client = Mock(side_effect=AssertionError("No client for missing recordings/dry run"))
    monkeypatch.setattr("app.copilot.gnani_client.get_gnani_client", client)
    assert bench.main(["--real-calls", "--dry-run"]) == 0
    assert not (root / "report.md").exists()
    assert bench.main(["--real-calls", "--max-calls", "0"]) == 0
    output = capsys.readouterr().out
    assert "no real-call recordings yet" in output
    assert "Missing (skipped): real_manish_01.m4a" in output
    assert "Planned new STT calls: 0" in output
    assert "combined real-only" in (root / "report.md").read_text(encoding="utf-8")
    client.assert_not_called()


def test_real_calls_report_never_includes_synthetic_rows(tmp_path):
    phrases = [{"file": "real_manish_01.wav", "speaker": "manish", "expected_text": "Heat 1053 status enna", "expected_intent": "heat_status"}]
    with pytest.raises(ValueError, match="reject synthetic"):
        phone.write_real_reports(bench, tmp_path, [{"track": phone.SYNTHETIC, "snr": "0"}], phrases, [], [], 0)
    job = {"phrase": phrases[0], "noise": "none", "snr": "real", "config": CONFIG}
    rows = bench.score_attempts([(job, {"text": "Heat one zero five three status என்ன?", "success": True}, "cache")])
    rows[0].update(track=phone.REAL, speaker="manish")
    phone.write_real_reports(bench, tmp_path, rows, phrases, [], [], 0)
    report = (tmp_path / "report.md").read_text(encoding="utf-8")
    assert "## Speaker: manish" in report and "combined real-only" in report
    with (tmp_path / "report.csv").open(encoding="utf-8-sig") as handle:
        summaries = list(csv.DictReader(handle))
    assert [r["scored"] for r in summaries] == ["1", "1"]
    assert all(r["track"] == phone.REAL for r in summaries)
    assert all(r["intent_heat_accuracy"] == "100.0%" for r in summaries)


def test_real_wav_conversion_does_not_add_phone_filter_or_companding(tmp_path):
    path = tmp_path / "real_manish_01.wav"
    original = bench.wav_bytes(.2 * np.sin(2 * np.pi * 1000 * np.arange(16000) / 16000))
    path.write_bytes(original)
    converted = phone.convert_real_call(path)
    assert phone.validate_rest_wav(converted) == 1
    assert converted != phone.phone_band_wav(original)


def test_phone_tracks_reject_over_30_seconds():
    with pytest.raises(ValueError, match="30 seconds"):
        phone.phone_band_wav(bench.wav_bytes(np.zeros(16000 * 31)))


def test_transcribe_uploads_8k_wav_unchanged(monkeypatch):
    from app.copilot.gnani_client import GnaniClient
    monkeypatch.setenv("GNANI_MOCK", "false")
    monkeypatch.setenv("GNANI_API_KEY", "test-key-not-real")
    for field in ("model", "language", "format", "keyterms"):
        monkeypatch.setenv(f"GNANI_STT_{field.upper()}", CONFIG[field])
    data = phone.phone_band_wav(bench.wav_bytes(np.sin(2 * np.pi * 1000 * np.arange(16000) / 16000) * .2))
    post = Mock(return_value=Mock(status_code=200, json=lambda: {"transcript": "heat 1053 status enna"}))
    monkeypatch.setattr("requests.post", post)
    assert GnaniClient().transcribe(data, max_attempts=1)["success"]
    assert post.call_args.kwargs["files"]["audio_file"][1] == data
    assert phone.validate_rest_wav(post.call_args.kwargs["files"]["audio_file"][1]) == 1


def test_track_call_limit_cache_and_output_isolation(tmp_path, monkeypatch):
    phrase = {"file": "test.wav", "expected_text": "Show dashboard", "expected_intent": "open_screen"}
    config = phone._config(CONFIG, phone.SYNTHETIC)
    wav = phone.phone_band_wav(bench.wav_bytes(np.sin(2 * np.pi * 1000 * np.arange(16000) / 16000) * .2))
    jobs = [phone._job(bench, phrase, wav, "none", snr, config, {}) for snr in ("clean", "20")]
    class Client:
        mock = False
        stats = {"stt_calls": 0}
        def transcribe(self, audio, language, max_attempts):
            assert max_attempts == 1 and audio == wav
            self.stats["stt_calls"] += 1
            return {"text": "Show dashboard", "success": True}
    client = Client()
    monkeypatch.setattr("app.copilot.gnani_client.get_gnani_client", lambda: client)
    rows, calls = phone._execute(bench, jobs, tmp_path / "telephony_8k", {}, 1)
    assert calls == client.stats["stt_calls"] == len(rows) == 1
    assert rows[0]["track"] == phone.SYNTHETIC
    assert not (tmp_path / "report.csv").exists()
    assert (tmp_path / "telephony_8k" / "results_cache.json").exists()
