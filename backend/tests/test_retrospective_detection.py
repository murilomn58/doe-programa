"""TDD tests for the retrospective detection engine (lane C part 1).

pyDOE3 is the oracle: coded matrices become natural-unit string tables (comma
decimals on half the rows), deterministically shuffled (random.Random(42)) and
perturbed with tiny relative noise (1e-7), then fed to the pure core in
``services.retrospective_service``.

Aliasing name convention (fixed here): letters a, b, c… follow the order of
``req.factors``; alias strings use the REAL factor names — concatenated when
every name is a single character ("A = BC"), joined with '*' otherwise.
"""

import random

import numpy as np
import pytest
from pyDOE3 import bbdesign, ccdesign, ff2n, fracfact

from domain.schemas import (
    RetroDiagnoseRequest,
    RetroFactorSpec,
    RetroResponseSpec,
    RetroRow,
)
from services import retrospective_service as retro

FACTORS_3 = [("A", 10.0, 30.0), ("B", 0.0, 100.0), ("C", 1.0, 5.0)]
FACTORS_2 = [("A", 10.0, 30.0), ("B", 0.0, 100.0)]


# --- helpers ------------------------------------------------------------------


def _natural(coded: float, low: float, high: float) -> float:
    center = (low + high) / 2
    half = (high - low) / 2
    return center + coded * half


def _cell(value: float, use_comma: bool, rng: random.Random) -> str:
    noisy = value * (1 + rng.uniform(-1e-7, 1e-7))
    text = repr(noisy)
    return text.replace(".", ",") if use_comma else text


def _rows(matrix, factors, seed: int = 42) -> list[RetroRow]:
    """pyDOE3 coded matrix -> natural string rows (noise + comma + shuffle)."""
    rng = random.Random(seed)
    rows = []
    for i, coded_row in enumerate(matrix):
        cells = {
            name: _cell(_natural(float(coded_row[j]), low, high), i % 2 == 0, rng)
            for j, (name, low, high) in enumerate(factors)
        }
        rows.append(RetroRow(factors=cells, responses={"Y": "1,0"}))
    rng.shuffle(rows)
    return rows


def _request(rows, factors, specs=None) -> RetroDiagnoseRequest:
    return RetroDiagnoseRequest(
        factors=specs or [RetroFactorSpec(name=name) for name, _, _ in factors],
        responses=[RetroResponseSpec(name="Y")],
        rows=rows,
    )


def _pipeline(req):
    parsed = retro.parse_table(req)
    scales = retro.infer_factor_scales(parsed)
    runs = retro.classify_runs(parsed, scales)
    matches = retro.detect_designs(runs, scales)
    return parsed, scales, runs, matches


def _scale(scales, name):
    return next(s for s in scales if s.name == name)


def _match(matches, design_type):
    return next(m for m in matches if m.design_type == design_type)


# --- full factorial 2^k -------------------------------------------------------


def test_full_2k3_complete():
    _, _, _, matches = _pipeline(_request(_rows(ff2n(3), FACTORS_3), FACTORS_3))
    best = matches[0]
    assert best.design_type == "full_factorial_2k"
    assert best.status == "complete"
    assert best.n_matched == 8
    assert best.n_expected == 8
    assert best.match_pct == pytest.approx(100.0)
    assert best.missing_runs == []


def test_full_2k3_two_replicates_df_pure_error():
    matrix = np.vstack([ff2n(3), ff2n(3)])
    _, _, runs, matches = _pipeline(_request(_rows(matrix, FACTORS_3), FACTORS_3))
    assert matches[0].design_type == "full_factorial_2k"
    assert matches[0].status == "complete"
    info = retro.replicate_info(runs)
    assert info.df_pure_error == 8
    assert info.n_points_replicated == 8
    assert info.runs_per_point_max == 2


