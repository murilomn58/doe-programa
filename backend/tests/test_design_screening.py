"""Golden tests for the screening/optimal design builders — Issue 07.

Oracles: pyDOE3 (Taguchi OAs, ``pbdesign``, ``compute_snr``) and the vendored
DSD core. Every family is checked structurally (run count, ±1 coding, rank) and,
where a closed form exists, numerically against the oracle.
"""

from itertools import combinations

import numpy as np
import pytest
from pyDOE3 import TaguchiObjective, compute_snr, pbdesign
from pyDOE3.orthogonal_arrays import ORTHOGONAL_ARRAYS

from domain.errors import DesignConfigError
from domain.schemas import (
    DesignGenerateRequest,
    DSDConfig,
    FactorSpec,
    OptimalConfig,
    ResponseSpec,
    TaguchiConfig,
)
from domain.types import (
    DesignType,
    FactorType,
    OptimalCriterion,
    PointType,
    RSMModel,
)
from services import design_builders_screening as scr
from services.stats_service import snr_larger, snr_nominal, snr_smaller
from vendor.dsd import compute_dsd

# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #


def _q(name: str, low: float = -1.0, high: float = 1.0, levels=None) -> FactorSpec:
    return FactorSpec(
        name=name,
        factor_type=FactorType.QUANTITATIVE,
        low=low,
        high=high,
        levels=levels,
    )


def _c(name: str, lo: str = "Tucum", hi: str = "Piassava") -> FactorSpec:
    return FactorSpec(
        name=name, factor_type=FactorType.QUALITATIVE, low_label=lo, high_label=hi
    )


def _resp() -> list[ResponseSpec]:
    return [ResponseSpec(name="Y")]


def _req(**kwargs) -> DesignGenerateRequest:
    # Builders take the real factors positionally; the request only carries the
    # family knobs (seed, taguchi/optimal/dsd config), so a stub factor suffices.
    kwargs.setdefault("factors", [_q("_stub")])
    return DesignGenerateRequest(**kwargs)


def _coded_matrix(design, names: list[str]) -> np.ndarray:
    """Reconstruct the coded matrix in std order from a GeneratedDesign."""
    n = len(design.runs)
    out = np.zeros((n, len(names)))
    for r in design.runs:
        for j, name in enumerate(names):
            out[r.std_order - 1, j] = r.cells[name].coded
    return out


# --------------------------------------------------------------------------- #
# Taguchi
# --------------------------------------------------------------------------- #


