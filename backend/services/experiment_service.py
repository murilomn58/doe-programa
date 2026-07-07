"""Business rules for experiments.

NEVER imports fastapi. Depends on the ``ExperimentRepository`` port (a
``typing.Protocol``), so it can be exercised with a fake repo in tests. The
concrete SQLAlchemy repo is wired in ``deps.py``.
"""

from typing import Protocol

from domain.models import Experiment
from domain.schemas import ExperimentCreate


class ExperimentRepository(Protocol):
    """Port consumed by the service. Implementations return domain objects."""

    async def add(self, name: str, description: str | None) -> Experiment: ...

    async def list_all(self) -> list[Experiment]: ...


class ExperimentService:
    def __init__(self, repo: ExperimentRepository) -> None:
        self._repo = repo

    async def create_experiment(self, data: ExperimentCreate) -> Experiment:
        return await self._repo.add(name=data.name, description=data.description)

    async def list_experiments(self) -> list[Experiment]:
        return await self._repo.list_all()
