"""Unit tests for the design-generation seam (DesignService + pure core).

Golden-matrix tests validate the 2^k generation against pyDOE3 directly; the
service is exercised through a FakeRepo implementing the ``DesignRepository``
Protocol, never against internals.
"""

from types import SimpleNamespace

import numpy as np
import pytest
from pyDOE3 import ff2n

from domain.design import GeneratedDesign, PersistedDesign
from domain.errors import DesignConfigError
from domain.schemas import DesignGenerateRequest, FactorSpec, ResponseSpec
from services.design_service import (
    DesignService,
    build_2k_design,
    coded_to_natural,
    natural_to_coded,
)


def _quant(name: str, low: float, high: float) -> FactorSpec:
    return FactorSpec(name=name, factor_type="quantitative", low=low, high=high)


def _qual(name: str, low: str, high: str) -> FactorSpec:
    return FactorSpec(
        name=name, factor_type="qualitative", low_label=low, high_label=high
    )


# --- golden-matrix (CA3) -----------------------------------------------------


def test_ff2n_3_is_8_rows_pm1():
    m = ff2n(3)
    assert m.shape == (8, 3)
    assert set(np.unique(m)) == {-1.0, 1.0}


def test_build_2k_matches_ff2n_standard_order():
    factors = [_quant("A", 0, 1), _quant("B", 0, 1), _quant("C", 0, 1)]
    design = build_2k_design(factors, responses=[], replicates=1, seed=0)
    assert len(design.runs) == 8
    ordered = sorted(design.runs, key=lambda r: r.std_order)
    coded = np.array(
        [[run.cells[name].coded for name in ("A", "B", "C")] for run in ordered]
    )
    assert np.array_equal(coded, ff2n(3).astype(int))


def test_2squared_two_replicates_gives_8_runs():
    factors = [_quant("A", 0, 1), _quant("B", 0, 1)]
    design = build_2k_design(factors, responses=[], replicates=2, seed=1)
    assert len(design.runs) == 8
    # Run Order is a randomized permutation 1..8
    assert sorted(r.run_order for r in design.runs) == list(range(1, 9))
    # Std Order is unique 1..8 across the two replicates
    assert sorted(r.std_order for r in design.runs) == list(range(1, 9))
    assert {r.replicate for r in design.runs} == {1, 2}
    # every point is a factorial corner, one block
    assert {r.point_type for r in design.runs} == {1}
    assert {r.block for r in design.runs} == {1}


# --- coding round-trip -------------------------------------------------------


def test_coding_roundtrip_quantitative():
    # %fibra 0 / 1.5 -> ±1 and back
    assert natural_to_coded(0.0, 0.0, 1.5) == pytest.approx(-1.0)
    assert natural_to_coded(1.5, 0.0, 1.5) == pytest.approx(1.0)
    assert coded_to_natural(-1, 0.0, 1.5) == pytest.approx(0.0)
    assert coded_to_natural(1, 0.0, 1.5) == pytest.approx(1.5)


def test_quantitative_cells_carry_natural_values():
    design = build_2k_design(
        [_quant("fibra", 0, 1.5), _quant("cimento", 5, 10)],
        responses=[],
        replicates=1,
        seed=0,
    )
    for run in design.runs:
        cell = run.cells["fibra"]
        assert (cell.coded == -1 and cell.natural == pytest.approx(0.0)) or (
            cell.coded == 1 and cell.natural == pytest.approx(1.5)
        )


# --- qualitative ±1 map (CA7 base) -------------------------------------------


def test_qualitative_map_persisted_and_recoverable():
    design = build_2k_design(
        [_quant("A", 0, 1), _qual("fibra", "Tucum", "Piassava")],
        responses=[],
        replicates=1,
        seed=0,
    )
    fibra = next(f for f in design.factors if f.name == "fibra")
    mapping = {lv.coded: lv.label for lv in fibra.levels}
    assert mapping == {-1: "Tucum", 1: "Piassava"}
    for run in design.runs:
        cell = run.cells["fibra"]
        assert (cell.coded == -1 and cell.label == "Tucum") or (
            cell.coded == 1 and cell.label == "Piassava"
        )


# --- config guards -----------------------------------------------------------


def test_single_factor_is_rejected():
    with pytest.raises(DesignConfigError):
        build_2k_design([_quant("A", 0, 1)], responses=[], replicates=1, seed=0)


def test_duplicate_factor_names_rejected():
    with pytest.raises(DesignConfigError):
        build_2k_design(
            [_quant("A", 0, 1), _quant("A", 0, 2)],
            responses=[],
            replicates=1,
            seed=0,
        )


# --- service with FakeRepo (Protocol) ----------------------------------------


class FakeDesignRepo:
    """In-memory stand-in satisfying the DesignRepository Protocol."""

    def __init__(self) -> None:
        self._next_id = 0
        self.experiments: dict[int, str] = {}
        self.saved: list[tuple[int, GeneratedDesign]] = []

    async def create_experiment(self, name: str) -> int:
        self._next_id += 1
        self.experiments[self._next_id] = name
        return self._next_id

    async def get_experiment(self, experiment_id: int):
        if experiment_id in self.experiments:
            return SimpleNamespace(id=experiment_id, name=self.experiments[experiment_id])
        return None

    async def save_design(
        self, experiment_id: int, design: GeneratedDesign
    ) -> PersistedDesign:
        self.saved.append((experiment_id, design))
        return PersistedDesign(
            experiment_id=experiment_id,
            design_type=design.design_type,
            factor_ids={f.name: i + 1 for i, f in enumerate(design.factors)},
            response_ids={r.name: i + 1 for i, r in enumerate(design.responses)},
            run_ids=list(range(1, len(design.runs) + 1)),
        )


async def test_service_generates_persists_and_returns_matrix():
    repo = FakeDesignRepo()
    service = DesignService(repo)
    req = DesignGenerateRequest(
        name="exp",
        factors=[_quant("A", 0, 1), _qual("fibra", "Tucum", "Piassava")],
        responses=[ResponseSpec(name="MR", unit="MPa")],
        replicates=2,
        seed=3,
    )
    result = await service.generate(req)

    assert result.experiment_id == 1
    assert result.n_runs == 8
    assert len(result.runs) == 8
    assert len(repo.saved) == 1 and repo.saved[0][0] == 1
    # response passed through and factor ids surfaced
    assert result.responses[0].name == "MR"
    assert result.factors[0].id == 1


async def test_service_rejects_unknown_experiment():
    repo = FakeDesignRepo()
    service = DesignService(repo)
    req = DesignGenerateRequest(
        experiment_id=999,
        factors=[_quant("A", 0, 1), _quant("B", 0, 1)],
    )
    with pytest.raises(DesignConfigError):
        await service.generate(req)
