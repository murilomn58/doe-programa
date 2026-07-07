"""Data access for design generation via SQLAlchemy async.

Implements the ``DesignRepository`` port defined by ``DesignService``.
Persists ``Factor``/``Level``/``Response``/``Run`` for an experiment; a fresh
generation replaces any previously persisted design of that experiment.
"""

from dataclasses import asdict

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from domain.design import GeneratedDesign, PersistedDesign
from domain.models import Experiment, Factor, Level, Response, Run


class SqlAlchemyDesignRepo:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create_experiment(self, name: str) -> int:
        experiment = Experiment(name=name)
        self._session.add(experiment)
        await self._session.flush()
        return experiment.id

    async def get_experiment(self, experiment_id: int) -> Experiment | None:
        return await self._session.get(Experiment, experiment_id)

    async def save_design(
        self, experiment_id: int, design: GeneratedDesign
    ) -> PersistedDesign:
        await self._clear_existing(experiment_id)

        factor_ids: dict[str, int] = {}
        for f in design.factors:
            factor = Factor(
                experiment_id=experiment_id,
                name=f.name,
                factor_type=f.factor_type,
                unit=f.unit,
                position=f.position,
            )
            self._session.add(factor)
            await self._session.flush()
            factor_ids[f.name] = factor.id
            for lv in f.levels:
                self._session.add(
                    Level(
                        factor_id=factor.id,
                        coded_value=lv.coded,
                        natural_value=lv.natural,
                        label=lv.label,
                    )
                )

        response_ids: dict[str, int] = {}
        for r in design.responses:
            response = Response(
                experiment_id=experiment_id,
                name=r.name,
                unit=r.unit,
                position=r.position,
            )
            self._session.add(response)
            await self._session.flush()
            response_ids[r.name] = response.id

        run_ids: list[int] = []
        for run in design.runs:
            row = Run(
                experiment_id=experiment_id,
                run_order=run.run_order,
                std_order=run.std_order,
                point_type=run.point_type,
                block=run.block,
                replicate=run.replicate,
                cells={name: asdict(cell) for name, cell in run.cells.items()},
            )
            self._session.add(row)
            await self._session.flush()
            run_ids.append(row.id)

        return PersistedDesign(
            experiment_id=experiment_id,
            design_type=design.design_type,
            factor_ids=factor_ids,
            response_ids=response_ids,
            run_ids=run_ids,
        )

    async def _clear_existing(self, experiment_id: int) -> None:
        factor_ids = (
            await self._session.execute(
                select(Factor.id).where(Factor.experiment_id == experiment_id)
            )
        ).scalars().all()
        if factor_ids:
            await self._session.execute(
                delete(Level).where(Level.factor_id.in_(factor_ids))
            )
        await self._session.execute(
            delete(Factor).where(Factor.experiment_id == experiment_id)
        )
        await self._session.execute(
            delete(Response).where(Response.experiment_id == experiment_id)
        )
        await self._session.execute(
            delete(Run).where(Run.experiment_id == experiment_id)
        )
