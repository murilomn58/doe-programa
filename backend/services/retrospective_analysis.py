"""Retrospective estimability + completions + diagnose (lane C part 2).

Consumes the pure detection core (``retrospective_service``) and the shared
model-matrix builder (``analysis_service.build_design_matrix``) — the SAME X
assembly the golden analysis uses, so the rank guard reports one truth through
two doors (POST /analysis and POST /retrospective/diagnose).

Pipeline (all pure, no DB/HTTP):
``diagnose`` = parse → scales → classify → replicate_info → detect_designs →
``assess_models`` (per RSM model: estimable / saturated / not_estimable) →
``propose_completions`` (deterministic runs-to-add that unlock a target model).

Codificação ±1 explícita (ADR-005); guard matrix_rank(X) vs n_cols (ADR-007).
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from domain.schemas import (
    ModelAssessmentRead,
    RetroDiagnoseRequest,
    RetroDiagnoseResponse,
)
from domain.types import RSMModel
from services import analysis_service
from services import retrospective_service as retro
from services.analysis_service import FactorInfo
from services.retrospective_service import FactorScale, ParsedTable

# RSM models ordered simplest -> most complete (best_model prefers the last).
_MODEL_ORDER = [
    RSMModel.LINEAR,
    RSMModel.LINEAR_INTERACTIONS,
    RSMModel.LINEAR_QUADRATIC,
    RSMModel.FULL,
]
_COMPLETENESS = {m.value: i for i, m in enumerate(_MODEL_ORDER)}

DOPT_REG = 1e-9  # ridge on X^T X so det stays finite while X is rank-deficient
DOPT_MAX_ADD = 8  # hard cap on greedy augmentation points (matches k<=8 story)


# --- coding a parsed table into the coded design space ------------------------


def _active_scales(scales: list[FactorScale]) -> list[FactorScale]:
    """Two-level scales that enter the ±1 coding (constants excluded)."""
    return [s for s in scales if s.active]


def _multilevel_scales(scales: list[FactorScale]) -> list[FactorScale]:
    """Qualitative factors with 3+ categories (dummy-coded, never squared)."""
    return [
        s
        for s in scales
        if not s.is_constant
        and s.factor_type == "qualitative"
        and s.label_map is None
        and s.labels
        and len(s.labels) >= 2
    ]


def _code_value(scale: FactorScale, value: float | str) -> float:
    """Code one two-level cell to ±1 (or its snapped position for axial/center)."""
    if scale.factor_type == "qualitative":
        return scale.label_map[str(value)]
    half = (scale.high - scale.low) / 2
    return (float(value) - scale.center) / half


def _factor_infos(
    active: list[FactorScale], multilevel: list[FactorScale]
) -> tuple[list[FactorInfo], dict[str, list[str]]]:
    """Build the ``FactorInfo`` list the analysis core needs.

    Two-level factors map straight to a quantitative/qualitative ``FactorInfo``.
    Each 3+-level qualitative becomes ``n-1`` treatment dummy pseudo-factors
    (first label dropped as the reference), always quantitative main effects so
    the term builder never forms a dummy² term. Returns the infos plus a map of
    original name -> its dummy pseudo-factor names.
    """
    infos: list[FactorInfo] = []
    dummy_map: dict[str, list[str]] = {}
    for s in active:
        if s.factor_type == "qualitative":
            infos.append(
                FactorInfo(
                    s.name, "qualitative",
                    low_label=s.labels[0] if s.labels else None,
                    high_label=s.labels[1] if s.labels and len(s.labels) > 1 else None,
                )
            )
        else:
            infos.append(FactorInfo(s.name, "quantitative"))
    for s in multilevel:
        names = [f"{s.name}::{lbl}" for lbl in s.labels[1:]]
        dummy_map[s.name] = names
        infos.extend(FactorInfo(n, "quantitative") for n in names)
    return infos, dummy_map


def _safe_frame(coded_df: pd.DataFrame, infos: list[FactorInfo]) -> pd.DataFrame:
    """Rename a factor-name-keyed coded frame to the patsy-safe column names.

    ``build_design_matrix`` expects the same safe-named columns that
    ``analyze`` feeds it (``x0``, ``x1``…), so both go through one X assembly.
    """
    safe = analysis_service._safe_names(infos)
    return coded_df.rename(columns=safe)


def _coded_frame(
    prows,
    active: list[FactorScale],
    multilevel: list[FactorScale],
    dummy_map: dict[str, list[str]],
) -> pd.DataFrame:
    """Coded columns (±1 / dummies) for the given rows, keyed by factor name."""
    columns: dict[str, list[float]] = {s.name: [] for s in active}
    for s in multilevel:
        for dn in dummy_map[s.name]:
            columns[dn] = []
    for prow in prows:
        for s in active:
            columns[s.name].append(_code_value(s, prow.factors[s.name]))
        for s in multilevel:
            label = str(prow.factors[s.name])
            for lbl, dn in zip(s.labels[1:], dummy_map[s.name], strict=True):
                columns[dn].append(1.0 if label == lbl else 0.0)
    return pd.DataFrame(columns)


# --- 2. estimability assessment ------------------------------------------------


def _response_used(parsed: ParsedTable, response_name: str | None) -> str | None:
    """Chosen response: the request's, else the one with the most filled values."""
    names = list(parsed.rows[0].responses.keys()) if parsed.rows else []
    if response_name and response_name in names:
        return response_name
    best, best_count = None, -1
    for name in names:
        count = sum(1 for r in parsed.rows if r.responses.get(name) is not None)
        if count > best_count:
            best, best_count = name, count
    return best


