import asyncio,io,json,wave
from pathlib import Path
import numpy as np
import pytest
from tools import stage2_noise_diagnostic as bench
from tools.noise_bench import wav_bytes,mix,rms

def test_dry_noise_plan_is_bounded_and_never_networks(tmp_path,monkeypatch):
    monkeypatch.setattr(bench,'ROOT',tmp_path);monkeypatch.setattr(bench,'sapi',lambda text:wav_bytes(.05*np.sin(2*np.pi*300*np.arange(16000)/16000)))
    source=tmp_path/'tools/local_wake_data/v23-wake-7e88f9918edf4131abdca6a9dff9577d/clips/wake_Timbre_1_0.wav';source.parent.mkdir(parents=True);source.write_bytes(bench.sapi('fixture'))
    monkeypatch.setattr('sys.argv',['noise-test']);asyncio.run(bench.main())
    folder=next((tmp_path/'tools/local_wake_data').glob('stage2-noise-*'));plan=json.loads((folder/'plan.json').read_text(encoding='utf-8'))
    assert len(plan['cases'])==27 and plan['max_logical_requests']==47 and plan['no_training'] and plan['no_rule_changes']
    assert not (folder/'requests.json').exists()

def test_existing_mixer_preserves_declared_snr():
    t=np.arange(16000)/16000;clean=.02*np.sin(2*np.pi*300*t);noise=np.random.default_rng(1729).normal(size=len(t))
    for snr in [20,10,5]:
        pcm=bench.readwave(mix(clean,noise,str(snr)));measured=20*np.log10(rms(clean)/rms(pcm-clean));assert abs(measured-snr)<.1