def test_full_2k3_with_centers_detail_mentions_centers():
    matrix = np.vstack([ff2n(3), np.zeros((3, 3))])
    _, _, runs, matches = _pipeline(_request(_rows(matrix, FACTORS_3), FACTORS_3))
    best = matches[0]
    assert best.design_type == "full_factorial_2k"
    assert best.status == "complete"
    assert "central" in best.detail
    assert sum(1 for r in runs if r.point_type == "center") == 3


def test_full_2k3_missing_corners_partial_with_exact_missing_runs():
    matrix = np.delete(ff2n(3), [0, 5], axis=0)  # drop (-,-,-) and (+,-,+)
    _, _, _, matches = _pipeline(_request(_rows(matrix, FACTORS_3), FACTORS_3))
    best = _match(matches, "full_factorial_2k")
    assert best.status == "partial"
    assert best.n_matched == 6
    assert best.n_expected == 8
    assert best.match_pct == pytest.approx(75.0)
    missing = sorted(best.missing_runs, key=lambda d: (d["A"], d["C"]))
    expected = [{"A": 10.0, "B": 0.0, "C": 1.0}, {"A": 30.0, "B": 0.0, "C": 5.0}]
    assert len(missing) == 2
    for got, want in zip(missing, expected, strict=True):
        for key, value in want.items():
            assert got[key] == pytest.approx(value, rel=1e-5, abs=1e-9), key


# --- fractional factorial 2^(k-p) ---------------------------------------------


def test_fracfact_half_fraction_resolution_iii_aliasing():
    matrix = fracfact("a b ab")
    _, _, _, matches = _pipeline(_request(_rows(matrix, FACTORS_3), FACTORS_3))
    best = matches[0]
    assert best.design_type == "fractional_factorial_2kp"
    assert best.status == "complete"
    assert best.resolution == 3
    assert best.defining_relation == "I = ABC"
    assert "A = BC" in (best.aliasing or [])
    # the full-2^3 partial hypothesis is also listed (all hypotheses returned)
    partial = _match(matches, "full_factorial_2k")
    assert partial.status == "partial"
    assert partial.match_pct == pytest.approx(50.0)


# --- central composite --------------------------------------------------------


def test_ccd_rotatable_complete():
    matrix = ccdesign(2, center=(2, 2), alpha="rotatable", face="circumscribed")
    _, scales, _, matches = _pipeline(_request(_rows(matrix, FACTORS_2), FACTORS_2))
    best = matches[0]
    assert best.design_type == "central_composite"
    assert best.status == "complete"
    assert best.variant == "rotatable"
    assert _scale(scales, "A").alpha == pytest.approx(np.sqrt(2), rel=1e-3)
    assert _scale(scales, "B").alpha == pytest.approx(np.sqrt(2), rel=1e-3)
    # the full-2^2 cube is also a complete hypothesis, ranked below the CCD
    assert _match(matches, "full_factorial_2k").status == "complete"


def test_ccd_missing_axial_is_partial_with_exact_missing_run():
    matrix = ccdesign(2, center=(2, 2), alpha="rotatable", face="circumscribed")
    keep = ~((matrix[:, 0] > 1.1) & (np.abs(matrix[:, 1]) < 1e-9))  # drop +alpha of A
    _, _, _, matches = _pipeline(_request(_rows(matrix[keep], FACTORS_2), FACTORS_2))
    ccd = _match(matches, "central_composite")
    assert ccd.status == "partial"
    assert len(ccd.missing_runs) == 1
    miss = ccd.missing_runs[0]
    assert miss["A"] == pytest.approx(20.0 + np.sqrt(2) * 10.0, rel=1e-3)
    assert miss["B"] == pytest.approx(50.0, rel=1e-3)


# --- Box-Behnken ----------------------------------------------------------------


