"""PlotService — turns a fitted analysis into ready-to-draw Plotly arrays.

Pure and framework-free (no fastapi, no plotly): given the same coded/natural
matrices, term list and the ``AnalysisResultData`` produced by
``analysis_service.analyze``, it refits the identical OLS model and emits the
grids/arrays each chart needs. The frontend only draws them — every statistic
(surface prediction grid, standardized effects, Q-Q quantiles, ...) is computed
here so there is one source of truth (research-findings.md, "regra de ouro").

The refit uses the very same design construction as ``analyze`` (explicit +-1
coded columns via patsy, no Sum coding), so the plotted model matches the tables
exactly.
"""

from __future__ import annotations

from itertools import combinations

import numpy as np
import pandas as pd
import statsmodels.formula.api as smf
from scipy import stats

from domain.analysis import AnalysisResultData, TermInfo
from domain.plots import (
    InteractionData,
    InteractionLine,
    MainEffectData,
    ObsVsPredData,
    ParetoData,
    PlotBundle,
    QQData,
    ScatterData,
    SurfaceData,
)
from services.analysis_service import FactorInfo, _safe_names, _term_patsy

GRID_N = 25


def build_plots(
    factors: list[FactorInfo],
    coded: list[dict[str, float]],
    natural: list[dict[str, float]],
    y: list[float],
    terms: list[TermInfo],
    result: AnalysisResultData,
    factor_x: str | None = None,
    factor_y: str | None = None,
    alpha: float = 0.05,
    grid_n: int = GRID_N,
) -> PlotBundle:
    """Build the base chart bundle for an estimable, non-saturated fit."""
    safe = _safe_names(factors)
    by_name = {f.name: f for f in factors}
    y_arr = np.asarray(y, dtype=float)

    coded_df = pd.DataFrame(
        {safe[f.name]: [row[f.name] for row in coded] for f in factors}
    )
    coded_df["y"] = list(y)
    rhs = " + ".join(_term_patsy(t, safe) for t in terms)
    fit = smf.ols(f"y ~ {rhs}", data=coded_df).fit()
    fitted = np.asarray(fit.fittedvalues, dtype=float)
    resid = np.asarray(fit.resid, dtype=float)
    df_resid = int(round(fit.df_resid))

    # --- factor-pair selector (surface/contour need two quantitative factors) -
    quant = [f.name for f in factors if f.is_quantitative]
    pairs = [list(p) for p in combinations(quant, 2)]
    selected = _select_pair(pairs, factor_x, factor_y)

    natural_range = {
        f.name: _natural_range(f.name, natural)
        for f in factors
        if f.is_quantitative
    }

    surface: SurfaceData | None = None
    contour: SurfaceData | None = None
    if selected is not None:
        surface = _surface(
            selected, factors, safe, fit, natural_range, grid_n
        )
        contour = surface  # same grid; the frontend renders it as a contour

    pareto = _pareto(result, df_resid, alpha)
    main_effects = _main_effects(factors, coded, y_arr)
    interaction = _interaction(selected, by_name, coded, y_arr, fit, df_resid, alpha)
    obs_vs_pred = _obs_vs_pred(y_arr, fitted, result)
    residual_vs_fitted = ScatterData(
        x=[float(v) for v in fitted], y=[float(v) for v in resid]
    )
    qq = _qq(resid)

    return PlotBundle(
        factor_pairs=pairs,
        selected_pair=selected,
        grand_mean=float(np.mean(y_arr)),
        surface=surface,
        contour=contour,
        pareto=pareto,
        main_effects=main_effects,
        interaction=interaction,
        obs_vs_pred=obs_vs_pred,
        residual_vs_fitted=residual_vs_fitted,
        qq=qq,
    )


def _select_pair(
    pairs: list[list[str]], factor_x: str | None, factor_y: str | None
) -> list[str] | None:
    if not pairs:
        return None
    if factor_x and factor_y and factor_x != factor_y:
        want = {factor_x, factor_y}
        for pair in pairs:
            if set(pair) == want:
                return [factor_x, factor_y]
    return pairs[0]


def _natural_range(name: str, natural: list[dict[str, float]]) -> tuple[float, float]:
    values = [row[name] for row in natural]
    return float(min(values)), float(max(values))


def _coded_to_natural(t: float, low: float, high: float) -> float:
    """Map a coded value in [-1, 1] to its natural-unit position."""
    return low + (t + 1.0) / 2.0 * (high - low)


