"""APIRouter for retrospective design diagnosis + materialization.

The only layer that knows HTTP. ``/diagnose`` is stateless (no DB): it maps the
pasted table to the pure ``retrospective_analysis.diagnose`` and sanitizes any
non-finite float to null (valid JSON), mirroring ``routers/analysis.py``.
``/materialize`` re-runs the diagnosis server-side and persists the experiment
through the ``RetrospectiveService``, translating domain errors to HTTP 422.
"""

import math

from fastapi import APIRouter, HTTPException, status

from deps import RetrospectiveServiceDep
from domain.errors import DesignConfigError
from domain.schemas import (
    RetroDiagnoseRequest,
    RetroDiagnoseResponse,
    RetroMaterializeRequest,
    RetroMaterializeResult,
)
from services import retrospective_analysis

router = APIRouter(prefix="/retrospective", tags=["retrospective"])


@router.post("/diagnose", response_model=RetroDiagnoseResponse)
async def diagnose(payload: RetroDiagnoseRequest) -> RetroDiagnoseResponse:
    result = retrospective_analysis.diagnose(payload)
    # Non-finite floats (e.g. a degenerate coded value) would break JSON; null them.
    return RetroDiagnoseResponse.model_validate(_sanitize(result.model_dump()))


@router.post("/materialize", response_model=RetroMaterializeResult)
async def materialize(
    payload: RetroMaterializeRequest, service: RetrospectiveServiceDep
) -> RetroMaterializeResult:
    try:
        return await service.materialize(payload)
    except DesignConfigError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)
        ) from exc


def _sanitize(value):
    """Recursively map NaN/inf floats to None so the response stays valid JSON."""
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, dict):
        return {k: _sanitize(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_sanitize(v) for v in value]
    return value
