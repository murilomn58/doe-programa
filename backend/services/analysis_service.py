"""Analysis engine — OLS + ANOVA + effects + diagnostics (issue 04).

The pure ``analyze`` function is the golden-tested core: it takes coded/natural
matrices and a term list and returns an ``AnalysisResultData`` with the ANOVA
table, effects, coded+natural coefficients (with VIF) and the fit statistics
(R^2 / adj / predicted via PRESS / RMSE). It NEVER imports fastapi.

Correctness guards (ADR-005/006/007):
- coding is explicit numeric +-1 columns fed to ``statsmodels.formula.api.ols``
  (never patsy Sum coding, which silently flips signs),
- estimability is checked with ``np.linalg.matrix_rank(X)`` vs ``n_params``
  BEFORE reporting (OLS uses pinv and would return silent finite numbers),
- a saturated design (0 df of error) falls back to Lenth PSE instead of
  dividing by zero.

The ``AnalysisService`` wraps the core with a repository port that reads the
persisted design and measured responses.
"""

from __future__ import annotations

from itertools import combinations
from typing import Protocol

import numpy as np
import pandas as pd
import statsmodels.formula.api as smf
from patsy import dmatrix
from scipy import stats
from statsmodels.stats.anova import anova_lm

from domain.analysis import (
    AnalysisResultData,
    AnovaRow,
    CoefRow,
    EffectRow,
    LenthResult,
    StatsPanel,
    TermInfo,
)
from domain.errors import ExperimentNotFoundError, InsufficientDataError
from domain.models import Experiment, Factor, Response, Run
from domain.types import FactorType, RSMModel
from services import stats_service

MAIN = "main"
INTERACTION = "interaction"
QUADRATIC = "quadratic"


# --- factor description used by the pure core --------------------------------


class FactorInfo:
    """Minimal factor description the core needs (framework/DB free)."""

    __slots__ = ("name", "factor_type", "low_label", "high_label")

    def __init__(
        self,
        name: str,
        factor_type: str,
        low_label: str | None = None,
        high_label: str | None = None,
    ) -> None:
        self.name = name
        self.factor_type = factor_type
        self.low_label = low_label
        self.high_label = high_label

    @property
    def is_quantitative(self) -> bool:
        return self.factor_type == FactorType.QUANTITATIVE


# --- term builders -----------------------------------------------------------


def _main_term(name: str) -> TermInfo:
    return TermInfo(label=name, patsy=name, kind=MAIN, factors=[name])


def _interaction_term(names: list[str]) -> TermInfo:
    return TermInfo(
        label="*".join(names),
        patsy=":".join(names),
        kind=INTERACTION,
        factors=list(names),
    )


def _quadratic_term(name: str) -> TermInfo:
    return TermInfo(
        label=f"{name}^2",
        patsy=f"I({name}**2)",
        kind=QUADRATIC,
        factors=[name],
    )


def terms_for_model(model: RSMModel, factors: list[FactorInfo]) -> list[TermInfo]:
    """Build the term list for one of the four class RSM models."""
    names = [f.name for f in factors]
    quant = [f.name for f in factors if f.is_quantitative]
    terms: list[TermInfo] = [_main_term(n) for n in names]

    if model in (RSMModel.LINEAR_INTERACTIONS, RSMModel.FULL):
        terms += [_interaction_term(list(pair)) for pair in combinations(names, 2)]
    if model in (RSMModel.LINEAR_QUADRATIC, RSMModel.FULL):
        terms += [_quadratic_term(n) for n in quant]
    return terms


def all_factorial_terms(factor_names: list[str]) -> list[TermInfo]:
    """Main effects + every interaction (all orders) — the saturated 2^k model."""
    terms: list[TermInfo] = [_main_term(n) for n in factor_names]
    for order in range(2, len(factor_names) + 1):
        terms += [
            _interaction_term(list(combo))
            for combo in combinations(factor_names, order)
        ]
    return terms


# --- pure analysis core ------------------------------------------------------


def _safe_names(factors: list[FactorInfo]) -> dict[str, str]:
    return {f.name: f"x{i}" for i, f in enumerate(factors)}


