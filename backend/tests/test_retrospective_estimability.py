"""Estimability + completions tests for the retrospective analysis core.

Same truth, two doors: a model reported ``not_estimable`` here must ALSO come
back non-estimable from ``analysis_service.analyze`` (the golden guard), because
both go through ``analysis_service.build_design_matrix``.
"""

import numpy as np
import pandas as pd
from pyDOE3 import ccdesign, ff2n

from domain.schemas import (
    ModelAssessmentRead,
    RetroDiagnoseRequest,
    RetroFactorSpec,
    RetroResponseSpec,
    RetroRow,
)
from domain.types import RSMModel
from services import analysis_service
from services import retrospective_analysis as ra
from services import retrospective_service as retro
from services.analysis_service import FactorInfo
from services.retrospective_service import FactorScale

FACTORS_2 = [("A", 10.0, 30.0), ("B", 0.0, 100.0)]
FACTORS_3 = [("A", 10.0, 30.0), ("B", 0.0, 100.0), ("C", 1.0, 5.0)]


def _natural(coded: float, low: float, high: float) -> float:
    return (low + high) / 2 + coded * (high - low) / 2


def _rows(matrix, factors):
    return [
        RetroRow(
            factors={
                name: str(_natural(float(row[j]), low, high))
                for j, (name, low, high) in enumerate(factors)
            },
            responses={"Y": "1.0"},
        )
        for row in matrix
    ]


def _diagnose(matrix, factors) -> tuple:
    req = RetroDiagnoseRequest(
        factors=[RetroFactorSpec(name=n) for n, _, _ in factors],
        responses=[RetroResponseSpec(name="Y")],
        rows=_rows(matrix, factors),
    )
    resp = ra.diagnose(req)
    return {m.model: m for m in resp.models}, resp


# --- 2^2 pure (n=4): the estimability ladder ----------------------------------


def test_2squared_pure_estimability_ladder():
    models, resp = _diagnose(ff2n(2), FACTORS_2)
    assert models["linear"].status == "estimable"
    assert models["linear"].df_resid == 1
    assert models["linear_interactions"].status == "saturated"
    assert models["linear_interactions"].n_params == 4
    assert models["linear_interactions"].df_resid == 0
    assert models["linear_quadratic"].status == "not_estimable"
    assert resp.best_model == "linear"


def test_2squared_two_replicates_interactions_estimable_df4():
    models, _ = _diagnose(np.vstack([ff2n(2), ff2n(2)]), FACTORS_2)
    assert models["linear_interactions"].status == "estimable"
    assert models["linear_interactions"].df_resid == 4
    assert models["linear_quadratic"].status == "not_estimable"


def test_2cubed_full_models_and_best():
    models, resp = _diagnose(ff2n(3), FACTORS_3)
    assert models["linear"].status == "estimable"
    assert models["linear"].df_resid == 4
    assert models["linear_interactions"].status == "estimable"
    assert models["linear_interactions"].df_resid == 1
    assert models["linear_quadratic"].status == "not_estimable"
    assert models["full"].status == "not_estimable"
    assert resp.best_model == "linear_interactions"


def test_ccd_complete_full_model_estimable():
    matrix = ccdesign(2, center=(3, 3), alpha="rotatable", face="circumscribed")
    models, resp = _diagnose(matrix, FACTORS_2)
    assert models["full"].status == "estimable"
    assert models["full"].df_resid is not None and models["full"].df_resid > 0
    assert resp.best_model == "full"


# --- consistency with analyze()'s guard (same truth, two doors) ---------------


def test_not_estimable_matches_analyze_guard():
    """A model diagnosed not_estimable must also be non-estimable in analyze()."""
    matrix = ff2n(2)  # 2^2 pure -> linear_quadratic not estimable
    models, _ = _diagnose(matrix, FACTORS_2)
    assert models["linear_quadratic"].status == "not_estimable"

    # Feed the SAME coded rows + quadratic model straight into analyze().
    factors = [FactorInfo("A", "quantitative"), FactorInfo("B", "quantitative")]
    coded = [{"A": float(r[0]), "B": float(r[1])} for r in matrix]
    natural = [
        {"A": _natural(r[0], 10, 30), "B": _natural(r[1], 0, 100)} for r in matrix
    ]
    y = [1.0, 2.0, 3.0, 4.0]
    terms = analysis_service.terms_for_model(RSMModel.LINEAR_QUADRATIC, factors)
    result = analysis_service.analyze(factors, coded, natural, y, terms)
    assert result.estimable is False


# --- completions ---------------------------------------------------------------


def test_full_factorial_partial_completion_lists_exact_missing_corner():
    matrix = np.delete(ff2n(2), [3], axis=0)  # drop the (+1,+1) corner
    req = RetroDiagnoseRequest(
        factors=[RetroFactorSpec(name=n) for n, _, _ in FACTORS_2],
        responses=[RetroResponseSpec(name="Y")],
        rows=_rows(matrix, FACTORS_2),
    )
    resp = ra.diagnose(req)
    completion = next(c for c in resp.completions if c.target == "full_factorial_2k")
    assert completion.n_runs_to_add == 1
    assert completion.runs_to_add == [{"A": 30.0, "B": 100.0}]


