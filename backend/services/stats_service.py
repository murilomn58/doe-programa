"""Statistical primitives for the analysis engine — pure, no framework, no DB.

Every function here takes numpy/pandas data and returns numbers, so they are
golden-tested directly:
- ``press`` / ``predicted_r_squared`` (leave-one-out via the hat matrix),
- ``vif`` (multicollinearity diagnostic on the coded design matrix),
- ``lenth_pse`` + ``lenth_margins`` (saturated designs, no error df),
- ``half_normal_quantiles`` (half-normal plot positions of the effects),
- ``yates_effects`` (independent effect estimate, cross-checked vs OLS),
- ``pure_error_and_lof`` (replicate-based Pure Error / Lack-of-Fit split).

NEVER imports fastapi.
"""

from __future__ import annotations

import numpy as np
from scipy import stats
from statsmodels.stats.outliers_influence import variance_inflation_factor

# --- Taguchi Signal-to-Noise ratios (per-run, dB) ----------------------------
# ``responses`` are the replicated measurements of ONE trial (not a whole
# column). Formulas match pyDOE3 ``compute_snr`` and Montgomery (2017).


def snr_larger(responses: np.ndarray) -> float:
    """S/N when larger is better: ``-10 * log10(mean(1/y^2))``."""
    y = np.asarray(responses, dtype=float)
    return float(-10.0 * np.log10(np.mean(1.0 / y**2)))


def snr_smaller(responses: np.ndarray) -> float:
    """S/N when smaller is better: ``-10 * log10(mean(y^2))``."""
    y = np.asarray(responses, dtype=float)
    return float(-10.0 * np.log10(np.mean(y**2)))


def snr_nominal(responses: np.ndarray) -> float:
    """S/N when nominal is best: ``10 * log10(mean^2 / var)`` (var = ddof 1)."""
    y = np.asarray(responses, dtype=float)
    mean_y = np.mean(y)
    var_y = np.var(y, ddof=1)
    return float(10.0 * np.log10(mean_y**2 / var_y))


def press(resid: np.ndarray, hat_diag: np.ndarray) -> float:
    """PRESS = sum of squared leave-one-out prediction residuals.

    Uses the shortcut ``e_(i) = e_i / (1 - h_ii)`` where ``h_ii`` is the
    leverage (hat matrix diagonal), avoiding n refits.
    """
    resid = np.asarray(resid, dtype=float)
    hat_diag = np.asarray(hat_diag, dtype=float)
    return float(np.sum((resid / (1.0 - hat_diag)) ** 2))


def predicted_r_squared(press_value: float, total_ss: float) -> float:
    """Predicted R^2 = 1 - PRESS / SST (centered total sum of squares)."""
    if total_ss == 0:
        return float("nan")
    return float(1.0 - press_value / total_ss)


def vif(exog: np.ndarray) -> list[float]:
    """Variance inflation factor per column of the design matrix ``exog``.

    ``exog`` must include the intercept column. Orthogonal coded designs yield
    VIF = 1 for every term.
    """
    exog = np.asarray(exog, dtype=float)
    return [float(variance_inflation_factor(exog, i)) for i in range(exog.shape[1])]


def lenth_pse(effects: np.ndarray) -> float:
    """Lenth's Pseudo Standard Error (PSE) of a set of factorial effects.

    ``s0 = 1.5 * median(|effect|)``; PSE = ``1.5 * median`` over effects with
    ``|effect| < 2.5 * s0``. Robust to a few active (large) effects.
    """
    effects = np.abs(np.asarray(effects, dtype=float))
    if effects.size == 0:
        return float("nan")
    s0 = 1.5 * np.median(effects)
    trimmed = effects[effects < 2.5 * s0]
    if trimmed.size == 0:
        return float(s0)
    return float(1.5 * np.median(trimmed))


def lenth_margins(m: int, alpha: float = 0.05) -> tuple[float, float]:
    """Lenth margins as multiples of the PSE: (ME, SME) for ``m`` effects.

    ME uses the individual t quantile at ``alpha`` with ``df = m/3``; SME uses
    the Simultaneous (Bonferroni-style) quantile ``gamma = (1+0.95^(1/m))/2``.
    Multiply by the PSE to get error margins on the effect scale.
    """
    dof = max(m / 3.0, 1.0)
    me = float(stats.t.ppf(1.0 - alpha / 2.0, dof))
    gamma = (1.0 + (1.0 - alpha) ** (1.0 / m)) / 2.0
    sme = float(stats.t.ppf(gamma, dof))
    return me, sme


def half_normal_quantiles(n: int) -> np.ndarray:
    """Half-normal plotting positions for ``n`` (absolute) effects.

    Position i (1-based, sorted ascending): ``Phi^-1(0.5 + 0.5*(i-0.5)/n)``.
    """
    i = np.arange(1, n + 1)
    return stats.norm.ppf(0.5 + 0.5 * (i - 0.5) / n)


