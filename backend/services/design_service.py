"""Design generation core — the single seam for building DoE matrices.

NEVER imports fastapi. Pure generation (``build_2k_design`` and the coding
helpers) is framework- and database-free so it can be golden-tested directly
against pyDOE3. Persistence goes through the ``DesignRepository`` port.
"""

from typing import Protocol

import numpy as np
from pyDOE3 import ff2n

from domain.design import (
    CellData,
    FactorData,
    GeneratedDesign,
    LevelData,
    PersistedDesign,
    ResponseData,
    RunData,
)
from domain.errors import DesignConfigError
from domain.models import Experiment
from domain.schemas import (
    DesignGenerateRequest,
    DesignRead,
    FactorRead,
    FactorSpec,
    LevelRead,
    ResponseRead,
    ResponseSpec,
    RunCellRead,
    RunRead,
)
from domain.types import DesignType, FactorType, PointType

MAX_FACTORS = 10  # 2^10 = 1024 runs; guard against accidental blow-up


# --- coding: natural <-> coded (±1) ------------------------------------------


def natural_to_coded(x_nat: float, low: float, high: float) -> float:
    """Map a natural value to its coded ±1 position."""
    center = (high + low) / 2
    half = (high - low) / 2
    return (x_nat - center) / half


def coded_to_natural(x_cod: float, low: float, high: float) -> float:
    """Map a coded ±1 position back to its natural value."""
    center = (high + low) / 2
    half = (high - low) / 2
    return center + x_cod * half


# --- pure matrix generation --------------------------------------------------


def _factor_levels(factor: FactorSpec) -> list[LevelData]:
    """The persisted ±1 map for one factor."""
    if factor.factor_type is FactorType.QUANTITATIVE:
        return [
            LevelData(coded=-1, natural=float(factor.low)),
            LevelData(coded=1, natural=float(factor.high)),
        ]
    return [
        LevelData(coded=-1, label=factor.low_label),
        LevelData(coded=1, label=factor.high_label),
    ]


def _cell(factor: FactorSpec, coded: int) -> CellData:
    """The value of one factor at a coded ±1 position."""
    if factor.factor_type is FactorType.QUANTITATIVE:
        natural = coded_to_natural(coded, float(factor.low), float(factor.high))
        return CellData(coded=coded, natural=natural)
    label = factor.low_label if coded < 0 else factor.high_label
    return CellData(coded=coded, label=label)


def build_2k_design(
    factors: list[FactorSpec],
    responses: list[ResponseSpec],
    replicates: int,
    seed: int | None = None,
) -> GeneratedDesign:
    """Build a full 2^k factorial matrix (pure, no DB).

    Uses pyDOE3 ``ff2n`` for the ±1 corner points (its native standard order),
    replicates each std row, then assigns a randomized Run Order. Std Order is
    unique 1..N across replicates; every point is a factorial corner.
    """
    k = len(factors)
    if k < 2:
        raise DesignConfigError(
            "Um planejamento fatorial 2^k precisa de pelo menos 2 fatores."
        )
    if k > MAX_FACTORS:
        raise DesignConfigError(
            f"Número de fatores acima do limite ({MAX_FACTORS})."
        )
    if replicates < 1:
        raise DesignConfigError("O número de réplicas deve ser >= 1.")
    names = [f.name for f in factors]
    if len(set(names)) != len(names):
        raise DesignConfigError("Nomes de fatores devem ser únicos.")

    matrix = ff2n(k).astype(int)  # (2^k, k) of ±1, pyDOE3 standard order

    factor_data = [
        FactorData(
            name=f.name,
            factor_type=f.factor_type.value,
            unit=f.unit,
            position=pos,
            levels=_factor_levels(f),
        )
        for pos, f in enumerate(factors)
    ]
    response_data = [
        ResponseData(name=r.name, unit=r.unit, position=pos)
        for pos, r in enumerate(responses)
    ]

    # Build rows in std order (replicate-major), then randomize run order.
    rows: list[tuple[int, int, dict[str, CellData]]] = []
    std_order = 0
    for replicate in range(1, replicates + 1):
        for base_row in matrix:
            std_order += 1
            cells = {f.name: _cell(f, int(base_row[pos])) for pos, f in enumerate(factors)}
            rows.append((std_order, replicate, cells))

    rng = np.random.default_rng(seed)
    run_order = rng.permutation(len(rows)) + 1  # 1..N permutation

    runs = [
        RunData(
            run_order=int(run_order[i]),
            std_order=std,
            point_type=PointType.FACTORIAL,
            block=1,
            replicate=replicate,
            cells=cells,
        )
        for i, (std, replicate, cells) in enumerate(rows)
    ]

    return GeneratedDesign(
        design_type=DesignType.FULL_FACTORIAL_2K.value,
        factors=factor_data,
        responses=response_data,
        runs=runs,
    )


