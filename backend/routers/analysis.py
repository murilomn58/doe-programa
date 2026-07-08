"""APIRouter for the analysis engine — the only layer that knows HTTP.

Thin controller: maps the request to a service call, maps the framework-free
``AnalysisResultData`` to the read schema (sanitizing non-finite floats to null
so the JSON stays valid), and translates domain errors to HTTP status codes.
"""

import math

from fastapi import APIRouter, HTTPException, status

from deps import AnalysisServiceDep
from domain.analysis import AnalysisResultData, AnovaRow
from domain.errors import ExperimentNotFoundError, InsufficientDataError
from domain.plots import PlotBundle
from domain.schemas import (
    AnalysisRequest,
    AnalysisResultRead,
    AnovaRowRead,
    CoefRowRead,
    EffectRowRead,
    InteractionLineRead,
    InteractionRead,
    LenthRead,
    MainEffectRead,
    ObsVsPredRead,
    ParetoRead,
    PlotsRead,
    QQRead,
    ScatterRead,
    StatsPanelRead,
    SurfaceRead,
    TermRead,
)
from domain.types import RSMModel

router = APIRouter(prefix="/analysis", tags=["analysis"])


@router.post("", response_model=AnalysisResultRead)
async def run_analysis(
    payload: AnalysisRequest, service: AnalysisServiceDep
) -> AnalysisResultRead:
    try:
        result = await service.analyze(
            payload.experiment_id,
            payload.response_name,
            payload.model,
            factor_x=payload.factor_x,
            factor_y=payload.factor_y,
        )
    except ExperimentNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    except InsufficientDataError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)
        ) from exc
    return _to_read(result)


def _f(value: float | None) -> float | None:
    """None-pass-through; map NaN/inf to None so the response is valid JSON."""
    if value is None:
        return None
    if not math.isfinite(value):
        return None
    return float(value)


def _farr(values: list[float]) -> list[float | None]:
    return [_f(v) for v in values]


def _surface(surface) -> SurfaceRead | None:
    if surface is None:
        return None
    return SurfaceRead(
        factor_x=surface.factor_x,
        factor_y=surface.factor_y,
        x=surface.x,
        y=surface.y,
        z=[_farr(row) for row in surface.z],
        points_x=surface.points_x,
        points_y=surface.points_y,
    )


def _plots(bundle: PlotBundle | None) -> PlotsRead | None:
    if bundle is None:
        return None
    return PlotsRead(
        factor_pairs=bundle.factor_pairs,
        selected_pair=bundle.selected_pair,
        grand_mean=bundle.grand_mean,
        surface=_surface(bundle.surface),
        contour=_surface(bundle.contour),
        pareto=(
            ParetoRead(
                terms=bundle.pareto.terms,
                std_effects=bundle.pareto.std_effects,
                sig_line=bundle.pareto.sig_line,
                alpha=bundle.pareto.alpha,
            )
            if bundle.pareto is not None
            else None
        ),
        main_effects=[
            MainEffectRead(
                factor=m.factor,
                level_labels=m.level_labels,
                levels=m.levels,
                means=_farr(m.means),
            )
            for m in bundle.main_effects
        ],
        interaction=(
            InteractionRead(
                factor_x=bundle.interaction.factor_x,
                factor_group=bundle.interaction.factor_group,
                x_levels=bundle.interaction.x_levels,
                x_labels=bundle.interaction.x_labels,
                lines=[
                    InteractionLineRead(
                        level_label=line.level_label,
                        x=line.x,
                        y=_farr(line.y),
                        ci_low=_farr(line.ci_low),
                        ci_high=_farr(line.ci_high),
                    )
                    for line in bundle.interaction.lines
                ],
            )
            if bundle.interaction is not None
            else None
        ),
        obs_vs_pred=(
            ObsVsPredRead(
                observed=bundle.obs_vs_pred.observed,
                predicted=bundle.obs_vs_pred.predicted,
                line_min=bundle.obs_vs_pred.line_min,
                line_max=bundle.obs_vs_pred.line_max,
                r_squared=_f(bundle.obs_vs_pred.r_squared),
            )
            if bundle.obs_vs_pred is not None
            else None
        ),
        residual_vs_fitted=(
            ScatterRead(
                x=bundle.residual_vs_fitted.x,
                y=bundle.residual_vs_fitted.y,
            )
            if bundle.residual_vs_fitted is not None
            else None
        ),
        qq=(
            QQRead(
                theoretical=bundle.qq.theoretical,
                sample=bundle.qq.sample,
                line_slope=bundle.qq.line_slope,
                line_intercept=bundle.qq.line_intercept,
            )
            if bundle.qq is not None
            else None
        ),
    )


def _anova_row(row: AnovaRow | None) -> AnovaRowRead | None:
    if row is None:
        return None
    return AnovaRowRead(
        source=row.source,
        ss=row.ss,
        df=row.df,
        ms=_f(row.ms),
        f=_f(row.f),
        p=_f(row.p),
    )


def _to_read(r: AnalysisResultData) -> AnalysisResultRead:
    return AnalysisResultRead(
        response_name=r.response_name,
        model=RSMModel(r.model) if r.model in RSMModel._value2member_map_ else RSMModel.LINEAR,
        estimable=r.estimable,
        saturated=r.saturated,
        warnings=r.warnings,
        sign_maps=r.sign_maps,
        terms=[TermRead(label=t.label, kind=t.kind) for t in r.terms],
        anova=[_anova_row(row) for row in r.anova],  # type: ignore[misc]
        pure_error=_anova_row(r.pure_error),
        lack_of_fit=_anova_row(r.lack_of_fit),
        total=_anova_row(r.total),
        effects=[
            EffectRowRead(
                term=e.term,
                effect=e.effect,
                coef_coded=e.coef_coded,
                std_err=_f(e.std_err),
                t=_f(e.t),
                p=_f(e.p),
                ci_low=_f(e.ci_low),
                ci_high=_f(e.ci_high),
                pseudo_t=_f(e.pseudo_t),
                significant=e.significant,
            )
            for e in r.effects
        ],
        coefficients=[
            CoefRowRead(
                term=c.term,
                coef_coded=c.coef_coded,
                coef_natural=_f(c.coef_natural),
                std_err=_f(c.std_err),
                t=_f(c.t),
                p=_f(c.p),
                ci_low=_f(c.ci_low),
                ci_high=_f(c.ci_high),
                vif=_f(c.vif),
            )
            for c in r.coefficients
        ],
        stats=(
            StatsPanelRead(
                n_obs=r.stats.n_obs,
                df_resid=r.stats.df_resid,
                r_squared=r.stats.r_squared,
                adj_r_squared=r.stats.adj_r_squared,
                rmse=r.stats.rmse,
                sse=r.stats.sse,
                total_ss=r.stats.total_ss,
                press=_f(r.stats.press),
                predicted_r_squared=_f(r.stats.predicted_r_squared),
            )
            if r.stats is not None
            else None
        ),
        lenth=(
            LenthRead(pse=r.lenth.pse, me=r.lenth.me, sme=r.lenth.sme, alpha=r.lenth.alpha)
            if r.lenth is not None
            else None
        ),
        r_squared=_f(r.r_squared),
        adj_r_squared=_f(r.adj_r_squared),
        ms_pure_error=_f(r.ms_pure_error),
        plots=_plots(r.plots),
    )
