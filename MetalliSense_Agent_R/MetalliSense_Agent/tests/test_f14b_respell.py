"""Offline guards for the paid audition workflow: never contact a provider."""
import json
from pathlib import Path
from types import SimpleNamespace

import pytest
import requests

from app.copilot.gnani_client import GnaniClient, _silent_wav
from tools import f14_tour_sheet
from tools.f14_tour_sheet import (SELECTIVE_MAX_CALLS, build_selective_plan,
    offline_respell_journal, run_selective, text_fingerprint, validate_selective_selection)
from tools.f14b_tamil_respell import WORDS, run, variants
from app.copilot.gnani_client import to_gnani_language, tts_text


@pytest.fixture
def client(monkeypatch, tmp_path):
    for key, value in {
        "GNANI_API_KEY": "offline-test-key", "GNANI_MOCK": "false",
        "GNANI_BASE_URL": "https://offline.invalid", "GNANI_TTS_MODEL": "timbre-v3.0",
        "GNANI_TTS_VOICE": "Kalpana", "GNANI_TTS_TAGS": "false",
        "GNANI_TTS_CLARITY": "false", "GNANI_TTS_LANGUAGE": "ta-IN",
        "GNANI_TTS_CACHE_DIR": str(tmp_path / "normal_cache"),
    }.items():
        monkeypatch.setenv(key, value)
    return GnaniClient()


EXPECTED_OVERRIDES = {
    'டாஷ்போர்டு': 'dashboard',
    'ஸ்பெக்ட்ரோ மீட்டர்': 'spectrometer',
    'கிரேடு ஸ்பெக்ஸ்': 'grade specs',
    'சப்ளையர் ஸ்கோர் கார்டு': 'supplier scorecard',
    'ரா மெட்டீரியல் ஸ்டாக்': 'raw material stock',
    'யார்டு இன்ஸ்பெக்ஷன்': 'yard inspection',
    'ப்ரீ மெல்ட் கேட்': 'pre-melt gate',
    'ஷிஃப்ட் ஹேண்டோவர்': 'shift handover',
    'காம்போசிஷன் டிவியேஷன்': 'composition deviation',
    'மெல்ட் கரெக்ஷன் பிளானர்': 'melt correction planner',
    'அடாப்டிவ் ஸ்ட்ராடஜி ஆப்டிமைசர்': 'adaptive strategy optimizer',
    'ஃபுல் அனாலிசிஸ்': 'full analysis',
    'மெக்கானிக்கல் ப்ராப்பர்ட்டீஸ்': 'mechanical properties',
    'சேல்ஸ் அண்ட் டிஸ்பேட்ச்': 'sales and dispatch',
    'இன்வென்டரி ஃபோர்காஸ்ட்': 'inventory forecast',
    'காஸ்ட் அனாலிசிஸ்': 'cost analysis',
    'சிந்தெடிக் டேட்டா': 'synthetic data',
    'ட்ரெயினிங் டேட்டா': 'training data',
    'செமான்டிக் சர்ச்': 'semantic search',
    'எலிமென்ட்': 'element',
}


def test_expected_overrides_match_audition_vocabulary():
    assert dict((word, values[0]) for word, *values in WORDS) == EXPECTED_OVERRIDES


def test_twenty_words_sixty_exact_carriers():
    rows = variants()
    assert len(WORDS) == 20 and len(rows) == 60
    assert len({row["text"] for row in rows}) == 60
    for row in rows:
        assert row["text"] == f'இது {row["spelling"]}. இங்கே பாக்கலாம்.'
    assert [row["variant"] for row in rows[:3]] == ["A", "B", "C"]
    assert rows[0]["text"] == "இது டாஷ்போர்டு. இங்கே பாக்கலாம்."
    assert rows[-1]["text"] == "இது எலிமெண்ட். இங்கே பாக்கலாம்."


