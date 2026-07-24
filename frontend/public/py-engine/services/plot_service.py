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
import statsmodels.api as sm
import statsmodels.formula.api as smf
from scipy import stats

from domain.analysis import AnalysisResultData, TermInfo
from domain.plots import (
    CubeData,
    HalfNormalData,
    InfluenceData,
    InteractionData,
    InteractionLine,
    MainEffectData,
    ObsVsPredData,
    ParetoData,
    PlotBundle,
    ProfilerOptimum,
    ProfilerResult,
    ProfilerSlice,
    QQData,
    ScatterData,
    SurfaceData,
)
from services import stats_service
from services.analysis_service import (
    FactorInfo,
    _safe_names,
    _term_patsy,
    build_design_matrix,
)

GRID_N = 25
PROFILE_N = 25


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
    run_order: list[int] | None = None,
) -> PlotBundle:
    """Build the base chart bundle for an estimable, non-saturated fit."""
    safe = _safe_names(factors)
    by_name = {f.name: f for f in factors}
    y_arr = np.asarray(y, dtype=float)
    order = (
        [int(v) for v in run_order]
        if run_order is not None
        else list(range(1, len(y) + 1))
    )

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
            selected, factors, safe, fit, natural_range, natural, grid_n
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

    # --- advanced diagnostics (issue 10) -------------------------------------
    cube = _cube(factors, safe, coded, y_arr, fit)
    half_normal = _half_normal(result)
    influence = _influence(fit, order)
    residual_vs_order = ScatterData(
        x=[float(o) for o in order], y=[float(v) for v in resid]
    )

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
        cube=cube,
        half_normal=half_normal,
        influence=influence,
        residual_vs_order=residual_vs_order,
        desirability=None,  # multi-response overlay is served separately
    )


def build_profiler(
    factors: list[FactorInfo],
    coded: list[dict[str, float]],
    y: list[float],
    terms: list[TermInfo],
    point: dict[str, float],
    alpha: float = 0.05,
    profile_n: int = PROFILE_N,
    maximize: bool = True,
) -> ProfilerResult:
    """Interactive profiler over the coded [-1, 1]^k cube (pure, no DB/HTTP).

    Refits the identical OLS model, then: predicts (with CI) at ``point`` (missing
    factors default to the coded center 0), sweeps each factor -1..1 with the
    others held at ``point`` (one 1-D slice each), and locates the model optimum
    inside the cube by a coarse grid + local refinement. Fast (<50 ms)."""
    safe = _safe_names(factors)
    names = [f.name for f in factors]
    fit = _fit_coded(factors, safe, coded, y, terms)

    base = {n: float(point.get(n, 0.0)) for n in names}

    pred, lo, hi = _predict_at(fit, factors, safe, terms, base, alpha)

    grid = np.linspace(-1.0, 1.0, profile_n)
    slices: list[ProfilerSlice] = []
    for name in names:
        rows = []
        for t in grid:
            pt = dict(base)
            pt[name] = float(t)
            rows.append(pt)
        preds, los, his = _predict_rows(fit, factors, safe, terms, rows, alpha)
        slices.append(
            ProfilerSlice(
                factor=name,
                coded=[float(t) for t in grid],
                predicted=preds,
                ci_low=los,
                ci_high=his,
            )
        )

    opt_point, opt_value = _optimum(fit, factors, safe, terms, maximize)
    return ProfilerResult(
        prediction=float(pred),
        ci_low=float(lo),
        ci_high=float(hi),
        slices=slices,
        optimum=ProfilerOptimum(point=opt_point, value=float(opt_value)),
    )


def _fit_coded(
    factors: list[FactorInfo],
    safe: dict[str, str],
    coded: list[dict[str, float]],
    y: list[float],
    terms: list[TermInfo],
):
    """Fit OLS on the explicit design matrix X (no formula) for clean prediction.

    Fitting on the numeric X (built by the shared ``build_design_matrix``) means
    ``get_prediction`` takes a plain exog matrix — the same X the profiler builds
    for every probe — so there is no patsy re-eval on formula strings.
    """
    x_design = _design_rows(factors, safe, terms, coded)
    return sm.OLS(np.asarray(y, dtype=float), x_design).fit()