def _term_patsy(term: TermInfo, safe: dict[str, str]) -> str:
    if term.kind == MAIN:
        return safe[term.factors[0]]
    if term.kind == INTERACTION:
        return ":".join(safe[f] for f in term.factors)
    return f"I({safe[term.factors[0]]} ** 2)"


def _rhs(terms: list[TermInfo], safe: dict[str, str]) -> str:
    return " + ".join(_term_patsy(t, safe) for t in terms)


def build_design_matrix(
    coded_df: pd.DataFrame, terms: list[TermInfo], safe: dict[str, str]
) -> pd.DataFrame:
    """Assemble the model matrix X (intercept + ``terms``) via patsy ``dmatrix``.

    Single source of truth for X: both ``analyze`` and the retrospective
    estimability check call this, so the rank guard sees the exact same matrix.
    ``coded_df`` must carry the safe-named factor columns (``safe`` maps factor
    name -> patsy-safe symbol). Explicit ±1 numeric columns, never Sum coding.
    """
    return dmatrix(_rhs(terms, safe), coded_df, return_type="dataframe")


def _norm(expr: str) -> str:
    return expr.replace(" ", "")


def _sign_maps(factors: list[FactorInfo]) -> dict[str, dict[str, str]]:
    maps: dict[str, dict[str, str]] = {}
    for f in factors:
        if not f.is_quantitative and f.low_label and f.high_label:
            maps[f.name] = {"-1": f.low_label, "+1": f.high_label}
    return maps


def analyze(
    factors: list[FactorInfo],
    coded: list[dict[str, float]],
    natural: list[dict[str, float]],
    y: list[float],
    terms: list[TermInfo],
    model_label: str = "custom",
    response_name: str = "y",
    alpha: float = 0.05,
) -> AnalysisResultData:
    """Fit ``terms`` to ``y`` and return the full analysis (pure, no DB/HTTP)."""
    safe = _safe_names(factors)
    n = len(y)
    n_params = len(terms) + 1  # + intercept

    sign_maps = _sign_maps(factors)
    result = AnalysisResultData(
        response_name=response_name,
        model=model_label,
        terms=terms,
        sign_maps=sign_maps,
    )

    if n < n_params:
        result.estimable = False
        result.warnings.append(
            f"Dados insuficientes: {n} ensaios medidos para {n_params} parâmetros "
            "do modelo. Preencha mais respostas ou reduza os termos."
        )
        return result

    coded_df = pd.DataFrame(
        {safe[f.name]: [row[f.name] for row in coded] for f in factors}
    )
    coded_df["y"] = list(y)

    rhs = _rhs(terms, safe)
    x_design = build_design_matrix(coded_df, terms, safe)
    rank = int(np.linalg.matrix_rank(x_design.values))
    n_cols = x_design.shape[1]

    # --- estimability guard (ADR-007): rank-deficient -> WARN, no numbers ----
    # NOTE (fix 3+ blocos): this guard does NOT need special-casing for blocks.
    # A block with k levels enters ``terms``/``x_design`` already decomposed
    # into k-1 one-column indicator terms (see the injection in
    # ``AnalysisService.analyze`` below), never as a single multi-column
    # categorical factor. So "posto == número de colunas" is already the
    # right comparison; there is no "block of columns" to rank-check together.
    if rank < n_cols:
        result.estimable = False
        aliased = [t.label for t in terms if t.kind == QUADRATIC]
        detail = (
            f" (termos quadráticos {', '.join(aliased)} são confundidos com o "
            "intercepto num 2^k puro)"
            if aliased
            else ""
        )
        result.warnings.append(
            f"Modelo não estimável: posto da matriz {rank} < {n_cols} parâmetros"
            f"{detail}. Adicione pontos centrais ou use um CCD/Box-Behnken."
        )
        return result

    fit = smf.ols(f"y ~ {rhs}", data=coded_df).fit()
    df_resid = int(round(fit.df_resid))

    coded_main = np.array([[row[f.name] for f in factors] for row in coded], dtype=float)

    # --- saturated guard (ADR-007): 0 df error -> Lenth PSE ------------------
    if df_resid == 0:
        _fill_saturated(result, fit, terms, safe, factors, natural, coded, alpha)
        return result

    _fill_full(
        result,
        fit,
        x_design,
        terms,
        safe,
        factors,
        natural,
        coded,
        coded_main,
        np.asarray(y, dtype=float),
        alpha,
    )
    return result