def test_cache_only_cannot_call_network(client, tmp_path):
    def forbidden(*args, **kwargs):
        pytest.fail("cache-only attempted a provider request")
    folder = tmp_path / "sheet"
    assert run(client, folder, 0, post=forbidden) == 0
    saved = json.loads((folder / "results.json").read_text(encoding="utf-8"))
    assert saved["calls"] == 0 and "test" not in saved
    assert not any(row["success"] for row in saved["rows"].values())
    page = (folder / "index.html").read_text(encoding="utf-8")
    assert page.count("<tr>") == 21 and page.count("Audio pending") == 60


def test_cold_sheet_fits_sixty_calls_and_warm_rerun_is_free(client, tmp_path):
    folder = tmp_path / "sheet"
    now = [100.0]
    starts, payloads = [], []
    def sleep(seconds):
        now[0] += seconds
    def post(url, **kwargs):
        assert url == "https://offline.invalid/api/v1/tts/inference"
        starts.append(now[0])
        payloads.append(kwargs["json"])
        return SimpleNamespace(status_code=200, content=_silent_wav(.01, 22050), text="")
    # Creating a cache-only sheet first must not suppress later synthesis.
    assert run(client, folder, 0, post=post) == 0
    assert run(client, folder, 60, post=post, clock=lambda: now[0], sleep=sleep) == 0
    assert len(starts) == 60
    assert all(b-a >= 1.1-1e-8 for a, b in zip(starts, starts[1:]))
    for payload in payloads:
        assert payload["model"] == "timbre-v3.0" and payload["voice"] == "Kalpana"
        assert payload["language"] == "ta-IN" and "speed" not in payload
    assert [payload["text"] for payload in payloads] == [row["text"] for row in variants()]
    assert run(client, folder, 60, post=post, clock=lambda: now[0], sleep=sleep) == 0
    assert len(starts) == 60
    saved = json.loads((folder / "results.json").read_text(encoding="utf-8"))
    assert saved["calls"] == 60 and saved["test"]["success"]
    assert (folder / "index.html").read_text(encoding="utf-8").count("<audio ") == 60
    assert len(list(client.tts_cache_dir.glob("*.wav"))) == 60
    with pytest.raises(ValueError, match="between 0 and 60"):
        run(client, folder, 61, post=post)


def test_socket_failure_stops_after_one_diagnostic(client, tmp_path, capsys):
    calls = []
    def post(*args, **kwargs):
        calls.append(True)
        raise requests.ConnectionError("socket denied [WinError 10013]")
    folder = tmp_path / "sheet"
    assert run(client, folder, 60, post=post) == 2
    saved = json.loads((folder / "results.json").read_text(encoding="utf-8"))
    assert len(calls) == saved["calls"] == 1 and len(saved["rows"]) == 1
    assert saved["test"]["status"] is None
    assert "ConnectionError: socket denied [WinError 10013]" in capsys.readouterr().out
    assert run(client, folder, 60, post=post) == 2
    assert len(calls) == 1
    assert "NETWORK/SOCKET ERROR" in capsys.readouterr().out


@pytest.mark.parametrize("status", [401, 429])
def test_http_error_is_reported_without_retry(client, tmp_path, capsys, status):
    calls = []
    def post(*args, **kwargs):
        calls.append(True)
        return SimpleNamespace(status_code=status, content=b"error", text="mock diagnostic failure")
    assert run(client, tmp_path / "sheet", 60, post=post) == 2
    assert len(calls) == 1
    assert f"HTTP {status}: mock diagnostic failure" in capsys.readouterr().out


