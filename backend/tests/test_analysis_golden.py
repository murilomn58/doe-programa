"""Golden tests for the analysis engine — the rail that guards the math.

CA1 (BLOCKING): the class 2^2 example (response DP_50000) must reproduce the
OriginPro panel to rel=1e-6. CA2: Montgomery Example 6.1 (2^3 plasma etch)
cross-check to rel=1e-4. The numbers come from docs/adp/reference-outputs.md and
Montgomery, "Design and Analysis of Experiments".
"""

import pytest

from domain.types import RSMModel
from services.analysis_service import (
    FactorInfo,
    all_factorial_terms,
    analyze,
    terms_for_model,
)

# --- CA1: golden 2^2 (DP_50000) ---------------------------------------------

# cond 18->-1 / 19->+1 ; par (70,70)->-1 / (210,70)->+1
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


def _golden_inputs():
    factors = [
        FactorInfo("cond", "quantitative"),
        FactorInfo("par", "quantitative"),
    ]
    coded = [{"cond": c, "par": p} for c, p, _ in GOLDEN_ROWS]
    # natural values: cond 18/19, par 70/210 (arbitrary numeric endpoints, only
    # coded matters for the coded panel that the golden test checks).
    natural = [
        {"cond": 19.0 if c > 0 else 18.0, "par": 210.0 if p > 0 else 70.0}
        for c, p, _ in GOLDEN_ROWS
    ]
    y = [v for _, _, v in GOLDEN_ROWS]
    return factors, coded, natural, y


def test_ca1_golden_2squared_linear_reproduces_originpro():
    factors, coded, natural, y = _golden_inputs()
    terms = terms_for_model(RSMModel.LINEAR, factors)
    res = analyze(factors, coded, natural, y, terms, model_label="linear")

    assert res.estimable is True
    assert res.saturated is False

    coefs = {c.term: c for c in res.coefficients}
    assert coefs["Intercepto"].coef_coded == pytest.approx(3.785125, rel=1e-6)
    assert coefs["cond"].coef_coded == pytest.approx(1.317125, rel=1e-6)
    assert coefs["par"].coef_coded == pytest.approx(2.196375, rel=1e-6)

    effects = {e.term: e for e in res.effects}
    assert effects["cond"].effect == pytest.approx(2.634250, rel=1e-6)
    assert effects["par"].effect == pytest.approx(4.392750, rel=1e-6)

    anova = {row.source: row for row in res.anova}
    # F is the exact rail (rel=1e-6); the reference p-values are rounded to 4-5
    # decimals in OriginPro, so they are checked with an absolute tolerance.
    assert anova["cond"].f == pytest.approx(8.615382, rel=1e-6)
    assert anova["cond"].p == pytest.approx(0.03244, abs=1e-4)
    assert anova["par"].f == pytest.approx(23.957061, rel=1e-6)
    assert anova["par"].p == pytest.approx(0.0045, abs=1e-4)

    assert res.stats.r_squared == pytest.approx(0.866924, rel=1e-6)
    assert res.stats.adj_r_squared == pytest.approx(0.813693, rel=1e-6)
    assert res.stats.rmse == pytest.approx(1.269214, rel=1e-6)
    assert res.stats.press == pytest.approx(20.61956, rel=1e-6)
    assert res.stats.predicted_r_squared == pytest.approx(0.659325, rel=1e-6)
    assert res.stats.total_ss == pytest.approx(60.525567, rel=1e-6)
    assert res.total.ss == pytest.approx(60.525567, rel=1e-6)


def test_ca1_property_sum_of_ss_equals_total():
    """Property: sum of term SS + SSE == SST (orthogonal 2^k)."""
    factors, coded, natural, y = _golden_inputs()
    terms = terms_for_model(RSMModel.LINEAR, factors)
    res = analyze(factors, coded, natural, y, terms)
    ss_terms = sum(row.ss for row in res.anova)
    assert ss_terms + res.stats.sse == pytest.approx(res.total.ss, rel=1e-9)


# --- CA2: Montgomery Ex 6.1 (2^3 plasma etch, 2 replicates) ------------------

MONT_ROWS = [
    (-1, -1, -1, 550), (-1, -1, -1, 604),
    (1, -1, -1, 669), (1, -1, -1, 650),
    (-1, 1, -1, 633), (-1, 1, -1, 601),
    (1, 1, -1, 642), (1, 1, -1, 635),
    (-1, -1, 1, 1037), (-1, -1, 1, 1052),
    (1, -1, 1, 749), (1, -1, 1, 868),
    (-1, 1, 1, 1075), (-1, 1, 1, 1063),
    (1, 1, 1, 729), (1, 1, 1, 860),
]


def test_ca2_montgomery_nitride_etch_effects_and_ss():
    factors = [
        FactorInfo("A", "quantitative"),
        FactorInfo("B", "quantitative"),
        FactorInfo("C", "quantitative"),
    ]
    coded = [{"A": a, "B": b, "C": c} for a, b, c, _ in MONT_ROWS]
    natural = [dict(d) for d in coded]
    y = [v for *_, v in MONT_ROWS]
    terms = all_factorial_terms(["A", "B", "C"])
    res = analyze(factors, coded, natural, y, terms, model_label="full_factorial")

    assert res.estimable and not res.saturated
    effects = {e.term: e for e in res.effects}
    assert effects["A"].effect == pytest.approx(-101.625, rel=1e-4)
    assert effects["C"].effect == pytest.approx(306.125, rel=1e-4)
    assert effects["A*C"].effect == pytest.approx(-153.625, rel=1e-4)

    anova = {row.source: row for row in res.anova}
    assert anova["C"].ss == pytest.approx(374850.0625, rel=1e-4)
    assert anova["C"].f == pytest.approx(166.41, rel=1e-4)
    assert res.stats.r_squared == pytest.approx(0.9661, rel=1e-4)