def test_full_2k_offers_ccd_face_centered_for_quadratic():
    resp = ra.diagnose(
        RetroDiagnoseRequest(
            factors=[RetroFactorSpec(name=n) for n, _, _ in FACTORS_2],
            responses=[RetroResponseSpec(name="Y")],
            rows=_rows(ff2n(2), FACTORS_2),
        )
    )
    fc = next(
        c for c in resp.completions
        if c.target == "linear_quadratic" and c.variant == "face_centered"
    )
    assert "linear_quadratic" in fc.enables
    # 2k axials (α=1) + 3 centers, all within the tested range
    assert fc.n_runs_to_add == 2 * 2 + 3
    rot = next(c for c in resp.completions if c.variant == "rotatable")
    assert "linear_quadratic" in rot.enables


def test_no_centers_offers_center_points():
    resp = ra.diagnose(
        RetroDiagnoseRequest(
            factors=[RetroFactorSpec(name=n) for n, _, _ in FACTORS_2],
            responses=[RetroResponseSpec(name="Y")],
            rows=_rows(ff2n(2), FACTORS_2),
        )
    )
    centers = next(c for c in resp.completions if c.target == "curvature")
    assert centers.n_runs_to_add == 3
    assert all(run == {"A": 20.0, "B": 50.0} for run in centers.runs_to_add)


# --- D-optimal augmentation (irregular, blocked target) -----------------------


def test_d_optimal_augmentation_unlocks_blocked_linear():
    """Two collinear points can't fit linear; greedy D-opt adds corners until it can."""
    a = FactorScale(
        name="A", factor_type="quantitative", n_levels=3, low=0.0, high=10.0, center=5.0
    )
    b = FactorScale(
        name="B", factor_type="quantitative", n_levels=3, low=0.0, high=10.0, center=5.0
    )
    active = [a, b]
    infos, dummy_map = ra._factor_infos(active, [])
    coded_existing = pd.DataFrame({"A": [-1.0, 1.0], "B": [-1.0, -1.0]})
    models = [
        ModelAssessmentRead(model="linear", status="not_estimable", n_params=3, rank=2)
    ]
    from services import retrospective_completions as rc

    aug = rc._d_optimal_augmentation(
        models, infos, coded_existing, active, [], dummy_map, active
    )
    assert aug is not None
    assert aug.variant == "d_optimal"
    assert aug.n_runs_to_add >= 1
    assert "linear" in aug.enables


# --- qualitative multilevel: dummy-coded rank (never dummy^2) ------------------


def test_multilevel_qualitative_uses_dummies_in_rank():
    """A 3-level qualitative factor becomes 2 dummies; linear estimable, no dummy²."""
    labels = ["Tucum", "Piassava", "Sisal"]
    rows = []
    # 2-level quant A x 3-level qual B, one rep each of 6 combos + 2 reps for df.
    for a in (10.0, 30.0):
        for lb in labels:
            rows.append(RetroRow(factors={"A": str(a), "B": lb}, responses={"Y": "1.0"}))
    rows += [RetroRow(factors={"A": "10.0", "B": "Tucum"}, responses={"Y": "1.0"})]
    req = RetroDiagnoseRequest(
        factors=[RetroFactorSpec(name="A"), RetroFactorSpec(name="B", factor_type="qualitative")],
        responses=[RetroResponseSpec(name="Y")],
        rows=rows,
    )
    resp = ra.diagnose(req)
    models = {m.model: m for m in resp.models}
    # linear params = intercept + A + 2 dummies of B = 4
    assert models["linear"].n_params == 4
    assert models["linear"].status == "estimable"
    scale_b = next(s for s in retro.infer_factor_scales(retro.parse_table(req)) if s.name == "B")
    assert scale_b.n_levels == 3


def test_response_used_prefers_most_filled_when_unspecified():
    rows = [
        RetroRow(factors={"A": "10", "B": "1"}, responses={"Y1": "", "Y2": "5"}),
        RetroRow(factors={"A": "30", "B": "1"}, responses={"Y1": "", "Y2": "6"}),
        RetroRow(factors={"A": "10", "B": "2"}, responses={"Y1": "3", "Y2": "7"}),
        RetroRow(factors={"A": "30", "B": "2"}, responses={"Y1": "", "Y2": "8"}),
    ]
    req = RetroDiagnoseRequest(
        factors=[RetroFactorSpec(name="A"), RetroFactorSpec(name="B")],
        responses=[RetroResponseSpec(name="Y1"), RetroResponseSpec(name="Y2")],
        rows=rows,
    )
    resp = ra.diagnose(req)
    assert resp.response_used == "Y2"  # 4 filled vs 1 filled
