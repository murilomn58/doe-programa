"""APIRouter for design generation — the only layer that knows HTTP.

Thin controller: maps request schema -> service call -> response schema, and
translates domain errors to HTTP 422. No business logic here.
"""

from fastapi import APIRouter, HTTPException, status

from deps import DesignServiceDep
from domain.errors import DesignConfigError
from domain.schemas import (
    DesignGenerateRequest,
    DesignRead,
    TaguchiArrayRead,
    TaguchiCatalogRead,
)

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


@router.get("/taguchi-catalog", response_model=TaguchiCatalogRead)
async def taguchi_catalog() -> TaguchiCatalogRead:
    """List the Taguchi orthogonal arrays available for the DesignPicker."""
    from services.design_builders_screening import taguchi_catalog as _catalog

    return TaguchiCatalogRead(
        arrays=[
            TaguchiArrayRead(
                name=row["name"],
                runs=row["runs"],
                n_columns=row["n_columns"],
                level_capacity=row["level_capacity"],
            )
            for row in _catalog()
        ]
    )
