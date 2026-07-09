"""Tests for the interactive profiler (issue 10).

The profiler is a pure function over the coded [-1, 1]^k cube: it refits the OLS
model, predicts (with CI) at a point, sweeps each factor -1..1 for the 1-D
slices, and finds the model optimum inside the cube. Checked at the data seam
against the golden 2^2 model, where every coefficient is known.
"""

import numpy as np
import pytest

from domain.types import RSMModel
from services.analysis_service import FactorInfo, terms_for_model
from services.plot_service import PROFILE_N, build_profiler

# golden 2^2 (matches the analysis golden / plot_service fixtures)
GOLDEN_ROWS = [
    (+1, -1, 3.475),
    (-1, -1, 0.612),
    (+1, +1, 9.041),
    (-1, +1, 5.168),
    (-1, -1, 0.645),
    (+1, -1, 1.623),
    (+1, +1, 6.27),
    (-1, +1, 3.447),
]

# OriginPro golden coded coefficients (linear model, no interaction)
INTERCEPT = 3.785125
B_COND = 1.317125
B_PAR = 2.196375


def _inputs(model=RSMModel.LINEAR):
    factors = [
        FactorInfo("cond", "quantitative"),
        FactorInfo("par", "quantitative"),
    ]
    coded = [{"cond": c, "par": p} for c, p, _ in GOLDEN_ROWS]
    y = [v for _, _, v in GOLDEN_ROWS]
    terms = terms_for_model(model, factors)
    return factors, coded, y, terms


def _profile(point, model=RSMModel.LINEAR, maximize=True):
    factors, coded, y, terms = _inputs(model)
    return build_profiler(
        factors=factors,
        coded=coded,
        y=y,
        terms=terms,
        point=point,
        maximize=maximize,
    )


# --- prediction --------------------------------------------------------------


def test_center_point_predicts_intercept():
    """Linear model, all coded 0 -> prediction is the intercept."""
    res = _profile({"cond": 0.0, "par": 0.0})
    assert res.prediction == pytest.approx(INTERCEPT, rel=1e-6)


def test_missing_factors_default_to_center():
    """An empty point defaults every factor to the coded center (0)."""
    res = _profile({})
    assert res.prediction == pytest.approx(INTERCEPT, rel=1e-6)


def test_prediction_at_corner_matches_linear_model():
    res = _profile({"cond": 1.0, "par": 1.0})
    expected = INTERCEPT + B_COND + B_PAR
    assert res.prediction == pytest.approx(expected, rel=1e-6)


def test_prediction_ci_brackets_the_mean():
    res = _profile({"cond": 0.0, "par": 0.0})
    assert res.ci_low <= res.prediction <= res.ci_high


# --- slices ------------------------------------------------------------------


def test_one_slice_per_factor_with_full_grid():
    res = _profile({"cond": 0.0, "par": 0.0})
    assert [s.factor for s in res.slices] == ["cond", "par"]
    for s in res.slices:
        assert len(s.coded) == PROFILE_N
        assert s.coded[0] == pytest.approx(-1.0)
        assert s.coded[-1] == pytest.approx(1.0)
        assert len(s.predicted) == PROFILE_N
        assert len(s.ci_low) == len(s.ci_high) == PROFILE_N
        for lo, m, hi in zip(s.ci_low, s.predicted, s.ci_high, strict=False):
            assert lo <= m <= hi


def test_slice_endpoints_match_linear_prediction():
    """cond slice at the center of par: endpoints are intercept ± b_cond."""
    res = _profile({"cond": 0.0, "par": 0.0})
    cond_slice = next(s for s in res.slices if s.factor == "cond")
    assert cond_slice.predicted[0] == pytest.approx(INTERCEPT - B_COND, rel=1e-6)
    assert cond_slice.predicted[-1] == pytest.approx(INTERCEPT + B_COND, rel=1e-6)


def test_slice_holds_other_factors_at_the_point():
    """Sweeping cond at par=+1 shifts the whole slice up by b_par."""
    res = _profile({"cond": 0.0, "par": 1.0})
    cond_slice = next(s for s in res.slices if s.factor == "cond")
    # midpoint of the cond sweep (coded 0) == intercept + b_par
    mid = PROFILE_N // 2
    assert cond_slice.coded[mid] == pytest.approx(0.0)
    assert cond_slice.predicted[mid] == pytest.approx(INTERCEPT + B_PAR, rel=1e-6)


# --- optimum -----------------------------------------------------------------


def test_optimum_is_the_positive_corner_for_increasing_model():
    """Both coded coefficients positive -> max at (+1, +1)."""
    res = _profile({"cond": 0.0, "par": 0.0}, maximize=True)
    assert res.optimum.point["cond"] == pytest.approx(1.0)
    assert res.optimum.point["par"] == pytest.approx(1.0)
    assert res.optimum.value == pytest.approx(INTERCEPT + B_COND + B_PAR, rel=1e-6)


def test_optimum_dominates_random_points():
    res = _profile({"cond": 0.0, "par": 0.0}, maximize=True)
    factors, coded, y, terms = _inputs()
    rng = np.random.default_rng(0)
    for _ in range(50):
        pt = {
            "cond": float(rng.uniform(-1, 1)),
            "par": float(rng.uniform(-1, 1)),
        }
        probe = build_profiler(
            factors=factors, coded=coded, y=y, terms=terms, point=pt
        )
        assert res.optimum.value >= probe.prediction - 1e-9


def test_minimize_flips_the_optimum_corner():
    res = _profile({"cond": 0.0, "par": 0.0}, maximize=False)
    assert res.optimum.point["cond"] == pytest.approx(-1.0)
    assert res.optimum.point["par"] == pytest.approx(-1.0)
    assert res.optimum.value == pytest.approx(INTERCEPT - B_COND - B_PAR, rel=1e-6)


def test_optimum_ci_is_coherent_at_the_optimum():
    """The prediction CI at the optimum point brackets the optimum value."""
    res = _profile({"cond": 1.0, "par": 1.0}, maximize=True)
    # prediction at (+1,+1) equals the optimum value and its CI brackets it
    assert res.prediction == pytest.approx(res.optimum.value, rel=1e-6)
    assert res.ci_low <= res.optimum.value <= res.ci_high
