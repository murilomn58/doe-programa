"""Correctness guards: estimability (CA4) and saturated fallback (CA5)."""

import pytest

from domain.types import RSMModel
from services.analysis_service import (
    FactorInfo,
    all_factorial_terms,
    analyze,
    terms_for_model,
)

# 2^2, single replicate (4 runs) -> saturated for the full model.
CODED_2x2 = [
    {"A": -1, "B": -1},
    {"A": 1, "B": -1},
    {"A": -1, "B": 1},
    {"A": 1, "B": 1},
]
Y_2x2 = [10.0, 14.0, 18.0, 30.0]


def _factors_2():
    return [FactorInfo("A", "quantitative"), FactorInfo("B", "quantitative")]


# --- CA4: quadratic in a pure 2^k -> estimability warning, no numbers --------


def test_ca4_quadratic_in_2k_is_not_estimable():
    factors = _factors_2()
    # replicate the 2^2 so there is error df; still, quadratics alias intercept.
    coded = CODED_2x2 * 2
    natural = [dict(r) for r in coded]
    y = Y_2x2 * 2
    terms = terms_for_model(RSMModel.LINEAR_QUADRATIC, factors)
    res = analyze(factors, coded, natural, y, terms, model_label="linear_quadratic")

    assert res.estimable is False
    assert res.anova == []
    assert res.effects == []
    assert res.stats is None
    assert any("estimavel" in w.lower() or "posto" in w.lower() for w in res.warnings)


def test_ca4_linear_model_stays_estimable():
    factors = _factors_2()
    coded = CODED_2x2 * 2
    natural = [dict(r) for r in coded]
    y = Y_2x2 * 2
    terms = terms_for_model(RSMModel.LINEAR, factors)
    res = analyze(factors, coded, natural, y, terms)
    assert res.estimable is True
    assert res.stats is not None


# --- CA5: saturated design (0 df error) -> Lenth PSE, no exception -----------


def test_ca5_saturated_falls_back_to_lenth_without_exception():
    factors = _factors_2()
    natural = [dict(r) for r in CODED_2x2]
    terms = all_factorial_terms(["A", "B"])  # A, B, A*B => 3 params + intercept = 4 = n
    res = analyze(factors, CODED_2x2, natural, Y_2x2, terms, model_label="full")

    assert res.saturated is True
    assert res.lenth is not None
    assert res.lenth.pse > 0
    # effects are still estimable (exact fit); inference via pseudo-t, not F/p.
    effects = {e.term: e for e in res.effects}
    assert set(effects) == {"A", "B", "A*B"}
    assert all(e.p is None for e in res.effects)
    assert all(e.pseudo_t is not None for e in res.effects)
    # no divide-by-zero leaked into the panel
    assert res.stats is None


def test_ca5_saturated_2cubed_single_replicate():
    factors = [
        FactorInfo("A", "quantitative"),
        FactorInfo("B", "quantitative"),
        FactorInfo("C", "quantitative"),
    ]
    rows = [
        (-1, -1, -1, 550), (1, -1, -1, 669), (-1, 1, -1, 633), (1, 1, -1, 642),
        (-1, -1, 1, 1037), (1, -1, 1, 749), (-1, 1, 1, 1075), (1, 1, 1, 729),
    ]
    coded = [{"A": a, "B": b, "C": c} for a, b, c, _ in rows]
    natural = [dict(r) for r in coded]
    y = [v for *_, v in rows]
    terms = all_factorial_terms(["A", "B", "C"])  # 7 effects + intercept = 8 = n
    res = analyze(factors, coded, natural, y, terms)
    assert res.saturated is True
    assert res.lenth.pse == pytest.approx(27.75, rel=1e-6)