def test_bbd3_complete():
    matrix = bbdesign(3, center=3)
    _, _, runs, matches = _pipeline(_request(_rows(matrix, FACTORS_3), FACTORS_3))
    best = matches[0]
    assert best.design_type == "box_behnken"
    assert best.status == "complete"
    assert best.n_expected == 12  # 4 * C(3,2) edges
    assert sum(1 for r in runs if r.point_type == "edge") == 12
    assert sum(1 for r in runs if r.point_type == "center") == 3


# --- 3^k / face-centered ambiguity ---------------------------------------------


def test_3k2_grid_detected_as_3k_and_face_centered_ccd():
    grid = np.array([[a, b] for a in (-1, 0, 1) for b in (-1, 0, 1)], dtype=float)
    _, _, _, matches = _pipeline(_request(_rows(grid, FACTORS_2), FACTORS_2))
    assert matches[0].design_type == "full_factorial_3k"
    assert matches[0].status == "complete"
    ccd = _match(matches, "central_composite")
    assert ccd.status == "complete"
    assert ccd.variant == "face_centered"


# --- qualitative / constant factors --------------------------------------------


def test_qualitative_factor_in_2k3_detected_with_pm1_map():
    labels = {-1.0: "Tipo A", 1.0: "Tipo B"}
    rng = random.Random(42)
    rows = []
    for i, coded_row in enumerate(ff2n(3)):
        rows.append(
            RetroRow(
                factors={
                    "A": _cell(_natural(float(coded_row[0]), 10.0, 30.0), i % 2 == 0, rng),
                    "B": labels[float(coded_row[1])],
                    "C": _cell(_natural(float(coded_row[2]), 1.0, 5.0), i % 2 == 0, rng),
                }
            )
        )
    rng.shuffle(rows)
    req = RetroDiagnoseRequest(
        factors=[RetroFactorSpec(name=n) for n in ("A", "B", "C")], rows=rows
    )
    _, scales, _, matches = _pipeline(req)
    scale_b = _scale(scales, "B")
    assert scale_b.factor_type == "qualitative"
    assert set(scale_b.labels) == {"Tipo A", "Tipo B"}
    assert sorted(scale_b.label_map.values()) == [-1.0, 1.0]
    assert matches[0].design_type == "full_factorial_2k"
    assert matches[0].status == "complete"


def test_constant_factor_warns_and_reduces_k():
    rows = _rows(ff2n(3), FACTORS_3)
    for row in rows:
        row.factors["D"] = "7,5"
    specs = [RetroFactorSpec(name=n) for n in ("A", "B", "C", "D")]
    _, scales, _, matches = _pipeline(_request(rows, FACTORS_3, specs=specs))
    scale_d = _scale(scales, "D")
    assert scale_d.is_constant is True
    assert any("não variou" in w for w in scale_d.warnings)
    best = matches[0]
    assert best.design_type == "full_factorial_2k"
    assert best.status == "complete"
    assert best.n_expected == 8  # k reduced to 3


# --- parsing robustness ---------------------------------------------------------


def test_float_noise_and_comma_decimal_parse_and_cluster():
    rows = [
        RetroRow(factors={"A": "0,1", "B": "1"}),
        RetroRow(factors={"A": "0.15000000000000002", "B": "1"}),
        RetroRow(factors={"A": "0.1", "B": "2,0"}),
        RetroRow(factors={"A": "0,15", "B": "2"}),
    ]
    req = RetroDiagnoseRequest(
        factors=[RetroFactorSpec(name="A"), RetroFactorSpec(name="B")], rows=rows
    )
    parsed, scales, _, matches = _pipeline(req)
    assert parsed.row_issues == []
    scale_a = _scale(scales, "A")
    assert scale_a.n_levels == 2
    assert scale_a.low == pytest.approx(0.1)
    assert scale_a.high == pytest.approx(0.15)
    assert matches[0].design_type == "full_factorial_2k"
    assert matches[0].status == "complete"


