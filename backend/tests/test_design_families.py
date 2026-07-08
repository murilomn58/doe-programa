"""TDD tests for design family builders — Issue 06.

Tests are written BEFORE implementation (Red-Green-Refactor).
Golden-matrix comparisons use pyDOE3 directly as the oracle.
"""
import numpy as np
import pytest
from pyDOE3 import ccdesign as pydoe_ccdesign, bbdesign as pydoe_bbdesign

from domain.errors import DesignConfigError
from domain.schemas import (
    CCDConfig,
    DesignGenerateRequest,
    FactorSpec,
    FractionalConfig,
    ResponseSpec,
)
from domain.types import CCDVariant, DesignType, FactorType, PointType
from services.design_builders import (
    build_bbd_design,
    build_ccd_design,
    build_fractional_design,
)
from services.design_service import build_2k_design


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _quant(name: str, low: float = 0.0, high: float = 100.0) -> FactorSpec:
    return FactorSpec(name=name, factor_type=FactorType.QUANTITATIVE, low=low, high=high)


def _qual(name: str, lo: str = "L", hi: str = "H") -> FactorSpec:
    return FactorSpec(name=name, factor_type=FactorType.QUALITATIVE, low_label=lo, high_label=hi)


def _resp() -> list[ResponseSpec]:
    return [ResponseSpec(name="Y")]


def _req(**kwargs) -> DesignGenerateRequest:
    return DesignGenerateRequest(**kwargs)


# ---------------------------------------------------------------------------
# Fractional factorial
# ---------------------------------------------------------------------------


class TestFractionalDesign:
    """fracfact / fracfact_by_res builders."""

    def test_generators_half_fraction_k3_gives_4_runs(self):
        design = build_fractional_design(
            [_quant("A"), _quant("B"), _quant("C")],
            _resp(),
            _req(
                design_type=DesignType.FRACTIONAL_FACTORIAL_2KP,
                factors=[_quant("A"), _quant("B"), _quant("C")],
                responses=_resp(),
                fractional=FractionalConfig(generators="a b ab"),
            ),
        )
        assert len(design.runs) == 4

    def test_generators_half_fraction_resolution_iii(self):
        """Half-fraction 2^(3-1) from generators 'a b ab' → Resolution III."""
        design = build_fractional_design(
            [_quant("A"), _quant("B"), _quant("C")],
            _resp(),
            _req(
                design_type=DesignType.FRACTIONAL_FACTORIAL_2KP,
                factors=[_quant("A"), _quant("B"), _quant("C")],
                responses=_resp(),
                fractional=FractionalConfig(generators="a b ab"),
            ),
        )
        assert design.resolution == 3
        assert design.aliasing is not None
        assert len(design.aliasing) > 0

    def test_aliasing_strings_contain_separator(self):
        """Aliasing strings must have ' = ' between aliased groups."""
        design = build_fractional_design(
            [_quant("A"), _quant("B"), _quant("C")],
            _resp(),
            _req(
                design_type=DesignType.FRACTIONAL_FACTORIAL_2KP,
                factors=[_quant("A"), _quant("B"), _quant("C")],
                responses=_resp(),
                fractional=FractionalConfig(generators="a b ab"),
            ),
        )
        assert any(" = " in s for s in (design.aliasing or []))

    def test_resolution_by_res_5factors_gives_8_runs(self):
        """fracfact_by_res(5, 3) → 2^(5-2) = 8 runs."""
        design = build_fractional_design(
            [_quant(n) for n in "ABCDE"],
            _resp(),
            _req(
                design_type=DesignType.FRACTIONAL_FACTORIAL_2KP,
                factors=[_quant(n) for n in "ABCDE"],
                responses=_resp(),
                fractional=FractionalConfig(resolution=3),
            ),
        )
        assert len(design.runs) == 8
        assert design.resolution == 3

    def test_fractional_cells_are_pm1(self):
        """All coded values in a fractional factorial must be ±1."""
        design = build_fractional_design(
            [_quant("A"), _quant("B"), _quant("C")],
            _resp(),
            _req(
                design_type=DesignType.FRACTIONAL_FACTORIAL_2KP,
                factors=[_quant("A"), _quant("B"), _quant("C")],
                responses=_resp(),
                fractional=FractionalConfig(generators="a b ab"),
            ),
        )
        for run in design.runs:
            for cell in run.cells.values():
                assert abs(cell.coded) == pytest.approx(1.0)

    def test_invalid_generators_raises(self):
        """Non-existent generator should propagate as DesignConfigError."""
        with pytest.raises(DesignConfigError):
            build_fractional_design(
                [_quant("A"), _quant("B")],
                _resp(),
                _req(
                    design_type=DesignType.FRACTIONAL_FACTORIAL_2KP,
                    factors=[_quant("A"), _quant("B")],
                    responses=_resp(),
                    # Only 1 factor specified — can't do fractional with 1 factor
                    fractional=FractionalConfig(generators="a"),
                ),
            )

    def test_fractional_config_requires_exactly_one_of_generators_or_resolution(self):
        """Both set or neither set → validation error from Pydantic."""
        with pytest.raises(Exception):
            FractionalConfig(generators="a b ab", resolution=3)
        with pytest.raises(Exception):
            FractionalConfig()  # neither