class TestTaguchi:
    def test_l8_three_two_level_factors_gives_8_runs(self):
        factors = [_q("A"), _q("B"), _q("C")]
        design = scr.build_taguchi_design(
            factors, _resp(), _req(taguchi=TaguchiConfig(array_name="L8"))
        )
        assert design.design_type == DesignType.TAGUCHI.value
        assert design.array_name == "L8(2^7)"
        assert len(design.runs) == 8

    def test_l8_columns_match_oa_oracle(self):
        factors = [_q("A"), _q("B"), _q("C")]
        design = scr.build_taguchi_design(
            factors, _resp(), _req(seed=7, taguchi=TaguchiConfig(array_name="L8"))
        )
        oa = np.asarray(ORTHOGONAL_ARRAYS["L8(2^7)"])[:, :3]
        expected = np.where(oa == 0, -1.0, 1.0)
        got = _coded_matrix(design, ["A", "B", "C"])
        assert np.array_equal(got, expected)

    def test_all_columns_are_pm_one(self):
        design = scr.build_taguchi_design(
            [_q("A"), _q("B"), _q("C")],
            _resp(),
            _req(taguchi=TaguchiConfig(array_name="L8")),
        )
        coded = _coded_matrix(design, ["A", "B", "C"])
        assert set(np.unique(coded).tolist()) <= {-1.0, 1.0}

    def test_auto_selects_smallest_oa(self):
        # 3 two-level factors fit the smallest 2-level array L4 (4 runs).
        design = scr.build_taguchi_design([_q("A"), _q("B"), _q("C")], _resp(), _req())
        assert design.array_name == "L4(2^3)"
        assert len(design.runs) == 4

    def test_auto_select_needs_l8_for_seven_factors(self):
        design = scr.build_taguchi_design(
            [_q(c) for c in "ABCDEFG"], _resp(), _req()
        )
        assert design.array_name == "L8(2^7)"
        assert len(design.runs) == 8

    def test_three_level_factors_use_l9(self):
        factors = [_q("A", levels=[10, 20, 30]), _q("B", levels=[1, 2, 3])]
        design = scr.build_taguchi_design(factors, _resp(), _req())
        assert design.array_name == "L9(3^4)"
        assert len(design.runs) == 9
        coded = _coded_matrix(design, ["A", "B"])
        assert set(np.unique(coded).tolist()) <= {-1.0, 0.0, 1.0}

    def test_three_level_natural_values_mapped(self):
        factors = [_q("A", levels=[10, 20, 30])]
        design = scr.build_taguchi_design(
            factors, _resp(), _req(taguchi=TaguchiConfig(array_name="L9"))
        )
        naturals = {r.cells["A"].natural for r in design.runs}
        assert naturals == {10.0, 20.0, 30.0}

    def test_too_many_factors_raises_with_suggestion(self):
        factors = [_q(c) for c in "ABCDEFGH"]  # 8 two-level factors, L8 holds 7
        with pytest.raises(DesignConfigError) as exc:
            scr.build_taguchi_design(
                factors, _resp(), _req(taguchi=TaguchiConfig(array_name="L8"))
            )
        assert "L12" in str(exc.value) or "L16" in str(exc.value)

    def test_unknown_array_name_raises(self):
        with pytest.raises(DesignConfigError):
            scr.build_taguchi_design(
                [_q("A"), _q("B")],
                _resp(),
                _req(taguchi=TaguchiConfig(array_name="L7")),
            )

    def test_catalog_sorted_by_runs(self):
        catalog = scr.taguchi_catalog()
        runs = [row["runs"] for row in catalog]
        assert runs == sorted(runs)
        first = catalog[0]
        assert first["name"] == "L4(2^3)"
        assert first["level_capacity"] == {2: 3}


# --------------------------------------------------------------------------- #
# Signal-to-Noise ratios
# --------------------------------------------------------------------------- #


class TestSNR:
    Y = np.array([8.0, 10.0, 12.0])

    def test_larger_matches_hand_value(self):
        expected = -10.0 * np.log10(np.mean(1.0 / self.Y**2))
        assert snr_larger(self.Y) == pytest.approx(expected)
        assert snr_larger(self.Y) == pytest.approx(
            compute_snr(self.Y, TaguchiObjective.LARGER_IS_BETTER)
        )

    def test_smaller_matches_hand_value(self):
        expected = -10.0 * np.log10(np.mean(self.Y**2))
        assert snr_smaller(self.Y) == pytest.approx(expected)
        assert snr_smaller(self.Y) == pytest.approx(
            compute_snr(self.Y, TaguchiObjective.SMALLER_IS_BETTER)
        )

    def test_nominal_matches_hand_value(self):
        expected = 10.0 * np.log10(np.mean(self.Y) ** 2 / np.var(self.Y, ddof=1))
        assert snr_nominal(self.Y) == pytest.approx(expected)
        assert snr_nominal(self.Y) == pytest.approx(
            compute_snr(self.Y, TaguchiObjective.NOMINAL_IS_BEST)
        )

    def test_larger_prefers_bigger_responses(self):
        assert snr_larger(np.array([20.0, 22.0, 24.0])) > snr_larger(self.Y)


# --------------------------------------------------------------------------- #
# Plackett-Burman
# --------------------------------------------------------------------------- #


