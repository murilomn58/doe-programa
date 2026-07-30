"""TDD tests for the general (n-level) full factorial family — Task B.2.

Covers ``build_general_factorial_design`` (3^k and mixed levels): run count,
±1 coding correctness/orthogonality, own point-type classification (NOT the
CCD/BBD ``_classify_point``), estimability of ``linear_quadratic`` on a 3²
(ADR-007 guard), the advisor's ``extend_ccd`` gate, and the size guard
(warn > 81, refuse > 243 runs).
"""

import dataclasses

import numpy as np
import pytest

from domain.errors import DesignConfigError
from domain.schemas import DesignGenerateRequest, FactorSpec, ResponseSpec
from domain.types import DesignType, FactorType, PointType, RSMModel
from services import advisor_service
from services.analysis_service import FactorInfo, analyze, terms_for_model
from services.design_builders import build_general_factorial_design

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _quant(
    name: str,
    levels: list[float] | None = None,
    low: float = 0.0,
    high: float = 10.0,
) -> FactorSpec:
    return FactorSpec(
        name=name, factor_type=FactorType.QUANTITATIVE, low=low, high=high, levels=levels
    )


def _qual(name: str, lo: str = "L", hi: str = "H") -> FactorSpec:
    return FactorSpec(name=name, factor_type=FactorType.QUALITATIVE, low_label=lo, high_label=hi)


def _resp() -> list[ResponseSpec]:
    return [ResponseSpec(name="Y")]


def _req(factors: list[FactorSpec], **kwargs) -> DesignGenerateRequest:
    return DesignGenerateRequest(
        design_type=DesignType.FULL_FACTORIAL_GENERAL,
        factors=factors,
        responses=_resp(),
        **kwargs,
    )


def _build(factors: list[FactorSpec], **kwargs):
    req = _req(factors, **kwargs)
    return build_general_factorial_design(req.factors, req.responses, req)


# ---------------------------------------------------------------------------
# 3^2: run count, coding, orthogonality
# ---------------------------------------------------------------------------


class TestThreeSquared:
    def _design(self):
        factors = [
            _quant("A", levels=[1.0, 2.0, 3.0]),
            _quant("B", levels=[10.0, 20.0, 30.0]),
        ]
        return _build(factors, seed=0), factors

    def test_3x3_gives_9_runs(self):
        design, _ = self._design()
        assert len(design.runs) == 9

    def test_coded_values_are_exactly_minus1_zero_plus1(self):
        design, factors = self._design()
        for run in design.runs:
            for f in factors:
                assert run.cells[f.name].coded in (-1.0, 0.0, 1.0)

    def test_columns_are_orthogonal(self):
        """Inner product between the two main-effect coded columns is zero."""
        design, factors = self._design()
        runs_sorted = sorted(design.runs, key=lambda r: r.std_order)
        col_a = np.array([r.cells["A"].coded for r in runs_sorted])
        col_b = np.array([r.cells["B"].coded for r in runs_sorted])
        assert col_a.dot(col_b) == pytest.approx(0.0, abs=1e-9)

    def test_natural_values_match_declared_levels(self):
        design, _ = self._design()
        naturals_a = sorted({r.cells["A"].natural for r in design.runs})
        naturals_b = sorted({r.cells["B"].natural for r in design.runs})
        assert naturals_a == [1.0, 2.0, 3.0]
        assert naturals_b == [10.0, 20.0, 30.0]


# ---------------------------------------------------------------------------
# Mixed levels: 3x2
# ---------------------------------------------------------------------------


class TestMixedLevels:
    def test_3x2_gives_6_runs(self):
        factors = [_quant("A", levels=[1.0, 2.0, 3.0]), _quant("B")]  # B defaults to 2 levels
        design = _build(factors, seed=0)
        assert len(design.runs) == 6


# ---------------------------------------------------------------------------
# Point-type classification — own rule, NOT _classify_point
# ---------------------------------------------------------------------------


