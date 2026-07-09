"""Deterministic completion suggestions for a retrospective table.

Given the detected design, the per-model estimability, and the inferred scales,
propose concrete runs-to-add that unlock a target model — complete a partial
2^k, augment a cube into a CCD (face-centered / rotatable), fold over a
resolution-III fraction, add center points, or (irregular tables) greedily pick
D-optimal points given what was already executed.

Shares the coding/estimability primitives with ``retrospective_analysis`` (one X
assembly, ADR-005/007); ``diagnose`` there calls ``propose_completions`` here.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from domain.schemas import (
    CompletionRead,
    DesignMatchRead,
    ModelAssessmentRead,
)
from domain.types import RSMModel
from services import analysis_service
from services import retrospective_service as retro
from services.analysis_service import FactorInfo
from services.retrospective_analysis import (
    _MODEL_ORDER,
    DOPT_MAX_ADD,
    DOPT_REG,
    _active_scales,
    _code_value,
    _coded_frame,
    _factor_infos,
    _multilevel_scales,
    _safe_frame,
)
from services.retrospective_service import FactorScale, ParsedTable


def _enabled_models(
    coded_existing: pd.DataFrame,
    coded_added: pd.DataFrame,
    infos: list[FactorInfo],
) -> list[str]:
    """Which RSM models become estimable (df>=1) once ``coded_added`` is present.

    Only the design matrix matters for the rank, so fictitious responses are
    irrelevant: we stack the coded rows and re-check rank vs columns.
    """
    combined = _safe_frame(
        pd.concat([coded_existing, coded_added], ignore_index=True), infos
    )
    n_rows = len(combined)
    safe = analysis_service._safe_names(infos)
    enabled: list[str] = []
    for model in _MODEL_ORDER:
        terms = analysis_service.terms_for_model(model, infos)
        x = analysis_service.build_design_matrix(combined, terms, safe)
        n_cols = int(x.shape[1])
        rank = int(np.linalg.matrix_rank(x.values)) if len(x) else 0
        if rank == n_cols and n_rows >= n_cols:
            enabled.append(model.value)
    return enabled


def _coded_rows_from_natural(
    natural_runs: list[dict[str, float | str]],
    active: list[FactorScale],
    multilevel: list[FactorScale],
    dummy_map: dict[str, list[str]],
) -> pd.DataFrame:
    """Code natural-valued candidate runs into the same coded frame layout."""
    columns: dict[str, list[float]] = {s.name: [] for s in active}
    for s in multilevel:
        for dn in dummy_map[s.name]:
            columns[dn] = []
    for run in natural_runs:
        for s in active:
            columns[s.name].append(_code_value(s, run[s.name]))
        for s in multilevel:
            label = str(run.get(s.name, ""))
            for lbl, dn in zip(s.labels[1:], dummy_map[s.name], strict=True):
                columns[dn].append(1.0 if label == lbl else 0.0)
    return pd.DataFrame(columns)


def _natural_corner(signs: tuple[int, ...], active: list[FactorScale]) -> dict[str, float | str]:
    """A ±1 corner as natural values / labels (2-level factors only)."""
    out: dict[str, float | str] = {}
    for scale, sign in zip(active, signs, strict=True):
        if scale.factor_type == "qualitative":
            out[scale.name] = scale.labels[0] if sign < 0 else scale.labels[1]
        else:
            out[scale.name] = scale.low if sign < 0 else scale.high
    return out


def _axial_point(scale: FactorScale, sign: int, active: list[FactorScale], alpha: float) -> dict:
    """A single-factor axial run at ±alpha (others at their center)."""
    point: dict[str, float | str] = {}
    for s in active:
        if s.name == scale.name:
            half = (s.high - s.low) / 2
            point[s.name] = s.center + sign * alpha * half
        elif s.factor_type == "qualitative":
            point[s.name] = s.labels[0]
        else:
            point[s.name] = s.center
    return point


def _center_point(active: list[FactorScale]) -> dict[str, float | str]:
    return {
        s.name: (s.labels[0] if s.factor_type == "qualitative" else s.center)
        for s in active
    }


def _completion(
    target: str,
    title: str,
    runs: list[dict[str, float | str]],
    rationale: str,
    infos: list[FactorInfo],
    coded_existing: pd.DataFrame,
    active: list[FactorScale],
    multilevel: list[FactorScale],
    dummy_map: dict[str, list[str]],
    variant: str | None = None,
) -> CompletionRead:
    added = _coded_rows_from_natural(runs, active, multilevel, dummy_map)
    return CompletionRead(
        target=target, variant=variant, title=title, runs_to_add=runs,
        n_runs_to_add=len(runs),
        enables=_enabled_models(coded_existing, added, infos),
        rationale=rationale,
    )


def _all_corners(active: list[FactorScale]) -> list[tuple[int, ...]]:
    k = len(active)
    return [tuple(1 if (m >> j) & 1 else -1 for j in range(k)) for m in range(2**k)]


def propose_completions(
    matches: list[DesignMatchRead],
    models: list[ModelAssessmentRead],
    scales: list[FactorScale],
    parsed: ParsedTable,
) -> list[CompletionRead]:
    """Deterministic, ordered suggestions of runs to add to unlock a model."""
    active = _active_scales(scales)
    multilevel = _multilevel_scales(scales)
    if not active:
        return []
    infos, dummy_map = _factor_infos(active, multilevel)
    coded_existing = _coded_frame(parsed.rows, active, multilevel, dummy_map)

    status = {m.model: m.status for m in models}
    quant = [s for s in active if s.factor_type == "quantitative"]
    n_centers = sum(1 for r in retro.classify_runs(parsed, scales) if r.point_type == "center")

    def make(target, title, runs, rationale, variant=None) -> CompletionRead:
        return _completion(
            target, title, runs, rationale, infos, coded_existing, active,
            multilevel, dummy_map, variant,
        )

    completions: list[CompletionRead] = []
    full = next((m for m in matches if m.design_type == "full_factorial_2k"), None)
    fraction = next((m for m in matches if m.design_type == "fractional_factorial_2kp"), None)
    corners_complete = full is not None and full.status == "complete"

    # (a) partial full 2^k: fill the missing corners
    if full is not None and full.status == "partial":
        present = {
            tuple(1 if r.coded[s.name] > 0 else -1 for s in active)
            for r in retro.classify_runs(parsed, scales)
            if r.point_type == "factorial"
        }
        missing = [c for c in _all_corners(active) if c not in present]
        if missing:
            runs = [_natural_corner(c, active) for c in missing]
            completions.append(make(
                "full_factorial_2k",
                f"Completar o fatorial: faltam {len(runs)} ensaios",
                runs,
                "Executar as combinações fatoriais ausentes fecha o cubo 2^k e "
                "desconfunde os efeitos que hoje faltam.",
            ))

    # (b) cube/fraction complete but quadratic not estimable -> CCD
    quad_blocked = status.get("linear_quadratic") == "not_estimable"
    if (corners_complete or fraction is not None) and quad_blocked and quant:
        n_axial = 2 * len(quant)
        n_center_add = max(3 - n_centers, 0)
        fc_runs: list[dict[str, float | str]] = []
        for s in quant:
            fc_runs.append(_axial_point(s, -1, active, 1.0))
            fc_runs.append(_axial_point(s, +1, active, 1.0))
        fc_runs += [_center_point(active) for _ in range(n_center_add)]
        completions.append(make(
            "linear_quadratic",
            f"Transformar em CCD face-centered: adicionar {n_axial} axiais (α=1) + "
            f"{n_center_add} centrais",
            fc_runs,
            "O CCD face-centered mantém todos os ensaios dentro da faixa já testada "
            "(α=1), permitindo estimar a curvatura sem extrapolar.",
            variant="face_centered",
        ))
        alpha = (2 ** len(quant)) ** 0.25
        rot_runs = []
        for s in quant:
            rot_runs.append(_axial_point(s, -1, active, alpha))
            rot_runs.append(_axial_point(s, +1, active, alpha))
        rot_runs += [_center_point(active) for _ in range(n_center_add)]
        completions.append(make(
            "linear_quadratic",
            f"Transformar em CCD rotatable: adicionar {n_axial} axiais (α≈{alpha:.3f}) + "
            f"{n_center_add} centrais",
            rot_runs,
            f"O CCD rotatable (α≈{alpha:.3f}) dá variância de predição uniforme, mas "
            "os pontos axiais extrapolam a faixa original dos fatores.",
            variant="rotatable",
        ))

    # (c) resolution III fraction -> fold-over (the complementary fraction)
    if fraction is not None and fraction.resolution == 3:
        present = {
            tuple(1 if r.coded[s.name] > 0 else -1 for s in active)
            for r in retro.classify_runs(parsed, scales)
            if r.point_type == "factorial"
        }
        fold = [_natural_corner(tuple(-x for x in c), active) for c in present]
        completions.append(make(
            "fractional_factorial_2kp",
            f"Fold-over completo: {len(fold)} ensaios",
            fold,
            "A fração complementar (todos os sinais invertidos) desconfunde os "
            "efeitos principais dos efeitos de interação de 2 fatores.",
            variant="fold_over",
        ))

    # (d) no center points at all -> add 3 to 5 centers
    if n_centers == 0 and quant:
        centers = [_center_point(active) for _ in range(3)]
        completions.append(make(
            "curvature",
            "Adicionar 3–5 pontos centrais",
            centers,
            "Pontos centrais dão um teste de curvatura e uma estimativa de erro puro "
            "sem alterar os efeitos já estimados.",
        ))

    # (e) irregular -> greedy D-optimal augmentation toward the best blocked model
    is_irregular = matches and matches[0].design_type == "irregular"
    if is_irregular:
        aug = _d_optimal_augmentation(
            models, infos, coded_existing, active, multilevel, dummy_map, quant
        )
        if aug is not None:
            completions.append(aug)

    return completions


# --- greedy D-optimal augmentation (irregular tables) --------------------------


def _target_model(models: list[ModelAssessmentRead]) -> RSMModel | None:
    """The simplest not-estimable model we should try to unlock, else None."""
    for m in _MODEL_ORDER:
        assess = next((a for a in models if a.model == m.value), None)
        if assess is not None and assess.status in ("not_estimable", "no_data"):
            return m
    return None


def _candidate_grid(
    active: list[FactorScale],
    multilevel: list[FactorScale],
    dummy_map: dict[str, list[str]],
    want_axials: bool,
) -> tuple[list[dict[str, float | str]], pd.DataFrame]:
    """Factorial ±1 corners (+ center, + axials when quadratic is the target)."""
    natural: list[dict[str, float | str]] = [
        _natural_corner(c, active) for c in _all_corners(active)
    ]
    natural.append(_center_point(active))
    if want_axials:
        for s in active:
            if s.factor_type == "quantitative":
                natural.append(_axial_point(s, -1, active, 1.0))
                natural.append(_axial_point(s, +1, active, 1.0))
    coded = _coded_rows_from_natural(natural, active, multilevel, dummy_map)
    return natural, coded


def _d_criterion(x: np.ndarray) -> float:
    """log-det of X^T X + ridge (monotone D surrogate, finite when singular)."""
    xtx = x.T @ x + DOPT_REG * np.eye(x.shape[1])
    sign, logdet = np.linalg.slogdet(xtx)
    return logdet if sign > 0 else -np.inf


def _d_optimal_augmentation(
    models: list[ModelAssessmentRead],
    infos: list[FactorInfo],
    coded_existing: pd.DataFrame,
    active: list[FactorScale],
    multilevel: list[FactorScale],
    dummy_map: dict[str, list[str]],
    quant: list[FactorScale],
) -> CompletionRead | None:
    """Greedily pick candidate points maximizing D given the executed runs."""
    target = _target_model(models)
    if target is None:
        return None
    want_axials = target in (RSMModel.LINEAR_QUADRATIC, RSMModel.FULL) and bool(quant)
    natural_grid, coded_grid = _candidate_grid(active, multilevel, dummy_map, want_axials)
    terms = analysis_service.terms_for_model(target, infos)
    safe = analysis_service._safe_names(infos)
    n_params = len(terms) + 1

    base = analysis_service.build_design_matrix(_safe_frame(coded_existing, infos), terms, safe)
    grid_x = analysis_service.build_design_matrix(_safe_frame(coded_grid, infos), terms, safe)
    base_rows = [base.values[i] for i in range(len(base))]
    cand_rows = [grid_x.values[i] for i in range(len(grid_x))]
    cand_natural = list(natural_grid)

    chosen: list[dict[str, float | str]] = []
    current = list(base_rows)
    max_iter = min(DOPT_MAX_ADD, 2 * n_params)
    for _ in range(max_iter):
        if _estimable_now(current, n_params):
            break
        best_i, best_score = None, -np.inf
        stack = np.array(current) if current else np.empty((0, n_params))
        for i, row in enumerate(cand_rows):
            trial = np.vstack([stack, row]) if len(stack) else row.reshape(1, -1)
            score = _d_criterion(trial)
            if score > best_score:
                best_i, best_score = i, score
        if best_i is None:
            break
        current.append(cand_rows[best_i])
        chosen.append(cand_natural[best_i])

    if not chosen:
        return None
    added = _coded_rows_from_natural(chosen, active, multilevel, dummy_map)
    return CompletionRead(
        target=target.value, variant="d_optimal",
        title=f"Aumento D-ótimo: adicionar {len(chosen)} ensaios",
        runs_to_add=chosen, n_runs_to_add=len(chosen),
        enables=_enabled_models(coded_existing, added, infos),
        rationale="Pontos escolhidos por D-otimalidade dado o que você já executou, "
        "priorizando os ensaios que mais reduzem a incerteza dos coeficientes.",
    )


def _estimable_now(rows: list[np.ndarray], n_params: int) -> bool:
    if len(rows) < n_params:
        return False
    x = np.array(rows)
    return int(np.linalg.matrix_rank(x)) == n_params and len(rows) >= n_params + 3
