"""Dependency-injection compositor — the ONLY place wiring is done.

Providers assemble concrete implementations (SQLAlchemy repo) behind the ports
the service depends on, so routers/services stay ignorant of construction.
"""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_session
from repositories.design_repo import SqlAlchemyDesignRepo
from repositories.experiment_repo import SqlAlchemyExperimentRepo
from repositories.run_repo import SqlAlchemyRunRepo
from services.design_service import DesignService
from services.experiment_service import ExperimentService
from services.run_service import RunService


def get_experiment_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ExperimentService:
    repo = SqlAlchemyExperimentRepo(session)
    return ExperimentService(repo)


ExperimentServiceDep = Annotated[ExperimentService, Depends(get_experiment_service)]


def get_design_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> DesignService:
    repo = SqlAlchemyDesignRepo(session)
    return DesignService(repo)


DesignServiceDep = Annotated[DesignService, Depends(get_design_service)]


def get_run_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> RunService:
    repo = SqlAlchemyRunRepo(session)
    return RunService(repo)


RunServiceDep = Annotated[RunService, Depends(get_run_service)]