def test_invalid_cell_row_excluded_with_issue_and_diagnosis_continues():
    rows = [
        RetroRow(factors={"A": "10", "B": "1"}),
        RetroRow(factors={"A": "30", "B": "1"}),
        RetroRow(factors={"A": "10", "B": "2"}),
        RetroRow(factors={"A": "30", "B": "2"}),
        RetroRow(factors={"A": "n/a", "B": "1"}),
    ]
    req = RetroDiagnoseRequest(
        factors=[
            RetroFactorSpec(name="A", factor_type="quantitative"),
            RetroFactorSpec(name="B"),
        ],
        rows=rows,
    )
    parsed, _, runs, matches = _pipeline(req)
    assert len(parsed.row_issues) == 1
    issue = parsed.row_issues[0]
    assert issue.row == 5
    assert "A" in issue.message
    assert len(runs) == 4
    assert matches[0].design_type == "full_factorial_2k"
    assert matches[0].status == "complete"


def test_empty_factor_cell_row_excluded_with_ptbr_message():
    rows = [
        RetroRow(factors={"A": "10", "B": "1"}),
        RetroRow(factors={"A": " ", "B": "2"}),
        RetroRow(factors={"A": "30", "B": "1"}),
        RetroRow(factors={"A": "10", "B": "2"}),
        RetroRow(factors={"A": "30", "B": "2"}),
    ]
    req = RetroDiagnoseRequest(
        factors=[RetroFactorSpec(name="A"), RetroFactorSpec(name="B")], rows=rows
    )
    parsed, _, _, matches = _pipeline(req)
    assert [i.row for i in parsed.row_issues] == [2]
    assert "vazio" in parsed.row_issues[0].message
    assert matches[0].status == "complete"


# --- irregular levels -----------------------------------------------------------


def test_three_irregular_levels_no_ccd_candidate():
    """3x3 grid but factor A's middle level is far from the midpoint."""
    rows = []
    a_levels = {-1.0: "0", 0.0: "3", 1.0: "10"}  # midpoint would be 5, mid is 3
    b_levels = {-1.0: "0", 0.0: "5", 1.0: "10"}
    for a in (-1.0, 0.0, 1.0):
        for b in (-1.0, 0.0, 1.0):
            rows.append(RetroRow(factors={"A": a_levels[a], "B": b_levels[b]}))
    req = RetroDiagnoseRequest(
        factors=[RetroFactorSpec(name="A"), RetroFactorSpec(name="B")], rows=rows
    )
    _, scales, _, matches = _pipeline(req)
    scale_a = _scale(scales, "A")
    assert scale_a.alpha is None
    assert any("irregular" in w for w in scale_a.warnings)
    assert all(m.design_type != "central_composite" for m in matches)
    assert all(m.design_type != "full_factorial_3k" for m in matches)


def test_distorted_ccd_center_level_yields_irregular():
    """CCD-shaped data whose factor-A mid level is off-midpoint -> irregular."""
    matrix = ccdesign(2, center=(1, 1), alpha="rotatable", face="circumscribed")
    rng = random.Random(42)
    rows = []
    for i, (ca, cb) in enumerate(matrix):
        nat_a = 14.0 if abs(ca) < 1e-9 else _natural(float(ca), 10.0, 30.0)
        rows.append(
            RetroRow(
                factors={
                    "A": _cell(nat_a, i % 2 == 0, rng),
                    "B": _cell(_natural(float(cb), 0.0, 100.0), i % 2 == 1, rng),
                }
            )
        )
    rng.shuffle(rows)
    req = RetroDiagnoseRequest(
        factors=[RetroFactorSpec(name="A"), RetroFactorSpec(name="B")], rows=rows
    )
    _, scales, _, matches = _pipeline(req)
    scale_a = _scale(scales, "A")
    assert scale_a.alpha is None
    assert any("irregular" in w for w in scale_a.warnings)
    assert all(m.design_type != "central_composite" for m in matches)
    assert matches[0].design_type == "irregular"
    assert matches[0].status == "irregular"