def test_offline_tour_journal_distinguishes_current_stale_and_missing_without_tts(monkeypatch, tmp_path):
    stale_text = "இது dashboard."
    target = "இது dashboard here."
    current_text = "இது spectrometer."
    missing_text = "இது grade specs."
    steps = [
        {"number": 1, "id": "dashboard", "display_text": "இது டாஷ்போர்டு.", "spoken_text": target},
        {"number": 2, "id": "spectrometer", "display_text": "ஸ்பெக்ட்ரோ மீட்டர்.", "spoken_text": current_text},
        {"number": 3, "id": "grades", "display_text": "கிரேடு ஸ்பெக்ஸ்.", "spoken_text": missing_text},
    ]
    (tmp_path / "01_dashboard_ta.wav").write_bytes(b"old audio");
    (tmp_path / "02_spectrometer_ta.wav").write_bytes(b"current audio")
    before = {p.name: (p.read_bytes(), p.stat().st_mtime_ns) for p in tmp_path.glob("*.wav")}
    (tmp_path / "results-v4.json").write_text(json.dumps({"calls": 3, "rows": [
        {"id": "01_dashboard_ta", "text": target, "success": False, "error": "budget exhausted"},
        {"id": "02_spectrometer_ta", "text": current_text, "success": True},
        {"id": "03_grades_ta", "text": missing_text, "success": True},
    ]}), encoding="utf-8")
    (tmp_path / "results-v3.json").write_text(json.dumps({"calls": 2, "rows": [
        {"id": "01_dashboard_ta", "text": stale_text, "success": True},
    ]}), encoding="utf-8")
    def forbidden(*args, **kwargs):
        pytest.fail("offline journal attempted TTS/network")
    monkeypatch.setattr(requests, "post", forbidden)
    monkeypatch.setattr(GnaniClient, "synthesize", forbidden)

    path, journal = offline_respell_journal(tmp_path, steps,
        [tmp_path / "results-v4.json", tmp_path / "results-v3.json"])
    assert path.name == "offline-respell-journal.json"
    assert journal["network_calls"] == journal["tts_calls"] == journal["audio_files_modified"] == 0
    assert journal["counts"] == {"existing": 1, "missing": 1, "stale": 1}
    by_id = {row["clip_id"]: row for row in journal["items"]}
    assert by_id["01_dashboard_ta"]["status"] == "stale"
    assert by_id["01_dashboard_ta"]["latest_success_provenance"]["journal"] == "results-v3.json"
    assert by_id["01_dashboard_ta"]["latest_attempt_provenance"]["journal"] == "results-v4.json"
    assert by_id["01_dashboard_ta"]["latest_attempt_provenance"]["success"] is False
    assert by_id["01_dashboard_ta"]["latest_attempt_provenance"]["error"] == "budget exhausted"
    assert by_id["01_dashboard_ta"]["intended_spoken_text"] == target
    assert by_id["02_spectrometer_ta"]["status"] == "existing"
    assert by_id["03_grades_ta"]["status"] == "missing"
    assert {p.name: (p.read_bytes(), p.stat().st_mtime_ns) for p in tmp_path.glob("*.wav")} == before
    assert json.loads(path.read_text(encoding="utf-8")) == journal
    prior = path.read_bytes()
    second, _ = offline_respell_journal(tmp_path, steps,
        [tmp_path / "results-v4.json", tmp_path / "results-v3.json"])
    assert second.name == "offline-respell-journal-02.json"
    assert path.read_bytes() == prior


def test_offline_cli_skips_dotenv_and_tts_client(monkeypatch, tmp_path, capsys):
    spoken = [{"number": 1, "id": "dashboard", "display_text": "visible", "spoken_text": "spoken"}]
    monkeypatch.setattr(f14_tour_sheet, "ROOT", tmp_path)
    monkeypatch.setattr(f14_tour_sheet, "load_tour_script", lambda frontend: spoken)
    monkeypatch.setattr(f14_tour_sheet.sys, "argv", ["f14_tour_sheet.py", "--offline-journal"])

    def forbidden(*args, **kwargs):
        pytest.fail("offline CLI initialized dotenv/TTS or attempted network")

    monkeypatch.setattr(requests, "post", forbidden)
    monkeypatch.setattr(GnaniClient, "__init__", forbidden)
    monkeypatch.setattr(GnaniClient, "synthesize", forbidden)
    import dotenv
    monkeypatch.setattr(dotenv, "load_dotenv", forbidden)

    assert f14_tour_sheet.main() == 0
    output = capsys.readouterr().out
    assert '"network_calls": 0' in output and '"tts_calls": 0' in output
    journal = json.loads((tmp_path / "app/data/tts_cache/f14_tour_sheet/offline-respell-journal.json").read_text(encoding="utf-8"))
    assert journal["items"][0]["intended_spoken_text"] == "spoken"
    assert journal["items"][0]["status"] == "missing"


