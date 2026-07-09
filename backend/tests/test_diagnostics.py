"""Tests for the advanced diagnostic plots (issue 10).

Cube plot (3 factors), half-normal plot of the effects, influence diagnostics
(leverage / Cook / studentized residual) and residuals-vs-run-order. Every array
is checked at the data seam, never against Plotly internals. The golden 2^2 case
feeds the 2-factor checks; a 2^3 (Montgomery-style) fixture feeds the cube.
"""

import numpy as np
import pytest

from domain.types import RSMModel
from services import stats_service
from services.analysis_service import FactorInfo, analyze, terms_for_model
from services.plot_service import build_plots

# --- golden 2^2 (matches test_plot_service) ----------------------------------

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


def _golden_bundle(run_order=None):
    factors = [
        FactorInfo("cond", "quantitative"),
        FactorInfo("par", "quantitative"),
    ]
    coded = [{"cond": c, "par": p} for c, p, _ in GOLDEN_ROWS]
    natural = [
        {"cond": 19.0 if c > 0 else 18.0, "par": 210.0 if p > 0 else 70.0}
        for c, p, _ in GOLDEN_ROWS
    ]
    y = [v for _, _, v in GOLDEN_ROWS]
    terms = terms_for_model(RSMModel.LINEAR_INTERACTIONS, factors)
    result = analyze(factors, coded, natural, y, terms, model_label="lin_int")
    return build_plots(
        factors, coded, natural, y, terms, result, run_order=run_order
    ), (factors, coded, natural, y, terms, result)


# --- 2^3 fixture for the cube ------------------------------------------------
# A full 2^3 factorial with a simple additive+interaction response.

_THREE_NAMES = ["A", "B", "C"]


def _three_bundle():
    factors = [FactorInfo(n, "quantitative") for n in _THREE_NAMES]
    coded = []
    natural = []
    y = []
    for a in (-1.0, 1.0):
        for b in (-1.0, 1.0):
            for c in (-1.0, 1.0):
                coded.append({"A": a, "B": b, "C": c})
                natural.append(
                    {
                        "A": 10.0 if a > 0 else 0.0,
                        "B": 20.0 if b > 0 else 0.0,
                        "C": 30.0 if c > 0 else 0.0,
                    }
                )
                # response = 5 + 2A + 3B - 1C + 0.5AB
                y.append(5.0 + 2.0 * a + 3.0 * b - 1.0 * c + 0.5 * a * b)
    terms = terms_for_model(RSMModel.LINEAR, factors)
    result = analyze(factors, coded, natural, y, terms, model_label="linear")
    return build_plots(factors, coded, natural, y, terms, result), (
        factors,
        coded,
        natural,
        y,
        terms,
        result,
    )


# --- cube --------------------------------------------------------------------


def test_cube_none_with_two_factors():
    bundle, _ = _golden_bundle()
    assert bundle.cube is None


def test_cube_has_eight_corners_for_three_factors():
    bundle, _ = _three_bundle()
    cube = bundle.cube
    assert cube is not None
    assert cube.factors == ["A", "B", "C"]
    assert len(cube.corner_coded) == 8
    assert len(cube.corner_values) == 8
    # every corner is a unique ±1 triple
    triples = {tuple(row) for row in cube.corner_coded}
    assert len(triples) == 8
    for row in cube.corner_coded:
        assert set(row) <= {-1.0, 1.0}


def test_cube_values_are_observed_means_at_corners():
    bundle, _ = _three_bundle()
    cube = bundle.cube
    by_corner = {
        tuple(row): val
        for row, val in zip(cube.corner_coded, cube.corner_values, strict=False)
    }
    # response model 5 + 2A + 3B - 1C + 0.5AB at (+1,+1,-1)
    expected = 5.0 + 2.0 + 3.0 + 1.0 + 0.5
    assert by_corner[(1.0, 1.0, -1.0)] == pytest.approx(expected)


# --- half-normal -------------------------------------------------------------


def test_half_normal_lengths_match_effect_count():
    bundle, (_, _, _, _, _, result) = _golden_bundle()
    hn = bundle.half_normal
    assert hn is not None
    n_eff = len(result.effects)  # cond, par, cond*par = 3
    assert n_eff == 3
    assert len(hn.terms) == n_eff
    assert len(hn.abs_effects) == n_eff
    assert len(hn.theoretical) == n_eff


def test_half_normal_sorted_ascending_and_quantiles_reuse_stats():
    bundle, _ = _golden_bundle()
    hn = bundle.half_normal
    # abs_effects sorted ascending (half-normal plotting order)
    assert np.all(np.diff(hn.abs_effects) >= 0)
    assert np.all(np.array(hn.abs_effects) >= 0)
    # theoretical positions are exactly stats_service.half_normal_quantiles
    expected = stats_service.half_normal_quantiles(len(hn.abs_effects))
    assert hn.theoretical == pytest.approx([float(v) for v in expected])


def test_half_normal_marks_significant_terms():
    bundle, (_, _, _, _, _, result) = _golden_bundle()
    hn = bundle.half_normal
    sig_from_p = {e.term for e in result.effects if e.p is not None and e.p < 0.05}
    assert set(hn.labels_significant) == sig_from_p


# --- influence ---------------------------------------------------------------


def test_influence_leverage_sums_to_n_params():
    bundle, (_, _, _, _, terms, _) = _golden_bundle()
    infl = bundle.influence
    assert infl is not None
    n_params = len(terms) + 1  # + intercept
    # trace(H) == number of estimated parameters
    assert sum(infl.leverage) == pytest.approx(n_params, rel=1e-9)


def test_influence_cook_non_negative_and_thresholds():
    bundle, (_, _, _, y, terms, _) = _golden_bundle()
    infl = bundle.influence
    assert all(v >= 0 for v in infl.cook)
    n = len(y)
    p = sum(infl.leverage)
    assert infl.threshold_leverage == pytest.approx(2.0 * p / n)
    assert infl.threshold_cook == pytest.approx(4.0 / n)
    assert len(infl.leverage) == len(infl.cook) == len(infl.std_resid) == n


def test_influence_run_order_follows_supplied_order():
    order = [8, 7, 6, 5, 4, 3, 2, 1]
    bundle, _ = _golden_bundle(run_order=order)
    assert bundle.influence.run_order == order


# --- residual vs run order ---------------------------------------------------


def test_residual_vs_order_aligns_with_run_order():
    order = [3, 1, 4, 2, 8, 6, 5, 7]
    bundle, _ = _golden_bundle(run_order=order)
    rvo = bundle.residual_vs_order
    assert rvo is not None
    assert rvo.x == [float(o) for o in order]
    # y is the residual per run, same length as the design
    assert len(rvo.y) == len(order)
    # residuals sum to ~0 for an OLS fit with intercept
    assert sum(rvo.y) == pytest.approx(0.0, abs=1e-9)


def test_residual_vs_order_defaults_to_sequential():
    bundle, (_, _, _, y, _, _) = _golden_bundle()
    rvo = bundle.residual_vs_order
    assert rvo.x == [float(i) for i in range(1, len(y) + 1)]


def test_desirability_none_for_single_response():
    bundle, _ = _golden_bundle()
    assert bundle.desirability is None