def _surface(
    pair: list[str],
    factors: list[FactorInfo],
    safe: dict[str, str],
    fit,
    natural_range: dict[str, tuple[float, float]],
    grid_n: int,
) -> SurfaceData:
    fx, fy = pair
    tgrid = np.linspace(-1.0, 1.0, grid_n)
    xx, yy = np.meshgrid(tgrid, tgrid)  # xx varies along columns, yy along rows

    # Predict on the coded grid with every other factor at the center (0).
    grid_df = pd.DataFrame({safe[f.name]: np.zeros(xx.size) for f in factors})
    grid_df[safe[fx]] = xx.ravel()
    grid_df[safe[fy]] = yy.ravel()
    z = np.asarray(fit.predict(grid_df), dtype=float).reshape(xx.shape)

    lx, hx = natural_range[fx]
    ly, hy = natural_range[fy]
    x_axis = [_coded_to_natural(t, lx, hx) for t in tgrid]
    y_axis = [_coded_to_natural(t, ly, hy) for t in tgrid]
    return SurfaceData(
        factor_x=fx,
        factor_y=fy,
        x=x_axis,
        y=y_axis,
        z=[[float(v) for v in row] for row in z],
    )


def _pareto(
    result: AnalysisResultData, df_resid: int, alpha: float
) -> ParetoData | None:
    rows = [e for e in result.effects if e.t is not None]
    if not rows:
        return None
    rows = sorted(rows, key=lambda e: abs(e.t), reverse=True)
    sig_line = float(stats.t.ppf(1.0 - alpha / 2.0, df_resid))
    return ParetoData(
        terms=[e.term for e in rows],
        std_effects=[abs(float(e.t)) for e in rows],
        sig_line=sig_line,
        alpha=alpha,
    )


def _main_effects(
    factors: list[FactorInfo],
    coded: list[dict[str, float]],
    y_arr: np.ndarray,
) -> list[MainEffectData]:
    out: list[MainEffectData] = []
    for f in factors:
        col = np.array([row[f.name] for row in coded], dtype=float)
        means: list[float] = []
        labels: list[str] = []
        for level in (-1.0, 1.0):
            mask = col == level
            means.append(float(y_arr[mask].mean()) if mask.any() else float("nan"))
            labels.append(_level_label(f, level))
        out.append(
            MainEffectData(
                factor=f.name,
                level_labels=labels,
                levels=[-1.0, 1.0],
                means=means,
            )
        )
    return out


def _level_label(f: FactorInfo, level: float) -> str:
    if not f.is_quantitative:
        if level < 0 and f.low_label:
            return f.low_label
        if level > 0 and f.high_label:
            return f.high_label
    return "-1" if level < 0 else "+1"


def _interaction(
    pair: list[str] | None,
    by_name: dict[str, FactorInfo],
    coded: list[dict[str, float]],
    y_arr: np.ndarray,
    fit,
    df_resid: int,
    alpha: float,
) -> InteractionData | None:
    if pair is None:
        return None
    fx, fg = pair
    x_col = np.array([row[fx] for row in coded], dtype=float)
    g_col = np.array([row[fg] for row in coded], dtype=float)

    rmse = float(np.sqrt(fit.mse_resid)) if df_resid > 0 else float("nan")
    tcrit = float(stats.t.ppf(1.0 - alpha / 2.0, df_resid)) if df_resid > 0 else 0.0
    x_levels = [-1.0, 1.0]
    lines: list[InteractionLine] = []
    for glevel in (-1.0, 1.0):
        ys: list[float] = []
        lo: list[float] = []
        hi: list[float] = []
        for xlevel in x_levels:
            mask = (x_col == xlevel) & (g_col == glevel)
            cell = y_arr[mask]
            mean = float(cell.mean()) if cell.size else float("nan")
            se = rmse / np.sqrt(cell.size) if cell.size and np.isfinite(rmse) else 0.0
            ys.append(mean)
            lo.append(mean - tcrit * se)
            hi.append(mean + tcrit * se)
        lines.append(
            InteractionLine(
                level_label=_level_label(by_name[fg], glevel),
                x=x_levels,
                y=ys,
                ci_low=lo,
                ci_high=hi,
            )
        )
    return InteractionData(
        factor_x=fx,
        factor_group=fg,
        x_levels=x_levels,
        x_labels=[_level_label(by_name[fx], lv) for lv in x_levels],
        lines=lines,
    )


def _obs_vs_pred(
    y_arr: np.ndarray, fitted: np.ndarray, result: AnalysisResultData
) -> ObsVsPredData:
    lo = float(min(y_arr.min(), fitted.min()))
    hi = float(max(y_arr.max(), fitted.max()))
    span = hi - lo
    pad = span * 0.05 if span > 0 else 1.0
    r2 = float(result.stats.r_squared) if result.stats else float("nan")
    return ObsVsPredData(
        observed=[float(v) for v in y_arr],
        predicted=[float(v) for v in fitted],
        line_min=lo - pad,
        line_max=hi + pad,
        r_squared=r2,
    )


def _qq(resid: np.ndarray) -> QQData:
    (theoretical, sample), (slope, intercept, _r) = stats.probplot(
        resid, dist="norm"
    )
    return QQData(
        theoretical=[float(v) for v in theoretical],
        sample=[float(v) for v in sample],
        line_slope=float(slope),
        line_intercept=float(intercept),
    )