class TestPointType:
    def test_center_of_3x3_is_center_vertices_are_factorial(self):
        factors = [
            _quant("A", levels=[1.0, 2.0, 3.0]),
            _quant("B", levels=[10.0, 20.0, 30.0]),
        ]
        design = _build(factors, seed=0)
        centers = [
            r
            for r in design.runs
            if r.cells["A"].coded == 0.0 and r.cells["B"].coded == 0.0
        ]
        assert len(centers) == 1
        assert centers[0].point_type == PointType.CENTER

        others = [r for r in design.runs if r not in centers]
        assert len(others) == 8
        assert all(r.point_type == PointType.FACTORIAL for r in others)

    def test_no_run_of_a_3x3_is_classified_as_axial(self):
        """The 4-level-style ±1/3 misclassification bug must not appear here."""
        factors = [
            _quant("A", levels=[1.0, 2.0, 3.0]),
            _quant("B", levels=[10.0, 20.0, 30.0]),
        ]
        design = _build(factors, seed=0)
        assert all(r.point_type != PointType.AXIAL for r in design.runs)

    def test_mixed_grid_intermediate_level_is_not_axial(self):
        """A 4-level factor's ±1/3 code (one nonzero, would fool _classify_point)."""
        factors = [_quant("A", levels=[1.0, 2.0, 3.0, 4.0]), _quant("B", levels=[10.0, 20.0, 30.0])]
        design = _build(factors, seed=0)
        # A row where A is at an intermediate level (coded ±1/3) and B at its
        # center (coded 0) would look like a single-nonzero row: exactly the
        # shape _classify_point reads as an axial arm. Must still be FACTORIAL.
        intermediate_rows = [
            r
            for r in design.runs
            if abs(r.cells["A"].coded) == pytest.approx(1 / 3)
            and r.cells["B"].coded == 0.0
        ]
        assert intermediate_rows, "expected at least one such row in a 4x3 grid"
        assert all(r.point_type == PointType.FACTORIAL for r in intermediate_rows)


# ---------------------------------------------------------------------------
# Estimability of linear_quadratic on the 3^2 (ADR-007 guard)
# ---------------------------------------------------------------------------


class TestEstimability:
    def _factor_infos(self):
        return [FactorInfo("A", "quantitative"), FactorInfo("B", "quantitative")]

    def _coded_natural(self, design):
        runs_sorted = sorted(design.runs, key=lambda r: r.std_order)
        coded = [{"A": r.cells["A"].coded, "B": r.cells["B"].coded} for r in runs_sorted]
        natural = [{"A": r.cells["A"].natural, "B": r.cells["B"].natural} for r in runs_sorted]
        return coded, natural

    def test_linear_quadratic_model_matrix_is_full_rank(self):
        from services.analysis_service import _safe_names, build_design_matrix

        factors = [
            _quant("A", levels=[1.0, 2.0, 3.0]),
            _quant("B", levels=[10.0, 20.0, 30.0]),
        ]
        design = _build(factors, seed=0)
        factors_info = self._factor_infos()
        coded, _ = self._coded_natural(design)

        terms = terms_for_model(RSMModel.LINEAR_QUADRATIC, factors_info)
        safe = _safe_names(factors_info)
        import pandas as pd

        coded_df = pd.DataFrame(
            {safe[f.name]: [row[f.name] for row in coded] for f in factors_info}
        )
        x_design = build_design_matrix(coded_df, terms, safe)
        n_params = x_design.shape[1]
        rank = int(np.linalg.matrix_rank(x_design.values))
        assert rank == n_params

    def test_analyze_reports_estimable_true(self):
        factors = [
            _quant("A", levels=[1.0, 2.0, 3.0]),
            _quant("B", levels=[10.0, 20.0, 30.0]),
        ]
        design = _build(factors, seed=0)
        factors_info = self._factor_infos()
        coded, natural = self._coded_natural(design)
        y = [10 + 2 * c["A"] - 1.5 * c["B"] + 0.8 * c["A"] ** 2 - 0.3 * c["B"] ** 2 + 0.1 * i
             for i, c in enumerate(coded)]
        terms = terms_for_model(RSMModel.LINEAR_QUADRATIC, factors_info)
        res = analyze(
            factors_info,
            coded,
            natural,
            y,
            terms,
            model_label="linear_quadratic",
            response_name="Y",
        )
        assert res.estimable is True
        assert res.stats is not None


# ---------------------------------------------------------------------------
# Advisor: extend_ccd must NOT fire when the quadratic IS estimable
# ---------------------------------------------------------------------------


