"""APIRouter for table + report export (issue 09).

Thin controller: validates the request, delegates to ``ExportService`` (which
reuses the analysis lane for the numbers), and streams the bytes back as a file
download. Domain errors map to HTTP status: ``ExperimentNotFoundError`` -> 404,
bad table token / insufficient data -> 422, a Playwright/browser failure -> 502.

Three formats share the same ``{experiment_id, response_name, model}`` shape:
- ``POST /export/table`` -> CSV PT-BR of one table (anova/coefficients/matrix),
- ``POST /export/xlsx``  -> the 3-sheet workbook,
- ``POST /export/report`` -> the PDF rendered from the Next.js ``/report`` route.

The request schemas live HERE (not in ``domain.schemas``) — they are specific to
this endpoint and keep the export lane self-contained (issue 08 pattern).
"""

import os
from urllib.parse import quote

from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel, Field

from deps import ExportServiceDep
from domain.errors import ExperimentNotFoundError, InsufficientDataError
from domain.types import RSMModel
from services.export_service import (
    CSV_MEDIA_TYPE,
    PDF_MEDIA_TYPE,
    XLSX_MEDIA_TYPE,
    ReportRenderError,
    TableExportError,
)

router = APIRouter(prefix="/export", tags=["export"])

# Base URL of the Next.js frontend that hosts the /report route. Overridable so
# the same backend can point at a preview/prod deploy; default is local dev.
REPORT_BASE_URL = os.getenv("REPORT_BASE_URL", "http://localhost:3000").rstrip("/")
REPORT_READY_SELECTOR = "#report-ready"


class ExportTableRequest(BaseModel):
    """Body for ``POST /export/table`` — which table, of which fit, as CSV."""

    experiment_id: int
    response_name: str
    model: RSMModel = RSMModel.LINEAR
    table: str = Field(
        default="anova",
        description="anova | coefficients | design_matrix",
    )


class ExportXlsxRequest(BaseModel):
    """Body for ``POST /export/xlsx`` — the 3-sheet workbook of one fit."""

    experiment_id: int
    response_name: str
    model: RSMModel = RSMModel.LINEAR


class ExportReportRequest(BaseModel):
    """Body for ``POST /export/report`` — the one-click PDF of one fit."""

    experiment_id: int
    response_name: str
    model: RSMModel = RSMModel.LINEAR


def _attachment(filename: str) -> str:
    # RFC 5987 so non-ASCII response names survive the header.
    return f"attachment; filename*=UTF-8''{quote(filename)}"


@router.post("/table")
async def export_table(
    payload: ExportTableRequest, service: ExportServiceDep
) -> Response:
    try:
        content, filename = await service.export_table_csv(
            experiment_id=payload.experiment_id,
            response_name=payload.response_name,
            model=payload.model,
            table=payload.table,
        )
    except ExperimentNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    except (TableExportError, InsufficientDataError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)
        ) from exc

    return Response(
        content=content,
        media_type=CSV_MEDIA_TYPE,
        headers={"Content-Disposition": _attachment(filename)},
    )


@router.post("/xlsx")
async def export_xlsx(
    payload: ExportXlsxRequest, service: ExportServiceDep
) -> Response:
    try:
        content, filename = await service.export_xlsx(
            experiment_id=payload.experiment_id,
            response_name=payload.response_name,
            model=payload.model,
        )
    except ExperimentNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    except InsufficientDataError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)
        ) from exc

    return Response(
        content=content,
        media_type=XLSX_MEDIA_TYPE,
        headers={"Content-Disposition": _attachment(filename)},
    )


@router.post("/report")
async def export_report(
    payload: ExportReportRequest, service: ExportServiceDep
) -> Response:
    # Validate the experiment/model up-front so a bad request never spins up a
    # browser; the CSV path shares the same domain-error mapping.
    try:
        await service.export_table_csv(
            experiment_id=payload.experiment_id,
            response_name=payload.response_name,
            model=payload.model,
            table="anova",
        )
    except ExperimentNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    except (TableExportError, InsufficientDataError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)
        ) from exc

    url = _report_url(
        payload.experiment_id, payload.response_name, payload.model
    )
    try:
        content = await service.export_report_pdf(
            url, ready_selector=REPORT_READY_SELECTOR
        )
    except ReportRenderError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)
        ) from exc

    filename = f"relatorio_{_safe(payload.response_name)}.pdf"
    return Response(
        content=content,
        media_type=PDF_MEDIA_TYPE,
        headers={"Content-Disposition": _attachment(filename)},
    )


def _report_url(experiment_id: int, response_name: str, model: RSMModel) -> str:
    query = f"response={quote(response_name)}&model={quote(model.value)}"
    return f"{REPORT_BASE_URL}/report/{experiment_id}?{query}"


def _safe(text: str) -> str:
    return "".join(ch if ch.isalnum() else "-" for ch in text).strip("-").lower()
