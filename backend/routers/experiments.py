"""APIRouter for experiments — the only layer that knows HTTP.

Thin controller: maps request schema -> service call -> response schema.
No business logic here.
"""

from fastapi import APIRouter, status

from deps import ExperimentServiceDep
from domain.schemas import ExperimentCreate, ExperimentRead

router = APIRouter(prefix="/experiments", tags=["experiments"])


@router.post("", response_model=ExperimentRead, status_code=status.HTTP_201_CREATED)
async def create_experiment(
    payload: ExperimentCreate, service: ExperimentServiceDep
) -> ExperimentRead:
    experiment = await service.create_experiment(payload)
    return ExperimentRead.model_validate(experiment)


@router.get("", response_model=list[ExperimentRead])
async def list_experiments(service: ExperimentServiceDep) -> list[ExperimentRead]:
    experiments = await service.list_experiments()
    return [ExperimentRead.model_validate(e) for e in experiments]