# ---------------------------------------------------------------------------
# Center points on 2^k (tested via build_2k_design + post-processing in service)
# ---------------------------------------------------------------------------


class TestCenterPoints:
    """Center points added to 2^k design."""

    def test_2k_with_3_centers_gives_7_runs(self):
        """2^2 with center_points=3 → 4 factorial + 3 center = 7 total."""
        from services.design_builders import add_center_points

        base = build_2k_design(
            [_quant("A"), _quant("B")], _resp(), replicates=1, seed=0
        )
        design = add_center_points(base, [_quant("A"), _quant("B")], n=3, seed=0)
        assert len(design.runs) == 7
        centers = [r for r in design.runs if r.point_type == PointType.CENTER]
        assert len(centers) == 3

    def test_center_point_coded_is_zero(self):
        """Center points must have coded=0 for every factor."""
        from services.design_builders import add_center_points

        base = build_2k_design(
            [_quant("A"), _quant("B")], _resp(), replicates=1, seed=0
        )
        design = add_center_points(base, [_quant("A"), _quant("B")], n=2, seed=0)
        centers = [r for r in design.runs if r.point_type == PointType.CENTER]
        for run in centers:
            for cell in run.cells.values():
                assert cell.coded == pytest.approx(0.0)

    def test_center_natural_is_midpoint(self):
        """Center natural value = (low + high) / 2."""
        from services.design_builders import add_center_points

        factors = [_quant("A", low=10.0, high=30.0), _quant("B", low=0.0, high=20.0)]
        base = build_2k_design(factors, _resp(), replicates=1, seed=0)
        design = add_center_points(base, factors, n=1, seed=0)
        centers = [r for r in design.runs if r.point_type == PointType.CENTER]
        assert centers[0].cells["A"].natural == pytest.approx(20.0)
        assert centers[0].cells["B"].natural == pytest.approx(10.0)


# ---------------------------------------------------------------------------
# CCD tests
# ---------------------------------------------------------------------------


class TestCCDDesign:
    """ccdesign builder."""

    def test_rotatable_ccd_k2_axial_sqrt2(self):
        """Rotatable CCD k=2: axial coded distance = sqrt(2)."""
        design = build_ccd_design(
            [_quant("A"), _quant("B")],
            _resp(),
            _req(
                design_type=DesignType.CENTRAL_COMPOSITE,
                factors=[_quant("A"), _quant("B")],
                responses=_resp(),
                ccd=CCDConfig(variant=CCDVariant.ROTATABLE, center_factorial=4, center_axial=4),
            ),
        )
        axial = [r for r in design.runs if r.point_type == PointType.AXIAL]
        assert len(axial) > 0
        expected_alpha = np.sqrt(2)
        for run in axial:
            coded_vals = [run.cells[f].coded for f in ("A", "B")]
            assert max(abs(v) for v in coded_vals) == pytest.approx(
                expected_alpha, rel=1e-9
            )

    def test_face_centered_alpha_is_one(self):
        """Face-centered CCD: axial coded value magnitude = 1."""
        design = build_ccd_design(
            [_quant("A"), _quant("B")],
            _resp(),
            _req(
                design_type=DesignType.CENTRAL_COMPOSITE,
                factors=[_quant("A"), _quant("B")],
                responses=_resp(),
                ccd=CCDConfig(variant=CCDVariant.FACE_CENTERED),
            ),
        )
        axial = [r for r in design.runs if r.point_type == PointType.AXIAL]
        for run in axial:
            coded_vals = [run.cells[f].coded for f in ("A", "B")]
            assert max(abs(v) for v in coded_vals) == pytest.approx(1.0, rel=1e-9)

    def test_ccd_natural_of_axial_point(self):
        """Axial point natural value = center ± alpha * half_amplitude."""
        alpha = np.sqrt(2)  # rotatable, k=2
        design = build_ccd_design(
            [_quant("A", low=10.0, high=30.0), _quant("B")],
            _resp(),
            _req(
                design_type=DesignType.CENTRAL_COMPOSITE,
                factors=[_quant("A", low=10.0, high=30.0), _quant("B")],
                responses=_resp(),
                ccd=CCDConfig(variant=CCDVariant.ROTATABLE),
            ),
        )
        # A: center=20, half=10 → natural at +alpha = 20 + sqrt(2)*10
        pos_axial_a = [
            r
            for r in design.runs
            if r.point_type == PointType.AXIAL
            and abs(r.cells["A"].coded - alpha) < 1e-6
        ]
        if pos_axial_a:
            expected_nat = 20.0 + alpha * 10.0
            assert pos_axial_a[0].cells["A"].natural == pytest.approx(
                expected_nat, rel=1e-9
            )

    def test_ccd_qualitative_factor_raises(self):
        with pytest.raises(DesignConfigError):
            build_ccd_design(
                [_quant("A"), _qual("B")],
                _resp(),
                _req(
                    design_type=DesignType.CENTRAL_COMPOSITE,
                    factors=[_quant("A"), _qual("B")],
                    responses=_resp(),
                    ccd=CCDConfig(),
                ),
            )

    def test_ccd_point_types_classified_correctly(self):
        """CCD must have factorial, center and axial point types."""
        design = build_ccd_design(
            [_quant("A"), _quant("B")],
            _resp(),
            _req(
                design_type=DesignType.CENTRAL_COMPOSITE,
                factors=[_quant("A"), _quant("B")],
                responses=_resp(),
                ccd=CCDConfig(variant=CCDVariant.ROTATABLE, center_factorial=4, center_axial=4),
            ),
        )
        point_types = {r.point_type for r in design.runs}
        assert PointType.FACTORIAL in point_types
        assert PointType.CENTER in point_types
        assert PointType.AXIAL in point_types

    def test_ccd_n_runs_matches_pydoe3(self):
        """Total runs must match raw pyDOE3 matrix row count."""
        matrix = pydoe_ccdesign(2, center=(4, 4), alpha="rotatable", face="circumscribed")
        design = build_ccd_design(
            [_quant("A"), _quant("B")],
            _resp(),
            _req(
                design_type=DesignType.CENTRAL_COMPOSITE,
                factors=[_quant("A"), _quant("B")],
                responses=_resp(),
                ccd=CCDConfig(variant=CCDVariant.ROTATABLE, center_factorial=4, center_axial=4),
            ),
        )
        assert len(design.runs) == matrix.shape[0]


