from app.rl.constraints import clip_additions, constraint_violations


def test_proposed_candidates_do_not_require_unavailable_phosphorus_or_sulfur():
    result = clip_additions({'C': .1958, 'P': .0105, 'S': .01})
    assert result['C'] == .1958
    assert result['P'] == result['S'] == 0
    assert constraint_violations(result) == {}


def test_unapproved_additives_remain_explicitly_invalid_before_clipping():
    assert constraint_violations({'P': .0105})['P'] == 'No approved additive source'
    assert constraint_violations({'S': -.01})['S'] == 'No approved additive source'
    assert clip_additions({'P': -.01, 'S': .02})['P'] == 0