def _quadratic_reason(infos: list[FactorInfo]) -> str:
    quant = [f.name for f in infos if f.is_quantitative]
    return (
        "termos quadráticos exigem ≥3 níveis por fator (pontos axiais ou centrais); "
        f"os fatores {', '.join(quant)} têm apenas 2 níveis nos dados."
    )


def _assess_one(
    model: RSMModel,
    infos: list[FactorInfo],
    coded_df: pd.DataFrame,
    n_rows: int,
) -> ModelAssessmentRead:
    """Classify one model as estimable / saturated / not_estimable / no_data."""
    if n_rows == 0:
        return ModelAssessmentRead(model=model.value, status="no_data")
    terms = analysis_service.terms_for_model(model, infos)
    safe = analysis_service._safe_names(infos)
    x = analysis_service.build_design_matrix(_safe_frame(coded_df, infos), terms, safe)
    n_cols = int(x.shape[1])
    rank = int(np.linalg.matrix_rank(x.values)) if len(x) else 0

    if rank < n_cols:
        has_quad = model in (RSMModel.LINEAR_QUADRATIC, RSMModel.FULL)
        if has_quad:
            reason = _quadratic_reason(infos)
        elif model in (RSMModel.LINEAR_INTERACTIONS, RSMModel.FULL):
            reason = (
                "interações confundidas com efeitos principais nesta fração "
                "(resolução insuficiente para estimar todas as interações)."
            )
        else:
            reason = (
                "colunas linearmente dependentes: os fatores não variam de forma "
                "independente nos dados."
            )
        return ModelAssessmentRead(
            model=model.value, status="not_estimable", n_params=n_cols, rank=rank,
            reason=reason,
        )
    if n_rows == n_cols:
        return ModelAssessmentRead(
            model=model.value, status="saturated", n_params=n_cols, rank=rank,
            df_resid=0,
            reason="sem graus de liberdade de erro — análise via Lenth PSE.",
        )
    return ModelAssessmentRead(
        model=model.value, status="estimable", n_params=n_cols, rank=rank,
        df_resid=n_rows - n_cols,
    )


def _best_model(models: list[ModelAssessmentRead]) -> str | None:
    """Most complete estimable model; fallback to most complete saturated."""
    def rank_of(statuses: set[str]) -> str | None:
        candidates = [m for m in models if m.status in statuses]
        if not candidates:
            return None
        return max(candidates, key=lambda m: _COMPLETENESS[m.model]).model

    return rank_of({"estimable"}) or rank_of({"saturated"})


def assess_models(
    scales: list[FactorScale], parsed: ParsedTable, response_name: str | None
) -> tuple[list[ModelAssessmentRead], str | None]:
    """Assess the four RSM models on the rows that carry the chosen response."""
    response = _response_used(parsed, response_name)
    active = _active_scales(scales)
    multilevel = _multilevel_scales(scales)
    if not active and not multilevel:
        empty = [ModelAssessmentRead(model=m.value, status="no_data") for m in _MODEL_ORDER]
        return empty, None

    used_rows = [
        r for r in parsed.rows if response is None or r.responses.get(response) is not None
    ]
    infos, dummy_map = _factor_infos(active, multilevel)
    coded_df = _coded_frame(used_rows, active, multilevel, dummy_map)
    n_rows = len(used_rows)

    models = [_assess_one(m, infos, coded_df, n_rows) for m in _MODEL_ORDER]
    return models, _best_model(models)


# --- 4. diagnose (orchestrator) ------------------------------------------------


def diagnose(req: RetroDiagnoseRequest) -> RetroDiagnoseResponse:
    """Full retrospective diagnosis (pure): detection + estimability + completions."""
    parsed = retro.parse_table(req)
    scales = retro.infer_factor_scales(parsed)
    runs = retro.classify_runs(parsed, scales)
    replicates = retro.replicate_info(runs)
    matches = retro.detect_designs(runs, scales)
    models, best_model = assess_models(scales, parsed, req.response_name)
    response_used = _response_used(parsed, req.response_name)
    # Deferred import: retrospective_completions imports the coding/estimability
    # primitives from this module, so a top-level import would be circular.
    from services.retrospective_completions import propose_completions

    completions = propose_completions(matches, models, scales, parsed)

    return RetroDiagnoseResponse(
        n_rows=len(req.rows),
        n_rows_valid=len(parsed.rows),
        row_issues=parsed.row_issues,
        factors=[retro.scale_to_read(s) for s in scales],
        runs=runs,
        replicates=replicates,
        design_matches=matches,
        best_design=matches[0].design_type if matches else None,
        models=models,
        best_model=best_model,
        response_used=response_used,
        completions=completions,
    )