def _fill_full(
    result: AnalysisResultData,
    fit,
    x_design: pd.DataFrame,
    terms: list[TermInfo],
    safe: dict[str, str],
    factors: list[FactorInfo],
    natural: list[dict[str, float]],
    coded: list[dict[str, float]],
    coded_main: np.ndarray,
    y: np.ndarray,
    alpha: float,
) -> None:
    df_resid = int(round(fit.df_resid))
    anova = anova_lm(fit, typ=2)
    anova_by_term = {_norm(idx): row for idx, row in anova.iterrows()}

    natural_params = _natural_coefficients(
        factors, natural, coded, list(y), terms, safe
    )
    vif_by_col = dict(
        zip(x_design.columns, stats_service.vif(x_design.values), strict=False)
    )
    conf = fit.conf_int(alpha=alpha)
    tcrit = float(stats.t.ppf(1.0 - alpha / 2.0, df_resid))

    # --- ANOVA rows in term order --------------------------------------------
    anova_rows: list[AnovaRow] = []
    for term in terms:
        key = _norm(_term_patsy(term, safe))
        row = anova_by_term.get(key)
        if row is None:
            continue
        ss = float(row["sum_sq"])
        df = int(round(row["df"]))
        anova_rows.append(
            AnovaRow(
                source=term.label,
                ss=ss,
                df=df,
                ms=ss / df if df else float("nan"),
                f=float(row["F"]),
                p=float(row["PR(>F)"]),
            )
        )
    result.anova = anova_rows

    # --- Pure Error / Lack-of-Fit from replicates ----------------------------
    pe, lof = stats_service.pure_error_and_lof(coded_main, y, float(fit.ssr), df_resid)
    if pe is not None:
        ss_pe, df_pe = pe
        result.pure_error = AnovaRow(
            source="Erro Puro", ss=ss_pe, df=df_pe, ms=ss_pe / df_pe
        )
        result.ms_pure_error = ss_pe / df_pe
        if lof is not None:
            ss_lof, df_lof = lof
            ms_lof = ss_lof / df_lof
            f_lof = ms_lof / (ss_pe / df_pe) if ss_pe > 0 else float("nan")
            p_lof = float(stats.f.sf(f_lof, df_lof, df_pe)) if np.isfinite(f_lof) else None
            result.lack_of_fit = AnovaRow(
                source="Falta de Ajuste",
                ss=ss_lof,
                df=df_lof,
                ms=ms_lof,
                f=f_lof,
                p=p_lof,
            )

    result.total = AnovaRow(
        source="Total", ss=float(fit.centered_tss), df=len(y) - 1, ms=float("nan")
    )
    result.r_squared = float(fit.rsquared)
    result.adj_r_squared = float(fit.rsquared_adj)

    # --- effects (factorial: 2 * coded coefficient) --------------------------
    params = fit.params
    bse = fit.bse
    tvalues = fit.tvalues
    pvalues = fit.pvalues
    for term in terms:
        if term.kind == QUADRATIC:
            continue
        col = _match_index(params.index, _term_patsy(term, safe))
        if col is None:
            continue
        coef = float(params[col])
        se = float(bse[col])
        effect = 2.0 * coef
        se_eff = 2.0 * se
        result.effects.append(
            EffectRow(
                term=term.label,
                effect=effect,
                coef_coded=coef,
                std_err=se_eff,
                t=float(tvalues[col]),
                p=float(pvalues[col]),
                ci_low=effect - tcrit * se_eff,
                ci_high=effect + tcrit * se_eff,
            )
        )

    # --- coefficients (coded + natural, with VIF) ----------------------------
    for col in params.index:
        label = _label_for_column(col, terms, safe)
        result.coefficients.append(
            CoefRow(
                term=label,
                coef_coded=float(params[col]),
                coef_natural=natural_params.get(_norm(col)),
                std_err=float(bse[col]),
                t=float(tvalues[col]),
                p=float(pvalues[col]),
                ci_low=float(conf.loc[col, 0]),
                ci_high=float(conf.loc[col, 1]),
                vif=vif_by_col.get(col),
            )
        )

    # --- fit statistics (incl. PRESS / predicted R^2) ------------------------
    infl = fit.get_influence()
    press = stats_service.press(fit.resid.values, infl.hat_matrix_diag)
    total_ss = float(fit.centered_tss)
    result.stats = StatsPanel(
        n_obs=len(y),
        df_resid=df_resid,
        r_squared=float(fit.rsquared),
        adj_r_squared=float(fit.rsquared_adj),
        rmse=float(np.sqrt(fit.mse_resid)),
        sse=float(fit.ssr),
        total_ss=total_ss,
        press=press,
        predicted_r_squared=stats_service.predicted_r_squared(press, total_ss),
    )


