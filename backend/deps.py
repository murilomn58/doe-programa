"""Dependency-injection compositor — the ONLY place wiring is done.

Providers assemble concrete implementations (SQLAlchemy repo) behind the ports
the service depends on, so routers/services stay ignorant of construction.
"""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_session
from repositories.experiment_repo import SqlAlchemyExperimentRepo
from services.experiment_service import ExperimentService


def get_experiment_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ExperimentService:
    repo = SqlAlchemyExperimentRepo(session)
    return ExperimentService(repo)


ExperimentServiceDep = Annotated[ExperimentService, Depends(get_experiment_service)]