def repair_rows(count=1):
    items, steps = [], []
    for number in range(1, count + 1):
        clip_id = f"{number:02d}_step{number}_ta"
        row = {"clip_id": clip_id, "language": "ta", "display_text": f"display {number}",
            "intended_spoken_text": f"spoken {number}", "status": "stale"}
        row["text_fingerprint"] = text_fingerprint(clip_id, "ta", row["display_text"], row["intended_spoken_text"])
        items.append(row)
        steps.append({"number": number, "id": f"step{number}", "display_text": row["display_text"],
            "spoken_text": row["intended_spoken_text"]})
    return {"mode": "offline_metadata_only", "items": items}, steps


class FakeRepairClient:
    def __init__(self, cache_dir, *, fail_at=None, invalid_at=None):
        self.tts_model, self.tts_voice, self.tts_language = "timbre-v3.0", "Kalpana", "ta-IN"
        self.tts_speed, self.tts_tags, self.tts_sample_rate = None, False, 22050
        self.tts_cache_dir, self.mock = cache_dir, False
        self.stats = {"tts_calls": 0}
        self.last_error = None
        self.calls, self.fail_at, self.invalid_at = [], fail_at, invalid_at

    def _cache_path(self, *args, **kwargs):
        return GnaniClient._cache_path(self, *args, **kwargs)

    def synthesize(self, text, language, *, allow_fallback, max_calls):
        self.calls.append((text, language, allow_fallback, max_calls))
        self.stats["tts_calls"] += 1
        if len(self.calls) == self.fail_at:
            self.last_error = "TTS 429: sanitized fixture"
            return None
        if len(self.calls) == self.invalid_at:
            return b"not-a-wav"
        return _silent_wav(.05, self.tts_sample_rate)


def make_repair_plan(tmp_path, count=1, client=None):
    journal, steps = repair_rows(count)
    selected = validate_selective_selection(journal, [item["clip_id"] for item in journal["items"]], steps)
    client = client or FakeRepairClient(tmp_path / "normal-cache")
    folder = tmp_path / "sheet"
    plan, state = build_selective_plan(selected, client, folder, folder / "results-selective.json",
        to_gnani_language, tts_text)
    return journal, steps, selected, client, folder, plan, state


def test_selection_rejects_duplicate_unknown_other_language_and_outdated_text_before_synthesis():
    journal, steps = repair_rows(2)
    first = journal["items"][0]["clip_id"]
    with pytest.raises(ValueError, match="duplicate"):
        validate_selective_selection(journal, [first, first], steps)
    with pytest.raises(ValueError, match="not an affected"):
        validate_selective_selection(journal, ["99_unknown_ta"], steps)
    with pytest.raises(ValueError, match="not an affected"):
        validate_selective_selection(journal, [first[:-2] + "hi"], steps)
    stale = json.loads(json.dumps(journal))
    stale["items"][0]["intended_spoken_text"] = "changed speech"
    with pytest.raises(ValueError, match="outdated"):
        validate_selective_selection(stale, [first], steps)
    stale = json.loads(json.dumps(journal))
    stale["items"][0]["text_fingerprint"] = "0" * 64
    with pytest.raises(ValueError, match="fingerprint"):
        validate_selective_selection(stale, [first], steps)
    too_many, too_many_steps = repair_rows(SELECTIVE_MAX_CALLS + 1)
    with pytest.raises(ValueError, match="cannot exceed 19"):
        validate_selective_selection(too_many, [item["clip_id"] for item in too_many["items"]], too_many_steps)


def test_cli_invalid_selection_exits_before_loading_client_or_dotenv(monkeypatch, tmp_path):
    journal, steps = repair_rows()
    journal_path = tmp_path / "offline.json"
    journal_path.write_text(json.dumps(journal), encoding="utf-8")
    monkeypatch.setattr(f14_tour_sheet, "ROOT", tmp_path)
    monkeypatch.setattr(f14_tour_sheet, "load_tour_script", lambda frontend: steps)
    monkeypatch.setattr(f14_tour_sheet.sys, "argv", ["f14_tour_sheet.py", "--select-journal",
        str(journal_path), "--select-id", "99_unknown_ta"])

    def forbidden(*args, **kwargs):
        pytest.fail("invalid selection reached dotenv, client or network")

    monkeypatch.setattr(GnaniClient, "__init__", forbidden)
    monkeypatch.setattr(requests, "post", forbidden)
    import dotenv
    monkeypatch.setattr(dotenv, "load_dotenv", forbidden)
    with pytest.raises(SystemExit) as error:
        f14_tour_sheet.main()
    assert error.value.code == 2


