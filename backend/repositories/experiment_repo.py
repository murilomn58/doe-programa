"""Data access for experiments via SQLAlchemy async.

Returns domain objects (``Experiment`` model instances), never raw rows.
Implements the ``ExperimentRepository`` port defined by the service.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from domain.models import Experiment


class SqlAlchemyExperimentRepo:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, name: str, description: str | None) -> Experiment:
        experiment = Experiment(name=name, description=description)
        self._session.add(experiment)
        await self._session.flush()
        await self._session.refresh(experiment)
        return experiment

    async def list_all(self) -> list[Experiment]:
        result = await self._session.execute(select(Experiment).order_by(Experiment.id))
        return list(result.scalars().all())
