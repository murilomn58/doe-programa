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
from services.export_service import ExportService
from services.publication_service import PublicationService
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


def get_publication_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> PublicationService:
    # Reuses the run repo (read-only): PublicationService drives AnalysisService
    # to get the PlotBundle, then renders it with matplotlib/SciencePlots.
    repo = SqlAlchemyRunRepo(session)
    return PublicationService(repo)


PublicationServiceDep = Annotated[
    PublicationService, Depends(get_publication_service)
]


def get_export_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ExportService:
    # Reuses the run repo (read-only): ExportService drives AnalysisService for
    # the numbers, then formats CSV/XLSX or renders the /report route to PDF.
    repo = SqlAlchemyRunRepo(session)
    return ExportService(repo)


ExportServiceDep = Annotated[ExportService, Depends(get_export_service)]


def get_retrospective_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> RetrospectiveService:
    # Reuses the design repo: create_experiment + save_design (same write shape).
    repo = SqlAlchemyDesignRepo(session)
    return RetrospectiveService(repo)


RetrospectiveServiceDep = Annotated[
    RetrospectiveService, Depends(get_retrospective_service)
]