class TestPlackettBurman:
    def test_five_factors_need_8_runs(self):
        design = scr.build_pb_design([_q(c) for c in "ABCDE"], _resp(), _req())
        assert design.design_type == DesignType.PLACKETT_BURMAN.value
        assert len(design.runs) == 8  # next multiple of 4 > 5

    def test_eleven_factors_need_12_runs(self):
        design = scr.build_pb_design([_q(c) for c in "ABCDEFGHIJK"], _resp(), _req())
        assert len(design.runs) == 12

    def test_matches_pbdesign_oracle(self):
        names = ["A", "B", "C", "D", "E"]
        design = scr.build_pb_design(
            [_q(n) for n in names], _resp(), _req(seed=3)
        )
        expected = pbdesign(len(names)).astype(int)
        got = _coded_matrix(design, names).astype(int)
        assert np.array_equal(got, expected)

    def test_all_pm_one(self):
        design = scr.build_pb_design([_q(c) for c in "ABCD"], _resp(), _req())
        coded = _coded_matrix(design, ["A", "B", "C", "D"])
        assert set(np.unique(coded).tolist()) == {-1.0, 1.0}

    def test_single_factor_rejected(self):
        with pytest.raises(DesignConfigError):
            scr.build_pb_design([_q("A")], _resp(), _req())


# --------------------------------------------------------------------------- #
# D/I-optimal
# --------------------------------------------------------------------------- #


class TestOptimal:
    def _model_matrix(self, design, factors, model):
        names = [f.name for f in factors]
        coded = _coded_matrix(design, names)
        return scr._model_matrix(coded, factors, model)

    def test_d_optimal_full_rank(self):
        factors = [_q("A"), _q("B"), _q("C")]
        design = scr.build_optimal_design(
            factors,
            _resp(),
            _req(
                seed=1,
                optimal=OptimalConfig(
                    criterion=OptimalCriterion.D,
                    n_runs=10,
                    model=RSMModel.LINEAR_INTERACTIONS,
                ),
            ),
        )
        assert len(design.runs) == 10
        x = self._model_matrix(design, factors, RSMModel.LINEAR_INTERACTIONS)
        assert np.linalg.matrix_rank(x) == x.shape[1]

    def test_n_runs_below_params_raises(self):
        factors = [_q("A"), _q("B"), _q("C")]
        # FULL model on 3 quant factors: 1 + 3 + 3 + 3 = 10 params
        with pytest.raises(DesignConfigError) as exc:
            scr.build_optimal_design(
                factors,
                _resp(),
                _req(optimal=OptimalConfig(n_runs=5, model=RSMModel.FULL)),
            )
        assert "parâmetros" in str(exc.value)

    def test_categorical_enters_by_single_dummy(self):
        factors = [_q("A"), _q("B"), _c("Fibra")]
        design = scr.build_optimal_design(
            factors,
            _resp(),
            _req(
                seed=2,
                optimal=OptimalConfig(
                    criterion=OptimalCriterion.D,
                    n_runs=12,
                    model=RSMModel.LINEAR_INTERACTIONS,
                ),
            ),
        )
        # The categorical only ever takes its two labels (coded ±1).
        cat_coded = {r.cells["Fibra"].coded for r in design.runs}
        assert cat_coded <= {-1.0, 1.0}
        cat_labels = {r.cells["Fibra"].label for r in design.runs}
        assert cat_labels <= {"Tucum", "Piassava"}
        x = self._model_matrix(design, factors, RSMModel.LINEAR_INTERACTIONS)
        assert np.linalg.matrix_rank(x) == x.shape[1]

    def test_no_categorical_quadratic_column(self):
        # FULL model with a categorical: the dummy² is dropped, so a full-rank
        # design must exist (a squared ±1 dummy would be a constant column).
        factors = [_q("A"), _q("B"), _c("Fibra")]
        cfg = OptimalConfig(n_runs=14, model=RSMModel.FULL)
        design = scr.build_optimal_design(factors, _resp(), _req(seed=5, optimal=cfg))
        x = self._model_matrix(design, factors, RSMModel.FULL)
        # params = intercept(1) + main(3) + 2FI(3) + quad(2 quant only) = 9
        assert x.shape[1] == 9
        assert np.linalg.matrix_rank(x) == 9

    def test_efficiency_reported(self):
        factors = [_q("A"), _q("B")]
        design = scr.build_optimal_design(
            factors,
            _resp(),
            _req(
                seed=1,
                optimal=OptimalConfig(
                    n_runs=6, model=RSMModel.LINEAR_INTERACTIONS
                ),
            ),
        )
        assert 0.0 < design.optimal_efficiency <= 1.0 + 1e-9

    def test_i_optimal_full_rank(self):
        factors = [_q("A"), _q("B")]
        design = scr.build_optimal_design(
            factors,
            _resp(),
            _req(
                seed=1,
                optimal=OptimalConfig(
                    criterion=OptimalCriterion.I,
                    n_runs=8,
                    model=RSMModel.FULL,
                ),
            ),
        )
        x = self._model_matrix(design, factors, RSMModel.FULL)
        assert np.linalg.matrix_rank(x) == x.shape[1]


