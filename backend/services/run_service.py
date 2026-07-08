"""Response-entry core — the seam for filling in the measured Y values.

NEVER imports fastapi. Value parsing is a pure, directly-testable function;
persistence goes through the ``RunRepository`` port (a ``typing.Protocol``), so
the service can be exercised with a fake repo. Reuses the ``Run``/``Response``
entities from issue 02 and stores values in ``Run.response_values`` (JSON).
"""

from typing import Protocol

from domain.errors import ExperimentNotFoundError, ResponseValueError
from domain.models import Experiment, Factor, Response, Run
from domain.schemas import (
    FactorRead,
    LevelRead,
    ResponseRead,
    ResponsesUpsertRequest,
    RunCellRead,
    RunRead,
    RunsRead,
)
from domain.types import FactorType

# --- pure value parsing (validation) -----------------------------------------


def parse_response_value(raw: str | float | None) -> float | None:
    """Parse one raw response cell into a float, or ``None`` when empty.

    Accepts numbers already parsed, numeric strings with ``.`` or PT-BR ``,``
    decimal separators, and treats empty/whitespace as ``None`` (partial entry
    is allowed). A non-numeric, non-empty value raises ``ResponseValueError``.
    """
    if raw is None:
        return None
    if isinstance(raw, int | float):
        return float(raw)
    text = raw.strip()
    if not text:
        return None
    try:
        return float(text.replace(",", "."))
    except ValueError as exc:
        raise ResponseValueError(f"Valor não numérico: '{raw}'.") from exc


# --- persistence port --------------------------------------------------------


class RunRepository(Protocol):
    """Port consumed by ``RunService`` for reading/updating a design's runs."""

    async def get_experiment(self, experiment_id: int) -> Experiment | None: ...

    async def get_factors(self, experiment_id: int) -> list[Factor]: ...

    async def get_responses(self, experiment_id: int) -> list[Response]: ...

    async def get_runs(self, experiment_id: int) -> list[Run]: ...

    async def upsert_response_values(
        self, experiment_id: int, values: dict[int, dict[str, float | None]]
    ) -> None: ...


# --- service -----------------------------------------------------------------


class RunService:
    def __init__(self, repo: RunRepository) -> None:
        self._repo = repo

    async def get_runs(self, experiment_id: int) -> RunsRead:
        await self._require_experiment(experiment_id)
        factors = await self._repo.get_factors(experiment_id)
        responses = await self._repo.get_responses(experiment_id)
        runs = await self._repo.get_runs(experiment_id)
        return _to_runs_read(experiment_id, factors, responses, runs)

    async def save_responses(
        self, experiment_id: int, req: ResponsesUpsertRequest
    ) -> RunsRead:
        await self._require_experiment(experiment_id)

        known_runs = {r.id for r in await self._repo.get_runs(experiment_id)}
        known_responses = {r.name for r in await self._repo.get_responses(experiment_id)}

        # Validate & parse everything BEFORE touching persistence (all-or-nothing).
        grouped: dict[int, dict[str, float | None]] = {}
        for item in req.values:
            if item.run_id not in known_runs:
                raise ResponseValueError(
                    f"Ensaio {item.run_id} não pertence ao experimento {experiment_id}."
                )
            if item.response_name not in known_responses:
                raise ResponseValueError(
                    f"Resposta '{item.response_name}' não existe neste experimento."
                )
            parsed = parse_response_value(item.value)
            grouped.setdefault(item.run_id, {})[item.response_name] = parsed

        if grouped:
            await self._repo.upsert_response_values(experiment_id, grouped)
        return await self.get_runs(experiment_id)

    async def _require_experiment(self, experiment_id: int) -> None:
        if await self._repo.get_experiment(experiment_id) is None:
            raise ExperimentNotFoundError(
                f"Experimento {experiment_id} não encontrado."
            )


def _to_runs_read(
    experiment_id: int,
    factors: list[Factor],
    responses: list[Response],
    runs: list[Run],
) -> RunsRead:
    factor_reads = [
        FactorRead(
            id=f.id,
            name=f.name,
            factor_type=FactorType(f.factor_type),
            unit=f.unit,
            position=f.position,
            levels=[
                LevelRead(
                    coded_value=lv.coded_value,
                    natural_value=lv.natural_value,
                    label=lv.label,
                )
                for lv in sorted(f.levels, key=lambda lv: lv.coded_value)
            ],
        )
        for f in sorted(factors, key=lambda f: f.position)
    ]
    response_reads = [
        ResponseRead(id=r.id, name=r.name, unit=r.unit, position=r.position)
        for r in sorted(responses, key=lambda r: r.position)
    ]
    run_reads = [
        RunRead(
            id=run.id,
            run_order=run.run_order,
            std_order=run.std_order,
            point_type=run.point_type,
            block=run.block,
            replicate=run.replicate,
            factors={
                name: RunCellRead(
                    coded=cell["coded"],
                    natural=cell.get("natural"),
                    label=cell.get("label"),
                )
                for name, cell in run.cells.items()
            },
            response_values=dict(run.response_values or {}),
        )
        for run in sorted(runs, key=lambda run: run.run_order)
    ]
    return RunsRead(
        experiment_id=experiment_id,
        n_runs=len(run_reads),
        factors=factor_reads,
        responses=response_reads,
        runs=run_reads,
    )
