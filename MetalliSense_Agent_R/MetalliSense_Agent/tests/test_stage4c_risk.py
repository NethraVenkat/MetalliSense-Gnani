"""Gate inference must preserve individual predictions while avoiding repeated work."""
import numpy as np
from app.premelt.risk_model import ChargeRiskModel, FEATURES


def test_assessment_batches_nominal_drivers_and_uncertainty():
    model = ChargeRiskModel()
    model.normal_stats['TEST'] = {el: dict(mean=1., std=.5) for el in FEATURES}
    model.models['TEST'] = object()
    calls = []

    def probability(grade, rows):
        calls.append(rows.copy())
        return np.clip(rows.mean(axis=1) / 10, 0, 1)

    model._proba = probability
    result = model.assess('TEST',dict(C=2, Si=3, Mn=4, P=.1, S=.2))
    assert len(calls) == 1
    assert calls[0].shape == (12, 5)
    assert result['risk_nominal'] == .22
    assert result['risk'] == .22
    assert result['risk_band_p10_p90'] == [.22, .22]
    assert {d['element'] for d in result['drivers']} == set(FEATURES)
    calls.clear()
    result = model.assess('TEST',dict(C=2, Si=3, Mn=4, P=.1, S=.2),dict(C=.1))
    assert len(calls) == 1
    assert calls[0].shape == (412, 5)
    assert result['risk_band_p10_p90'][0] <= result['risk'] <= result['risk_band_p10_p90'][1]


def test_small_inference_limits_openmp_workers(monkeypatch):
    import app.premelt.risk_model as risk
    events = []

    class Limit:
        def __init__(self, **kwargs):
            assert kwargs == dict(limits=1, user_api='openmp')
        def __enter__(self): events.append('enter')
        def __exit__(self, *args): events.append('exit')

    class Predictor:
        def predict_proba(self, rows):
            assert events == ['enter']
            return np.array([[.3, .7]])

    monkeypatch.setattr(risk, 'threadpool_limits', Limit)
    model = ChargeRiskModel()
    model.models['TEST'] = Predictor()
    assert model._proba('TEST',np.ones((1,5))).tolist() == [.7]
    assert events == ['enter','exit']
