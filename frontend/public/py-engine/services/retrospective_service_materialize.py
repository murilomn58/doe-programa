"""Materialize an already-run table into a persisted experiment.

The seam between the pure retrospective diagnosis and the database. Re-runs
``diagnose`` internally (never trusts the client's classification), builds a
``GeneratedDesign(design_type=RETROSPECTIVE)`` — constant factors excluded,
each valid row a ``RunData`` with its measured ``response_values`` — appends any
extra planned runs (without responses), and persists via the design repo port.

Critical contract: the persisted shape is IDENTICAL to a generated design, so
the existing ``POST /analysis`` works on the new experiment with no changes.
"""

from typing import Protocol

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
from domain.schemas import RetroDiagnoseRequest, RetroMaterializeRequest, RetroMaterializeResult
from domain.types import DesignType, PointType
from services import retrospective_service as retro
from services.retrospective_service import FactorScale

# classify_runs point-type string -> persisted OriginPro-style integer code.
_POINT_TYPE_CODE = {
    "factorial": PointType.FACTORIAL,
    "center": PointType.CENTER,
    "axial": PointType.AXIAL,
    "edge": PointType.AXIAL,  # BBD edge: not a corner, reuse the axial code
    "other": PointType.FACTORIAL,
}


class RetroDesignRepository(Protocol):
    """Port consumed by ``RetrospectiveService`` to persist the materialized design."""

    async def create_experiment(self, name: str) -> int: ...

    async def get_experiment(self, experiment_id: int) -> Experiment | None: ...

    async def save_design(
        self, experiment_id: int, design: GeneratedDesign
    ) -> PersistedDesign: ...


class RetrospectiveService:
    def __init__(self, repo: RetroDesignRepository) -> None:
        self._repo = repo

    async def materialize(self, req: RetroMaterializeRequest) -> RetroMaterializeResult:
        design, excluded, warnings = _build_retrospective_design(req)
        experiment_id = await self._repo.create_experiment(req.name.strip())
        await self._repo.save_design(experiment_id, design)
        return RetroMaterializeResult(
            experiment_id=experiment_id,
            design_type=design.design_type,
            n_runs=len(design.runs),
            excluded_constant_factors=excluded,
            warnings=warnings,
        )


# --- pure build (no DB) --------------------------------------------------------


def _diagnose_request(req: RetroMaterializeRequest) -> RetroDiagnoseRequest:
    return RetroDiagnoseRequest(
        factors=req.factors, responses=req.responses, rows=req.rows,
        response_name=req.response_name,
    )


def _factor_data(scale: FactorScale, position: int) -> FactorData:
    """A persisted ±1 factor map from an inferred (non-constant) scale."""
    if scale.factor_type == "qualitative":
        labels = scale.labels or []
        levels = [
            LevelData(coded=-1, label=labels[0] if labels else None),
            LevelData(coded=1, label=labels[1] if len(labels) > 1 else None),
        ]
    else:
        levels = [
            LevelData(coded=-1, natural=float(scale.low)),
            LevelData(coded=1, natural=float(scale.high)),
        ]
    return FactorData(
        name=scale.name, factor_type=scale.factor_type, unit=None,
        position=position, levels=levels,
    )


def _cell(scale: FactorScale, value: float | str, coded: float) -> CellData:
    if scale.factor_type == "qualitative":
        return CellData(coded=coded, label=str(value))
    return CellData(coded=coded, natural=float(value))


def _snap(coded: float) -> float:
    """Snap a coded value to the ±1/0/±alpha grid the classifier used."""
    for target in (0.0, -1.0, 1.0):
        if abs(coded - target) <= retro.CODED_SNAP_TOL:
            return target
    return coded


def _build_retrospective_design(
    req: RetroMaterializeRequest,
) -> tuple[GeneratedDesign, list[str], list[str]]:
    diag_req = _diagnose_request(req)
    parsed = retro.parse_table(diag_req)
    scales = retro.infer_factor_scales(parsed)
    runs_class = retro.classify_runs(parsed, scales)

    kept = [s for s in scales if not s.is_constant]
    excluded = [s.name for s in scales if s.is_constant]
    if not kept:
        raise DesignConfigError(
            "Nenhum fator variou nos dados; não há planejamento a materializar."
        )

    warnings: list[str] = []
    if excluded:
        warnings.append(
            f"Fatores constantes excluídos do experimento: {', '.join(excluded)}."
        )
    for s in kept:
        is_multilevel = (
            s.factor_type == "qualitative"
            and s.label_map is None
            and s.labels
            and len(s.labels) > 2
        )
        if is_multilevel:
            warnings.append(
                f"Fator '{s.name}' é categórico multinível ({len(s.labels)} categorias); "
                "materializado com um mapa ±1 parcial (apenas as duas primeiras categorias)."
            )

    factors = [_factor_data(s, pos) for pos, s in enumerate(kept)]
    responses = [
        ResponseData(name=r.name, unit=r.unit, position=pos)
        for pos, r in enumerate(req.responses)
    ]

    # runs_class is aligned 1:1 with parsed.rows (both skip excluded rows).
    runs: list[RunData] = []
    for order, (prow, rclass) in enumerate(zip(parsed.rows, runs_class, strict=True), start=1):
        cells = {
            s.name: _cell(s, prow.factors[s.name], _snap(rclass.coded.get(s.name, 0.0)))
            for s in kept
        }
        response_values = {
            name: float(v) for name, v in prow.responses.items() if v is not None
        }
        runs.append(RunData(
            run_order=order, std_order=order,
            point_type=_POINT_TYPE_CODE.get(rclass.point_type, PointType.FACTORIAL),
            block=1, replicate=rclass.replicate_group, cells=cells,
            response_values=response_values or None,
        ))

    runs.extend(_append_runs(req.append_runs, kept, len(runs)))

    design = GeneratedDesign(
        design_type=DesignType.RETROSPECTIVE.value,
        factors=factors, responses=responses, runs=runs,
    )
    return design, excluded, warnings


def _append_runs(
    append: list[dict[str, float | str]] | None,
    kept: list[FactorScale],
    n_existing: int,
) -> list[RunData]:
    """Extra planned runs (natural values/labels), persisted without responses."""
    if not append:
        return []
    extra: list[RunData] = []
    for i, run in enumerate(append, start=1):
        order = n_existing + i
        cells: dict[str, CellData] = {}
        for s in kept:
            value = run.get(s.name)
            if value is None:
                raise DesignConfigError(
                    f"Ensaio extra {i}: falta o valor do fator '{s.name}'."
                )
            if s.factor_type == "qualitative":
                coded = s.label_map.get(str(value), 0.0) if s.label_map else 0.0
                cells[s.name] = CellData(coded=_snap(coded), label=str(value))
            else:
                half = (s.high - s.low) / 2
                coded = (float(value) - s.center) / half if half else 0.0
                cells[s.name] = CellData(coded=_snap(coded), natural=float(value))
        extra.append(RunData(
            run_order=order, std_order=order, point_type=PointType.FACTORIAL,
            block=1, replicate=0, cells=cells, response_values=None,
        ))
    return extra
