"""APIRouter for run/response entry — the only layer that knows HTTP.

Thin controller: maps request schema -> service call -> response schema and
translates domain errors (bad value / not found) to HTTP status codes. No
business logic here.
"""

from fastapi import APIRouter, HTTPException, status

from deps import RunServiceDep
from domain.errors import ExperimentNotFoundError, ResponseValueError
from domain.schemas import ResponsesUpsertRequest, RunsRead

router = APIRouter(prefix="/experiments", tags=["runs"])


@router.get("/{experiment_id}/runs", response_model=RunsRead)
async def get_runs(experiment_id: int, service: RunServiceDep) -> RunsRead:
    try:
        return await service.get_runs(experiment_id)
    except ExperimentNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc


@router.post("/{experiment_id}/runs/responses", response_model=RunsRead)
async def save_responses(
    experiment_id: int, payload: ResponsesUpsertRequest, service: RunServiceDep
) -> RunsRead:
    try:
        return await service.save_responses(experiment_id, payload)
    except ExperimentNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    except ResponseValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)
        ) from exc