def yates_effects(
    coded_points: np.ndarray, y_means: np.ndarray, factor_names: list[str]
) -> dict[str, float]:
    """Effects via the classic Yates algorithm (independent of OLS).

    ``coded_points`` are the unique design points (2^k x k of +-1) and
    ``y_means`` the mean response at each point. Points are re-sorted into Yates
    standard order (first factor fastest), then ``k`` add/subtract passes yield
    the contrasts; effect = contrast / 2^(k-1). Returns a map of term label
    (``A``, ``A*B``, ...) to effect, matching ``2 * OLS_coef`` for +-1 coding.
    """
    coded_points = np.asarray(coded_points, dtype=int)
    y_means = np.asarray(y_means, dtype=float)
    k = coded_points.shape[1]
    n_points = 2**k
    if coded_points.shape[0] != n_points:
        raise ValueError("Yates requires exactly 2^k unique design points.")

    # Standard order: factor 0 changes fastest, factor k-1 slowest.
    order_index = {}
    for row_i in range(coded_points.shape[0]):
        key = 0
        for j in range(k):
            bit = 1 if coded_points[row_i, j] > 0 else 0
            key |= bit << j
        order_index[key] = row_i
    ordered = np.array([y_means[order_index[key]] for key in range(n_points)])

    col = ordered.copy()
    for _ in range(k):
        nxt = np.empty_like(col)
        half = col.size // 2
        pairs = col.reshape(-1, 2)
        nxt[:half] = pairs[:, 0] + pairs[:, 1]
        nxt[half:] = pairs[:, 1] - pairs[:, 0]
        col = nxt

    # Yates effect order for the contrasts (col[0] is the grand total).
    labels = _yates_term_order(factor_names)
    effects: dict[str, float] = {}
    divisor = 2 ** (k - 1)
    for idx, label in enumerate(labels[1:], start=1):
        effects[label] = float(col[idx] / divisor)
    return effects


def _yates_term_order(factor_names: list[str]) -> list[str]:
    """Term labels in Yates output order: mean, A, B, AB, C, AC, BC, ABC...

    With the input rows in standard order (factor 0 fastest), the contrast at
    output index ``mask`` belongs to the effect whose bit ``j`` (factor ``j``)
    is set, so plain binary mask order already is Yates order.
    """
    k = len(factor_names)
    labels = []
    for mask in range(2**k):
        involved = [factor_names[j] for j in range(k) if mask & (1 << j)]
        labels.append("*".join(involved) if involved else "mean")
    return labels


def pure_error_and_lof(
    coded_points: np.ndarray,
    y: np.ndarray,
    sse_model: float,
    df_resid: int,
) -> tuple[tuple[float, int] | None, tuple[float, int] | None]:
    """Split the residual into Pure Error and Lack-of-Fit using replicates.

    ``coded_points`` is the (n x k) coded matrix for every run (replicates
    repeat their point). Pure Error is the pooled within-point variation; LOF is
    the remainder of the model residual. Returns ``((SS_PE, df_PE), (SS_LOF,
    df_LOF))`` or ``(None, None)`` when there are no replicated points (df_PE=0)
    or no LOF df left.
    """
    coded_points = np.asarray(coded_points, dtype=float)
    y = np.asarray(y, dtype=float)
    groups: dict[tuple, list[float]] = {}
    for row, value in zip(coded_points, y, strict=False):
        groups.setdefault(tuple(row), []).append(value)

    ss_pe = 0.0
    df_pe = 0
    for values in groups.values():
        if len(values) > 1:
            arr = np.asarray(values)
            ss_pe += float(np.sum((arr - arr.mean()) ** 2))
            df_pe += len(values) - 1

    if df_pe == 0:
        return None, None

    df_lof = df_resid - df_pe
    ss_lof = sse_model - ss_pe
    if df_lof <= 0:
        return (ss_pe, df_pe), None
    return (ss_pe, df_pe), (ss_lof, df_lof)


def curvature_test(
    coded_points: np.ndarray,
    y: np.ndarray,
    quantitative_mask: np.ndarray,
) -> tuple[float, int, float, float, float] | None:
    """Teste de curvatura com pontos centrais (aula ENQ41003, Cap. 4 Parte 4).

    Compara a media dos pontos fatoriais com a media dos pontos centrais:

        SS_curv = nF * nC * (yF_bar - yC_bar)^2 / (nF + nC)
        F = SS_curv / MQE_C,  MQE_C = sum((y_c - yC_bar)^2) / (nC - 1)
        F ~ F(1, nC - 1)

    ``coded_points`` (n x k) na escala codificada; ``quantitative_mask`` marca
    as colunas quantitativas. Ponto central = todas as colunas quantitativas em
    zero. Retorna ``(ss_curv, df_curv, ms_curv, f, p)`` ou ``None`` quando o
    teste nao se aplica (menos de 2 centrais, nenhum ponto fatorial, fator
    qualitativo presente, ou variancia nula nos centrais).
    """
    from scipy import stats as _stats

    coded_points = np.asarray(coded_points, dtype=float)
    y = np.asarray(y, dtype=float)
    quantitative_mask = np.asarray(quantitative_mask, dtype=bool)

    if coded_points.ndim != 2 or coded_points.shape[0] != y.shape[0]:
        return None
    if not quantitative_mask.all():
        # centrais so sao bem definidos quando todos os fatores sao quantitativos
        return None

    is_center = np.all(np.isclose(coded_points, 0.0), axis=1)
    # fatoriais: pontos de vertice (todas as coords em +-1); exclui axiais de CCD
    is_factorial = np.all(np.isclose(np.abs(coded_points), 1.0), axis=1)

    n_c = int(is_center.sum())
    n_f = int(is_factorial.sum())
    if n_c < 2 or n_f == 0:
        return None

    y_c = y[is_center]
    y_f = y[is_factorial]
    yc_bar = float(y_c.mean())
    yf_bar = float(y_f.mean())

    sq_e_c = float(np.sum((y_c - yc_bar) ** 2))
    if sq_e_c <= 0.0:
        return None
    mqe_c = sq_e_c / (n_c - 1)

    ss_curv = n_f * n_c * (yf_bar - yc_bar) ** 2 / (n_f + n_c)
    f_val = ss_curv / mqe_c
    p_val = float(_stats.f.sf(f_val, 1, n_c - 1))
    return (float(ss_curv), 1, float(ss_curv), float(f_val), p_val)