def _design_rows(
    factors: list[FactorInfo],
    safe: dict[str, str],
    terms: list[TermInfo],
    rows: list[dict[str, float]],
) -> pd.DataFrame:
    """Build the model matrix X for arbitrary coded points via the shared builder.

    Same single source of truth as ``analyze`` (explicit ±1 columns, no Sum
    coding), so a profiler prediction matches the reported coefficients exactly.
    """
    df = pd.DataFrame(
        {safe[f.name]: [row[f.name] for row in rows] for f in factors}
    )
    return build_design_matrix(df, terms, safe)


def _predict_rows(
    fit,
    factors: list[FactorInfo],
    safe: dict[str, str],
    terms: list[TermInfo],
    rows: list[dict[str, float]],
    alpha: float,
) -> tuple[list[float], list[float], list[float]]:
    # Predict on the explicitly-built design matrix (bypass the formula's patsy
    # re-eval by handing the fit the raw exog columns of X).
    x_new = _design_rows(factors, safe, terms, rows)
    pred = fit.get_prediction(exog=x_new)
    mean = np.asarray(pred.predicted_mean, dtype=float)
    ci = np.asarray(pred.conf_int(alpha=alpha), dtype=float)
    return (
        [float(v) for v in mean],
        [float(v) for v in ci[:, 0]],
        [float(v) for v in ci[:, 1]],
    )


def _predict_at(
    fit,
    factors: list[FactorInfo],
    safe: dict[str, str],
    terms: list[TermInfo],
    point: dict[str, float],
    alpha: float,
) -> tuple[float, float, float]:
    preds, los, his = _predict_rows(fit, factors, safe, terms, [point], alpha)
    return preds[0], los[0], his[0]


def _optimum(
    fit,
    factors: list[FactorInfo],
    safe: dict[str, str],
    terms: list[TermInfo],
    maximize: bool,
) -> tuple[dict[str, float], float]:
    """Optimum of the fitted response inside the coded cube via grid + refinement."""
    names = [f.name for f in factors]
    coarse = np.linspace(-1.0, 1.0, 5)
    best = _grid_search(fit, factors, safe, terms, names, coarse, maximize)
    # local refinement around the coarse winner
    fine_axes = [np.linspace(max(-1.0, v - 0.5), min(1.0, v + 0.5), 5) for v in best[0]]
    best = _grid_search_axes(fit, factors, safe, terms, names, fine_axes, best, maximize)
    point = {n: float(v) for n, v in zip(names, best[0], strict=False)}
    return point, float(best[1])


def _grid_search(
    fit, factors, safe, terms, names, axis: np.ndarray, maximize: bool
) -> tuple[list[float], float]:
    from itertools import product

    rows = [dict(zip(names, combo, strict=False)) for combo in product(axis, repeat=len(names))]
    return _best_of(fit, factors, safe, terms, rows, maximize)


def _grid_search_axes(
    fit, factors, safe, terms, names, axes: list[np.ndarray], current, maximize: bool
) -> tuple[list[float], float]:
    from itertools import product

    rows = [dict(zip(names, combo, strict=False)) for combo in product(*axes)]
    candidate = _best_of(fit, factors, safe, terms, rows, maximize)
    if maximize:
        return candidate if candidate[1] >= current[1] else current
    return candidate if candidate[1] <= current[1] else current


def _best_of(
    fit, factors, safe, terms, rows: list[dict[str, float]], maximize: bool
) -> tuple[list[float], float]:
    x_new = _design_rows(factors, safe, terms, rows)
    mean = np.asarray(fit.predict(x_new), dtype=float)
    idx = int(np.argmax(mean) if maximize else np.argmin(mean))
    names = [f.name for f in factors]
    best_point = [float(rows[idx][n]) for n in names]
    return best_point, float(mean[idx])


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
    natural: list[dict[str, float]],
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
        # observed experimental points (natural units) for the contour overlay
        points_x=[float(row[fx]) for row in natural],
        points_y=[float(row[fy]) for row in natural],
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


