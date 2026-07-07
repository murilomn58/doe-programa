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
from domain.schemas import (
    AnalysisRequest,
    AnalysisResultRead,
    AnovaRowRead,
    CoefRowRead,
    EffectRowRead,
    LenthRead,
    StatsPanelRead,
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
            payload.experiment_id, payload.response_name, payload.model
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
    )
