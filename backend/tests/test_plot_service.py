"""Tests for the PlotService — the seam that feeds the Plotly charts.

The PlotService turns a fitted analysis into ready-to-draw arrays (surface grid,
Pareto standardized effects, observed-vs-predicted pairs, Q-Q quantiles, ...).
Every array is checked here, at the data seam — never against Plotly internals.
The golden 2^2 class example (DP_50000, linear model) is the fixture, so the
numbers tie back to reference-outputs.md.
"""

import numpy as np
import pytest
from scipy import stats

from domain.types import RSMModel
from services.analysis_service import FactorInfo, analyze, terms_for_model
from services.plot_service import build_plots

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


def _golden():
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
    terms = terms_for_model(RSMModel.LINEAR, factors)
    result = analyze(factors, coded, natural, y, terms, model_label="linear")
    return factors, coded, natural, y, terms, result


def _bundle(grid_n: int = 25):
    factors, coded, natural, y, terms, result = _golden()
    return build_plots(
        factors, coded, natural, y, terms, result, grid_n=grid_n
    )


# --- surface / contour -------------------------------------------------------


def test_surface_grid_dimensions():
    bundle = _bundle(grid_n=25)
    surf = bundle.surface
    assert surf is not None
    assert len(surf.x) == 25
    assert len(surf.y) == 25
    assert len(surf.z) == 25
    assert all(len(row) == 25 for row in surf.z)
    assert surf.factor_x == "cond"
    assert surf.factor_y == "par"


def test_surface_center_predicts_intercept():
    """With all other factors held at the coded center, the surface value at the
    center of the two plotted factors is the model intercept (grand mean)."""
    bundle = _bundle(grid_n=25)
    surf = bundle.surface
    # grid_n=25 is odd -> middle index is the coded (0, 0) center.
    mid = 12
    intercept = 3.785125  # OriginPro golden intercept
    assert surf.z[mid][mid] == pytest.approx(intercept, rel=1e-6)


def test_surface_corner_matches_linear_prediction():
    bundle = _bundle(grid_n=25)
    surf = bundle.surface
    # top-right corner = coded (+1, +1) = intercept + b_cond + b_par
    expected = 3.785125 + 1.317125 + 2.196375
    assert surf.z[-1][-1] == pytest.approx(expected, rel=1e-6)


def test_contour_shares_surface_grid():
    bundle = _bundle(grid_n=15)
    assert bundle.contour is not None
    assert bundle.contour.z == bundle.surface.z
    assert bundle.contour.x == bundle.surface.x


def test_surface_axes_use_natural_units():
    bundle = _bundle(grid_n=25)
    surf = bundle.surface
    assert surf.x[0] == pytest.approx(18.0)
    assert surf.x[-1] == pytest.approx(19.0)
    assert surf.y[0] == pytest.approx(70.0)
    assert surf.y[-1] == pytest.approx(210.0)


def test_surface_points_match_observed_run_naturals():
    """points_x/points_y overlay = natural values of the analyzed runs on the
    plotted pair, one point per observed run (same length, same order)."""
    _, _, natural, y, _, _ = _golden()
    bundle = _bundle()
    surf = bundle.surface
    assert surf is not None
    assert len(surf.points_x) == len(surf.points_y) == len(y)
    assert surf.points_x == pytest.approx([row["cond"] for row in natural])
    assert surf.points_y == pytest.approx([row["par"] for row in natural])
    # contour shares the same overlay points
    assert bundle.contour.points_x == surf.points_x
    assert bundle.contour.points_y == surf.points_y


def test_factor_pairs_offered_for_selector():
    bundle = _bundle()
    assert bundle.factor_pairs == [["cond", "par"]]
    assert bundle.selected_pair == ["cond", "par"]


# --- Pareto ------------------------------------------------------------------


def test_pareto_sorted_by_abs_t_with_significance_line():
    _, _, _, _, _, result = _golden()
    bundle = _bundle()
    pareto = bundle.pareto
    assert pareto is not None
    # sorted descending by |t|: par (t~4.89) before cond (t~2.94)
    assert pareto.terms == ["par", "cond"]
    assert pareto.std_effects[0] >= pareto.std_effects[1]
    assert all(v >= 0 for v in pareto.std_effects)

    # significance line = two-sided t critical at alpha=0.05 on df_resid
    df_resid = result.stats.df_resid  # 8 obs - 3 params = 5
    expected = float(stats.t.ppf(0.975, df_resid))
    assert pareto.sig_line == pytest.approx(expected, rel=1e-9)
    assert pareto.alpha == pytest.approx(0.05)


# --- main effects ------------------------------------------------------------


def test_main_effects_are_observed_level_means():
    bundle = _bundle()
    by_factor = {m.factor: m for m in bundle.main_effects}
    cond = by_factor["cond"]
    # observed means at coded -1 / +1 for cond
    low = np.mean([0.612, 5.168, 0.645, 3.447])
    high = np.mean([3.475, 9.041, 1.623, 6.27])
    assert cond.means[0] == pytest.approx(low)
    assert cond.means[1] == pytest.approx(high)
    # difference equals the factorial effect (2.63425)
    assert cond.means[1] - cond.means[0] == pytest.approx(2.634250, rel=1e-6)


# --- interaction -------------------------------------------------------------


def test_interaction_has_one_line_per_group_level_with_ci():
    bundle = _bundle()
    inter = bundle.interaction
    assert inter is not None
    assert len(inter.lines) == 2  # two levels of the grouping factor
    for line in inter.lines:
        assert len(line.x) == len(line.y) == 2
        assert len(line.ci_low) == len(line.ci_high) == 2
        # CI brackets the mean
        for lo, m, hi in zip(line.ci_low, line.y, line.ci_high, strict=False):
            assert lo <= m <= hi


# --- observed vs predicted ---------------------------------------------------


def test_obs_vs_pred_pairs_and_r_squared():
    _, _, _, y, _, result = _golden()
    bundle = _bundle()
    ovp = bundle.obs_vs_pred
    assert ovp is not None
    assert ovp.observed == pytest.approx(y)
    assert len(ovp.predicted) == len(y)
    assert ovp.r_squared == pytest.approx(0.866924, rel=1e-6)
    # 45-degree reference line spans the data range
    assert ovp.line_min <= min(y)
    assert ovp.line_max >= max(y)


# --- residual diagnostics ----------------------------------------------------


def test_residual_vs_fitted_lengths():
    _, _, _, y, _, _ = _golden()
    bundle = _bundle()
    rvf = bundle.residual_vs_fitted
    assert rvf is not None
    assert len(rvf.x) == len(rvf.y) == len(y)


def test_qq_quantiles_match_scipy_probplot():
    _, _, _, _, _, result = _golden()
    bundle = _bundle()
    qq = bundle.qq
    assert qq is not None
    assert len(qq.theoretical) == len(qq.sample) == result.stats.n_obs
    # theoretical + sample are sorted ascending (ordered quantiles)
    assert np.all(np.diff(qq.theoretical) >= 0)
    assert np.all(np.diff(qq.sample) >= 0)
    assert qq.line_slope > 0