def test_dry_run_is_zero_call_and_does_not_write_targets_or_provenance(tmp_path):
    _, _, _, client, folder, plan, state = make_repair_plan(tmp_path, 2)
    stale_target = Path(plan[0]["target_path"])
    stale_target.parent.mkdir(parents=True, exist_ok=True)
    stale_audio = _silent_wav(.2, 22050)
    stale_target.write_bytes(stale_audio)
    result = run_selective(plan, state, client, folder, folder / "results-selective.json", live=False)
    assert result["network_calls"] == result["tts_calls"] == 0
    assert result["required_requests"] == 2 and result["cache_hits"] == 0
    assert client.calls == []
    assert not (folder / "results-selective.json").exists()
    assert stale_target.read_bytes() == stale_audio
    assert not (folder / "02_step2_ta.wav").exists()


def test_matching_cache_hit_is_reused_without_request_and_success_is_recorded(tmp_path):
    _, _, _, client, folder, plan, state = make_repair_plan(tmp_path)
    cache_path = Path(plan[0]["cache_path"])
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_bytes(_silent_wav(.05, 22050))
    plan, state = build_selective_plan([plan[0]], client, folder, folder / "results-selective.json",
        to_gnani_language, tts_text)
    assert plan[0]["status"] == "cache_hit"
    result = run_selective(plan, state, client, folder, folder / "results-selective.json", live=True)
    assert result["network_calls"] == result["tts_calls"] == result["required_requests"] == 0
    assert client.calls == []
    saved = json.loads((folder / "results-selective.json").read_text(encoding="utf-8"))
    assert saved["attempts"][0]["success"] is True and saved["attempts"][0]["source"] == "cache"
    assert _valid_audio_for_test((folder / (plan[0]["clip_id"] + ".wav")).read_bytes())


def _valid_audio_for_test(data):
    import wave
    from io import BytesIO
    with wave.open(BytesIO(data), "rb") as wav:
        return wav.getnframes() > 0 and wav.getnchannels() == 1 and wav.getsampwidth() == 2


def test_live_repair_is_sequential_and_hard_limited_to_nineteen(tmp_path):
    _, _, _, client, folder, plan, state = make_repair_plan(tmp_path, SELECTIVE_MAX_CALLS)
    now, sleeps = [0.0], []
    def sleep(duration):
        sleeps.append(duration)
        now[0] += duration
    result = run_selective(plan, state, client, folder, folder / "results-selective.json", live=True,
        max_calls=SELECTIVE_MAX_CALLS, sleep=sleep, clock=lambda: now[0])
    assert result["run"]["status"] == "complete"
    assert result["network_calls"] == result["tts_calls"] == SELECTIVE_MAX_CALLS
    assert len(client.calls) == SELECTIVE_MAX_CALLS
    assert all(call[2:] == (False, 1) for call in client.calls)
    assert len(sleeps) == SELECTIVE_MAX_CALLS - 1 and all(delay >= 1.1 for delay in sleeps)
    with pytest.raises(ValueError, match="between 1 and 19"):
        run_selective(plan, state, client, folder, folder / "results-selective.json", live=True, max_calls=20)


@pytest.mark.parametrize("failure", ["provider", "invalid_audio"])
def test_failure_or_invalid_audio_stops_and_preserves_target(tmp_path, failure):
    client = FakeRepairClient(tmp_path / "normal-cache", fail_at=1 if failure == "provider" else None,
        invalid_at=1 if failure == "invalid_audio" else None)
    _, _, _, client, folder, plan, state = make_repair_plan(tmp_path, client=client)
    target = Path(plan[0]["target_path"])
    target.parent.mkdir(parents=True, exist_ok=True)
    original = _silent_wav(.2, 22050)
    target.write_bytes(original)
    result = run_selective(plan, state, client, folder, folder / "results-selective.json", live=True)
    assert result["run"]["status"] in ("stopped_provider_error", "stopped_invalid_audio")
    assert target.read_bytes() == original
    assert not (folder / "recovery").exists()
    saved = json.loads((folder / "results-selective.json").read_text(encoding="utf-8"))
    assert saved["attempts"][-1]["success"] is False