def _fill_saturated(
    result: AnalysisResultData,
    fit,
    terms: list[TermInfo],
    safe: dict[str, str],
    factors: list[FactorInfo],
    natural: list[dict[str, float]],
    coded: list[dict[str, float]],
    alpha: float,
) -> None:
    result.saturated = True
    result.warnings.append(
        "Planejamento saturado (0 graus de liberdade para o erro): sem teste F. "
        "Usando o PSE de Lenth / half-normal para julgar os efeitos."
    )
    params = fit.params
    natural_params = _natural_coefficients(
        factors, natural, coded, list(fit.model.endog), terms, safe
    )

    effect_terms = [t for t in terms if t.kind != QUADRATIC]
    effect_values: list[float] = []
    rows: list[tuple[TermInfo, float, float]] = []
    for term in effect_terms:
        col = _match_index(params.index, _term_patsy(term, safe))
        if col is None:
            continue
        coef = float(params[col])
        effect = 2.0 * coef
        effect_values.append(effect)
        rows.append((term, effect, coef))

    pse = stats_service.lenth_pse(np.array(effect_values))
    me_mult, sme_mult = stats_service.lenth_margins(len(effect_values), alpha)
    me = me_mult * pse
    sme = sme_mult * pse
    result.lenth = LenthResult(pse=pse, me=me, sme=sme, alpha=alpha)

    for term, effect, coef in rows:
        result.effects.append(
            EffectRow(
                term=term.label,
                effect=effect,
                coef_coded=coef,
                pseudo_t=(effect / pse) if pse else None,
                significant=(abs(effect) > me) if np.isfinite(me) else None,
            )
        )

    for col in params.index:
        label = _label_for_column(col, terms, safe)
        result.coefficients.append(
            CoefRow(
                term=label,
                coef_coded=float(params[col]),
                coef_natural=natural_params.get(_norm(col)),
            )
        )
    result.r_squared = 1.0


def _natural_coefficients(
    factors: list[FactorInfo],
    natural: list[dict[str, float]],
    coded: list[dict[str, float]],
    y: list[float],
    terms: list[TermInfo],
    safe: dict[str, str],
) -> dict[str, float]:
    """Refit on natural-unit columns to get coefficients in natural units.

    Quantitative factors use their natural values; qualitative factors keep the
    coded +-1 (a category has no natural magnitude). Returns a map keyed by the
    normalized patsy column name; empty if the natural refit is rank-deficient.
    """
    columns: dict[str, list[float]] = {}
    for f in factors:
        if f.is_quantitative:
            columns[safe[f.name]] = [row[f.name] for row in natural]
        else:
            columns[safe[f.name]] = [row[f.name] for row in coded]
    nat_df = pd.DataFrame(columns)
    nat_df["y"] = list(y)
    rhs = _rhs(terms, safe)
    x_nat = build_design_matrix(nat_df, terms, safe)
    if np.linalg.matrix_rank(x_nat.values) < x_nat.shape[1]:
        return {}
    nat_fit = smf.ols(f"y ~ {rhs}", data=nat_df).fit()
    return {_norm(col): float(nat_fit.params[col]) for col in nat_fit.params.index}


def _match_index(index, patsy_expr: str) -> str | None:
    target = _norm(patsy_expr)
    for name in index:
        if _norm(name) == target:
            return name
    return None


def _label_for_column(col: str, terms: list[TermInfo], safe: dict[str, str]) -> str:
    if col == "Intercept":
        return "Intercepto"
    for term in terms:
        if _norm(_term_patsy(term, safe)) == _norm(col):
            return term.label
    return col


