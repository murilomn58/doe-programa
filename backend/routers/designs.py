"""APIRouter for design generation — the only layer that knows HTTP.

Thin controller: maps request schema -> service call -> response schema, and
translates domain errors to HTTP 422. No business logic here.
"""

from fastapi import APIRouter, HTTPException, status

from deps import DesignServiceDep
from domain.errors import DesignConfigError
from domain.schemas import DesignGenerateRequest, DesignRead

router = APIRouter(prefix="/designs", tags=["designs"])


@router.post(
    "/generate", response_model=DesignRead, status_code=status.HTTP_201_CREATED
)
async def generate_design(
    payload: DesignGenerateRequest, service: DesignServiceDep
) -> DesignRead:
    try:
        return await service.generate(payload)
    except DesignConfigError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)
        ) from exc