def test_success_atomically_preserves_old_audio_and_resume_skips_completed_target(tmp_path):
    _, _, selected, client, folder, plan, state = make_repair_plan(tmp_path)
    target = Path(plan[0]["target_path"])
    target.parent.mkdir(parents=True, exist_ok=True)
    old_audio = _silent_wav(.2, 22050)
    target.write_bytes(old_audio)
    provenance = folder / "results-selective.json"
    result = run_selective(plan, state, client, folder, provenance, live=True)
    assert result["run"]["status"] == "complete" and result["network_calls"] == 1
    saved = json.loads(provenance.read_text(encoding="utf-8"))
    attempt = saved["attempts"][0]
    assert attempt["success"] and attempt["source"] == "live"
    assert Path(attempt["recovery_path"]).read_bytes() == old_audio
    second_plan, second_state = build_selective_plan(selected, client, folder, provenance,
        to_gnani_language, tts_text)
    assert second_plan[0]["status"] == "already_completed"
    again = run_selective(second_plan, second_state, client, folder, provenance, live=True)
    assert again["run"]["status"] == "complete" and again["network_calls"] == 0
    assert len(client.calls) == 1


def test_tts_settings_change_invalidates_cache_match(tmp_path):
    _, _, selected, client, folder, plan, _ = make_repair_plan(tmp_path)
    path = Path(plan[0]["cache_path"])
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(_silent_wav(.05, 22050))
    initial, _ = build_selective_plan(selected, client, folder, folder / "results-selective.json",
        to_gnani_language, tts_text)
    assert initial[0]["status"] == "cache_hit"
    changed = FakeRepairClient(tmp_path / "normal-cache")
    changed.tts_voice = "DifferentVoice"
    updated, _ = build_selective_plan(selected, changed, folder, folder / "results-selective.json",
        to_gnani_language, tts_text)
    assert updated[0]["status"] == "request_required"
    assert updated[0]["settings_fingerprint"] != initial[0]["settings_fingerprint"]
    same_cache_key, _ = build_selective_plan(selected, client, folder, folder / "results-selective.json",
        to_gnani_language, tts_text, clarity_enabled=True)
    assert same_cache_key[0]["status"] == "request_required"
    assert same_cache_key[0]["settings_fingerprint"] != initial[0]["settings_fingerprint"]


def test_provider_failure_stops_selection_and_records_unfinished_clips(tmp_path):
    client = FakeRepairClient(tmp_path / "normal-cache", fail_at=2)
    _, _, _, client, folder, plan, state = make_repair_plan(tmp_path, 3, client)
    result = run_selective(plan, state, client, folder, folder / "results-selective.json", live=True)
    assert result["run"]["status"] == "stopped_provider_error"
    assert result["network_calls"] == 2 and len(client.calls) == 2
    assert result["run"]["completed"] == [plan[0]["clip_id"]]
    assert result["run"]["remaining"] == [plan[1]["clip_id"], plan[2]["clip_id"]]
    state = json.loads((folder / "results-selective.json").read_text(encoding="utf-8"))
    assert [item["success"] for item in state["attempts"]] == [True, False]
    assert state["attempts"][1]["error"] == "TTS provider error (HTTP 429)"


def test_corrupt_cache_is_not_a_hit(tmp_path):
    _, _, _, client, folder, plan, _ = make_repair_plan(tmp_path)
    cache = Path(plan[0]["cache_path"])
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_bytes(b"stale or invalid cache")
    updated, _ = build_selective_plan([plan[0]], client, folder, folder / "results-selective.json",
        to_gnani_language, tts_text)
    assert updated[0]["cache_hit"] is False
    assert updated[0]["status"] == "request_required"
