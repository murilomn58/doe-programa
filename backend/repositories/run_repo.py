"""Data access for run/response entry via SQLAlchemy async.

Implements the ``RunRepository`` port defined by ``RunService``. Reads the
persisted design (factors/levels/responses/runs) and applies a bulk upsert of
measured response values into each ``Run.response_values`` JSON blob.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from domain.models import Experiment, Factor, Response, Run


class SqlAlchemyRunRepo:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_experiment(self, experiment_id: int) -> Experiment | None:
        return await self._session.get(Experiment, experiment_id)

    async def get_factors(self, experiment_id: int) -> list[Factor]:
        result = await self._session.execute(
            select(Factor)
            .where(Factor.experiment_id == experiment_id)
            .options(selectinload(Factor.levels))
            .order_by(Factor.position)
        )
        return list(result.scalars().all())

    async def get_responses(self, experiment_id: int) -> list[Response]:
        result = await self._session.execute(
            select(Response)
            .where(Response.experiment_id == experiment_id)
            .order_by(Response.position)
        )
        return list(result.scalars().all())

    async def get_runs(self, experiment_id: int) -> list[Run]:
        result = await self._session.execute(
            select(Run)
            .where(Run.experiment_id == experiment_id)
            .order_by(Run.run_order)
        )
        return list(result.scalars().all())

    async def upsert_response_values(
        self, experiment_id: int, values: dict[int, dict[str, float | None]]
    ) -> None:
        if not values:
            return
        result = await self._session.execute(
            select(Run).where(
                Run.experiment_id == experiment_id,
                Run.id.in_(values.keys()),
            )
        )
        for run in result.scalars().all():
            # Reassign a fresh dict so SQLAlchemy detects the JSON change.
            run.response_values = {**(run.response_values or {}), **values[run.id]}
        await self._session.flush()