# ---------------------------------------------------------------------------
# BBD tests
# ---------------------------------------------------------------------------


class TestBBDDesign:
    """bbdesign builder."""

    def test_bbd_k3_center3_gives_15_runs(self):
        """BBD with k=3 and center=3 → 15 runs."""
        design = build_bbd_design(
            [_quant("A"), _quant("B"), _quant("C")],
            _resp(),
            _req(
                design_type=DesignType.BOX_BEHNKEN,
                factors=[_quant("A"), _quant("B"), _quant("C")],
                responses=_resp(),
                bbd_center=3,
            ),
        )
        assert len(design.runs) == 15

    def test_bbd_matches_pydoe3_row_count(self):
        """Row count matches raw pyDOE3 bbdesign oracle."""
        for k in [3, 4, 5]:
            factors = [_quant(chr(65 + i)) for i in range(k)]
            matrix = pydoe_bbdesign(k, center=3)
            design = build_bbd_design(
                factors,
                _resp(),
                _req(
                    design_type=DesignType.BOX_BEHNKEN,
                    factors=factors,
                    responses=_resp(),
                    bbd_center=3,
                ),
            )
            assert len(design.runs) == matrix.shape[0], f"k={k}"

    def test_bbd_k2_raises(self):
        """BBD requires k >= 3."""
        with pytest.raises(DesignConfigError):
            build_bbd_design(
                [_quant("A"), _quant("B")],
                _resp(),
                _req(
                    design_type=DesignType.BOX_BEHNKEN,
                    factors=[_quant("A"), _quant("B")],
                    responses=_resp(),
                    bbd_center=3,
                ),
            )

    def test_bbd_qualitative_raises(self):
        with pytest.raises(DesignConfigError):
            build_bbd_design(
                [_quant("A"), _quant("B"), _qual("C")],
                _resp(),
                _req(
                    design_type=DesignType.BOX_BEHNKEN,
                    factors=[_quant("A"), _quant("B"), _qual("C")],
                    responses=_resp(),
                    bbd_center=3,
                ),
            )

    def test_bbd_center_points_coded_all_zero(self):
        """Center runs must have all coded=0."""
        design = build_bbd_design(
            [_quant("A"), _quant("B"), _quant("C")],
            _resp(),
            _req(
                design_type=DesignType.BOX_BEHNKEN,
                factors=[_quant("A"), _quant("B"), _quant("C")],
                responses=_resp(),
                bbd_center=3,
            ),
        )
        centers = [r for r in design.runs if r.point_type == PointType.CENTER]
        assert len(centers) == 3
        for run in centers:
            for cell in run.cells.values():
                assert cell.coded == pytest.approx(0.0)