class TestAdvisorDoesNotSuggestExtendCcd:
    def test_no_extend_ccd_suggestion_for_estimable_quadratic_on_3x3(self):
        factors = [
            _quant("A", levels=[1.0, 2.0, 3.0]),
            _quant("B", levels=[10.0, 20.0, 30.0]),
        ]
        design = _build(factors, seed=0)
        runs_sorted = sorted(design.runs, key=lambda r: r.std_order)
        factors_info = [FactorInfo("A", "quantitative"), FactorInfo("B", "quantitative")]
        coded = [{"A": r.cells["A"].coded, "B": r.cells["B"].coded} for r in runs_sorted]
        natural = [{"A": r.cells["A"].natural, "B": r.cells["B"].natural} for r in runs_sorted]
        y = [10 + 2 * c["A"] - 1.5 * c["B"] + 0.8 * c["A"] ** 2 - 0.3 * c["B"] ** 2 + 0.1 * i
             for i, c in enumerate(coded)]
        terms = terms_for_model(RSMModel.LINEAR_QUADRATIC, factors_info)
        res = analyze(
            factors_info,
            coded,
            natural,
            y,
            terms,
            model_label="linear_quadratic",
            response_name="Y",
        )
        assert res.estimable is True  # guard: the test premise itself must hold

        result_dict = dataclasses.asdict(res)
        design_meta = {
            "has_center": any(r.point_type == PointType.CENTER for r in design.runs),
            "has_axial": any(r.point_type == PointType.AXIAL for r in design.runs),
            "max_replicate": max(r.replicate for r in design.runs),
            "all_quantitative": True,
            "n_runs_measured": len(y),
        }
        assert design_meta["has_axial"] is False

        advice = advisor_service.advise(result_dict, design_meta)
        actions = [s.get("action") for s in advice["suggestions"]]
        ids = [s.get("id") for s in advice["suggestions"]]
        assert "extend_ccd" not in actions
        assert "nao-estimavel" not in ids
        assert "quadratico-sem-axial" not in ids


# ---------------------------------------------------------------------------
# Size guard: warn > 81, refuse > 243
# ---------------------------------------------------------------------------


class TestSizeGuard:
    def test_3_pow_5_243_runs_is_allowed_with_warning(self):
        """3^5 = 243 sits exactly on the refuse threshold (not above it): warns."""
        factors = [_quant(chr(65 + i), levels=[1.0, 2.0, 3.0]) for i in range(5)]
        design = _build(factors, seed=0)
        assert len(design.runs) == 243
        assert design.notes is not None
        assert any("243" in note for note in design.notes)

    def test_81_runs_or_fewer_has_no_warning(self):
        """3^4 = 81: at the warn threshold, not above it -> no note."""
        factors = [_quant(chr(65 + i), levels=[1.0, 2.0, 3.0]) for i in range(4)]
        design = _build(factors, seed=0)
        assert len(design.runs) == 81
        assert design.notes is None

    def test_above_243_runs_raises(self):
        """4^4 = 256 > 243: must be refused with an actionable message."""
        factors = [_quant(chr(65 + i), levels=[1.0, 2.0, 3.0, 4.0]) for i in range(4)]
        with pytest.raises(DesignConfigError, match="256"):
            _build(factors, seed=0)


# ---------------------------------------------------------------------------
# Other guards: degenerate levels, qualitative multi-level, factor count
# ---------------------------------------------------------------------------


class TestOtherGuards:
    def test_single_level_factor_is_rejected(self):
        factors = [_quant("A", levels=[5.0]), _quant("B")]
        with pytest.raises(DesignConfigError):
            _build(factors)

    def test_qualitative_factor_with_more_than_two_levels_is_rejected(self):
        bad = _qual("A")
        # FactorSpec is a mutable Pydantic model; set the field directly (the
        # qualitative branch has no constructor argument for extra levels yet).
        bad.levels = [1.0, 2.0, 3.0]
        with pytest.raises(DesignConfigError):
            _build([bad, _quant("B")])

    def test_qualitative_factor_with_two_levels_is_allowed(self):
        factors = [_qual("A"), _quant("B")]
        design = _build(factors, seed=0)
        assert len(design.runs) == 4

    def test_single_factor_is_accepted(self):
        """1 fator quantitativo em 3 níveis é aceito: dentro de blocos é o RCBD
        do caso real do pesquisador (% de fibra em 3 níveis, 4 blocos -- ver
        test_um_fator.py). Sem bloco/réplica dá 3 ensaios, sem erro."""
        design = _build([_quant("A", levels=[1.0, 2.0, 3.0])])
        assert len(design.runs) == 3

    def test_zero_factors_raises(self):
        # DesignGenerateRequest exige min_length=1 em ``factors`` (schema), então
        # o construtor puro é chamado direto para exercer o guard k<1 desta
        # função (o schema nunca deixaria chegar zero fatores em produção).
        from services.design_builders import build_general_factorial_design

        req = _req([_quant("A", levels=[1.0, 2.0, 3.0])])
        with pytest.raises(DesignConfigError):
            build_general_factorial_design([], _resp(), req)

    def test_duplicate_factor_names_raise(self):
        with pytest.raises(DesignConfigError):
            _build([_quant("A"), _quant("A")])