# --- advanced diagnostics (issue 10) -----------------------------------------


def _cube(
    factors: list[FactorInfo],
    safe: dict[str, str],
    coded: list[dict[str, float]],
    y_arr: np.ndarray,
    fit,
) -> CubeData | None:
    """Cube plot over the first three factors: response at the 8 ±1 corners.

    Each corner value is the observed mean at that corner when the design has
    runs there; otherwise the model prediction (so a fractional cube still fills)."""
    if len(factors) < 3:
        return None
    trio = factors[:3]
    names = [f.name for f in trio]
    cols = [np.array([row[f.name] for row in coded], dtype=float) for f in trio]

    corners: list[list[float]] = []
    values: list[float] = []
    for a in (-1.0, 1.0):
        for b in (-1.0, 1.0):
            for c in (-1.0, 1.0):
                corner = [a, b, c]
                mask = (cols[0] == a) & (cols[1] == b) & (cols[2] == c)
                if mask.any():
                    values.append(float(y_arr[mask].mean()))
                else:
                    values.append(_predict_corner(factors, safe, names, corner, fit))
                corners.append(corner)
    return CubeData(factors=names, corner_coded=corners, corner_values=values)


def _predict_corner(
    factors: list[FactorInfo],
    safe: dict[str, str],
    trio_names: list[str],
    corner: list[float],
    fit,
) -> float:
    """Model prediction at a cube corner, other factors held at the coded center."""
    row = {safe[f.name]: 0.0 for f in factors}
    for name, value in zip(trio_names, corner, strict=False):
        row[safe[name]] = value
    grid = pd.DataFrame({k: [v] for k, v in row.items()})
    return float(np.asarray(fit.predict(grid), dtype=float)[0])


def _half_normal(result: AnalysisResultData) -> HalfNormalData | None:
    """Half-normal plot of |effects| vs half-normal quantiles (reuse stats_service)."""
    effects = result.effects
    if not effects:
        return None
    abs_effects = [abs(float(e.effect)) for e in effects]
    order_idx = np.argsort(abs_effects)  # ascending, half-normal plotting order
    terms = [effects[i].term for i in order_idx]
    sorted_abs = [abs_effects[i] for i in order_idx]
    quantiles = stats_service.half_normal_quantiles(len(sorted_abs))

    significant: list[str] = []
    if result.lenth is not None and np.isfinite(result.lenth.me):
        me = result.lenth.me
        significant = [e.term for e in effects if abs(float(e.effect)) > me]
    else:
        significant = [
            e.term for e in effects if e.p is not None and e.p < 0.05
        ]
    return HalfNormalData(
        terms=terms,
        abs_effects=sorted_abs,
        theoretical=[float(q) for q in quantiles],
        labels_significant=significant,
    )


def _influence(fit, order: list[int]) -> InfluenceData:
    """Leverage / Cook's distance / studentized residuals via ``fit.get_influence``."""
    infl = fit.get_influence()
    leverage = np.asarray(infl.hat_matrix_diag, dtype=float)
    cook = np.asarray(infl.cooks_distance[0], dtype=float)
    std_resid = np.asarray(infl.resid_studentized_internal, dtype=float)
    n = len(leverage)
    p = float(np.sum(leverage))  # trace(H) = number of estimated parameters
    thr_lev = 2.0 * p / n if n else float("nan")
    thr_cook = 4.0 / n if n else float("nan")
    return InfluenceData(
        run_order=[int(o) for o in order],
        leverage=[float(v) for v in leverage],
        cook=[float(v) for v in cook],
        std_resid=[float(v) for v in std_resid],
        threshold_leverage=float(thr_lev),
        threshold_cook=float(thr_cook),
    )