def _aggregate_block_anova_rows(
    anova_rows: list[AnovaRow],
    block_term_labels: set[str],
    stats_panel: StatsPanel | None,
    block_name: str | None = None,
) -> list[AnovaRow]:
    """Collapse the k-1 synthetic block-indicator ANOVA rows into one row.

    With k blocks the model carries k-1 one-column deviation-coded indicator
    terms (see the injection above). ``anova_lm`` reports one SS/df/F/p per
    indicator; summing their SS and df recovers the pooled between-block sum
    of squares (the indicators are mutually orthogonal complements of the
    same multi-df block factor), and F/p are then recomputed against the
    residual MS of the FULL fit (blocks already accounted for in the model).
    A no-op when there is 0 or 1 block row (still renames it to "Bloco" so the
    label is stable for k=2 and for the advisor's "source contains Bloco"
    lookup either way).

    ``block_name`` (ex.: "Tipo de solo") é o nome que o pesquisador deu ao
    agrupamento na geração do design. Quando presente, a linha sai como
    "Bloco (Tipo de solo)" em vez de só "Bloco" -- a tabela fica
    autoexplicativa meses depois. O "Bloco" continua sempre no começo da
    string de propósito: é o que a regra do advisor (substring "Bloco" in
    source) e o filtro de efeitos significativos continuam casando, com ou
    sem nome.
    """
    block_rows = [row for row in anova_rows if row.source in block_term_labels]
    if not block_rows or stats_panel is None:
        return anova_rows

    ss = sum(row.ss for row in block_rows)
    df = sum(row.df for row in block_rows)
    ms = ss / df if df else float("nan")
    ms_resid = (
        stats_panel.sse / stats_panel.df_resid if stats_panel.df_resid else float("nan")
    )
    f = ms / ms_resid if np.isfinite(ms_resid) and ms_resid > 0 else float("nan")
    p = float(stats.f.sf(f, df, stats_panel.df_resid)) if np.isfinite(f) else None
    source = f"Bloco ({block_name})" if block_name else "Bloco"
    aggregated = AnovaRow(source=source, ss=ss, df=df, ms=ms, f=f, p=p)

    merged: list[AnovaRow] = []
    inserted = False
    for row in anova_rows:
        if row.source in block_term_labels:
            if not inserted:
                merged.append(aggregated)
                inserted = True
            continue
        merged.append(row)
    return merged


# --- persistence port + service ----------------------------------------------


class AnalysisRepository(Protocol):
    """Port consumed by ``AnalysisService`` (same shape as the run repo)."""

    async def get_experiment(self, experiment_id: int) -> Experiment | None: ...

    async def get_factors(self, experiment_id: int) -> list[Factor]: ...

    async def get_responses(self, experiment_id: int) -> list[Response]: ...

    async def get_runs(self, experiment_id: int) -> list[Run]: ...