# --------------------------------------------------------------------------- #
# Definitive Screening Design
# --------------------------------------------------------------------------- #


def _corr(a: np.ndarray, b: np.ndarray) -> float:
    a = a - a.mean()
    b = b - b.mean()
    na, nb = np.linalg.norm(a), np.linalg.norm(b)
    if na < 1e-12 or nb < 1e-12:
        return 0.0
    return float(np.dot(a, b) / (na * nb))


class TestDSD:
    def test_four_numeric_gives_2k_plus_one(self):
        factors = [_q("A"), _q("B"), _q("C"), _q("D")]
        design = scr.build_dsd_design(factors, _resp(), _req(dsd=DSDConfig()))
        assert design.design_type == DesignType.DSD.value
        assert len(design.runs) == 2 * 4 + 1  # 9 runs

    def test_numeric_columns_are_minus_one_zero_one(self):
        factors = [_q("A"), _q("B"), _q("C")]
        design = scr.build_dsd_design(factors, _resp(), _req())
        coded = _coded_matrix(design, ["A", "B", "C"])
        assert set(np.unique(coded).tolist()) <= {-1.0, 0.0, 1.0}

    def test_main_effects_orthogonal_to_second_order(self):
        # Defining DSD property: main effects have ~0 correlation with every
        # quadratic and two-factor interaction column.
        factors = [_q("A"), _q("B"), _q("C"), _q("D")]
        design = scr.build_dsd_design(factors, _resp(), _req())
        names = ["A", "B", "C", "D"]
        m = _coded_matrix(design, names)
        second = []
        for j in range(len(names)):
            second.append(m[:, j] ** 2)
        for i, j in combinations(range(len(names)), 2):
            second.append(m[:, i] * m[:, j])
        second = np.array(second).T
        max_corr = 0.0
        for i in range(len(names)):
            for c in range(second.shape[1]):
                max_corr = max(max_corr, abs(_corr(m[:, i], second[:, c])))
        assert max_corr < 1e-9

    def test_categorical_two_level(self):
        factors = [_q("A"), _q("B"), _q("C"), _c("Fibra")]
        design = scr.build_dsd_design(factors, _resp(), _req(dsd=DSDConfig()))
        cat_labels = {r.cells["Fibra"].label for r in design.runs}
        assert cat_labels <= {"Tucum", "Piassava"}
        cat_coded = {r.cells["Fibra"].coded for r in design.runs}
        assert cat_coded <= {-1.0, 1.0}

    def test_matches_vendored_core(self):
        factors = [_q("A"), _q("B"), _q("C")]
        design = scr.build_dsd_design(factors, _resp(), _req())
        expected = compute_dsd(3, 0)
        got = _coded_matrix(design, ["A", "B", "C"])
        assert np.array_equal(got, expected)

    def test_has_center_run(self):
        factors = [_q("A"), _q("B"), _q("C")]
        design = scr.build_dsd_design(factors, _resp(), _req())
        assert any(r.point_type == PointType.CENTER for r in design.runs)

    def test_categorical_three_level_rejected(self):
        bad = FactorSpec(
            name="F",
            factor_type=FactorType.QUALITATIVE,
            low_label="A",
            high_label="B",
            levels=[1.0, 2.0, 3.0],
        )
        with pytest.raises(DesignConfigError):
            scr.build_dsd_design([_q("A"), bad], _resp(), _req())
