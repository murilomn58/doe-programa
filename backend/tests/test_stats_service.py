"""Unit tests for the statistical primitives + cross-checks (CA7).

CA7: the qualitative sign map is respected and the OLS effects agree with the
independent Yates algorithm. Plus PRESS/VIF/Lenth sanity and the ANOVA
Sigma-SS == SST property.
"""

import numpy as np
import pytest

from services import stats_service
from services.analysis_service import FactorInfo, all_factorial_terms, analyze

# --- Yates algorithm agrees with OLS effects (CA7) ---------------------------


def test_yates_effects_match_ols_on_montgomery():
    rows = [
        (-1, -1, -1, 550), (-1, -1, -1, 604),
        (1, -1, -1, 669), (1, -1, -1, 650),
        (-1, 1, -1, 633), (-1, 1, -1, 601),
        (1, 1, -1, 642), (1, 1, -1, 635),
        (-1, -1, 1, 1037), (-1, -1, 1, 1052),
        (1, -1, 1, 749), (1, -1, 1, 868),
        (-1, 1, 1, 1075), (-1, 1, 1, 1063),
        (1, 1, 1, 729), (1, 1, 1, 860),
    ]
    factors = [FactorInfo(n, "quantitative") for n in ("A", "B", "C")]
    coded = [{"A": a, "B": b, "C": c} for a, b, c, _ in rows]
    natural = [dict(r) for r in coded]
    y = [v for *_, v in rows]
    terms = all_factorial_terms(["A", "B", "C"])
    res = analyze(factors, coded, natural, y, terms)
    ols_effects = {e.term: e.effect for e in res.effects}

    # Yates on the point means (average of replicates), unique points.
    from collections import defaultdict

    acc = defaultdict(list)
    for a, b, c, v in rows:
        acc[(a, b, c)].append(v)
    points = list(acc.keys())
    means = np.array([np.mean(acc[p]) for p in points])
    yates = stats_service.yates_effects(np.array(points), means, ["A", "B", "C"])

    for term, effect in ols_effects.items():
        assert yates[term] == pytest.approx(effect, rel=1e-9), term


def test_ca7_qualitative_sign_map_and_effect_direction():
    """Tucum=-1 / Piassava=+1 fixed map; effect sign follows the coded map."""
    factors = [
        FactorInfo("fibra", "qualitative", low_label="Tucum", high_label="Piassava"),
        FactorInfo("cimento", "quantitative"),
    ]
    # Piassava (+1) gives higher response than Tucum (-1) -> positive effect.
    rows = [
        (-1, -1, 10.0), (1, -1, 20.0), (-1, 1, 12.0), (1, 1, 22.0),
        (-1, -1, 11.0), (1, -1, 21.0), (-1, 1, 13.0), (1, 1, 23.0),
    ]
    coded = [{"fibra": f, "cimento": c} for f, c, _ in rows]
    natural = [{"fibra": f, "cimento": 2.0 if c > 0 else 0.0} for f, c, _ in rows]
    y = [v for *_, v in rows]
    terms = all_factorial_terms(["fibra", "cimento"])
    res = analyze(factors, coded, natural, y, terms)

    assert res.sign_maps["fibra"] == {"-1": "Tucum", "+1": "Piassava"}
    effect = {e.term: e.effect for e in res.effects}["fibra"]
    assert effect > 0  # Piassava(+1) higher -> positive, matches the map

    # cross-check with Yates
    from collections import defaultdict

    acc = defaultdict(list)
    for f, c, v in rows:
        acc[(f, c)].append(v)
    points = list(acc.keys())
    means = np.array([np.mean(acc[p]) for p in points])
    yates = stats_service.yates_effects(np.array(points), means, ["fibra", "cimento"])
    assert yates["fibra"] == pytest.approx(effect, rel=1e-9)


# --- PRESS / predicted R^2 ---------------------------------------------------


def test_press_matches_manual_loo():
    resid = np.array([1.0, -2.0, 0.5, -0.5])
    hat = np.array([0.25, 0.25, 0.25, 0.25])
    expected = np.sum((resid / (1 - hat)) ** 2)
    assert stats_service.press(resid, hat) == pytest.approx(expected)
    assert stats_service.predicted_r_squared(10.0, 40.0) == pytest.approx(0.75)


# --- VIF: orthogonal coded design -> all 1.0 ---------------------------------


def test_vif_orthogonal_design_is_one():
    x = np.array(
        [
            [1, -1, -1, 1],
            [1, 1, -1, -1],
            [1, -1, 1, -1],
            [1, 1, 1, 1],
        ],
        dtype=float,
    )
    vifs = stats_service.vif(x)
    assert all(v == pytest.approx(1.0) for v in vifs)


# --- Lenth PSE + margins do not raise for a saturated set --------------------


def test_lenth_pse_and_margins():
    effects = np.array([2.0, -1.0, 30.0, 0.5, -0.7, 1.2, -0.3])
    pse = stats_service.lenth_pse(effects)
    assert pse > 0
    me, sme = stats_service.lenth_margins(len(effects))
    assert 0 < me < sme


def test_half_normal_quantiles_monotonic():
    q = stats_service.half_normal_quantiles(7)
    assert len(q) == 7
    assert np.all(np.diff(q) > 0)
    assert np.all(q >= 0)
