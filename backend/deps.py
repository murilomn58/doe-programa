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
from services.analysis_service import AnalysisService
from services.design_service import DesignService
from services.experiment_service import ExperimentService
from services.retrospective_service_materialize import RetrospectiveService
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


def get_analysis_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> AnalysisService:
    # Reuses the run repo: same read-only shape (experiment/factors/responses/runs).
    repo = SqlAlchemyRunRepo(session)
    return AnalysisService(repo)


AnalysisServiceDep = Annotated[AnalysisService, Depends(get_analysis_service)]


def get_retrospective_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> RetrospectiveService:
    # Reuses the design repo: create_experiment + save_design (same write shape).
    repo = SqlAlchemyDesignRepo(session)
    return RetrospectiveService(repo)


RetrospectiveServiceDep = Annotated[
    RetrospectiveService, Depends(get_retrospective_service)
]