# --- persistence port --------------------------------------------------------


class DesignRepository(Protocol):
    """Port consumed by ``DesignService`` for persisting a generated design."""

    async def create_experiment(self, name: str) -> int: ...

    async def get_experiment(self, experiment_id: int) -> Experiment | None: ...

    async def save_design(
        self, experiment_id: int, design: GeneratedDesign
    ) -> PersistedDesign: ...


# --- service -----------------------------------------------------------------


class DesignService:
    def __init__(self, repo: DesignRepository) -> None:
        self._repo = repo

    async def generate(self, req: DesignGenerateRequest) -> DesignRead:
        design = _build_design(req)

        if req.experiment_id is not None:
            experiment = await self._repo.get_experiment(req.experiment_id)
            if experiment is None:
                raise DesignConfigError(
                    f"Experimento {req.experiment_id} não encontrado."
                )
            experiment_id = experiment.id
        else:
            name = (req.name or "").strip() or "Planejamento fatorial"
            experiment_id = await self._repo.create_experiment(name)

        persisted = await self._repo.save_design(experiment_id, design)
        return _to_design_read(experiment_id, design, persisted)


def _build_design(req: DesignGenerateRequest) -> GeneratedDesign:
    """Dispatch generation by design family (pure, no DB).

    Deferred import: ``design_builders`` reuses helpers from this module, so a
    top-level import would create a cycle (same pattern as ``plot_service``).
    """
    from services import design_builders, design_builders_screening

    if req.design_type is DesignType.CENTRAL_COMPOSITE:
        return design_builders.build_ccd_design(req.factors, req.responses, req)
    if req.design_type is DesignType.BOX_BEHNKEN:
        return design_builders.build_bbd_design(req.factors, req.responses, req)
    if req.design_type is DesignType.TAGUCHI:
        return design_builders_screening.build_taguchi_design(
            req.factors, req.responses, req
        )
    if req.design_type is DesignType.PLACKETT_BURMAN:
        return design_builders_screening.build_pb_design(
            req.factors, req.responses, req
        )
    if req.design_type is DesignType.OPTIMAL:
        return design_builders_screening.build_optimal_design(
            req.factors, req.responses, req
        )
    if req.design_type is DesignType.DSD:
        return design_builders_screening.build_dsd_design(
            req.factors, req.responses, req
        )

    if req.design_type is DesignType.FRACTIONAL_FACTORIAL_2KP:
        design = design_builders.build_fractional_design(
            req.factors, req.responses, req
        )
    else:  # FULL_FACTORIAL_2K — golden path, unchanged when center_points == 0
        design = build_2k_design(
            factors=req.factors,
            responses=req.responses,
            replicates=req.replicates,
            seed=req.seed,
        )
    if req.center_points > 0:
        design = design_builders.add_center_points(
            design, req.factors, req.center_points, req.seed
        )
    return design


def _to_design_read(
    experiment_id: int, design: GeneratedDesign, persisted: PersistedDesign
) -> DesignRead:
    factors = [
        FactorRead(
            id=persisted.factor_ids.get(f.name),
            name=f.name,
            factor_type=FactorType(f.factor_type),
            unit=f.unit,
            position=f.position,
            levels=[
                LevelRead(coded_value=lv.coded, natural_value=lv.natural, label=lv.label)
                for lv in f.levels
            ],
        )
        for f in design.factors
    ]
    responses = [
        ResponseRead(
            id=persisted.response_ids.get(r.name),
            name=r.name,
            unit=r.unit,
            position=r.position,
        )
        for r in design.responses
    ]
    runs = [
        RunRead(
            run_order=r.run_order,
            std_order=r.std_order,
            point_type=r.point_type,
            block=r.block,
            replicate=r.replicate,
            factors={
                name: RunCellRead(coded=c.coded, natural=c.natural, label=c.label)
                for name, c in r.cells.items()
            },
        )
        for r in design.runs
    ]
    runs.sort(key=lambda r: r.run_order)
    return DesignRead(
        experiment_id=experiment_id,
        design_type=DesignType(design.design_type),
        n_runs=len(runs),
        factors=factors,
        responses=responses,
        runs=runs,
        resolution=design.resolution,
        aliasing=design.aliasing,
        array_name=design.array_name,
        optimal_efficiency=design.optimal_efficiency,
    )