class AnalysisService:
    def __init__(self, repo: AnalysisRepository) -> None:
        self._repo = repo

    async def analyze(
        self,
        experiment_id: int,
        response_name: str,
        model: RSMModel,
        factor_x: str | None = None,
        factor_y: str | None = None,
        block_name: str | None = None,
    ) -> AnalysisResultData:
        experiment = await self._repo.get_experiment(experiment_id)
        if experiment is None:
            raise ExperimentNotFoundError(
                f"Experimento {experiment_id} não encontrado."
            )
        factors_orm = await self._repo.get_factors(experiment_id)
        responses = await self._repo.get_responses(experiment_id)
        runs = await self._repo.get_runs(experiment_id)

        if response_name not in {r.name for r in responses}:
            raise InsufficientDataError(
                f"Resposta '{response_name}' não existe neste experimento."
            )

        factors = [
            FactorInfo(
                name=f.name,
                factor_type=f.factor_type,
                low_label=_label_at(f, -1),
                high_label=_label_at(f, 1),
            )
            for f in factors_orm
        ]

        coded: list[dict[str, float]] = []
        natural: list[dict[str, float]] = []
        y: list[float] = []
        run_order: list[int] = []
        run_blocks: list[int] = []
        for run in runs:
            value = (run.response_values or {}).get(response_name)
            if value is None:
                continue
            coded.append({f.name: float(run.cells[f.name]["coded"]) for f in factors})
            natural.append(
                {
                    f.name: _natural_or_coded(run.cells[f.name])
                    for f in factors
                }
            )
            y.append(float(value))
            run_order.append(int(run.run_order))
            run_blocks.append(int(getattr(run, "block", 1) or 1))

        if not y:
            raise InsufficientDataError(
                f"Nenhum ensaio possui valor medido para '{response_name}'."
            )

        terms = terms_for_model(model, factors)

        # --- Blocos na análise (auditoria 2026-07 + fix 3+ blocos): generaliza
        # o tratamento de 2 blocos para k blocos. O bloco entra decomposto em
        # k-1 fatores sintéticos qualitativos, cada um uma coluna indicadora
        # EXPLÍCITA (deviation/effect coding montada à mão aqui, nunca via
        # ``C(Bloco)`` do patsy: ADR-005 proíbe contraste categórico automático
        # porque ele pode inverter sinal em silêncio sem avisar ninguém).
        #
        # Convenção (deviation coding, referência = menor id de bloco):
        #   - linha do bloco de referência -> -1 em TODAS as k-1 colunas;
        #   - linha do bloco j (j = 2..k)  -> +1 na coluna daquele bloco,
        #     0 nas demais colunas de bloco.
        # Para k=2 isso colapsa para exatamente 1 coluna +-1 -- o MESMO
        # tratamento que já existia e que o golden (OriginPro CCD 2 blocos,
        # ver test_blocks_curvature.py) trava: coeficiente 0.78571, erro
        # padrão 1.68744, SS 8.64286. Plots e profiler continuam no espaço dos
        # fatores, sem o bloco (ver docs/adp/auditoria-aulas-2026-07.md).
        distinct_blocks = sorted(set(run_blocks))
        factors_fit = factors
        terms_fit = terms
        coded_fit = coded
        natural_fit = natural
        block_term_labels: set[str] = set()
        if len(distinct_blocks) >= 2:
            reference = distinct_blocks[0]
            non_reference = distinct_blocks[1:]
            block_factors = [
                FactorInfo(
                    name=f"Bloco {b}",
                    factor_type="qualitative",
                    low_label=f"Bloco {reference}",
                    high_label=f"Bloco {b}",
                )
                for b in non_reference
            ]
            block_term_labels = {bf.name for bf in block_factors}

            def _block_columns(b: int) -> dict[str, float]:
                if b == reference:
                    return {bf.name: -1.0 for bf in block_factors}
                return {
                    bf.name: (1.0 if bf.name == f"Bloco {b}" else 0.0)
                    for bf in block_factors
                }

            factors_fit = block_factors + list(factors)
            terms_fit = [_main_term(bf.name) for bf in block_factors] + list(terms)
            coded_fit = [
                {**_block_columns(b), **row} for row, b in zip(coded, run_blocks)
            ]
            natural_fit = [
                {**_block_columns(b), **row} for row, b in zip(natural, run_blocks)
            ]

        result = analyze(
            factors=factors_fit,
            coded=coded_fit,
            natural=natural_fit,
            y=y,
            terms=terms_fit,
            model_label=model.value,
            response_name=response_name,
        )

        # --- Agrega as k-1 linhas de bloco da ANOVA numa única linha "Bloco"
        # (soma SS/df, recalcula F/p contra o QM do resíduo). Sem isso um
        # design com 7 blocos mostraria seis linhas "Bloco 2".."Bloco 7" na
        # tabela -- ilegível. Também mantém válida a regra do advisor que
        # procura a linha cuja fonte contém "Bloco" (advisor_service.py).
        if block_term_labels and result.anova:
            result.anova = _aggregate_block_anova_rows(
                result.anova, block_term_labels, result.stats, block_name
            )

        # --- Teste de curvatura via pontos centrais (aula Cap.4 p4): só quando o
        # modelo ainda não carrega termos quadráticos e todos os fatores são
        # quantitativos, com >=2 centrais e >=1 ponto fatorial.
        if not any(t.kind == QUADRATIC for t in terms):
            from services import stats_service as _stats_service

            quant_mask = np.array([f.is_quantitative for f in factors], dtype=bool)
            coded_matrix = np.array(
                [[row[f.name] for f in factors] for row in coded], dtype=float
            )
            curv = _stats_service.curvature_test(
                coded_matrix, np.array(y, dtype=float), quant_mask
            )
            if curv is not None:
                ss_c, df_c, ms_c, f_c, p_c = curv
                result.curvature = AnovaRow(
                    source="Curvatura", ss=ss_c, df=df_c, ms=ms_c, f=f_c, p=p_c
                )
                if p_c < 0.05:
                    result.warnings.append(
                        "Curvatura significativa (p = "
                        f"{p_c:.4f}): a resposta não é plana na região. "
                        "Considere um modelo quadrático (CCD/Box-Behnken)."
                    )

        # Attach ready-to-draw plot arrays for an estimable, non-saturated fit.
        # Deferred import avoids a cycle (plot_service reuses helpers from here).
        if result.estimable and not result.saturated and result.stats is not None:
            from services import plot_service

            result.plots = plot_service.build_plots(
                factors=factors,
                coded=coded,
                natural=natural,
                y=y,
                terms=terms,
                result=result,
                factor_x=factor_x,
                factor_y=factor_y,
                run_order=run_order,
            )
        return result

    async def profiler(
        self,
        experiment_id: int,
        response_name: str,
        model: RSMModel,
        point: dict[str, float],
        maximize: bool = True,
    ):
        """Interactive profiler for one response/model: prediction + slices + optimum.

        Loads the same coded matrix/response as ``analyze`` and delegates to the
        pure ``plot_service.build_profiler``. Raises the same domain errors and a
        422-worthy ``InsufficientDataError`` when the model is not estimable."""
        factors, coded, y, terms = await self._load_coded(
            experiment_id, response_name, model
        )
        n_params = len(terms) + 1
        if len(y) < n_params:
            raise InsufficientDataError(
                f"Dados insuficientes: {len(y)} ensaios medidos para {n_params} "
                "parâmetros do modelo. Preencha mais respostas ou reduza os termos."
            )
        safe = _safe_names(factors)
        coded_df = pd.DataFrame(
            {safe[f.name]: [row[f.name] for row in coded] for f in factors}
        )
        x_design = build_design_matrix(coded_df, terms, safe)
        if int(np.linalg.matrix_rank(x_design.values)) < x_design.shape[1]:
            raise InsufficientDataError(
                "Modelo não estimável: posto da matriz insuficiente. Adicione "
                "pontos centrais ou use um CCD/Box-Behnken."
            )
        unknown = set(point) - {f.name for f in factors}
        if unknown:
            raise InsufficientDataError(
                f"Fatores desconhecidos no ponto: {', '.join(sorted(unknown))}."
            )

        from services import plot_service

        return plot_service.build_profiler(
            factors=factors,
            coded=coded,
            y=y,
            terms=terms,
            point=point,
            maximize=maximize,
        )

    async def _load_coded(
        self, experiment_id: int, response_name: str, model: RSMModel
    ) -> tuple[list[FactorInfo], list[dict[str, float]], list[float], list[TermInfo]]:
        experiment = await self._repo.get_experiment(experiment_id)
        if experiment is None:
            raise ExperimentNotFoundError(
                f"Experimento {experiment_id} não encontrado."
            )
        factors_orm = await self._repo.get_factors(experiment_id)
        responses = await self._repo.get_responses(experiment_id)
        runs = await self._repo.get_runs(experiment_id)

        if response_name not in {r.name for r in responses}:
            raise InsufficientDataError(
                f"Resposta '{response_name}' não existe neste experimento."
            )
        factors = [
            FactorInfo(
                name=f.name,
                factor_type=f.factor_type,
                low_label=_label_at(f, -1),
                high_label=_label_at(f, 1),
            )
            for f in factors_orm
        ]
        coded: list[dict[str, float]] = []
        y: list[float] = []
        for run in runs:
            value = (run.response_values or {}).get(response_name)
            if value is None:
                continue
            coded.append({f.name: float(run.cells[f.name]["coded"]) for f in factors})
            y.append(float(value))
        if not y:
            raise InsufficientDataError(
                f"Nenhum ensaio possui valor medido para '{response_name}'."
            )
        terms = terms_for_model(model, factors)
        return factors, coded, y, terms


def _label_at(factor: Factor, coded_value: int) -> str | None:
    for lv in factor.levels:
        if lv.coded_value == coded_value:
            return lv.label
    return None


def _natural_or_coded(cell: dict) -> float:
    natural = cell.get("natural")
    if natural is not None:
        return float(natural)
    return float(cell["coded"])
